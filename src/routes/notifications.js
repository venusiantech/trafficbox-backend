const express = require("express");
const { requireRole } = require("../middleware/auth");
const Notification = require("../models/Notification");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * Get user's notifications
 * GET /api/notifications
 */
router.get("/", requireRole(), async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { user: req.user.id };

    // Filter by read status if provided
    if (isRead !== undefined) {
      query.isRead = isRead === "true";
    }

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user.id, isRead: false }),
    ]);

    res.json({
      ok: true,
      notifications,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
      unreadCount,
    });
  } catch (error) {
    logger.error("Failed to get notifications", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put("/:id/read", requireRole(), async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({
      ok: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    logger.error("Failed to mark notification as read", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
router.put("/read-all", requireRole(), async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({
      ok: true,
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error("Failed to mark all notifications as read", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
router.delete("/:id", requireRole(), async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({
      ok: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete notification", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
router.get("/unread-count", requireRole(), async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    res.json({
      ok: true,
      unreadCount,
    });
  } catch (error) {
    logger.error("Failed to get unread count", {
      userId: req.user.id,
      error: error.message,
    });
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

module.exports = router;
