const ninehits = require("./ninehits");

function getProvider(name) {
  switch (name) {
    case "ninehits":
      return ninehits;
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

module.exports = getProvider;
