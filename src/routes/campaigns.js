const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const vendors = require("../services/vendors");

const router = express.Router();

// Create campaign -> siteAdd
router.post("/:vendor", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;
    const vendorName = req.params.vendor || "nineHits";
    const vendor = vendors[vendorName];
    if (!vendor) return res.status(400).json({ error: "Invalid vendor" });

    // Basic validation
    if (!body.url || typeof body.url !== "string" || !body.url.trim())
      return res.status(400).json({ error: "url required" });

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
      // Always use economy size
      const sparkPayload = {
        unique_id: merged.unique_id || undefined,
        created_at: merged.created_at || Date.now(),
        expires_at: merged.expires_at || 0,
        title: merged.title,
        size: "economy",
        multiplier: merged.multiplier || 0,
        speed: merged.speed || 0,
        "urls-1": merged.urls && merged.urls[0] ? merged.urls[0] : merged.url,
        "urls-2": merged.urls && merged.urls[1] ? merged.urls[1] : undefined,
        "urls-3": merged.urls && merged.urls[2] ? merged.urls[2] : undefined,
        "urls-4": merged.urls && merged.urls[3] ? merged.urls[3] : undefined,
        "urls-5": merged.urls && merged.urls[4] ? merged.urls[4] : undefined,
        "urls-6": merged.urls && merged.urls[5] ? merged.urls[5] : undefined,
        "urls-7": merged.urls && merged.urls[6] ? merged.urls[6] : undefined,
        "urls-8": merged.urls && merged.urls[7] ? merged.urls[7] : undefined,
        "urls-9": merged.urls && merged.urls[8] ? merged.urls[8] : undefined,
        "urls-10": merged.urls && merged.urls[9] ? merged.urls[9] : undefined,
        "urls-11": merged.urls && merged.urls[10] ? merged.urls[10] : undefined,
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
        console.log(vendorResp);
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
          spark_traffic_project_id: vendorResp["new-id"],
          state: "created",
          metadata: body.metadata,
          spark_traffic_data: vendorResp,
        });
        await camp.save();
        return res.json({ ok: true, campaign: camp, vendorRaw: vendorResp });
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
    res.json({ ok: true, campaign: camp, vendorRaw: vendorResp });
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

    // Pause on vendor if possible
    let vendorResp = null;
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.sitePause({ id: c.nine_hits_campaign_id });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }
    c.state = "paused";
    await c.save();
    res.json({ ok: true, campaign: c, vendorResp });
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

// Delete campaign
router.delete("/:id", auth(), async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    if (c.user.toString() !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    // Delete on vendor if possible
    let vendorResp = null;
    if (c.nine_hits_campaign_id) {
      try {
        const nine = require("../services/nineHits");
        vendorResp = await nine.siteDelete({ id: c.nine_hits_campaign_id });
      } catch (err) {
        vendorResp = { error: err.message };
      }
    }
    await c.deleteOne();
    res.json({ ok: true, vendorResp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all campaigns (admin only)
router.get("/", auth("admin"), async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.json({ ok: true, campaigns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
