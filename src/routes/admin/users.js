const express = require("express");
const { requireRole } = require("../../middleware/auth");
const Campaign = require("../../models/Campaign");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");

const router = express.Router();

// Get All Users with Details
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      User.find({})
        .select("-password -credits -availableHits")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(),
    ]);

    // Get campaign counts and subscription info for each user
    const usersWithCampaigns = await Promise.all(
      users.map(async (user) => {
        const campaignCount = await Campaign.countDocuments({ user: user._id });
        const activeCampaigns = await Campaign.countDocuments({
          user: user._id,
          state: { $in: ["created", "ok", "running"] },
        });
        const subscription = await Subscription.findOne({ user: user._id }).select(
          "planName status visitsUsed visitsIncluded"
        );
        return {
          ...user.toObject(),
          campaignStats: {
            total: campaignCount,
            active: activeCampaigns,
          },
          subscription: subscription
            ? {
                planName: subscription.planName,
                status: subscription.status,
                visitsUsed: subscription.visitsUsed,
                visitsIncluded: subscription.visitsIncluded,
                availableVisits: subscription.visitsIncluded - subscription.visitsUsed,
              }
            : null,
        };
      })
    );

    res.json({
      ok: true,
      users: usersWithCampaigns,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page * limit < totalUsers,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Details with All Campaigns
router.get("/:userId", requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password -credits -availableHits");
    if (!user) return res.status(404).json({ error: "User not found" });

    const campaigns = await Campaign.find({ user: req.params.userId }).sort({
      createdAt: -1,
    });

    const campaignStats = {
      total: campaigns.length,
      active: campaigns.filter((c) =>
        ["created", "ok", "running"].includes(c.state)
      ).length,
      paused: campaigns.filter((c) => c.state === "paused").length,
      sparkTraffic: campaigns.filter((c) => c.spark_traffic_project_id).length,
      nineHits: campaigns.filter((c) => c.nine_hits_campaign_id).length,
    };

    res.json({
      ok: true,
      user: user.toObject(),
      campaigns,
      campaignStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
