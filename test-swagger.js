const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Test API",
      version: "1.0.0",
    },
  },
  apis: ["./src/swagger/paths/campaigns.js"],
};

try {
  const specs = swaggerJSDoc(options);
  console.log("✅ Swagger documentation parsed successfully!");
  console.log(`Found ${Object.keys(specs.paths || {}).length} paths`);
} catch (error) {
  console.error("❌ Error parsing Swagger documentation:");
  console.error(error.message);
}
