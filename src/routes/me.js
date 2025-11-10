const express = require("express");
const { requireRole } = require("../middleware/auth");
const User = require("../models/User");
const router = express.Router();

// Get logged-in user's basic info, credits, and available hits
router.get("/", requireRole(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dob: user.dob,
      role: user.role,
      cashBalance: user.cashBalance,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      credits: user.credits,
      availableHits: user.availableHits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout endpoint (stateless JWT)
router.post("/logout", requireRole(), (req, res) => {
  // For JWT, logout is handled on the client by deleting the token.
  // Optionally, you can implement token blacklisting for advanced security.
  res.json({ message: "Logged out. Please delete your token on the client." });
});

module.exports = router;
