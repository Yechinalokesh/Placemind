const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// 📝 REGISTER - Student or TPO
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: '⚠️ Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student'
    });

    await newUser.save();
    res.status(201).json({ message: '✅ Registration successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Registration failed' });
  }
});

// 🔐 LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: '❌ User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: '❌ Invalid password' });

    res.status(200).json({
      message: '✅ Login successful',
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Login failed' });
  }
});

module.exports = router;
