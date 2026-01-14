const express = require("express");
const { requireRole } = require("../../middleware/auth");
const Campaign = require("../../models/Campaign");
const User = require("../../models/User");

const router = express.Router();

// Get All Campaigns with Details
router.get("/", requireRole("admin"), async (req, res) => {
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
        .populate("user", "email firstName lastName")
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

// Get all Alpha campaigns for transfer management
router.get("/alpha/transferable", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find all Alpha campaigns
    const [campaigns, totalCampaigns] = await Promise.all([
      Campaign.find({
        spark_traffic_project_id: { $exists: true, $ne: null },
      })
        .populate("user", "email firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments({
        spark_traffic_project_id: { $exists: true, $ne: null },
      }),
    ]);

    // Add transfer count to each campaign
    const campaignsWithTransferInfo = campaigns.map((campaign) => ({
      ...campaign.toObject(),
      transferCount: campaign.transfer_history
        ? campaign.transfer_history.length
        : 0,
      lastTransfer:
        campaign.transfer_history && campaign.transfer_history.length > 0
          ? campaign.transfer_history[campaign.transfer_history.length - 1]
              .transferred_at
          : null,
    }));

    res.json({
      status: "success",
      campaigns: campaignsWithTransferInfo,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCampaigns / limit),
        totalCampaigns,
        hasNext: page * limit < totalCampaigns,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching transferable campaigns:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Get transfer history for a campaign
router.get("/:campaignId/transfer-history", requireRole("admin"), async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId)
      .select("title spark_traffic_project_id transfer_history user")
      .populate("user", "email firstName lastName");

    if (!campaign) {
      return res.status(404).json({
        status: "error",
        message: "Campaign not found",
      });
    }

    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        status: "error",
        message: "Only Alpha campaigns have transfer history",
      });
    }

    // Populate transfer history with user details
    const transferHistory = [];
    if (campaign.transfer_history && campaign.transfer_history.length > 0) {
      for (const transfer of campaign.transfer_history) {
        const [fromUser, toUser, adminUser] = await Promise.all([
          User.findById(transfer.from_user).select("email firstName lastName"),
          User.findById(transfer.to_user).select("email firstName lastName"),
          User.findById(transfer.transferred_by).select("email firstName lastName"),
        ]);

        transferHistory.push({
          from: fromUser
            ? {
                id: fromUser._id,
                email: fromUser.email,
                name: `${fromUser.firstName} ${fromUser.lastName}`.trim(),
              }
            : {
                id: transfer.from_user,
                email: "User not found",
                name: "Unknown",
              },
          to: toUser
            ? {
                id: toUser._id,
                email: toUser.email,
                name: `${toUser.firstName} ${toUser.lastName}`.trim(),
              }
            : {
                id: transfer.to_user,
                email: "User not found",
                name: "Unknown",
              },
          transferredBy: adminUser
            ? {
                id: adminUser._id,
                email: adminUser.email,
                name: `${adminUser.firstName} ${adminUser.lastName}`.trim(),
              }
            : {
                id: transfer.transferred_by,
                email: "Admin not found",
                name: "Unknown",
              },
          transferredAt: transfer.transferred_at,
          reason: transfer.reason || "No reason provided",
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
          name: `${campaign.user.firstName} ${campaign.user.lastName}`.trim(),
        },
      },
      transferHistory: transferHistory,
    });
  } catch (error) {
    console.error("Error fetching transfer history:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Transfer Alpha Campaign from one user to another
router.post("/:campaignId/transfer", requireRole("admin"), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { targetUserId, reason } = req.body;

    // Validate required fields
    if (!targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "Target user ID is required",
      });
    }

    // Find the campaign
    const campaign = await Campaign.findById(campaignId).populate(
      "user",
      "email firstName lastName"
    );
    if (!campaign) {
      return res.status(404).json({
        status: "error",
        message: "Campaign not found",
      });
    }

    // Check if it's an Alpha campaign
    if (!campaign.spark_traffic_project_id) {
      return res.status(400).json({
        status: "error",
        message: "Only Alpha (SparkTraffic) campaigns can be transferred",
      });
    }

    // Find target user
    const targetUser = await User.findById(targetUserId).select(
      "email firstName lastName"
    );
    if (!targetUser) {
      return res.status(404).json({
        status: "error",
        message: "Target user not found",
      });
    }

    // Find source user
    const sourceUser = await User.findById(campaign.user).select(
      "email firstName lastName"
    );

    // Prevent transferring to the same user
    if (campaign.user.toString() === targetUserId) {
      return res.status(400).json({
        status: "error",
        message: "Campaign is already owned by this user",
      });
    }

    // Store original owner info for logging
    const originalOwner = {
      id: campaign.user._id,
      email: sourceUser.email,
      name: `${sourceUser.firstName} ${sourceUser.lastName}`.trim(),
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
      admin_email: req.user.email,
    });

    await campaign.save();

    // Populate the new owner details
    await campaign.populate("user", "email firstName lastName");

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
          name: originalOwner.name,
        },
        to: {
          userId: targetUser._id,
          email: targetUser.email,
          name: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
        },
        transferredBy: {
          adminId: req.user.id,
          adminEmail: req.user.email,
        },
        transferredAt: new Date(),
        reason: reason || "Admin transfer",
      },
      campaign: campaign,
    });
  } catch (error) {
    console.error("Error transferring campaign:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Force Pause/Resume Campaign
router.post("/:campaignId/:action", requireRole("admin"), async (req, res) => {
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
        const nine = require("../../services/nineHits");
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
});

// Delete Campaign (Admin Override)
router.delete("/:campaignId", requireRole("admin"), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.campaignId).populate(
      "user",
      "email firstName lastName"
    );
    if (!campaign)
      return res.status(404).json({ error: "Campaign not found" });

    // Try to delete from vendor
    let vendorResp = null;
    if (campaign.nine_hits_campaign_id) {
      try {
        const nine = require("../../services/nineHits");
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

module.exports = router;
