const express = require("express");
const { requireRole } = require("../../middleware/auth");
const Campaign = require("../../models/Campaign");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");

const router = express.Router();

// System Analytics
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      userGrowth,
      campaignGrowth,
      vendorDistribution,
      stateDistribution,
      creditUsage,
    ] = await Promise.all([
      // User registrations over time
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Campaign creation over time
      Campaign.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Vendor distribution
      Campaign.aggregate([
        {
          $group: {
            _id: {
              $cond: {
                if: { $ne: ["$spark_traffic_project_id", null] },
                then: "SparkTraffic",
                else: {
                  $cond: {
                    if: { $ne: ["$nine_hits_campaign_id", null] },
                    then: "9Hits",
                    else: "Unknown",
                  },
                },
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // Campaign state distribution
      Campaign.aggregate([{ $group: { _id: "$state", count: { $sum: 1 } } }]),

      // Subscription usage stats (replaces legacy credit stats)
      Subscription.aggregate([
        {
          $group: {
            _id: null,
            totalVisitsUsed: { $sum: "$visitsUsed" },
            totalVisitsIncluded: { $sum: "$visitsIncluded" },
            avgVisitsUsed: { $avg: "$visitsUsed" },
            avgVisitsIncluded: { $avg: "$visitsIncluded" },
            totalActiveSubscriptions: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["active", "trialing"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      ok: true,
      analytics: {
        period: `${days} days`,
        userGrowth,
        campaignGrowth,
        distributions: {
          vendors: vendorDistribution,
          states: stateDistribution,
        },
        subscriptionUsage: creditUsage[0] || {},
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Users and Campaigns
router.get("/search", requireRole("admin"), async (req, res) => {
  try {
    const { q, type = "all" } = req.query;
    if (!q) return res.status(400).json({ error: "Search query required" });

    const results = {};

    if (type === "all" || type === "users") {
      results.users = await User.find({
        $or: [
          { email: { $regex: q, $options: "i" } },
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
        ],
      })
        .select("-password -credits -availableHits")
        .limit(10);
    }

    if (type === "all" || type === "campaigns") {
      results.campaigns = await Campaign.find({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { urls: { $regex: q, $options: "i" } },
          { spark_traffic_project_id: { $regex: q, $options: "i" } },
        ],
      })
        .populate("user", "email firstName lastName")
        .limit(10);
    }

    res.json({
      ok: true,
      query: q,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive Management - Get archive stats
router.get("/archives/stats", requireRole("admin"), async (req, res) => {
  try {
    const { getArchiveStats } = require("../../utils/archiveCleanup");
    const stats = await getArchiveStats();

    res.json({
      ok: true,
      archiveStats: stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run cleanup job manually
router.post("/archives/cleanup", requireRole("admin"), async (req, res) => {
  try {
    const {
      cleanupArchivedCampaigns,
      permanentDeleteEligibleCampaigns,
    } = require("../../utils/archiveCleanup");

    const cleanupResult = await cleanupArchivedCampaigns();
    const deleteResult = await permanentDeleteEligibleCampaigns();

    res.json({
      ok: true,
      message: "Cleanup completed",
      results: {
        markedForDeletion: cleanupResult?.modifiedCount || 0,
        permanentlyDeleted: deleteResult || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all archived campaigns
router.get("/archives/campaigns", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [archivedCampaigns, totalArchived] = await Promise.all([
      Campaign.find({ is_archived: true })
        .populate("user", "email firstName lastName")
        .sort({ archived_at: -1 })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments({ is_archived: true }),
    ]);

    res.json({
      ok: true,
      campaigns: archivedCampaigns,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalArchived / limit),
        totalCampaigns: totalArchived,
        hasNext: page * limit < totalArchived,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
