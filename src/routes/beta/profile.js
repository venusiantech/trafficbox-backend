const express = require("express");
const { requireRole } = require("../../middleware/auth");
const logger = require("../../utils/logger");
const axios = require("axios");

const router = express.Router();

/**
 * Get 9hits Profile Information
 * GET /api/beta/profile
 * Returns user's 9hits profile including funds, points, slots, and membership
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

    logger.info("Fetching 9hits profile", {
      userId: req.user.id,
    });

    // Call 9hits API
    const response = await axios.get(`https://panel.9hits.com/api/profileGet`, {
      params: {
        key: API_KEY,
      },
      timeout: 15000,
    });

    if (response.data.status !== "ok") {
      logger.error("9hits API returned error status", {
        userId: req.user.id,
        status: response.data.status,
        messages: response.data.messages,
      });

      return res.status(400).json({
        error: "Failed to fetch 9hits profile",
        message: response.data.messages || "Unknown error from 9hits API",
        status: response.data.status,
      });
    }

    const profileData = response.data.data;

    logger.info("9hits profile fetched successfully", {
      userId: req.user.id,
      username: profileData.username,
      membership: profileData.membership,
      funds: profileData.funds,
      slots: profileData.slots,
    });

    res.json({
      ok: true,
      profile: {
        username: profileData.username,
        email: profileData.email,
        joined: profileData.joined,
        token: profileData.token,
        funds: profileData.funds,
        slots: {
          used: profileData.slots.used,
          available: profileData.slots.available,
          total: profileData.slots.used + profileData.slots.available,
        },
        points: profileData.points,
        membership: profileData.membership,
        membershipEndDate: profileData.membershipEndDate,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch 9hits profile", {
      userId: req.user.id,
      error: error.message,
      stack: error.stack,
    });

    // Handle axios specific errors
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: "9hits API request failed",
        message: error.response.data?.message || error.message,
        statusCode: error.response.status,
      });
    }

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return res.status(504).json({
        error: "Request timeout",
        message: "9hits API request timed out. Please try again.",
      });
    }

    res.status(500).json({
      error: "Failed to fetch 9hits profile",
      message: error.message,
    });
  }
});

module.exports = router;
