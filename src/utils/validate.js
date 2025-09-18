module.exports = {
  isValidISOCode: (code) => typeof code === "string" && /^[A-Z]{2}$/.test(code),
};
