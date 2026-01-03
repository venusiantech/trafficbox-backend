const express = require("express");
const { requireRole } = require("../middleware/auth");
const {
  createCheckoutSession,
  cancelSubscription,
  updateSubscriptionPlan,
  getSubscriptionDetails,
  syncSubscriptionFromStripe,
} = require("../services/stripeService");
const Subscription = require("../models/Subscription");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const logger = require("../utils/logger");

const router = express.Router();

/**
 * Get current user's subscription details
 */
router.get("/subscription", requireRole(), async (req, res) => {
  try {
    const subscription = await getSubscriptionDetails(req.user.id);

    res.json({
      ok: true,
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        visitsIncluded: subscription.visitsIncluded,
        visitsUsed: subscription.visitsUsed,
        campaignLimit: subscription.campaignLimit,
        currentCampaignCount: subscription.currentCampaignCount || 0,
        features: subscription.features,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    logger.error("Get subscription details failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to fetch subscription details",
      message: error.message,
    });
  }
});

/**
 * Get all available plans
 */
router.get("/plans", async (req, res) => {
  try {
    const plans = ["free", "starter", "growth", "business", "premium"].map(
      (planName) => {
        const config = Subscription.getPlanConfig(planName);
        return {
          ...config,
          description: getPlanDescription(planName),
        };
      }
    );

    res.json({
      ok: true,
      plans,
    });
  } catch (error) {
    logger.error("Get plans failed", {
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to fetch plans",
      message: error.message,
    });
  }
});

/**
 * Create a checkout session for upgrading plan
 */
router.post("/checkout", requireRole(), async (req, res) => {
  try {
    const { planName, successUrl, cancelUrl } = req.body;

    if (!planName) {
      return res.status(400).json({
        error: "Plan name is required",
      });
    }

    if (planName === "free") {
      return res.status(400).json({
        error: "Cannot create checkout session for free plan",
      });
    }

    const validPlans = ["starter", "growth", "business", "premium"];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({
        error: "Invalid plan name",
        validPlans,
      });
    }

    const session = await createCheckoutSession(
      req.user.id,
      planName,
      successUrl || `${process.env.FRONTEND_URL}/subscription/success`,
      cancelUrl || `${process.env.FRONTEND_URL}/subscription/cancel`
    );

    logger.info("Checkout session created", {
      userId: req.user.id,
      planName,
      sessionId: session.id,
    });

    res.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      message: "Checkout session created successfully",
    });
  } catch (error) {
    logger.error("Create checkout session failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
});

/**
 * Upgrade subscription plan
 */
router.post("/upgrade", requireRole(), async (req, res) => {
  try {
    const { planName } = req.body;

    if (!planName) {
      return res.status(400).json({
        error: "Plan name is required",
      });
    }

    const validPlans = ["starter", "growth", "business", "premium"];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({
        error: "Invalid plan name",
        validPlans,
      });
    }

    const updatedSubscription = await updateSubscriptionPlan(
      req.user.id,
      planName
    );

    logger.info("Subscription upgraded", {
      userId: req.user.id,
      newPlan: planName,
    });

    res.json({
      ok: true,
      message: "Subscription upgraded successfully",
      subscription: {
        planName: updatedSubscription.planName,
        status: updatedSubscription.status,
        visitsIncluded: updatedSubscription.visitsIncluded,
        campaignLimit: updatedSubscription.campaignLimit,
        features: updatedSubscription.features,
      },
    });
  } catch (error) {
    logger.error("Upgrade subscription failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to upgrade subscription",
      message: error.message,
    });
  }
});

/**
 * Downgrade subscription plan
 */
