const express = require("express");
const { requireRole } = require("../middleware/auth");
const CustomPlanRequest = require("../models/CustomPlanRequest");
const ContactUsMessage = require("../models/ContactUsMessage");
const Notification = require("../models/Notification");
const User = require("../models/User");
const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * Optional JWT extraction middleware
 * Extracts user from JWT if present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // Token invalid or expired, but we don't fail - just continue without user
    logger.debug("Optional auth failed", { error: error.message });
  }
  next();
};

/**
 * Submit a Custom Plan Request
 * POST /api/forms/custom-plan-request
 * Auth is now optional - works with or without JWT
 */
router.post("/custom-plan-request", optionalAuth, async (req, res) => {
  try {
    const { email, campaignCount, creditLimit, additionalNotes } = req.body;

    // Validation
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (!campaignCount || campaignCount < 1) {
      return res.status(400).json({
        error: "Campaign count is required and must be at least 1",
      });
    }

    if (!creditLimit || !creditLimit.trim()) {
      return res.status(400).json({
        error: "Credit limit is required (e.g., '1M', '2M', '5M')",
      });
    }

    // Try to find user by email (from JWT or from email field)
    let userId = req.user ? req.user.id : null;
    
    // If no JWT, try to find user by email
    if (!userId) {
      const user = await User.findOne({ email: email.trim().toLowerCase() });
      if (user) {
        userId = user._id;
      } else {
        // User doesn't exist, can't create request without account
        return res.status(400).json({
          error: "No account found with this email. Please register first or login.",
        });
      }
    }

    // Create the custom plan request
    const customPlanRequest = new CustomPlanRequest({
      user: userId,
      campaignCount: parseInt(campaignCount),
      creditLimit: creditLimit.trim(),
      additionalNotes: additionalNotes || "",
    });

    await customPlanRequest.save();

    // Create notification for the user
    const notification = new Notification({
      user: userId,
      type: "custom_plan_request_submitted",
      title: "Custom Plan Request Submitted",
      message: `Your custom plan request for ${campaignCount} campaigns with ${creditLimit} visits has been submitted successfully. Our team will review it soon.`,
      relatedId: customPlanRequest._id,
      relatedModel: "CustomPlanRequest",
    });
    await notification.save();

    logger.info("Custom plan request submitted", {
      userId,
      email: email.trim().toLowerCase(),
      requestId: customPlanRequest._id,
      campaignCount,
      creditLimit,
    });

    res.status(201).json({
      ok: true,
      message: "Custom plan request submitted successfully. Our team will contact you soon.",
      request: {
        id: customPlanRequest._id,
        campaignCount: customPlanRequest.campaignCount,
        creditLimit: customPlanRequest.creditLimit,
        status: customPlanRequest.status,
        createdAt: customPlanRequest.createdAt,
      },
    });
  } catch (error) {
    logger.error("Failed to submit custom plan request", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to submit custom plan request" });
  }
});

/**
 * Get user's own custom plan requests
 * GET /api/forms/custom-plan-request
 */
router.get("/custom-plan-request", requireRole(), async (req, res) => {
  try {
    const requests = await CustomPlanRequest.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select("-adminNotes -reviewedBy");

    res.json({
      ok: true,
      requests,
    });
  } catch (error) {
    logger.error("Failed to get custom plan requests", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get custom plan requests" });
  }
});

/**
 * Submit a Contact Us Message
 * POST /api/forms/contact-us
 * Note: This endpoint can be used by both logged-in and non-logged-in users
 * Automatically links to user if email matches existing account
 */
router.post("/contact-us", optionalAuth, async (req, res) => {
  try {
    const { fullName, email, subject, message } = req.body;

    // Validation
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: "Subject is required" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Try to find user by email (from JWT or by searching email)
    let userId = req.user ? req.user.id : null;
    
    // If no JWT, try to find user by email
    if (!userId) {
      const user = await User.findOne({ email: email.trim().toLowerCase() });
      if (user) {
        userId = user._id;
      }
    }

    // Create the contact us message
    const contactUsMessage = new ContactUsMessage({
      user: userId, // Link to user if found, null if guest
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    await contactUsMessage.save();

    // Create notification if user exists
    if (userId) {
      const notification = new Notification({
        user: userId,
        type: "contact_us_submitted",
        title: "Contact Message Received",
        message: `We received your message: "${subject.trim()}". Our team will respond soon.`,
        relatedId: contactUsMessage._id,
        relatedModel: "ContactUsMessage",
      });
      await notification.save();
    }

    logger.info("Contact us message submitted", {
      messageId: contactUsMessage._id,
      email: contactUsMessage.email,
      subject: contactUsMessage.subject,
      userId: userId || "guest",
      linkedToUser: !!userId,
    });

    res.status(201).json({
      ok: true,
      message: "Thank you for contacting us! We will get back to you soon.",
      messageId: contactUsMessage._id,
    });
  } catch (error) {
    logger.error("Failed to submit contact us message", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to submit message" });
  }
});

module.exports = router;
