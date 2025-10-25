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
      "_id title spark_traffic_project_id user"
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
          averageBounceRate: 0,
          averageSessionDuration: 0,
          topCountries: [],
          recentActivity: [],
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

    // Calculate aggregate metrics
    let totalHits = 0;
    let totalVisits = 0;
    let totalViews = 0;
    let uniqueVisitors = 0;
    let speedSum = 0;
    let bounceRateSum = 0;
    let sessionDurationSum = 0;
    let validDataCount = 0;

    const countryMap = new Map();
    const campaignPerformance = [];

    latestTrafficData.forEach((data) => {
      totalHits += data.hits || 0;
      totalVisits += data.visits || 0;
      totalViews += data.views || 0;
      uniqueVisitors += data.uniqueVisitors || 0;

      if (data.speed > 0) {
        speedSum += data.speed;
        validDataCount++;
      }
      if (data.bounceRate > 0) {
        bounceRateSum += data.bounceRate;
      }
      if (data.avgSessionDuration > 0) {
        sessionDurationSum += data.avgSessionDuration;
      }

      // Aggregate country data
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

      // Campaign performance data
      campaignPerformance.push({
        campaignId: data.campaign,
        title: data.campaignInfo.title,
        sparkTrafficProjectId: data.campaignInfo.spark_traffic_project_id,
        hits: data.hits || 0,
        visits: data.visits || 0,
        views: data.views || 0,
        uniqueVisitors: data.uniqueVisitors || 0,
        speed: data.speed || 0,
        bounceRate: data.bounceRate || 0,
        sessionDuration: data.avgSessionDuration || 0,
        lastUpdated: data.timestamp,
        projectStatus: data.projectStatus || "unknown",
      });
    });

    // Calculate averages
    const averageSpeed = validDataCount > 0 ? speedSum / validDataCount : 0;
    const averageBounceRate =
      latestTrafficData.length > 0
        ? bounceRateSum / latestTrafficData.length
        : 0;
    const averageSessionDuration =
      latestTrafficData.length > 0
        ? sessionDurationSum / latestTrafficData.length
        : 0;

    // Convert country map to sorted array
    const topCountries = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        hits: data.hits,
        visits: data.visits,
        views: data.views,
        percentage: totalHits > 0 ? (data.hits / totalHits) * 100 : 0,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    // Get recent activity (last 10 data points across all campaigns)
    const recentActivity = await AlphaTrafficData.find({
      campaign: { $in: campaignIds },
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("campaign", "title")
      .select("campaign timestamp hits visits speed projectStatus");

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
        averageBounceRate: Math.round(averageBounceRate * 100) / 100,
        averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
        topCountries,
        recentActivity,
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

// Get time-based trends for dashboard (last 24 hours, 7 days, 30 days)
router.get("/trends", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const timeRange = req.query.timeRange || "24h"; // 24h, 7d, 30d
    const dataPoints = parseInt(req.query.dataPoints) || 24;

    // Get all Alpha campaigns for the user
    const campaignQuery = {
      spark_traffic_project_id: { $exists: true, $ne: null },
      is_archived: { $ne: true },
      state: { $nin: ["archived", "deleted"] },
    };

    if (!isAdmin) {
      campaignQuery.user = userId;
    }

    const alphaCampaigns = await Campaign.find(campaignQuery).select("_id");
    const campaignIds = alphaCampaigns.map((c) => c._id);

    if (campaignIds.length === 0) {
      return res.json({
        ok: true,
        trends: {
          timeRange,
          dataPoints: [],
          totalDataPoints: 0,
          aggregatedMetrics: {
            totalHits: 0,
            totalVisits: 0,
            peakHits: 0,
            peakVisits: 0,
            averageGrowthRate: 0,
          },
        },
        message: "No Alpha campaigns found",
      });
    }

    // Calculate time window based on range
    let timeWindow;
    let groupBy;
    switch (timeRange) {
      case "24h":
        timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
        groupBy = {
          $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" },
        };
        break;
      case "7d":
        timeWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } };
        break;
      case "30d":
        timeWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } };
        break;
      default:
        timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
        groupBy = {
          $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" },
        };
    }

    // Aggregate traffic data by time periods
    const trendData = await AlphaTrafficData.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          timestamp: { $gte: timeWindow },
        },
      },
      {
        $group: {
          _id: groupBy,
          totalHits: { $sum: "$hits" },
          totalVisits: { $sum: "$visits" },
          totalViews: { $sum: "$views" },
          uniqueVisitors: { $sum: "$uniqueVisitors" },
          averageSpeed: { $avg: "$speed" },
          dataPointsCount: { $sum: 1 },
          campaigns: { $addToSet: "$campaign" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: dataPoints },
    ]);

    // Calculate growth rates
    const dataPoints_array = trendData.map((point, index) => {
      let growthRate = 0;
      if (index > 0) {
        const prevHits = trendData[index - 1].totalHits;
        growthRate =
          prevHits > 0 ? ((point.totalHits - prevHits) / prevHits) * 100 : 0;
      }

      return {
        period: point._id,
        hits: point.totalHits,
        visits: point.totalVisits,
        views: point.totalViews,
        uniqueVisitors: point.uniqueVisitors,
        averageSpeed: Math.round(point.averageSpeed * 100) / 100,
        campaignsActive: point.campaigns.length,
        dataPointsCount: point.dataPointsCount,
        growthRate: Math.round(growthRate * 100) / 100,
      };
    });

    // Calculate aggregated metrics
    const totalHits = dataPoints_array.reduce(
      (sum, point) => sum + point.hits,
      0
    );
    const totalVisits = dataPoints_array.reduce(
      (sum, point) => sum + point.visits,
      0
    );
    const peakHits = Math.max(...dataPoints_array.map((p) => p.hits));
    const peakVisits = Math.max(...dataPoints_array.map((p) => p.visits));
    const averageGrowthRate =
      dataPoints_array.length > 1
        ? dataPoints_array
            .slice(1)
            .reduce((sum, point) => sum + point.growthRate, 0) /
          (dataPoints_array.length - 1)
        : 0;

    res.json({
      ok: true,
      trends: {
        timeRange,
        dataPoints: dataPoints_array,
        totalDataPoints: dataPoints_array.length,
        aggregatedMetrics: {
          totalHits,
          totalVisits,
          peakHits,
          peakVisits,
          averageGrowthRate: Math.round(averageGrowthRate * 100) / 100,
        },
      },
      metadata: {
        campaignsAnalyzed: alphaCampaigns.length,
        timeWindow: timeWindow.toISOString(),
        lastCalculated: new Date(),
      },
    });
  } catch (error) {
    logger.error("Failed to get Alpha dashboard trends", {
      userId: req.user.id,
      timeRange: req.query.timeRange,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get real-time metrics for dashboard (last 15 minutes activity)
router.get("/realtime", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    // Get all Alpha campaigns for the user
    const campaignQuery = {
      spark_traffic_project_id: { $exists: true, $ne: null },
      is_archived: { $ne: true },
      state: { $nin: ["archived", "deleted"] },
    };

    if (!isAdmin) {
      campaignQuery.user = userId;
    }

    const alphaCampaigns = await Campaign.find(campaignQuery).select(
      "_id title"
    );
    const campaignIds = alphaCampaigns.map((c) => c._id);

    if (campaignIds.length === 0) {
      return res.json({
        ok: true,
        realtime: {
          last15Minutes: { hits: 0, visits: 0, campaigns: 0 },
          last1Hour: { hits: 0, visits: 0, campaigns: 0 },
          currentlyActive: 0,
          liveActivity: [],
        },
        message: "No Alpha campaigns found",
      });
    }

    // Time windows
    const now = new Date();
    const last15Min = new Date(now.getTime() - 15 * 60 * 1000);
    const last1Hour = new Date(now.getTime() - 60 * 60 * 1000);

    // Get summaries for different time ranges
    const [last15MinSummary, last1HourSummary, liveActivity] =
      await Promise.all([
        // Last 15 minutes aggregate
        AlphaTrafficSummary.aggregate([
          {
            $match: {
              campaign: { $in: campaignIds },
              timeRange: "15m",
              windowStart: { $gte: last15Min },
            },
          },
          {
            $group: {
              _id: null,
              totalHits: { $max: "$totalHits" }, // Use max since it's cumulative
              totalVisits: { $max: "$totalVisits" },
              activeCampaigns: { $addToSet: "$campaign" },
            },
          },
        ]),

        // Last 1 hour aggregate
        AlphaTrafficSummary.aggregate([
          {
            $match: {
              campaign: { $in: campaignIds },
              timeRange: "1h",
              windowStart: { $gte: last1Hour },
            },
          },
          {
            $group: {
              _id: null,
              totalHits: { $max: "$totalHits" },
              totalVisits: { $max: "$totalVisits" },
              activeCampaigns: { $addToSet: "$campaign" },
            },
          },
        ]),

        // Live activity (last 10 data collections)
        AlphaTrafficData.find({ campaign: { $in: campaignIds } })
          .sort({ timestamp: -1 })
          .limit(10)
          .populate("campaign", "title spark_traffic_project_id")
          .select("campaign timestamp hits visits speed projectStatus"),
      ]);

    // Get currently active campaigns (collected data in last 5 minutes)
    const last5Min = new Date(now.getTime() - 5 * 60 * 1000);
    const currentlyActive = await AlphaTrafficData.distinct("campaign", {
      campaign: { $in: campaignIds },
      timestamp: { $gte: last5Min },
    });

    // Format live activity with incremental changes
    const formattedLiveActivity = liveActivity.map((activity, index) => {
      let incrementalHits = activity.hits;
      let incrementalVisits = activity.visits;

      // Calculate incremental if we have a previous data point
      if (index < liveActivity.length - 1) {
        const prevActivity = liveActivity[index + 1];
        if (
          prevActivity.campaign.toString() === activity.campaign._id.toString()
        ) {
          incrementalHits = Math.max(0, activity.hits - prevActivity.hits);
          incrementalVisits = Math.max(
            0,
            activity.visits - prevActivity.visits
          );
        }
      }

      return {
        campaignId: activity.campaign._id,
        campaignTitle: activity.campaign.title,
        sparkTrafficProjectId: activity.campaign.spark_traffic_project_id,
        timestamp: activity.timestamp,
        totalHits: activity.hits,
        totalVisits: activity.visits,
        incrementalHits,
        incrementalVisits,
        speed: activity.speed,
        status: activity.projectStatus,
      };
    });

    res.json({
      ok: true,
      realtime: {
        last15Minutes: {
          hits: last15MinSummary[0]?.totalHits || 0,
          visits: last15MinSummary[0]?.totalVisits || 0,
          campaigns: last15MinSummary[0]?.activeCampaigns?.length || 0,
        },
        last1Hour: {
          hits: last1HourSummary[0]?.totalHits || 0,
          visits: last1HourSummary[0]?.totalVisits || 0,
          campaigns: last1HourSummary[0]?.activeCampaigns?.length || 0,
        },
        currentlyActive: currentlyActive.length,
        liveActivity: formattedLiveActivity,
      },
      metadata: {
        totalCampaigns: alphaCampaigns.length,
        currentlyActiveCampaigns: currentlyActive.length,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    logger.error("Failed to get Alpha dashboard realtime data", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get geographic distribution for dashboard
router.get("/geography", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    // Get all Alpha campaigns for the user
    const campaignQuery = {
      spark_traffic_project_id: { $exists: true, $ne: null },
      is_archived: { $ne: true },
      state: { $nin: ["archived", "deleted"] },
    };

    if (!isAdmin) {
      campaignQuery.user = userId;
    }

    const alphaCampaigns = await Campaign.find(campaignQuery).select("_id");
    const campaignIds = alphaCampaigns.map((c) => c._id);

    if (campaignIds.length === 0) {
      return res.json({
        ok: true,
        geography: {
          countries: [],
          totalCountries: 0,
          topRegions: [],
        },
        message: "No Alpha campaigns found",
      });
    }

    // Get latest traffic data and aggregate by country
    const geographicData = await AlphaTrafficData.aggregate([
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
        $unwind: {
          path: "$countryBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$countryBreakdown.country",
          totalHits: { $sum: "$countryBreakdown.hits" },
          totalVisits: { $sum: "$countryBreakdown.visits" },
          totalViews: { $sum: "$countryBreakdown.views" },
          campaigns: { $addToSet: "$campaign" },
        },
      },
      { $match: { _id: { $ne: null, $ne: "" } } },
      { $sort: { totalHits: -1 } },
    ]);

    // Calculate totals for percentages
    const totalHits = geographicData.reduce(
      (sum, country) => sum + country.totalHits,
      0
    );
    const totalVisits = geographicData.reduce(
      (sum, country) => sum + country.totalVisits,
      0
    );

    // Format country data
    const countries = geographicData.map((country) => ({
      country: country._id,
      hits: country.totalHits,
      visits: country.totalVisits,
      views: country.totalViews,
      campaigns: country.campaigns.length,
      hitPercentage:
        totalHits > 0
          ? Math.round((country.totalHits / totalHits) * 10000) / 100
          : 0,
      visitPercentage:
        totalVisits > 0
          ? Math.round((country.totalVisits / totalVisits) * 10000) / 100
          : 0,
    }));

    // Define regions (you can expand this mapping)
    const regionMapping = {
      US: "North America",
      CA: "North America",
      MX: "North America",
      GB: "Europe",
      DE: "Europe",
      FR: "Europe",
      IT: "Europe",
      ES: "Europe",
      RU: "Europe",
      PL: "Europe",
      NL: "Europe",
      SE: "Europe",
      NO: "Europe",
      CN: "Asia",
      JP: "Asia",
      IN: "Asia",
      KR: "Asia",
      SG: "Asia",
      TH: "Asia",
      VN: "Asia",
      ID: "Asia",
      MY: "Asia",
      PH: "Asia",
      AU: "Oceania",
      NZ: "Oceania",
      BR: "South America",
      AR: "South America",
      CL: "South America",
      PE: "South America",
      EG: "Africa",
      ZA: "Africa",
      NG: "Africa",
      KE: "Africa",
      AE: "Middle East",
      SA: "Middle East",
      IL: "Middle East",
      TR: "Middle East",
    };

    // Aggregate by regions
    const regionMap = new Map();
    countries.forEach((country) => {
      const region = regionMapping[country.country] || "Other";
      const existing = regionMap.get(region) || {
        hits: 0,
        visits: 0,
        countries: 0,
      };
      existing.hits += country.hits;
      existing.visits += country.visits;
      existing.countries += 1;
      regionMap.set(region, existing);
    });

    const topRegions = Array.from(regionMap.entries())
      .map(([region, data]) => ({
        region,
        hits: data.hits,
        visits: data.visits,
        countries: data.countries,
        percentage:
          totalHits > 0 ? Math.round((data.hits / totalHits) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.hits - a.hits);

    res.json({
      ok: true,
      geography: {
        countries: countries.slice(0, 50), // Top 50 countries
        totalCountries: countries.length,
        topRegions,
        totalHits,
        totalVisits,
      },
      metadata: {
        campaignsAnalyzed: alphaCampaigns.length,
        lastCalculated: new Date(),
      },
    });
  } catch (error) {
    logger.error("Failed to get Alpha dashboard geography data", {
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
