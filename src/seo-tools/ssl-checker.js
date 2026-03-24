const tls = require("tls");

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeCertDnObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  // Node returns subject/issuer keys like C, ST, O, CN...
  const out = {};
  if (obj.O) out.organizationName = obj.O;
  if (obj.CN) out.commonName = obj.CN;
  if (obj.C) out.countryName = obj.C;
  if (obj.ST) out.stateOrProvinceName = obj.ST;
  if (obj.L) out.localityName = obj.L;
  // Keep original keys too for debugging compatibility.
  return { ...obj, ...out };
}

async function getPeerCertificate(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
        timeout: 10000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert || Object.keys(cert).length === 0) {
            return reject(new Error("No SSL certificate returned"));
          }
          resolve(cert);
        } catch (err) {
          reject(err);
        }
      }
    );

    socket.on("error", (err) => reject(err));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("SSL connection timeout"));
    });
  });
}

async function runSslChecker(req, res) {
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
  if (!hostname) {
    return res.status(400).json({ detail: "Invalid hostname" });
  }

  try {
    const cert = await getPeerCertificate(hostname);
    const notBefore = cert.valid_from ? new Date(cert.valid_from) : null;
    const notAfter = cert.valid_to ? new Date(cert.valid_to) : null;

    const now = new Date();
    const daysUntilExpiry =
      notAfter && !Number.isNaN(notAfter.getTime())
        ? Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return res.json({
      valid: true,
      hostname,
      issuer: normalizeCertDnObject(cert.issuer),
      subject: normalizeCertDnObject(cert.subject),
      not_before: notBefore ? notBefore.toISOString() : null,
      not_after: notAfter ? notAfter.toISOString() : null,
      days_until_expiry: daysUntilExpiry,
      expired: typeof daysUntilExpiry === "number" ? daysUntilExpiry < 0 : null,
      expiring_soon:
        typeof daysUntilExpiry === "number" ? daysUntilExpiry > 0 && daysUntilExpiry < 30 : null,
      version: cert.version || null,
      serial_number: cert.serialNumber || null,
    });
  } catch (error) {
    return res.json({
      valid: false,
      hostname,
      error: error?.message || "SSL check failed",
    });
  }
}

module.exports = { runSslChecker };

