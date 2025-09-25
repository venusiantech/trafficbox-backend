const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "TrafficBox API",
    version: "1.0.0",
    description:
      "Comprehensive API for TrafficBox campaign management system with SparkTraffic and 9Hits integration",
    contact: {
      name: "TrafficBox Support",
      email: "support@trafficbox.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:5001",
      description: "Development server",
    },
    {
      url: "https://api.trafficbox.com",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          'JWT Authorization header using the Bearer scheme. Example: "Bearer {token}"',
      },
    },
    schemas: {
      User: {
        type: "object",
        required: ["email", "password"],
        properties: {
          _id: {
            type: "string",
            description: "User ID",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email address",
          },
          password: {
            type: "string",
            minLength: 6,
            description: "User password",
          },
          role: {
            type: "string",
            enum: ["user", "admin"],
            default: "user",
            description: "User role",
          },
          firstName: {
            type: "string",
            description: "User first name",
          },
          lastName: {
            type: "string",
            description: "User last name",
          },
          dob: {
            type: "string",
            format: "date",
            description: "Date of birth",
          },
          cashBalance: {
            type: "number",
            default: 0,
            description: "User cash balance",
          },
          credits: {
            type: "number",
            default: 5000,
            description: "User credits",
          },
          availableHits: {
            type: "number",
            default: 1666,
            description: "Available hits (credits/3)",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "User creation timestamp",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "User update timestamp",
          },
        },
      },
      Campaign: {
        type: "object",
        required: ["user", "title", "urls"],
        properties: {
          _id: {
            type: "string",
            description: "Campaign ID",
          },
          user: {
            type: "string",
            description: "User ID who owns the campaign",
          },
          title: {
            type: "string",
            description: "Campaign title",
          },
          urls: {
            type: "array",
            items: {
              type: "string",
              format: "url",
            },
            description: "Target URLs for the campaign",
          },
          duration_min: {
            type: "number",
            description: "Minimum duration in seconds",
          },
          duration_max: {
            type: "number",
            description: "Maximum duration in seconds",
          },
          countries: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Target countries",
          },
          rule: {
            type: "string",
            enum: ["all", "any", "except"],
            default: "any",
            description: "Country targeting rule",
          },
          capping_type: {
            type: "string",
            description: "Capping type",
          },
          capping_value: {
            type: "number",
            description: "Capping value",
          },
          max_hits: {
            type: "number",
            description: "Maximum hits for the campaign",
          },
          until_date: {
            type: "string",
            format: "date-time",
            description: "Campaign end date",
          },
          macros: {
            type: "string",
            description: "Campaign macros",
          },
          popup_macros: {
            type: "string",
            description: "Popup macros",
          },
          is_adult: {
            type: "boolean",
            default: false,
            description: "Adult content flag",
          },
          is_coin_mining: {
            type: "boolean",
            default: false,
            description: "Coin mining flag",
          },
          state: {
            type: "string",
            description: "Campaign state",
          },
          nine_hits_campaign_id: {
            type: "number",
            description: "9Hits campaign ID",
          },
          nine_hits_data: {
            type: "object",
            description: "9Hits campaign data",
          },
          spark_traffic_project_id: {
            type: "string",
            description: "SparkTraffic project ID",
          },
          spark_traffic_data: {
            type: "object",
            description: "SparkTraffic project data",
          },
          is_archived: {
            type: "boolean",
            default: false,
            description: "Archive flag for soft delete",
          },
          archived_at: {
            type: "string",
            format: "date-time",
            description: "Archive timestamp",
          },
          delete_eligible: {
            type: "boolean",
            default: false,
            description: "Eligible for permanent deletion after 7 days",
          },
          last_sync_at: {
            type: "string",
            format: "date-time",
            description: "Last sync timestamp",
          },
          metadata: {
            type: "object",
            description: "Additional campaign metadata",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Campaign creation timestamp",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Campaign update timestamp",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 6,
            example: "password123",
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 6,
            example: "password123",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          dob: {
            type: "string",
            format: "date",
            example: "1990-01-01",
          },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "JWT token for authentication",
          },
          message: {
            type: "string",
            description: "Response message",
          },
        },
      },
      CreateCampaignRequest: {
        type: "object",
        required: ["url"],
        properties: {
          vendor: {
            type: "string",
            enum: ["sparkTraffic", "nineHits"],
            default: "sparkTraffic",
            description: "Vendor to use for the campaign",
          },
          url: {
            type: "string",
            format: "url",
            example: "https://example.com",
            description: "Target URL for the campaign",
          },
          title: {
            type: "string",
            example: "My Campaign",
            description: "Campaign title",
          },
          maxHits: {
            type: "number",
            default: 5,
            description: "Maximum hits for the campaign",
          },
          duration: {
            type: "array",
            items: {
              type: "number",
            },
            example: [5, 15],
            description: "Duration range [min, max] in seconds",
          },
          is_adult: {
            type: "boolean",
            default: false,
            description: "Adult content flag",
          },
          is_coin_mining: {
            type: "boolean",
            default: false,
            description: "Coin mining flag",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          ok: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            description: "Success message",
          },
        },
      },
      AdminDashboard: {
        type: "object",
        properties: {
          ok: {
            type: "boolean",
            example: true,
          },
          dashboard: {
            type: "object",
            properties: {
              stats: {
                type: "object",
                properties: {
                  users: {
                    type: "object",
                    properties: {
                      total: {
                        type: "number",
                      },
                      totalCredits: {
                        type: "number",
                      },
                      totalAvailableHits: {
                        type: "number",
                      },
                    },
                  },
                  campaigns: {
                    type: "object",
                    properties: {
                      total: {
                        type: "number",
                      },
                      active: {
                        type: "number",
                      },
                      paused: {
                        type: "number",
                      },
                      sparkTraffic: {
                        type: "number",
                      },
                      nineHits: {
                        type: "number",
                      },
                    },
                  },
                },
              },
              recent: {
                type: "object",
                properties: {
                  users: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/User",
                    },
                  },
                  campaigns: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Campaign",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: ["./src/routes/*.js", "./src/swagger/paths/*.js"],
};

// Initialize swagger-jsdoc
const specs = swaggerJSDoc(options);

module.exports = {
  specs,
  swaggerUi,
};
