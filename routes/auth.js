const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { username: user.username, firstname: user.firstname, lastname: user.lastname },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/signup", async (req, res) => {
  try {
    const { username, firstname, lastname, password } = req.body;

    if (!username || !firstname || !lastname || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: "Error, username already exists." });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      firstname,
      lastname,
      passwordHash
    });

    return res.status(201).json({
      message: "Signup successful.",
      user: { username: user.username, firstname: user.firstname, lastname: user.lastname }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "Error, username already exists." });
    }
    return res.status(500).json({ message: "Error during signup." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Error, invalid credentials." });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Error, invalid username or password." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Error, invalid username or password." });

    const token = signToken(user);

    return res.json({
      message: "Login successful.",
      token,
      user: { username: user.username, firstname: user.firstname, lastname: user.lastname }
    });
  } catch (err) {
    return res.status(500).json({ message: "Error during login." });
  }
});

module.exports = router;
