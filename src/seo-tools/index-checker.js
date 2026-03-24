const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractDomain(url) {
  const absolute = toAbsoluteUrl(url);
  if (!absolute) return null;
  const parsed = new URL(absolute);
  return parsed.hostname;
}

function getGoogleSearchUrl(targetUrl) {
  // Quoted search helps keep exact URL matching, even with special chars.
  const query = encodeURIComponent(`"${targetUrl}"`);
  return `https://www.google.com/search?q=${query}&num=10&hl=en`;
}

async function fetchGoogleResultHtml(searchUrl) {
  const scraperApiKey = (process.env.SCRAPERAPI_API_KEY || "").trim();
  const timeoutMs = parseInt(process.env.SEO_TOOL_TIMEOUT_MS || "20000", 10);

  const requestConfig = {
    method: "GET",
    timeout: Number.isNaN(timeoutMs) ? 20000 : timeoutMs,
    headers: {
      // Browser-like UA helps reduce simple blocking.
      "User-Agent":
        process.env.SEO_TOOL_USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
    validateStatus: () => true,
  };

  if (scraperApiKey) {
    // ScraperAPI proxy mode (recommended for scale).
    const proxyUrl = "https://api.scraperapi.com";
    const response = await axios.get(proxyUrl, {
      ...requestConfig,
      params: {
        api_key: scraperApiKey,
        url: searchUrl,
        country_code: "us",
      },
    });
    return response?.data ? String(response.data) : "";
  }

  // Fallback direct mode (may be blocked by Google).
  const response = await axios.get(searchUrl, requestConfig);
  return response?.data ? String(response.data) : "";
}

function detectGoogleIndexStatus(html, targetUrl, domain) {
  const lower = String(html || "").toLowerCase();
  const targetLower = String(targetUrl || "").toLowerCase();
  const domainLower = String(domain || "").toLowerCase();

  const noResultsSignals = [
    "did not match any documents",
    "your search -",
    "no results found for",
    "can't find",
    "did not match any",
  ];
  const hasNoResultsSignal = noResultsSignals.some((s) => lower.includes(s));

  // Heuristic: if exact URL appears in page html, it is very likely indexed.
  const hasExactUrl = targetLower && lower.includes(targetLower);
  // Fallback: sometimes Google prints normalized URL; domain+path fragments help.
  const urlObj = new URL(targetUrl);
  const pathFragment = `${domainLower}${urlObj.pathname}`.toLowerCase();
  const hasDomainPath = pathFragment.length > domainLower.length && lower.includes(pathFragment);

  if (hasExactUrl || hasDomainPath) return "Indexed";
  if (hasNoResultsSignal) return "Not Indexed";
  return "Unknown";
}

/**
 * Returns the response shape expected by the frontend
 * `SearchEngineIndexChecker` component.
 */
async function runIndexChecker(req, res) {
  // Enforce auth even if the caller hits a non-auth middleware path.
  // `requireRole()` normally sets `req.user`.
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ detail: "Missing required field: url" });
  }

  let domain;
  try {
    domain = extractDomain(url);
  } catch {
    domain = null;
  }

  if (!domain) {
    return res.status(400).json({ detail: "Invalid url provided" });
  }

  const siteQuery = `site:${domain}`;
  const encodedSiteQuery = encodeURIComponent(siteQuery);
  const normalizedTargetUrl = toAbsoluteUrl(url);
  const googleCheckUrl = getGoogleSearchUrl(normalizedTargetUrl);

  let googleStatus = "Unknown";
  let googleError = null;
  try {
    const googleHtml = await fetchGoogleResultHtml(googleCheckUrl);
    googleStatus = detectGoogleIndexStatus(googleHtml, normalizedTargetUrl, domain);
  } catch (error) {
    googleStatus = "Unknown";
    googleError = error?.message || "Google check failed";
  }

  return res.json({
    domain,
    total_engines: 4,
    quick_submit_tip: googleStatus === "Indexed"
      ? "Google currently shows this URL as indexed. Keep sitemap and content freshness updated."
      : "Request indexing in Search Console and submit your sitemap after content updates.",
    google_index_status: googleStatus,
    ...(googleError ? { google_check_error: googleError } : {}),
    search_engines: [
      {
        name: "Google",
        status: googleStatus,
        check_url: googleCheckUrl,
        submit_url: "https://search.google.com/search-console/indexing/submit",
        instructions: [
          "Open Google Search Console.",
          "Go to URL Inspection.",
          "Paste your homepage URL.",
          "Click Request Indexing and wait for results.",
        ],
      },
      {
        name: "Bing",
        status: "Unknown",
        check_url: `https://www.bing.com/search?q=${encodedSiteQuery}`,
        submit_url: "https://www.bing.com/webmasters/submit-url",
        instructions: [
          "Open Bing Webmaster Tools.",
          "Use the URL submission tool.",
          "Paste the homepage URL.",
          "Submit and monitor crawl/index status.",
        ],
      },
      {
        name: "Yandex",
        status: "Unknown",
        check_url: `https://yandex.com/search/?text=${encodedSiteQuery}`,
        submit_url: "https://webmaster.yandex.com/site/indexing/",
        instructions: [
          "Open Yandex Webmaster.",
          "Go to Indexing / URLs.",
          "Submit the homepage URL or sitemap.",
          "Check whether indexing starts.",
        ],
      },
      {
        name: "DuckDuckGo",
        status: "Unknown",
        check_url: `https://duckduckgo.com/?q=${encodedSiteQuery}`,
        submit_url: "https://duckduckgo.com/submit",
        instructions: [
          "Use the submit form (may take time).",
          "Rely on sitemap updates to improve discovery.",
          "Re-check after changes propagate to the underlying sources.",
        ],
      },
    ],
    ping_services: [
      {
        name: "IndexNow (Bing)",
        url: `https://www.bing.com/indexnow`,
        instructions: "Ping IndexNow after sitemap updates (implementation later).",
      },
      {
        name: "Google Search Console",
        url: "https://search.google.com/search-console",
        instructions: "Use URL Inspection -> Request Indexing.",
      },
    ],
  });
}

module.exports = { runIndexChecker };

