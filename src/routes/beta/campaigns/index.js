const express = require("express");

const router = express.Router();

// Import all campaign sub-modules
const getRouter = require("./get");
const createRouter = require("./create");
const updateRouter = require("./update");
const deleteRouter = require("./delete");

// Mount sub-routers
router.use("/", getRouter); // GET routes
router.use("/", createRouter); // POST /api/beta/campaigns (create)
router.use("/", updateRouter); // PUT routes
router.use("/", deleteRouter); // DELETE routes

module.exports = router;
