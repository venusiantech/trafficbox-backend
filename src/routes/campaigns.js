const express = require("express");
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const getProvider = require("../services/provider/factory");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

router.post("/", auth(), async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
      return res.status(400).json({ error: "url required" });
    }

    // 🔹 Build a vendor-agnostic payload
    const payload = {
      title: body.title || `campaign-${Date.now()}`,
      urls: [body.url.trim()],
      duration_min: body.duration_min || 30,
      duration_max: body.duration_max || 60,
      countries: body.countries || [],
      metadata: body.metadata || {},
      is_adult: body.is_adult ?? false, // pass through if given
      is_coin_mining: body.is_coin_mining ?? false, // pass through if given
    };

    // 🔹 Pick provider (can later be dynamic per user/project)
    const provider = getProvider("ninehits");
    const idempotencyKey = uuidv4();

    // 🔹 Let provider handle mapping + API call
    const vendorResp = await provider.createCampaign(payload, idempotencyKey);

    const vendorId = vendorResp?.data?.id || null;

    // 🔹 Save campaign in local DB
    const camp = new Campaign({
      user: userId,
      title: payload.title,
      urls: payload.urls,
      duration_min: payload.duration_min,
      duration_max: payload.duration_max,
      countries: payload.countries,
      vendor: "ninehits",
      vendor_campaign_id: vendorId,
      metadata: payload.metadata,
      is_adult: payload.is_adult,
      is_coin_mining: payload.is_coin_mining,
    });

    await camp.save();
    res.json({ ok: true, campaign: camp, vendorResp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
