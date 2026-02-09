const express = require("express");
const { requireRole } = require("../../../middleware/auth");
const Campaign = require("../../../models/Campaign");
const logger = require("../../../utils/logger");
const axios = require("axios");

const router = express.Router();

/**
 * Get campaigns from 9hits
 * GET /api/beta/campaigns
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 100, max: 500)
 * - filter: Filter by title, url, or id:campaignId
 */
router.get("/", requireRole(), async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      logger.error("9hits API key not configured");
      return res.status(500).json({
        error: "9hits API key not configured",
        message: "Please configure NINE_HITS_API_KEY in environment variables",
      });
    }

    const { page = 1, limit = 100, filter } = req.query;

    // Validate limit (max 500)
    const validLimit = Math.min(parseInt(limit) || 100, 500);
    const validPage = parseInt(page) || 1;

    logger.info("Fetching 9hits campaigns", {
      userId: req.user.id,
      page: validPage,
      limit: validLimit,
      filter: filter || "none",
    });

    // Build query parameters
    const params = {
      key: API_KEY,
      page: validPage,
      limit: validLimit,
    };

    if (filter) {
      params.filter = filter;
    }

    // Call 9hits API
    const response = await axios.get("https://panel.9hits.com/api/siteGet", {
      params,
      timeout: 15000,
    });

    if (response.data.status !== "ok") {
      logger.error("9hits API returned error status", {
        userId: req.user.id,
        status: response.data.status,
        messages: response.data.messages,
      });

      return res.status(400).json({
        error: "Failed to fetch campaigns",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    const campaigns = response.data.data;

    logger.info("9hits campaigns fetched successfully", {
      userId: req.user.id,
      count: Array.isArray(campaigns) ? campaigns.length : 0,
      filter: filter || "none",
    });

    res.json({
      ok: true,
      campaigns: campaigns || [],
      pagination: {
        page: validPage,
        limit: validLimit,
        total: Array.isArray(campaigns) ? campaigns.length : 0,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch 9hits campaigns", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });

    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: "9hits API request failed",
        message: error.response.data?.message || error.message,
      });
    }

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        error: "Request timeout",
        message: "9hits API request timed out. Please try again.",
      });
    }

    res.status(500).json({
      error: "Failed to fetch campaigns",
      message: error.message,
    });
  }
});

/**
 * Get single campaign by ID
 * GET /api/beta/campaigns/:id
 */
router.get("/:id", requireRole(), async (req, res) => {
  try {
    const API_KEY = process.env.NINE_HITS_API_KEY?.trim();

    if (!API_KEY) {
      return res.status(500).json({
        error: "9hits API key not configured",
      });
    }

    const campaignId = req.params.id;

    logger.info("Fetching single 9hits campaign", {
      userId: req.user.id,
      campaignId,
    });

    // Call 9hits API with filter by id
    const response = await axios.get("https://panel.9hits.com/api/siteGet", {
      params: {
        key: API_KEY,
        filter: `id:${campaignId}`,
      },
      timeout: 15000,
    });

    if (response.data.status !== "ok") {
      return res.status(400).json({
        error: "Failed to fetch campaign",
        message: response.data.messages,
      });
    }

    const campaigns = response.data.data;

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      return res.status(404).json({
        error: "Campaign not found",
        message: `Campaign with ID ${campaignId} not found`,
      });
    }

    logger.info("9hits campaign fetched successfully", {
      userId: req.user.id,
      campaignId,
    });

    res.json({
      ok: true,
      campaign: campaigns[0],
    });
  } catch (error) {
    logger.error("Failed to fetch 9hits campaign", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      error: "Failed to fetch campaign",
      message: error.message,
    });
  }
});

module.exports = router;
