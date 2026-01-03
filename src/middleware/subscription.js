const Subscription = require("../models/Subscription");
const Campaign = require("../models/Campaign");
const logger = require("../utils/logger");

/**
 * Middleware to check subscription access for campaign creation
 * Validates subscription status and enforces plan limits
 */
const checkSubscriptionAccess = async (req, res, next) => {
  try {
    // User should already be authenticated by requireRole middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please login to continue",
      });
    }

    const userId = req.user.id;

    // Fetch user's subscription
    let subscription = await Subscription.findOne({ user: userId });

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      logger.info("No subscription found, creating free tier", { userId });

      // Create Stripe customer ID placeholder (will be replaced when Stripe integration is complete)
      const stripeCustomerId = `cus_free_${userId}`;

      const planConfig = Subscription.getPlanConfig("free");

      subscription = new Subscription({
        user: userId,
        stripeCustomerId,
        planName: "free",
        status: "active",
        visitsIncluded: planConfig.visitsIncluded,
        campaignLimit: planConfig.campaignLimit,
        features: planConfig.features,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free plan
      });

      await subscription.save();

      logger.info("Free tier subscription created", {
        userId,
        subscriptionId: subscription._id,
      });
    }

    // Check if subscription is active
    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      logger.warn("Inactive subscription attempt", {
        userId,
        status: subscription.status,
        planName: subscription.planName,
      });

      return res.status(403).json({
        error: "Subscription inactive",
        message: `Your subscription is ${subscription.status}. Please update your payment method or upgrade your plan.`,
        subscriptionStatus: subscription.status,
        planName: subscription.planName,
      });
    }

    // Count existing campaigns for this user (excluding archived)
    const campaignCount = await Campaign.countDocuments({
      user: userId,
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    });

    // Update current campaign count in subscription
    subscription.currentCampaignCount = campaignCount;
    await subscription.save();

    // Check if user can create a campaign
    const accessCheck = subscription.canCreateCampaign();

    if (!accessCheck.allowed) {
      logger.warn("Campaign creation blocked", {
        userId,
        planName: subscription.planName,
        currentCount: campaignCount,
        limit: subscription.campaignLimit,
        reason: accessCheck.reason,
      });

      return res.status(403).json({
        error: "Campaign limit reached",
        message: accessCheck.reason,
        currentPlan: {
          name: subscription.planName,
          campaignLimit: subscription.campaignLimit,
          currentCampaigns: campaignCount,
          visitsIncluded: subscription.visitsIncluded,
          visitsUsed: subscription.visitsUsed,
        },
        suggestion:
          campaignCount >= subscription.campaignLimit
            ? "Upgrade your plan to create more campaigns."
            : "You have reached your visit limit. Upgrade for more visits.",
      });
    }

    // Attach subscription to request for use in route handlers
    req.subscription = subscription;
    req.subscription.currentCampaigns = campaignCount;

    logger.info("Subscription access granted", {
      userId,
      planName: subscription.planName,
      currentCampaigns: campaignCount,
      campaignLimit: subscription.campaignLimit,
    });

    next();
  } catch (error) {
    logger.error("Subscription check failed", {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      error: "Subscription verification failed",
      message: "Unable to verify subscription. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Middleware to validate feature access based on subscription
 * @param {string} feature - Feature name (e.g., 'countryTargeting', 'behaviorSettings')
 * @param {string|array} requiredLevel - Required level(s) for the feature
 */
const checkFeatureAccess = (feature, requiredLevel) => {
  return (req, res, next) => {
    if (!req.subscription) {
      return res.status(403).json({
        error: "Subscription not found",
        message: "Please ensure you have an active subscription",
      });
    }

    const subscription = req.subscription;
    const userFeatureLevel = subscription.features[feature];

    // Handle array of required levels (any match is OK)
    const requiredLevels = Array.isArray(requiredLevel)
      ? requiredLevel
      : [requiredLevel];

    if (!requiredLevels.includes(userFeatureLevel)) {
      logger.warn("Feature access denied", {
        userId: req.user.id,
        feature,
        userLevel: userFeatureLevel,
        requiredLevel: requiredLevels,
        planName: subscription.planName,
      });

      return res.status(403).json({
        error: "Feature not available",
        message: `Your ${subscription.planName} plan does not support ${feature}. Current level: ${userFeatureLevel}, required: ${requiredLevels.join(" or ")}`,
        currentPlan: subscription.planName,
        upgradeRequired: true,
      });
    }

    next();
  };
};

/**
 * Middleware to track visit usage
 * Should be called after campaign creation or visit tracking
 */
const trackVisitUsage = async (req, res, next) => {
  try {
    if (!req.subscription) {
      return next();
    }

    const visitsToAdd = req.body.visitsToTrack || 0;

    if (visitsToAdd > 0) {
      req.subscription.visitsUsed += visitsToAdd;
      await req.subscription.save();

      logger.info("Visit usage tracked", {
        userId: req.user.id,
        visitsAdded: visitsToAdd,
        totalUsed: req.subscription.visitsUsed,
        limit: req.subscription.visitsIncluded,
      });
    }

    next();
  } catch (error) {
    logger.error("Visit tracking failed", {
      userId: req.user?.id,
      error: error.message,
    });
    // Don't block the request, just log the error
    next();
  }
};

module.exports = {
  checkSubscriptionAccess,
  checkFeatureAccess,
  trackVisitUsage,
};
