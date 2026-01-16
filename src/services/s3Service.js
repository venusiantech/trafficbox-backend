const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

// Initialize S3 client with Railway storage support
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1",
  signatureVersion: 'v4',
};

// Add endpoint for Railway S3-compatible storage
if (process.env.AWS_ENDPOINT_URL) {
  s3Config.endpoint = new AWS.Endpoint(process.env.AWS_ENDPOINT_URL);
  s3Config.s3ForcePathStyle = true; // Required for Railway storage
}

const s3 = new AWS.S3(s3Config);

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || "trafficbox-seo-reports";

/**
 * Upload a file to S3
 * @param {Buffer|String} fileContent - File content (Buffer or string)
 * @param {String} fileName - Original filename or desired name
 * @param {String} contentType - MIME type (e.g., 'image/png', 'application/json')
 * @param {String} folder - S3 folder path (optional)
 * @returns {Promise<Object>} - { url, key, bucket }
 */
async function uploadToS3(fileContent, fileName, contentType, folder = "seo-reports") {
  try {
    const fileKey = `${folder}/${Date.now()}-${uuidv4()}-${fileName}`;

    const params = {
      Bucket: S3_BUCKET,
      Key: fileKey,
      Body: fileContent,
      ContentType: contentType,
      ACL: "private", // keep objects private and use signed URLs
    };

    const result = await s3.upload(params).promise();

    logger.info("File uploaded to S3", {
      bucket: result.Bucket,
      key: result.Key,
      location: result.Location,
    });

    return {
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
    };
  } catch (error) {
    logger.error("S3 upload failed", {
      error: error?.message || error,
      fileName,
      contentType,
    });
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Upload Base64 image to S3
 * @param {String} base64Data - Base64 encoded image data
 * @param {String} fileName - Desired filename
 * @param {String} folder - S3 folder path
 * @returns {Promise<Object>} - { url, key, bucket }
 */
async function uploadBase64ImageToS3(base64Data, fileName, folder = "seo-images") {
  try {
    // Extract MIME type and data from Base64 string
    // Format: data:image/png;base64,iVBORw0KG...
    let mimeType = "image/png"; // default
    let base64Content = base64Data;

    if (base64Data.startsWith("data:")) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Content = matches[2];
      }
    }

    // Decode Base64 to Buffer
    const buffer = Buffer.from(base64Content, "base64");

    // Upload to S3
    return await uploadToS3(buffer, fileName, mimeType, folder);
  } catch (error) {
    logger.error("Base64 image upload failed", {
      error: error.message,
      fileName,
    });
    throw new Error(`Base64 image upload failed: ${error.message}`);
  }
}

/**
 * Upload JSON object to S3
 * @param {Object} jsonData - JSON object to upload
 * @param {String} fileName - Desired filename
 * @param {String} folder - S3 folder path
 * @returns {Promise<Object>} - { url, key, bucket }
 */
async function uploadJSONToS3(jsonData, fileName, folder = "seo-reports") {
  try {
    const jsonString = JSON.stringify(jsonData, null, 2);
    const buffer = Buffer.from(jsonString, "utf-8");

    return await uploadToS3(buffer, fileName, "application/json", folder);
  } catch (error) {
    logger.error("JSON upload failed", {
      error: error.message,
      fileName,
    });
    throw new Error(`JSON upload failed: ${error.message}`);
  }
}

/**
 * Delete file from S3
 * @param {String} fileKey - S3 object key
 * @returns {Promise<void>}
 */
async function deleteFromS3(fileKey) {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: fileKey,
    };

    await s3.deleteObject(params).promise();

    logger.info("File deleted from S3", { key: fileKey });
  } catch (error) {
    logger.error("S3 deletion failed", {
      error: error.message,
      fileKey,
    });
    throw new Error(`S3 deletion failed: ${error.message}`);
  }
}

/**
 * Generate a signed URL for private files
 * @param {String} fileKey - S3 object key
 * @param {Number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<String>} - Signed URL
 */
async function getSignedUrl(fileKey, expiresIn = 3600) {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: fileKey,
      Expires: expiresIn,
    };

    const url = await s3.getSignedUrlPromise("getObject", params);
    return url;
  } catch (error) {
    logger.error("Failed to generate signed URL", {
      error: error?.message || error,
      fileKey,
    });
    throw new Error(`Signed URL generation failed: ${error.message}`);
  }
}

/**
 * Fetch JSON object from S3
 * @param {String} fileKey - S3 object key
 * @returns {Promise<Object>} - Parsed JSON object
 */
async function getJSONFromS3(fileKey) {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: fileKey,
    };

    const result = await s3.getObject(params).promise();
    const jsonString = result.Body.toString("utf-8");
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error("Failed to fetch JSON from S3", {
      error: error?.message || error,
      fileKey,
    });
    throw new Error(`Failed to fetch JSON from S3: ${error.message}`);
  }
}

// Helper: return a signed URL for an S3 path object or passthrough if no key
async function toSignedUrl(item, expiresIn = 3600) {
  if (!item) return null;
  // If already an object with key
  if (typeof item === 'object' && item.key) {
    return await getSignedUrl(item.key, expiresIn);
  }
  // If it's a string URL, we cannot sign without key; return as-is
  if (typeof item === 'string') return item;
  return null;
}

// Helper: build signed URLs for our stored s3Paths structure
async function buildSignedS3Paths(s3Paths, expiresIn = 3600) {
  const result = { fullReportJson: null, lighthouseScreenshot: null, additionalImages: [] };
  if (!s3Paths) return result;

  result.fullReportJson = await toSignedUrl(s3Paths.fullReportJson, expiresIn);
  result.lighthouseScreenshot = await toSignedUrl(s3Paths.lighthouseScreenshot, expiresIn);

  if (Array.isArray(s3Paths.additionalImages)) {
    result.additionalImages = await Promise.all(
      s3Paths.additionalImages.map(async (img) => ({
        // preserve key/url if present and add signedUrl for consumption
        key: typeof img === 'object' ? img.key : undefined,
        url: typeof img === 'object' ? img.url : (typeof img === 'string' ? img : undefined),
        signedUrl: await toSignedUrl(img, expiresIn),
      }))
    );
  }
  return result;
}

function isS3Configured() {
  const hasCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
  const hasBucket = !!(
    process.env.AWS_S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET
  );
  return hasCredentials && hasBucket;
}

module.exports = {
  uploadToS3,
  uploadBase64ImageToS3,
  uploadJSONToS3,
  deleteFromS3,
  getSignedUrl,
  getJSONFromS3,
  isS3Configured,
  buildSignedS3Paths,
};
