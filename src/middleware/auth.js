const jwt = require("jsonwebtoken");

module.exports = function (requiredRole = null) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token or malformed token" });
    }
    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (requiredRole && decoded.role !== requiredRole)
        return res.status(403).json({ error: "Forbidden" });
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};
