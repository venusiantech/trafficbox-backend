const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const SECURITY_HEADERS = {
  "Strict-Transport-Security": { recommended: true },
  "Content-Security-Policy": { recommended: true },
  "X-Frame-Options": { recommended: true },
  "X-Content-Type-Options": { recommended: true },
  "X-XSS-Protection": { recommended: true },
  "Referrer-Policy": { recommended: true },
  "Permissions-Policy": { recommended: false },
};

function getHeaderCaseInsensitive(headers, headerName) {
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === target) {
      return value;
    }
  }
  return null;
}

async function runHeadersAnalyzer(req, res) {
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

  try {
    const response = await axios.get(parsed.toString(), {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        "User-Agent": "TrafficBoxes SEO Suite/1.0",
      },
    });

    const statusCode = response.status;
    const allHeaders = response.headers || {};

    const security_headers = {};
    for (const [headerName, cfg] of Object.entries(SECURITY_HEADERS)) {
      const value = getHeaderCaseInsensitive(allHeaders, headerName);
      security_headers[headerName] = {
        present: Boolean(value),
        value: value || null,
        recommended: cfg.recommended,
      };
    }

    const totalRecommended = Object.values(security_headers).filter((h) => h.recommended).length;
    const presentRecommended = Object.values(security_headers).filter(
      (h) => h.recommended && h.present
    ).length;
    const score =
      totalRecommended === 0
        ? 0
        : Math.round((presentRecommended / totalRecommended) * 100);

    return res.json({
      url: parsed.toString(),
      status_code: statusCode,
      security_headers,
      score,
      all_headers: allHeaders,
    });
  } catch (error) {
    return res.status(500).json({
      detail: error?.message || "Failed to analyze headers",
    });
  }
}

module.exports = { runHeadersAnalyzer };

