const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "TrafficBox Backend API",
    version: "2.0.0",
    description:
      "Comprehensive API for TrafficBox campaign management system with SparkTraffic integration, automated credit deduction, and new geo format support",
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
      url: "https://trafficbox-backend-staging.up.railway.app",
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
              oneOf: [
                {
                  type: "string",
                  description: "Country code (legacy format)",
                },
                {
                  type: "object",
                  required: ["country", "percent"],
                  properties: {
                    country: {
                      type: "string",
                      description: "Country code (e.g., 'US', 'GB', 'DE')",
                    },
                    percent: {
                      type: "number",
                      minimum: 0,
                      maximum: 1,
                      description:
                        "Percentage of traffic (0.0 to 1.0, must sum to 1.0)",
                    },
                  },
                  description:
                    "Country with percentage allocation (new format)",
                },
              ],
            },
            description:
              "Target countries - supports both legacy string format and new object format with percentages",
            example: [
              { country: "US", percent: 0.34 },
              { country: "AE", percent: 0.33 },
              { country: "IN", percent: 0.33 },
            ],
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
      CleanCampaign: {
        type: "object",
        description:
          "Clean campaign response that hides vendor implementation details",
        properties: {
          id: {
            type: "string",
            description: "Campaign ID",
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
            description: "Target URLs",
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
              oneOf: [
                {
                  type: "string",
                  description: "Country code (legacy format)",
                },
                {
                  type: "object",
                  required: ["country", "percent"],
                  properties: {
                    country: {
                      type: "string",
                      description: "Country code",
                    },
                    percent: {
                      type: "number",
                      minimum: 0,
                      maximum: 1,
                      description: "Traffic percentage",
                    },
                  },
                },
              ],
            },
            description: "Target countries with new geo format support",
          },
          rule: {
            type: "string",
            enum: ["all", "any", "except"],
            description: "Country targeting rule",
          },
          macros: {
            type: "string",
            description: "Campaign macros",
          },
          is_adult: {
            type: "boolean",
            description: "Adult content flag",
          },
          is_coin_mining: {
            type: "boolean",
            description: "Coin mining flag",
          },
          state: {
            type: "string",
            description: "Campaign state",
          },
          is_archived: {
            type: "boolean",
            description: "Archive status",
          },
          status: {
            type: "string",
            description: "User-friendly status (active, paused, archived)",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Update timestamp",
          },
          archived_at: {
            type: "string",
            format: "date-time",
            description: "Archive timestamp",
          },
          delete_eligible: {
            type: "boolean",
            description: "Eligible for permanent deletion",
          },
          stats: {
            type: "object",
            description: "Campaign statistics (only when requested)",
            properties: {
              totalHits: {
                type: "number",
                description: "Total hits received",
              },
              totalVisits: {
                type: "number",
                description: "Total visits received",
              },
              speed: {
                type: "number",
                description: "Current traffic speed",
              },
              status: {
                type: "string",
                description: "Current status",
              },
              dailyHits: {
                type: "array",
                items: {
                  type: "object",
                },
                description: "Daily hits breakdown",
              },
              dailyVisits: {
                type: "array",
                items: {
                  type: "object",
                },
                description: "Daily visits breakdown",
              },
            },
          },
        },
      },
      GeoFormat: {
        type: "object",
        required: ["country", "percent"],
        properties: {
          country: {
            type: "string",
            description: "Country code (e.g., 'US', 'GB', 'DE')",
            example: "US",
          },
          percent: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Percentage of traffic (0.0 to 1.0, must sum to 1.0)",
            example: 0.34,
          },
        },
        example: {
          country: "US",
          percent: 0.34,
        },
      },
      UserStats: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "User ID",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email",
          },
          firstName: {
            type: "string",
            description: "First name",
          },
          lastName: {
            type: "string",
            description: "Last name",
          },
          credits: {
            type: "number",
            description: "Available credits",
          },
          availableHits: {
            type: "number",
            description: "Available hits",
          },
        },
      },
      CreditDebugInfo: {
        type: "object",
        properties: {
          ok: {
            type: "boolean",
            example: true,
          },
          campaign: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              title: {
                type: "string",
              },
              spark_traffic_project_id: {
                type: "string",
              },
              createdAt: {
                type: "string",
                format: "date-time",
              },
              last_stats_check: {
                type: "string",
                format: "date-time",
              },
              total_hits_counted: {
                type: "number",
              },
              credit_deduction_enabled: {
                type: "boolean",
              },
            },
          },
          user: {
            $ref: "#/components/schemas/UserStats",
          },
          currentStats: {
            type: "object",
            properties: {
              totalCurrentHits: {
                type: "number",
              },
              todayHits: {
                type: "number",
              },
              totalHitsCounted: {
                type: "number",
              },
              potentialNewHits: {
                type: "number",
              },
              dailyBreakdown: {
                type: "object",
              },
              rawSparkTrafficData: {
                type: "object",
              },
              sparkTrafficError: {
                type: "object",
              },
            },
          },
          analysis: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["NEW_HITS_AVAILABLE", "NO_NEW_HITS"],
              },
              nextChargeAmount: {
                type: "number",
              },
              explanation: {
                type: "string",
              },
            },
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
            example: "https://trafficboxes.com",
            description: "Target URL for the campaign",
          },
          title: {
            type: "string",
            example: "trafficboxes",
            description: "Campaign title",
          },
          urls: {
            type: "array",
            items: {
              type: "string",
              format: "url",
            },
            example: ["https://trafficboxes.com"],
            description: "Array of target URLs",
          },
          keywords: {
            type: "string",
            example: "test,traffic",
            description: "Keywords separated by commas",
          },
          referrers: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                example: "basic",
              },
              urls: {
                type: "array",
                items: {
                  type: "string",
                  format: "url",
                },
                example: ["https://ref.com"],
              },
            },
            description: "Referrer configuration",
          },
          languages: {
            type: "string",
            example: "en",
            description: "Target languages",
          },
          bounce_rate: {
            type: "number",
            example: 0,
            description: "Bounce rate percentage (0-100)",
          },
          return_rate: {
            type: "number",
            example: 0,
            description: "Return rate percentage (0-100)",
          },
          click_outbound_events: {
            type: "number",
            example: 0,
            description: "Click outbound events count",
          },
          form_submit_events: {
            type: "number",
            example: 0,
            description: "Form submit events count",
          },
          scroll_events: {
            type: "number",
            example: 0,
            description: "Scroll events count",
          },
          time_on_page: {
            type: "string",
            example: "2sec",
            description: "Time spent on page (e.g., 2sec, 1min)",
          },
          desktop_rate: {
            type: "number",
            example: 2,
            description: "Desktop traffic rate",
          },
          auto_renew: {
            type: "string",
            enum: ["true", "false"],
            example: "true",
            description: "Auto renewal setting",
          },
          geo_type: {
            type: "string",
            example: "countries",
            description: "Geographic targeting type",
          },
          geo: {
            type: "array",
            items: {
              $ref: "#/components/schemas/GeoFormat",
            },
            description: "Geographic targeting with new country/percent format",
            example: [
              { country: "US", percent: 0.34 },
              { country: "AE", percent: 0.33 },
              { country: "IN", percent: 0.33 },
            ],
          },
          shortener: {
            type: "string",
            example: "",
            description: "URL shortener configuration",
          },
          rss_feed: {
            type: "string",
            example: "",
            description: "RSS feed URL",
          },
          ga_id: {
            type: "string",
            example: "",
            description: "Google Analytics ID",
          },
          size: {
            type: "string",
            enum: ["eco", "demo", "basic", "standard", "premium"],
            example: "eco",
            description: "Campaign size/plan",
          },
          speed: {
            type: "number",
            example: 200,
            description: "Traffic speed (0-200)",
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
