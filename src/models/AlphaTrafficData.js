const mongoose = require("mongoose");

const alphaTrafficDataSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    sparkTrafficProjectId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // Core metrics from SparkTraffic
    hits: {
      type: Number,
      default: 0,
    },
    visits: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    uniqueVisitors: {
      type: Number,
      default: 0,
    },
    // Performance metrics
    speed: {
      type: Number,
      default: 0,
    },
    bounceRate: {
      type: Number,
      default: 0,
    },
    avgSessionDuration: {
      type: Number,
      default: 0,
    },
    // Country-specific data from SparkTraffic
    countryBreakdown: [
      {
        country: String,
        hits: { type: Number, default: 0 },
        visits: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      },
    ],
    // Daily breakdown data
    dailyStats: {
      type: Map,
      of: {
        hits: { type: Number, default: 0 },
        visits: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
      },
    },
    // Project status
    projectStatus: {
      type: String,
      enum: ["active", "paused", "stopped", "completed", "unknown"],
      default: "active",
    },
    // Raw SparkTraffic response for debugging
    rawSparkTrafficData: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Collection metadata
    collectionSource: {
      type: String,
      enum: ["auto", "manual", "webhook"],
      default: "auto",
    },
    dataQuality: {
      type: String,
      enum: ["complete", "partial", "error"],
      default: "complete",
    },
  },
  {
    timestamps: true,
    // Add TTL index for automatic cleanup after 90 days
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
  }
);

// Compound indexes for efficient queries
alphaTrafficDataSchema.index({ campaign: 1, timestamp: -1 });
alphaTrafficDataSchema.index({ sparkTrafficProjectId: 1, timestamp: -1 });
alphaTrafficDataSchema.index({ campaign: 1, projectStatus: 1, timestamp: -1 });

// Index for time-based queries
alphaTrafficDataSchema.index({ timestamp: -1 });

module.exports = mongoose.model("AlphaTrafficData", alphaTrafficDataSchema);
