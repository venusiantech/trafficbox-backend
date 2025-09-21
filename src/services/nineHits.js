const axios = require("axios");

const BASE = process.env.NINEHITS_BASE || "https://panel.9hits.com/api";
const KEY = process.env.NINEHITS_API_KEY;

if (!KEY) console.warn("Warning: NINEHITS_API_KEY not set in env");

// Helper to get uuidv4 dynamically
async function getUuidV4() {
  return (await import("uuid")).v4();
}

async function profileGet() {
  const resp = await axios.get(`${BASE}/profileGet`, { params: { key: KEY } });
  return resp.data;
}

async function siteGet(params) {
  // params can be { id, limit, page, title }
  const resp = await axios.get(`${BASE}/siteGet`, {
    params: { key: KEY, ...params },
  });
  return resp.data;
}

async function siteAdd(payload, idempotencyKey = null) {
  // idempotency: include a custom header or unique param
  const params = { key: KEY };
  if (idempotencyKey) params.idempotency = idempotencyKey;
  const resp = await axios.post(`${BASE}/siteAdd`, payload, { params });
  return resp.data;
}

async function siteUpdate(payload) {
  const resp = await axios.post(`${BASE}/siteUpdate`, payload, {
    params: { key: KEY },
  });
  return resp.data;
}

async function siteDel(payload) {
  const resp = await axios.post(`${BASE}/siteDel`, payload, {
    params: { key: KEY },
  });
  return resp.data;
}

async function sessionStats() {
  const resp = await axios.get(`${BASE}/sessionStats`, {
    params: { key: KEY },
  });
  return resp.data;
}

// Pause a campaign by setting userState to 'paused'
async function sitePause({ id }) {
  if (!id) throw new Error("id is required");
  return await siteUpdate({ id, userState: "paused" });
}

module.exports = {
  profileGet,
  siteGet,
  siteAdd,
  siteUpdate,
  siteDel,
  sessionStats,
  getUuidV4, // Export the async uuidv4 getter
  sitePause, // Export the pause function
};
