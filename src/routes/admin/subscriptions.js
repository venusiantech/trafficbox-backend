const express = require("express");
const { requireRole } = require("../../middleware/auth");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");
const Campaign = require("../../models/Campaign");
const Payment = require("../../models/Payment");
const Notification = require("../../models/Notification");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const logger = require("../../utils/logger");

const router = express.Router();

// Get All Users with Subscriptions
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const planFilter = req.query.plan; // Filter by plan name

    let filter = {};
    if (planFilter) {
      filter.planName = planFilter;
    }

    const [subscriptions, totalSubscriptions] = await Promise.all([
      Subscription.find(filter)
        .populate("user", "email firstName lastName")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(filter),
    ]);

    // Get campaign counts for each user
    const subscriptionsWithCampaigns = await Promise.all(
      subscriptions.map(async (sub) => {
        const campaignCount = await Campaign.countDocuments({
          user: sub.user._id,
          $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
        });

        return {
          subscriptionId: sub._id,
          planName: sub.planName,
          status: sub.status,
          visitsIncluded: sub.visitsIncluded,
          visitsUsed: sub.visitsUsed,
          campaignLimit: sub.campaignLimit,
          currentCampaigns: campaignCount,
          adminAssigned: sub.adminAssigned || false,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          user: {
            id: sub.user._id,
            email: sub.user.email,
            name: `${sub.user.firstName} ${sub.user.lastName}`.trim(),
          },
        };
      })
    );

    // Get plan distribution stats
    const planStats = await Subscription.aggregate([
      { $group: { _id: "$planName", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      ok: true,
      subscriptions: subscriptionsWithCampaigns,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSubscriptions / limit),
        totalSubscriptions,
        hasNext: page * limit < totalSubscriptions,
        hasPrev: page > 1,
      },
      planDistribution: planStats,
      filter: planFilter ? { plan: planFilter } : null,
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({
      error: "Failed to fetch subscriptions",
      details: error.message,
    });
  }
});

// Get User's Subscription Details (Admin view)
router.get("/users/:userId", requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password -credits -availableHits");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
      return res.json({
        ok: true,
        message: "User has no subscription",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        subscription: null,
        suggestion:
          "Use POST /admin/subscriptions/users/:userId to assign a plan",
      });
    }

    // Count current campaigns
    const currentCampaigns = await Campaign.countDocuments({
      user: userId,
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    });

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        stripeCustomerId: user.stripeCustomerId,
      },
      subscription: {
        id: subscription._id,
        planName: subscription.planName,
        status: subscription.status,
        visitsIncluded: subscription.visitsIncluded,
        visitsUsed: subscription.visitsUsed,
        campaignLimit: subscription.campaignLimit,
        currentCampaigns: currentCampaigns,
        features: subscription.features,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripePriceId: subscription.stripePriceId,
        adminAssigned: subscription.adminAssigned || false,
        assignedBy: subscription.assignedBy,
        assignedAt: subscription.assignedAt,
        lastModifiedBy: subscription.lastModifiedBy,
        lastModifiedAt: subscription.lastModifiedAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({
      error: "Failed to fetch subscription",
      details: error.message,
    });
  }
});

