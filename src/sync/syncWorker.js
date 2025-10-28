const cron = require("node-cron");
const Campaign = require("../models/Campaign");
const { processAllCampaignCredits } = require("../services/creditDeduction");
// const nine = require("../services/nineHits");
// const { cleanupArchivedCampaigns } = require("../utils/archiveCleanup");
const logger = require("../utils/logger");

module.exports = function () {
  // Credit deduction job - runs every 5 seconds
  const creditDeductionExpression =
    process.env.CREDIT_DEDUCTION_CRON || "*/5 * * * * *"; // Every 5 seconds
  cron.schedule(creditDeductionExpression, async () => {
    try {
      logger.info(
        "Starting automated credit deduction job for active campaigns"
      );
      const result = await processAllCampaignCredits();

      if (result.totalCreditsDeducted > 0) {
        logger.info("Credit deduction job completed successfully", {
          totalCampaigns: result.totalCampaigns,
          totalProcessed: result.totalProcessed,
          totalErrors: result.totalErrors,
          totalCreditsDeducted: result.totalCreditsDeducted,
        });
      } else {
        logger.debug("Credit deduction job completed - no credits deducted", {
          totalCampaigns: result.totalCampaigns,
          totalProcessed: result.totalProcessed,
          totalErrors: result.totalErrors,
        });
      }
    } catch (error) {
      logger.error("Automated credit deduction job failed", {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  // Archive cleanup job - runs daily at 2 AM (only for active campaigns)
  cron.schedule("0 2 * * *", async () => {
    try {
      logger.info("Starting archive cleanup job for active campaigns");

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
          `Marked ${result.modifiedCount} active campaigns as eligible for deletion`
        );
      } else {
        logger.info("No active campaigns marked for deletion");
      }
    } catch (error) {
      logger.error("Archive cleanup failed", {
        error: error.message,
        stack: error.stack,
      });
    }
  });

  logger.info("Sync workers initialized for active campaigns", {
    creditDeductionExpression,
    archiveCleanupExpression: "0 2 * * *",
  });
};
