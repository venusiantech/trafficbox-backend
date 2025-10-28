const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const AlphaTrafficData = require("../models/AlphaTrafficData");
const AlphaTrafficSummary = require("../models/AlphaTrafficSummary");
const logger = require("../utils/logger");

const router = express.Router();

// Get Alpha dashboard overview - aggregated data from all user's Alpha campaigns
router.get("/overview", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    // Get all Alpha campaigns for the user (or all if admin)
    const campaignQuery = {
      spark_traffic_project_id: { $exists: true, $ne: null },
      is_archived: { $ne: true },
      state: { $nin: ["archived", "deleted"] },
    };

    if (!isAdmin) {
      campaignQuery.user = userId;
    }

    const alphaCampaigns = await Campaign.find(campaignQuery).select(
      "_id title spark_traffic_project_id user state countries spark_traffic_data"
    );
    const campaignIds = alphaCampaigns.map((c) => c._id);

    if (campaignIds.length === 0) {
      return res.json({
        ok: true,
        overview: {
          totalCampaigns: 0,
          totalHits: 0,
          totalVisits: 0,
          totalViews: 0,
          uniqueVisitors: 0,
          averageSpeed: 0,
          topCountries: [],
          campaignPerformance: [],
          timeRangeMetrics: {},
        },
        message: "No Alpha campaigns found",
      });
    }

    // Get the latest traffic data for each campaign (most recent cumulative totals)
    const latestTrafficData = await AlphaTrafficData.aggregate([
      { $match: { campaign: { $in: campaignIds } } },
      { $sort: { campaign: 1, timestamp: -1 } },
      {
        $group: {
          _id: "$campaign",
          latestData: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latestData" } },
      {
        $lookup: {
          from: "campaigns",
          localField: "campaign",
          foreignField: "_id",
          as: "campaignInfo",
        },
      },
      { $unwind: "$campaignInfo" },
    ]);

    // Create a map of campaign statuses for quick lookup
    const campaignStatusMap = new Map();
    alphaCampaigns.forEach((campaign) => {
      campaignStatusMap.set(
        campaign._id.toString(),
        campaign.state || "unknown"
      );
    });

    // Calculate aggregate metrics
    let totalHits = 0;
    let totalVisits = 0;
    let totalViews = 0;
    let uniqueVisitors = 0;
    let speedSum = 0;
    let validDataCount = 0;

    const countryMap = new Map();
    const campaignPerformance = [];
    const allUniqueCountries = new Set(); // Track all unique countries across campaigns

    latestTrafficData.forEach((data) => {
      const campaignStatus =
        campaignStatusMap.get(data.campaign.toString()) || "unknown";

      // Map campaign state to user-friendly status (matching alpha.js logic)
      const userFriendlyStatus =
        campaignStatus === "paused"
          ? "paused"
          : campaignStatus === "created"
          ? "active"
          : campaignStatus === "archived"
          ? "archived"
          : campaignStatus;

      const isActiveCampaign = userFriendlyStatus === "active";

      // Only count metrics for active campaigns
      if (isActiveCampaign) {
        totalHits += data.hits || 0;
        totalVisits += data.visits || 0;
        totalViews += data.views || 0;
        uniqueVisitors += data.uniqueVisitors || 0;

        if (data.speed > 0) {
          speedSum += data.speed;
          validDataCount++;
        }

        // Aggregate country data only for active campaigns
        if (data.countryBreakdown && Array.isArray(data.countryBreakdown)) {
          data.countryBreakdown.forEach((country) => {
            if (country.country) {
              const existing = countryMap.get(country.country) || {
                hits: 0,
                visits: 0,
                views: 0,
              };
              existing.hits += country.hits || 0;
              existing.visits += country.visits || 0;
              existing.views += country.views || 0;
              countryMap.set(country.country, existing);
            }
          });
        }
      }

      // Campaign performance data (include all campaigns but show status)
      const campaignCountries = [];

      // Check if campaign has countries configured (regardless of geo_type)
      if (
        data.campaignInfo.countries &&
        Array.isArray(data.campaignInfo.countries) &&
        data.campaignInfo.countries.length > 0
      ) {
        // Extract countries based on format
        data.campaignInfo.countries.forEach((country) => {
          if (typeof country === "string") {
            // Old format: array of country codes
            campaignCountries.push(country);
            allUniqueCountries.add(country);
          } else if (typeof country === "object" && country.country) {
            // New format: array of objects with country and percent
            campaignCountries.push(country.country);
            allUniqueCountries.add(country.country);
          }
        });
      }

      // Determine geoType based on whether countries are configured
      const geoType = campaignCountries.length > 0 ? "countries" : "global";

      campaignPerformance.push({
        campaignId: data.campaign,
        title: data.campaignInfo.title,
        projectId: data.campaignInfo.spark_traffic_project_id,
        hits: data.hits || 0,
        visits: data.visits || 0,
        views: data.views || 0,
        uniqueVisitors: data.uniqueVisitors || 0,
        speed: data.speed || 0,
        lastUpdated: data.timestamp,
        campaignStatus: userFriendlyStatus,
        geoType: geoType,
        countries: campaignCountries,
      });
    });

    // Calculate averages
    const averageSpeed = validDataCount > 0 ? speedSum / validDataCount : 0;

    // Convert country map to sorted array (from traffic data) - only country codes
    const topCountriesFromTraffic = Array.from(countryMap.entries())
      .sort(([, a], [, b]) => b.hits - a.hits)
      .slice(0, 10)
      .map(([country]) => country);

    // Create comprehensive country list including all unique countries from campaigns - only country codes
    const allCountriesList = Array.from(allUniqueCountries)
      .map((country) => {
        const trafficData = countryMap.get(country);
        return {
          country,
          hits: trafficData?.hits || 0,
        };
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10)
      .map((item) => item.country);

    // Use traffic-based countries if available, otherwise use all countries from campaigns
    const topCountries =
      topCountriesFromTraffic.length > 0
        ? topCountriesFromTraffic
        : allCountriesList;

    // Get time range metrics (15m, 1h, 7d, 30d aggregates)
    const timeRangeMetrics = await getTimeRangeMetrics(campaignIds);

    res.json({
      ok: true,
      overview: {
        totalCampaigns: alphaCampaigns.length,
        totalHits,
        totalVisits,
        totalViews,
        uniqueVisitors,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        topCountries,
        campaignPerformance: campaignPerformance.sort(
          (a, b) => b.hits - a.hits
        ),
        timeRangeMetrics,
      },
      metadata: {
        dataCollectedFrom: alphaCampaigns.length,
        lastCalculated: new Date(),
        userType: isAdmin ? "admin" : "user",
      },
    });
  } catch (error) {
    logger.error("Failed to get Alpha dashboard overview", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get time range metrics
async function getTimeRangeMetrics(campaignIds) {
  const timeRanges = ["15m", "1h", "7d", "30d"];
  const metrics = {};

  for (const range of timeRanges) {
    const summaries = await AlphaTrafficSummary.find({
      campaign: { $in: campaignIds },
      timeRange: range,
    })
      .sort({ windowStart: -1 })
      .limit(1);

    if (summaries.length > 0) {
      const summary = summaries[0];
      metrics[range] = {
        totalHits: summary.totalHits,
        totalVisits: summary.totalVisits,
        totalViews: summary.totalViews,
        uniqueVisitors: summary.uniqueVisitors,
        avgSpeed: summary.avgSpeed,
        avgBounceRate: summary.avgBounceRate,
        lastUpdated: summary.lastUpdated,
      };
    } else {
      metrics[range] = {
        totalHits: 0,
        totalVisits: 0,
        totalViews: 0,
        uniqueVisitors: 0,
        avgSpeed: 0,
        avgBounceRate: 0,
        lastUpdated: null,
      };
    }
  }

  return metrics;
}

module.exports = router;