// Assign or Update User Subscription without Custom Plan
router.post("/users/:userId", requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { planName, reason } = req.body;

    // Validate plan name
    const validPlans = ["free", "starter", "growth", "business"];
    if (!planName || !validPlans.includes(planName)) {
      return res.status(400).json({
        error: "Invalid plan name",
        validPlans: validPlans,
        received: planName,
      });
    }

    // Find user
    const user = await User.findById(userId).select("-password -credits -availableHits");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get plan configuration
    const planConfig = Subscription.getPlanConfig(planName);

    // Find or create subscription
    let subscription = await Subscription.findOne({ user: userId });
    const isNewSubscription = !subscription;

    if (!subscription) {
      // Create new subscription
      subscription = new Subscription({
        user: userId,
        stripeCustomerId: user.stripeCustomerId || `admin_assigned_${userId}`,
        planName: planName,
        status: "active",
        visitsIncluded: planConfig.visitsIncluded,
        campaignLimit: planConfig.campaignLimit,
        visitsUsed: 0,
        features: planConfig.features,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        adminAssigned: true,
        assignedBy: req.user.id,
        assignedAt: new Date(),
        assignmentReason: reason || "Admin assignment",
      });
    } else {
      // Update existing subscription
      const oldPlan = subscription.planName;

      subscription.planName = planName;
      subscription.status = "active";
      subscription.visitsIncluded = planConfig.visitsIncluded;
      subscription.campaignLimit = planConfig.campaignLimit;
      subscription.features = planConfig.features;
      subscription.adminAssigned = true;
      subscription.lastModifiedBy = req.user.id;
      subscription.lastModifiedAt = new Date();
      subscription.modificationReason =
        reason || `Admin changed plan from ${oldPlan} to ${planName}`;

      // Reset period if switching plans
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      );

      // Optionally reset visits for new period (keep this if you want to reset on plan change)
      // subscription.visitsUsed = 0;
    }

    await subscription.save();

    // Count current campaigns
    const currentCampaigns = await Campaign.countDocuments({
      user: userId,
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    });

    res.json({
      ok: true,
      message: isNewSubscription
        ? `Subscription assigned successfully to ${user.email}`
        : `Subscription updated successfully for ${user.email}`,
      action: isNewSubscription ? "created" : "updated",
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        visitsIncluded: subscription.visitsIncluded,
        visitsUsed: subscription.visitsUsed,
        campaignLimit: subscription.campaignLimit,
        currentCampaigns: currentCampaigns,
        features: subscription.features,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        adminAssigned: true,
        assignedBy: req.user.email,
        reason:
          reason || (isNewSubscription ? "Admin assignment" : "Admin update"),
      },
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Error assigning subscription:", error);
    res.status(500).json({
      error: "Failed to assign subscription",
      details: error.message,
    });
  }
});

