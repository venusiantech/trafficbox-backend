const nine = require("../nineHits");

module.exports = {
  createCampaign: async (payload, idempotencyKey) => {
    return nine.siteAdd(payload, idempotencyKey);
  },
  getUuidV4: nine.getUuidV4,
  // Add more methods as needed (updateCampaign, deleteCampaign, etc.)
};
