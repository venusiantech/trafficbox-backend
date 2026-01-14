const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String },
    urls: { type: [String], default: [] },
    duration_min: Number,
    duration_max: Number,
    countries: {
      type: mongoose.Schema.Types.Mixed, // Allow both old format (strings) and new format (objects)
      default: [],
      validate: {
        validator: function (value) {
          if (!Array.isArray(value)) return true; // Allow empty or non-array values

          // Check if it's the old format (array of strings) - this is valid for existing campaigns
          if (value.length > 0 && typeof value[0] === "string") {
            return true; // Old format is valid
          }

          // Check if it's the new format (array of objects with country and percent)
          if (
            value.length > 0 &&
            typeof value[0] === "object" &&
            value[0] !== null
          ) {
            return value.every(
              (item) =>
                item.country &&
                typeof item.country === "string" &&
                typeof item.percent === "number" &&
                item.percent >= 0 &&
                item.percent <= 1
            );
          }

          return true; // Empty array is valid
        },
        message:
          "Countries must be either an array of country codes (old format) or an array of objects with country and percent fields (new format)",
      },
    },
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
    last_stats_check: { type: Date }, // Last time we checked for stats to deduct visits
    total_hits_counted: { type: Number, default: 0 }, // Total hits we've already counted for visit deduction
    total_visits_counted: { type: Number, default: 0 }, // Total visits we've already counted
    credit_deduction_enabled: { type: Boolean, default: true }, // Enable/disable automatic credit deduction
    transfer_history: [{
      from_user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      to_user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      transferred_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      transferred_at: { type: Date, default: Date.now },
      reason: { type: String, default: "Admin transfer" },
      admin_email: { type: String }
    }],
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
