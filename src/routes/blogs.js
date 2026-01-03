const express = require("express");
const router = express.Router();
const { authenticateJWT, requireAdmin } = require("../middleware/auth");
const Blog = require("../models/Blog");
const { logger } = require("../utils/logger");

// GET all published blogs (public endpoint)
router.get("/public", async (req, res) => {
  try {
    const blogs = await Blog.find({ isPublished: true })
      .populate("author", "firstName lastName")
      .sort({ order: 1, createdAt: -1 })
      .select(
        "title slug content summary imageUrl author createdAt updatedAt order"
      );

    res.json({
      status: "success",
      blogs: blogs,
    });
  } catch (error) {
    logger.error("Error fetching public blogs:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// GET single published blog by slug (public endpoint)
router.get("/public/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const blog = await Blog.findOne({ slug, isPublished: true })
      .populate("author", "firstName lastName")
      .select("title slug content summary imageUrl author createdAt updatedAt");

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    res.json({
      status: "success",
      blog: blog,
    });
  } catch (error) {
    logger.error("Error fetching public blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// GET all blogs (admin only)
router.get("/", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const blogs = await Blog.find({})
      .populate("author", "firstName lastName email")
      .sort({ order: 1, createdAt: -1 });

    res.json({
      status: "success",
      blogs: blogs,
    });
  } catch (error) {
    logger.error("Error fetching blogs:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// GET single blog by ID (admin only)
router.get("/:id", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const blogId = req.params.id;

    const blog = await Blog.findById(blogId).populate(
      "author",
      "firstName lastName email"
    );

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    res.json({
      status: "success",
      blog: blog,
    });
  } catch (error) {
    logger.error("Error fetching blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// CREATE new blog (admin only)
router.post("/", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { title, content, slug, imageUrl, summary, isPublished, order } =
      req.body;

    // Validate required fields
    if (!title || !content || !slug) {
      return res.status(400).json({
        status: "error",
        message: "Title, content, and slug are required",
      });
    }

    // Check if slug exists
    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      return res.status(400).json({
        status: "error",
        message: "Blog with this slug already exists",
      });
    }

    // Create new blog
    const newBlog = new Blog({
      title,
      slug,
      content,
      imageUrl,
      summary,
      author: req.user.id,
      isPublished: isPublished !== undefined ? isPublished : true,
      order: order || 0,
    });

    await newBlog.save();

    // Populate author details for response
    await newBlog.populate("author", "firstName lastName email");

    res.status(201).json({
      status: "success",
      message: "Blog created successfully",
      blog: newBlog,
    });
  } catch (error) {
    logger.error("Error creating blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// UPDATE blog (admin only)
router.put("/:id", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const blogId = req.params.id;

    // Find blog
    const blog = await Blog.findById(blogId);

    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    const { title, content, slug, imageUrl, summary, isPublished, order } =
      req.body;

    // Check if new slug exists (if slug is being changed)
    if (slug && slug !== blog.slug) {
      const existingBlog = await Blog.findOne({ slug });
      if (existingBlog) {
        return res.status(400).json({
          status: "error",
          message: "Blog with this slug already exists",
        });
      }
    }

    // Update fields
    if (title) blog.title = title;
    if (content) blog.content = content;
    if (slug) blog.slug = slug;
    if (imageUrl !== undefined) blog.imageUrl = imageUrl;
    if (summary !== undefined) blog.summary = summary;
    if (isPublished !== undefined) blog.isPublished = isPublished;
    if (order !== undefined) blog.order = order;

    await blog.save();

    // Populate author details for response
    await blog.populate("author", "firstName lastName email");

    res.json({
      status: "success",
      message: "Blog updated successfully",
      blog: blog,
    });
  } catch (error) {
    logger.error("Error updating blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// DELETE blog (admin only)
router.delete("/:id", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const blogId = req.params.id;

    // Find blog
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        status: "error",
        message: "Blog not found",
      });
    }

    // Delete blog
    await Blog.findByIdAndDelete(blogId);

    res.json({
      status: "success",
      message: "Blog deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting blog:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// AI: Generate blog title (admin only)
router.post(
  "/ai/article-title",
  authenticateJWT,
  requireAdmin,
  async (req, res) => {
    try {
      const axios = require("axios");
      const API_BASE =
        process.env.BLOG_AI_BASE_URL || "https://backend.aaddyy.com";
      const API_KEY = process.env.BLOG_AI_API_KEY;

      if (!API_KEY) {
        return res
          .status(400)
          .json({
            status: "error",
            message: "BLOG_AI_API_KEY is not configured",
          });
      }

      // quantity is hardcoded to 1; optional hint/topic in body
      const { hint, topic } = req.body || {};

      const response = await axios.post(
        `${API_BASE}/api/ai/article-title`,
        { quantity: 1, hint, topic },
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      res.json({ status: "success", data: response.data });
    } catch (error) {
      logger.error("AI article-title generation failed", {
        error: error.message,
      });
      const message = error.response?.data || { message: error.message };
      res
        .status(error.response?.status || 500)
        .json({ status: "error", error: message });
    }
  }
);

// AI: Generate researched blog content (admin only)
router.post(
  "/ai/research-blog-writer",
  authenticateJWT,
  requireAdmin,
  async (req, res) => {
    try {
      const axios = require("axios");
      const API_BASE =
        process.env.BLOG_AI_BASE_URL || "https://backend.aaddyy.com";
      const API_KEY = process.env.BLOG_AI_API_KEY;

      if (!API_KEY) {
        return res
          .status(400)
          .json({
            status: "error",
            message: "BLOG_AI_API_KEY is not configured",
          });
      }

      const { topic } = req.body || {};
      if (!topic) {
        return res
          .status(400)
          .json({ status: "error", message: "topic is required" });
      }

      const payload = {
        depth: 1, // fixed from -1 to 1
        includeResearch: true,
        topic,
      };

      const response = await axios.post(
        `${API_BASE}/api/ai/research-blog-writer`,
        payload,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      res.json({ status: "success", data: response.data });
    } catch (error) {
      logger.error("AI research-blog-writer failed", { error: error.message });
      const message = error.response?.data || { message: error.message };
      res
        .status(error.response?.status || 500)
        .json({ status: "error", error: message });
    }
  }
);

// AI: Generate blog image (admin only)
router.post(
  "/ai/image-generation",
  authenticateJWT,
  requireAdmin,
  async (req, res) => {
    try {
      const axios = require("axios");
      const API_BASE =
        process.env.BLOG_AI_BASE_URL || "https://backend.aaddyy.com";
      const API_KEY = process.env.BLOG_AI_API_KEY;

      if (!API_KEY) {
        return res
          .status(400)
          .json({
            status: "error",
            message: "BLOG_AI_API_KEY is not configured",
          });
      }

      const { prompt } = req.body || {};
      if (!prompt) {
        return res
          .status(400)
          .json({ status: "error", message: "prompt is required" });
      }

      const response = await axios.post(
        `${API_BASE}/api/ai/image-generation`,
        { prompt },
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );

      res.json({ status: "success", data: response.data });
    } catch (error) {
      logger.error("AI image-generation failed", { error: error.message });
      const message = error.response?.data || { message: error.message };
      res
        .status(error.response?.status || 500)
        .json({ status: "error", error: message });
    }
  }
);

// AI: Generate SEO analysis (authenticated users)
router.post("/ai/seo-analysis", authenticateJWT, async (req, res) => {
  try {
    const axios = require("axios");
    const API_BASE =
      process.env.BLOG_AI_BASE_URL || "https://backend.aaddyy.com";
    const API_KEY = process.env.BLOG_AI_API_KEY;

    if (!API_KEY) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "BLOG_AI_API_KEY is not configured",
        });
    }

    const { url, includeBacklinks } = req.body || {};
    if (!url) {
      return res
        .status(400)
        .json({ status: "error", message: "url is required" });
    }

    const payload = {
      url,
      includeBacklinks: includeBacklinks || false,
    };

    const response = await axios.post(
      `${API_BASE}/api/ai/seo-analysis`,
      payload,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    res.json({ status: "success", data: response.data });
  } catch (error) {
    logger.error("AI SEO analysis failed", { error: error.message });
    const message = error.response?.data || { message: error.message };
    res
      .status(error.response?.status || 500)
      .json({ status: "error", error: message });
  }
});

module.exports = router;
