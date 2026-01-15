const mongoose = require("mongoose");

const customPlanRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    campaignCount: {
      type: Number,
      required: true,
      min: 1,
    },
    creditLimit: {
      type: String, // e.g., "1M", "2M", "5M", "10M", etc.
      required: true,
    },
    additionalNotes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "approved", "rejected"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
customPlanRequestSchema.index({ user: 1, createdAt: -1 });
customPlanRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("CustomPlanRequest", customPlanRequestSchema);
