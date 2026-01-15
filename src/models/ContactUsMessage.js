const mongoose = require("mongoose");

const contactUsMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional - can be from non-logged-in users
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["new", "read", "replied", "archived"],
      default: "new",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    repliedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
contactUsMessageSchema.index({ email: 1, createdAt: -1 });
contactUsMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ContactUsMessage", contactUsMessageSchema);
