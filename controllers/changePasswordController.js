const bcrypt = require('bcryptjs');
const Superadmin = require('../models/User'); 
const Company = require('../models/Company'); 
const Employee = require('../models/Employee'); // <-- ADD THIS
const Manager = require('../models/Employee');

exports.changePassword = async (req, res) => {
  console.log("req.user", req.user);

  const userId = req.user.userId; 
  const role = req.user.role; 
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new password' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ message: 'New password must be at least 3 characters long' });
  }

  try {
    let user;

    // Role-based model selection
    if (role === 'superadmin') {
      user = await Superadmin.findById(userId);
      if (!user) return res.status(404).json({ message: 'Superadmin not found' });

    } else if (role === 'company') {
      user = await Company.findById(userId);
      if (!user) return res.status(404).json({ message: 'Company not found' });

    } else if (role === 'Employee') {     // <-- NEW ROLE ADDED
      user = await Employee.findById(userId);
      if (!user) return res.status(404).json({ message: 'Employee not found' });

    } else if (role === 'Manager') {     // <-- NEW ROLE ADDED
      user = await Manager.findById(userId);
      if (!user) return res.status(404).json({ message: 'Employee not found' });

    } else {
      return res.status(400).json({ message: 'Unsupported user role for password change' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear reset token if exists
    if (user.resetPasswordToken) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }

    res.json({
      message: `${role} password changed successfully`,
      userId: user._id
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
