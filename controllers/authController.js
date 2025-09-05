// authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

// Register Superadmin (initial setup)
exports.registerSuperadmin = async (req, res) => {
  const { firstName, phoneNumber, email, password } = req.body;

  try {
    const existingUser  = await User.findOne({ email });
    if (existingUser ) {
      return res.status(400).json({ message: 'Superadmin already exists' });
    }

    const user = new User({
      firstName,
      phoneNumber,
      email,
      password,
      role: 'superadmin',
    });

    await user.save();

    res.status(201).json({
      message: 'Superadmin created successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Superadmin Profile
exports.updateSuperadmin = async (req, res) => {
  const { id } = req.params;
  const { firstName, phoneNumber, email, password } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User  not found' });

    if (firstName) user.firstName = firstName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (email) user.email = email;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.json({ message: 'User  updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
