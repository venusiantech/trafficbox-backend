const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function extractAnchors(html, baseUrl, limit = 50) {
  const anchors = [];
  const regex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(String(html || ""))) !== null && anchors.length < limit) {
    const href = String(match[1] || "").trim();
    const text = String(match[2] || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);

    if (!href) continue;
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    try {
      const fullUrl = new URL(href, baseUrl).toString();
      anchors.push({ url: fullUrl, text });
    } catch {
      // Ignore invalid href values
    }
  }
  return anchors;
}

async function checkSingleLink(link) {
  const config = {
    timeout: 5000,
    maxRedirects: 0,
    validateStatus: () => true,
    headers: { "User-Agent": "TrafficBoxes SEO Link Checker/1.0" },
  };

  try {
    // HEAD first for speed.
    let response = await axios.head(link.url, config);
    // Some servers do not support HEAD properly.
    if (response.status === 405 || response.status === 501 || response.status === 403) {
      response = await axios.get(link.url, { ...config, responseType: "text" });
    }

    const linkData = {
      url: link.url,
      text: link.text,
      status: response.status,
    };

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      linkData.redirect_to = response.headers?.location || null;
    }
    return linkData;
  } catch {
    return {
      url: link.url,
      text: link.text,
      status: "timeout",
    };
  }
}

async function runLinksChecker(req, res) {
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
    const pageResponse = await axios.get(parsed.toString(), {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": "TrafficBoxes SEO Suite/1.0" },
    });

    if (pageResponse.status !== 200) {
      return res
        .status(400)
        .json({ detail: `Failed to fetch URL (HTTP ${pageResponse.status})` });
    }

    const anchors = extractAnchors(pageResponse.data, parsed.toString(), 50);
    const checked = [];
    const broken = [];
    const redirects = [];

    for (const anchor of anchors) {
      const linkData = await checkSingleLink(anchor);
      checked.push(linkData);
      if (
        linkData.status === "timeout" ||
        (typeof linkData.status === "number" && linkData.status >= 400)
      ) {
        broken.push(linkData);
      } else if (
        typeof linkData.status === "number" &&
        [301, 302, 303, 307, 308].includes(linkData.status)
      ) {
        redirects.push(linkData);
      }
    }

    return res.json({
      url: parsed.toString(),
      total_links: checked.length,
      broken_count: broken.length,
      redirect_count: redirects.length,
      broken_links: broken,
      redirects,
      all_links: checked,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ detail: error?.message || "Failed to check links" });
  }
}

module.exports = { runLinksChecker };

