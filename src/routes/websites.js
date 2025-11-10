const express = require("express");
const { requireRole } = require("../middleware/auth");
const Website = require("../models/Website");
const router = express.Router();

// Add a new website for the logged-in user
router.post("/", requireRole(), async (req, res) => {
  try {
    const { url, title, description, metadata } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    const website = new Website({
      user: req.user.id,
      url,
      title,
      description,
      metadata,
    });
    await website.save();
    res.json({ ok: true, website });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all websites for the logged-in user
router.get("/", requireRole(), async (req, res) => {
  try {
    const websites = await Website.find({ user: req.user.id });
    res.json({ websites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
