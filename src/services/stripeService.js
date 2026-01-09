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
    // Safely convert Stripe timestamps to Date objects with validation
    const startTimestamp = stripeSubscription.current_period_start;
    const endTimestamp = stripeSubscription.current_period_end;
    const canceledTimestamp = stripeSubscription.canceled_at;

    // Log timestamp values for debugging
    logger.debug("Processing subscription timestamps", {
      startTimestamp,
      endTimestamp,
      canceledTimestamp,
      subscriptionId: stripeSubscription.id,
    });

    subscription.currentPeriodStart = startTimestamp && !isNaN(startTimestamp)
      ? new Date(startTimestamp * 1000)
      : new Date();
    
    subscription.currentPeriodEnd = endTimestamp && !isNaN(endTimestamp)
      ? new Date(endTimestamp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
    
    // Validate that the dates are actually valid
    if (isNaN(subscription.currentPeriodStart.getTime())) {
      logger.warn("Invalid currentPeriodStart date, using fallback", {
        originalTimestamp: startTimestamp,
        subscriptionId: stripeSubscription.id,
      });
      subscription.currentPeriodStart = new Date();
    }
    if (isNaN(subscription.currentPeriodEnd.getTime())) {
      logger.warn("Invalid currentPeriodEnd date, using fallback", {
        originalTimestamp: endTimestamp,
        subscriptionId: stripeSubscription.id,
      });
      subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
    subscription.canceledAt = canceledTimestamp && !isNaN(canceledTimestamp)
      ? new Date(canceledTimestamp * 1000)
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
async function updateSubscriptionPlan(userId, newPlanName, paymentMethodId = null) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    const newPriceId = getPriceIdForPlan(newPlanName);
    if (!newPriceId) {
      throw new Error(`Invalid plan name: ${newPlanName}`);
    }

    // Check if this is an upgrade that requires payment
    const currentPlanConfig = Subscription.getPlanConfig(subscription.planName);
    const newPlanConfig = Subscription.getPlanConfig(newPlanName);
    const isUpgrade = newPlanConfig.price > currentPlanConfig.price;

    // For upgrades, ensure user has a valid payment method
    if (isUpgrade) {
      try {
        // Get customer's payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: subscription.stripeCustomerId,
          type: 'card',
        });

        // Get customer to check default payment method
        const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);

        // Check if user has any payment methods
        if (paymentMethods.data.length === 0) {
          throw new Error("No payment method found. Please add a payment method before upgrading.");
        }

        // Check if there's a default payment method or at least one attached method
        const hasDefaultPaymentMethod = customer.invoice_settings?.default_payment_method;
        const hasAttachedMethods = paymentMethods.data.length > 0;

        if (!hasDefaultPaymentMethod && !hasAttachedMethods) {
          throw new Error("No valid payment method found. Please add a payment method before upgrading.");
        }

        // If user specified a payment method, validate and use it
        if (paymentMethodId) {
          const specifiedMethod = paymentMethods.data.find(pm => pm.id === paymentMethodId);
          if (!specifiedMethod) {
            throw new Error("Specified payment method not found or not attached to customer");
          }
          
          // Set the specified payment method as default for this upgrade
          await stripe.customers.update(subscription.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          });
          
          logger.info("Using specified payment method for upgrade", {
            userId,
            paymentMethodId,
          });
        } else if (!hasDefaultPaymentMethod && hasAttachedMethods) {
          // If no default and no specific method chosen, set the first one as default
          await stripe.customers.update(subscription.stripeCustomerId, {
            invoice_settings: {
              default_payment_method: paymentMethods.data[0].id,
            },
          });
          
          logger.info("Auto-set default payment method for upgrade", {
            userId,
            paymentMethodId: paymentMethods.data[0].id,
          });
        }

      } catch (paymentCheckError) {
        logger.error("Payment method validation failed", {
          userId,
          error: paymentCheckError.message,
        });
        throw new Error(`Cannot upgrade: ${paymentCheckError.message}`);
      }
    }

    // Get current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Store old plan info for payment record
    const oldPlanName = subscription.planName;
    const oldPlanConfig = Subscription.getPlanConfig(oldPlanName);
    const newPlanConfig = Subscription.getPlanConfig(newPlanName);

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

    // Create payment record for the upgrade (manual fallback if webhook doesn't fire)
    try {
      const Payment = require("../models/Payment");
      
      // Calculate prorated amount (simplified - in production, get from Stripe invoice)
      const priceDifference = newPlanConfig.price - oldPlanConfig.price;
      const upgradeAmount = Math.max(priceDifference, 0); // Only charge if upgrading
      
      if (upgradeAmount > 0) {
        await new Payment({
          user: userId,
          subscription: subscription._id,
          stripeCustomerId: subscription.stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          amount: upgradeAmount * 100, // Convert to cents
          currency: 'usd',
          status: 'succeeded',
          type: 'upgrade',
          planName: newPlanName,
          description: `Upgraded from ${oldPlanName} to ${newPlanName} plan`,
          processedAt: new Date(),
          metadata: {
            upgradeFrom: oldPlanName,
            upgradeTo: newPlanName,
            priceDifference: upgradeAmount,
            manuallyCreated: true, // Flag to indicate this wasn't from webhook
          },
        }).save();

        logger.info("Upgrade payment record created", {
          userId,
          oldPlan: oldPlanName,
          newPlan: newPlanName,
          amount: upgradeAmount,
        });
      }
    } catch (paymentError) {
      logger.error("Failed to create upgrade payment record", {
        userId,
        error: paymentError.message,
      });
      // Don't fail the upgrade if payment record creation fails
    }

    logger.info("Subscription plan updated", {
      userId,
      oldPlan: oldPlanName,
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

/**
 * Get customer's saved payment methods
 */
async function getPaymentMethods(userId) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeCustomerId) {
      return { paymentMethods: [], defaultPaymentMethod: null };
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card',
    });

    // Get customer to find default payment method
    const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);

    // Format payment methods for frontend
    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        funding: pm.card.funding,
      },
      isDefault: pm.id === customer.invoice_settings?.default_payment_method,
      created: new Date(pm.created * 1000),
    }));

    logger.info("Payment methods retrieved", {
      userId,
      methodCount: formattedMethods.length,
    });

    return {
      paymentMethods: formattedMethods,
      defaultPaymentMethod: customer.invoice_settings?.default_payment_method,
    };
  } catch (error) {
    logger.error("Failed to get payment methods", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create setup session for adding new payment method
 */
async function createSetupSession(userId, successUrl, cancelUrl) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    // Create setup session for adding payment method
    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId,
      mode: 'setup',
      payment_method_types: ['card'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString(),
        purpose: 'add_payment_method',
      },
    });

    logger.info("Setup session created", {
      userId,
      sessionId: session.id,
    });

    return session;
  } catch (error) {
    logger.error("Failed to create setup session", {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Set default payment method
 */
async function setDefaultPaymentMethod(userId, paymentMethodId) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== subscription.stripeCustomerId) {
      throw new Error("Payment method does not belong to customer");
    }

    // Update customer's default payment method
    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    logger.info("Default payment method updated", {
      userId,
      paymentMethodId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to set default payment method", {
      userId,
      paymentMethodId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Remove payment method
 */
async function removePaymentMethod(userId, paymentMethodId) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== subscription.stripeCustomerId) {
      throw new Error("Payment method does not belong to customer");
    }

    // Check if this is the only payment method
    const allMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card',
    });

    if (allMethods.data.length === 1) {
      throw new Error("Cannot remove the only payment method. Add another payment method first.");
    }

    // Detach payment method from customer
    await stripe.paymentMethods.detach(paymentMethodId);

    logger.info("Payment method removed", {
      userId,
      paymentMethodId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to remove payment method", {
      userId,
      paymentMethodId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create customer portal session (Stripe-hosted billing management)
 */
async function createCustomerPortalSession(userId, returnUrl) {
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || !subscription.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info("Customer portal session created", {
      userId,
      sessionId: session.id,
    });

    return session;
  } catch (error) {
    logger.error("Failed to create customer portal session", {
      userId,
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
  // Payment method management
  getPaymentMethods,
  createSetupSession,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createCustomerPortalSession,
};
