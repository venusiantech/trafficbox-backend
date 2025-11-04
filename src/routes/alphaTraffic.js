const express = require("express");
const auth = require("../middleware/auth");
const alphaTrafficTrackingService = require("../services/alphaTrafficTrackingService");
const alphaTrafficDataCollector = require("../services/alphaTrafficDataCollector");
const Campaign = require("../models/Campaign");
const AlphaTrafficData = require("../models/AlphaTrafficData");
const AlphaTrafficSummary = require("../models/AlphaTrafficSummary");
const logger = require("../utils/logger");

const router = express.Router();

// Get current Alpha traffic metrics for a campaign
router.get("/campaigns/:id/alpha-traffic/current", auth(), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if user owns the campaign or is admin
    if (campaign.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Verify it's an Alpha (SparkTraffic) campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        error: "This is not an Alpha campaign (SparkTraffic required)",
      });
    }

    const metrics =
      await alphaTrafficTrackingService.getCurrentAlphaTrafficMetrics(
        req.params.id
      );

    // Optional compact mode to reduce payload size
    const compact = req.query.compact === "true";
    const payloadMetrics = compact
      ? Object.fromEntries(
          Object.entries(metrics).map(([k, v]) => [
            k,
            {
              label: v.label,
              totalHits: v.totalHits,
              totalVisits: v.totalVisits,
              avgSpeed: v.avgSpeed,
              maxSpeed: v.maxSpeed,
              lastUpdated: v.lastUpdated,
              dataPointsCount: v.dataPointsCount,
              completionPercentage: v.completionPercentage,
              dataQuality: v.dataQuality,
            },
          ])
        )
      : metrics;

    // Short-lived caching for dashboards
    res.setHeader("Cache-Control", "public, max-age=15");

    res.json({
      ok: true,
      campaignId: req.params.id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      currentMetrics: payloadMetrics,
      availableTimeRanges: AlphaTrafficSummary.getTimeRanges(),
    });
  } catch (error) {
    logger.error("Failed to get current Alpha traffic metrics", {
      campaignId: req.params.id,
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get Alpha traffic summary for a specific time range
router.get("/campaigns/:id/alpha-traffic/summary", auth(), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if user owns the campaign or is admin
    if (campaign.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Verify it's an Alpha campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        error: "This is not an Alpha campaign (SparkTraffic required)",
      });
    }

    const timeRange = req.query.timeRange || "1h";
    const limit = parseInt(req.query.limit) || 24;

    // Validate time range
    const availableRanges = Object.keys(AlphaTrafficSummary.getTimeRanges());
    if (!availableRanges.includes(timeRange)) {
      return res.status(400).json({
        error: "Invalid time range",
        availableRanges,
      });
    }

    const summary = await alphaTrafficTrackingService.getAlphaTrafficSummary(
      req.params.id,
      timeRange,
      limit
    );

    res.json({
      ok: true,
      campaignId: req.params.id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      timeRange,
      limit,
      summary,
      totalWindows: summary.length,
    });
  } catch (error) {
    logger.error("Failed to get Alpha traffic summary", {
      campaignId: req.params.id,
      userId: req.user.id,
      timeRange: req.query.timeRange,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get Alpha traffic trends analysis
router.get("/campaigns/:id/alpha-traffic/trends", auth(), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if user owns the campaign or is admin
    if (campaign.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Verify it's an Alpha campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        error: "This is not an Alpha campaign (SparkTraffic required)",
      });
    }

    const timeRange = req.query.timeRange || "1h";
    const periods = parseInt(req.query.periods) || 24;

    // Validate time range
    const availableRanges = Object.keys(AlphaTrafficSummary.getTimeRanges());
    if (!availableRanges.includes(timeRange)) {
      return res.status(400).json({
        error: "Invalid time range",
        availableRanges,
      });
    }

    const trends = await alphaTrafficTrackingService.getAlphaTrafficTrends(
      req.params.id,
      timeRange,
      periods
    );

    res.json({
      ok: true,
      campaignId: req.params.id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      timeRange,
      periods,
      trends,
    });
  } catch (error) {
    logger.error("Failed to get Alpha traffic trends", {
      campaignId: req.params.id,
      userId: req.user.id,
      timeRange: req.query.timeRange,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get raw Alpha traffic data for a campaign
router.get("/campaigns/:id/alpha-traffic/raw", auth(), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if user owns the campaign or is admin
    if (campaign.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Verify it's an Alpha campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        error: "This is not an Alpha campaign (SparkTraffic required)",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    // Date filters
    const filters = { campaign: req.params.id };
    if (req.query.from) {
      filters.timestamp = {
        ...filters.timestamp,
        $gte: new Date(req.query.from),
      };
    }
    if (req.query.to) {
      filters.timestamp = {
        ...filters.timestamp,
        $lte: new Date(req.query.to),
      };
    }
    if (req.query.projectStatus) {
      filters.projectStatus = req.query.projectStatus;
    }
    if (req.query.dataQuality) {
      filters.dataQuality = req.query.dataQuality;
    }

    const [trafficData, totalRecords] = await Promise.all([
      AlphaTrafficData.find(filters)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select("-rawSparkTrafficData") // Exclude raw data for performance
        .lean(),
      AlphaTrafficData.countDocuments(filters),
    ]);

    res.json({
      ok: true,
      campaignId: req.params.id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      data: trafficData,
      pagination: {
        page,
        limit,
        total: totalRecords,
        pages: Math.ceil(totalRecords / limit),
        hasNext: page * limit < totalRecords,
        hasPrev: page > 1,
      },
      filters: {
        from: req.query.from,
        to: req.query.to,
        projectStatus: req.query.projectStatus,
        dataQuality: req.query.dataQuality,
      },
    });
  } catch (error) {
    logger.error("Failed to get raw Alpha traffic data", {
      campaignId: req.params.id,
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger Alpha traffic data collection for a campaign
router.post(
  "/campaigns/:id/alpha-traffic/collect",
  auth(),
  async (req, res) => {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Check if user owns the campaign or is admin
      if (
        campaign.user.toString() !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify it's an Alpha campaign
      if (!campaign.spark_traffic_project_id) {
        return res.status(400).json({
          error: "This is not an Alpha campaign (SparkTraffic required)",
        });
      }

      const result =
        await alphaTrafficDataCollector.collectAlphaCampaignDataManually(
          req.params.id
        );

      res.json({
        ok: true,
        campaignId: req.params.id,
        sparkTrafficProjectId: campaign.spark_traffic_project_id,
        message: "Alpha traffic data collection triggered",
        result,
      });
    } catch (error) {
      logger.error("Failed to trigger Alpha traffic data collection", {
        campaignId: req.params.id,
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Initialize Alpha traffic tracking for a campaign
router.post(
  "/campaigns/:id/alpha-traffic/initialize",
  auth(),
  async (req, res) => {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Check if user owns the campaign or is admin
      if (
        campaign.user.toString() !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify it's an Alpha campaign
      if (!campaign.spark_traffic_project_id) {
        return res.status(400).json({
          error: "This is not an Alpha campaign (SparkTraffic required)",
        });
      }

      await alphaTrafficTrackingService.initializeAlphaTrafficTracking(
        req.params.id,
        campaign.spark_traffic_project_id
      );

      res.json({
        ok: true,
        campaignId: req.params.id,
        sparkTrafficProjectId: campaign.spark_traffic_project_id,
        message: "Alpha traffic tracking initialized successfully",
      });
    } catch (error) {
      logger.error("Failed to initialize Alpha traffic tracking", {
        campaignId: req.params.id,
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Get Alpha traffic data collector status (admin only)
router.get(
  "/admin/alpha-traffic/collector/status",
  auth("admin"),
  async (req, res) => {
    try {
      const status = alphaTrafficDataCollector.getStatus();
      res.json({
        ok: true,
        collectorStatus: status,
      });
    } catch (error) {
      logger.error("Failed to get Alpha traffic collector status", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Start Alpha traffic data collector (admin only)
router.post(
  "/admin/alpha-traffic/collector/start",
  auth("admin"),
  async (req, res) => {
    try {
      const intervalMs = parseInt(req.body.intervalMs) || 60000; // Default 1 minute
      await alphaTrafficDataCollector.start(intervalMs);

      res.json({
        ok: true,
        message: "Alpha traffic data collector started",
        status: alphaTrafficDataCollector.getStatus(),
      });
    } catch (error) {
      logger.error("Failed to start Alpha traffic collector", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Stop Alpha traffic data collector (admin only)
router.post(
  "/admin/alpha-traffic/collector/stop",
  auth("admin"),
  async (req, res) => {
    try {
      alphaTrafficDataCollector.stop();

      res.json({
        ok: true,
        message: "Alpha traffic data collector stopped",
        status: alphaTrafficDataCollector.getStatus(),
      });
    } catch (error) {
      logger.error("Failed to stop Alpha traffic collector", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Update Alpha traffic data collector interval (admin only)
router.put(
  "/admin/alpha-traffic/collector/interval",
  auth("admin"),
  async (req, res) => {
    try {
      const intervalMs = parseInt(req.body.intervalMs);
      if (!intervalMs || intervalMs < 10000) {
        // Minimum 10 seconds
        return res.status(400).json({
          error: "Invalid interval. Minimum 10 seconds (10000ms)",
        });
      }

      alphaTrafficDataCollector.updateInterval(intervalMs);

      res.json({
        ok: true,
        message: "Alpha traffic data collector interval updated",
        status: alphaTrafficDataCollector.getStatus(),
      });
    } catch (error) {
      logger.error("Failed to update Alpha traffic collector interval", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Update Alpha traffic data collector configuration (admin only)
router.put(
  "/admin/alpha-traffic/collector/config",
  auth("admin"),
  async (req, res) => {
    try {
      const config = {
        maxConcurrentRequests: req.body.maxConcurrentRequests,
        retryAttempts: req.body.retryAttempts,
        retryDelayMs: req.body.retryDelayMs,
      };

      alphaTrafficDataCollector.updateConfiguration(config);

      res.json({
        ok: true,
        message: "Alpha traffic data collector configuration updated",
        status: alphaTrafficDataCollector.getStatus(),
      });
    } catch (error) {
      logger.error("Failed to update Alpha traffic collector configuration", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Trigger collection for all Alpha campaigns (admin only)
router.post(
  "/admin/alpha-traffic/collect-all",
  auth("admin"),
  async (req, res) => {
    try {
      const result =
        await alphaTrafficDataCollector.collectAllAlphaCampaignData();

      res.json({
        ok: true,
        message: "Alpha traffic data collection triggered for all campaigns",
        result,
      });
    } catch (error) {
      logger.error("Failed to trigger collection for all Alpha campaigns", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Cleanup old Alpha traffic data (admin only)
router.post("/admin/alpha-traffic/cleanup", auth("admin"), async (req, res) => {
  try {
    const retentionDays = parseInt(req.body.retentionDays) || 90;

    if (retentionDays < 1) {
      return res
        .status(400)
        .json({ error: "Retention days must be at least 1" });
    }

    const result = await alphaTrafficTrackingService.cleanupOldAlphaTrafficData(
      retentionDays
    );

    res.json({
      ok: true,
      message: "Alpha traffic data cleanup completed",
      result,
      retentionDays,
    });
  } catch (error) {
    logger.error("Failed to cleanup Alpha traffic data", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get system-wide Alpha traffic statistics (admin only)
router.get(
  "/admin/alpha-traffic/statistics",
  auth("admin"),
  async (req, res) => {
    try {
      const [
        totalAlphaTrafficRecords,
        totalAlphaSummaries,
        activeAlphaCampaigns,
        recentActivity,
        topPerformingCampaigns,
      ] = await Promise.all([
        AlphaTrafficData.countDocuments(),
        AlphaTrafficSummary.countDocuments(),
        Campaign.countDocuments({
          is_archived: { $ne: true },
          state: { $nin: ["archived", "deleted"] },
          spark_traffic_project_id: { $exists: true, $ne: null },
        }),
        AlphaTrafficData.find()
          .sort({ timestamp: -1 })
          .limit(10)
          .populate("campaign", "title")
          .select("campaign timestamp hits visits speed projectStatus"),
        AlphaTrafficSummary.aggregate([
          { $match: { timeRange: "1h", isComplete: false } },
          {
            $group: {
              _id: "$campaign",
              totalHits: { $sum: "$totalHits" },
              totalVisits: { $sum: "$totalVisits" },
              avgSpeed: { $avg: "$avgSpeed" },
            },
          },
          { $sort: { totalHits: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: "campaigns",
              localField: "_id",
              foreignField: "_id",
              as: "campaign",
            },
          },
          { $unwind: "$campaign" },
        ]),
      ]);

      // Get storage usage estimate
      const avgRecordSize = 2048; // Estimated bytes per Alpha traffic record
      const storageUsageMB = Math.round(
        (totalAlphaTrafficRecords * avgRecordSize) / (1024 * 1024)
      );

      res.json({
        ok: true,
        statistics: {
          totalAlphaTrafficRecords,
          totalAlphaSummaries,
          activeAlphaCampaigns,
          storageUsageMB,
          recentActivity,
          topPerformingCampaigns,
          collectorStatus: alphaTrafficDataCollector.getStatus(),
        },
      });
    } catch (error) {
      logger.error("Failed to get Alpha traffic statistics", {
        userId: req.user.id,
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

// Get available Alpha time ranges
router.get("/alpha-traffic/time-ranges", auth(), async (req, res) => {
  try {
    const timeRanges = AlphaTrafficSummary.getTimeRanges();
    res.json({
      ok: true,
      timeRanges,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
