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
    last_sync_at: Date,
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
