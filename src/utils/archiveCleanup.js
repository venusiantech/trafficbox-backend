const Campaign = require("../models/Campaign");

// Cleanup job to mark archived campaigns eligible for deletion after 7 days
async function cleanupArchivedCampaigns() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Mark campaigns archived for 7+ days as eligible for deletion
    const result = await Campaign.updateMany(
      {
        is_archived: true,
        archived_at: { $lte: sevenDaysAgo },
        delete_eligible: false,
      },
      {
        delete_eligible: true,
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `Marked ${result.modifiedCount} campaigns as eligible for deletion`
      );
    }

    return result;
  } catch (err) {
    console.error("Error in cleanup job:", err.message);
  }
}

// Optional: Permanently delete campaigns that have been eligible for deletion for another 7 days
async function permanentDeleteEligibleCampaigns() {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Find campaigns that have been eligible for deletion for 7+ days
    const campaignsToDelete = await Campaign.find({
      is_archived: true,
      delete_eligible: true,
      archived_at: { $lte: fourteenDaysAgo },
    });

    if (campaignsToDelete.length > 0) {
      console.log(`Permanently deleting ${campaignsToDelete.length} campaigns`);

      // Delete them permanently
      await Campaign.deleteMany({
        is_archived: true,
        delete_eligible: true,
        archived_at: { $lte: fourteenDaysAgo },
      });

      console.log(`Permanently deleted ${campaignsToDelete.length} campaigns`);
    }

    return campaignsToDelete.length;
  } catch (err) {
    console.error("Error in permanent deletion job:", err.message);
  }
}

// Get archive statistics
async function getArchiveStats() {
  try {
    const stats = await Campaign.aggregate([
      {
        $match: { is_archived: true },
      },
      {
        $group: {
          _id: null,
          totalArchived: { $sum: 1 },
          eligibleForDeletion: {
            $sum: { $cond: [{ $eq: ["$delete_eligible", true] }, 1, 0] },
          },
          averageDaysArchived: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), "$archived_at"] },
                1000 * 60 * 60 * 24, // Convert milliseconds to days
              ],
            },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalArchived: 0,
        eligibleForDeletion: 0,
        averageDaysArchived: 0,
      }
    );
  } catch (err) {
    console.error("Error getting archive stats:", err.message);
    return { totalArchived: 0, eligibleForDeletion: 0, averageDaysArchived: 0 };
  }
}

module.exports = {
  cleanupArchivedCampaigns,
  permanentDeleteEligibleCampaigns,
  getArchiveStats,
};
