const dns = require("node:dns").promises;

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

async function resolveSafe(domain, type) {
  try {
    if (type === "A") return await dns.resolve4(domain);
    if (type === "AAAA") return await dns.resolve6(domain);
    if (type === "MX") {
      const records = await dns.resolveMx(domain);
      return records.map((r) => `${r.exchange} (priority ${r.priority})`);
    }
    if (type === "NS") return await dns.resolveNs(domain);
    if (type === "TXT") {
      const records = await dns.resolveTxt(domain);
      return records.map((chunks) => chunks.join(""));
    }
    if (type === "CNAME") return await dns.resolveCname(domain);
    if (type === "SOA") {
      const soa = await dns.resolveSoa(domain);
      return [
        `nsname=${soa.nsname}; hostmaster=${soa.hostmaster}; serial=${soa.serial}; refresh=${soa.refresh}; retry=${soa.retry}; expire=${soa.expire}; minttl=${soa.minttl}`,
      ];
    }
    return [];
  } catch {
    return [];
  }
}

async function runDnsChecker(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { url } = req.body || {};
  const domain = normalizeDomain(url);
  if (!domain) {
    return res.status(400).json({ detail: "Missing or invalid field: url" });
  }

  try {
    const types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"];
    const records = {};

    for (const type of types) {
      // Sequential keeps resolver pressure low and easy to debug.
      records[type] = await resolveSafe(domain, type);
    }

    return res.json({
      domain,
      records,
    });
  } catch (error) {
    return res.json({
      domain,
      error: error?.message || "Failed to resolve DNS records",
    });
  }
}

module.exports = { runDnsChecker };

