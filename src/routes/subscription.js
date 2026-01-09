const express = require("express");
const { requireRole } = require("../middleware/auth");
const {
  createCheckoutSession,
  cancelSubscription,
  updateSubscriptionPlan,
  getSubscriptionDetails,
  syncSubscriptionFromStripe,
  getPaymentMethods,
  createSetupSession,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createCustomerPortalSession,
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
    const { planName, paymentMethodId } = req.body;

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
      planName,
      paymentMethodId
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

    // Create payment record for manual cancellation
    const Payment = require("../models/Payment");
    try {
      await Payment.createLifecycleEvent('canceled', subscription, req.user.id, {
        cancelAtPeriodEnd,
        canceledBy: 'user',
        canceledAt: new Date(),
      });
      logger.info("Cancellation payment record created", {
        userId: req.user.id,
        subscriptionId: subscription._id,
      });
    } catch (paymentError) {
      logger.error("Failed to create cancellation payment record", {
        userId: req.user.id,
        error: paymentError.message,
      });
    }

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

    // Create payment record for reactivation
    const Payment = require("../models/Payment");
    try {
      await Payment.createLifecycleEvent('reactivated', subscription, req.user.id, {
        reactivatedBy: 'user',
        reactivatedAt: new Date(),
      });
      logger.info("Reactivation payment record created", {
        userId: req.user.id,
        subscriptionId: subscription._id,
      });
    } catch (paymentError) {
      logger.error("Failed to create reactivation payment record", {
        userId: req.user.id,
        error: paymentError.message,
      });
    }

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
          
          // Create payment record for subscription changes
          if (event.type === "customer.subscription.created") {
            const dbSubscription = await Subscription.findOne({
              stripeSubscriptionId: subscription.id,
            });
            
            if (dbSubscription) {
              const Payment = require("../models/Payment");
              const planConfig = Subscription.getPlanConfig(dbSubscription.planName);
              
              try {
                await new Payment({
                  user: dbSubscription.user,
                  subscription: dbSubscription._id,
                  stripeSubscriptionId: subscription.id,
                  stripeCustomerId: subscription.customer,
                  amount: planConfig.price * 100, // Convert to cents
                  currency: 'usd',
                  status: 'succeeded',
                  type: 'subscription',
                  planName: dbSubscription.planName,
                  periodStart: new Date(subscription.current_period_start * 1000),
                  periodEnd: new Date(subscription.current_period_end * 1000),
                  description: `New ${dbSubscription.planName} subscription created`,
                  processedAt: new Date(subscription.created * 1000),
                }).save();
                
                logger.info("Subscription creation payment record created", {
                  subscriptionId: subscription.id,
                  userId: dbSubscription.user,
                  planName: dbSubscription.planName,
                });
              } catch (paymentError) {
                logger.error("Failed to create subscription payment record", {
                  subscriptionId: subscription.id,
                  error: paymentError.message,
                });
              }
            }
          }
          
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

            // Create payment record for cancellation
            const Payment = require("../models/Payment");
            try {
              await new Payment({
                user: dbSubscription.user,
                subscription: dbSubscription._id,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer,
                amount: 0, // No charge for cancellation
                currency: 'usd',
                status: 'succeeded',
                type: 'subscription',
                planName: dbSubscription.planName,
                description: `${dbSubscription.planName} subscription canceled`,
                processedAt: new Date(),
                metadata: {
                  action: 'cancellation',
                  canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date(),
                  cancelReason: subscription.cancellation_details?.reason || 'user_requested',
                },
              }).save();
              
              logger.info("Subscription cancellation record created", {
                subscriptionId: subscription.id,
                userId: dbSubscription.user,
              });
            } catch (paymentError) {
              logger.error("Failed to create cancellation record", {
                subscriptionId: subscription.id,
                error: paymentError.message,
              });
            }

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
            const userId = session.metadata?.userId; // Get userId from session metadata
            const stripeSubscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            
            // Pass userId to sync function to ensure proper user association
            await syncSubscriptionFromStripe(stripeSubscription, userId);

            logger.info("Subscription created from checkout", {
              sessionId: session.id,
              subscriptionId,
              userId,
            });
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          
          // Find the subscription to get user ID
          const dbSubscription = await Subscription.findOne({
            stripeCustomerId: invoice.customer,
          });

          if (dbSubscription) {
            // Create payment record
            const Payment = require("../models/Payment");
            try {
              await Payment.createFromStripeInvoice(invoice, dbSubscription.user, dbSubscription._id);
              logger.info("Payment record created", {
                invoiceId: invoice.id,
                userId: dbSubscription.user,
                amount: invoice.amount_paid / 100,
              });
            } catch (paymentError) {
              logger.error("Failed to create payment record", {
                invoiceId: invoice.id,
                error: paymentError.message,
              });
            }
          }

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

            // Create payment record for failed payment
            const Payment = require("../models/Payment");
            try {
              await new Payment({
                user: dbSubscription.user,
                subscription: dbSubscription._id,
                stripeInvoiceId: invoice.id,
                stripeCustomerId: invoice.customer,
                stripeSubscriptionId: invoice.subscription,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: 'failed',
                type: 'subscription',
                planName: dbSubscription.planName,
                periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
                periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
                description: `Failed payment for ${dbSubscription.planName} subscription`,
                failedAt: new Date(),
                failureReason: invoice.last_finalization_error?.message || 'Payment failed',
                processedAt: new Date(invoice.created * 1000),
              }).save();
              
              logger.info("Failed payment record created", {
                invoiceId: invoice.id,
                userId: dbSubscription.user,
                amount: invoice.amount_due / 100,
              });
            } catch (paymentError) {
              logger.error("Failed to create failed payment record", {
                invoiceId: invoice.id,
                error: paymentError.message,
              });
            }

            logger.warn("Payment failed", {
              invoiceId: invoice.id,
              customerId: invoice.customer,
              userId: dbSubscription.user,
            });
          }
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object;
          const dbSubscription = await Subscription.findOne({
            stripeCustomerId: dispute.charge.customer,
          });

          if (dbSubscription) {
            const Payment = require("../models/Payment");
            try {
              await new Payment({
                user: dbSubscription.user,
                subscription: dbSubscription._id,
                stripeCustomerId: dispute.charge.customer,
                amount: dispute.amount,
                currency: dispute.currency,
                status: 'refunded',
                type: 'subscription',
                planName: dbSubscription.planName,
                description: `Dispute created for ${dbSubscription.planName} subscription`,
                refundedAt: new Date(),
                processedAt: new Date(dispute.created * 1000),
                metadata: {
                  action: 'dispute',
                  disputeId: dispute.id,
                  reason: dispute.reason,
                },
              }).save();
              
              logger.info("Dispute payment record created", {
                disputeId: dispute.id,
                userId: dbSubscription.user,
                amount: dispute.amount / 100,
              });
            } catch (paymentError) {
              logger.error("Failed to create dispute record", {
                disputeId: dispute.id,
                error: paymentError.message,
              });
            }
          }
          break;
        }

        case "invoice.payment_action_required": {
          const invoice = event.data.object;
          const dbSubscription = await Subscription.findOne({
            stripeCustomerId: invoice.customer,
          });

          if (dbSubscription) {
            const Payment = require("../models/Payment");
            try {
              await new Payment({
                user: dbSubscription.user,
                subscription: dbSubscription._id,
                stripeInvoiceId: invoice.id,
                stripeCustomerId: invoice.customer,
                stripeSubscriptionId: invoice.subscription,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: 'pending',
                type: 'subscription',
                planName: dbSubscription.planName,
                description: `Payment action required for ${dbSubscription.planName} subscription`,
                processedAt: new Date(invoice.created * 1000),
                metadata: {
                  action: 'payment_action_required',
                  nextPaymentAttempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000) : null,
                },
              }).save();
              
              logger.info("Payment action required record created", {
                invoiceId: invoice.id,
                userId: dbSubscription.user,
              });
            } catch (paymentError) {
              logger.error("Failed to create payment action required record", {
                invoiceId: invoice.id,
                error: paymentError.message,
              });
            }
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
 * Get payment history for the authenticated user
 */
router.get("/payments", requireRole(), async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (parseInt(page) - 1) * limitNum;
    
    // Try to get payments from Payment model first
    const Payment = require("../models/Payment");
    const payments = await Payment.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();

    if (payments.length > 0) {
      // Format payment data
      const formattedPayments = payments.map(payment => ({
        id: payment._id,
        stripeId: payment.stripeInvoiceId || payment.stripePaymentIntentId,
        type: payment.type,
        amount: payment.amount / 100, // Convert from cents
        currency: payment.currency.toUpperCase(),
        status: payment.status,
        created: payment.createdAt,
        description: payment.description,
        receiptUrl: payment.receiptUrl,
        invoiceUrl: payment.invoiceUrl,
        planName: payment.planName,
        periodStart: payment.periodStart,
        periodEnd: payment.periodEnd,
      }));

      const totalPayments = await Payment.countDocuments({ user: req.user.id });

      return res.json({
        ok: true,
        payments: formattedPayments,
        hasMore: skip + limitNum < totalPayments,
        totalFound: totalPayments,
        currentPage: parseInt(page),
      });
    }

    // Fallback: Create payment history from subscription data
    const subscription = await Subscription.findOne({ user: req.user.id });
    
    if (!subscription) {
      return res.json({
        ok: true,
        payments: [],
        hasMore: false,
        message: "No payment history found",
      });
    }

    // Create a synthetic payment record based on current subscription
    const syntheticPayments = [];
    
    if (subscription.planName !== 'free' && subscription.status === 'active') {
      const planConfig = Subscription.getPlanConfig(subscription.planName);
      syntheticPayments.push({
        id: subscription._id,
        stripeId: subscription.stripeSubscriptionId,
        type: 'subscription',
        amount: planConfig.price,
        currency: 'USD',
        status: 'succeeded',
        created: subscription.currentPeriodStart || subscription.createdAt,
        description: `${subscription.planName.charAt(0).toUpperCase() + subscription.planName.slice(1)} Plan Subscription`,
        receiptUrl: null,
        invoiceUrl: null,
        planName: subscription.planName,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      });
    }

    logger.info("Payment history retrieved from subscription data", {
      userId: req.user.id,
      paymentCount: syntheticPayments.length,
    });

    res.json({
      ok: true,
      payments: syntheticPayments,
      hasMore: false,
      totalFound: syntheticPayments.length,
      currentPage: 1,
      message: "Payment history generated from subscription data",
    });

  } catch (error) {
    logger.error("Get payment history failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to fetch payment history",
      message: error.message,
    });
  }
});

