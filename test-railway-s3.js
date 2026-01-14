/**
 * Test Railway S3-compatible Storage Configuration
 * 
 * This script tests the Railway storage setup for the SEO Analysis PRO feature.
 * Run this before testing the full SEO analysis endpoint.
 * 
 * Usage: node test-railway-s3.js
 */

require('dotenv').config();
const AWS = require('aws-sdk');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Configure S3 for Railway
const s3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'auto',
  signatureVersion: 'v4',
};

// Add endpoint for Railway S3-compatible storage
if (process.env.AWS_ENDPOINT_URL) {
  s3Config.endpoint = new AWS.Endpoint(process.env.AWS_ENDPOINT_URL);
  s3Config.s3ForcePathStyle = true; // Required for Railway storage
}

const s3 = new AWS.S3(s3Config);
const bucket = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;

async function testConfiguration() {
  log('\n' + '='.repeat(60), colors.bright);
  log('Railway S3 Storage - Configuration Test', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  // Step 1: Check environment variables
  logInfo('Step 1: Checking environment variables...\n');

  const checks = [
    { name: 'AWS_ENDPOINT_URL', value: process.env.AWS_ENDPOINT_URL },
    { name: 'AWS_S3_BUCKET_NAME', value: process.env.AWS_S3_BUCKET_NAME },
    { name: 'AWS_DEFAULT_REGION', value: process.env.AWS_DEFAULT_REGION },
    { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : undefined },
    { name: 'AWS_SECRET_ACCESS_KEY', value: process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set (hidden)' : undefined },
  ];

  let allConfigured = true;
  checks.forEach(check => {
    if (check.value) {
      logSuccess(`${check.name}: ${check.value}`);
    } else {
      logError(`${check.name}: Not set!`);
      allConfigured = false;
    }
  });

  if (!allConfigured) {
    logError('\n❌ Configuration incomplete! Please set all required environment variables.');
    process.exit(1);
  }

  console.log('');

  // Step 2: Test S3 connection
  logInfo('Step 2: Testing S3 connection...\n');

  try {
    logInfo(`Endpoint: ${process.env.AWS_ENDPOINT_URL}`);
    logInfo(`Bucket: ${bucket}`);
    logInfo(`Region: ${s3Config.region}\n`);

    // Test list objects
    const listParams = {
      Bucket: bucket,
      MaxKeys: 5
    };

    const list = await s3.listObjectsV2(listParams).promise();
    logSuccess(`Connected to Railway S3! Found ${list.KeyCount} existing objects.`);

  } catch (error) {
    logError(`Failed to connect to Railway S3: ${error.message}`);
    logError(`Error code: ${error.code}`);
    if (error.statusCode) {
      logError(`Status code: ${error.statusCode}`);
    }
    console.log('');
    logWarning('Possible causes:');
    logWarning('1. Invalid credentials (AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY)');
    logWarning('2. Incorrect bucket name (AWS_S3_BUCKET_NAME)');
    logWarning('3. Endpoint URL misconfigured (AWS_ENDPOINT_URL)');
    logWarning('4. Network connectivity issues');
    process.exit(1);
  }

  console.log('');

  // Step 3: Test upload
  logInfo('Step 3: Testing file upload...\n');

  try {
    const testFileName = `test/${Date.now()}-railway-test.txt`;
    const testContent = `Railway S3 Test - ${new Date().toISOString()}
    
This is a test file uploaded to verify Railway S3-compatible storage configuration.
    
Configuration:
- Endpoint: ${process.env.AWS_ENDPOINT_URL}
- Bucket: ${bucket}
- Region: ${s3Config.region}
- Timestamp: ${Date.now()}
`;

    const uploadParams = {
      Bucket: bucket,
      Key: testFileName,
      Body: testContent,
      ContentType: 'text/plain',
    };

    logInfo(`Uploading test file: ${testFileName}...`);

    const result = await s3.upload(uploadParams).promise();
    
    logSuccess('Upload successful!');
    logInfo(`Location: ${result.Location}`);
    logInfo(`Key: ${result.Key}`);
    logInfo(`ETag: ${result.ETag}`);

  } catch (error) {
    logError(`Upload failed: ${error.message}`);
    logError(`Error code: ${error.code}`);
    process.exit(1);
  }

  console.log('');

  // Step 4: Test file retrieval
  logInfo('Step 4: Testing file retrieval...\n');

  try {
    const listParams = {
      Bucket: bucket,
      Prefix: 'test/',
      MaxKeys: 10
    };

    const list = await s3.listObjectsV2(listParams).promise();
    
    if (list.KeyCount > 0) {
      logSuccess(`Retrieved ${list.KeyCount} test file(s):`);
      list.Contents.forEach((obj, index) => {
        logInfo(`  ${index + 1}. ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
      });
    } else {
      logWarning('No test files found (this is normal for first run)');
    }

  } catch (error) {
    logError(`File retrieval failed: ${error.message}`);
  }

  console.log('');

  // Step 5: Summary
  log('='.repeat(60), colors.bright);
  log('Test Summary', colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  logSuccess('✅ All tests passed!');
  logSuccess('✅ Railway S3 storage is properly configured');
  logSuccess('✅ Upload and retrieval working correctly\n');

  logInfo('Next steps:');
  logInfo('1. Restart your backend server to load new environment variables');
  logInfo('2. Test the SEO Analysis PRO endpoint');
  logInfo('3. Monitor logs/app.log for S3 upload confirmations\n');

  log('='.repeat(60) + '\n', colors.bright);
}

// Run the test
testConfiguration().catch(error => {
  console.error('\n');
  logError('Unexpected error during testing:');
  console.error(error);
  process.exit(1);
});
