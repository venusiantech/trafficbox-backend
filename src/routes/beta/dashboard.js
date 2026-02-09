const express = require("express");
const { requireRole } = require("../../middleware/auth");
const logger = require("../../utils/logger");

const router = express.Router();

/**
 * Placeholder for Beta (9hits) Dashboard
 *
 * This file will contain:
 * - GET /api/beta/dashboard - Dashboard overview
 * - GET /api/beta/dashboard/stats - Statistics
 */

// Placeholder - to be implemented
router.get("/", requireRole(), async (req, res) => {
  res.json({
    ok: true,
    message: "9hits dashboard endpoints coming soon",
  });
});

module.exports = router;