/**
 * Get payment summary for the authenticated user
 */
router.get("/payment-summary", requireRole(), async (req, res) => {
  try {
    // Get user's subscription
    const subscription = await Subscription.findOne({ user: req.user.id });
    
    if (!subscription) {
      return res.json({
        ok: true,
        summary: {
          totalPaid: 0,
          currency: "USD",
          paymentCount: 0,
          lastPayment: null,
          currentPlan: "free",
          subscriptionStatus: "inactive",
        },
      });
    }

    // Try to get payment data from Payment model
    const Payment = require("../models/Payment");
    const payments = await Payment.find({ 
      user: req.user.id, 
      status: 'succeeded' 
    }).sort({ createdAt: -1 });

    let totalPaid = 0;
    let lastPayment = null;
    let paymentCount = payments.length;

    if (payments.length > 0) {
      // Calculate from actual payment records
      totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const latestPayment = payments[0];
      lastPayment = {
        amount: latestPayment.amount / 100,
        currency: latestPayment.currency.toUpperCase(),
        date: latestPayment.createdAt,
        description: latestPayment.description,
      };
    } else if (subscription.planName !== 'free' && subscription.status === 'active') {
      // Fallback: estimate from current subscription
      const planConfig = Subscription.getPlanConfig(subscription.planName);
      totalPaid = planConfig.price * 100; // Convert to cents for consistency
      paymentCount = 1;
      lastPayment = {
        amount: planConfig.price,
        currency: 'USD',
        date: subscription.currentPeriodStart || subscription.createdAt,
        description: `${subscription.planName.charAt(0).toUpperCase() + subscription.planName.slice(1)} Plan Subscription`,
      };
    }

    logger.info("Payment summary retrieved", {
      userId: req.user.id,
      totalPaid: totalPaid / 100,
      paymentCount,
      source: payments.length > 0 ? 'payment_records' : 'subscription_estimate',
    });

    res.json({
      ok: true,
      summary: {
        totalPaid: totalPaid / 100, // Convert from cents
        currency: lastPayment?.currency || 'USD',
        paymentCount,
        lastPayment,
        currentPlan: subscription.planName,
        subscriptionStatus: subscription.status,
        nextBillingDate: subscription.currentPeriodEnd,
        visitsUsed: subscription.visitsUsed,
        visitsIncluded: subscription.visitsIncluded,
        campaignsUsed: subscription.currentCampaignCount,
        campaignLimit: subscription.campaignLimit,
      },
    });

  } catch (error) {
    logger.error("Get payment summary failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to fetch payment summary",
      message: error.message,
    });
  }
});

