// This file ensures all swagger path definitions are loaded
// The paths are automatically discovered by swagger-jsdoc through the APIs configuration

module.exports = {
  // Re-export all path definitions
  auth: require("./auth"),
  campaigns: require("./campaigns"),
  admin: require("./admin"),
  misc: require("./misc"),
};
