const express = require("express");
const { requireRole } = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const User = require("../models/User");

const router = express.Router();

// Admin Dashboard - Overview Stats
router.get("/dashboard", requireRole("admin"), async (req, res) => {
  try {
    const [
      totalUsers,
      totalCampaigns,
      activeCampaigns,
      pausedCampaigns,
      sparkTrafficCampaigns,
      nineHitsCampaigns,
      totalCredits,
      totalAvailableHits,
      recentUsers,
      recentCampaigns,
    ] = await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      Campaign.countDocuments({ state: { $in: ["created", "ok", "running"] } }),
      Campaign.countDocuments({ state: "paused" }),
      Campaign.countDocuments({ spark_traffic_project_id: { $ne: null } }),
      Campaign.countDocuments({ nine_hits_campaign_id: { $ne: null } }),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$credits" } } }]),
      User.aggregate([
        { $group: { _id: null, total: { $sum: "$availableHits" } } },
      ]),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select("email firstName lastName createdAt credits availableHits"),
      Campaign.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "email firstName lastName"),
    ]);

    res.json({
      ok: true,
      dashboard: {
        stats: {
          users: {
            total: totalUsers,
            totalCredits: totalCredits[0]?.total || 0,
            totalAvailableHits: totalAvailableHits[0]?.total || 0,
          },
          campaigns: {
            total: totalCampaigns,
            active: activeCampaigns,
            paused: pausedCampaigns,
            sparkTraffic: sparkTrafficCampaigns,
            nineHits: nineHitsCampaigns,
          },
        },
        recent: {
          users: recentUsers,
          campaigns: recentCampaigns,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Users with Details
router.get("/users", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      User.find({})
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(),
    ]);

    // Get campaign counts for each user
    const usersWithCampaigns = await Promise.all(
      users.map(async (user) => {
        const campaignCount = await Campaign.countDocuments({ user: user._id });
        const activeCampaigns = await Campaign.countDocuments({
          user: user._id,
          state: { $in: ["created", "ok", "running"] },
        });
        return {
          ...user.toObject(),
          campaignStats: {
            total: campaignCount,
            active: activeCampaigns,
          },
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

// Get All Campaigns with Details
router.get("/campaigns", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const vendor = req.query.vendor; // Filter by vendor
    const state = req.query.state; // Filter by state

    let filter = {};
    if (vendor === "sparkTraffic")
      filter.spark_traffic_project_id = { $ne: null };
    if (vendor === "nineHits") filter.nine_hits_campaign_id = { $ne: null };
    if (state) filter.state = state;

    const [campaigns, totalCampaigns] = await Promise.all([
      Campaign.find(filter)
        .populate("user", "email firstName lastName credits availableHits")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      ok: true,
      campaigns,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCampaigns / limit),
        totalCampaigns,
        hasNext: page * limit < totalCampaigns,
        hasPrev: page > 1,
      },
      filters: { vendor, state },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Details with All Campaigns
router.get("/users/:userId", requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
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

// Update User Credits/Hits
router.put("/users/:userId/credits", requireRole("admin"), async (req, res) => {
  try {
    const { credits, availableHits, action = "set" } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const oldCredits = user.credits;
    const oldHits = user.availableHits;

    if (action === "add") {
      if (credits) user.credits += credits;
      if (availableHits) user.availableHits += availableHits;
    } else if (action === "subtract") {
      if (credits) user.credits = Math.max(0, user.credits - credits);
      if (availableHits)
        user.availableHits = Math.max(0, user.availableHits - availableHits);
    } else {
      // set
      if (credits !== undefined) user.credits = Math.max(0, credits);
      if (availableHits !== undefined)
        user.availableHits = Math.max(0, availableHits);
    }

    await user.save();

    res.json({
      ok: true,
      message: `User credits/hits updated successfully`,
      changes: {
        credits: {
          old: oldCredits,
          new: user.credits,
          change: user.credits - oldCredits,
        },
        availableHits: {
          old: oldHits,
          new: user.availableHits,
          change: user.availableHits - oldHits,
        },
      },
      user: {
        id: user._id,
        email: user.email,
        credits: user.credits,
        availableHits: user.availableHits,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer Alpha Campaign from one user to another (MUST be before the pause/resume route)
router.post("/campaigns/:campaignId/transfer", requireRole("admin"), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { targetUserId, reason } = req.body;

    // Validate required fields
    if (!targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "Target user ID is required"
      });
    }

    // Find the campaign
    const campaign = await Campaign.findById(campaignId).populate("user", "email firstName lastName");
    if (!campaign) {
      return res.status(404).json({
        status: "error",
        message: "Campaign not found"
      });
    }

    // Check if it's an Alpha campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        status: "error",
        message: "Only Alpha (SparkTraffic) campaigns can be transferred"
      });
    }

    // Find target user
    const targetUser = await User.findById(targetUserId).select("email firstName lastName credits availableHits");
    if (!targetUser) {
      return res.status(404).json({
        status: "error",
        message: "Target user not found"
      });
    }

    // Find source user
    const sourceUser = await User.findById(campaign.user).select("email firstName lastName");

    // Prevent transferring to the same user
    if (campaign.user.toString() === targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "Campaign is already owned by this user"
      });
    }

    // Store original owner info for logging
    const originalOwner = {
      id: campaign.user._id,
      email: sourceUser.email,
      name: `${sourceUser.firstName} ${sourceUser.lastName}`.trim()
    };

    // Transfer the campaign
    const oldUserId = campaign.user._id;
    campaign.user = targetUserId;
    
    // Add transfer metadata
    if (!campaign.transfer_history) {
      campaign.transfer_history = [];
    }
    
    campaign.transfer_history.push({
      from_user: oldUserId,
      to_user: targetUserId,
      transferred_by: req.user.id,
      transferred_at: new Date(),
      reason: reason || "Admin transfer",
      admin_email: req.user.email
    });

    await campaign.save();

    // Populate the new owner details
    await campaign.populate("user", "email firstName lastName credits availableHits");

    res.json({
      status: "success",
      message: "Alpha campaign transferred successfully",
      transfer: {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        sparkTrafficProjectId: campaign.spark_traffic_project_id,
        from: {
          userId: originalOwner.id,
          email: originalOwner.email,
          name: originalOwner.name
        },
        to: {
          userId: targetUser._id,
          email: targetUser.email,
          name: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
          credits: targetUser.credits,
          availableHits: targetUser.availableHits
        },
        transferredBy: {
          adminId: req.user.id,
          adminEmail: req.user.email
        },
        transferredAt: new Date(),
        reason: reason || "Admin transfer"
      },
      campaign: campaign
    });

  } catch (error) {
    console.error("Error transferring campaign:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
});

// Force Pause/Resume Campaign
router.post(
  "/campaigns/:campaignId/:action",
  requireRole("admin"),
  async (req, res) => {
    try {
      const { campaignId, action } = req.params;

      if (!["pause", "resume"].includes(action)) {
        return res
          .status(400)
          .json({ error: "Invalid action. Use 'pause' or 'resume'" });
      }

      const campaign = await Campaign.findById(campaignId).populate(
        "user",
        "email firstName lastName"
      );
      if (!campaign)
        return res.status(404).json({ error: "Campaign not found" });

      let vendorResp = null;

      // Handle SparkTraffic campaigns
      if (campaign.spark_traffic_project_id) {
        try {
          const axios = require("axios");
          const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

          vendorResp = await axios.post(
            "https://v2.sparktraffic.com/edit-website-traffic-project",
            {
              id: campaign.spark_traffic_project_id,
              speed: action === "pause" ? 0 : 200,
              size: "eco",
            },
            {
              headers: {
                "Content-Type": "application/json",
                API_KEY,
              },
            }
          );
        } catch (err) {
          vendorResp = { error: err.message };
        }
      }

      // Handle 9Hits campaigns
      if (campaign.nine_hits_campaign_id) {
        try {
          const nine = require("../services/nineHits");
          if (action === "pause") {
            vendorResp = await nine.sitePause({
              id: campaign.nine_hits_campaign_id,
            });
          } else {
            vendorResp = await nine.siteUpdate({
              id: campaign.nine_hits_campaign_id,
              userState: "running",
            });
          }
        } catch (err) {
          vendorResp = { error: err.message };
        }
      }

      // Update campaign state
      campaign.state = action === "pause" ? "paused" : "ok";
      if (action === "resume") campaign.userState = "running";
      await campaign.save();

      res.json({
        ok: true,
        message: `Campaign ${action}d successfully by admin`,
        campaign,
        vendorResp:
          vendorResp && vendorResp.data ? vendorResp.data : vendorResp,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete Campaign (Admin Override)
router.delete("/campaigns/:campaignId", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.campaignId).populate(
      "user",
      "email firstName lastName"
    );
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Try to delete from vendor
    let vendorResp = null;
    if (campaign.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteDelete({
          id: campaign.nine_hits_campaign_id,
        });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }

    await campaign.deleteOne();

    res.json({
      ok: true,
      message: "Campaign deleted successfully by admin",
      deletedCampaign: campaign,
      vendorResp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System Analytics
router.get("/analytics", requireRole("admin"), async (req, res) => {
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

      // Credit usage stats
      User.aggregate([
        {
          $group: {
            _id: null,
            totalCredits: { $sum: "$credits" },
            totalHits: { $sum: "$availableHits" },
            avgCredits: { $avg: "$credits" },
            avgHits: { $avg: "$availableHits" },
            minCredits: { $min: "$credits" },
            maxCredits: { $max: "$credits" },
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
        creditUsage: creditUsage[0] || {},
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
        .select("-password")
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

// Archive Management
router.get("/archives/stats", requireRole("admin"), async (req, res) => {
  try {
    const { getArchiveStats } = require("../utils/archiveCleanup");
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
    } = require("../utils/archiveCleanup");

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

// Fix all users' availableHits calculation
router.post("/fix-user-hits", requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find({});
    let fixedCount = 0;

    for (const user of users) {
      const correctHits = Math.floor(user.credits / 3);
      if (user.availableHits !== correctHits) {
        await User.findByIdAndUpdate(user._id, {
          availableHits: correctHits,
        });
        fixedCount++;
      }
    }

    res.json({
      status: "success",
      message: `Fixed availableHits for ${fixedCount} users`,
      totalUsers: users.length,
      fixedUsers: fixedCount,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Get transfer history for a campaign
router.get("/campaigns/:campaignId/transfer-history", requireRole("admin"), async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId)
      .select("title spark_traffic_project_id transfer_history user")
      .populate("user", "email firstName lastName");

    if (!campaign) {
      return res.status(404).json({
        status: "error",
        message: "Campaign not found"
      });
    }

    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        status: "error",
        message: "Only Alpha campaigns have transfer history"
      });
    }

    // Populate transfer history with user details
    const transferHistory = [];
    if (campaign.transfer_history && campaign.transfer_history.length > 0) {
      for (const transfer of campaign.transfer_history) {
        const [fromUser, toUser, adminUser] = await Promise.all([
          User.findById(transfer.from_user).select("email firstName lastName"),
          User.findById(transfer.to_user).select("email firstName lastName"),
          User.findById(transfer.transferred_by).select("email firstName lastName")
        ]);

        transferHistory.push({
          from: fromUser ? {
            id: fromUser._id,
            email: fromUser.email,
            name: `${fromUser.firstName} ${fromUser.lastName}`.trim()
          } : { id: transfer.from_user, email: "User not found", name: "Unknown" },
          to: toUser ? {
            id: toUser._id,
            email: toUser.email,
            name: `${toUser.firstName} ${toUser.lastName}`.trim()
          } : { id: transfer.to_user, email: "User not found", name: "Unknown" },
          transferredBy: adminUser ? {
            id: adminUser._id,
            email: adminUser.email,
            name: `${adminUser.firstName} ${adminUser.lastName}`.trim()
          } : { id: transfer.transferred_by, email: "Admin not found", name: "Unknown" },
          transferredAt: transfer.transferred_at,
          reason: transfer.reason || "No reason provided"
        });
      }
    }

    res.json({
      status: "success",
      campaign: {
        id: campaign._id,
        title: campaign.title,
        sparkTrafficProjectId: campaign.spark_traffic_project_id,
        currentOwner: {
          id: campaign.user._id,
          email: campaign.user.email,
          name: `${campaign.user.firstName} ${campaign.user.lastName}`.trim()
        }
      },
      transferHistory: transferHistory
    });

  } catch (error) {
    console.error("Error fetching transfer history:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get all Alpha campaigns for transfer management
router.get("/campaigns/alpha/transferable", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find all Alpha campaigns
    const [campaigns, totalCampaigns] = await Promise.all([
      Campaign.find({ spark_traffic_project_id: { $exists: true, $ne: null } })
        .populate("user", "email firstName lastName credits availableHits")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments({ spark_traffic_project_id: { $exists: true, $ne: null } })
    ]);

    // Add transfer count to each campaign
    const campaignsWithTransferInfo = campaigns.map(campaign => ({
      ...campaign.toObject(),
      transferCount: campaign.transfer_history ? campaign.transfer_history.length : 0,
      lastTransfer: campaign.transfer_history && campaign.transfer_history.length > 0 
        ? campaign.transfer_history[campaign.transfer_history.length - 1].transferred_at
        : null
    }));

    res.json({
      status: "success",
      campaigns: campaignsWithTransferInfo,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCampaigns / limit),
        totalCampaigns,
        hasNext: page * limit < totalCampaigns,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching transferable campaigns:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;