// Assign Custom Plan to User
router.post("/users/:userId/custom", requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      visitsIncluded,
      campaignLimit,
      price,
      description,
      reason,
      features,
      durationDays,
    } = req.body;

    // Validate required fields
    if (
      visitsIncluded === undefined ||
      campaignLimit === undefined ||
      price === undefined
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["visitsIncluded", "campaignLimit", "price"],
        received: { visitsIncluded, campaignLimit, price },
      });
    }

    // Validate values
    if (
      visitsIncluded < 0 ||
      campaignLimit < 0 ||
      price < 0 ||
      !Number.isInteger(visitsIncluded) ||
      !Number.isInteger(campaignLimit)
    ) {
      return res.status(400).json({
        error: "Invalid values",
        details:
          "visitsIncluded and campaignLimit must be positive integers, price must be positive",
      });
    }

    // Find user
    const user = await User.findById(userId).select("-password -credits -availableHits");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get default custom plan config
    const defaultCustomConfig = Subscription.getPlanConfig("custom");

    // Merge provided features with defaults
    const customFeatures = {
      ...defaultCustomConfig.features,
      ...(features || {}),
    };

    const duration = durationDays || 365; // Default 1 year
    const planDescription = description || `Custom plan: ${campaignLimit} campaigns, ${visitsIncluded.toLocaleString()} visits`;

    // Determine if payment is required (price > 0)
    const requiresPayment = price > 0;

    // Find existing subscription (we'll update it later after payment, or now if free)
    let subscription = await Subscription.findOne({ user: userId });
    const isNewSubscription = !subscription;

    // Create or get Stripe customer
    let stripeCustomerId = subscription?.stripeCustomerId || user.stripeCustomerId;
    
    // Check if it's a placeholder ID (starts with cus_free_ or admin_)
    const isPlaceholderId = !stripeCustomerId || 
                           stripeCustomerId.startsWith('cus_free_') || 
                           stripeCustomerId.startsWith('admin_') ||
                           stripeCustomerId.startsWith('admin_custom_') ||
                           stripeCustomerId.startsWith('admin_assigned_');
    
    if (isPlaceholderId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          metadata: {
            userId: user._id.toString(),
          },
        });
        stripeCustomerId = customer.id;
        
        logger.info("Stripe customer created for custom plan", {
          userId: user._id,
          customerId: stripeCustomerId,
        });
      } catch (stripeError) {
        logger.error("Failed to create Stripe customer", {
          userId: user._id,
          error: stripeError.message,
        });
        return res.status(500).json({
          error: "Failed to create payment customer",
          details: stripeError.message,
        });
      }
    }

    // Only create/update subscription if payment is NOT required (free plan)
    // If payment is required, subscription will be created by webhook after payment
    if (!requiresPayment) {
      if (!subscription) {
        // Create new FREE subscription
        subscription = new Subscription({
          user: userId,
          stripeCustomerId: stripeCustomerId,
          planName: "custom",
          status: "active",
          visitsIncluded: visitsIncluded,
          campaignLimit: campaignLimit,
          visitsUsed: 0,
          features: customFeatures,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
          customPlanDetails: {
            price: price,
            description: planDescription,
            customFeatures: features || {},
          },
          adminAssigned: true,
          assignedBy: req.user.id,
          assignedAt: new Date(),
          assignmentReason: reason || "Admin assigned free custom plan",
        });
      } else {
        // Update existing subscription to FREE custom plan
        const oldPlan = subscription.planName;
        subscription.planName = "custom";
        subscription.status = "active";
        subscription.visitsIncluded = visitsIncluded;
        subscription.campaignLimit = campaignLimit;
        subscription.features = customFeatures;
        subscription.stripeCustomerId = stripeCustomerId;
        subscription.customPlanDetails = {
          price: price,
          description: planDescription,
          customFeatures: features || {},
        };
        subscription.adminAssigned = true;
        subscription.lastModifiedBy = req.user.id;
        subscription.lastModifiedAt = new Date();
        subscription.modificationReason =
          reason || `Admin changed plan from ${oldPlan} to free custom plan`;
        subscription.currentPeriodStart = new Date();
        subscription.currentPeriodEnd = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      }

      await subscription.save();
    }

    let paymentLink = null;
    let pendingPayment = null;

    // Create payment link and pending payment record if payment is required
    if (requiresPayment) {
      try {
        // Create Stripe checkout session with ALL subscription details in metadata
        // Subscription will be created by webhook AFTER payment
        const paymentLinkData = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Custom Plan - ${user.email}`,
                  description: planDescription,
                },
                unit_amount: Math.round(price * 100), // Convert to cents
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId: user._id.toString(),
            planType: "custom",
            isCustomPlanPayment: "true",
            // Store ALL subscription details to create subscription after payment
            visitsIncluded: visitsIncluded.toString(),
            campaignLimit: campaignLimit.toString(),
            price: price.toString(),
            description: planDescription,
            reason: reason || "Admin assigned custom plan",
            durationDays: duration.toString(),
            features: JSON.stringify(customFeatures),
            adminAssignedBy: req.user.id.toString(),
          },
          success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success&plan=custom&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/dashboard?payment=cancelled`,
        });

        paymentLink = paymentLinkData.url;

        logger.info("Checkout session created for custom plan", {
          userId: user._id,
          amount: price,
          checkoutSessionId: paymentLinkData.id,
          metadata: paymentLinkData.metadata,
        });

        // Create pending payment record (NO subscription reference yet - will be created after payment)
        pendingPayment = new Payment({
          user: userId,
          subscription: null, // Will be set after subscription is created by webhook
          stripeCustomerId: stripeCustomerId,
          amount: Math.round(price * 100), // Store in cents
          currency: "usd",
          status: "pending",
          type: "subscription",
          planName: "custom",
          description: `Custom plan payment: ${planDescription}`,
          metadata: {
            checkoutSessionId: paymentLinkData.id,
            paymentLinkUrl: paymentLink,
            visitsIncluded,
            campaignLimit,
            durationDays: duration,
            price,
            description: planDescription,
            reason: reason || "Admin assigned custom plan",
            features: customFeatures,
            adminAssignedBy: req.user.id,
          },
        });

        await pendingPayment.save();

        logger.info("Pending payment record created", {
          userId: user._id,
          paymentId: pendingPayment._id,
          amount: price,
        });

        // Create notification with payment link
        const notification = new Notification({
          user: userId,
          type: "custom_plan_assigned_payment_pending",
          title: "🎉 Custom Plan Assigned - Payment Required",
          message: `A custom plan has been assigned to you! 
          
Plan Details:
• ${campaignLimit} campaigns
• ${visitsIncluded.toLocaleString()} visits per month
• Valid for ${duration} days
• Price: $${price}

Click "Pay Now" to complete your payment and activate your plan.`,
          relatedId: pendingPayment._id,
          relatedModel: "Payment",
          actionUrl: paymentLink,
          actionLabel: "Pay Now",
          metadata: {
            amount: price,
            currency: "USD",
            visitsIncluded,
            campaignLimit,
            durationDays: duration,
            checkoutSessionId: paymentLinkData.id,
          },
        });

        await notification.save();

        logger.info("Payment notification created", {
          userId: user._id,
          notificationId: notification._id,
          paymentLink: paymentLink,
        });
      } catch (paymentError) {
        logger.error("Failed to create payment link or notification", {
          userId: user._id,
          error: paymentError.message,
        });
        
        // Rollback subscription status
        subscription.status = "incomplete";
        await subscription.save();
        
        return res.status(500).json({
          error: "Failed to create payment link",
          details: paymentError.message,
        });
      }
    } else {
      // No payment required - create success notification
      const notification = new Notification({
        user: userId,
        type: "subscription",
        title: "🎉 Custom Plan Activated",
        message: `A free custom plan has been assigned to you!
        
Plan Details:
• ${campaignLimit} campaigns
• ${visitsIncluded.toLocaleString()} visits per month
• Valid for ${duration} days

Your plan is now active and ready to use!`,
        relatedId: subscription._id,
        relatedModel: "Subscription",
        metadata: {
          visitsIncluded,
          campaignLimit,
          durationDays: duration,
        },
      });

      await notification.save();

      logger.info("Free custom plan notification created", {
        userId: user._id,
        notificationId: notification._id,
      });
    }

    // Count current campaigns
    const currentCampaigns = await Campaign.countDocuments({
      user: userId,
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    });

    res.json({
      ok: true,
      message: requiresPayment
        ? `Custom plan assigned to ${user.email}. Payment required to activate.`
        : `Free custom plan activated for ${user.email}`,
      action: isNewSubscription ? "created" : "updated",
      requiresPayment,
      paymentLink: requiresPayment ? paymentLink : null,
      paymentAmount: requiresPayment ? price : 0,
      subscription: subscription ? {
        planName: subscription.planName,
        status: subscription.status,
        visitsIncluded: subscription.visitsIncluded,
        visitsUsed: subscription.visitsUsed,
        campaignLimit: subscription.campaignLimit,
        currentCampaigns: currentCampaigns,
        features: subscription.features,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        customPlanDetails: subscription.customPlanDetails,
        adminAssigned: true,
        assignedBy: req.user.email,
        reason:
          reason ||
          (isNewSubscription
            ? "Admin assigned custom plan"
            : "Admin updated to custom plan"),
      } : {
        // Subscription will be created after payment
        planName: "custom",
        status: "pending_payment",
        visitsIncluded: visitsIncluded,
        campaignLimit: campaignLimit,
        message: "Subscription will be created after payment is completed",
      },
      payment: pendingPayment ? {
        id: pendingPayment._id,
        status: pendingPayment.status,
        amount: price,
        currency: "USD",
      } : null,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Error assigning custom subscription:", error);
    logger.error("Failed to assign custom subscription", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Failed to assign custom subscription",
      details: error.message,
    });
  }
});

