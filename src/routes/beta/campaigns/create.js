const express = require("express");
const { requireRole } = require("../../../middleware/auth");
const { checkSubscriptionAccess } = require("../../../middleware/subscription");
const Campaign = require("../../../models/Campaign");
const User = require("../../../models/User");
const Subscription = require("../../../models/Subscription");
const logger = require("../../../utils/logger");
const axios = require("axios");

const router = express.Router();

/**
 * Create a new 9hits campaign
 * POST /api/beta/campaigns
 */
router.post("/", requireRole(), checkSubscriptionAccess, async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      logger.error("9hits API key not configured");
      return res.status(500).json({
        error: "9hits API key not configured",
        message: "Please configure NINE_HITS_API_KEY in environment variables",
      });
    }

    const userId = req.user.id;
    const campaignData = req.body;

    // Basic validation
    if (!campaignData.title || !campaignData.title.trim()) {
      return res.status(400).json({
        error: "Campaign title is required",
      });
    }

    if (
      !campaignData.urls ||
      !Array.isArray(campaignData.urls) ||
      campaignData.urls.length === 0
    ) {
      return res.status(400).json({
        error: "At least one URL is required",
      });
    }

    logger.info("Creating 9hits campaign", {
      userId,
      title: campaignData.title,
      urlCount: campaignData.urls.length,
    });

    // Build comprehensive 9hits API payload with all supported features
    const campaignPayload = {
      // Required fields
      title: campaignData.title,
      isAdult: campaignData.isAdult || false,
      hasCoinMining: campaignData.hasCoinMining || false,
      urls: campaignData.urls,
      
      // Duration (time to view website, up to 600 seconds)
      duration: campaignData.duration || [30, 60],
      
      // Platform settings (OS, Browser, User-Agent)
      platform: campaignData.platform || {
        usage: { system: 100, fixed: 0, custom: 0 },
      },
      
      // Connection settings
      connectionTypes: campaignData.connectionTypes || ["system"],
      ipTypes: campaignData.ipTypes || ["R", "B", "V"], // R=Residential, B=Business, V=VPN
      connectionSpeed: campaignData.connectionSpeed || "medium+", // slow+, medium+, good+
      performance: campaignData.performance || "medium+", // slow+, medium+, good+
      
      // Geographic targeting
      geo: campaignData.geo || {
        rule: "any", // any, all, except
        by: "country", // country or continent
        codes: [],
      },
      
      // Advanced settings
      maxPopups: campaignData.maxPopups !== undefined ? campaignData.maxPopups : 0,
      userState: campaignData.userState || "running", // running or paused
    };

    // Optional fields - only include if provided
    if (campaignData.referrers) campaignPayload.referrers = campaignData.referrers;
    if (campaignData.macros) campaignPayload.macros = campaignData.macros;
    if (campaignData.popupMacros) campaignPayload.popupMacros = campaignData.popupMacros;
    if (campaignData.acceptLanguages) campaignPayload.acceptLanguages = campaignData.acceptLanguages;
    if (campaignData.capping) campaignPayload.capping = campaignData.capping;
    if (campaignData.maxHits !== undefined) campaignPayload.maxHits = campaignData.maxHits;
    if (campaignData.untilDate) campaignPayload.untilDate = campaignData.untilDate;
    if (campaignData.fingerprintSpoof !== undefined) campaignPayload.fingerprintSpoof = campaignData.fingerprintSpoof;
    if (campaignData.allowProxy !== undefined) campaignPayload.allowProxy = campaignData.allowProxy;
    if (campaignData.allowIPv6 !== undefined) campaignPayload.allowIPv6 = campaignData.allowIPv6;
    if (campaignData.allowBlockedPopups !== undefined) campaignPayload.allowBlockedPopups = campaignData.allowBlockedPopups;
    if (campaignData.ipFilter) campaignPayload.ipFilter = campaignData.ipFilter;
    if (campaignData.asnFilter) campaignPayload.asnFilter = campaignData.asnFilter;
    if (campaignData.hourlyLimit) campaignPayload.hourlyLimit = campaignData.hourlyLimit;
    if (campaignData.disJsRate !== undefined) campaignPayload.disJsRate = campaignData.disJsRate;
    if (campaignData.disImageRate !== undefined) campaignPayload.disImageRate = campaignData.disImageRate;
    if (campaignData.disCookieRate !== undefined) campaignPayload.disCookieRate = campaignData.disCookieRate;
    if (campaignData.forceHide !== undefined) campaignPayload.forceHide = campaignData.forceHide;
    if (campaignData.adSafe) campaignPayload.adSafe = campaignData.adSafe;
    if (campaignData.webSecurity !== undefined) campaignPayload.webSecurity = campaignData.webSecurity;
    if (campaignData.similarWebEnabled !== undefined) campaignPayload.similarWebEnabled = campaignData.similarWebEnabled;
    if (campaignData.bypassCf !== undefined) campaignPayload.bypassCf = campaignData.bypassCf;
    if (campaignData.viewerVersion) campaignPayload.viewerVersion = campaignData.viewerVersion;

    logger.info("Sending payload to 9hits API", {
      userId,
      payloadKeys: Object.keys(campaignPayload),
    });

    // Call 9hits API to create campaign
    const response = await axios.post(
      `https://panel.9hits.com/api/siteAdd?key=${API_KEY}`,
      campaignPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    logger.info("9hits API response received", {
      userId,
      status: response.data.status,
      hasData: !!response.data.data,
      dataKeys: response.data.data ? Object.keys(response.data.data) : [],
    });

    if (response.data.status !== "ok") {
      logger.error("9hits campaign creation failed", {
        userId,
        status: response.data.status,
        messages: response.data.messages,
        fullResponse: response.data,
      });

      return res.status(400).json({
        error: "Failed to create campaign",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    // Extract campaign ID from messages array (format: "Created #CAMPAIGN_ID")
    let campaignId = null;
    if (response.data.messages && response.data.messages.length > 0) {
      const message = response.data.messages[0];
      const match = message.match(/#(\d+)/);
      if (match) {
        campaignId = match[1];
      }
    }

    // Validate 9hits response
    if (!campaignId) {
      logger.error("9hits returned invalid campaign data - could not extract ID", {
        userId,
        responseData: response.data,
      });

      return res.status(500).json({
        error: "Invalid response from 9hits API",
        message: "Campaign was created but ID could not be extracted from messages",
        debug: response.data,
      });
    }

    logger.info("Successfully extracted campaign ID from 9hits", {
      userId,
      campaignId,
      message: response.data.messages[0],
    });

    // Save campaign to database
    const campaign = new Campaign({
      user: userId,
      title: campaignData.title,
      urls: campaignData.urls,
      nine_hits_campaign_id: campaignId,
      nine_hits_data: {
        id: campaignId,
        created_message: response.data.messages[0],
        ...campaignData,
      },
      is_adult: campaignData.isAdult || false,
      is_coin_mining: campaignData.hasCoinMining || false,
      state: campaignData.userState === "paused" ? "paused" : "created",
      macros: campaignData.macros,
      popup_macros: campaignData.popupMacros,
      countries: campaignData.geo?.codes || [],
      rule: campaignData.geo?.rule || "any",
      max_hits: campaignData.maxHits,
      until_date: campaignData.untilDate
        ? new Date(campaignData.untilDate)
        : null,
      duration_min: campaignData.duration?.[0],
      duration_max: campaignData.duration?.[1],
      metadata: {
        vendor: "nineHits",
        referrers: campaignData.referrers,
        platform: campaignData.platform,
        geo: campaignData.geo,
        capping: campaignData.capping,
        connectionTypes: campaignData.connectionTypes,
        performance: campaignData.performance,
        fingerprintSpoof: campaignData.fingerprintSpoof,
        allowProxy: campaignData.allowProxy,
        allowIPv6: campaignData.allowIPv6,
      },
    });

    await campaign.save();

    // Update subscription campaign count
    const subscription = await Subscription.findOne({ user: userId });
    if (subscription) {
      subscription.currentCampaignCount =
        (subscription.currentCampaignCount || 0) + 1;
      await subscription.save();
    }

    logger.info("9hits campaign created successfully", {
      userId,
      campaignId: campaign._id,
      nineHitsCampaignId: campaignId,
      title: campaignData.title,
    });

    res.status(201).json({
      ok: true,
      campaign: {
        id: campaign._id,
        nineHitsId: campaignId,
        title: campaign.title,
        urls: campaign.urls,
        state: campaign.state,
        createdAt: campaign.createdAt,
      },
      message: "Beta campaign created successfully",
    });
  } catch (error) {
    logger.error("Failed to create 9hits campaign", {
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
      error: "Failed to create campaign",
      message: error.message,
    });
  }
});

module.exports = router;
