const express = require("express");
const router = express.Router();
const { authenticateJWT, requireAdmin } = require("../middleware/auth");
const Blog = require("../models/Blog");
const logger = require("../utils/logger");

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
        return res.status(400).json({
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
        return res.status(400).json({
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
        return res.status(400).json({
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

// AI: Generate SEO analysis (FREE - No Auth - returns raw response)
router.post("/ai/seo-analysis", async (req, res) => {
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

// ============================================================
// PRO VERSION: SEO Analysis with S3 Storage & DB Optimization
// ============================================================

/**
 * AI: Generate SEO analysis (PRO - Auth Required - Optimized with S3)
 *
 * This endpoint:
 * - Requires authentication
 * - Extracts Base64 images from AI response
 * - Uploads images and full report to S3
 * - Stores only lightweight metadata in database
 * - Returns optimized response with S3 URLs
 *
 * Benefits:
 * - Cost-efficient (no large blobs in DB)
 * - Scalable (offloads storage to S3)
 * - Fast responses (lightweight metadata only)
 * - Production-ready
 */
router.post("/ai/seo-analysis-pro", authenticateJWT, async (req, res) => {
  try {
    const axios = require("axios");
    const {
      processAndStoreSEOAnalysis,
    } = require("../services/seoAnalysisService");
    const { isS3Configured } = require("../services/s3Service");

    // Check S3 configuration
    if (!isS3Configured()) {
      return res.status(500).json({
        status: "error",
        message: "S3 storage is not configured. Please contact administrator.",
        code: "S3_NOT_CONFIGURED",
      });
    }

    const API_BASE =
      process.env.BLOG_AI_BASE_URL || "https://backend.aaddyy.com";
    const API_KEY = process.env.BLOG_AI_API_KEY;

    if (!API_KEY) {
      return res.status(400).json({
        status: "error",
        message: "BLOG_AI_API_KEY is not configured",
      });
    }

    const { url, includeBacklinks } = req.body || {};
    if (!url) {
      return res.status(400).json({
        status: "error",
        message: "url is required",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        status: "error",
        message: "Invalid URL format",
      });
    }

    logger.info("SEO analysis PRO requested", {
      userId: req.user.id,
      url,
      includeBacklinks,
    });

    // Call Addy.com AI API
    const payload = {
      url,
      includeBacklinks: includeBacklinks || false,
    };

    const aiResponse = await axios.post(
      `${API_BASE}/api/ai/seo-analysis`,
      payload,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 300000, // 5 minutes timeout for large responses
      }
    );

    // Process and store with S3 optimization
    const optimizedResult = await processAndStoreSEOAnalysis(
      aiResponse.data,
      url,
      req.user.id,
      includeBacklinks
    );

    res.json({
      status: "success",
      message: "SEO analysis completed and optimized",
      data: optimizedResult,
    });
  } catch (error) {
    // Use console.error to avoid any logger meta handling issues
    console.error("AI SEO analysis PRO failed", {
      userId: req.user?.id,
      error: error?.message || error,
      stack: error?.stack,
    });

    const statusCode = error?.response?.status || 500;
    const message =
      error?.response?.data?.message || error?.message || "SEO analysis failed";

    res.status(statusCode).json({
      status: "error",
      message,
      code: error?.code || "SEO_ANALYSIS_FAILED",
    });
  }
});

/**
 * Get SEO analysis by ID (Auth Required)
 */
router.get(
  "/ai/seo-analysis-pro/:analysisId",
  authenticateJWT,
  async (req, res) => {
    try {
      const { getSEOAnalysisById } = require("../services/seoAnalysisService");
      const { analysisId } = req.params;

      const analysis = await getSEOAnalysisById(analysisId, req.user.id);

      res.json({
        status: "success",
        data: analysis,
      });
    } catch (error) {
      logger.error("Failed to fetch SEO analysis", {
        userId: req.user.id,
        analysisId: req.params.analysisId,
        error: error.message || error,
      });

      const statusCode = error.message?.includes("not found") ? 404 : 500;
      res.status(statusCode).json({
        status: "error",
        message: error.message || "Failed to fetch SEO analysis",
      });
    }
  }
);

/**
 * Get user's SEO analysis history (Auth Required)
 */
router.get("/ai/seo-analysis-pro", authenticateJWT, async (req, res) => {
  try {
    const { getUserSEOAnalyses } = require("../services/seoAnalysisService");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const url = req.query.url || null;

    const result = await getUserSEOAnalyses(req.user.id, { page, limit, url });

    res.json({
      status: "success",
      data: result.analyses,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Failed to fetch SEO analysis history", {
      userId: req.user?.id,
      error: error.message || error,
    });

    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch SEO analysis history",
    });
  }
});

module.exports = router;
