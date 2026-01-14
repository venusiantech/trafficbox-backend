const express = require("express");
const { requireRole } = require("../../middleware/auth");
const Campaign = require("../../models/Campaign");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");

const router = express.Router();

// Admin Dashboard - Overview Stats
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const [
      totalUsers,
      totalCampaigns,
      activeCampaigns,
      pausedCampaigns,
      sparkTrafficCampaigns,
      nineHitsCampaigns,
      totalSubscriptions,
      paidSubscriptions,
      freeSubscriptions,
      activePaidSubscriptions,
      subscriptionStats,
      paidSubscriptionStats,
      recentUsers,
      recentCampaigns,
    ] = await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      Campaign.countDocuments({ state: { $in: ["created", "ok", "running"] } }),
      Campaign.countDocuments({ state: "paused" }),
      Campaign.countDocuments({ spark_traffic_project_id: { $ne: null } }),
      Campaign.countDocuments({ nine_hits_campaign_id: { $ne: null } }),
      Subscription.countDocuments(),
      Subscription.countDocuments({ planName: { $nin: ["free"] } }),
      Subscription.countDocuments({ planName: "free" }),
      Subscription.countDocuments({ 
        planName: { $nin: ["free"] }, 
        status: { $in: ["active", "trialing"] } 
      }),
      // All subscriptions stats
      Subscription.aggregate([
        {
          $group: {
            _id: null,
            totalVisitsUsed: { $sum: "$visitsUsed" },
            totalVisitsIncluded: { $sum: "$visitsIncluded" },
            avgVisitsUsed: { $avg: "$visitsUsed" },
          },
        },
      ]),
      // Paid subscriptions stats only
      Subscription.aggregate([
        {
          $match: { planName: { $nin: ["free"] } }
        },
        {
          $group: {
            _id: null,
            totalVisitsUsed: { $sum: "$visitsUsed" },
            totalVisitsIncluded: { $sum: "$visitsIncluded" },
            avgVisitsUsed: { $avg: "$visitsUsed" },
          },
        },
      ]),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select("email firstName lastName createdAt role"),
      Campaign.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "email firstName lastName"),
    ]);

    // Get subscription info for recent users
    const recentUsersWithSubscriptions = await Promise.all(
      recentUsers.map(async (user) => {
        const subscription = await Subscription.findOne({ user: user._id }).select(
          "planName status"
        );
        return {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          subscriptionPlan: subscription ? subscription.planName : "NONE",
          subscriptionStatus: subscription ? subscription.status : null,
        };
      })
    );

    res.json({
      ok: true,
      dashboard: {
        stats: {
          users: {
            total: totalUsers,
            withPaidSubscription: paidSubscriptions,
            withFreeSubscription: freeSubscriptions,
            withoutSubscription: totalUsers - totalSubscriptions,
          },
          campaigns: {
            total: totalCampaigns,
            active: activeCampaigns,
            paused: pausedCampaigns,
            sparkTraffic: sparkTrafficCampaigns,
            nineHits: nineHitsCampaigns,
          },
          subscriptions: {
            paid: {
              total: paidSubscriptions,
              active: activePaidSubscriptions,
              totalVisitsUsed: paidSubscriptionStats[0]?.totalVisitsUsed || 0,
              totalVisitsIncluded: paidSubscriptionStats[0]?.totalVisitsIncluded || 0,
              avgVisitsUsed: Math.round(paidSubscriptionStats[0]?.avgVisitsUsed || 0),
              utilizationRate: paidSubscriptionStats[0]?.totalVisitsIncluded
                ? Math.round(
                    (paidSubscriptionStats[0].totalVisitsUsed /
                      paidSubscriptionStats[0].totalVisitsIncluded) *
                      100
                  )
                : 0,
            },
            free: {
              total: freeSubscriptions,
            },
            overall: {
              total: totalSubscriptions,
              totalVisitsUsed: subscriptionStats[0]?.totalVisitsUsed || 0,
              totalVisitsIncluded: subscriptionStats[0]?.totalVisitsIncluded || 0,
              avgVisitsUsed: Math.round(subscriptionStats[0]?.avgVisitsUsed || 0),
              utilizationRate: subscriptionStats[0]?.totalVisitsIncluded
                ? Math.round(
                    (subscriptionStats[0].totalVisitsUsed /
                      subscriptionStats[0].totalVisitsIncluded) *
                      100
                  )
                : 0,
            },
          },
        },
        recent: {
          users: recentUsersWithSubscriptions,
          campaigns: recentCampaigns,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
