const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const { specs, swaggerUi } = require("./swagger/swagger");
const compression = require("compression");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Set timeout for all requests to 6 minutes (slightly longer than AI timeout)
app.use((req, res, next) => {
  // Set timeout for AI blog generation endpoints
  if (req.path.includes("/ai/research-blog-writer")) {
    req.setTimeout(360000); // 6 minutes for blog generation
    res.setTimeout(360000);
  } else if (req.path.includes("/ai/")) {
    req.setTimeout(180000); // 3 minutes for other AI endpoints
    res.setTimeout(180000);
  } else {
    req.setTimeout(30000); // 30 seconds for regular endpoints
    res.setTimeout(30000);
  }
  next();
});
// Enable gzip/brotli compression for API responses (threshold 1KB)
app.use(
  compression({
    threshold: 1024,
    // Let node-compression pick brotli if supported
    brotli: { enabled: true, zlib: {} },
  })
);

// Connect DB
mongoose
  .connect(process.env.MONGO_URI, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.error("Mongo connect error", err));

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "TrafficBox API Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      campaigns: "/api/campaigns",
      alpha: "/api/alpha", // SparkTraffic Alpha routes
      alphaTraffic: "/api/alpha-traffic", // Alpha traffic tracking routes
      alphaDashboard: "/api/alpha-dashboard", // Alpha dashboard routes
      account: "/api/account",
      me: "/api/me",
      websites: "/api/websites",
      admin: "/api/admin",
      blogs: "/api/blogs", // Blog management routes
      subscription: "/api/subscription", // Stripe subscription management
    },
    documentation: "/api-docs",
  });
});

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customSiteTitle: "TrafficBox API Documentation",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  })
);

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/alpha", require("./routes/alpha")); // SparkTraffic Alpha routes
app.use("/api/alpha-traffic", require("./routes/alphaTraffic")); // Alpha traffic tracking routes
app.use("/api/alpha-dashboard", require("./routes/alphaDashboard")); // Alpha dashboard routes
app.use("/api/account", require("./routes/account"));
app.use("/api/me", require("./routes/me"));
app.use("/api/websites", require("./routes/websites"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/blogs", require("./routes/blogs")); // Blog management routes
app.use("/api/subscription", require("./routes/subscription")); // Stripe subscription routes

// Start sync worker
require("./sync/syncWorker")();

// Start Alpha traffic data collector
const alphaTrafficDataCollector = require("./services/alphaTrafficDataCollector");
const logger = require("./utils/logger");

// Initialize Alpha traffic tracking system
(async () => {
  try {
    // Allow env override; default to 5 minutes to reduce egress
    const intervalMs = parseInt(
      process.env.ALPHA_COLLECTOR_INTERVAL_MS || "60000",
      10
    );
    await alphaTrafficDataCollector.start(intervalMs);
    logger.info("Alpha traffic data collector started successfully");
  } catch (error) {
    logger.error("Failed to start Alpha traffic data collector", {
      error: error.message,
    });
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
