const express = require("express");
const { requireRole } = require("../../../middleware/auth");
const Campaign = require("../../../models/Campaign");
const logger = require("../../../utils/logger");
const axios = require("axios");

const router = express.Router();

/**
 * Update a 9hits campaign
 * PUT /api/beta/campaigns/:id
 */
router.put("/:id", requireRole(), async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      return res.status(500).json({
        error: "9hits API key not configured",
      });
    }

    const userId = req.user.id;
    const campaignMongoId = req.params.id;
    const updateData = req.body;

    // Find campaign in database
    const campaign = await Campaign.findOne({
      _id: campaignMongoId,
      user: userId,
    });

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
        message: "Campaign not found or you don't have permission to update it",
      });
    }

    if (!campaign.nine_hits_campaign_id) {
      return res.status(400).json({
        error: "Not a 9hits campaign",
        message: "This campaign is not a 9hits (beta) campaign",
      });
    }

    logger.info("Updating 9hits campaign", {
      userId,
      campaignId: campaign._id,
      nineHitsId: campaign.nine_hits_campaign_id,
    });

    // Build comprehensive 9hits API update payload
    const nineHitsUpdateData = {
      id: campaign.nine_hits_campaign_id,
    };

    // Core fields
    if (updateData.title !== undefined) nineHitsUpdateData.title = updateData.title;
    if (updateData.isAdult !== undefined) nineHitsUpdateData.isAdult = updateData.isAdult;
    if (updateData.hasCoinMining !== undefined) nineHitsUpdateData.hasCoinMining = updateData.hasCoinMining;
    if (updateData.urls !== undefined) nineHitsUpdateData.urls = updateData.urls;
    if (updateData.duration !== undefined) nineHitsUpdateData.duration = updateData.duration;
    
    // Platform and connection settings
    if (updateData.platform !== undefined) nineHitsUpdateData.platform = updateData.platform;
    if (updateData.connectionTypes !== undefined) nineHitsUpdateData.connectionTypes = updateData.connectionTypes;
    if (updateData.ipTypes !== undefined) nineHitsUpdateData.ipTypes = updateData.ipTypes;
    if (updateData.connectionSpeed !== undefined) nineHitsUpdateData.connectionSpeed = updateData.connectionSpeed;
    if (updateData.performance !== undefined) nineHitsUpdateData.performance = updateData.performance;
    
    // Geographic and targeting
    if (updateData.geo !== undefined) nineHitsUpdateData.geo = updateData.geo;
    if (updateData.acceptLanguages !== undefined) nineHitsUpdateData.acceptLanguages = updateData.acceptLanguages;
    
    // Advanced features
    if (updateData.referrers !== undefined) nineHitsUpdateData.referrers = updateData.referrers;
    if (updateData.macros !== undefined) nineHitsUpdateData.macros = updateData.macros;
    if (updateData.popupMacros !== undefined) nineHitsUpdateData.popupMacros = updateData.popupMacros;
    if (updateData.capping !== undefined) nineHitsUpdateData.capping = updateData.capping;
    if (updateData.maxHits !== undefined) nineHitsUpdateData.maxHits = updateData.maxHits;
    if (updateData.untilDate !== undefined) nineHitsUpdateData.untilDate = updateData.untilDate;
    if (updateData.maxPopups !== undefined) nineHitsUpdateData.maxPopups = updateData.maxPopups;
    
    // Security and behavior
    if (updateData.fingerprintSpoof !== undefined) nineHitsUpdateData.fingerprintSpoof = updateData.fingerprintSpoof;
    if (updateData.allowProxy !== undefined) nineHitsUpdateData.allowProxy = updateData.allowProxy;
    if (updateData.allowIPv6 !== undefined) nineHitsUpdateData.allowIPv6 = updateData.allowIPv6;
    if (updateData.allowBlockedPopups !== undefined) nineHitsUpdateData.allowBlockedPopups = updateData.allowBlockedPopups;
    if (updateData.ipFilter !== undefined) nineHitsUpdateData.ipFilter = updateData.ipFilter;
    if (updateData.asnFilter !== undefined) nineHitsUpdateData.asnFilter = updateData.asnFilter;
    
    // Performance and limits
    if (updateData.hourlyLimit !== undefined) nineHitsUpdateData.hourlyLimit = updateData.hourlyLimit;
    if (updateData.disJsRate !== undefined) nineHitsUpdateData.disJsRate = updateData.disJsRate;
    if (updateData.disImageRate !== undefined) nineHitsUpdateData.disImageRate = updateData.disImageRate;
    if (updateData.disCookieRate !== undefined) nineHitsUpdateData.disCookieRate = updateData.disCookieRate;
    if (updateData.forceHide !== undefined) nineHitsUpdateData.forceHide = updateData.forceHide;
    
    // Integration features
    if (updateData.adSafe !== undefined) nineHitsUpdateData.adSafe = updateData.adSafe;
    if (updateData.webSecurity !== undefined) nineHitsUpdateData.webSecurity = updateData.webSecurity;
    if (updateData.similarWebEnabled !== undefined) nineHitsUpdateData.similarWebEnabled = updateData.similarWebEnabled;
    if (updateData.bypassCf !== undefined) nineHitsUpdateData.bypassCf = updateData.bypassCf;
    if (updateData.viewerVersion !== undefined) nineHitsUpdateData.viewerVersion = updateData.viewerVersion;
    
    // State
    if (updateData.userState !== undefined) nineHitsUpdateData.userState = updateData.userState;

    // Call 9hits API to update campaign
    const response = await axios.post(
      `https://panel.9hits.com/api/siteUpdate?key=${API_KEY}`,
      nineHitsUpdateData,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data.status !== "ok") {
      logger.error("9hits campaign update failed", {
        userId,
        campaignId: campaign._id,
        nineHitsId: campaign.nine_hits_campaign_id,
        status: response.data.status,
        messages: response.data.messages,
      });

      return res.status(400).json({
        error: "Failed to update campaign",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    const updatedNineHitsCampaign = response.data.data;

    // Update campaign in database
    if (updateData.title) campaign.title = updateData.title;
    if (updateData.urls) campaign.urls = updateData.urls;
    if (updateData.isAdult !== undefined)
      campaign.is_adult = updateData.isAdult;
    if (updateData.hasCoinMining !== undefined)
      campaign.is_coin_mining = updateData.hasCoinMining;
    if (updateData.userState)
      campaign.state = updateData.userState === "paused" ? "paused" : "created";
    if (updateData.macros !== undefined) campaign.macros = updateData.macros;
    if (updateData.popupMacros !== undefined)
      campaign.popup_macros = updateData.popupMacros;
    if (updateData.geo?.codes) campaign.countries = updateData.geo.codes;
    if (updateData.geo?.rule) campaign.rule = updateData.geo.rule;
    if (updateData.maxHits !== undefined)
      campaign.max_hits = updateData.maxHits;
    if (updateData.untilDate)
      campaign.until_date = new Date(updateData.untilDate);
    if (updateData.duration) {
      campaign.duration_min = updateData.duration[0];
      campaign.duration_max = updateData.duration[1];
    }

    // Update nine_hits_data with the latest response
    campaign.nine_hits_data = updatedNineHitsCampaign;

    // Update metadata - store all 9hits specific settings
    if (!campaign.metadata) campaign.metadata = {};
    
    // Store all optional fields in metadata for future reference
    if (updateData.referrers !== undefined) campaign.metadata.referrers = updateData.referrers;
    if (updateData.platform !== undefined) campaign.metadata.platform = updateData.platform;
    if (updateData.geo !== undefined) campaign.metadata.geo = updateData.geo;
    if (updateData.capping !== undefined) campaign.metadata.capping = updateData.capping;
    if (updateData.connectionTypes !== undefined) campaign.metadata.connectionTypes = updateData.connectionTypes;
    if (updateData.ipTypes !== undefined) campaign.metadata.ipTypes = updateData.ipTypes;
    if (updateData.connectionSpeed !== undefined) campaign.metadata.connectionSpeed = updateData.connectionSpeed;
    if (updateData.performance !== undefined) campaign.metadata.performance = updateData.performance;
    if (updateData.acceptLanguages !== undefined) campaign.metadata.acceptLanguages = updateData.acceptLanguages;
    if (updateData.fingerprintSpoof !== undefined) campaign.metadata.fingerprintSpoof = updateData.fingerprintSpoof;
    if (updateData.allowProxy !== undefined) campaign.metadata.allowProxy = updateData.allowProxy;
    if (updateData.allowIPv6 !== undefined) campaign.metadata.allowIPv6 = updateData.allowIPv6;
    if (updateData.allowBlockedPopups !== undefined) campaign.metadata.allowBlockedPopups = updateData.allowBlockedPopups;
    if (updateData.ipFilter !== undefined) campaign.metadata.ipFilter = updateData.ipFilter;
    if (updateData.asnFilter !== undefined) campaign.metadata.asnFilter = updateData.asnFilter;
    if (updateData.hourlyLimit !== undefined) campaign.metadata.hourlyLimit = updateData.hourlyLimit;
    if (updateData.disJsRate !== undefined) campaign.metadata.disJsRate = updateData.disJsRate;
    if (updateData.disImageRate !== undefined) campaign.metadata.disImageRate = updateData.disImageRate;
    if (updateData.disCookieRate !== undefined) campaign.metadata.disCookieRate = updateData.disCookieRate;
    if (updateData.forceHide !== undefined) campaign.metadata.forceHide = updateData.forceHide;
    if (updateData.adSafe !== undefined) campaign.metadata.adSafe = updateData.adSafe;
    if (updateData.webSecurity !== undefined) campaign.metadata.webSecurity = updateData.webSecurity;
    if (updateData.similarWebEnabled !== undefined) campaign.metadata.similarWebEnabled = updateData.similarWebEnabled;
    if (updateData.bypassCf !== undefined) campaign.metadata.bypassCf = updateData.bypassCf;
    if (updateData.viewerVersion !== undefined) campaign.metadata.viewerVersion = updateData.viewerVersion;

    await campaign.save();

    logger.info("9hits campaign updated successfully", {
      userId,
      campaignId: campaign._id,
      nineHitsId: campaign.nine_hits_campaign_id,
      resetHitCounter: updateData.resetHitCounter || false,
    });

    res.json({
      ok: true,
      campaign: {
        id: campaign._id,
        nineHitsId: campaign.nine_hits_campaign_id,
        title: campaign.title,
        urls: campaign.urls,
        state: campaign.state,
        updatedAt: campaign.updatedAt,
      },
      message: "Campaign updated successfully",
    });
  } catch (error) {
    logger.error("Failed to update 9hits campaign", {
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
      error: "Failed to update campaign",
      message: error.message,
    });
  }
});