/**
 * Get user's saved payment methods
 */
router.get("/payment-methods", requireRole(), async (req, res) => {
  try {
    const paymentData = await getPaymentMethods(req.user.id);

    res.json({
      ok: true,
      ...paymentData,
    });
  } catch (error) {
    logger.error("Get payment methods failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to fetch payment methods",
      message: error.message,
    });
  }
});

/**
 * Create setup session for adding new payment method
 */
router.post("/add-payment-method", requireRole(), async (req, res) => {
  try {
    const { successUrl, cancelUrl } = req.body;

    const session = await createSetupSession(
      req.user.id,
      successUrl || `${process.env.FRONTEND_URL}/billing/success`,
      cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`
    );

    logger.info("Setup session created", {
      userId: req.user.id,
      sessionId: session.id,
    });

    res.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      message: "Setup session created successfully",
    });
  } catch (error) {
    logger.error("Create setup session failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to create setup session",
      message: error.message,
    });
  }
});

/**
 * Set default payment method
 */
router.post("/set-default-payment-method", requireRole(), async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({
        error: "Payment method ID is required",
      });
    }

    await setDefaultPaymentMethod(req.user.id, paymentMethodId);

    logger.info("Default payment method set", {
      userId: req.user.id,
      paymentMethodId,
    });

    res.json({
      ok: true,
      message: "Default payment method updated successfully",
    });
  } catch (error) {
    logger.error("Set default payment method failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to set default payment method",
      message: error.message,
    });
  }
});

/**
 * Remove payment method
 */
router.delete("/payment-methods/:paymentMethodId", requireRole(), async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await removePaymentMethod(req.user.id, paymentMethodId);

    logger.info("Payment method removed", {
      userId: req.user.id,
      paymentMethodId,
    });

    res.json({
      ok: true,
      message: "Payment method removed successfully",
    });
  } catch (error) {
    logger.error("Remove payment method failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to remove payment method",
      message: error.message,
    });
  }
});

/**
 * Create customer portal session (Stripe-hosted billing management)
 */
router.post("/customer-portal", requireRole(), async (req, res) => {
  try {
    const { returnUrl } = req.body;

    const session = await createCustomerPortalSession(
      req.user.id,
      returnUrl || `${process.env.FRONTEND_URL}/billing`
    );

    logger.info("Customer portal session created", {
      userId: req.user.id,
      sessionId: session.id,
    });

    res.json({
      ok: true,
      url: session.url,
      message: "Customer portal session created successfully",
    });
  } catch (error) {
    logger.error("Create customer portal session failed", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({
      error: "Failed to create customer portal session",
      message: error.message,
    });
  }
});

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
