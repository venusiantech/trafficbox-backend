const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const vendors = require("../services/vendors");
const {
  processSingleCampaignCredits,
  processAllCampaignCredits,
} = require("../services/creditDeduction");
const logger = require("../utils/logger");

const router = express.Router();

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
  return {
    id: campaign._id,
    title: campaign.title,
    urls: campaign.urls,
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

// Create campaign -> siteAdd
router.post("/", auth(), async (req, res) => {
  logger.campaign("Campaign creation started", {
    userId: req.user.id,
    vendor: req.body.vendor || "sparkTraffic",
    url: req.body.url,
  });

  try {
    const userId = req.user.id;
    const body = req.body;
    const vendorName = body.vendor || "sparkTraffic";

    const vendor = vendors[vendorName];
    if (!vendor) {
      logger.error("Invalid vendor", { userId, vendor: vendorName });
      return res.status(400).json({ error: "Invalid vendor" });
    }

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
      title: "Test Campaign",
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

    // SparkTraffic integration
    if (vendorName === "sparkTraffic") {
      // Always use demo size (economy not supported)
      const sparkPayload = {
        unique_id: merged.unique_id || undefined,
        created_at: merged.created_at || Date.now(),
        expires_at: merged.expires_at || 0,
        title: merged.title,
        size: "eco",
        multiplier: merged.multiplier || 0,
        speed: merged.speed || 200,
        "urls-1": merged.urls && merged.urls[0] ? merged.urls[0] : merged.url,
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

      try {
        const vendorResp = await vendor.createProject(sparkPayload);
        logger.campaign("SparkTraffic campaign created", {
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
          urls: merged.urls,
          duration_min: merged.duration[0],
          duration_max: merged.duration[1],
          countries: countriesData,
          rule: merged.rule || "any",
          macros: merged.macros,
          is_adult: merged.is_adult,
          is_coin_mining: merged.is_coin_mining,
          spark_traffic_project_id: projectId,
          state: "created",
          metadata: body.metadata,
          spark_traffic_data: vendorResp,
        });

        await camp.save();

        // Deduct hits from user after successful campaign creation
        user.availableHits -= requiredHits;
        await user.save();

        logger.campaign("Campaign created successfully", {
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
          message: "Campaign created successfully",
        });
      } catch (err) {
        logger.error("SparkTraffic campaign creation failed", {
          userId,
          error: err.message,
          stack: err.stack,
        });
        return res.status(500).json({ error: err.message });
      }
    }

    /* 
    // ===== 9HITS INTEGRATION (COMMENTED OUT - USING SPARKTRAFFIC ONLY) =====
    
    // Build payload (still 9Hits style for now, but can be extended per vendor)
    const payload = {
      title: merged.title || `campaign-${Date.now()}`,
      urls: merged.urls,
      duration: merged.duration,
      geo: merged.geo,
      macros: merged.macros,
      isAdult: merged.isAdult === true,
      hasCoinMining: merged.hasCoinMining === true,
      popupMacros: merged.popupMacros,
      maxHits: merged.maxHits,
      untilDate: merged.untilDate,
      capping: merged.capping,
      platform: merged.platform,
      referrers: merged.referrers,
      connectionTypes: merged.connectionTypes,
      connectionSpeed: merged.connectionSpeed,
      performance: merged.performance,
      maxPopups: merged.maxPopups,
      allowProxy: merged.allowProxy,
      allowIPv6: merged.allowIPv6,
      bypassCf: merged.bypassCf,
      similarWebEnabled: merged.similarWebEnabled,
      fingerprintSpoof: merged.fingerprintSpoof,
      userState: merged.userState,
    };

    // idempotency key
    const idempotencyKey = await vendor.getUuidV4();
    const vendorResp = await vendor.createCampaign(payload, idempotencyKey);
    
    // Try to extract vendorId from data.id or from messages (e.g., 'Created #40633533')
    let vendorId = (vendorResp && vendorResp.data && vendorResp.data.id) || null;
    if (!vendorId && vendorResp && Array.isArray(vendorResp.messages)) {
      const match = vendorResp.messages.join(" ").match(/#(\d+)/);
      if (match) vendorId = match[1];
    }

    // Fetch full campaign details from 9Hits
    let nineHitsData = null;
    if (vendorId) {
      try {
        const nine = require("../services/nineHits");
        const detailsResp = await nine.siteGet({ filter: `id:${vendorId}` });
        if (detailsResp && Array.isArray(detailsResp.data) && detailsResp.data.length > 0) {
          nineHitsData = detailsResp.data[0];
        }
      } catch (err) {
        nineHitsData = {
          error: "Failed to fetch full 9Hits data",
          details: err.message,
        };
      }
    }

    const camp = new Campaign({
      user: userId,
      title: payload.title,
      urls: payload.urls,
      duration_min: payload.duration[0],
      duration_max: payload.duration[1],
      countries: payload.geo.codes,
      rule: payload.geo.rule,
      macros: payload.macros,
      is_adult: payload.isAdult,
      is_coin_mining: payload.hasCoinMining,
      nine_hits_campaign_id: vendorId, // for 9Hits, or generic vendor_campaign_id
      state: vendorResp && vendorResp.status,
      metadata: body.metadata,
      nine_hits_data: nineHitsData, // store all 9Hits fields
    });

    await camp.save();

    // Deduct hits from user after successful 9Hits campaign creation
    user.availableHits -= requiredHits;
    await user.save();

    res.json({
      ok: true,
      campaign: createCleanCampaignResponse(camp),
      vendorRaw: vendorResp,
      userStats: {
        hitsDeducted: requiredHits,
        remainingHits: user.availableHits,
      },
    });
    
    // ===== END 9HITS INTEGRATION =====
    */
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all campaigns for authenticated user
router.get("/", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query filters
    const query = { user: userId };

    // Filter by status if provided
    if (req.query.status) {
      query.state = req.query.status;
    }

    // Filter by vendor if provided
    if (req.query.vendor) {
      if (req.query.vendor === "sparkTraffic") {
        query.spark_traffic_project_id = { $exists: true, $ne: null };
      } else if (req.query.vendor === "nineHits") {
        query.nine_hits_campaign_id = { $exists: true, $ne: null };
      }
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
      .select("-nine_hits_data -spark_traffic_data") // Exclude large vendor data objects
      .lean(); // Convert to plain objects for better performance

    logger.campaign("User campaigns retrieved", {
      userId,
      count: campaigns.length,
      totalCampaigns,
      page,
      limit,
      filters: {
        status: req.query.status,
        vendor: req.query.vendor,
        include_archived: req.query.include_archived,
      },
    });

    // Clean up campaign data to hide implementation details
    const cleanCampaigns = campaigns.map((campaign) =>
      createCleanCampaignResponse(campaign)
    );
    );

    res.json({
      ok: true,
      campaigns: cleanCampaigns,
      pagination: {
        page,
        limit,
        total: totalCampaigns,
        pages: Math.ceil(totalCampaigns / limit),
        hasNext: page < Math.ceil(totalCampaigns / limit),
        hasPrev: page > 1,
      },
      filters: {
        status: req.query.status || null,
        vendor: req.query.vendor || null,
        include_archived: req.query.include_archived === "true",
      },
    });
  } catch (err) {
    logger.error("Get campaigns failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
      query: req.query,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get user stats (credits and available hits) - MUST BE BEFORE /:id route
router.get("/user/stats", auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "credits availableHits email firstName lastName"
    );
    if (!user) {
      logger.warn("User not found for stats", { userId: req.user.id });
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        credits: user.credits,
        availableHits: user.availableHits,
      },
    });
  } catch (err) {
    logger.error("Get user stats failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get archived campaigns - MUST BE BEFORE /:id route
router.get("/archived", auth(), async (req, res) => {
  try {
    const archivedCampaigns = await Campaign.find({
      user: req.user.id,
      is_archived: true,
    }).sort({ archived_at: -1 });

    // Clean up archived campaign data
    const cleanArchivedCampaigns = archivedCampaigns.map((campaign) =>
      createCleanCampaignResponse(campaign)
    );
    );

    res.json({
      ok: true,
      campaigns: cleanArchivedCampaigns,
      count: cleanArchivedCampaigns.length,
    });
  } catch (err) {
    logger.error("Get archived campaigns failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get campaign
router.get("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized campaign access attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
        userRole: req.user.role,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Don't allow access to archived campaigns unless specifically requested
    if (c.is_archived && !req.query.include_archived) {
      logger.warn("Archived campaign access without flag", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Fetch vendor stats if possible
    let vendorStats = null;

    // Fetch SparkTraffic stats
    if (c.spark_traffic_project_id) {
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
          // Try to get current project settings by using modify endpoint with current unique_id only
          // This often returns current project state in the response
          const projectResp = await axios.post(
            "https://v2.sparktraffic.com/modify-website-traffic-project",
            {
              unique_id: c.spark_traffic_project_id,
              // Not changing anything, just querying current state
            },
            {
              headers: {
                "Content-Type": "application/json",
                API_KEY,
              },
            }
          );

          // Check if the response contains current project settings
          if (projectResp.data && projectResp.data.speed !== undefined) {
            projectDetails = projectResp.data;
            logger.debug("Project details fetched via modify endpoint", {
              campaignId: req.params.id,
              sparkTrafficProjectId: c.spark_traffic_project_id,
              projectDetails,
            });
          } else {
            logger.warn("Modify endpoint didn't return project details", {
              campaignId: req.params.id,
              sparkTrafficProjectId: c.spark_traffic_project_id,
              response: projectResp.data,
            });
          }
        } catch (projectErr) {
          logger.warn("Failed to fetch project details via modify endpoint", {
            campaignId: req.params.id,
            sparkTrafficProjectId: c.spark_traffic_project_id,
            error: projectErr.message,
            status: projectErr.response?.status,
            responseData: projectErr.response?.data,
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
            // Use actual speed from project details, fallback to estimate
            speed: projectDetails?.speed || (c.state === "paused" ? 0 : 200),
            // Include other project settings if available
            ...(projectDetails && {
              projectDetails: {
                speed: projectDetails.speed,
                size: projectDetails.size,
                auto_renew: projectDetails.auto_renew,
                geo_type: projectDetails.geo_type,
                traffic_type: projectDetails.traffic_type,
                // Add other relevant fields you want to show
              },
            }),
          };
        } else {
          vendorStats = {
            error: "No data returned from SparkTraffic",
            response: statsResp.data,
          };
        }
      } catch (err) {
        logger.error("Failed to fetch SparkTraffic vendor stats", {
          userId: req.user.id,
          campaignId: req.params.id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          error: err.message,
          status: err.response?.status,
          responseData: err.response?.data,
        });
        vendorStats = {
          error: "Failed to fetch vendor stats",
          details: err.message,
          status: err.response?.status,
          apiResponse: err.response?.data,
        };
      }
    }

    // Fetch 9Hits stats
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        const statsResp = await nine.siteGet({ id: c.nine_hits_campaign_id });
        vendorStats = statsResp;
      } catch (err) {
        logger.error("Failed to fetch 9Hits vendor stats", {
          userId: req.user.id,
          campaignId: req.params.id,
          nineHitsId: c.nine_hits_campaign_id,
          error: err.message,
        });
        vendorStats = {
          error: "Failed to fetch vendor stats",
          details: err.message,
        };
      }
    }

    res.json(createCleanCampaignResponse(c, true, vendorStats));
  } catch (err) {
    logger.error("Get campaign failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post("/:id/pause", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for pause", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized pause attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    let vendorResp = null;
    if (c.spark_traffic_project_id) {
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
        logger.campaign("Campaign paused", {
          userId: req.user.id,
          campaignId: c._id,
          vendor: "sparkTraffic",
        });
      } catch (err) {
        logger.error("SparkTraffic pause failed", {
          userId: req.user.id,
          campaignId: c._id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          error: err.message,
          status: err.response?.status,
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
    }
    // Handle 9Hits campaigns
    let nineResp = null;
    if (c.nine_hits_campaign_id) {
      logger.campaign("Pausing 9Hits campaign", {
        userId: req.user.id,
        campaignId: c._id,
        nineHitsId: c.nine_hits_campaign_id,
      });

      try {
        const nine = require("../services/nineHits");
        nineResp = await nine.sitePause({ id: c.nine_hits_campaign_id });
        logger.campaign("9Hits pause API call successful", {
          userId: req.user.id,
          campaignId: c._id,
          response: nineResp,
        });
      } catch (err) {
        logger.error("9Hits pause API call failed", {
          userId: req.user.id,
          campaignId: c._id,
          nineHitsId: c.nine_hits_campaign_id,
          error: err.message,
        });
        nineResp = { error: err.message };
      }

      c.state = "paused";
      await c.save();

      logger.campaign("Campaign paused successfully", {
        userId: req.user.id,
        campaignId: c._id,
        vendor: "9Hits",
      });

      return res.json({ ok: true, campaign: createCleanCampaignResponse(c), vendorResp: nineResp });
    }

    logger.warn("No vendor campaign ID found for pause", {
      userId: req.user.id,
      campaignId: c._id,
    });
    res.status(400).json({ error: "No vendor campaign id found" });
  } catch (err) {
    logger.error("Campaign pause failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Resume campaign
router.post("/:id/resume", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for resume", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized resume attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Resume on vendor if possible
    let vendorResp = null;
    if (c.spark_traffic_project_id) {
      logger.campaign("Resuming SparkTraffic campaign", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
      });

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
        logger.error("SparkTraffic resume failed", {
          userId: req.user.id,
          campaignId: c._id,
          error: err.message,
        });
        vendorResp = { error: err.message };
      }

      c.state = "ok";
      c.userState = "running";
      await c.save();

      logger.campaign("Campaign resumed", {
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
    }
    if (c.nine_hits_campaign_id) {
      logger.campaign("Resuming 9Hits campaign", {
        userId: req.user.id,
        campaignId: c._id,
        nineHitsId: c.nine_hits_campaign_id,
      });

      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteUpdate({
          id: c.nine_hits_campaign_id,
          userState: "running",
        });
        logger.campaign("9Hits resume API call successful", {
          userId: req.user.id,
          campaignId: c._id,
          response: vendorResp,
        });
      } catch (err) {
        logger.error("9Hits resume API call failed", {
          userId: req.user.id,
          campaignId: c._id,
          nineHitsId: c.nine_hits_campaign_id,
          error: err.message,
        });
        vendorResp = { error: err.message };
      }
    }

    c.state = "ok";
    c.userState = "running";
    await c.save();

    logger.campaign("Campaign resumed successfully", {
      userId: req.user.id,
      campaignId: c._id,
      vendor: c.nine_hits_campaign_id ? "9Hits" : "unknown",
    });

    res.json({ ok: true, campaign: createCleanCampaignResponse(c), vendorResp });
  } catch (err) {
    logger.error("Campaign resume failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Update campaign (POST method following SparkTraffic documentation)
router.post("/:id/modify", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for modify", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized modify attempt", {
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
        logger.error("Invalid geo format in modify", {
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

    // Update on vendor if possible
    let vendorResp = null;

    // Handle SparkTraffic campaigns
    if (c.spark_traffic_project_id) {
      logger.campaign("Modifying SparkTraffic campaign", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
        updateData: req.body,
      });

      try {
        const axios = require("axios");
        const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

        // Build SparkTraffic modify payload following exact documentation format
        const modifyPayload = {
          unique_id: c.spark_traffic_project_id, // Required parameter
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

        // Handle URLs - support both formats
        if (req.body["urls-1"]) modifyPayload["urls-1"] = req.body["urls-1"];
        if (req.body["urls-2"]) modifyPayload["urls-2"] = req.body["urls-2"];
        if (req.body["urls-3"]) modifyPayload["urls-3"] = req.body["urls-3"];
        if (req.body["urls-4"]) modifyPayload["urls-4"] = req.body["urls-4"];
        if (req.body["urls-5"]) modifyPayload["urls-5"] = req.body["urls-5"];
        if (req.body["urls-6"]) modifyPayload["urls-6"] = req.body["urls-6"];
        if (req.body["urls-7"]) modifyPayload["urls-7"] = req.body["urls-7"];
        if (req.body["urls-8"]) modifyPayload["urls-8"] = req.body["urls-8"];
        if (req.body["urls-9"]) modifyPayload["urls-9"] = req.body["urls-9"];
        if (req.body["urls-10"]) modifyPayload["urls-10"] = req.body["urls-10"];
        if (req.body["urls-11"]) modifyPayload["urls-11"] = req.body["urls-11"];

        // Handle URL mapping from simplified format
        if (req.body.url) modifyPayload["urls-1"] = req.body.url;
        if (req.body.urls) {
          req.body.urls.forEach((url, index) => {
            if (index < 11 && url) {
              modifyPayload[`urls-${index + 1}`] = url;
            }
          });
        }

        if (req.body.traffic_type)
          modifyPayload.traffic_type = req.body.traffic_type;
        if (req.body.keywords) modifyPayload.keywords = req.body.keywords;
        if (req.body.referrers) modifyPayload.referrers = req.body.referrers;
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
        if (req.body.geo) {
          // Handle new geo format: array of objects with country and percent
          modifyPayload.geo = Array.isArray(req.body.geo)
            ? JSON.stringify(req.body.geo)
            : req.body.geo;
        }
        if (req.body.shortener) modifyPayload.shortener = req.body.shortener;
        if (req.body.rss_feed) modifyPayload.rss_feed = req.body.rss_feed;
        if (req.body.ga_id) modifyPayload.ga_id = req.body.ga_id;

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

        logger.campaign("SparkTraffic campaign modified successfully", {
          userId: req.user.id,
          campaignId: c._id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          modifyPayload,
        });
      } catch (err) {
        logger.error("SparkTraffic modify API call failed", {
          userId: req.user.id,
          campaignId: c._id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          error: err.message,
          status: err.response?.status,
          responseData: err.response?.data,
        });
        vendorResp = { error: err.message };
      }
    }

    // Handle 9Hits campaigns
    if (c.nine_hits_campaign_id) {
      logger.campaign("Modifying 9Hits campaign", {
        userId: req.user.id,
        campaignId: c._id,
        nineHitsId: c.nine_hits_campaign_id,
        updateData: req.body,
      });

      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteUpdate({
          id: c.nine_hits_campaign_id,
          ...req.body,
        });
      } catch (err) {
        logger.error("9Hits modify API call failed", {
          userId: req.user.id,
          campaignId: c._id,
          nineHitsId: c.nine_hits_campaign_id,
          error: err.message,
        });
        vendorResp = { error: err.message };
      }
    }

    await c.save();

    logger.campaign("Campaign modified", {
      userId: req.user.id,
      campaignId: c._id,
    });

    // Clean vendor response to avoid circular reference issues
    const cleanVendorResp =
      vendorResp && vendorResp.data
        ? vendorResp.data
        : vendorResp && vendorResp.error
        ? { error: vendorResp.error }
        : vendorResp;

    // Return response with clean campaign data
    const cleanCampaign = createCleanCampaignResponse(c);

    if (cleanVendorResp && cleanVendorResp.status === "ok") {
      res.json({
        status: "ok",
        campaign: cleanCampaign,
        message: "Campaign updated successfully",
      });
    } else {
      res.json({
        ok: true,
        campaign: cleanCampaign,
        message: "Campaign updated successfully",
      });
    }
  } catch (err) {
    logger.error("Campaign modify failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Archive campaign (soft delete)
router.delete("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for archive", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized archive attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // If already archived, check if eligible for permanent deletion
    if (c.is_archived && c.delete_eligible) {
      // Permanently delete the campaign
      await c.deleteOne();

      logger.campaign("Campaign permanently deleted", {
        userId: req.user.id,
        campaignId: c._id,
      });

      return res.json({
        ok: true,
        message: "Campaign permanently deleted",
        action: "permanent_delete",
      });
    }

    // Pause campaign on vendor by setting speed to 0 (archive process)
    let vendorResp = null;

    // Handle SparkTraffic campaigns
    if (c.spark_traffic_project_id) {
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
        logger.campaign("Campaign archived on SparkTraffic", {
          userId: req.user.id,
          campaignId: c._id,
          vendor: "sparkTraffic",
        });
      } catch (err) {
        logger.error("SparkTraffic archive failed", {
          userId: req.user.id,
          campaignId: c._id,
          sparkTrafficProjectId: c.spark_traffic_project_id,
          error: err.message,
          status: err.response?.status,
          responseData: err.response?.data,
        });
        vendorResp = {
          error: err.message,
          status: err.response?.status,
          apiResponse: err.response?.data,
        };
      }
    }

    // Handle 9Hits campaigns
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.sitePause({ id: c.nine_hits_campaign_id });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }

    // Archive the campaign
    c.is_archived = true;
    c.archived_at = new Date();
    c.state = "archived";
    await c.save();

    logger.campaign("Campaign archived", {
      userId: req.user.id,
      campaignId: c._id,
    });

    res.json({
      ok: true,
      message:
        "Campaign archived successfully. Will be permanently deleted after 7 days.",
      campaign: c,
      vendorResp:
        vendorResp && vendorResp.data
          ? vendorResp.data
          : vendorResp && vendorResp.error
          ? { error: vendorResp.error }
          : vendorResp,
      action: "archived",
    });
  } catch (err) {
    logger.error("Campaign archive failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Restore archived campaign
router.post("/:id/restore", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for restore", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized restore attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!c.is_archived) {
      return res.status(400).json({ error: "Campaign is not archived" });
    }

    if (c.delete_eligible) {
      return res.status(400).json({
        error: "Campaign is eligible for deletion and cannot be restored",
      });
    }

    // Restore the campaign
    c.is_archived = false;
    c.archived_at = null;
    c.state = "paused"; // Restore in paused state for safety
    await c.save();

    logger.campaign("Campaign restored", {
      userId: req.user.id,
      campaignId: c._id,
    });

    res.json({
      ok: true,
      message:
        "Campaign restored successfully. Use resume endpoint to activate.",
      campaign: c,
      action: "restored",
    });
  } catch (err) {
    logger.error("Campaign restore failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get campaign statistics (daily hits and visits report)
router.get("/:id/stats", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for stats", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized campaign stats access attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
        userRole: req.user.role,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    // Don't allow access to archived campaigns unless specifically requested
    if (c.is_archived && !req.query.include_archived) {
      logger.warn("Archived campaign stats access without flag", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Only SparkTraffic campaigns have stats API
    if (!c.spark_traffic_project_id) {
      logger.warn("Campaign stats requested for non-SparkTraffic campaign", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(400).json({
        error: "Statistics are only available for SparkTraffic campaigns",
      });
    }

    // Get date range from query parameters
    const from = req.query.from;
    const to = req.query.to;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !dateRegex.test(from)) {
      return res.status(400).json({
        error: "Invalid 'from' date format. Use YYYY-MM-DD (e.g., 2024-01-01)",
      });
    }
    if (to && !dateRegex.test(to)) {
      return res.status(400).json({
        error: "Invalid 'to' date format. Use YYYY-MM-DD (e.g., 2024-01-31)",
      });
    }

    // If no dates provided, default to last 30 days
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
        null, // POST with no body, params in query string
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

      logger.campaign("Campaign stats retrieved successfully", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
        dateRange: { from: fromDate, to: toDate },
      });

      res.json({
        ok: true,
        campaign: {
          id: c._id,
          title: c.title,
          spark_traffic_project_id: c.spark_traffic_project_id,
        },
        dateRange: {
          from: fromDate,
          to: toDate,
        },
        stats: statsResp.data,
      });
    } catch (err) {
      logger.error("SparkTraffic stats API failed", {
        userId: req.user.id,
        campaignId: c._id,
        sparkTrafficProjectId: c.spark_traffic_project_id,
        error: err.message,
        status: err.response?.status,
        responseData: err.response?.data,
        dateRange: { from: fromDate, to: toDate },
      });

      res.status(500).json({
        error: "Failed to fetch campaign statistics",
        details: err.message,
        status: err.response?.status,
        apiResponse: err.response?.data,
        dateRange: { from: fromDate, to: toDate },
      });
    }
  } catch (err) {
    logger.error("Get campaign stats failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Add credits to user (admin only)
router.post("/user/:userId/add-credits", auth("admin"), async (req, res) => {
  try {
    const { credits } = req.body;
    if (!credits || credits <= 0) {
      logger.warn("Invalid credits amount", {
        adminId: req.user.id,
        targetUserId: req.params.userId,
        credits,
      });
      return res.status(400).json({ error: "Invalid credits amount" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      logger.warn("User not found for credit addition", {
        adminId: req.user.id,
        targetUserId: req.params.userId,
      });
      return res.status(404).json({ error: "User not found" });
    }

    const oldCredits = user.credits;
    const oldHits = user.availableHits;
    const hitsToAdd = Math.floor(credits / 3);

    user.credits += credits;
    user.availableHits += hitsToAdd;
    await user.save();

    logger.campaign("Credits added", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      userEmail: user.email,
      creditsAdded: credits,
      hitsAdded: hitsToAdd,
    });

    res.json({
      ok: true,
      message: `Added ${credits} credits and ${hitsToAdd} hits to user`,
      user: {
        id: user._id,
        email: user.email,
        credits: user.credits,
        availableHits: user.availableHits,
      },
    });
  } catch (err) {
    logger.error("Add credits failed", {
      adminId: req.user.id,
      targetUserId: req.params.userId,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Manual credit deduction for specific campaign (admin only)
router.post("/:id/process-credits", auth("admin"), async (req, res) => {
  try {
    const result = await processSingleCampaignCredits(req.params.id);

    logger.campaign("Manual credit processing completed", {
      adminId: req.user.id,
      campaignId: req.params.id,
      result,
    });

    res.json({
      ok: true,
      message: "Credit processing completed",
      result,
    });
  } catch (err) {
    logger.error("Manual credit processing failed", {
      adminId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Test credit deduction for specific campaign (owner or admin)
router.post("/:id/test-credits", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id).populate(
      "user",
      "credits availableHits email"
    );
    if (!c) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get current stats from SparkTraffic to show current state
    let currentStats = null;
    let totalCurrentHits = 0;

    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      const now = new Date();
      const createdDate = c.createdAt
        ? c.createdAt.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];

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

      if (statsResp.data && Array.isArray(statsResp.data.hits)) {
        statsResp.data.hits.forEach((hitData) => {
          Object.values(hitData).forEach((count) => {
            totalCurrentHits += parseInt(count) || 0;
          });
        });
      }
      currentStats = statsResp.data;
    } catch (err) {
      logger.error("Failed to get current stats for test", {
        campaignId: c._id,
        error: err.message,
      });
    }

    // Calculate what would happen
    const totalHitsCounted = c.total_hits_counted || 0;
    const potentialNewHits = Math.max(0, totalCurrentHits - totalHitsCounted);

    // Actually process credits (this will only charge if there are new hits)
    const result = await processSingleCampaignCredits(req.params.id);

    logger.campaign("Test credit processing completed", {
      userId: req.user.id,
      campaignId: req.params.id,
      result,
      currentAnalysis: {
        totalCurrentHits,
        totalHitsCounted,
        potentialNewHits,
      },
    });

    res.json({
      ok: true,
      message: "Test credit processing completed",
      result,
      currentState: {
        totalCurrentHits,
        totalHitsCounted,
        potentialNewHits,
        lastStatsCheck: c.last_stats_check,
        creditDeductionEnabled: c.credit_deduction_enabled,
        userCredits: c.user.credits,
      },
      explanation:
        potentialNewHits === 0
          ? "No new hits since last automatic check. The system has already processed all current hits."
          : `${potentialNewHits} new hits detected and will be charged.`,
      info: "This endpoint shows current state and processes any new hits since last check",
    });
  } catch (err) {
    logger.error("Test credit processing failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to show campaign credit state without processing (owner or admin)
router.get("/:id/credit-debug", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id).populate(
      "user",
      "credits availableHits email"
    );
    if (!c) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user._id.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Get current stats from SparkTraffic with detailed date breakdown
    let totalCurrentHits = 0;
    let todayHits = 0;
    let currentStats = null;
    let sparkTrafficError = null;
    let dailyBreakdown = {};

    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const createdDate = c.createdAt
        ? c.createdAt.toISOString().split("T")[0]
        : today;

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
            to: today,
          },
        }
      );

      if (statsResp.data && Array.isArray(statsResp.data.hits)) {
        statsResp.data.hits.forEach((hitData) => {
          Object.keys(hitData).forEach((date) => {
            const count = parseInt(hitData[date]) || 0;
            dailyBreakdown[date] = count;
            totalCurrentHits += count;
            if (date === today) {
              todayHits += count;
            }
          });
        });
      }
      currentStats = statsResp.data;
    } catch (err) {
      logger.error("Failed to get current stats for debug", {
        campaignId: c._id,
        error: err.message,
        status: err.response?.status,
        responseData: err.response?.data,
      });
      sparkTrafficError = {
        message: err.message,
        status: err.response?.status,
        response: err.response?.data,
      };
    }

    const totalHitsCounted = c.total_hits_counted || 0;
    const potentialNewHits = Math.max(0, totalCurrentHits - totalHitsCounted);

    res.json({
      ok: true,
      campaign: {
        id: c._id,
        title: c.title,
        spark_traffic_project_id: c.spark_traffic_project_id,
        createdAt: c.createdAt,
        last_stats_check: c.last_stats_check,
        total_hits_counted: c.total_hits_counted,
        credit_deduction_enabled: c.credit_deduction_enabled,
      },
      user: {
        id: c.user._id,
        email: c.user.email,
        credits: c.user.credits,
        availableHits: c.user.availableHits,
      },
      currentStats: {
        totalCurrentHits,
        todayHits,
        totalHitsCounted,
        potentialNewHits,
        dailyBreakdown,
        dateRange: {
          from: c.createdAt
            ? c.createdAt.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          to: new Date().toISOString().split("T")[0],
        },
        rawSparkTrafficData: currentStats,
        sparkTrafficError: sparkTrafficError,
      },
      analysis: {
        status: potentialNewHits > 0 ? "NEW_HITS_AVAILABLE" : "NO_NEW_HITS",
        nextChargeAmount: potentialNewHits * 1, // 1 credit per hit
        explanation:
          potentialNewHits === 0
            ? "All current hits have been processed. Wait for more traffic or check if automatic system is working."
            : `${potentialNewHits} new hits ready to be charged (${potentialNewHits} credits).`,
        dateRangeExplanation: `Total hits counted (${totalHitsCounted}) covers the full date range from campaign creation. Today's hits: ${todayHits}. Full range total: ${totalCurrentHits}.`,
      },
      info: "Debug endpoint - shows current state without processing any charges",
    });
  } catch (err) {
    logger.error("Credit debug failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Process all campaigns credits (admin only)
router.post("/admin/process-all-credits", auth("admin"), async (req, res) => {
  try {
    const result = await processAllCampaignCredits();

    logger.campaign("Manual bulk credit processing completed", {
      adminId: req.user.id,
      result,
    });

    res.json({
      ok: true,
      message: "Bulk credit processing completed",
      result,
    });
  } catch (err) {
    logger.error("Manual bulk credit processing failed", {
      adminId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Toggle credit deduction for a campaign
router.post("/:id/toggle-credit-deduction", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      logger.warn("Campaign not found for credit deduction toggle", {
        userId: req.user.id,
        campaignId: req.params.id,
      });
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      logger.warn("Unauthorized credit deduction toggle attempt", {
        userId: req.user.id,
        campaignId: req.params.id,
        campaignOwner: c.user.toString(),
        userRole: req.user.role,
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    const newState = !c.credit_deduction_enabled;
    c.credit_deduction_enabled = newState;
    await c.save();

    logger.campaign("Credit deduction toggled", {
      userId: req.user.id,
      campaignId: c._id,
      previousState: !newState,
      newState: newState,
    });

    res.json({
      ok: true,
      message: `Credit deduction ${newState ? "enabled" : "disabled"}`,
      campaign: {
        id: c._id,
        title: c.title,
        credit_deduction_enabled: c.credit_deduction_enabled,
      },
    });
  } catch (err) {
    logger.error("Credit deduction toggle failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Reset campaign hit counter (owner or admin) - for debugging
router.post("/:id/reset-hit-counter", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Reset the hit counter to current SparkTraffic total
    let totalCurrentHits = 0;
    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      const now = new Date();
      const createdDate = c.createdAt
        ? c.createdAt.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];

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

      if (statsResp.data && Array.isArray(statsResp.data.hits)) {
        statsResp.data.hits.forEach((hitData) => {
          Object.values(hitData).forEach((count) => {
            totalCurrentHits += parseInt(count) || 0;
          });
        });
      }
    } catch (err) {
      logger.error("Failed to get current stats for reset", {
        campaignId: c._id,
        error: err.message,
      });
      return res.status(500).json({
        error: "Failed to fetch current stats from SparkTraffic",
        details: err.message,
      });
    }

    const oldTotal = c.total_hits_counted || 0;
    c.total_hits_counted = totalCurrentHits;
    c.last_stats_check = new Date();
    await c.save();

    logger.campaign("Hit counter reset", {
      userId: req.user.id,
      campaignId: c._id,
      oldTotal,
      newTotal: totalCurrentHits,
    });

    res.json({
      ok: true,
      message: "Hit counter reset successfully",
      campaign: {
        id: c._id,
        title: c.title,
      },
      changes: {
        oldTotal,
        newTotal: totalCurrentHits,
        difference: totalCurrentHits - oldTotal,
      },
      info: "The hit counter has been synchronized with current SparkTraffic data. Future hits will be properly tracked.",
    });
  } catch (err) {
    logger.error("Hit counter reset failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Reset campaign counters (both hits and visits) - for debugging inflated counts
router.post("/:id/reset-counters", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (c.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Reset both hit and visit counters to current SparkTraffic totals
    let totalCurrentHits = 0;
    let totalCurrentVisits = 0;

    try {
      const axios = require("axios");
      const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
      const now = new Date();
      const createdDate = c.createdAt
        ? c.createdAt.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];

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

      // Calculate total hits
      if (statsResp.data && Array.isArray(statsResp.data.hits)) {
        statsResp.data.hits.forEach((hitData) => {
          Object.values(hitData).forEach((count) => {
            totalCurrentHits += parseInt(count) || 0;
          });
        });
      }

      // Calculate total visits
      if (statsResp.data && Array.isArray(statsResp.data.visits)) {
        statsResp.data.visits.forEach((visitData) => {
          Object.values(visitData).forEach((count) => {
            totalCurrentVisits += parseInt(count) || 0;
          });
        });
      }
    } catch (err) {
      logger.error("Failed to get current stats for reset", {
        campaignId: c._id,
        error: err.message,
      });
      return res.status(500).json({
        error: "Failed to fetch current stats from SparkTraffic",
        details: err.message,
      });
    }

    const oldHitsTotal = c.total_hits_counted || 0;
    const oldVisitsTotal = c.total_visits_counted || 0;

    c.total_hits_counted = totalCurrentHits;
    c.total_visits_counted = totalCurrentVisits;
    c.last_stats_check = new Date();
    await c.save();

    logger.campaign("Hit and visit counters reset", {
      userId: req.user.id,
      campaignId: c._id,
      oldHitsTotal,
      newHitsTotal: totalCurrentHits,
      oldVisitsTotal,
      newVisitsTotal: totalCurrentVisits,
    });

    res.json({
      ok: true,
      message: "Hit and visit counters reset successfully",
      campaign: {
        id: c._id,
        title: c.title,
      },
      changes: {
        hits: {
          old: oldHitsTotal,
          new: totalCurrentHits,
          difference: totalCurrentHits - oldHitsTotal,
        },
        visits: {
          old: oldVisitsTotal,
          new: totalCurrentVisits,
          difference: totalCurrentVisits - oldVisitsTotal,
        },
      },
      info: "Both hit and visit counters have been synchronized with current SparkTraffic data. The inflated visit count issue has been fixed.",
    });
  } catch (err) {
    logger.error("Counter reset failed", {
      userId: req.user.id,
      campaignId: req.params.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

// Migrate existing campaigns to new geo format (admin only)
router.post("/admin/migrate-geo-format", auth("admin"), async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      countries: { $exists: true, $not: { $size: 0 } },
    });

    let migratedCount = 0;
    let skippedCount = 0;
    let errors = [];

    for (const campaign of campaigns) {
      try {
        // Check if countries is already in new format
        if (
          Array.isArray(campaign.countries) &&
          campaign.countries.length > 0
        ) {
          const firstItem = campaign.countries[0];

          // If it's already in new format (has country and percent), skip
          if (
            typeof firstItem === "object" &&
            firstItem.country &&
            firstItem.percent !== undefined
          ) {
            skippedCount++;
            continue;
          }

          // If it's old format (array of strings), convert to empty array for now
          if (typeof firstItem === "string") {
            campaign.countries = []; // Reset to empty array - users can set new geo targeting
            await campaign.save();
            migratedCount++;
            logger.campaign("Campaign geo format migrated", {
              campaignId: campaign._id,
              oldFormat: "string_array",
              newFormat: "empty_array",
            });
          }
        }
      } catch (err) {
        errors.push({
          campaignId: campaign._id,
          error: err.message,
        });
        logger.error("Failed to migrate campaign geo format", {
          campaignId: campaign._id,
          error: err.message,
        });
      }
    }

    logger.campaign("Geo format migration completed", {
      adminId: req.user.id,
      totalCampaigns: campaigns.length,
      migratedCount,
      skippedCount,
      errorsCount: errors.length,
    });

    res.json({
      ok: true,
      message: "Geo format migration completed",
      results: {
        totalCampaigns: campaigns.length,
        migratedCount,
        skippedCount,
        errorsCount: errors.length,
        errors: errors.slice(0, 10), // Show first 10 errors only
      },
      info: "Old string-based geo targeting has been reset. Users should configure new geo targeting with country/percent format.",
    });
  } catch (err) {
    logger.error("Geo format migration failed", {
      adminId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
