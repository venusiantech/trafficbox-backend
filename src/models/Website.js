const mongoose = require("mongoose");

const websiteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    title: { type: String },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Website", websiteSchema);
