const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(fragment) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g;
  let m;
  while ((m = attrRegex.exec(fragment)) !== null) {
    attrs[String(m[1]).toLowerCase()] = decodeHtmlEntities(m[2]);
  }
  return attrs;
}

function extractMetaTags(html) {
  const metaTags = {
    title: null,
    description: null,
    keywords: null,
    robots: null,
    canonical: null,
    og: {},
    twitter: {},
    other: [],
  };

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) {
    metaTags.title = stripTags(decodeHtmlEntities(titleMatch[1]));
  }

  const metaRegex = /<meta\s+([^>]*?)\/?>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = parseAttributes(metaMatch[1]);
    const name = String(attrs.name || "").toLowerCase();
    const propertyAttr = String(attrs.property || "").toLowerCase();
    const content = attrs.content || "";

    if (name === "description") metaTags.description = content;
    else if (name === "keywords") metaTags.keywords = content;
    else if (name === "robots") metaTags.robots = content;
    else if (propertyAttr.startsWith("og:")) metaTags.og[propertyAttr] = content;
    else if (name.startsWith("twitter:") || propertyAttr.startsWith("twitter:")) {
      const key = name || propertyAttr;
      metaTags.twitter[key] = content;
    } else if (name || propertyAttr) {
      metaTags.other.push({ name: name || propertyAttr, content });
    }
  }

  const linkCanonicalRegex = /<link\s+([^>]*?)\/?>/gi;
  let linkMatch;
  while ((linkMatch = linkCanonicalRegex.exec(html)) !== null) {
    const attrs = parseAttributes(linkMatch[1]);
    const rel = String(attrs.rel || "").toLowerCase();
    if (rel.split(/\s+/).includes("canonical")) {
      metaTags.canonical = attrs.href || null;
      break;
    }
  }

  return metaTags;
}

async function runMetaAnalyzer(req, res) {
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
    const response = await axios.get(absoluteUrl, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": "TrafficBoxes SEO Suite/1.0" },
    });

    if (response.status !== 200) {
      return res
        .status(400)
        .json({ detail: `Failed to fetch URL (HTTP ${response.status})` });
    }

    const html = String(response.data || "");
    const meta_tags = extractMetaTags(html);

    const issues = [];
    let score = 100;

    // Python parity: title analysis
    if (!meta_tags.title) {
      issues.push({ type: "critical", field: "title", message: "Missing title tag" });
      score -= 20;
    } else if (meta_tags.title.length < 30) {
      issues.push({
        type: "warning",
        field: "title",
        message: "Title too short (< 30 chars)",
      });
      score -= 5;
    } else if (meta_tags.title.length > 60) {
      issues.push({
        type: "warning",
        field: "title",
        message: "Title too long (> 60 chars)",
      });
      score -= 5;
    }

    // Python parity: description analysis
    if (!meta_tags.description) {
      issues.push({
        type: "critical",
        field: "description",
        message: "Missing meta description",
      });
      score -= 15;
    } else if (meta_tags.description.length < 120) {
      issues.push({
        type: "warning",
        field: "description",
        message: "Description too short (< 120 chars)",
      });
      score -= 5;
    } else if (meta_tags.description.length > 160) {
      issues.push({
        type: "warning",
        field: "description",
        message: "Description too long (> 160 chars)",
      });
      score -= 5;
    }

    // Python parity: OG tags
    if (!meta_tags.og["og:title"]) {
      issues.push({
        type: "warning",
        field: "og:title",
        message: "Missing Open Graph title",
      });
      score -= 5;
    }
    if (!meta_tags.og["og:description"]) {
      issues.push({
        type: "warning",
        field: "og:description",
        message: "Missing Open Graph description",
      });
      score -= 5;
    }
    if (!meta_tags.og["og:image"]) {
      issues.push({
        type: "warning",
        field: "og:image",
        message: "Missing Open Graph image",
      });
      score -= 5;
    }

    // Python parity: canonical
    if (!meta_tags.canonical) {
      issues.push({
        type: "info",
        field: "canonical",
        message: "No canonical URL specified",
      });
      score -= 3;
    }

    return res.json({
      url: absoluteUrl,
      meta_tags,
      title_length: meta_tags.title ? meta_tags.title.length : 0,
      description_length: meta_tags.description ? meta_tags.description.length : 0,
      issues,
      score: Math.max(0, score),
    });
  } catch (error) {
    return res.status(500).json({
      detail: error?.message || "Failed to analyze URL",
    });
  }
}

module.exports = { runMetaAnalyzer };

