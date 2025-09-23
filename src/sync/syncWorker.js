const cron = require("node-cron");
const Campaign = require("../models/Campaign");
const nine = require("../services/nineHits");
const { cleanupArchivedCampaigns } = require("../utils/archiveCleanup");

module.exports = function () {
  // Main sync job
  const expression = process.env.SYNC_CRON || "*/5 * * * *";
  cron.schedule(expression, async () => {
    try {
      console.log("[sync] starting sync");
      const camps = await Campaign.find({
        nine_hits_campaign_id: { $ne: null },
      });
      for (const c of camps) {
        try {
          const resp = await nine.siteGet({ id: c.nine_hits_campaign_id });
          c.metadata = resp;
          c.last_sync_at = new Date();
          await c.save();
        } catch (e) {
          if (e.response) {
            console.error("[sync] campaign err", e.message);
            console.error("[sync] campaign id:", c.nine_hits_campaign_id);
            console.error("[sync] request url:", e.config && e.config.url);
            console.error(
              "[sync] request params:",
              e.config && e.config.params
            );
            console.error("[sync] response status:", e.response.status);
            console.error("[sync] response data:", e.response.data);
          } else {
            console.error("[sync] campaign err", e.message);
          }
        }
      }
      // Optionally pull sessionStats
      const stats = await nine.sessionStats();
      console.log("[sync] sessionStats fetched");
    } catch (e) {
      console.error("[sync] worker failed", e.message);
    }
  });

  // Archive cleanup job - runs daily at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("[cleanup] starting archive cleanup");
      const result = await cleanupArchivedCampaigns();
      if (result && result.modifiedCount > 0) {
        console.log(
          `[cleanup] marked ${result.modifiedCount} campaigns as eligible for deletion`
        );
      } else {
        console.log("[cleanup] no campaigns marked for deletion");
      }
    } catch (e) {
      console.error("[cleanup] archive cleanup failed", e.message);
    }
  });

  console.log("[sync] workers initialized");
};
