const express = require("express");
const { requireRole } = require("../middleware/auth");
const nine = require("../services/nineHits");
const router = express.Router();

router.get("/", requireRole(), async (req, res) => {
  try {
    const profile = await nine.profileGet();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
