const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const vendors = require("../services/vendors");

const router = express.Router();

// Create campaign -> siteAdd
router.post("/", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;
    const vendorName = body.vendor || "sparkTraffic";
    const vendor = vendors[vendorName];
    if (!vendor) return res.status(400).json({ error: "Invalid vendor" });

    // Basic validation
    if (!body.url || typeof body.url !== "string" || !body.url.trim())
      return res.status(400).json({ error: "url required" });

    // Check user's available hits before creating campaign
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const requiredHits = body.maxHits || 5; // Default to 5 hits if not specified
    if (user.availableHits < requiredHits) {
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
        speed: merged.speed || 0,
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
        geo: merged.geo && merged.geo.codes ? merged.geo.codes.join(",") : "",
        shortener: merged.shortener || "",
        rss_feed: merged.rss_feed || "",
        ga_id: merged.ga_id || "",
      };
      try {
        const vendorResp = await vendor.createProject(sparkPayload);
        console.log(
          "SparkTraffic createProject response:",
          JSON.stringify(vendorResp, null, 2)
        );

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
        // Save to DB
        const camp = new Campaign({
          user: userId,
          title: sparkPayload.title,
          urls: merged.urls,
          duration_min: merged.duration[0],
          duration_max: merged.duration[1],
          countries: merged.geo.codes,
          rule: merged.geo.rule,
          macros: merged.macros,
          is_adult: merged.is_adult,
          is_coin_mining: merged.is_coin_mining,
          spark_traffic_project_id:
            vendorResp["new-id"] || vendorResp.id || vendorResp.project_id,
          state: "created",
          metadata: body.metadata,
          spark_traffic_data: vendorResp,
        });
        console.log(
          "Saving campaign with spark_traffic_project_id:",
          vendorResp["new-id"] || vendorResp.id || vendorResp.project_id
        );
        await camp.save();

        // Deduct hits from user after successful campaign creation
        user.availableHits -= requiredHits;
        await user.save();

        return res.json({
          ok: true,
          campaign: camp,
          vendorRaw: vendorResp,
          resumeRaw:
            resumeResp && resumeResp.data ? resumeResp.data : resumeResp,
          userStats: {
            hitsDeducted: requiredHits,
            remainingHits: user.availableHits,
          },
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

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

    console.log(
      "Payload being sent to vendor:",
      JSON.stringify(payload, null, 2)
    );

    // idempotency key
    const idempotencyKey = await vendor.getUuidV4();
    const vendorResp = await vendor.createCampaign(payload, idempotencyKey);
    console.log("Vendor createCampaign response:", vendorResp);
    // Try to extract vendorId from data.id or from messages (e.g., 'Created #40633533')
    let vendorId =
      (vendorResp && vendorResp.data && vendorResp.data.id) || null;
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
        if (
          detailsResp &&
          Array.isArray(detailsResp.data) &&
          detailsResp.data.length > 0
        ) {
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
      campaign: camp,
      vendorRaw: vendorResp,
      userStats: {
        hitsDeducted: requiredHits,
        remainingHits: user.availableHits,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get campaign
router.get("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    // Don't allow access to archived campaigns unless specifically requested
    if (c.is_archived && !req.query.include_archived) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Fetch vendor stats if possible
    let vendorStats = null;
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        const statsResp = await nine.siteGet({ id: c.nine_hits_campaign_id });
        vendorStats = statsResp;
      } catch (err) {
        vendorStats = {
          error: "Failed to fetch vendor stats",
          details: err.message,
        };
      }
    }

    res.json({ ...c.toObject(), vendorStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post("/:id/pause", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    console.log("Campaign data:", {
      id: c._id,
      spark_traffic_project_id: c.spark_traffic_project_id,
      nine_hits_campaign_id: c.nine_hits_campaign_id,
      title: c.title,
      state: c.state,
    });

    let vendorResp = null;
    if (c.spark_traffic_project_id) {
      console.log(
        "Found SparkTraffic project ID, attempting to pause:",
        c.spark_traffic_project_id
      );
      try {
        // Pause by setting speed to 0
        const axios = require("axios");
        const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
        vendorResp = await axios.post(
          "https://v2.sparktraffic.com/edit-website-traffic-project",
          {
            id: c.spark_traffic_project_id,
            speed: 0,
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
      c.state = "paused";
      await c.save();
      return res.json({
        ok: true,
        campaign: c,
        vendorResp:
          vendorResp && vendorResp.data ? vendorResp.data : vendorResp,
      });
    }
    // ...existing code for 9Hits...
    let nineResp = null;
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        nineResp = await nine.sitePause({ id: c.nine_hits_campaign_id });
      } catch (err) {
        nineResp = { error: err.message };
      }
      c.state = "paused";
      await c.save();
      return res.json({ ok: true, campaign: c, vendorResp: nineResp });
    }
    res.status(400).json({ error: "No vendor campaign id found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resume campaign
router.post("/:id/resume", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    // Resume on vendor if possible
    let vendorResp = null;
    if (c.spark_traffic_project_id) {
      try {
        // Resume by setting speed to 100 (or any positive value)
        const axios = require("axios");
        const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
        vendorResp = await axios.post(
          "https://v2.sparktraffic.com/edit-website-traffic-project",
          {
            id: c.spark_traffic_project_id,
            speed: 200,
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
      c.state = "ok";
      c.userState = "running";
      await c.save();
      return res.json({
        ok: true,
        campaign: c,
        vendorResp:
          vendorResp && vendorResp.data ? vendorResp.data : vendorResp,
      });
    }
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteUpdate({
          id: c.nine_hits_campaign_id,
          userState: "running",
        });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }
    c.state = "ok";
    c.userState = "running";
    await c.save();
    res.json({ ok: true, campaign: c, vendorResp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update campaign
router.put("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

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
    updatable.forEach((f) => {
      if (req.body[f] !== undefined) c[f] = req.body[f];
    });

    // Update on vendor if possible
    let vendorResp = null;
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteUpdate({
          id: c.nine_hits_campaign_id,
          ...req.body,
        });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }
    await c.save();
    res.json({ ok: true, campaign: c, vendorResp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive campaign (soft delete)
router.delete("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    // If already archived, check if eligible for permanent deletion
    if (c.is_archived && c.delete_eligible) {
      // Permanently delete the campaign
      await c.deleteOne();
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
          "https://v2.sparktraffic.com/edit-website-traffic-project",
          {
            id: c.spark_traffic_project_id,
            speed: 0,
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

    res.json({
      ok: true,
      message:
        "Campaign archived successfully. Will be permanently deleted after 7 days.",
      campaign: c,
      vendorResp: vendorResp && vendorResp.data ? vendorResp.data : vendorResp,
      action: "archived",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore archived campaign
router.post("/:id/restore", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    if (!c.is_archived) {
      return res.status(400).json({ error: "Campaign is not archived" });
    }

    if (c.delete_eligible) {
      return res
        .status(400)
        .json({
          error: "Campaign is eligible for deletion and cannot be restored",
        });
    }

    // Restore the campaign
    c.is_archived = false;
    c.archived_at = null;
    c.state = "paused"; // Restore in paused state for safety
    await c.save();

    res.json({
      ok: true,
      message:
        "Campaign restored successfully. Use resume endpoint to activate.",
      campaign: c,
      action: "restored",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get archived campaigns
router.get("/archived", auth(), async (req, res) => {
  try {
    const archivedCampaigns = await Campaign.find({
      user: req.user.id,
      is_archived: true,
    }).sort({ archived_at: -1 });

    res.json({
      ok: true,
      campaigns: archivedCampaigns,
      count: archivedCampaigns.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user stats (credits and available hits)
router.get("/user/stats", auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "credits availableHits email firstName lastName"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

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
    res.status(500).json({ error: err.message });
  }
});

// Add credits to user (admin only)
router.post("/user/:userId/add-credits", auth("admin"), async (req, res) => {
  try {
    const { credits } = req.body;
    if (!credits || credits <= 0) {
      return res.status(400).json({ error: "Invalid credits amount" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.credits += credits;
    user.availableHits += Math.floor(credits / 3); // Convert credits to hits (credits/3)
    await user.save();

    res.json({
      ok: true,
      message: `Added ${credits} credits and ${Math.floor(
        credits / 3
      )} hits to user`,
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

module.exports = router;
