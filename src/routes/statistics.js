const express = require("express");
const axios = require("axios");
const { requireRole } = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const Subscription = require("../models/Subscription");
const logger = require("../utils/logger");

const router = express.Router();

const SPARKTRAFFIC_API_KEY = () => process.env.SPARKTRAFFIC_API_KEY?.trim();

// Fetch stats for a single SparkTraffic campaign within a date range
async function fetchCampaignStats(campaign, fromDate, toDate) {
  try {
    const resp = await axios.post(
      "https://v2.sparktraffic.com/get-website-traffic-project-stats",
      null,
      {
        headers: { "Content-Type": "application/json", API_KEY: SPARKTRAFFIC_API_KEY() },
        params: { unique_id: campaign.spark_traffic_project_id, from: fromDate, to: toDate },
        timeout: 15000,
      }
    );

    const data = resp.data || {};
    let totalHits = 0;
    let totalVisits = 0;

    if (Array.isArray(data.hits)) {
      data.hits.forEach((d) => Object.values(d).forEach((v) => { totalHits += parseInt(v) || 0; }));
    }
    if (Array.isArray(data.visits)) {
      data.visits.forEach((d) => Object.values(d).forEach((v) => { totalVisits += parseInt(v) || 0; }));
    }

    return { totalHits, totalVisits, dailyHits: data.hits || [], dailyVisits: data.visits || [] };
  } catch (err) {
    logger.warn("Failed to fetch stats for campaign in statistics", {
      campaignId: campaign._id,
      error: err.message,
    });
    return null;
  }
}

// GET /api/statistics?days=30
router.get("/", requireRole(), async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 30, 365);

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - days + 1);

    const toDateStr = now.toISOString().split("T")[0];
    const fromDateStr = fromDate.toISOString().split("T")[0];

    // Fetch user's active, non-archived SparkTraffic campaigns
    const campaigns = await Campaign.find({
      user: userId,
      spark_traffic_project_id: { $exists: true, $ne: null },
      $or: [{ is_archived: { $exists: false } }, { is_archived: false }],
    })
      .select("_id title state spark_traffic_project_id countries createdAt")
      .lean();

    const activeCampaigns = campaigns.filter(
      (c) => c.state !== "archived" && c.state !== "deleted"
    );

    // Fetch stats for all campaigns in parallel
    const statsResults = await Promise.allSettled(
      activeCampaigns.map((c) => fetchCampaignStats(c, fromDateStr, toDateStr))
    );

    // Aggregate daily hits and visits by date
    const dailyHitsMap = {};
    const dailyVisitsMap = {};
    let totalHits = 0;
    let totalVisits = 0;

    statsResults.forEach((result) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const { totalHits: h, totalVisits: v, dailyHits, dailyVisits } = result.value;

      totalHits += h;
      totalVisits += v;

      dailyHits.forEach((entry) => {
        const [date, count] = Object.entries(entry)[0];
        dailyHitsMap[date] = (dailyHitsMap[date] || 0) + (parseInt(count) || 0);
      });

      dailyVisits.forEach((entry) => {
        const [date, count] = Object.entries(entry)[0];
        dailyVisitsMap[date] = (dailyVisitsMap[date] || 0) + (parseInt(count) || 0);
      });
    });

    // Build sorted daily stats array (newest first to match campaign endpoint format)
    const allDates = new Set([...Object.keys(dailyHitsMap), ...Object.keys(dailyVisitsMap)]);
    const dailyStats = Array.from(allDates)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((date) => ({
        date,
        hits: dailyHitsMap[date] || 0,
        visits: dailyVisitsMap[date] || 0,
      }));

    // Aggregate country distribution from campaign geo settings
    const countryTotalsMap = {};
    activeCampaigns.forEach((c, idx) => {
      if (!Array.isArray(c.countries) || c.countries.length === 0) return;
      const campaignResult = statsResults[idx];
      const campaignHits =
        campaignResult.status === "fulfilled" && campaignResult.value
          ? campaignResult.value.totalHits
          : 0;

      c.countries.forEach((geo) => {
        if (!geo.country) return;
        const contribution = Math.round(campaignHits * (geo.percent || 0));
        countryTotalsMap[geo.country] =
          (countryTotalsMap[geo.country] || 0) + contribution;
      });
    });

    const topCountries = Object.entries(countryTotalsMap)
      .map(([country, hits]) => ({ country, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    // Get subscription info for available credits/visits
    const subscription = await Subscription.findOne({ user: userId });
    const availableVisits = subscription
      ? subscription.visitsIncluded - subscription.visitsUsed
      : 0;

    res.json({
      ok: true,
      dateRange: { from: fromDateStr, to: toDateStr, days },
      summary: {
        availableVisits,
        activeCampaigns: activeCampaigns.filter(
          (c) => c.state === "created" || c.state === "ok"
        ).length,
        totalCampaigns: activeCampaigns.length,
        totalHits,
        totalVisits,
        totalPageViews: totalHits,
        uniqueVisitors: totalVisits,
      },
      dailyStats,
      topCountries,
      subscription: subscription
        ? {
            planName: subscription.planName,
            status: subscription.status,
            visitsUsed: subscription.visitsUsed,
            visitsIncluded: subscription.visitsIncluded,
            availableVisits,
          }
        : null,
    });
  } catch (err) {
    logger.error("Get statistics failed", {
      userId: req.user.id,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
