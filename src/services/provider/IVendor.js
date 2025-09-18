class IVendor {
  async createCampaign(payload, idempotencyKey) {
    throw new Error("Not implemented");
  }
  async getCampaign(id) {
    throw new Error("Not implemented");
  }
  async updateCampaign(id, payload) {
    throw new Error("Not implemented");
  }
  async deleteCampaign(id) {
    throw new Error("Not implemented");
  }
}

module.exports = IVendor;
