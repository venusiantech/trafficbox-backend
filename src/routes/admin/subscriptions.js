const express = require("express");
const { requireRole } = require("../../middleware/auth");
const User = require("../../models/User");
const Subscription = require("../../models/Subscription");
const Campaign = require("../../models/Campaign");

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

    // Find or create subscription
    let subscription = await Subscription.findOne({ user: userId });
    const isNewSubscription = !subscription;

    const duration = durationDays || 365; // Default 1 year

    if (!subscription) {
      // Create new subscription with custom plan
      subscription = new Subscription({
        user: userId,
        stripeCustomerId:
          user.stripeCustomerId || `admin_custom_${userId}`,
        planName: "custom",
        status: "active",
        visitsIncluded: visitsIncluded,
        campaignLimit: campaignLimit,
        visitsUsed: 0,
        features: customFeatures,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(
          Date.now() + duration * 24 * 60 * 60 * 1000
        ),
        customPlanDetails: {
          price: price,
          description:
            description || `Custom plan for ${user.email}`,
          customFeatures: features || {},
        },
        adminAssigned: true,
        assignedBy: req.user.id,
        assignedAt: new Date(),
        assignmentReason:
          reason || "Admin assigned custom plan",
      });
    } else {
      // Update existing subscription to custom plan
      const oldPlan = subscription.planName;

      subscription.planName = "custom";
      subscription.status = "active";
      subscription.visitsIncluded = visitsIncluded;
      subscription.campaignLimit = campaignLimit;
      subscription.features = customFeatures;
      subscription.customPlanDetails = {
        price: price,
        description:
          description || `Custom plan for ${user.email}`,
        customFeatures: features || {},
      };
      subscription.adminAssigned = true;
      subscription.lastModifiedBy = req.user.id;
      subscription.lastModifiedAt = new Date();
      subscription.modificationReason =
        reason ||
        `Admin changed plan from ${oldPlan} to custom plan`;

      // Reset period
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(
        Date.now() + duration * 24 * 60 * 60 * 1000
      );
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
        ? `Custom subscription assigned successfully to ${user.email}`
        : `Subscription updated to custom plan for ${user.email}`,
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
        customPlanDetails: subscription.customPlanDetails,
        adminAssigned: true,
        assignedBy: req.user.email,
        reason:
          reason ||
          (isNewSubscription
            ? "Admin assigned custom plan"
            : "Admin updated to custom plan"),
      },
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Error assigning custom subscription:", error);
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
