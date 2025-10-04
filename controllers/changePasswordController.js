//controllers/changePasswordController.js

const bcrypt = require('bcryptjs');
const Superadmin = require('../models/User'); // or Employee, Company depending on user type

exports.changePassword = async (req, res) => {
  const userId = req.user.userId; // from auth middleware
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new password' });
  }

  try {
    const user = await Superadmin.findById(userId);
    if (!user) return res.status(404).json({ message: 'User  not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};