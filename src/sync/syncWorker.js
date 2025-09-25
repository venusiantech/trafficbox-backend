// const cron = require("node-cron");
// const Campaign = require("../models/Campaign");
// const nine = require("../services/nineHits");
// const { cleanupArchivedCampaigns } = require("../utils/archiveCleanup");
const logger = require("../utils/logger");

module.exports = function () {
  // NOTE: Sync worker disabled - focusing on SparkTraffic only
  // This sync worker only handles 9Hits campaigns, not SparkTraffic

  // Main sync job - COMMENTED OUT (9Hits only)
  // const expression = process.env.SYNC_CRON || "*/5 * * * *";
  // cron.schedule(expression, async () => {
  //   try {
  //     logger.sync("Starting sync job");
  //     const camps = await Campaign.find({
  //       nine_hits_campaign_id: { $ne: null },
  //     });
  //
  //     logger.sync(`Found ${camps.length} campaigns to sync`);
  //
  //     for (const c of camps) {
  //       try {
  //         logger.sync(`Syncing campaign ${c._id}`, {
  //           campaignId: c._id,
  //           nineHitsId: c.nine_hits_campaign_id,
  //           title: c.title
  //         });
  //
  //         const resp = await nine.siteGet({ id: c.nine_hits_campaign_id });
  //         c.metadata = resp;
  //         c.last_sync_at = new Date();
  //         await c.save();
  //
  //         logger.sync(`Successfully synced campaign ${c._id}`);
  //       } catch (e) {
  //         if (e.response) {
  //           logger.error("Campaign sync failed with HTTP error", {
  //             campaignId: c._id,
  //             nineHitsId: c.nine_hits_campaign_id,
  //             error: e.message,
  //             status: e.response.status,
  //             statusText: e.response.statusText,
  //             url: e.config?.url,
  //             params: e.config?.params,
  //             responseData: e.response.data
  //           });
  //         } else {
  //           logger.error("Campaign sync failed", {
  //             campaignId: c._id,
  //             nineHitsId: c.nine_hits_campaign_id,
  //             error: e.message,
  //             stack: e.stack
  //           });
  //         }
  //       }
  //     }
  //
  //     // Optionally pull sessionStats
  //     try {
  //       const stats = await nine.sessionStats();
  //       logger.sync("Session stats fetched successfully", { stats });
  //     } catch (e) {
  //       logger.error("Failed to fetch session stats", { error: e.message });
  //     }
  //   } catch (e) {
  //     logger.error("Sync worker failed", { error: e.message, stack: e.stack });
  //   }
  // });

  // Archive cleanup job - runs daily at 2 AM - COMMENTED OUT
  // cron.schedule("0 2 * * *", async () => {
  //   try {
  //     logger.info("Starting archive cleanup job");
  //     const result = await cleanupArchivedCampaigns();
  //     if (result && result.modifiedCount > 0) {
  //       logger.info(`Marked ${result.modifiedCount} campaigns as eligible for deletion`);
  //     } else {
  //       logger.info("No campaigns marked for deletion");
  //     }
  //   } catch (e) {
  //     logger.error("Archive cleanup failed", { error: e.message, stack: e.stack });
  //   }
  // });

  // logger.info("Sync workers initialized", { syncExpression: expression });

  logger.info("Sync workers disabled - SparkTraffic focus mode");
};
