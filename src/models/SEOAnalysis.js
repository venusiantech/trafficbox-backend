const mongoose = require("mongoose");

const seoAnalysisSchema = new mongoose.Schema(
  {
    // Reference to user who requested the analysis
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Analysis identification
    analysisId: {
      type: String,
      required: true,
      unique: true,
    },

    // Analyzed URL
    url: {
      type: String,
      required: true,
      index: true,
    },

    // SEO Analysis breakdown scores (from overall_score.breakdown)
    scores: {
      meta: { type: Number, min: 0, max: 100 },
      content: { type: Number, min: 0, max: 100 },
      technical: { type: Number, min: 0, max: 100 },
      performance: { type: Number, min: 0, max: 100 },
      mobile: { type: Number, min: 0, max: 100 },
      security: { type: Number, min: 0, max: 100 },
      accessibility: { type: Number, min: 0, max: 100 },
    },
    
    // Overall SEO score
    totalScore: { type: Number, min: 0, max: 100 },
    grade: { type: String }, // A, B, C, D, F
    scoreStatus: { type: String }, // excellent, good, average, poor
    
    // Lighthouse scores (separate from SEO breakdown)
    lighthouseScores: {
      performance: { type: Number, min: 0, max: 100 },
      accessibility: { type: Number, min: 0, max: 100 },
      bestPractices: { type: Number, min: 0, max: 100 },
      seo: { type: Number, min: 0, max: 100 },
      pwa: { type: Number, min: 0, max: 100 },
    },

    // Key metrics (extracted from report)
    metrics: {
      firstContentfulPaint: { type: Number }, // in milliseconds
      largestContentfulPaint: { type: Number },
      totalBlockingTime: { type: Number },
      cumulativeLayoutShift: { type: Number },
      speedIndex: { type: Number },
      timeToInteractive: { type: Number },
    },

    // S3 Storage paths
    s3Paths: {
      fullReportJson: {
        type: mongoose.Schema.Types.Mixed,
        description: "S3 object metadata or URL to full JSON report",
      },
      lighthouseScreenshot: {
        type: mongoose.Schema.Types.Mixed,
        description: "S3 object metadata or URL for lighthouse screenshot",
      },
      additionalImages: [
        mongoose.Schema.Types.Mixed
      ],
    },

    // Metadata
    includeBacklinks: {
      type: Boolean,
      default: false,
    },

    backlinkCount: {
      type: Number,
      default: 0,
    },

    // Analysis status
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "completed",
    },

    // Error tracking
    error: {
      type: String,
    },

    // Processing time (in seconds)
    processingTime: {
      type: Number,
    },

    // File sizes (for monitoring)
    fileSizes: {
      originalResponseBytes: { type: Number },
      optimizedResponseBytes: { type: Number },
    },

    // AI Provider metadata
    aiProvider: {
      type: String,
      default: "aaddyy",
    },

    // Expiry (optional - for cleanup)
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
seoAnalysisSchema.index({ user: 1, createdAt: -1 });
seoAnalysisSchema.index({ url: 1, createdAt: -1 });
seoAnalysisSchema.index({ analysisId: 1 });
seoAnalysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for frontend-friendly response (use totalScore if available)
seoAnalysisSchema.virtual("overallScore").get(function () {
  // Use totalScore if available (from overall_score.total)
  if (this.totalScore !== null && this.totalScore !== undefined) {
    return Math.round(this.totalScore);
  }
  
  // Fallback to average of breakdown scores
  const scores = this.scores;
  const validScores = Object.values(scores).filter(
    (score) => score !== null && score !== undefined
  );
  if (validScores.length === 0) return null;
  return Math.round(
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length
  );
});

// Ensure virtuals are included in JSON
seoAnalysisSchema.set("toJSON", { virtuals: true });
seoAnalysisSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SEOAnalysis", seoAnalysisSchema);
