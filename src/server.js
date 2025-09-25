const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const { specs, swaggerUi } = require("./swagger/swagger");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
      account: "/api/account",
      me: "/api/me",
      websites: "/api/websites",
      admin: "/api/admin",
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
app.use("/api/account", require("./routes/account"));
app.use("/api/me", require("./routes/me"));
app.use("/api/websites", require("./routes/websites"));
app.use("/api/admin", require("./routes/admin"));

// Start sync worker
require("./sync/syncWorker")();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