/**
 * Pause a 9hits campaign
 * POST /api/beta/campaigns/:id/pause
 */
router.post("/:id/pause", requireRole(), async (req, res) => {
  try {
    const userId = req.user.id;
    const campaignMongoId = req.params.id;

    const campaign = await Campaign.findOne({
      _id: campaignMongoId,
      user: userId,
    });

    if (!campaign || !campaign.nine_hits_campaign_id) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    // Update via 9hits API
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();
    const response = await axios.post(
      `https://panel.9hits.com/api/siteUpdate?key=${API_KEY}`,
      {
        id: campaign.nine_hits_campaign_id,
        userState: "paused",
      },
      { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );

    if (response.data.status === "ok") {
      campaign.state = "paused";
      await campaign.save();

      logger.info("Campaign paused", {
        userId,
        campaignId: campaign._id,
        nineHitsId: campaign.nine_hits_campaign_id,
      });

      res.json({ ok: true, message: "Campaign paused successfully" });
    } else {
      res
        .status(400)
        .json({
          error: "Failed to pause campaign",
          message: response.data.messages,
        });
    }
  } catch (error) {
    logger.error("Failed to pause campaign", { error: error.message });
    res
      .status(500)
      .json({ error: "Failed to pause campaign", message: error.message });
  }
});

/**
 * Resume a 9hits campaign
 * POST /api/beta/campaigns/:id/resume
 */
router.post("/:id/resume", requireRole(), async (req, res) => {
  try {
    const userId = req.user.id;
    const campaignMongoId = req.params.id;

    const campaign = await Campaign.findOne({
      _id: campaignMongoId,
      user: userId,
    });

    if (!campaign || !campaign.nine_hits_campaign_id) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    // Update via 9hits API
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();
    const response = await axios.post(
      `https://panel.9hits.com/api/siteUpdate?key=${API_KEY}`,
      {
        id: campaign.nine_hits_campaign_id,
        userState: "running",
      },
      { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );

    if (response.data.status === "ok") {
      campaign.state = "created";
      await campaign.save();

      logger.info("Campaign resumed", {
        userId,
        campaignId: campaign._id,
        nineHitsId: campaign.nine_hits_campaign_id,
      });

      res.json({ ok: true, message: "Campaign resumed successfully" });
    } else {
      res
        .status(400)
        .json({
          error: "Failed to resume campaign",
          message: response.data.messages,
        });
    }
  } catch (error) {
    logger.error("Failed to resume campaign", { error: error.message });
    res
      .status(500)
      .json({ error: "Failed to resume campaign", message: error.message });
  }
});

module.exports = router;
