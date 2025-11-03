async getCurrentAlphaTrafficMetrics(campaignId) {
  try {
    const metrics = {};
    const now = new Date();

    for (const [rangeKey, rangeConfig] of Object.entries(this.timeRanges)) {
      const windowMs = rangeConfig.seconds * 1000;
      const windowStartTime = new Date(now.getTime() - windowMs);

      // Get points within window (ascending)
      const inWindow = await AlphaTrafficData.find({
        campaign: campaignId,
        timestamp: { $gte: windowStartTime, $lte: now },
      })
        .sort({ timestamp: 1 })
        .lean();

      // Baseline point just before window start to compute deltas
      const baseline = await AlphaTrafficData.findOne({
        campaign: campaignId,
        timestamp: { $lt: windowStartTime },
      })
        .sort({ timestamp: -1 })
        .lean();

      if (!inWindow || inWindow.length === 0) {
        metrics[rangeKey] = {
          label: rangeConfig.label,
          totalHits: 0,
          totalVisits: 0,
          totalViews: 0,
          uniqueVisitors: 0,
          avgSpeed: 0,
          maxSpeed: 0,
          avgBounceRate: 0,
          avgSessionDuration: 0,
          peakHitsPerMinute: 0,
          peakVisitsPerMinute: 0,
          countryBreakdown: [],
          topCountries: [],
          timeSeriesData: [],
          dataQuality: "poor",
          lastUpdated: null,
          dataPointsCount: 0,
          completionPercentage: Math.round(((now - windowStartTime) / windowMs) * 100),
        };
        continue;
      }

      const latest = inWindow[inWindow.length - 1];
      const firstInWindow = inWindow[0];
      const baselineForDiff = baseline || firstInWindow;

      const diff = (a, b, key) => Math.max(0, (a?.[key] || 0) - (b?.[key] || 0));
      const totalHits = diff(latest, baselineForDiff, "hits");
      const totalVisits = diff(latest, baselineForDiff, "visits");
      const totalViews = diff(latest, baselineForDiff, "views");
      const uniqueVisitors = diff(latest, baselineForDiff, "uniqueVisitors");

      // Time-weighted averages across the window
      let weightSumMs = 0;
      let speedWeighted = 0;
      let bounceWeighted = 0;
      let sessionWeighted = 0;
      let maxSpeed = 0;

      let prevPoint = baseline ? { ...baseline, timestamp: windowStartTime } : firstInWindow;
      for (const point of inWindow) {
        const startMs = Math.max(new Date(prevPoint.timestamp).getTime(), windowStartTime.getTime());
        const endMs = new Date(point.timestamp).getTime();
        const durationMs = Math.max(endMs - startMs, 0);
        if (durationMs > 0) {
          const spd = point.speed || 0;
          const br = point.bounceRate || 0;
          const sess = point.avgSessionDuration || 0;
          speedWeighted += spd * durationMs;
          bounceWeighted += br * durationMs;
          sessionWeighted += sess * durationMs;
          weightSumMs += durationMs;
          maxSpeed = Math.max(maxSpeed, spd);
        }
        prevPoint = point;
      }
      // Extend last point to now
      if (inWindow.length > 0) {
        const last = inWindow[inWindow.length - 1];
        const startMs = Math.max(new Date(last.timestamp).getTime(), windowStartTime.getTime());
        const endMs = now.getTime();
        const durationMs = Math.max(endMs - startMs, 0);
        if (durationMs > 0) {
          const spd = last.speed || 0;
          const br = last.bounceRate || 0;
          const sess = last.avgSessionDuration || 0;
          speedWeighted += spd * durationMs;
          bounceWeighted += br * durationMs;
          sessionWeighted += sess * durationMs;
          weightSumMs += durationMs;
          maxSpeed = Math.max(maxSpeed, last.speed || 0);
        }
      }

      const avgSpeed = weightSumMs > 0 ? Math.round((speedWeighted / weightSumMs) * 100) / 100 : 0;
      const avgBounceRate = weightSumMs > 0 ? Math.round((bounceWeighted / weightSumMs) * 100) / 100 : 0;
      const avgSessionDuration = weightSumMs > 0 ? Math.round((sessionWeighted / weightSumMs) * 100) / 100 : 0;

      // Peak per-minute rates based on consecutive deltas
      let peakHitsPerMinute = 0;
      let peakVisitsPerMinute = 0;
      const ratePerMinute = (from, to, key) => {
        const dtMin = Math.max((new Date(to.timestamp) - new Date(from.timestamp)) / 60000, 1 / 60);
        return Math.max(0, ((to?.[key] || 0) - (from?.[key] || 0)) / dtMin);
      };
      if (baseline && firstInWindow) {
        const pseudoStart = { ...baseline, timestamp: windowStartTime };
        peakHitsPerMinute = Math.max(peakHitsPerMinute, ratePerMinute(pseudoStart, firstInWindow, "hits"));
        peakVisitsPerMinute = Math.max(peakVisitsPerMinute, ratePerMinute(pseudoStart, firstInWindow, "visits"));
      }
      for (let i = 1; i < inWindow.length; i++) {
        const prev = inWindow[i - 1];
        const curr = inWindow[i];
        peakHitsPerMinute = Math.max(peakHitsPerMinute, ratePerMinute(prev, curr, "hits"));
        peakVisitsPerMinute = Math.max(peakVisitsPerMinute, ratePerMinute(prev, curr, "visits"));
      }

      // Country breakdown from latest snapshot
      const latestCountries = latest.countryBreakdown || [];
      const baseTotalForPct = latest.hits || 1;
      const countryBreakdown = latestCountries.map((c) => ({
        country: c.country,
        hits: c.hits || 0,
        visits: c.visits || 0,
        views: c.views || 0,
        percentage: ((c.hits || 0) / baseTotalForPct) * 100,
        growth: 0,
      }));
      const topCountries = countryBreakdown
        .slice()
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map((c, idx) => ({ country: c.country, hits: c.hits, percentage: c.percentage, rank: idx + 1 }));

      const timeSeriesData = inWindow.map((p) => ({
        timestamp: p.timestamp,
        hits: p.hits || 0,
        visits: p.visits || 0,
        speed: p.speed || 0,
      }));

      // Data quality heuristic: ~1 point/minute expected
      const expectedPoints = Math.max(Math.floor(rangeConfig.seconds / 60), 1);
      const completeness = Math.min(inWindow.length / expectedPoints, 1);
      const dataQuality = completeness >= 0.9 ? "excellent" : completeness >= 0.7 ? "good" : completeness >= 0.5 ? "fair" : "poor";

      metrics[rangeKey] = {
        label: rangeConfig.label,
        totalHits,
        totalVisits,
        totalViews,
        uniqueVisitors,
        avgSpeed,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        avgBounceRate,
        avgSessionDuration,
        peakHitsPerMinute: Math.round(peakHitsPerMinute * 100) / 100,
        peakVisitsPerMinute: Math.round(peakVisitsPerMinute * 100) / 100,
        countryBreakdown,
        topCountries,
        timeSeriesData,
        dataQuality,
        lastUpdated: latest.timestamp,
        dataPointsCount: inWindow.length,
        completionPercentage: Math.round(((now - windowStartTime) / windowMs) * 100),
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
