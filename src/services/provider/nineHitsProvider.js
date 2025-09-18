// services/provider/ninehits.js
const nine = require("../nineHits");

async function createCampaign(payload, idempotencyKey) {
  return nine.siteAdd(payload, idempotencyKey);
}

module.exports = {
  createCampaign,
};
