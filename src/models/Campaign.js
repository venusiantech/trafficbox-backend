const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String },
    urls: { type: [String], default: [] },
    duration_min: Number,
    duration_max: Number,
    countries: { type: [String], default: [] },
    rule: { type: String, enum: ["all", "any", "except"], default: "any" },
    capping_type: { type: String },
    capping_value: Number,
    max_hits: Number,
    until_date: Date,
    macros: { type: String },
    popup_macros: { type: String },
    is_adult: { type: Boolean, default: false },
    is_coin_mining: { type: Boolean, default: false },
    state: { type: String },
    nine_hits_campaign_id: { type: Number, index: true },
    nine_hits_data: { type: Object }, // store full 9Hits campaign data
    spark_traffic_project_id: { type: String, index: true }, // SparkTraffic project ID
    spark_traffic_data: { type: Object }, // store full SparkTraffic project data
    is_archived: { type: Boolean, default: false }, // Soft delete flag
    archived_at: { type: Date }, // When campaign was archived
    delete_eligible: { type: Boolean, default: false }, // Can be permanently deleted after 7 days
    last_sync_at: Date,
    last_stats_check: { type: Date }, // Last time we checked for stats to deduct credits
    total_hits_counted: { type: Number, default: 0 }, // Total hits we've already counted for credit deduction
    total_visits_counted: { type: Number, default: 0 }, // Total visits we've already counted
    credit_deduction_enabled: { type: Boolean, default: true }, // Enable/disable automatic credit deduction
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
