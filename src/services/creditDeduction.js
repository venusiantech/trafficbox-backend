const axios = require("axios");
const http = require("http");
const https = require("https");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const logger = require("../utils/logger");

// Reusable axios instance with keep-alive to reduce socket churn
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const axiosInstance = axios.create({
  httpAgent: keepAliveHttpAgent,
  httpsAgent: keepAliveHttpsAgent,
  // default timeout; can be overridden per request
  timeout: 20000,
});

async function postWithRetry(url, data, config = {}, retryCfg = {}) {
  const {
    retries = 3,
    baseDelayMs = 2000,
    retryOnStatuses = [429, 500, 502, 503, 504],
  } = retryCfg;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axiosInstance.post(url, data, config);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const code = error.code;

      const isRetryableStatus = retryOnStatuses.includes(status);
      const isRetryableCode = [
        "ECONNRESET",
        "ECONNABORTED",
        "ETIMEDOUT",
        "EAI_AGAIN",
        "ENOTFOUND",
      ].includes(code);

      // Only retry on network errors / transient server errors
      if (!(isRetryableStatus || isRetryableCode)) {
        break;
      }

      // Backoff with jitter
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, delay + jitter));
      }
    }
  }
  throw lastError;
}

/**
 * Checks for new hits and deducts visits from subscription for SparkTraffic campaigns
 * This function is called by the sync worker every 5 seconds
 */
