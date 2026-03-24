const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizePageUrl(inputUrl) {
  const u = new URL(inputUrl);
  u.hash = "";
  u.search = "";
  // Keep root slash, trim trailing slash on non-root paths.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

function isHtmlLike(headers) {
  const contentType = String(headers?.["content-type"] || headers?.["Content-Type"] || "").toLowerCase();
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || !contentType;
}

function extractLinksFromHtml(html, currentUrl) {
  const links = [];
  const anchorHrefRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = anchorHrefRegex.exec(String(html || ""))) !== null) {
    const href = String(match[1] || "").trim();
    if (!href) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:") || href.startsWith("tel:")) {
      continue;
    }
    try {
      const absolute = new URL(href, currentUrl).toString();
      links.push(absolute);
    } catch {
      // Ignore invalid urls
    }
  }
  return links;
}

function shouldSkipUrl(url) {
  const lower = url.toLowerCase();
  const skipExtensions = [
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".css",
    ".js",
    ".ico",
    ".xml",
    ".zip",
  ];
  return skipExtensions.some((ext) => lower.includes(ext));
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(urlsData) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const item of urlsData) {
    xml += "  <url>\n";
    xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
    xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
    xml += `    <changefreq>${escapeXml(item.changefreq)}</changefreq>\n`;
    xml += `    <priority>${escapeXml(item.priority)}</priority>\n`;
    xml += "  </url>\n";
  }
  xml += "</urlset>";
  return xml;
}

async function runSitemapGenerator(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const body = req.body || {};
  const absolute = toAbsoluteUrl(body.url);
  if (!absolute) {
    return res.status(400).json({ detail: "Missing required field: url" });
  }

  let startUrl;
  let startParsed;
  try {
    startUrl = normalizePageUrl(absolute);
    startParsed = new URL(startUrl);
  } catch {
    return res.status(400).json({ detail: "Invalid url provided" });
  }

  const requestedMaxPages = parseInt(body.max_pages ?? 100, 10);
  const maxPages = Number.isNaN(requestedMaxPages) ? 100 : Math.max(1, Math.min(requestedMaxPages, 500));

  const visited = new Set();
  const queued = new Set([startUrl]);
  const toVisit = [startUrl];
  const urlsData = [];
  const today = new Date().toISOString().slice(0, 10);

  while (toVisit.length > 0 && visited.size < maxPages) {
    const currentUrl = toVisit.shift();
    queued.delete(currentUrl);
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const response = await axios.get(currentUrl, {
        timeout: 7000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { "User-Agent": "TrafficBoxes SEO Crawler/1.0" },
      });

      if (response.status !== 200 || !isHtmlLike(response.headers)) {
        continue;
      }

      urlsData.push({
        loc: currentUrl,
        lastmod: today,
        changefreq: "weekly",
        priority: currentUrl === startUrl ? "1.0" : "0.8",
      });

      const links = extractLinksFromHtml(response.data, currentUrl);
      for (const link of links) {
        let normalized;
        try {
          normalized = normalizePageUrl(link);
        } catch {
          continue;
        }
        const parsed = new URL(normalized);
        if (parsed.host !== startParsed.host) continue;
        if (shouldSkipUrl(normalized)) continue;
        if (visited.has(normalized) || queued.has(normalized)) continue;
        if (visited.size + toVisit.length >= maxPages * 3) continue;
        toVisit.push(normalized);
        queued.add(normalized);
      }
    } catch {
      // Ignore broken pages and continue crawling.
    }
  }

  const sitemapXml = buildSitemapXml(urlsData);

  return res.json({
    success: true,
    urls_found: urlsData.length,
    sitemap_xml: sitemapXml,
    urls: urlsData,
  });
}

module.exports = { runSitemapGenerator };

