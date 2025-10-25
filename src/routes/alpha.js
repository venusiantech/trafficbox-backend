const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const vendors = require("../services/vendors");
const {
  processSingleCampaignCredits,
  processAllCampaignCredits,
} = require("../services/creditDeduction");
const { generateCampaignReportPDF } = require("../services/reportService");
const alphaTrafficTrackingService = require("../services/alphaTrafficTrackingService");
const logger = require("../utils/logger");

const router = express.Router();

// Helper function to fetch SparkTraffic stats for a single campaign
async function fetchCampaignStats(campaign) {
  if (!campaign.spark_traffic_project_id) {
    return null;
  }

  try {
    const axios = require("axios");
    const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
    const now = new Date();
    const createdDate = campaign.createdAt
      ? campaign.createdAt.toISOString().split("T")[0]
      : now.toISOString().split("T")[0];

    // Get stats data
    const statsResp = await axios.post(
      "https://v2.sparktraffic.com/get-website-traffic-project-stats",
      null,
      {
        headers: {
          "Content-Type": "application/json",
          API_KEY,
        },
        params: {
          unique_id: campaign.spark_traffic_project_id,
          from: createdDate,
          to: now.toISOString().split("T")[0],
        },
      }
    );

    if (statsResp.data) {
      // Calculate total hits and visits
      let totalHits = 0;
      let totalVisits = 0;

      if (Array.isArray(statsResp.data.hits)) {
        statsResp.data.hits.forEach((hitData) => {
          Object.values(hitData).forEach((count) => {
            totalHits += parseInt(count) || 0;
          });
        });
      }

      if (Array.isArray(statsResp.data.visits)) {
        statsResp.data.visits.forEach((visitData) => {
          Object.values(visitData).forEach((count) => {
            totalVisits += parseInt(count) || 0;
          });
        });
      }

      return {
        ...statsResp.data,
        totalHits,
        totalVisits,
        speed: campaign.state === "paused" ? 0 : 200,
      };
    }
  } catch (err) {
    logger.error("Failed to fetch Alpha campaign stats for list", {
      campaignId: campaign._id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      error: err.message,
    });
  }

  return null;
}

// Helper function to validate geo format
function validateGeoFormat(geo) {
  if (!Array.isArray(geo)) {
    return { valid: false, error: "geo must be an array" };
  }

  if (geo.length === 0) {
    return { valid: true }; // Empty array is valid
  }

  let totalPercent = 0;
  for (const item of geo) {
    // Check if it's the new format (objects with country and percent)
    if (typeof item === "object" && item !== null) {
      if (!item.country || typeof item.country !== "string") {
        return {
          valid: false,
          error: "Each geo item must have a 'country' string field",
        };
      }
      if (
        typeof item.percent !== "number" ||
        item.percent < 0 ||
        item.percent > 1
      ) {
        return {
          valid: false,
          error:
            "Each geo item must have a 'percent' number field between 0 and 1",
        };
      }
      totalPercent += item.percent;
    } else {
      // Old format (strings) is not allowed for new campaigns
      return {
        valid: false,
        error:
          "geo items must be objects with 'country' and 'percent' fields. Old string format is no longer supported for new campaigns.",
      };
    }
  }

  // Allow some tolerance for floating point precision
  if (Math.abs(totalPercent - 1) > 0.01) {
    return { valid: false, error: "Total percentage must equal 1.0 (100%)" };
  }

  return { valid: true };
}

// Helper function to create clean campaign response (hiding implementation details)
function createCleanCampaignResponse(
  campaign,
  includeStats = false,
  vendorStats = null
) {
  // Extract URLs from metadata if available, otherwise convert array format to SparkTraffic format
  let urlsDisplay = {};

  // Check if we have SparkTraffic URL format in metadata
  if (campaign.metadata && campaign.metadata.sparkTrafficUrls) {
    urlsDisplay = campaign.metadata.sparkTrafficUrls;
  } else if (campaign.urls && Array.isArray(campaign.urls)) {
    // Convert array format to SparkTraffic format for display
    campaign.urls.forEach((url, index) => {
      if (url && url.trim()) {
        urlsDisplay[`urls-${index + 1}`] = url.trim();
      }
    });
  }

  return {
    id: campaign._id,
    title: campaign.title,
    urls: urlsDisplay, // Now shows urls-1, urls-2, etc.
    duration_min: campaign.duration_min,
    duration_max: campaign.duration_max,
    countries: campaign.countries,
    rule: campaign.rule,
    macros: campaign.macros,
    is_adult: campaign.is_adult,
    is_coin_mining: campaign.is_coin_mining,
    state: campaign.state,
    is_archived: campaign.is_archived,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    archived_at: campaign.archived_at,
    delete_eligible: campaign.delete_eligible,
    vendor: "sparkTraffic", // Always SparkTraffic for Alpha routes
    // User-friendly status
    status:
      campaign.state === "paused"
        ? "paused"
        : campaign.state === "created"
        ? "active"
        : campaign.state === "archived"
        ? "archived"
        : campaign.state,
    // Include stats only when requested
    ...(includeStats &&
      vendorStats && {
        stats: {
          totalHits: vendorStats.totalHits || 0,
          totalVisits: vendorStats.totalVisits || 0,
          speed: vendorStats.speed || 0,
          status: campaign.state === "paused" ? "paused" : "active",
          dailyHits: vendorStats.hits || [],
          dailyVisits: vendorStats.visits || [],
        },
      }),
  };
}