async function processAllCampaignCredits() {
  try {
    // Find all active SparkTraffic campaigns that have credit deduction enabled
    const campaigns = await Campaign.find({
      // Must be a SparkTraffic campaign
      spark_traffic_project_id: { $exists: true, $ne: null },
      // Credit deduction must be enabled
      credit_deduction_enabled: { $ne: false },
      // Exclude archived campaigns
      is_archived: { $ne: true },
      // Only process ACTIVE states (skip paused/stopped/deleted)
      state: { $in: ["created", "ok", "running"] },
    }).populate("user", "email");

    let totalProcessed = 0;
    let totalErrors = 0;
    let totalVisitsDeducted = 0;

    for (const campaign of campaigns) {
      try {
        const result = await processCampaignCredits(campaign);
        if (result.success) {
          totalProcessed++;
          totalVisitsDeducted += result.visitsDeducted || 0;
        }
      } catch (error) {
        totalErrors++;
        logger.error("Failed to process campaign visits deduction", {
          campaignId: campaign._id,
          sparkTrafficProjectId: campaign.spark_traffic_project_id,
          error: error.message,
        });
      }
    }

    logger.info("Subscription visit deduction process completed", {
      totalCampaigns: campaigns.length,
      totalProcessed,
      totalErrors,
      totalVisitsDeducted,
    });

    return {
      totalCampaigns: campaigns.length,
      totalProcessed,
      totalErrors,
      totalVisitsDeducted,
    };
  } catch (error) {
    logger.error("Credit deduction process failed", {
      error: error.message,
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

    // Call SparkTraffic stats API
    const statsResp = await postWithRetry(
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
        timeout: 20000,
      },
      { retries: 3, baseDelayMs: 1500 }
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
        const totalStatsResp = await postWithRetry(
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
            timeout: 20000,
          },
          { retries: 3, baseDelayMs: 1500 }
        );

        let totalHitsEver = 0;
        let totalVisitsEver = 0;
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.hits)) {
          totalStatsResp.data.hits.forEach((hitData) => {
            Object.values(hitData).forEach((count) => {
              totalHitsEver += parseInt(count) || 0;
            });
          });
        }
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.visits)) {
          totalStatsResp.data.visits.forEach((visitData) => {
            Object.values(visitData).forEach((count) => {
              totalVisitsEver += parseInt(count) || 0;
            });
          });
        }

        // For first check, don't charge for any historical hits
        // Just set the baseline for future comparisons
        actualNewHits = 0;
        campaign.total_hits_counted = totalHitsEver;
        campaign.total_visits_counted = totalVisitsEver;
      } catch (err) {
        logger.error("Failed to get total hits for baseline", {
          campaignId: campaign._id,
          error: err.message,
        });
        // Fallback: use current period total as baseline
        actualNewHits = 0;
        campaign.total_hits_counted = totalHitsInPeriod;
        campaign.total_visits_counted = totalVisitsInPeriod;
      }
    } else {
      // Subsequent checks: Calculate new hits since last check
      // Get total hits from campaign creation to now
      const createdDate = campaign.createdAt
        ? campaign.createdAt.toISOString().split("T")[0]
        : fromDate;
      try {
        const totalStatsResp = await postWithRetry(
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
            timeout: 20000,
          },
          { retries: 3, baseDelayMs: 1500 }
        );

        let totalHitsEver = 0;
        let totalVisitsEver = 0;
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.hits)) {
          totalStatsResp.data.hits.forEach((hitData) => {
            Object.values(hitData).forEach((count) => {
              totalHitsEver += parseInt(count) || 0;
            });
          });
        }
        if (totalStatsResp.data && Array.isArray(totalStatsResp.data.visits)) {
          totalStatsResp.data.visits.forEach((visitData) => {
            Object.values(visitData).forEach((count) => {
              totalVisitsEver += parseInt(count) || 0;
            });
          });
        }

        // Calculate new hits = total hits ever - previously counted hits
        actualNewHits = Math.max(0, totalHitsEver - previousHitsCounted);

        // Update the total visits counted to the current cumulative total
        campaign.total_visits_counted = totalVisitsEver;
      } catch (err) {
        logger.error("Failed to get total hits for comparison", {
          campaignId: campaign._id,
          error: err.message,
        });
        // Fallback: no charge if we can't get accurate data
        actualNewHits = 0;
      }
    }

    if (actualNewHits > 0) {
      // Get user's subscription
      const subscription = await Subscription.findOne({ user: campaign.user._id });
      if (!subscription) {
        logger.error("No subscription found for user during credit deduction", {
          campaignId: campaign._id,
          userId: campaign.user._id,
          userEmail: campaign.user.email,
        });
        
        // Pause the campaign if no subscription found
        campaign.state = "paused";
        campaign.credit_deduction_enabled = false;
        await campaign.save();
        
        return {
          success: true,
          creditsDeducted: 0,
          message: "No subscription found - campaign paused",
          newHits: actualNewHits,
        };
      }

      // Check if user has enough visits in subscription
      const availableVisits = subscription.visitsIncluded - subscription.visitsUsed;
      
      if (availableVisits < actualNewHits) {
        logger.warn("Insufficient subscription visits for deduction", {
          campaignId: campaign._id,
          userId: campaign.user._id,
          userEmail: campaign.user.email,
          visitsToDeduct: actualNewHits,
          availableVisits,
          visitsUsed: subscription.visitsUsed,
          visitsIncluded: subscription.visitsIncluded,
          newHits: actualNewHits,
        });

        // Pause the campaign at SparkTraffic API level if insufficient visits
        if (campaign.spark_traffic_project_id) {
          try {
            const axios = require("axios");
            const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();

            await postWithRetry(
              "https://v2.sparktraffic.com/modify-website-traffic-project",
              {
                unique_id: campaign.spark_traffic_project_id,
                speed: 0, // Set speed to 0 to pause traffic
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  API_KEY,
                },
                timeout: 15000,
              },
              { retries: 2, baseDelayMs: 1000 }
            );

            logger.info("Campaign paused due to insufficient subscription visits", {
              campaignId: campaign._id,
              userId: campaign.user._id,
              sparkTrafficProjectId: campaign.spark_traffic_project_id,
              visitsToDeduct: actualNewHits,
              availableVisits,
              visitsUsed: subscription.visitsUsed,
              visitsIncluded: subscription.visitsIncluded,
            });
          } catch (apiError) {
            logger.error(
              "Failed to pause SparkTraffic campaign due to insufficient visits",
              {
                campaignId: campaign._id,
                sparkTrafficProjectId: campaign.spark_traffic_project_id,
                error: apiError.message,
              }
            );
          }
        }

        // Pause the campaign locally
        campaign.state = "paused";
        campaign.credit_deduction_enabled = false;
        await campaign.save();

        return {
          success: true,
          creditsDeducted: 0,
          message: "Insufficient subscription visits - campaign paused",
          newHits: actualNewHits,
        };
      }

      // Deduct visits from subscription only (no user credit/hit deduction)
      subscription.visitsUsed += actualNewHits;
      await subscription.save();

      logger.info("Visits deducted from subscription", {
        campaignId: campaign._id,
        userId: campaign.user._id,
        visitsDeducted: actualNewHits,
        totalVisitsUsed: subscription.visitsUsed,
        visitsIncluded: subscription.visitsIncluded,
        visitsRemaining: subscription.visitsIncluded - subscription.visitsUsed,
      });

      // Check if visits exceeded limit and pause campaign if so
      if (subscription.visitsUsed > subscription.visitsIncluded) {
        logger.warn("Subscription visit limit exceeded, pausing campaign", {
          campaignId: campaign._id,
          userId: campaign.user._id,
          userEmail: campaign.user.email,
          visitsUsed: subscription.visitsUsed,
          visitsIncluded: subscription.visitsIncluded,
          overage: subscription.visitsUsed - subscription.visitsIncluded,
        });

        // Pause the campaign at SparkTraffic API level
        if (campaign.spark_traffic_project_id) {
          try {
            const API_KEY = process.env.SPARKTRAFFIC_API_KEY?.trim();
            await postWithRetry(
              "https://v2.sparktraffic.com/modify-website-traffic-project",
              {
                unique_id: campaign.spark_traffic_project_id,
                speed: 0, // Set speed to 0 to pause traffic
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  API_KEY,
                },
                timeout: 15000,
              },
              { retries: 2, baseDelayMs: 1000 }
            );

            logger.info("Campaign paused due to visit limit exceeded", {
              campaignId: campaign._id,
              sparkTrafficProjectId: campaign.spark_traffic_project_id,
              visitsUsed: subscription.visitsUsed,
              visitsIncluded: subscription.visitsIncluded,
            });
          } catch (apiError) {
            logger.error("Failed to pause SparkTraffic campaign", {
              campaignId: campaign._id,
              sparkTrafficProjectId: campaign.spark_traffic_project_id,
              error: apiError.message,
            });
          }
        }

        // Pause the campaign locally
        campaign.state = "paused";
        campaign.credit_deduction_enabled = false;
        await campaign.save();
      }

      // Update campaign tracking - add the new hits to the total counted
      const newTotalCounted =
        (campaign.total_hits_counted || 0) + actualNewHits;
      campaign.total_hits_counted = newTotalCounted;
      // Don't add period visits repeatedly - this was causing the inflated count
      // The total_visits_counted should be set to the actual cumulative total from SparkTraffic
      // which is handled in the baseline establishment and subsequent checks above
      campaign.last_stats_check = now;
      await campaign.save();

      return {
        success: true,
        visitsDeducted: actualNewHits,
        newHits: actualNewHits,
        visitsUsed: subscription.visitsUsed,
        visitsIncluded: subscription.visitsIncluded,
        visitsRemaining: subscription.visitsIncluded - subscription.visitsUsed,
        message: `Deducted ${actualNewHits} visits from subscription for ${actualNewHits} new traffic hits`,
      };
    } else {
      // No new hits, just update the check time
      campaign.last_stats_check = now;
      await campaign.save();

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
 * Manually trigger visit deduction from subscription for a specific campaign
 * @param {string} campaignId - Campaign ID to process
 * @returns {Object} - Result of the processing
 */
async function processSingleCampaignCredits(campaignId) {
  try {
    const campaign = await Campaign.findById(campaignId).populate(
      "user",
      "email"
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
