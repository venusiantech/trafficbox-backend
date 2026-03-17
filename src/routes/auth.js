const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendWelcomeEmail } = require("../services/emailService");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, dob } = req.body;
    const exists = await User.findOne({ email });

    if (exists) {
      // If this user was created via lead-capture, complete their registration
      if (exists.isLeadCapture) {
        exists.password = password;
        exists.firstName = firstName || exists.firstName;
        exists.lastName = lastName || exists.lastName;
        exists.dob = dob || exists.dob;
        exists.isLeadCapture = false;
        await exists.save();
        sendWelcomeEmail(exists).catch(() => {});
        const token = jwt.sign(
          { id: exists._id, role: exists.role },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.json({
          success: true,
          message: "Account activated successfully",
          token,
          user: {
            id: exists._id,
            email: exists.email,
            firstName: exists.firstName,
            lastName: exists.lastName,
            dob: exists.dob,
            role: exists.role,
            cashBalance: exists.cashBalance,
            createdAt: exists.createdAt,
          },
        });
      }
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = new User({ email, password, firstName, lastName, dob });
    await user.save();
    sendWelcomeEmail(user).catch(() => {});
    // Generate JWT token after registration
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ 
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dob: user.dob,
        role: user.role,
        cashBalance: user.cashBalance,
        createdAt: user.createdAt
      }
    });
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
    res.json({ 
      success: true,
      message: "User logged in successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dob: user.dob,
        role: user.role,
        cashBalance: user.cashBalance,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register Admin (for testing purposes)
router.post("/register-admin", async (req, res) => {
  try {
    const { email, password, firstName, lastName, dob } = req.body;
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ error: "Email already registered" });
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      dob,
      role: "admin", // Set role as admin
    });
    await user.save();
    // Generate JWT token after registration
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ 
      success: true,
      message: "Admin user created successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dob: user.dob,
        role: user.role,
        cashBalance: user.cashBalance,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