// Delete User's Subscription (Reset to free tier)
router.delete("/users/:userId", requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId).select("-password -credits -availableHits");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
      return res.json({
        ok: true,
        message: "User has no subscription to delete",
        user: {
          email: user.email,
        },
      });
    }

    const oldPlan = subscription.planName;

    // Reset to free plan instead of deleting
    const planConfig = Subscription.getPlanConfig("free");
    subscription.planName = "free";
    subscription.status = "active";
    subscription.visitsIncluded = planConfig.visitsIncluded;
    subscription.campaignLimit = planConfig.campaignLimit;
    subscription.features = planConfig.features;
    subscription.visitsUsed = 0;
    subscription.stripeSubscriptionId = null;
    subscription.stripePriceId = null;
    subscription.adminAssigned = true;
    subscription.lastModifiedBy = req.user.id;
    subscription.lastModifiedAt = new Date();
    subscription.modificationReason =
      reason || `Admin reset from ${oldPlan} to free plan`;

    await subscription.save();

    res.json({
      ok: true,
      message: `Subscription reset to free tier for ${user.email}`,
      previousPlan: oldPlan,
      newPlan: "free",
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        visitsIncluded: subscription.visitsIncluded,
        campaignLimit: subscription.campaignLimit,
        features: subscription.features,
      },
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error resetting subscription:", error);
    res.status(500).json({
      error: "Failed to reset subscription",
      details: error.message,
    });
  }
});

module.exports = router;
