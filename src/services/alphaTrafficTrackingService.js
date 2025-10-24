const AlphaTrafficData = require("../models/AlphaTrafficData");
const AlphaTrafficSummary = require("../models/AlphaTrafficSummary");
const Campaign = require("../models/Campaign");
const logger = require("../utils/logger");

class AlphaTrafficTrackingService {
  constructor() {
    this.timeRanges = AlphaTrafficSummary.getTimeRanges();
    this.isInitialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) return;

    logger.info("Initializing Alpha Traffic Tracking Service");
    this.isInitialized = true;
  }

  /**
   * Record new traffic data for an Alpha campaign
   * @param {Object} trafficRecord - Traffic data to record
   * @returns {Promise<Object>} - Recorded traffic data
   */
  async recordAlphaTrafficData(trafficRecord) {
    try {
      const {
        campaignId,
        sparkTrafficProjectId,
        hits = 0,
        visits = 0,
        views = 0,
        uniqueVisitors = 0,
        speed = 0,
        bounceRate = 0,
        avgSessionDuration = 0,
        countryBreakdown = [],
        dailyStats = {},
        projectStatus = "active",
        rawSparkTrafficData = null,
        collectionSource = "auto",
        timestamp = new Date(),
      } = trafficRecord;

      // Validate campaign exists and is SparkTraffic
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (!campaign.spark_traffic_project_id) {
        throw new Error(
          `Campaign ${campaignId} is not a SparkTraffic campaign`
        );
      }

      // Create traffic data record
      const trafficData = new AlphaTrafficData({
        campaign: campaignId,
        sparkTrafficProjectId,
        timestamp,
        hits,
        visits,
        views,
        uniqueVisitors,
        speed,
        bounceRate,
        avgSessionDuration,
        countryBreakdown,
        dailyStats,
        projectStatus,
        rawSparkTrafficData,
        collectionSource,
        dataQuality: rawSparkTrafficData ? "complete" : "partial",
      });

      await trafficData.save();

      logger.debug("Alpha traffic data recorded", {
        campaignId,
        sparkTrafficProjectId,
        hits,
        visits,
        views,
        speed,
        timestamp,
      });

      // Update traffic summaries for all time ranges
      await this.updateAlphaTrafficSummaries(
        campaignId,
        sparkTrafficProjectId,
        trafficData
      );

      return trafficData;
    } catch (error) {
      logger.error("Failed to record Alpha traffic data", {
        campaignId: trafficRecord.campaignId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update traffic summaries for all time ranges
   * @param {String} campaignId - Campaign ID
   * @param {String} sparkTrafficProjectId - SparkTraffic project ID
   * @param {Object} newTrafficData - New traffic data to incorporate
   */
  async updateAlphaTrafficSummaries(
    campaignId,
    sparkTrafficProjectId,
    newTrafficData
  ) {
    const timestamp = newTrafficData.timestamp;

    for (const [rangeKey, rangeConfig] of Object.entries(this.timeRanges)) {
      try {
        await this.updateSummaryForTimeRange(
          campaignId,
          sparkTrafficProjectId,
          rangeKey,
          timestamp,
          newTrafficData
        );
      } catch (error) {
        logger.error("Failed to update Alpha summary for time range", {
          campaignId,
          sparkTrafficProjectId,
          timeRange: rangeKey,
          error: error.message,
        });
      }
    }
  }

  /**
   * Update summary for a specific time range
   * @param {String} campaignId - Campaign ID
   * @param {String} sparkTrafficProjectId - SparkTraffic project ID
   * @param {String} timeRange - Time range key (1m, 15m, etc.)
   * @param {Date} timestamp - Timestamp of the data
   * @param {Object} trafficData - Traffic data to incorporate
   */
  async updateSummaryForTimeRange(
    campaignId,
    sparkTrafficProjectId,
    timeRange,
    timestamp,
    trafficData
  ) {
    const rangeConfig = this.timeRanges[timeRange];
    const { windowStart, windowEnd } = this.calculateTimeWindow(
      timestamp,
      rangeConfig.seconds
    );

    // Find or create summary for this time window
    let summary = await AlphaTrafficSummary.findOne({
      campaign: campaignId,
      timeRange,
      windowStart,
    });

    if (!summary) {
      summary = new AlphaTrafficSummary({
        campaign: campaignId,
        sparkTrafficProjectId,
        timeRange,
        windowStart,
        windowEnd,
      });
    }

    // Update aggregated metrics
    const oldDataPoints = summary.dataPointsCount;
    const newDataPoints = oldDataPoints + 1;

    // SparkTraffic returns cumulative totals, so use latest values (not sum)
    summary.totalHits = trafficData.hits || 0;
    summary.totalVisits = trafficData.visits || 0;
    summary.totalViews = trafficData.views || 0;
    summary.uniqueVisitors = trafficData.uniqueVisitors || 0;

    // Update speed metrics
    const currentSpeed = trafficData.speed || 0;
    summary.avgSpeed =
      (summary.avgSpeed * oldDataPoints + currentSpeed) / newDataPoints;
    summary.maxSpeed = Math.max(summary.maxSpeed, currentSpeed);
    summary.minSpeed =
      oldDataPoints === 0
        ? currentSpeed
        : Math.min(summary.minSpeed, currentSpeed);

    // Update averages
    summary.avgBounceRate =
      (summary.avgBounceRate * oldDataPoints + (trafficData.bounceRate || 0)) /
      newDataPoints;
    summary.avgSessionDuration =
      (summary.avgSessionDuration * oldDataPoints +
        (trafficData.avgSessionDuration || 0)) /
      newDataPoints;

    // Update country breakdown
    this.updateCountryBreakdown(summary, trafficData.countryBreakdown || []);

    // Calculate peak rates based on current totals and time elapsed
    const now = new Date();
    const timeElapsedMinutes = Math.max(
      (now - summary.windowStart) / (1000 * 60),
      1
    );
    const currentHitsPerMinute = summary.totalHits / timeElapsedMinutes;
    const currentVisitsPerMinute = summary.totalVisits / timeElapsedMinutes;

    summary.peakHitsPerMinute = Math.max(
      summary.peakHitsPerMinute,
      currentHitsPerMinute
    );
    summary.peakVisitsPerMinute = Math.max(
      summary.peakVisitsPerMinute,
      currentVisitsPerMinute
    );

    // Update time series data (limit to prevent excessive growth)
    const maxTimeSeriesPoints = this.getMaxTimeSeriesPoints(timeRange);
    summary.timeSeriesData.push({
      timestamp: trafficData.timestamp,
      hits: trafficData.hits || 0,
      visits: trafficData.visits || 0,
      speed: trafficData.speed || 0,
    });

    // Keep only the most recent data points
    if (summary.timeSeriesData.length > maxTimeSeriesPoints) {
      summary.timeSeriesData = summary.timeSeriesData.slice(
        -maxTimeSeriesPoints
      );
    }

    // Update metadata
    summary.dataPointsCount = newDataPoints;
    summary.lastUpdated = new Date();
    summary.isComplete = new Date() > windowEnd;

    // Calculate data quality
    summary.dataQuality = this.calculateDataQuality(summary, rangeConfig);

    await summary.save();

    logger.debug("Alpha traffic summary updated", {
      campaignId,
      sparkTrafficProjectId,
      timeRange,
      windowStart,
      totalHits: summary.totalHits,
      totalVisits: summary.totalVisits,
      dataPoints: summary.dataPointsCount,
    });
  }

  /**
   * Get maximum time series points for a time range
   * @param {String} timeRange - Time range key
   * @returns {Number} - Maximum points to keep
   */
  getMaxTimeSeriesPoints(timeRange) {
    const limits = {
      "1m": 60, // 1 point per second for 1 minute
      "15m": 180, // 1 point per 5 seconds for 15 minutes
      "1h": 360, // 1 point per 10 seconds for 1 hour
      "7d": 1008, // 1 point per 10 minutes for 7 days
      "30d": 1440, // 1 point per 30 minutes for 30 days
    };
    return limits[timeRange] || 100;
  }

  /**
   * Calculate data quality based on completeness and consistency
   * @param {Object} summary - Traffic summary object
   * @param {Object} rangeConfig - Time range configuration
   * @returns {String} - Data quality rating
   */
  calculateDataQuality(summary, rangeConfig) {
    const expectedDataPoints = Math.min(
      summary.dataPointsCount,
      rangeConfig.seconds / 60
    ); // Assuming 1 data point per minute
    const actualDataPoints = summary.dataPointsCount;
    const completeness = actualDataPoints / Math.max(expectedDataPoints, 1);

    if (completeness >= 0.9) return "excellent";
    if (completeness >= 0.7) return "good";
    if (completeness >= 0.5) return "fair";
    return "poor";
  }

  /**
   * Update country breakdown in summary
   * @param {Object} summary - Summary document
   * @param {Array} countryData - New country data
   */
  updateCountryBreakdown(summary, countryData) {
    countryData.forEach((newCountryData) => {
      const existingCountry = summary.countryBreakdown.find(
        (c) => c.country === newCountryData.country
      );

      if (existingCountry) {
        const oldHits = existingCountry.hits;
        existingCountry.hits += newCountryData.hits || 0;
        existingCountry.visits += newCountryData.visits || 0;
        existingCountry.views += newCountryData.views || 0;

        // Calculate growth rate
        existingCountry.growth =
          oldHits > 0 ? ((newCountryData.hits || 0) / oldHits) * 100 : 0;
      } else {
        summary.countryBreakdown.push({
          country: newCountryData.country,
          hits: newCountryData.hits || 0,
          visits: newCountryData.visits || 0,
          views: newCountryData.views || 0,
          percentage: 0, // Will be calculated below
          growth: 0,
        });
      }
    });

    // Recalculate percentages and update top countries
    const totalHits = summary.totalHits || 1;
    summary.countryBreakdown.forEach((country) => {
      country.percentage = (country.hits / totalHits) * 100;
    });

    // Sort and get top countries
    summary.topCountries = summary.countryBreakdown
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10)
      .map((country, index) => ({
        country: country.country,
        hits: country.hits,
        percentage: country.percentage,
        rank: index + 1,
      }));
  }

  /**
   * Calculate time window boundaries
   * @param {Date} timestamp - Current timestamp
   * @param {Number} windowSeconds - Window duration in seconds
   * @returns {Object} - Window start and end dates
   */
  calculateTimeWindow(timestamp, windowSeconds) {
    const ts = new Date(timestamp);
    let windowStart;

    if (windowSeconds === 60) {
      // 1 minute
      windowStart = new Date(
        ts.getFullYear(),
        ts.getMonth(),
        ts.getDate(),
        ts.getHours(),
        ts.getMinutes(),
        0,
        0
      );
    } else if (windowSeconds === 900) {
      // 15 minutes
      const minutes = Math.floor(ts.getMinutes() / 15) * 15;
      windowStart = new Date(
        ts.getFullYear(),
        ts.getMonth(),
        ts.getDate(),
        ts.getHours(),
        minutes,
        0,
        0
      );
    } else if (windowSeconds === 3600) {
      // 1 hour
      windowStart = new Date(
        ts.getFullYear(),
        ts.getMonth(),
        ts.getDate(),
        ts.getHours(),
        0,
        0,
        0
      );
    } else if (windowSeconds === 604800) {
      // 7 days
      const dayOfWeek = ts.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      windowStart = new Date(ts);
      windowStart.setDate(ts.getDate() - daysToSubtract);
      windowStart.setHours(0, 0, 0, 0);
    } else if (windowSeconds === 2592000) {
      // 30 days
      windowStart = new Date(ts.getFullYear(), ts.getMonth(), 1, 0, 0, 0, 0);
    } else {
      // Default: rolling window
      windowStart = new Date(ts.getTime() - windowSeconds * 1000);
    }

    const windowEnd = new Date(windowStart.getTime() + windowSeconds * 1000);
    return { windowStart, windowEnd };
  }

  /**
   * Get traffic summary for an Alpha campaign and time range
   * @param {String} campaignId - Campaign ID
   * @param {String} timeRange - Time range (1m, 15m, 1h, 7d, 30d)
   * @param {Number} limit - Maximum number of windows to return
   * @returns {Promise<Array>} - Traffic summaries
   */
  async getAlphaTrafficSummary(campaignId, timeRange = "1h", limit = 24) {
    try {
      const summaries = await AlphaTrafficSummary.find({
        campaign: campaignId,
        timeRange,
      })
        .sort({ windowStart: -1 })
        .limit(limit)
        .lean();

      return summaries.reverse(); // Return in chronological order
    } catch (error) {
      logger.error("Failed to get Alpha traffic summary", {
        campaignId,
        timeRange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get current traffic metrics for an Alpha campaign
   * @param {String} campaignId - Campaign ID
   * @returns {Promise<Object>} - Current traffic metrics
   */
  async getCurrentAlphaTrafficMetrics(campaignId) {
    try {
      const metrics = {};

      for (const [rangeKey, rangeConfig] of Object.entries(this.timeRanges)) {
        const now = new Date();
        const { windowStart } = this.calculateTimeWindow(
          now,
          rangeConfig.seconds
        );

        const summary = await AlphaTrafficSummary.findOne({
          campaign: campaignId,
          timeRange: rangeKey,
          windowStart,
        });

        metrics[rangeKey] = {
          label: rangeConfig.label,
          totalHits: summary?.totalHits || 0,
          totalVisits: summary?.totalVisits || 0,
          totalViews: summary?.totalViews || 0,
          uniqueVisitors: summary?.uniqueVisitors || 0,
          avgSpeed: summary?.avgSpeed || 0,
          maxSpeed: summary?.maxSpeed || 0,
          avgBounceRate: summary?.avgBounceRate || 0,
          avgSessionDuration: summary?.avgSessionDuration || 0,
          peakHitsPerMinute: summary?.peakHitsPerMinute || 0,
          peakVisitsPerMinute: summary?.peakVisitsPerMinute || 0,
          countryBreakdown: summary?.countryBreakdown || [],
          topCountries: summary?.topCountries || [],
          timeSeriesData: summary?.timeSeriesData || [],
          dataQuality: summary?.dataQuality || "good",
          lastUpdated: summary?.lastUpdated || null,
          dataPointsCount: summary?.dataPointsCount || 0,
          completionPercentage: summary?.getCompletionPercentage() || 0,
        };
      }

      return metrics;
    } catch (error) {
      logger.error("Failed to get current Alpha traffic metrics", {
        campaignId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initialize traffic tracking for a new Alpha campaign
   * @param {String} campaignId - Campaign ID
   * @param {String} sparkTrafficProjectId - SparkTraffic project ID
   */
  async initializeAlphaTrafficTracking(campaignId, sparkTrafficProjectId) {
    try {
      logger.info("Initializing Alpha traffic tracking", {
        campaignId,
        sparkTrafficProjectId,
      });

      // Create initial summaries for all time ranges
      const now = new Date();

      for (const [rangeKey, rangeConfig] of Object.entries(this.timeRanges)) {
        const { windowStart, windowEnd } = this.calculateTimeWindow(
          now,
          rangeConfig.seconds
        );

        // Check if summary already exists
        const existingSummary = await AlphaTrafficSummary.findOne({
          campaign: campaignId,
          timeRange: rangeKey,
          windowStart,
        });

        if (!existingSummary) {
          const summary = new AlphaTrafficSummary({
            campaign: campaignId,
            sparkTrafficProjectId,
            timeRange: rangeKey,
            windowStart,
            windowEnd,
          });

          await summary.save();

          logger.debug("Alpha traffic summary initialized", {
            campaignId,
            sparkTrafficProjectId,
            timeRange: rangeKey,
            windowStart,
            windowEnd,
          });
        }
      }

      logger.info("Alpha traffic tracking initialized successfully", {
        campaignId,
        sparkTrafficProjectId,
      });
    } catch (error) {
      logger.error("Failed to initialize Alpha traffic tracking", {
        campaignId,
        sparkTrafficProjectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get historical data for trends analysis
   * @param {String} campaignId - Campaign ID
   * @param {String} timeRange - Time range
   * @param {Number} periods - Number of periods to analyze
   * @returns {Promise<Object>} - Trend analysis
   */
  async getAlphaTrafficTrends(campaignId, timeRange = "1h", periods = 24) {
    try {
      const summaries = await this.getAlphaTrafficSummary(
        campaignId,
        timeRange,
        periods
      );

      if (summaries.length < 2) {
        return {
          trend: "insufficient_data",
          growth: 0,
          summaries: summaries,
        };
      }

      // Calculate growth rate
      const latest = summaries[summaries.length - 1];
      const previous = summaries[summaries.length - 2];

      const hitGrowth =
        previous.totalHits > 0
          ? ((latest.totalHits - previous.totalHits) / previous.totalHits) * 100
          : 0;

      const visitGrowth =
        previous.totalVisits > 0
          ? ((latest.totalVisits - previous.totalVisits) /
              previous.totalVisits) *
            100
          : 0;

      return {
        trend:
          hitGrowth > 0 ? "growing" : hitGrowth < 0 ? "declining" : "stable",
        hitGrowth,
        visitGrowth,
        summaries,
        periods: summaries.length,
      };
    } catch (error) {
      logger.error("Failed to get Alpha traffic trends", {
        campaignId,
        timeRange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cleanup old traffic data
   * @param {Number} retentionDays - Number of days to retain data
   */
  async cleanupOldAlphaTrafficData(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old traffic data (MongoDB TTL will handle this automatically)
      const trafficDataResult = await AlphaTrafficData.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      // Delete old completed summaries
      const summaryResult = await AlphaTrafficSummary.deleteMany({
        windowEnd: { $lt: cutoffDate },
        isComplete: true,
      });

      logger.info("Alpha traffic data cleanup completed", {
        retentionDays,
        cutoffDate,
        trafficDataDeleted: trafficDataResult.deletedCount,
        summariesDeleted: summaryResult.deletedCount,
      });

      return {
        trafficDataDeleted: trafficDataResult.deletedCount,
        summariesDeleted: summaryResult.deletedCount,
      };
    } catch (error) {
      logger.error("Failed to cleanup old Alpha traffic data", {
        retentionDays,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new AlphaTrafficTrackingService();