router.post("/downgrade", requireRole(), async (req, res) => {
  try {
    const { planName } = req.body;

    if (!planName) {
      return res.status(400).json({
        error: "Plan name is required",
      });
    }

    const validPlans = ["free", "starter", "growth", "business"];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({
        error: "Invalid plan name",
        validPlans,
      });
    }

    const updatedSubscription = await updateSubscriptionPlan(
      req.user.id,
      planName
    );

    logger.info("Subscription downgraded", {
      userId: req.user.id,
      newPlan: planName,
    });

    res.json({
      ok: true,
      message: "Subscription downgraded successfully",
      subscription: {
        planName: updatedSubscription.planName,
        status: updatedSubscription.status,
        visitsIncluded: updatedSubscription.visitsIncluded,
        campaignLimit: updatedSubscription.campaignLimit,
        features: updatedSubscription.features,
      },
    });
  } catch (error) {
    logger.error("Downgrade subscription failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to downgrade subscription",
      message: error.message,
    });
  }
});

/**
 * Cancel subscription
 */
router.post("/cancel", requireRole(), async (req, res) => {
  try {
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = await cancelSubscription(
      req.user.id,
      cancelAtPeriodEnd
    );

    logger.info("Subscription canceled", {
      userId: req.user.id,
      cancelAtPeriodEnd,
    });

    res.json({
      ok: true,
      message: cancelAtPeriodEnd
        ? "Subscription will be canceled at the end of the billing period"
        : "Subscription canceled immediately",
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    logger.error("Cancel subscription failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to cancel subscription",
      message: error.message,
    });
  }
});

/**
 * Reactivate canceled subscription
 */
router.post("/reactivate", requireRole(), async (req, res) => {
  try {
    const subscription = await cancelSubscription(req.user.id, false);

    logger.info("Subscription reactivated", {
      userId: req.user.id,
    });

    res.json({
      ok: true,
      message: "Subscription reactivated successfully",
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    logger.error("Reactivate subscription failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to reactivate subscription",
      message: error.message,
    });
  }
});

/**
 * Stripe webhook handler
 * Handles subscription events from Stripe
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error("Webhook signature verification failed", {
        error: err.message,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          await syncSubscriptionFromStripe(subscription);
          logger.info("Subscription synced from webhook", {
            eventType: event.type,
            subscriptionId: subscription.id,
          });
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const dbSubscription = await Subscription.findOne({
            stripeSubscriptionId: subscription.id,
          });

          if (dbSubscription) {
            dbSubscription.status = "canceled";
            dbSubscription.canceledAt = new Date();
            await dbSubscription.save();

            logger.info("Subscription canceled from webhook", {
              subscriptionId: subscription.id,
              userId: dbSubscription.user,
            });
          }
          break;
        }

        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "subscription") {
            const subscriptionId = session.subscription;
            const stripeSubscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            await syncSubscriptionFromStripe(stripeSubscription);

            logger.info("Subscription created from checkout", {
              sessionId: session.id,
              subscriptionId,
            });
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          logger.info("Payment succeeded", {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            amount: invoice.amount_paid,
          });
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const dbSubscription = await Subscription.findOne({
            stripeCustomerId: invoice.customer,
          });

          if (dbSubscription) {
            dbSubscription.status = "past_due";
            await dbSubscription.save();

            logger.warn("Payment failed", {
              invoiceId: invoice.id,
              customerId: invoice.customer,
              userId: dbSubscription.user,
            });
          }
          break;
        }

        default:
          logger.info("Unhandled webhook event", {
            eventType: event.type,
          });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error("Webhook handler error", {
        eventType: event.type,
        error: error.message,
      });
      res.status(500).json({
        error: "Webhook handler failed",
        message: error.message,
      });
    }
  }
);

/**
 * Helper function to get plan descriptions
 */
function getPlanDescription(planName) {
  const descriptions = {
    free: "Perfect for testing and small projects",
    starter: "Great for individuals and small businesses",
    growth: "Ideal for growing businesses with multiple campaigns",
    business: "For established businesses with high traffic needs",
    premium: "Enterprise-level solution with full features and support",
  };

  return descriptions[planName] || "";
}

module.exports = router;
