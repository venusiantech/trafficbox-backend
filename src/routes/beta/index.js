const express = require("express");

const router = express.Router();

// Import all beta sub-modules
const profileRouter = require("./profile");
const campaignsRouter = require("./campaigns"); // Now a folder with index.js
const dashboardRouter = require("./dashboard");
const trafficRouter = require("./traffic");

// Mount sub-routers
router.use("/profile", profileRouter);
router.use("/campaigns", campaignsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/traffic", trafficRouter);

module.exports = router;
