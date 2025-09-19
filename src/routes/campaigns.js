const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const vendors = require("../services/vendors");

const router = express.Router();

// Create campaign -> siteAdd
router.post("/", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;
    const vendorName = body.vendor || "nineHits";
    const vendor = vendors[vendorName];
    if (!vendor) return res.status(400).json({ error: "Invalid vendor" });

    // Basic validation
    if (!body.url || typeof body.url !== "string" || !body.url.trim())
      return res.status(400).json({ error: "url required" });

    // Ensure required fields have default values
    if (body.is_adult === undefined) body.is_adult = false;
    if (body.is_coin_mining === undefined) body.is_coin_mining = false;

    // Build payload (still 9Hits style for now, but can be extended per vendor)
    const payload = {
      title: body.title || `campaign-${Date.now()}`,
      urls: [body.url.trim()],
      duration: [body.duration_min || 30, body.duration_max || 60],
      geo: {
        rule: body.rule || "any",
        by: "country",
        codes: body.countries || [],
      },
      macros: body.macros || "",
      isAdult: body.is_adult === true,
      hasCoinMining: body.is_coin_mining === true,
    };
    if (body.popup_macros) payload.popupMacros = body.popup_macros;
    if (body.max_hits) payload.maxHits = body.max_hits;
    if (body.until_date) payload.untilDate = body.until_date;
    if (body.capping) payload.capping = body.capping;
    if (body.platform) payload.platform = body.platform;
    if (body.referrers) payload.referrers = body.referrers;
    if (body.connection_types) payload.connectionTypes = body.connection_types;
    if (body.connection_speed) payload.connectionSpeed = body.connection_speed;
    if (body.performance) payload.performance = body.performance;

    console.log(
      "Payload being sent to vendor:",
      JSON.stringify(payload, null, 2)
    );

    // idempotency key
    const idempotencyKey = await vendor.getUuidV4();
    const vendorResp = await vendor.createCampaign(payload, idempotencyKey);
    console.log("Vendor createCampaign response:", vendorResp);
    const vendorId =
      (vendorResp && vendorResp.data && vendorResp.data.id) || null;

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
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
