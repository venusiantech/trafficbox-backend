function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function computeGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

async function runScoreCalculator(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { url } = req.body || {};
  const absoluteUrl = toAbsoluteUrl(url);
  if (!absoluteUrl) {
    return res.status(400).json({ detail: "Missing required field: url" });
  }

  let parsed;
  try {
    parsed = new URL(absoluteUrl);
  } catch {
    return res.status(400).json({ detail: "Invalid url provided" });
  }

  const hostname = parsed.hostname;
  const hasHttps = parsed.protocol === "https:";
  const pathDepth = parsed.pathname.split("/").filter(Boolean).length;

  // Placeholder scoring logic for initial non-functional SEO Suite release.
  const breakdown = {
    title: 16,
    meta_description: 15,
    heading_structure: 14,
    content_quality: 13,
    internal_links: 12,
    image_optimization: 10,
    mobile_friendly: 12,
    performance: 11,
  };

  if (!hasHttps) breakdown.performance = Math.max(0, breakdown.performance - 4);
  if (pathDepth > 3) breakdown.internal_links = Math.max(0, breakdown.internal_links - 2);

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round((Object.values(breakdown).reduce((a, b) => a + b, 0) / 160) * 100)
    )
  );
  const grade = computeGrade(score);

  const issues = [];
  const recommendations = [];

  if (!hasHttps) {
    issues.push("Website is not using HTTPS.");
    recommendations.push("Enable HTTPS and force redirect from HTTP.");
  }
  if (pathDepth > 3) {
    issues.push("URL structure appears deep for the tested path.");
    recommendations.push("Keep important pages within 2-3 clicks from homepage.");
  }
  if (hostname.startsWith("www.")) {
    recommendations.push("Ensure canonical tags consistently point to preferred domain.");
  }
  if (issues.length === 0) {
    recommendations.push("Maintain consistent publishing and internal linking cadence.");
  }

  return res.json({
    url: absoluteUrl,
    score,
    grade,
    breakdown,
    issues,
    recommendations,
  });
}

module.exports = { runScoreCalculator };

