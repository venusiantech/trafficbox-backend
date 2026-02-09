const axios = require("axios");
const logger = require("../../utils/logger");

const BASE_URL = "https://panel.9hits.com/api";

/**
 * 9hits API Service
 * Handles all interactions with the 9hits API
 */
class NineHitsService {
  constructor() {
    this.apiKey = process.env.NINE_HITS_API_KEY?.trim();
    this.baseURL = BASE_URL;
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get user profile information
   * @returns {Promise<Object>} Profile data
   */
  async getProfile() {
    try {
      if (!this.isConfigured()) {
        throw new Error("9hits API key not configured");
      }

      const response = await axios.get(`${this.baseURL}/profileGet`, {
        params: {
          key: this.apiKey,
        },
        timeout: 15000,
      });

      if (response.data.status !== "ok") {
        throw new Error(
          response.data.messages || "Failed to fetch profile from 9hits"
        );
      }

      return response.data.data;
    } catch (error) {
      logger.error("9hits getProfile failed", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign configuration
   * @returns {Promise<Object>} Created campaign data
   */
  async createCampaign(campaignData) {
    try {
      if (!this.isConfigured()) {
        throw new Error("9hits API key not configured");
      }

      const response = await axios.post(
        `${this.baseURL}/siteAdd?key=${this.apiKey}`,
        campaignData,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (response.data.status !== "ok") {
        throw new Error(
          response.data.messages || "Failed to create campaign on 9hits"
        );
      }

      return response.data.data;
    } catch (error) {
      logger.error("9hits createCampaign failed", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get campaigns
   * @param {Object} options - Query options (page, limit, filter)
   * @returns {Promise<Array>} Campaign list
   */
  async getCampaigns(options = {}) {
    try {
      if (!this.isConfigured()) {
        throw new Error("9hits API key not configured");
      }

      const { page = 1, limit = 100, filter } = options;
      const params = {
        key: this.apiKey,
        page,
        limit: Math.min(limit, 500),
      };

      if (filter) {
        params.filter = filter;
      }

      const response = await axios.get(`${this.baseURL}/siteGet`, {
        params,
        timeout: 15000,
      });

      if (response.data.status !== "ok") {
        throw new Error(
          response.data.messages || "Failed to fetch campaigns from 9hits"
        );
      }

      return response.data.data;
    } catch (error) {
      logger.error("9hits getCampaigns failed", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Update an existing campaign
   * @param {Number} campaignId - 9hits Campaign ID
   * @param {Object} updateData - Update configuration
   * @returns {Promise<Object>} Updated campaign data
   */
  async updateCampaign(campaignId, updateData) {
    try {
      if (!this.isConfigured()) {
        throw new Error("9hits API key not configured");
      }

      const payload = {
        id: campaignId,
        ...updateData,
      };

      const response = await axios.post(
        `${this.baseURL}/siteUpdate?key=${this.apiKey}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (response.data.status !== "ok") {
        throw new Error(
          response.data.messages || "Failed to update campaign on 9hits"
        );
      }

      return response.data.data;
    } catch (error) {
      logger.error("9hits updateCampaign failed", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Delete campaigns
   * @param {Array} campaignIds - Array of 9hits campaign IDs
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCampaigns(campaignIds) {
    try {
      if (!this.isConfigured()) {
        throw new Error("9hits API key not configured");
      }

      if (!Array.isArray(campaignIds)) {
        campaignIds = [campaignIds];
      }

      const response = await axios.post(
        `${this.baseURL}/siteDel?key=${this.apiKey}`,
        campaignIds,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (response.data.status !== "ok") {
        throw new Error(
          response.data.messages || "Failed to delete campaigns on 9hits"
        );
      }

      return response.data;
    } catch (error) {
      logger.error("9hits deleteCampaigns failed", {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get campaign statistics
   * @param {String} campaignId - Campaign ID
   * @param {Object} options - Query options (date range, etc.)
   * @returns {Promise<Object>} Campaign statistics
   */
  async getCampaignStats(campaignId, options = {}) {
    // To be implemented with 9hits stats API
    throw new Error("Not implemented yet - waiting for API documentation");
  }

  /**
   * Pause a campaign
   * @param {String} campaignId - Campaign ID
   * @returns {Promise<Object>} Pause result
   */
  async pauseCampaign(campaignId) {
    // To be implemented with 9hits pause API
    throw new Error("Not implemented yet - waiting for API documentation");
  }

  /**
   * Resume a campaign
   * @param {String} campaignId - Campaign ID
   * @returns {Promise<Object>} Resume result
   */
  async resumeCampaign(campaignId) {
    // To be implemented with 9hits resume API
    throw new Error("Not implemented yet - waiting for API documentation");
  }
}

// Export singleton instance
module.exports = new NineHitsService();
