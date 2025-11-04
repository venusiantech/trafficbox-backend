const cron = require("node-cron");
const Campaign = require("../models/Campaign");
const { processAllCampaignCredits } = require("../services/creditDeduction");
// const nine = require("../services/nineHits");
// const { cleanupArchivedCampaigns } = require("../utils/archiveCleanup");
const logger = require("../utils/logger");

module.exports = function () {
  // Credit deduction job - default every 5 minutes (env overridable)
  const creditDeductionExpression =
    process.env.CREDIT_DEDUCTION_CRON || "*/1 * * * *"; // Every 5 minutes
  cron.schedule(creditDeductionExpression, async () => {
    try {
      const result = await processAllCampaignCredits();

      if (result.totalCreditsDeducted > 0) {
        logger.info("Credits deducted from active campaigns", {
          activeCampaigns: result.totalCampaigns,
          creditsDeducted: result.totalCreditsDeducted,
        });
      }
    } catch (error) {
      logger.error("Credit deduction failed", {
        error: error.message,
      });
    }
  });

  // Archive cleanup job - runs daily at 2 AM (only for active campaigns)
  cron.schedule("0 2 * * *", async () => {
    try {
      // Mark ACTIVE campaigns archived for more than 7 days as eligible for deletion
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await Campaign.updateMany(
        {
          status: "active", // Only process active campaigns
          is_archived: true,
          archived_at: { $lte: sevenDaysAgo },
          delete_eligible: { $ne: true },
        },
        {
          delete_eligible: true,
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `Marked ${result.modifiedCount} active campaigns for deletion`
        );
      }
    } catch (error) {
      logger.error("Archive cleanup failed", {
        error: error.message,
      });
    }
  });

  logger.info("Sync workers initialized for active campaigns");
};
