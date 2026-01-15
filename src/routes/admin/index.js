const express = require("express");

const router = express.Router();

// Import all admin sub-modules
const dashboardRouter = require("./dashboard");
const usersRouter = require("./users");
const campaignsRouter = require("./campaigns");
const subscriptionsRouter = require("./subscriptions");
const analyticsRouter = require("./analytics");
const mailboxRouter = require("./mailbox");

// Mount sub-routers
router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);
router.use("/campaigns", campaignsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/analytics", analyticsRouter);
router.use("/mailbox", mailboxRouter);

module.exports = router;
