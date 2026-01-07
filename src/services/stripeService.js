const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Create a Stripe customer for a user
 */
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      metadata: {
        userId: user._id.toString(),
      },
    });

    logger.info("Stripe customer created", {
      userId: user._id,
      stripeCustomerId: customer.id,
    });

    return customer;
  } catch (error) {
    logger.error("Failed to create Stripe customer", {
      userId: user._id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create or update subscription in database from Stripe subscription object
 */
async function syncSubscriptionFromStripe(stripeSubscription, userId = null) {
  try {
    // Find user by Stripe customer ID or userId
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else {
      // First try to find user through existing subscription
      const subscription = await Subscription.findOne({
        stripeCustomerId: stripeSubscription.customer,
      });
      if (subscription) {
        user = await User.findById(subscription.user);
      } else {
        // Fallback: Get user ID from Stripe customer metadata
        try {
          const stripeCustomer = await stripe.customers.retrieve(stripeSubscription.customer);
          if (stripeCustomer.metadata?.userId) {
            user = await User.findById(stripeCustomer.metadata.userId);
          }
        } catch (error) {
          logger.error("Failed to retrieve Stripe customer", {
            stripeCustomerId: stripeSubscription.customer,
            error: error.message,
          });
        }
      }
    }

    if (!user) {
      logger.error("User not found for subscription sync", {
        stripeCustomerId: stripeSubscription.customer,
        stripeSubscriptionId: stripeSubscription.id,
      });
      return null;
    }

    // Get price ID and product ID
    const priceId = stripeSubscription.items.data[0]?.price.id;
    const productId = stripeSubscription.items.data[0]?.price.product;

    // Map price ID to plan name
    const planName = mapPriceIdToPlan(priceId);
    const planConfig = Subscription.getPlanConfig(planName);

    // Find or create subscription
    let subscription = await Subscription.findOne({ user: user._id });

    if (!subscription) {
      subscription = new Subscription({
        user: user._id,
        stripeCustomerId: stripeSubscription.customer,
      });
    }

    // Update subscription details
    subscription.stripeSubscriptionId = stripeSubscription.id;
    subscription.stripePriceId = priceId;
    subscription.stripeProductId = productId;
    subscription.planName = planName;
    subscription.status = stripeSubscription.status;
    subscription.visitsIncluded = planConfig.visitsIncluded;
    subscription.campaignLimit = planConfig.campaignLimit;
    subscription.features = planConfig.features;
    subscription.currentPeriodStart = new Date(
      stripeSubscription.current_period_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      stripeSubscription.current_period_end * 1000
    );
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
    subscription.canceledAt = stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null;

    await subscription.save();

    logger.info("Subscription synced from Stripe", {
      userId: user._id,
      subscriptionId: subscription._id,
      planName,
      status: stripeSubscription.status,
    });

    return subscription;
  } catch (error) {
    logger.error("Failed to sync subscription from Stripe", {
      stripeSubscriptionId: stripeSubscription?.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Map Stripe price ID to internal plan name
 * Update these IDs with your actual Stripe price IDs
 */
function mapPriceIdToPlan(priceId) {
  const priceIdMap = {
    // Environment variable mapping (preferred)
    [process.env.STRIPE_PRICE_FREE]: "free",
    [process.env.STRIPE_PRICE_STARTER]: "starter",
    [process.env.STRIPE_PRICE_GROWTH]: "growth",
    [process.env.STRIPE_PRICE_BUSINESS]: "business",
    [process.env.STRIPE_PRICE_PREMIUM]: "premium",
  };

  return priceIdMap[priceId] || "free";
}

/**
 * Create a checkout session for subscription upgrade
 */
async function createCheckoutSession(userId, planName, successUrl, cancelUrl) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get or create Stripe customer
    let subscription = await Subscription.findOne({ user: userId });
    let stripeCustomerId;

    if (subscription && subscription.stripeCustomerId) {
      stripeCustomerId = subscription.stripeCustomerId;
    } else {
      const customer = await createStripeCustomer(user);
      stripeCustomerId = customer.id;
      
      // Save the customer ID to the subscription record if it exists
      if (subscription) {
        subscription.stripeCustomerId = stripeCustomerId;
        await subscription.save();
      }
    }

    // Get price ID for the plan
    const priceId = getPriceIdForPlan(planName);
    if (!priceId) {
      throw new Error(`Invalid plan name: ${planName}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString(),
        planName,
      },
    });

    logger.info("Checkout session created", {
      userId,
      planName,
      sessionId: session.id,
    });

    return session;
  } catch (error) {
    logger.error("Failed to create checkout session", {
      userId,
      planName,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get Stripe price ID for a plan name
 */
function getPriceIdForPlan(planName) {
  const planPriceMap = {
    // Environment variable mapping (preferred)
    free: process.env.STRIPE_PRICE_FREE,
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    business: process.env.STRIPE_PRICE_BUSINESS,
    premium: process.env.STRIPE_PRICE_PREMIUM,
  };

  return planPriceMap[planName];
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(userId, cancelAtPeriodEnd = true) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    // Update in Stripe
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: cancelAtPeriodEnd,
      }
    );

    // Update in database
    subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (!cancelAtPeriodEnd) {
      subscription.canceledAt = null;
    }
    await subscription.save();

    logger.info("Subscription cancellation scheduled", {
      userId,
      subscriptionId: subscription._id,
      cancelAtPeriodEnd,
    });

    return subscription;
  } catch (error) {
    logger.error("Failed to cancel subscription", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Update subscription plan (upgrade/downgrade)
 */
async function updateSubscriptionPlan(userId, newPlanName) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    const newPriceId = getPriceIdForPlan(newPlanName);
    if (!newPriceId) {
      throw new Error(`Invalid plan name: ${newPlanName}`);
    }

    // Get current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      }
    );

    // Sync to database
    await syncSubscriptionFromStripe(updatedSubscription, userId);

    logger.info("Subscription plan updated", {
      userId,
      oldPlan: subscription.planName,
      newPlan: newPlanName,
    });

    return await Subscription.findOne({ user: userId });
  } catch (error) {
    logger.error("Failed to update subscription plan", {
      userId,
      newPlanName,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get subscription details
 */
async function getSubscriptionDetails(userId) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    
    // Calculate real-time campaign count (excluding archived campaigns)
    const Campaign = require("../models/Campaign");
    const currentCampaignCount = await Campaign.countDocuments({
      user: userId,
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    });
    
    if (!subscription) {
      // Return free plan details if no subscription exists
      const freePlan = Subscription.getPlanConfig("free");
      return {
        planName: "free",
        status: "active",
        ...freePlan,
        currentCampaignCount,
        visitsUsed: 0,
      };
    }

    // Update the subscription record with current campaign count
    subscription.currentCampaignCount = currentCampaignCount;
    await subscription.save();

    return subscription;
  } catch (error) {
    logger.error("Failed to get subscription details", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Reset monthly visit counter
 * Should be called via cron job at the start of each billing period
 */
async function resetMonthlyVisits() {
  try {
    const now = new Date();
    const subscriptions = await Subscription.find({
      status: "active",
      currentPeriodEnd: { $lte: now },
    });

    let resetCount = 0;
    for (const subscription of subscriptions) {
      subscription.visitsUsed = 0;
      subscription.lastResetAt = now;
      await subscription.save();
      resetCount++;
    }

    logger.info("Monthly visits reset", {
      count: resetCount,
    });

    return resetCount;
  } catch (error) {
    logger.error("Failed to reset monthly visits", {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  createStripeCustomer,
  syncSubscriptionFromStripe,
  createCheckoutSession,
  cancelSubscription,
  updateSubscriptionPlan,
  getSubscriptionDetails,
  resetMonthlyVisits,
  mapPriceIdToPlan,
  getPriceIdForPlan,
};
