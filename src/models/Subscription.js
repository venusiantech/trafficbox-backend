const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // Stripe identifiers
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
    },
    stripePriceId: {
      type: String,
    },
    stripeProductId: {
      type: String,
    },

    // Subscription details
    planName: {
      type: String,
      enum: ["free", "starter", "growth", "business", "premium"],
      default: "free",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
      ],
      default: "active",
    },

    // Plan limits
    visitsIncluded: {
      type: Number,
      default: 1000,
    },
    campaignLimit: {
      type: Number,
      default: 1,
    },
    currentCampaignCount: {
      type: Number,
      default: 0,
    },

    // Features
    features: {
      countryTargeting: {
        type: String,
        enum: ["global", "select", "advanced"],
        default: "global",
      },
      trafficSources: {
        type: String,
        enum: ["none", "limited", "country-based", "unlimited", "advanced"],
        default: "none",
      },
      behaviorSettings: {
        type: String,
        enum: [
          "none",
          "bounce-rate",
          "advanced",
          "advanced-rules",
          "full-suite",
        ],
        default: "none",
      },
      campaignRenewal: {
        type: String,
        enum: [
          "manual",
          "time-based",
          "detailed-metrics",
          "dedicated-api",
          "fully-automated",
        ],
        default: "manual",
      },
      support: {
        type: String,
        enum: ["email", "priority", "dedicated-manager", "24-7-priority"],
        default: "email",
      },
      analytics: {
        type: String,
        enum: [
          "basic",
          "standard",
          "advanced",
          "advanced-export",
          "realtime-api",
        ],
        default: "basic",
      },
    },

    // Billing
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
    },

    // Tracking
    visitsUsed: {
      type: Number,
      default: 0,
    },
    lastResetAt: {
      type: Date,
      default: Date.now,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

// Method to check if user can create a campaign
subscriptionSchema.methods.canCreateCampaign = function () {
  if (this.status !== "active" && this.status !== "trialing") {
    return {
      allowed: false,
      reason: "Subscription is not active",
    };
  }

  if (this.currentCampaignCount >= this.campaignLimit) {
    return {
      allowed: false,
      reason: `Campaign limit reached for ${this.planName} plan. You have ${this.currentCampaignCount}/${this.campaignLimit} campaigns.`,
    };
  }

  if (this.visitsUsed >= this.visitsIncluded) {
    return {
      allowed: false,
      reason: `Visit limit reached for ${this.planName} plan. You have used ${this.visitsUsed}/${this.visitsIncluded} visits.`,
    };
  }

  return {
    allowed: true,
    reason: null,
  };
};

// Method to check if feature is available
subscriptionSchema.methods.hasFeature = function (feature, requiredLevel) {
  const featureValue = this.features[feature];
  return featureValue === requiredLevel;
};

// Static method to get plan configuration
subscriptionSchema.statics.getPlanConfig = function (planName) {
  const plans = {
    free: {
      planName: "free",
      visitsIncluded: 1000,
      campaignLimit: 1,
      price: 0,
      features: {
        countryTargeting: "global",
        trafficSources: "none",
        behaviorSettings: "none",
        campaignRenewal: "manual",
        support: "email",
        analytics: "basic",
      },
    },
    starter: {
      planName: "starter",
      visitsIncluded: 50000,
      campaignLimit: 2,
      price: 49,
      features: {
        countryTargeting: "global",
        trafficSources: "limited",
        behaviorSettings: "bounce-rate",
        campaignRenewal: "time-based",
        support: "email",
        analytics: "standard",
      },
    },
    growth: {
      planName: "growth",
      visitsIncluded: 250000,
      campaignLimit: 3,
      price: 199,
      features: {
        countryTargeting: "select",
        trafficSources: "country-based",
        behaviorSettings: "advanced",
        campaignRenewal: "detailed-metrics",
        support: "priority",
        analytics: "advanced",
      },
    },
    business: {
      planName: "business",
      visitsIncluded: 500000,
      campaignLimit: 5,
      price: 349,
      features: {
        countryTargeting: "select",
        trafficSources: "unlimited",
        behaviorSettings: "advanced-rules",
        campaignRenewal: "dedicated-api",
        support: "dedicated-manager",
        analytics: "advanced-export",
      },
    },
    premium: {
      planName: "premium",
      visitsIncluded: 1000000,
      campaignLimit: 10,
      price: 599,
      features: {
        countryTargeting: "advanced",
        trafficSources: "advanced",
        behaviorSettings: "full-suite",
        campaignRenewal: "fully-automated",
        support: "24-7-priority",
        analytics: "realtime-api",
      },
    },
  };

  return plans[planName] || plans.free;
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
