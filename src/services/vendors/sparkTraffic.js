const axios = require("axios");

const API_URL = "https://v2.sparktraffic.com/add-website-traffic-project";
const API_KEY = process.env.SPARKTRAFFIC_API_KEY; // Add this to your .env

async function createProject(data) {
  const resp = await axios.post(API_URL, data, {
    headers: {
      "Content-Type": "application/json",
      API_KEY: API_KEY,
    },
  });
  return resp.data;
}

// Pause a SparkTraffic project
async function pauseProject(projectId) {
  // Replace with the actual SparkTraffic pause endpoint and payload if available
  const resp = await axios.post(
    `https://v2.sparktraffic.com/pause-website-traffic-project`,
    { id: projectId },
    {
      headers: {
        "Content-Type": "application/json",
        API_KEY: API_KEY,
      },
    }
  );
  return resp.data;
}

module.exports = {
  createProject,
  pauseProject,
};
