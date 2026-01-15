const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "custom_plan_request_submitted",
        "custom_plan_request_updated",
        "custom_plan_assigned_payment_pending",
        "custom_plan_payment_completed",
        "contact_us_submitted",
        "contact_us_replied",
        "system",
        "campaign",
        "subscription",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      // Can reference CustomPlanRequest, ContactUsMessage, Campaign, etc.
    },
    relatedModel: {
      type: String,
      enum: ["CustomPlanRequest", "ContactUsMessage", "Campaign", "Subscription", "Payment"],
    },
    actionUrl: {
      type: String,
      // For payment links, action buttons, etc.
    },
    actionLabel: {
      type: String,
      // Label for the action button (e.g., "Pay Now", "View Details")
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      // Additional data like payment details, amounts, etc.
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