// Create Alpha campaign (SparkTraffic only)
router.post("/campaigns", auth(), async (req, res) => {
  logger.campaign("Alpha campaign creation started", {
    userId: req.user.id,
    vendor: "sparkTraffic",
    url: req.body.url,
  });

  try {
    const userId = req.user.id;
    const body = req.body;

    // Basic validation
    if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
      logger.error("Invalid URL provided", { userId, url: body.url });
      return res.status(400).json({ error: "url required" });
    }

    // Validate geo format if provided
    if (body.geo) {
      const geoValidation = validateGeoFormat(body.geo);
      if (!geoValidation.valid) {
        logger.error("Invalid geo format", {
          userId,
          geo: body.geo,
          error: geoValidation.error,
        });
        return res.status(400).json({ error: geoValidation.error });
      }
    }

    // Check user's available hits before creating campaign
    const user = await User.findById(userId);
    if (!user) {
      logger.error("User not found", { userId });
      return res.status(404).json({ error: "User not found" });
    }

    const requiredHits = body.maxHits || 5;
    if (user.availableHits < requiredHits) {
      logger.warn("Insufficient hits", {
        userId,
        userEmail: user.email,
        required: requiredHits,
        available: user.availableHits,
      });
      return res.status(400).json({
        error: "Insufficient hits",
        required: requiredHits,
        available: user.availableHits,
      });
    }

    // Ensure required fields have default values
    if (body.is_adult === undefined) body.is_adult = false;
    if (body.is_coin_mining === undefined) body.is_coin_mining = false;

    // Default payload for campaign creation
    const defaultPayload = {
      title: "Alpha Campaign",
      urls: [],
      duration: [5, 15],
      referrers: { mode: "basic", urls: [] },
      platform: { usage: { system: 100, fixed: 0, custom: 0 } },
      macros: "",
      popupMacros: "",
      connectionTypes: ["system"],
      geo: { rule: "any", by: "country", codes: [] },
      capping: { type: "own", value: 3600 },
      maxHits: 5,
      maxPopups: 0,
      allowProxy: true,
      allowIPv6: true,
      bypassCf: false,
      similarWebEnabled: false,
      fingerprintSpoof: false,
      userState: "running",
    };

    // Merge user input with defaults (user input takes precedence)
    const merged = { ...defaultPayload, ...req.body };

    // SparkTraffic integration (always use SparkTraffic for Alpha)
    const vendor = vendors.sparkTraffic;

    // Build SparkTraffic payload following exact API documentation
    const sparkPayload = {
      unique_id: merged.unique_id || undefined,
      created_at: merged.created_at || Date.now(),
      expires_at: merged.expires_at || 0,
      title: merged.title,
      size: "eco", // Use provided size or default to demo
      multiplier: merged.multiplier || 0,
      speed: merged.speed || 200,
      traffic_type: merged.traffic_type || "direct",
      keywords: merged.keywords || "",
      referrers:
        merged.referrers && merged.referrers.urls
          ? merged.referrers.urls.join(",")
          : "",
      social_links: merged.social_links || "",
      languages: merged.languages || "",
      bounce_rate: merged.bounce_rate || 0,
      return_rate: merged.return_rate || 0,
      click_outbound_events: merged.click_outbound_events || 0,
      form_submit_events: merged.form_submit_events || 0,
      scroll_events: merged.scroll_events || 0,
      time_on_page: merged.time_on_page || "5sec",
      desktop_rate: merged.desktop_rate || 0,
      auto_renew: merged.auto_renew || "true",
      geo_type: merged.geo_type || "global",
      geo: merged.geo ? JSON.stringify(merged.geo) : "",
      shortener: merged.shortener || "",
      rss_feed: merged.rss_feed || "",
      ga_id: merged.ga_id || "",
    };

    // Handle URLs in SparkTraffic format (urls-1, urls-2, etc.)
    // Take single URL and populate urls-1, urls-2, urls-3 with the same URL
    const sparkTrafficUrls = {};

    if (merged.url) {
      // Use the same URL for urls-1, urls-2, and urls-3
      sparkPayload["urls-1"] = merged.url;
      sparkPayload["urls-2"] = merged.url;
      sparkPayload["urls-3"] = merged.url;

      sparkTrafficUrls["urls-1"] = merged.url;
      sparkTrafficUrls["urls-2"] = merged.url;
      sparkTrafficUrls["urls-3"] = merged.url;
    }

    // If user provides individual URL fields, respect those
    for (let i = 1; i <= 11; i++) {
      const urlField = `urls-${i}`;
      if (merged[urlField]) {
        sparkPayload[urlField] = merged[urlField];
        sparkTrafficUrls[urlField] = merged[urlField];
      }
    }

    // Handle legacy urls array format (but prioritize single URL approach)
    if (merged.urls && Array.isArray(merged.urls) && !merged.url) {
      merged.urls.forEach((url, index) => {
        if (index < 11 && url && url.trim()) {
          const urlKey = `urls-${index + 1}`;
          sparkPayload[urlKey] = url.trim();
          sparkTrafficUrls[urlKey] = url.trim();
        }
      });
    }

    try {
      const vendorResp = await vendor.createProject(sparkPayload);
      logger.campaign("Alpha SparkTraffic campaign created", {
        userId,
        projectId: vendorResp["new-id"] || vendorResp.id,
        title: sparkPayload.title,
      });

      // Immediately resume the campaign if it was created in paused state
      let resumeResp = null;
      if (vendorResp && vendorResp["new-id"]) {
        try {
          // Call the resume endpoint for SparkTraffic
          const axios = require("axios");
          const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
          resumeResp = await axios.post(
            "https://v2.sparktraffic.com/resume-website-traffic-project",
            { id: vendorResp["new-id"] },
            {
              headers: {
                "Content-Type": "application/json",
                API_KEY,
              },
            }
          );
        } catch (resumeErr) {
          resumeResp = { error: resumeErr.message };
        }
      }

      // Save to DB with proper geo format handling
      const projectId =
        vendorResp["new-id"] || vendorResp.id || vendorResp.project_id;

      // Handle countries/geo data properly for both old and new formats
      let countriesData = [];
      if (merged.geo) {
        if (Array.isArray(merged.geo)) {
          // New format: array of objects with country and percent
          countriesData = merged.geo;
        } else if (merged.geo.codes && Array.isArray(merged.geo.codes)) {
          // Old format: geo object with codes array
          countriesData = merged.geo.codes;
        }
      } else if (merged.countries) {
        // Direct countries field
        countriesData = merged.countries;
      }

      const camp = new Campaign({
        user: userId,
        title: sparkPayload.title,
        urls: merged.urls || [], // Keep for backward compatibility
        duration_min: merged.duration[0],
        duration_max: merged.duration[1],
        countries: countriesData,
        rule: merged.rule || "any",
        macros: merged.macros,
        is_adult: merged.is_adult,
        is_coin_mining: merged.is_coin_mining,
        spark_traffic_project_id: projectId,
        state: "created",
        metadata: {
          ...body.metadata,
          vendor: "sparkTraffic",
          route: "alpha",
          sparkTrafficUrls: sparkTrafficUrls, // Store the URL mapping
        },
        spark_traffic_data: vendorResp,
      });

      await camp.save();

      // Deduct hits from user after successful campaign creation
      user.availableHits -= requiredHits;
      await user.save();

      // Initialize Alpha traffic tracking for the new campaign
      try {
        await alphaTrafficTrackingService.initializeAlphaTrafficTracking(
          camp._id.toString(),
          projectId
        );
        logger.campaign("Alpha traffic tracking initialized", {
          userId,
          campaignId: camp._id,
          sparkTrafficProjectId: projectId,
        });
      } catch (trackingErr) {
        logger.error("Failed to initialize Alpha traffic tracking", {
          userId,
          campaignId: camp._id,
          sparkTrafficProjectId: projectId,
          error: trackingErr.message,
        });
        // Don't fail the campaign creation if tracking initialization fails
      }

      logger.campaign("Alpha campaign created successfully", {
        userId,
        campaignId: camp._id,
        sparkTrafficProjectId: projectId,
        hitsDeducted: requiredHits,
        remainingHits: user.availableHits,
      });

      return res.json({
        ok: true,
        campaign: createCleanCampaignResponse(camp),
        userStats: {
          hitsDeducted: requiredHits,
          remainingHits: user.availableHits,
        },
        message: "Alpha campaign created successfully",
        vendor: "sparkTraffic",
      });
    } catch (err) {
      logger.error("Alpha SparkTraffic campaign creation failed", {
        userId,
        error: err.message,
        stack: err.stack,
      });
      return res.status(500).json({ error: err.message });
    }
  } catch (err) {
    logger.error("Alpha campaign creation failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get Alpha campaigns with time range filtering (SparkTraffic only)
router.get("/campaigns/filter", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = "7d" } = req.query;

    // Validate time range
    const validTimeRanges = ["1m", "15m", "1h", "7d", "30d"];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        error: "Invalid time range. Valid options: 1m, 15m, 1h, 7d, 30d",
      });
    }

    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "1m":
        startDate = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago
        break;
      case "15m":
        startDate = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
        break;
      case "1h":
        startDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
    }

    // Build query filters - only SparkTraffic campaigns within time range
    const query = {
      user: userId,
      spark_traffic_project_id: { $exists: true, $ne: null },
      createdAt: { $gte: startDate, $lte: now },
    };

    // Filter by status if provided
    if (req.query.status) {
      query.state = req.query.status;
    }

    // Exclude archived campaigns by default unless specifically requested
    if (!req.query.include_archived) {
      query.$or = [{ is_archived: { $exists: false } }, { is_archived: false }];
    }

    // Get campaigns without pagination for time-filtered view
    const campaigns = await Campaign.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .select("-spark_traffic_data") // Exclude large vendor data objects
      .lean(); // Convert to plain objects for better performance

    logger.campaign("Alpha campaigns retrieved with time filter", {
      userId,
      count: campaigns.length,
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      filters: {
        status: req.query.status,
        include_archived: req.query.include_archived,
      },
    });

    // Fetch stats for each campaign and return only essential metrics
    const campaignMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        // Check if user wants detailed stats (via query parameter)
        const includeDetailedStats = req.query.include_stats === "true";
        let stats = {
          totalHits: 0,
          totalVisits: 0,
        };

        if (includeDetailedStats) {
          const vendorStats = await fetchCampaignStats(campaign);
          if (vendorStats) {
            stats.totalHits = vendorStats.totalHits || 0;
            stats.totalVisits = vendorStats.totalVisits || 0;
          }
        } else {
          // Use cached stats from database
          stats.totalHits = campaign.total_hits_counted || 0;
          stats.totalVisits = campaign.total_visits_counted || 0;
        }

        return {
          id: campaign._id,
          title: campaign.title,
          createdAt: campaign.createdAt,
          state: campaign.state,
          totalHits: stats.totalHits,
          totalVisits: stats.totalVisits,
        };
      })
    );

    // Calculate total metrics for the time range
    const totalHits = campaignMetrics.reduce(
      (sum, campaign) => sum + campaign.totalHits,
      0
    );
    const totalVisits = campaignMetrics.reduce(
      (sum, campaign) => sum + campaign.totalVisits,
      0
    );

    res.json({
      ok: true,
      timeRange: {
        selected: timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalCampaigns: campaigns.length,
        totalHits,
        totalVisits,
      },
      campaigns: campaignMetrics,
    });
  } catch (err) {
    logger.error("Get Alpha campaigns with time filter failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
      query: req.query,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get all Alpha campaigns for authenticated user (SparkTraffic only)
router.get("/campaigns", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query filters - only SparkTraffic campaigns
    const query = {
      user: userId,
      spark_traffic_project_id: { $exists: true, $ne: null },
    };

    // Filter by status if provided
    if (req.query.status) {
      query.state = req.query.status;
    }

    // Exclude archived campaigns by default unless specifically requested
    if (!req.query.include_archived) {
      query.$or = [{ is_archived: { $exists: false } }, { is_archived: false }];
    }

    // Get total count for pagination
    const totalCampaigns = await Campaign.countDocuments(query);

    // Fetch campaigns with pagination
    const campaigns = await Campaign.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .select("-spark_traffic_data") // Exclude large vendor data objects
      .lean(); // Convert to plain objects for better performance

    logger.campaign("Alpha campaigns retrieved", {
      userId,
      count: campaigns.length,
      totalCampaigns,
      page,
      limit,
      filters: {
        status: req.query.status,
        include_archived: req.query.include_archived,
      },
    });

    // Fetch stats for each campaign and create clean responses
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        // Check if user wants detailed stats (via query parameter)
        const includeDetailedStats = req.query.include_stats === "true";

        if (includeDetailedStats) {
          const vendorStats = await fetchCampaignStats(campaign);
          return createCleanCampaignResponse(campaign, true, vendorStats);
        } else {
          // Always include basic stats for Alpha SparkTraffic campaigns
          const basicStats = {
            totalHits: campaign.total_hits_counted || 0,
            totalVisits: campaign.total_visits_counted || 0,
            speed: campaign.state === "paused" ? 0 : 200,
            status: campaign.state === "paused" ? "paused" : "active",
            dailyHits: [],
            dailyVisits: [],
          };
          return createCleanCampaignResponse(campaign, true, basicStats);
        }
      })
    );

    res.json({
      ok: true,
      campaigns: campaignsWithStats,
      pagination: {
        page,
        limit,
        total: totalCampaigns,
        pages: Math.ceil(totalCampaigns / limit),
        hasNext: page < Math.ceil(totalCampaigns / limit),
        hasPrev: page > 1,
      },
      filters: {
        vendor: "sparkTraffic",
        status: req.query.status || null,
        include_archived: req.query.include_archived === "true",
      },
    });
  } catch (err) {
    logger.error("Get Alpha campaigns failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
      query: req.query,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get Alpha campaign by ID
router.get("/campaigns/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Alpha campaign not found", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    // Check if it's a SparkTraffic campaign
    if (!c.spark_traffic_project_id) {
      logger.warn("Non-SparkTraffic campaign accessed via Alpha route", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found in Alpha" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha campaign access attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
        userRole: req.user.role,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Don't allow access to archived campaigns unless specifically requested
    if (c.is_archived && !req.query.include_archived) {
      logger.warn("Archived Alpha campaign access without flag", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Fetch SparkTraffic stats
    let vendorStats = null;
    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

      // Try to get specific project stats
      const now = new Date();
      const createdDate = c.createdAt
        ? c.createdAt.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];

      // Get stats data
      const statsResp = await axios.post(
        "https://v2.sparktraffic.com/get-website-traffic-project-stats",
        null,
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
          params: {
            unique_id: c.spark_traffic_project_id,
            from: createdDate,
            to: now.toISOString().split("T")[0],
          },
        }
      );

      // Get actual project details to fetch real speed and settings
      let projectDetails = null;
      try {
        const projectResp = await axios.post(
          "https://v2.sparktraffic.com/modify-website-traffic-project",
          {
            unique_id: c.spark_traffic_project_id,
          },
          {
            headers: {
              "Content-Type": "application/json",
              API_KEY,
            },
          }
        );

        if (projectResp.data && projectResp.data.speed !== undefined) {
          projectDetails = projectResp.data;
        }
      } catch (projectErr) {
        logger.warn("Failed to fetch project details via modify endpoint", {
          campaignId: req.params.id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          error: projectErr.message,
        });
      }

      if (statsResp.data) {
        // Calculate total hits from stats
        let totalHits = 0;
        let totalVisits = 0;

        if (Array.isArray(statsResp.data.hits)) {
          statsResp.data.hits.forEach((hitData) => {
            Object.values(hitData).forEach((count) => {
              totalHits += parseInt(count) || 0;
            });
          });
        }

        if (Array.isArray(statsResp.data.visits)) {
          statsResp.data.visits.forEach((visitData) => {
            Object.values(visitData).forEach((count) => {
              totalVisits += parseInt(count) || 0;
            });
          });
        }

        vendorStats = {
          ...statsResp.data,
          totalHits,
          totalVisits,
          speed: projectDetails?.speed || (c.state === "paused" ? 0 : 200),
          ...(projectDetails && {
            projectDetails: {
              speed: projectDetails.speed,
              size: projectDetails.size,
              auto_renew: projectDetails.auto_renew,
              geo_type: projectDetails.geo_type,
              traffic_type: projectDetails.traffic_type,
            },
          }),
        };
      }
    } catch (err) {
      logger.error("Failed to fetch Alpha SparkTraffic vendor stats", {
        userId: req.user.id,
        campaignId: req.params.id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
        error: err.message,
      });
      vendorStats = {
        error: "Failed to fetch vendor stats",
        details: err.message,
      };
    }

    res.json(createCleanCampaignResponse(c, true, vendorStats));
  } catch (err) {
    logger.error("Get Alpha campaign failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Pause Alpha campaign
router.post("/campaigns/:id/pause", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c || !c.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for pause", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha pause attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    let vendorResp = null;
    try {
      // Pause by setting speed to 0 using modify-website-traffic-project endpoint
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      vendorResp = await axios.post(
        "https://v2.sparktraffic.com/modify-website-traffic-project",
        {
          unique_id: c.spark_traffic_project_id,
          speed: 0,
        },
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
        }
      );
      logger.campaign("Alpha campaign paused", {
        userId: req.user.id,
        campaignId: c._id,
        vendor: "sparkTraffic",
      });
    } catch (err) {
      logger.error("Alpha SparkTraffic pause failed", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
        error: err.message,
      });
      vendorResp = { error: err.message };
    }

    c.state = "paused";
    await c.save();

    return res.json({
      ok: true,
      campaign: createCleanCampaignResponse(c),
      vendorResp:
        vendorResp && vendorResp.data
          ? vendorResp.data
          : vendorResp && vendorResp.error
          ? { error: vendorResp.error }
          : vendorResp,
    });
  } catch (err) {
    logger.error("Alpha campaign pause failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Resume Alpha campaign
router.post("/campaigns/:id/resume", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c || !c.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for resume", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha resume attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    let vendorResp = null;
    try {
      // Resume by setting speed to 200 using modify-website-traffic-project endpoint
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      vendorResp = await axios.post(
        "https://v2.sparktraffic.com/modify-website-traffic-project",
        {
          unique_id: c.spark_traffic_project_id,
          speed: 200,
        },
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
        }
      );
    } catch (err) {
      logger.error("Alpha SparkTraffic resume failed", {
        userId: req.user.id,
        campaignId: c._id,
        error: err.message,
      });
      vendorResp = { error: err.message };
    }

    c.state = "ok";
    c.userState = "running";
    await c.save();

    logger.campaign("Alpha campaign resumed", {
      userId: req.user.id,
      campaignId: c._id,
      vendor: "sparkTraffic",
    });

    return res.json({
      ok: true,
      campaign: createCleanCampaignResponse(c),
      vendorResp:
        vendorResp && vendorResp.data
          ? vendorResp.data
          : vendorResp && vendorResp.error
          ? { error: vendorResp.error }
          : vendorResp,
    });
  } catch (err) {
    logger.error("Alpha campaign resume failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Update Alpha campaign
router.post("/campaigns/:id/modify", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c || !c.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for modify", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha modify attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Update fields locally
    const updatable = [
      "title",
      "urls",
      "duration_min",
      "duration_max",
      "countries",
      "rule",
      "macros",
      "is_adult",
      "is_coin_mining",
      "metadata",
    ];

    // Validate geo format if provided
    if (req.body.countries) {
      const geoValidation = validateGeoFormat(req.body.countries);
      if (!geoValidation.valid) {
        logger.error("Invalid geo format in Alpha modify", {
          userId: req.user.id,
          campaignId: req.params.id,
          geo: req.body.countries,
          error: geoValidation.error,
        });
        return res.status(400).json({ error: geoValidation.error });
      }
    }

    updatable.forEach((f) => {
      if (req.body[f] !== undefined) c[f] = req.body[f];
    });

    // Update metadata to maintain Alpha route info
    c.metadata = { ...c.metadata, ...req.body.metadata, route: "alpha" };

    // Update on SparkTraffic
    let vendorResp = null;
    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

      // Build SparkTraffic modify payload
      const modifyPayload = {
        unique_id: c.spark_traffic_project_id,
      };

      // Map fields exactly as per SparkTraffic documentation
      if (req.body.created_at !== undefined)
        modifyPayload.created_at = req.body.created_at;
      if (req.body.expires_at !== undefined)
        modifyPayload.expires_at = req.body.expires_at;
      if (req.body.title) modifyPayload.title = req.body.title;
      if (req.body.size) modifyPayload.size = req.body.size;
      if (req.body.multiplier !== undefined)
        modifyPayload.multiplier = req.body.multiplier;
      if (req.body.speed !== undefined) modifyPayload.speed = req.body.speed;
      if (req.body.traffic_type)
        modifyPayload.traffic_type = req.body.traffic_type;
      if (req.body.keywords) modifyPayload.keywords = req.body.keywords;
      if (req.body.referrers) {
        if (typeof req.body.referrers === "object" && req.body.referrers.urls) {
          modifyPayload.referrers = req.body.referrers.urls.join(",");
        } else if (typeof req.body.referrers === "string") {
          modifyPayload.referrers = req.body.referrers;
        }
      }
      if (req.body.social_links)
        modifyPayload.social_links = req.body.social_links;
      if (req.body.languages) modifyPayload.languages = req.body.languages;
      if (req.body.bounce_rate !== undefined)
        modifyPayload.bounce_rate = req.body.bounce_rate;
      if (req.body.return_rate !== undefined)
        modifyPayload.return_rate = req.body.return_rate;
      if (req.body.click_outbound_events !== undefined)
        modifyPayload.click_outbound_events = req.body.click_outbound_events;
      if (req.body.form_submit_events !== undefined)
        modifyPayload.form_submit_events = req.body.form_submit_events;
      if (req.body.scroll_events !== undefined)
        modifyPayload.scroll_events = req.body.scroll_events;
      if (req.body.time_on_page)
        modifyPayload.time_on_page = req.body.time_on_page;
      if (req.body.desktop_rate !== undefined)
        modifyPayload.desktop_rate = req.body.desktop_rate;
      if (req.body.auto_renew) modifyPayload.auto_renew = req.body.auto_renew;
      if (req.body.geo_type) modifyPayload.geo_type = req.body.geo_type;
      if (req.body.shortener) modifyPayload.shortener = req.body.shortener;
      if (req.body.rss_feed) modifyPayload.rss_feed = req.body.rss_feed;
      if (req.body.ga_id) modifyPayload.ga_id = req.body.ga_id;

      // Handle URLs in SparkTraffic format (urls-1, urls-2, etc.)
      // Take single URL and populate urls-1, urls-2, urls-3 with the same URL
      if (req.body.url) {
        modifyPayload["urls-1"] = req.body.url;
        modifyPayload["urls-2"] = req.body.url;
        modifyPayload["urls-3"] = req.body.url;
      }

      // If user provides individual URL fields, respect those
      for (let i = 1; i <= 11; i++) {
        const urlField = `urls-${i}`;
        if (req.body[urlField]) {
          modifyPayload[urlField] = req.body[urlField];
        }
      }

      // Handle legacy urls array format (but prioritize single URL approach)
      if (req.body.urls && Array.isArray(req.body.urls) && !req.body.url) {
        req.body.urls.forEach((url, index) => {
          if (index < 11 && url && url.trim()) {
            modifyPayload[`urls-${index + 1}`] = url.trim();
          }
        });
      }

      // Handle geo format
      if (req.body.geo) {
        modifyPayload.geo = Array.isArray(req.body.geo)
          ? JSON.stringify(req.body.geo)
          : req.body.geo;
      }

      // Call SparkTraffic modify endpoint
      vendorResp = await axios.post(
        "https://v2.sparktraffic.com/modify-website-traffic-project",
        modifyPayload,
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
        }
      );

      logger.campaign("Alpha SparkTraffic campaign modified successfully", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
      });
    } catch (err) {
      logger.error("Alpha SparkTraffic modify API call failed", {
        userId: req.user.id,
        campaignId: c._id,
        error: err.message,
      });
      vendorResp = { error: err.message };
    }

    await c.save();

    logger.campaign("Alpha campaign modified", {
      userId: req.user.id,
      campaignId: c._id,
    });

    res.json({
      ok: true,
      campaign: createCleanCampaignResponse(c),
      message: "Alpha campaign updated successfully",
      vendor: "sparkTraffic",
    });
  } catch (err) {
    logger.error("Alpha campaign modify failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Archive Alpha campaign
router.delete("/campaigns/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c || !c.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for archive", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha archive attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // If already archived, check if eligible for permanent deletion
    if (c.is_archived && c.delete_eligible) {
      await c.deleteOne();
      logger.campaign("Alpha campaign permanently deleted", {
        userId: req.user.id,
        campaignId: c._id,
      });
      return res.json({
        ok: true,
        message: "Alpha campaign permanently deleted",
        action: "permanent_delete",
      });
    }

    // Pause campaign on SparkTraffic by setting speed to 0
    let vendorResp = null;
    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      vendorResp = await axios.post(
        "https://v2.sparktraffic.com/modify-website-traffic-project",
        {
          unique_id: c.spark_traffic_project_id,
          speed: 0,
        },
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
        }
      );
      logger.campaign("Alpha campaign archived on SparkTraffic", {
        userId: req.user.id,
        campaignId: c._id,
      });
    } catch (err) {
      logger.error("Alpha SparkTraffic archive failed", {
        userId: req.user.id,
        campaignId: c._id,
        error: err.message,
      });
      vendorResp = { error: err.message };
    }

    // Archive the campaign
    c.is_archived = true;
    c.archived_at = new Date();
    c.state = "archived";
    await c.save();

    logger.campaign("Alpha campaign archived", {
      userId: req.user.id,
      campaignId: c._id,
    });

    res.json({
      ok: true,
      message:
        "Alpha campaign archived successfully. Will be permanently deleted after 7 days.",
      campaign: createCleanCampaignResponse(c),
      action: "archived",
      vendor: "sparkTraffic",
    });
  } catch (err) {
    logger.error("Alpha campaign archive failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get Alpha campaign statistics
router.get("/campaigns/:id/stats", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c || !c.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for stats", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha campaign stats access attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get date range from query parameters
    const from = req.query.from;
    const to = req.query.to;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !dateRegex.test(from)) {
      return res.status(400).json({
        error: "Invalid 'from' date format. Use YYYY-MM-DD",
      });
    }
    if (to && !dateRegex.test(to)) {
      return res.status(400).json({
        error: "Invalid 'to' date format. Use YYYY-MM-DD",
      });
    }

    // Default to last 30 days if no dates provided
    let fromDate = from;
    let toDate = to;

    if (!fromDate || !toDate) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);

      fromDate = fromDate || thirtyDaysAgo.toISOString().split("T")[0];
      toDate = toDate || now.toISOString().split("T")[0];
    }

    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

      // Call SparkTraffic stats API
      const statsResp = await axios.post(
        "https://v2.sparktraffic.com/get-website-traffic-project-stats",
        null,
        {
          headers: {
            "Content-Type": "application/json",
            API_KEY,
          },
          params: {
            unique_id: c.spark_traffic_project_id,
            from: fromDate,
            to: toDate,
          },
        }
      );

      logger.campaign("Alpha campaign stats retrieved successfully", {
        userId: req.user.id,
        campaignId: c._id,
        dateRange: { from: fromDate, to: toDate },
      });

      res.json({
        ok: true,
        campaign: {
          id: c._id,
          title: c.title,
          vendor: "sparkTraffic",
          spark_traffic_project_id: c.spark_traffic_project_id,
        },
        dateRange: {
          from: fromDate,
          to: toDate,
        },
        stats: statsResp.data,
      });
    } catch (err) {
      logger.error("Alpha SparkTraffic stats API failed", {
        userId: req.user.id,
        campaignId: c._id,
        error: err.message,
      });

      res.status(500).json({
        error: "Failed to fetch Alpha campaign statistics",
        details: err.message,
        vendor: "sparkTraffic",
      });
    }
  } catch (err) {
    logger.error("Get Alpha campaign stats failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF report for Alpha campaign
router.get("/campaigns/:id/report.pdf", auth(), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || !campaign.spark_traffic_project_id) {
      logger.warn("Alpha campaign not found for report", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Alpha campaign not found" });
    }

    if (campaign.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized Alpha report access attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get date range from query parameters (optional)
    const { from, to } = req.query;

    // Validate date format if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !dateRegex.test(from)) {
      return res.status(400).json({
        error: "Invalid 'from' date format. Use YYYY-MM-DD",
      });
    }
    if (to && !dateRegex.test(to)) {
      return res.status(400).json({
        error: "Invalid 'to' date format. Use YYYY-MM-DD",
      });
    }

    logger.info("Generating Alpha campaign PDF report", {
      userId: req.user.id,
      campaignId: req.params.id,
      dateRange: { from, to },
    });

    // Generate PDF report
    const pdfBuffer = await generateCampaignReportPDF(req.params.id, {
      from,
      to,
    });

    // Set response headers for PDF download
    const filename = `alpha-campaign-${
      campaign.title || campaign._id
    }-report.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    logger.info("Alpha campaign PDF report generated successfully", {
      userId: req.user.id,
      campaignId: req.params.id,
      filename,
      size: pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    logger.error("Generate Alpha campaign report failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      error: "Failed to generate Alpha campaign report",
      details: err.message,
    });
  }
});

module.exports = router;
