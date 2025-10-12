const mongoose = require("mongoose");

const campaignDailyStatSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      index: true,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    }, // UTC date truncated to day (YYYY-MM-DD 00:00:00Z)
    hits: {
      type: Number,
      default: 0,
    },
    visits: {
      type: Number,
      default: 0,
    },
    // Store country breakdown for this day
    countryStats: [
      {
        country: String,
        hits: { type: Number, default: 0 },
        visits: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

// Ensure unique combination of campaign and date
campaignDailyStatSchema.index({ campaign: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("CampaignDailyStat", campaignDailyStatSchema);
