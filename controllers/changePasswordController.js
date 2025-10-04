const bcrypt = require('bcryptjs');
const Superadmin = require('../models/User'); // Assuming this is for superadmins
const Company = require('../models/Company'); // Import Company model for company users

exports.changePassword = async (req, res) => {
  console.log("req.user", req.user);
  
  const userId = req.user.userId; // from auth middleware
  const role = req.user.role; // e.g., 'superadmin' or 'company'
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new password' });
  }

  // Validate password strength (optional - add your rules here)
  if (newPassword.length <3 ) {
    return res.status(400).json({ message: 'New password must be at least 3 characters long' });
  }

  try {
    let user;

    // Role-based model selection
    if (role === 'superadmin') {
      user = await Superadmin.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Superadmin not found' });
      }
    } else if (role === 'company') {
      user = await Company.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'Company not found' });
      }
    } else {
      return res.status(400).json({ message: 'Unsupported user role for password change' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Optional: Clear any password reset tokens if you have them
    if (user.resetPasswordToken) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }

    res.json({ 
      message: `${role === 'superadmin' ? 'Superadmin' : 'Company'} password changed successfully`,
      userId: user._id // Optional: Return user ID for confirmation
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
