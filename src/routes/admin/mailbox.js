const express = require("express");
const { requireRole } = require("../../middleware/auth");
const CustomPlanRequest = require("../../models/CustomPlanRequest");
const ContactUsMessage = require("../../models/ContactUsMessage");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const logger = require("../../utils/logger");

const router = express.Router();

/**
 * Get all custom plan requests
 * GET /api/admin/mailbox/custom-plan-requests
 */
router.get("/custom-plan-requests", requireRole("admin"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [requests, totalCount] = await Promise.all([
      CustomPlanRequest.find(query)
        .populate("user", "email firstName lastName")
        .populate("reviewedBy", "email firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      CustomPlanRequest.countDocuments(query),
    ]);

    // Get status counts
    const statusCounts = await CustomPlanRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCountsMap = {};
    statusCounts.forEach((item) => {
      statusCountsMap[item._id] = item.count;
    });

    res.json({
      ok: true,
      requests,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
      statusCounts: statusCountsMap,
    });
  } catch (error) {
    logger.error("Failed to get custom plan requests", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get custom plan requests" });
  }
});

/**
 * Update custom plan request status
 * PUT /api/admin/mailbox/custom-plan-requests/:id
 */
router.put("/custom-plan-requests/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["pending", "reviewed", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const request = await CustomPlanRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const oldStatus = request.status;
    request.status = status;
    if (adminNotes !== undefined) {
      request.adminNotes = adminNotes;
    }
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();

    await request.save();

    // Create notification for the user when status changes
    if (oldStatus !== status) {
      let notificationMessage = "";
      let notificationTitle = "";

      if (status === "approved") {
        notificationTitle = "Custom Plan Request Approved! 🎉";
        notificationMessage = `Great news! Your custom plan request for ${request.campaignCount} campaigns with ${request.creditLimit} visits has been approved. ${adminNotes ? "Note: " + adminNotes : "Our team will contact you soon to set it up."}`;
      } else if (status === "rejected") {
        notificationTitle = "Custom Plan Request Update";
        notificationMessage = `Your custom plan request has been reviewed. ${adminNotes || "Please contact support for more information."}`;
      } else if (status === "reviewed") {
        notificationTitle = "Custom Plan Request Under Review";
        notificationMessage = `Your custom plan request is being reviewed by our team. ${adminNotes || "We'll update you soon."}`;
      }

      if (notificationMessage) {
        const notification = new Notification({
          user: request.user,
          type: "custom_plan_request_updated",
          title: notificationTitle,
          message: notificationMessage,
          relatedId: request._id,
          relatedModel: "CustomPlanRequest",
        });
        await notification.save();
      }
    }

    const populatedRequest = await CustomPlanRequest.findById(id)
      .populate("user", "email firstName lastName")
      .populate("reviewedBy", "email firstName lastName");

    logger.info("Custom plan request updated", {
      requestId: id,
      oldStatus,
      newStatus: status,
      reviewedBy: req.user.email,
    });

    res.json({
      ok: true,
      message: "Request updated successfully",
      request: populatedRequest,
    });
  } catch (error) {
    logger.error("Failed to update custom plan request", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to update request" });
  }
});

/**
 * Get all contact us messages
 * GET /api/admin/mailbox/contact-us-messages
 */
router.get("/contact-us-messages", requireRole("admin"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [messages, totalCount] = await Promise.all([
      ContactUsMessage.find(query)
        .populate("user", "email firstName lastName")
        .populate("repliedBy", "email firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      ContactUsMessage.countDocuments(query),
    ]);

    // Get status counts
    const statusCounts = await ContactUsMessage.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCountsMap = {};
    statusCounts.forEach((item) => {
      statusCountsMap[item._id] = item.count;
    });

    res.json({
      ok: true,
      messages,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
      statusCounts: statusCountsMap,
    });
  } catch (error) {
    logger.error("Failed to get contact us messages", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get contact us messages" });
  }
});

/**
 * Update contact us message status
 * PUT /api/admin/mailbox/contact-us-messages/:id
 */
router.put("/contact-us-messages/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["new", "read", "replied", "archived"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const message = await ContactUsMessage.findById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const oldStatus = message.status;
    message.status = status;
    if (adminNotes !== undefined) {
      message.adminNotes = adminNotes;
    }
    
    // If status is being set to "replied", record who replied and when
    if (status === "replied") {
      message.repliedBy = req.user.id;
      message.repliedAt = new Date();
    }

    await message.save();

    // Create notification for the user when replied (only if user exists)
    if (message.user && status === "replied" && oldStatus !== "replied") {
      const notification = new Notification({
        user: message.user,
        type: "contact_us_replied",
        title: "We Responded to Your Message! 📧",
        message: `We've replied to your message: "${message.subject}". ${adminNotes ? adminNotes : "Please check your email for our response."}`,
        relatedId: message._id,
        relatedModel: "ContactUsMessage",
      });
      await notification.save();
    }

    const populatedMessage = await ContactUsMessage.findById(id)
      .populate("user", "email firstName lastName")
      .populate("repliedBy", "email firstName lastName");

    logger.info("Contact us message updated", {
      messageId: id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user.email,
      notificationSent: message.user && status === "replied" && oldStatus !== "replied",
    });

    res.json({
      ok: true,
      message: "Message updated successfully",
      data: populatedMessage,
    });
  } catch (error) {
    logger.error("Failed to update contact us message", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to update message" });
  }
});

/**
 * Get mailbox overview/stats
 * GET /api/admin/mailbox/overview
 */
router.get("/overview", requireRole("admin"), async (req, res) => {
  try {
    const [
      totalCustomPlanRequests,
      pendingCustomPlanRequests,
      totalContactUsMessages,
      newContactUsMessages,
      recentCustomPlanRequests,
      recentContactUsMessages,
    ] = await Promise.all([
      CustomPlanRequest.countDocuments(),
      CustomPlanRequest.countDocuments({ status: "pending" }),
      ContactUsMessage.countDocuments(),
      ContactUsMessage.countDocuments({ status: "new" }),
      CustomPlanRequest.find({})
        .populate("user", "email firstName lastName")
        .sort({ createdAt: -1 })
        .limit(5),
      ContactUsMessage.find({})
        .populate("user", "email firstName lastName")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.json({
      ok: true,
      overview: {
        customPlanRequests: {
          total: totalCustomPlanRequests,
          pending: pendingCustomPlanRequests,
          recent: recentCustomPlanRequests,
        },
        contactUsMessages: {
          total: totalContactUsMessages,
          new: newContactUsMessages,
          recent: recentContactUsMessages,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to get mailbox overview", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get mailbox overview" });
  }
});

/**
 * Delete a custom plan request
 * DELETE /api/admin/mailbox/custom-plan-requests/:id
 */
router.delete("/custom-plan-requests/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const request = await CustomPlanRequest.findByIdAndDelete(id);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    logger.info("Custom plan request deleted", {
      requestId: id,
      deletedBy: req.user.email,
    });

    res.json({
      ok: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete custom plan request", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to delete request" });
  }
});

/**
 * Delete a contact us message
 * DELETE /api/admin/mailbox/contact-us-messages/:id
 */
router.delete("/contact-us-messages/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ContactUsMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    logger.info("Contact us message deleted", {
      messageId: id,
      deletedBy: req.user.email,
    });

    res.json({
      ok: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete contact us message", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
