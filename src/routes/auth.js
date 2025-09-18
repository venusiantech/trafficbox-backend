const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, dob } = req.body;
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ error: "Email already registered" });
    const user = new User({ email, password, firstName, lastName, dob });
    await user.save();
    // Generate JWT token after registration
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ message: "User logged in", token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
