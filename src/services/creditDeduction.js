const axios = require("axios");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Checks for new hits and deducts credits for SparkTraffic campaigns
 * This function is called by the sync worker every 5 seconds
 */
async function processAllCampaignCredits() {
  try {
    logger.info("Starting credit deduction process for all campaigns");

    // Find all active SparkTraffic campaigns that have credit deduction enabled
    const campaigns = await Campaign.find({
      spark_traffic_project_id: { $exists: true, $ne: null },
      credit_deduction_enabled: { $ne: false },
      is_archived: { $ne: true },
      state: { $nin: ["archived", "deleted"] },
    }).populate("user", "credits availableHits email");

    logger.info(
      `Found ${campaigns.length} campaigns to process for credit deduction`
    );

    let totalProcessed = 0;
    let totalErrors = 0;
    let totalCreditsDeducted = 0;

    for (const campaign of campaigns) {
      try {
        const result = await processCampaignCredits(campaign);
        if (result.success) {
          totalProcessed++;
          totalCreditsDeducted += result.creditsDeducted || 0;
        }
      } catch (error) {
        totalErrors++;
        logger.error("Failed to process campaign credits", {
          campaignId: campaign._id,
          sparkTrafficProjectId: campaign.spark_traffic_project_id,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    logger.info("Credit deduction process completed", {
      totalCampaigns: campaigns.length,
      totalProcessed,
      totalErrors,
      totalCreditsDeducted,
    });

    return {
      totalCampaigns: campaigns.length,
      totalProcessed,
      totalErrors,
      totalCreditsDeducted,
    };
  } catch (error) {
    logger.error("Credit deduction process failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Processes credit deduction for a single campaign
 * @param {Object} campaign - Campaign document with populated user
 * @returns {Object} - Result of the processing
 */
async function processCampaignCredits(campaign) {
  try {
    const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
    if (!API_KEY) {
      throw new Error("SparkTraffic API key not configured");
    }

    // Determine the date range for checking stats
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    // If this is the first check, start from yesterday to avoid missing data
    let fromDate;
    if (!campaign.last_stats_check) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      fromDate = yesterday.toISOString().split("T")[0];
    } else {
      // Start from the last check date to avoid double counting
      fromDate = campaign.last_stats_check.toISOString().split("T")[0];
    }

    logger.debug("Processing campaign credits", {
      campaignId: campaign._id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      dateRange: { from: fromDate, to: currentDate },
      lastStatsCheck: campaign.last_stats_check,
      totalHitsCounted: campaign.total_hits_counted || 0,
    });

    // Call SparkTraffic stats API
    const statsResp = await axios.post(
      "https://v2.sparktraffic.com/get-website-traffic-project-stats",
      null,
      {
        headers: {
          "Content-Type": "application/json",
          API_KEY,
        },
        params: {
          unique_id: campaign.spark_traffic_project_id,
          from: fromDate,
          to: currentDate,
        },
      }
    );

    if (!statsResp.data || !statsResp.data.hits) {
      logger.warn("No stats data received from SparkTraffic", {
        campaignId: campaign._id,
        sparkTrafficProjectId: campaign.spark_traffic_project_id,
        response: statsResp.data,
      });

      // Update last check time even if no data received
      campaign.last_stats_check = now;
      await campaign.save();

      return { success: true, creditsDeducted: 0, message: "No stats data" };
    }

    // Calculate total hits from the response
    let totalHitsInPeriod = 0;
    let totalVisitsInPeriod = 0;

    if (Array.isArray(statsResp.data.hits)) {
      statsResp.data.hits.forEach((hitData) => {
        Object.values(hitData).forEach((count) => {
          totalHitsInPeriod += parseInt(count) || 0;
        });
      });
    }

    if (Array.isArray(statsResp.data.visits)) {
      statsResp.data.visits.forEach((visitData) => {
        Object.values(visitData).forEach((count) => {
          totalVisitsInPeriod += parseInt(count) || 0;
        });
      });
    }

    // Calculate new hits since last check
    const previousHitsCounted = campaign.total_hits_counted || 0;

    // For the first check, we need to get the total hits from a longer period to establish baseline
    let actualNewHits = 0;

    if (!campaign.last_stats_check) {
      // First check: Get total hits from inception and set as baseline
      // We'll call the API with a longer date range to get total hits
      try {
        const createdDate = campaign.createdAt
          ? campaign.createdAt.toISOString().split("T")[0]
          : fromDate;
        const totalStatsResp = await axios.post(
          "https://v2.sparktraffic.com/get-website-traffic-project-stats",
          null,
          {
            headers: {
              "Content-Type": "application/json",
              API_KEY,
            },
            params: {
              unique_id: campaign.spark_traffic_project_id,
              from: createdDate,
              to: currentDate,
            },
          }
        );

        let totalHitsEver = 0;
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.hits)) {
          totalStatsResp.data.hits.forEach((hitData) => {
            Object.values(hitData).forEach((count) => {
              totalHitsEver += parseInt(count) || 0;
            });
          });
        }

        // For first check, don't charge for any historical hits
        // Just set the baseline for future comparisons
        actualNewHits = 0;
        campaign.total_hits_counted = totalHitsEver;

        logger.debug("First check - establishing baseline", {
          campaignId: campaign._id,
          totalHitsEver,
          baselineSet: totalHitsEver,
          chargedHits: 0,
        });
      } catch (err) {
        logger.error("Failed to get total hits for baseline", {
          campaignId: campaign._id,
          error: err.message,
        });
        // Fallback: use current period total as baseline
        actualNewHits = 0;
        campaign.total_hits_counted = totalHitsInPeriod;
      }
    } else {
      // Subsequent checks: Calculate new hits since last check
      // Get total hits from campaign creation to now
      const createdDate = campaign.createdAt
        ? campaign.createdAt.toISOString().split("T")[0]
        : fromDate;
      try {
        const totalStatsResp = await axios.post(
          "https://v2.sparktraffic.com/get-website-traffic-project-stats",
          null,
          {
            headers: {
              "Content-Type": "application/json",
              API_KEY,
            },
            params: {
              unique_id: campaign.spark_traffic_project_id,
              from: createdDate,
              to: currentDate,
            },
          }
        );

        let totalHitsEver = 0;
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.hits)) {
          totalStatsResp.data.hits.forEach((hitData) => {
            Object.values(hitData).forEach((count) => {
              totalHitsEver += parseInt(count) || 0;
            });
          });
        }

        // Calculate new hits = total hits ever - previously counted hits
        actualNewHits = Math.max(0, totalHitsEver - previousHitsCounted);

        logger.debug("Subsequent check - calculating new hits", {
          campaignId: campaign._id,
          totalHitsEver,
          previousHitsCounted,
          actualNewHits,
        });
      } catch (err) {
        logger.error("Failed to get total hits for comparison", {
          campaignId: campaign._id,
          error: err.message,
        });
        // Fallback: no charge if we can't get accurate data
        actualNewHits = 0;
      }
    }

    logger.debug("Credit calculation details", {
      campaignId: campaign._id,
      totalHitsInPeriod,
      previousHitsCounted,
      actualNewHits,
      isFirstCheck: !campaign.last_stats_check,
    });

    if (actualNewHits > 0) {
      // Deduct credits based on new hits (1 credit per hit as an example)
      const creditsToDeduct = actualNewHits * 1; // You can adjust the rate here

      // Check if user has enough credits
      if (campaign.user.credits < creditsToDeduct) {
        logger.warn("Insufficient credits for deduction", {
          campaignId: campaign._id,
          userId: campaign.user._id,
          userEmail: campaign.user.email,
          creditsToDeduct,
          availableCredits: campaign.user.credits,
          newHits: actualNewHits,
        });

        // Optionally pause the campaign if insufficient credits
        campaign.state = "paused";
        campaign.credit_deduction_enabled = false;
        await campaign.save();

        return {
          success: true,
          creditsDeducted: 0,
          message: "Insufficient credits - campaign paused",
          newHits: actualNewHits,
        };
      }

      // Deduct credits from user
      campaign.user.credits -= creditsToDeduct;

      // Also deduct hits from availableHits (1 hit per credit deducted)
      campaign.user.availableHits -= actualNewHits;

      await campaign.user.save();

      // Update campaign tracking - add the new hits to the total counted
      const newTotalCounted =
        (campaign.total_hits_counted || 0) + actualNewHits;
      campaign.total_hits_counted = newTotalCounted;
      campaign.total_visits_counted =
        (campaign.total_visits_counted || 0) + totalVisitsInPeriod;
      campaign.last_stats_check = now;
      await campaign.save();

      logger.info("Credits and hits deducted successfully", {
        campaignId: campaign._id,
        userId: campaign.user._id,
        userEmail: campaign.user.email,
        newHits: actualNewHits,
        creditsDeducted: creditsToDeduct,
        hitsDeducted: actualNewHits,
        remainingCredits: campaign.user.credits,
        remainingHits: campaign.user.availableHits,
        totalHitsCounted: campaign.total_hits_counted,
      });

      return {
        success: true,
        creditsDeducted: creditsToDeduct,
        hitsDeducted: actualNewHits,
        newHits: actualNewHits,
        message: `Deducted ${creditsToDeduct} credits and ${actualNewHits} hits for ${actualNewHits} new traffic hits`,
      };
    } else {
      // No new hits, just update the check time
      campaign.last_stats_check = now;
      await campaign.save();

      logger.debug("No new hits to charge for", {
        campaignId: campaign._id,
        totalHitsInPeriod,
        previousHitsCounted,
        actualNewHits,
      });

      return {
        success: true,
        creditsDeducted: 0,
        newHits: 0,
        message: "No new hits to charge",
      };
    }
  } catch (error) {
    logger.error("Failed to process campaign credits", {
      campaignId: campaign._id,
      sparkTrafficProjectId: campaign.spark_traffic_project_id,
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data,
    });

    // Update last check time even on error to prevent getting stuck
    campaign.last_stats_check = new Date();
    await campaign.save();

    throw error;
  }
}

/**
 * Manually trigger credit deduction for a specific campaign
 * @param {string} campaignId - Campaign ID to process
 * @returns {Object} - Result of the processing
 */
async function processSingleCampaignCredits(campaignId) {
  try {
    const campaign = await Campaign.findById(campaignId).populate(
      "user",
      "credits availableHits email"
    );

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!campaign.spark_traffic_project_id) {
      throw new Error("Campaign is not a SparkTraffic campaign");
    }

    return await processCampaignCredits(campaign);
  } catch (error) {
    logger.error("Failed to process single campaign credits", {
      campaignId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  processAllCampaignCredits,
  processCampaignCredits,
  processSingleCampaignCredits,
};
