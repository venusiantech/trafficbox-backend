const axios = require("axios");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeDomain(input) {
  const absolute = toAbsoluteUrl(input);
  if (!absolute) return null;
  const parsed = new URL(absolute);
  let host = parsed.hostname || "";
  if (host.startsWith("www.")) host = host.slice(4);
  return host || null;
}

function pickCreationDateFromRdapEvents(events) {
  if (!Array.isArray(events)) return null;
  const normalized = events
    .filter((e) => e && e.eventDate)
    .map((e) => ({
      action: String(e.eventAction || "").toLowerCase(),
      date: new Date(e.eventDate),
    }))
    .filter((e) => !Number.isNaN(e.date.getTime()));

  if (normalized.length === 0) return null;

  const registrationLike = normalized.filter(
    (e) =>
      e.action.includes("registration") ||
      e.action.includes("registered") ||
      e.action.includes("creation")
  );
  const source = registrationLike.length > 0 ? registrationLike : normalized;
  // Earliest known date is safest fallback.
  source.sort((a, b) => a.date.getTime() - b.date.getTime());
  return source[0].date;
}

async function runDomainChecker(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { url } = req.body || {};
  const domain = normalizeDomain(url);
  if (!domain) {
    return res.status(400).json({ detail: "Missing or invalid field: url" });
  }

  try {
    const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
    const response = await axios.get(rdapUrl, {
      timeout: 12000,
      validateStatus: () => true,
      headers: { "User-Agent": "TrafficBoxes SEO Suite/1.0" },
    });

    if (response.status < 200 || response.status >= 300) {
      return res.json({
        domain,
        error: `RDAP lookup failed (HTTP ${response.status})`,
      });
    }

    const creationDate = pickCreationDateFromRdapEvents(response.data?.events);
    if (!creationDate) {
      return res.json({
        domain,
        error: "Creation date not found",
      });
    }

    const now = new Date();
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const ageYears = Math.floor(ageDays / 365);
    const ageMonths = Math.floor((ageDays % 365) / 30);

    return res.json({
      domain,
      creation_date: creationDate.toISOString(),
      age_days: ageDays,
      age_years: ageYears,
      age_months: ageMonths,
      age_text: `${ageYears} years, ${ageMonths} months`,
    });
  } catch (error) {
    return res.json({
      domain,
      error: error?.message || "Failed to fetch domain age",
    });
  }
}

module.exports = { runDomainChecker };

