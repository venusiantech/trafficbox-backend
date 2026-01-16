const { v4: uuidv4 } = require("uuid");
const SEOAnalysis = require("../models/SEOAnalysis");
const {
  uploadBase64ImageToS3,
  uploadJSONToS3,
  isS3Configured,
  buildSignedS3Paths,
  getSignedUrl,
} = require("./s3Service");
const logger = require("../utils/logger");

/**
 * Process large AI SEO response:
 * - Extract and upload Base64 images to S3
 * - Upload full report JSON to S3
 * - Store lightweight metadata in database
 * - Return optimized response
 *
 * @param {Object} aiResponse - Raw AI SEO response from Addy.com
 * @param {String} url - Analyzed URL
 * @param {String} userId - User ID who requested analysis
 * @param {Boolean} includeBacklinks - Whether backlinks were included
 * @returns {Promise<Object>} - Optimized SEO analysis response
 */
async function processAndStoreSEOAnalysis(
  aiResponse,
  url,
  userId,
  includeBacklinks = false
) {
  const startTime = Date.now();
  const analysisId = uuidv4();

  try {
    logger.info("Processing SEO analysis", { analysisId, url, userId });

    // Check if S3 is configured
    if (!isS3Configured()) {
      throw new Error(
        "S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET"
      );
    }

    // Calculate original response size
    const originalResponseBytes = Buffer.byteLength(
      JSON.stringify(aiResponse),
      "utf8"
    );

    // Extract Base64 images and upload to S3
    const { cleanedResponse, s3Images } = await extractAndUploadImages(
      aiResponse,
      analysisId
    );

    // Upload full cleaned report to S3
    const reportFileName = `${analysisId}-full-report.json`;
    const fullReportS3 = await uploadJSONToS3(
      cleanedResponse,
      reportFileName,
      "seo-reports"
    );

    // Extract lightweight scores and metrics
    const scores = extractScores(cleanedResponse);
    const metrics = extractMetrics(cleanedResponse);
    const backlinkCount = extractBacklinkCount(cleanedResponse);

    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000; // in seconds

    // Calculate optimized response size (without images)
    const optimizedResponseBytes = Buffer.byteLength(
      JSON.stringify(cleanedResponse),
      "utf8"
    );

    // Store in database
    const seoAnalysis = new SEOAnalysis({
      user: userId,
      analysisId,
      url,
      scores,
      metrics,
      includeBacklinks,
      backlinkCount,
      s3Paths: {
        fullReportJson: fullReportS3, // store object with key for signing
        lighthouseScreenshot: s3Images.lighthouseScreenshot || null,
        additionalImages: s3Images.additionalImages || [],
      },
      status: "completed",
      processingTime,
      fileSizes: {
        originalResponseBytes,
        optimizedResponseBytes,
      },
      aiProvider: "aaddyy",
      // Optional: Set expiry for automatic cleanup (e.g., 90 days)
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    await seoAnalysis.save();

    // Build signed URLs for client consumption
    const signedPaths = await buildSignedS3Paths(seoAnalysis.s3Paths);

    logger.info("SEO analysis processed successfully", {
      analysisId,
      url,
      userId,
      processingTime,
      originalSizeKB: (originalResponseBytes / 1024).toFixed(2),
      optimizedSizeKB: (optimizedResponseBytes / 1024).toFixed(2),
      compressionRatio: (
        ((originalResponseBytes - optimizedResponseBytes) /
          originalResponseBytes) *
        100
      ).toFixed(2),
    });

    // Return optimized response with signed URLs
    return {
      analysisId,
      url,
      scores,
      metrics,
      backlinkCount,
      status: "completed",
      processingTime,
      overallScore: seoAnalysis.overallScore,
      createdAt: seoAnalysis.createdAt,
      raw: cleanedResponse,
    };
  } catch (error) {
    logger.error("SEO analysis processing failed", {
      analysisId,
      url,
      userId,
      error: error?.message || error,
      stack: error?.stack,
    });

    // Store error in database
    try {
      await SEOAnalysis.create({
        user: userId,
        analysisId,
        url,
        includeBacklinks,
        status: "failed",
        error: error?.message || String(error),
        processingTime: (Date.now() - startTime) / 1000,
      });
    } catch (dbError) {
      logger.error("Failed to store error in database", {
        analysisId,
        error: dbError.message,
      });
    }

    throw error;
  }
}

/**
 * Extract Base64 images from AI response and upload to S3
 * Optimized for Addy.com API response structure with lighthouse screenshots
 * @param {Object} response - AI response object
 * @param {String} analysisId - Unique analysis ID
 * @returns {Promise<Object>} - { cleanedResponse, s3Images }
 */
async function extractAndUploadImages(response, analysisId) {
  const s3Images = {
    lighthouseScreenshot: null,
    additionalImages: [],
  };

  // Deep clone response to avoid mutating original
  const cleanedResponse = JSON.parse(JSON.stringify(response));

  // Debug: Log the structure to find screenshot-thumbnails
  console.log('=== DEBUG: Checking response structure ===');
  console.log('Has data.performance.lighthouse.screenshot-thumbnails?', 
    !!cleanedResponse?.data?.performance?.lighthouse?.['screenshot-thumbnails']);
  console.log('Has data.performance.lighthouse.core_web_vitals.screenshot-thumbnails?', 
    !!cleanedResponse?.data?.performance?.lighthouse?.core_web_vitals?.['screenshot-thumbnails']);
  
  // Check if screenshot-thumbnails exists anywhere
  if (cleanedResponse?.data?.performance?.lighthouse?.core_web_vitals?.['screenshot-thumbnails']) {
    console.log('screenshot-thumbnails details:', 
      cleanedResponse.data.performance.lighthouse.core_web_vitals['screenshot-thumbnails'].details);
  }

  try {
    // Primary extraction: Lighthouse screenshot thumbnails
    // The screenshot-thumbnails is inside core_web_vitals
    let screenshotItems = cleanedResponse?.data?.performance?.lighthouse?.core_web_vitals?.['screenshot-thumbnails']?.details?.items;
    
    console.log('DEBUG: screenshotItems found?', !!screenshotItems, 'length:', screenshotItems?.length);
    
    if (screenshotItems && Array.isArray(screenshotItems)) {
      logger.info(`Found ${screenshotItems.length} lighthouse screenshot thumbnails`);
      
      for (let i = 0; i < screenshotItems.length; i++) {
        const item = screenshotItems[i];
        
        console.log(`DEBUG: Processing item ${i}, has data?`, !!item.data, 'starts with data:image?', item.data?.startsWith('data:image/'));
        
        if (item.data && typeof item.data === 'string' && item.data.startsWith('data:image/')) {
          try {
            const fileName = `${analysisId}-screenshot-${item.timing}ms.jpg`;
            const s3Url = await uploadBase64ImageToS3(item.data, fileName, analysisId);
            
            // Store first screenshot as main lighthouse screenshot
            if (i === 0) {
              s3Images.lighthouseScreenshot = s3Url;
            } else {
              s3Images.additionalImages.push(s3Url);
            }
            
            // Replace Base64 with SIGNED S3 URL in response (7 days expiration)
            const signed = await getSignedUrl(s3Url.key, 604800);
            item.data = signed;
            
            // Verify replacement worked
            if (!item.data.startsWith('https://')) {
              logger.error(`Failed to replace Base64 with signed URL for screenshot ${i}`);
            }
            
            logger.info(`Uploaded screenshot thumbnail ${i + 1}/${screenshotItems.length} at timing ${item.timing}ms`, {
              replacedWithUrl: item.data.substring(0, 100)
            });
          } catch (error) {
            logger.error(`Failed to upload screenshot at timing ${item.timing}ms:`, error?.message || error);
          }
        }
      }
    }

    // Extract final-screenshot if present (also in core_web_vitals)
    const finalScreenshot = cleanedResponse?.data?.performance?.lighthouse?.core_web_vitals?.['final-screenshot']?.details?.data;
    
    console.log('DEBUG: final-screenshot found?', !!finalScreenshot, 'starts with data:image?', finalScreenshot?.startsWith('data:image/'));
    
    if (finalScreenshot && typeof finalScreenshot === 'string' && finalScreenshot.startsWith('data:image/')) {
      try {
        const fileName = `${analysisId}-final-screenshot.jpg`;
        const s3Url = await uploadBase64ImageToS3(finalScreenshot, fileName, analysisId);
        
        // Store as additional image
        s3Images.additionalImages.push(s3Url);
        
        // Replace Base64 with SIGNED S3 URL in response (7 days expiration)
        const signed = await getSignedUrl(s3Url.key, 604800);
        cleanedResponse.data.performance.lighthouse.core_web_vitals['final-screenshot'].details.data = signed;
        
        console.log('DEBUG: final-screenshot replaced with:', signed.substring(0, 100));
        logger.info(`Uploaded final screenshot`);
      } catch (error) {
        logger.error(`Failed to upload final screenshot:`, error?.message || error);
      }
    }
  } catch (error) {
    logger.error('Error extracting lighthouse screenshots:', error?.message || error);
  }

  // Find and extract any other Base64 images
  const imageUploads = [];

  // Recursively search for Base64 images in the response (skip already processed paths)
  async function processNode(obj, path = "") {
    if (!obj || typeof obj !== "object") return;

    // Skip the screenshot-thumbnails and final-screenshot paths as they're already processed
    if (path.includes('screenshot-thumbnails') || path.includes('final-screenshot')) return;

    for (const key in obj) {
      const value = obj[key];

      // Check if value is a Base64 string
      if (
        typeof value === "string" &&
        (value.startsWith("data:image/") || isBase64Image(value))
      ) {
        const fileName = `${analysisId}-${path}-${key}.png`;

        try {
          // Upload to S3
          const s3Result = await uploadBase64ImageToS3(
            value,
            fileName,
            "seo-images"
          );

          // Replace Base64 with SIGNED S3 URL (7 days expiration)
          const signedUrl = await getSignedUrl(s3Result.key, 604800);
          obj[key] = signedUrl;

          // Store reference (avoid duplicates from lighthouse screenshots)
          if (!s3Images.lighthouseScreenshot && key.toLowerCase().includes("screenshot")) {
            s3Images.lighthouseScreenshot = s3Result; // store object with key/url
          } else if (!path.includes('screenshot-thumbnails')) {
            s3Images.additionalImages.push({
              key: s3Result.key,
              url: s3Result.url,
            });
          }

          logger.info("Base64 image extracted and uploaded", {
            key: `${path}.${key}`,
            s3Url: s3Result.url,
          });
        } catch (error) {
          logger.error("Failed to upload Base64 image", {
            key: `${path}.${key}`,
            error: error?.message || error,
          });
          // Keep original value if upload fails
        }
      } else if (typeof value === "object" && value !== null) {
        // Recursively process nested objects/arrays
        await processNode(value, path ? `${path}.${key}` : key);
      }
    }
  }

  await processNode(cleanedResponse);

  return { cleanedResponse, s3Images };
}

/**
 * Check if string is likely a Base64 encoded image
 * @param {String} str
 * @returns {Boolean}
 */
function isBase64Image(str) {
  if (typeof str !== "string") return false;

  // Check for data URI format
  if (str.startsWith("data:image/")) return true;

  // Check for raw Base64 (at least 100 chars, valid Base64 chars)
  if (str.length < 100) return false;

  // Valid Base64 regex (with optional padding)
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Regex.test(str);
}

/**
 * Extract performance scores from AI response
 * Optimized for Addy.com API response structure
 * @param {Object} response
 * @returns {Object}
 */
function extractScores(response) {
  const scores = {
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null,
    pwa: null,
    overall: null,
  };

  try {
    // Extract from Addy.com structure
    if (response?.data?.performance?.lighthouse) {
      const lighthouse = response.data.performance.lighthouse;
      scores.performance = lighthouse.performance_score || null;
      scores.accessibility = lighthouse.accessibility_score || null;
      scores.bestPractices = lighthouse.best_practices_score || null;
      scores.seo = lighthouse.seo_score || null;
    }
    
    // Extract overall score
    if (response?.data?.overall_score) {
      scores.overall = response.data.overall_score.total || null;
    }
    
    // Extract category scores as fallback
    if (response?.data?.category_scores && !scores.performance) {
      const catScores = response.data.category_scores;
      scores.performance = catScores.performance || null;
      scores.accessibility = catScores.accessibility || null;
      scores.seo = catScores.seo || null;
    }
  } catch (error) {
    logger.warn("Failed to extract scores", { error: error?.message || error });
  }

  return scores;
}

/**
 * Extract performance metrics from AI response
 * Optimized for Addy.com API response structure
 * @param {Object} response
 * @returns {Object}
 */
function extractMetrics(response) {
  const metrics = {
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    speedIndex: null,
    totalBlockingTime: null,
    cumulativeLayoutShift: null,
    timeToInteractive: null,
  };

  try {
    // Extract from Addy.com structure (core-web-vitals in lighthouse)
    const coreWebVitals = response?.data?.performance?.lighthouse?.core_web_vitals;
    
    if (coreWebVitals) {
      // First Contentful Paint
      if (coreWebVitals['first-contentful-paint']) {
        metrics.firstContentfulPaint = coreWebVitals['first-contentful-paint'].numericValue;
      }
      
      // Largest Contentful Paint
      if (coreWebVitals['largest-contentful-paint']) {
        metrics.largestContentfulPaint = coreWebVitals['largest-contentful-paint'].numericValue;
      }
      
      // Speed Index
      if (coreWebVitals['speed-index']) {
        metrics.speedIndex = coreWebVitals['speed-index'].numericValue;
      }
      
      // Total Blocking Time (if available)
      if (coreWebVitals['total-blocking-time']) {
        metrics.totalBlockingTime = coreWebVitals['total-blocking-time'].numericValue;
      }
      
      // Cumulative Layout Shift (if available)
      if (coreWebVitals['cumulative-layout-shift']) {
        metrics.cumulativeLayoutShift = coreWebVitals['cumulative-layout-shift'].numericValue;
      }
      
      // Time to Interactive (if available)
      if (coreWebVitals['interactive']) {
        metrics.timeToInteractive = coreWebVitals['interactive'].numericValue;
      }
    }
    
    // Fallback: check traditional lighthouse.audits structure
    if (response.lighthouse?.audits && !metrics.firstContentfulPaint) {
      const audits = response.lighthouse.audits;
      metrics.firstContentfulPaint =
        audits["first-contentful-paint"]?.numericValue || null;
      metrics.largestContentfulPaint =
        audits["largest-contentful-paint"]?.numericValue || null;
      metrics.totalBlockingTime =
        audits["total-blocking-time"]?.numericValue || null;
      metrics.cumulativeLayoutShift =
        audits["cumulative-layout-shift"]?.numericValue || null;
      metrics.speedIndex = audits["speed-index"]?.numericValue || null;
      metrics.timeToInteractive = audits["interactive"]?.numericValue || null;
    }
  } catch (error) {
    logger.warn("Failed to extract metrics", { error: error?.message || error });
  }

  return metrics;
}

/**
 * Extract backlink count from AI response
 * @param {Object} response
 * @returns {Number}
 */
function extractBacklinkCount(response) {
  try {
    if (response.backlinks) {
      if (Array.isArray(response.backlinks)) {
        return response.backlinks.length;
      } else if (response.backlinks.count) {
        return response.backlinks.count;
      }
    }
  } catch (error) {
    logger.warn("Failed to extract backlink count", { error: error?.message || error });
  }
  return 0;
}

/**
 * Get SEO analysis by ID (supports both MongoDB _id and analysisId UUID)
 * @param {String} analysisId - Can be MongoDB _id or analysisId (UUID)
 * @param {String} userId
 * @returns {Promise<Object>}
 */
async function getSEOAnalysisById(analysisId, userId) {
  // Try to find by analysisId (UUID) first, then by MongoDB _id
  let analysis = await SEOAnalysis.findOne({ analysisId, user: userId });
  
  if (!analysis) {
    // Try MongoDB _id as fallback
    analysis = await SEOAnalysis.findOne({ _id: analysisId, user: userId });
  }

  if (!analysis) {
    throw new Error("SEO analysis not found");
  }

  // Attach signed URLs on demand
  const signedPaths = await buildSignedS3Paths(analysis.s3Paths);
  const obj = analysis.toObject();
  obj.s3Paths = signedPaths;
  return obj;
}

/**
 * Get user's SEO analysis history
 * @param {String} userId
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>}
 */
async function getUserSEOAnalyses(userId, options = {}) {
  const { page = 1, limit = 20, url = null } = options;
  const skip = (page - 1) * limit;

  const query = { user: userId };
  if (url) {
    query.url = new RegExp(url, "i"); // Case-insensitive search
  }

  const [analyses, total] = await Promise.all([
    SEOAnalysis.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("analysisId url status overallScore scores.performance scores.accessibility scores.bestPractices scores.seo includeBacklinks backlinkCount createdAt processingTime"), // Only main fields for list view
    SEOAnalysis.countDocuments(query),
  ]);

  return {
    analyses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  processAndStoreSEOAnalysis,
  getSEOAnalysisById,
  getUserSEOAnalyses,
};
