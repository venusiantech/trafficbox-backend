const express = require("express");
const { requireRole } = require("../../../middleware/auth");
const Campaign = require("../../../models/Campaign");
const Subscription = require("../../../models/Subscription");
const logger = require("../../../utils/logger");
const axios = require("axios");

const router = express.Router();

/**
 * Delete 9hits campaigns
 * DELETE /api/beta/campaigns
 * Body: Array of campaign IDs (MongoDB IDs or 9hits IDs)
 *
 * Example: ["mongoId1", "mongoId2"] or just delete by query params
 */
router.delete("/", requireRole(), async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      return res.status(500).json({
        error: "9hits API key not configured",
      });
    }

    const userId = req.user.id;
    let campaignIds = req.body;

    // Accept both array in body or single id in body
    if (!Array.isArray(campaignIds)) {
      campaignIds = [campaignIds];
    }

    if (!campaignIds || campaignIds.length === 0) {
      return res.status(400).json({
        error: "Campaign IDs are required",
        message: "Provide an array of campaign IDs to delete",
      });
    }

    logger.info("Deleting 9hits campaigns", {
      userId,
      campaignIds,
      count: campaignIds.length,
    });

    // Find campaigns in database
    const campaigns = await Campaign.find({
      _id: { $in: campaignIds },
      user: userId,
      nine_hits_campaign_id: { $exists: true, $ne: null },
    });

    if (campaigns.length === 0) {
      return res.status(404).json({
        error: "No campaigns found",
        message: "No valid 9hits campaigns found for deletion",
      });
    }

    // Extract 9hits campaign IDs
    const nineHitsIds = campaigns.map((c) => c.nine_hits_campaign_id);

    logger.info("Calling 9hits API to delete campaigns", {
      userId,
      nineHitsIds,
    });

    // Call 9hits API to delete campaigns
    const response = await axios.post(
      `https://panel.9hits.com/api/siteDel?key=${API_KEY}`,
      nineHitsIds,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data.status !== "ok") {
      logger.error("9hits campaign deletion failed", {
        userId,
        nineHitsIds,
        status: response.data.status,
        messages: response.data.messages,
      });

      return res.status(400).json({
        error: "Failed to delete campaigns",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    // Soft delete campaigns in database (mark as archived)
    const deleteResult = await Campaign.updateMany(
      {
        _id: { $in: campaignIds },
        user: userId,
      },
      {
        $set: {
          is_archived: true,
          archived_at: new Date(),
          state: "archived",
        },
      }
    );

    // Update subscription campaign count
    const subscription = await Subscription.findOne({ user: userId });
    if (subscription) {
      const activeCampaignCount = await Campaign.countDocuments({
        user: userId,
        $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
      });
      subscription.currentCampaignCount = activeCampaignCount;
      await subscription.save();
    }

    logger.info("9hits campaigns deleted successfully", {
      userId,
      deletedCount: deleteResult.modifiedCount,
      nineHitsIds,
    });

    res.json({
      ok: true,
      deletedCount: deleteResult.modifiedCount,
      message: `Successfully deleted ${deleteResult.modifiedCount} campaign(s)`,
    });
  } catch (error) {
    logger.error("Failed to delete 9hits campaigns", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });

    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: "9hits API request failed",
        message: error.response.data?.messages || error.message,
      });
    }

    res.status(500).json({
      error: "Failed to delete campaigns",
      message: error.message,
    });
  }
});

/**
 * Delete single campaign by ID
 * DELETE /api/beta/campaigns/:id
 */
router.delete("/:id", requireRole(), async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      return res.status(500).json({
        error: "9hits API key not configured",
      });
    }

    const userId = req.user.id;
    const campaignMongoId = req.params.id;

    // Find campaign in database
    const campaign = await Campaign.findOne({
      _id: campaignMongoId,
      user: userId,
    });

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
        message: "Campaign not found or you don't have permission to delete it",
      });
    }

    if (!campaign.nine_hits_campaign_id) {
      return res.status(400).json({
        error: "Not a 9hits campaign",
        message: "This campaign is not a 9hits (beta) campaign",
      });
    }

    logger.info("Deleting single 9hits campaign", {
      userId,
      campaignId: campaign._id,
      nineHitsId: campaign.nine_hits_campaign_id,
    });

    // Call 9hits API to delete campaign
    const response = await axios.post(
      `https://panel.9hits.com/api/siteDel?key=${API_KEY}`,
      [campaign.nine_hits_campaign_id],
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data.status !== "ok") {
      logger.error("9hits campaign deletion failed", {
        userId,
        campaignId: campaign._id,
        nineHitsId: campaign.nine_hits_campaign_id,
        status: response.data.status,
        messages: response.data.messages,
      });

      return res.status(400).json({
        error: "Failed to delete campaign",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    // Soft delete campaign in database
    campaign.is_archived = true;
    campaign.archived_at = new Date();
    campaign.state = "archived";
    await campaign.save();

    // Update subscription campaign count
    const subscription = await Subscription.findOne({ user: userId });
    if (subscription) {
      const activeCampaignCount = await Campaign.countDocuments({
        user: userId,
        $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
      });
      subscription.currentCampaignCount = activeCampaignCount;
      await subscription.save();
    }

    logger.info("9hits campaign deleted successfully", {
      userId,
      campaignId: campaign._id,
      nineHitsId: campaign.nine_hits_campaign_id,
    });

    res.json({
      ok: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete 9hits campaign", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: error.message,
      stack: error.stack,
    });

    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: "9hits API request failed",
        message: error.response.data?.messages || error.message,
      });
    }

    res.status(500).json({
      error: "Failed to delete campaign",
      message: error.message,
    });
  }
});

module.exports = router;
