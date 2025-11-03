const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const AlphaTrafficData = require("../models/AlphaTrafficData");
const AlphaTrafficSummary = require("../models/AlphaTrafficSummary");
const alphaTrafficTrackingService = require("../services/alphaTrafficTrackingService");
const logger = require("../utils/logger");

const router = express.Router();

// Get Alpha dashboard overview - aggregated data from all user''s Alpha campaigns
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

    // Fetch real-time metrics for all campaigns using the alphaTrafficTrackingService
    const campaignMetricsPromises = alphaCampaigns.map(async (campaign) => {
      try {
        const currentMetrics = await alphaTrafficTrackingService.getCurrentAlphaTrafficMetrics(campaign._id.toString());
        return {
          campaign,
          currentMetrics,
        };
      } catch (error) {
        logger.error("Failed to get metrics for campaign", {
          campaignId: campaign._id,
          error: error.message,
        });
        return {
          campaign,
          currentMetrics: null,
        };
      }
    });

    const campaignMetricsResults = await Promise.all(campaignMetricsPromises);

    // Create a map of campaign statuses for quick lookup
    const campaignStatusMap = new Map();
    alphaCampaigns.forEach((campaign) => {
      campaignStatusMap.set(
        campaign._id.toString(),
        campaign.state || "unknown"
      );
    });

    // Calculate aggregate metrics from real-time data
    let totalHits = 0;
    let totalVisits = 0;
    let totalViews = 0;
    let uniqueVisitors = 0;
    let speedSum = 0;
    let validDataCount = 0;

    const countryMap = new Map();
    const campaignPerformance = [];
    const allUniqueCountries = new Set(); // Track all unique countries across campaigns
    const timeRangeMetricsAggregated = {};

    campaignMetricsResults.forEach(({ campaign, currentMetrics }) => {
      if (!currentMetrics) return;

      const campaignStatus = campaignStatusMap.get(campaign._id.toString()) || "unknown";

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

      // Use the 1h metrics as the primary source for totals (matching existing behavior)
      const primaryMetrics = currentMetrics["1h"] || {};

      // Only count metrics for active campaigns
      if (isActiveCampaign) {
        totalHits += primaryMetrics.totalHits || 0;
        totalVisits += primaryMetrics.totalVisits || 0;
        totalViews += primaryMetrics.totalViews || 0;
        uniqueVisitors += primaryMetrics.uniqueVisitors || 0;

        if (primaryMetrics.avgSpeed > 0) {
          speedSum += primaryMetrics.avgSpeed;
          validDataCount++;
        }

        // Aggregate country data only for active campaigns
        if (primaryMetrics.countryBreakdown && Array.isArray(primaryMetrics.countryBreakdown)) {
          primaryMetrics.countryBreakdown.forEach((country) => {
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

      // Aggregate time range metrics across all campaigns
      for (const [rangeKey, rangeMetrics] of Object.entries(currentMetrics)) {
        if (!timeRangeMetricsAggregated[rangeKey]) {
          timeRangeMetricsAggregated[rangeKey] = {
            label: rangeMetrics.label,
            totalHits: 0,
            totalViews: 0,
            totalVisits: 0,
            uniqueVisitors: 0,
            avgSpeed: 0,
            avgBounceRate: 0,
            speedSum: 0,
            bounceRateSum: 0,
            validSpeedCount: 0,
            validBounceCount: 0,
            lastUpdated: null,
            campaignsCount: 0,
          };
        }

        const aggregated = timeRangeMetricsAggregated[rangeKey];
        aggregated.totalHits += rangeMetrics.totalHits || 0;
        aggregated.totalViews += rangeMetrics.totalViews || 0;
        aggregated.totalVisits += rangeMetrics.totalVisits || 0;
        aggregated.uniqueVisitors += rangeMetrics.uniqueVisitors || 0;

        if (rangeMetrics.avgSpeed > 0) {
          aggregated.speedSum += rangeMetrics.avgSpeed;
          aggregated.validSpeedCount++;
        }

        if (rangeMetrics.avgBounceRate > 0) {
          aggregated.bounceRateSum += rangeMetrics.avgBounceRate;
          aggregated.validBounceCount++;
        }

        if (rangeMetrics.lastUpdated) {
          if (!aggregated.lastUpdated || new Date(rangeMetrics.lastUpdated) > new Date(aggregated.lastUpdated)) {
            aggregated.lastUpdated = rangeMetrics.lastUpdated;
          }
        }

        if (rangeMetrics.totalHits > 0 || rangeMetrics.totalVisits > 0) {
          aggregated.campaignsCount++;
        }
      }

      // Campaign performance data (include all campaigns but show status)
      const campaignCountries = [];

      // Check if campaign has countries configured (regardless of geo_type)
      if (
        campaign.countries &&
        Array.isArray(campaign.countries) &&
        campaign.countries.length > 0
      ) {
        // Extract countries based on format
        campaign.countries.forEach((country) => {
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
        campaignId: campaign._id,
        title: campaign.title,
        projectId: campaign.spark_traffic_project_id,
        hits: primaryMetrics.totalHits || 0,
        visits: primaryMetrics.totalVisits || 0,
        views: primaryMetrics.totalViews || 0,
        uniqueVisitors: primaryMetrics.uniqueVisitors || 0,
        speed: primaryMetrics.avgSpeed || 0,
        lastUpdated: primaryMetrics.lastUpdated,
        campaignStatus: userFriendlyStatus,
        geoType: geoType,
        countries: campaignCountries,
      });
    });

    // Calculate averages for time range metrics
    const timeRangeMetrics = {};
    for (const [rangeKey, aggregated] of Object.entries(timeRangeMetricsAggregated)) {
      timeRangeMetrics[rangeKey] = {
        label: aggregated.label,
        totalHits: aggregated.totalHits,
        totalViews: aggregated.totalViews,
        totalVisits: aggregated.totalVisits,
        uniqueVisitors: aggregated.uniqueVisitors,
        avgSpeed: aggregated.validSpeedCount > 0 
          ? Math.round((aggregated.speedSum / aggregated.validSpeedCount) * 100) / 100 
          : 0,
        avgBounceRate: aggregated.validBounceCount > 0 
          ? Math.round((aggregated.bounceRateSum / aggregated.validBounceCount) * 100) / 100 
          : 0,
        lastUpdated: aggregated.lastUpdated,
        campaignsCount: aggregated.campaignsCount,
      };
    }

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

module.exports = router;
