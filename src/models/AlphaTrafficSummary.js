const mongoose = require("mongoose");

// Define time ranges for Alpha traffic tracking
const ALPHA_TIME_RANGES = {
  "1m": { label: "1 minute", seconds: 60 },
  "15m": { label: "15 minutes", seconds: 900 },
  "1h": { label: "1 hour", seconds: 3600 },
  "7d": { label: "7 days", seconds: 604800 },
  "30d": { label: "30 days", seconds: 2592000 },
};

const alphaTrafficSummarySchema = new mongoose.Schema(
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
    timeRange: {
      type: String,
      required: true,
      enum: Object.keys(ALPHA_TIME_RANGES),
    },
    windowStart: {
      type: Date,
      required: true,
      index: true,
    },
    windowEnd: {
      type: Date,
      required: true,
    },
    // Aggregated metrics for this time window
    totalHits: {
      type: Number,
      default: 0,
    },
    totalVisits: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    uniqueVisitors: {
      type: Number,
      default: 0,
    },
    // Performance metrics
    avgSpeed: {
      type: Number,
      default: 0,
    },
    maxSpeed: {
      type: Number,
      default: 0,
    },
    minSpeed: {
      type: Number,
      default: 0,
    },
    avgBounceRate: {
      type: Number,
      default: 0,
    },
    avgSessionDuration: {
      type: Number,
      default: 0,
    },
    // Peak metrics within the window
    peakHitsPerMinute: {
      type: Number,
      default: 0,
    },
    peakVisitsPerMinute: {
      type: Number,
      default: 0,
    },
    // Growth metrics
    hitGrowthRate: {
      type: Number,
      default: 0,
    },
    visitGrowthRate: {
      type: Number,
      default: 0,
    },
    // Country breakdown for this time window
    countryBreakdown: [
      {
        country: String,
        hits: { type: Number, default: 0 },
        visits: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        growth: { type: Number, default: 0 },
      },
    ],
    // Top performing countries
    topCountries: [
      {
        country: String,
        hits: Number,
        percentage: Number,
        rank: Number,
      },
    ],
    // Time series data for graphs
    timeSeriesData: [
      {
        timestamp: Date,
        hits: { type: Number, default: 0 },
        visits: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
      },
    ],
    // Window metadata
    dataPointsCount: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    dataQuality: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good",
    },
  },
  {
    timestamps: true,
    // Add TTL index for automatic cleanup
    expireAfterSeconds: 180 * 24 * 60 * 60, // 180 days
  }
);

// Unique constraint for campaign + timeRange + windowStart
alphaTrafficSummarySchema.index(
  { campaign: 1, timeRange: 1, windowStart: 1 },
  { unique: true }
);

// Index for efficient time-based queries
alphaTrafficSummarySchema.index({ campaign: 1, timeRange: 1, windowEnd: -1 });
alphaTrafficSummarySchema.index({
  sparkTrafficProjectId: 1,
  timeRange: 1,
  windowStart: -1,
});

// Static method to get time range configuration
alphaTrafficSummarySchema.statics.getTimeRanges = function () {
  return ALPHA_TIME_RANGES;
};

// Method to check if window is current
alphaTrafficSummarySchema.methods.isCurrentWindow = function () {
  const now = new Date();
  return now >= this.windowStart && now <= this.windowEnd;
};

// Method to get window duration in seconds
alphaTrafficSummarySchema.methods.getWindowDurationSeconds = function () {
  return ALPHA_TIME_RANGES[this.timeRange].seconds;
};

// Method to calculate completion percentage
alphaTrafficSummarySchema.methods.getCompletionPercentage = function () {
  const now = new Date();
  const totalDuration = this.windowEnd - this.windowStart;
  const elapsed = Math.min(now - this.windowStart, totalDuration);
  return Math.round((elapsed / totalDuration) * 100);
};

module.exports = mongoose.model(
  "AlphaTrafficSummary",
  alphaTrafficSummarySchema
);
