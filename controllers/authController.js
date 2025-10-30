//controllers/authController.js
const Superadmin = require('../models/User');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const Franchise = require('../models/Franchise');  // Add this import

const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const jwt = require('jsonwebtoken');  // Assuming installed


const Branch = require('../models/Branch');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);


// Register Superadmin
exports.registerSuperadmin = async (req, res) => {
  const { firstName, phoneNumber, email, password } = req.body;

  try {
    const existingUser  = await Superadmin.findOne({ email });
    if (existingUser ) {
      return res.status(400).json({ message: 'Superadmin already exists' });
    }

    const user = new Superadmin({
      firstName,
      phoneNumber,
      email,
      password,
      role: 'superadmin',
    });

    await user.save();

    res.status(201).json({
      message: 'Superadmin created successfully',
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

// Unified Login for Superadmin, Employee, Company
// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Check Superadmin
//     let user = await Superadmin.findOne({ email });
//     console.log("user1",user);
    
//     if (user) {
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

//       const token = generateToken(user);

//       return res.json({
//         message: 'Login successful',
//         token,
//         user: {
//           id: user._id,
//           firstName: user.firstName,
//           email: user.email,
//           role: user.role,
//           type: 'superadmin',
//         },
//       });
//     }

//     // Check Employee
//     user = await Employee.findOne({ email });
    

//     if (user) {
//       console.log("user2",user);
//       console.log("password",password);
//       console.log("password",password);
      
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

//       const token = generateToken(user);

//       return res.json({
//         message: 'Login successful',
//         token,
//         user: {
//           id: user._id,
//           name: user.teamMemberName,
//           email: user.email,
//           role: user.role,
//           type: 'employee',
//         },
//       });
//     }

//     // Check Company
//     user = await Company.findOne({ businessEmail: email });
//     console.log("user23",user);

//     if (user) {
//       if (!user.password) return res.status(400).json({ message: 'Company user has no password set' });

//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

//       const token = generateToken({ _id: user._id, role: 'company' });

//       return res.json({
//         message: 'Login successful',
//         token,
//         user: {
//           id: user._id,
//           businessName: user.businessName,
//           email: user.businessEmail,
//           role: 'company',
//           type: 'company',
//         },
//       });
//     }


//        // Check Company
//     user = await Branch.findOne({ email: email });
//     console.log("user23",user);

//     if (user) {
//       if (!user.password) return res.status(400).json({ message: 'Company user has no password set' });

//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

//       const token = generateToken({ _id: user._id, role: 'company' });

//       return res.json({
//         message: 'Login successful',
//         token,
//         user: {
//           id: user._id,
//           email: user.email,
//           email: user.email,
//           role: 'company',
//           type: 'company',
//         },
//       });
//     }

//     return res.status(400).json({ message: 'Invalid email or password' });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// };


exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check Superadmin
    let user = await Superadmin.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

      const token = generateToken(user);

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          email: user.email,
          role: user.role,
          type: 'superadmin',
          // Optionally add companyId if applicable, else null
          companyId: null,
        },
      });
    }

    // Check Employee
    user = await Employee.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

      const token = generateToken(user);

      // Fetch companyId from employee document
      const companyId = user.company ? user.company.toString() : null;

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.teamMemberName,
          email: user.email,
          role: user.role,
          type: 'employee',
          companyId,
          accessPermissions: user.accessPermissions || [],  // include in response

        },
      });
    }

    // Check Company
    user = await Company.findOne({ businessEmail: email });
    if (user) {
      if (!user.password) return res.status(400).json({ message: 'Company user has no password set' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

      const token = generateToken({ _id: user._id, role: 'company' });

      // For company user, companyId is their own _id
      const companyId = user._id.toString();

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          businessName: user.businessName,
          email: user.businessEmail,
          role: 'company',
          type: 'company',
          companyId,
          accessPermissions: user.accessPermissions || [],  // include in response

        },
      });
    }

    // Check Branch
    user = await Branch.findOne({ email: email });
    if (user) {
      if (!user.password) return res.status(400).json({ message: 'Branch user has no password set' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

      const token = generateToken({ _id: user._id, role: 'branch' });

      // Fetch companyId from branch document
      const companyId = user.company ? user.company.toString() : null;

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: 'branch',
          type: 'branch',
          companyId,
          accessPermissions: user.accessPermissions || [],  // include in response

        },
      });
    }

    return res.status(400).json({ message: 'Invalid email or password' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Superadmin Profile
exports.updateSuperadmin = async (req, res) => {
  const { id } = req.params;
  const { firstName, phoneNumber, email, password } = req.body;

  try {
    const user = await Superadmin.findById(id);
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


//fetch superadmin data
exports.getSuperadmin = async (req, res) => {
  try {
    console.log("req",req.user);
    
    // Fetch the superadmin by ID from req.user (set by protect middleware)
    const user = await Superadmin.findById(req.user.id).select('-password'); // Exclude password hash for security
    if (!user) {
      return res.status(404).json({ message: 'Superadmin not found' });
    }
    // Return the user data
    res.json({
      message: 'Superadmin data fetched successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Add any other fields you want to include (e.g., if you add more to the schema later)
      },
    });
  } catch (error) {
    console.error('Error fetching superadmin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  console.log("req.body", req.body);

  const { email } = req.body;
  try {
    let user = null;
    let emailField = 'email';

    // Search across all models
    user = await Superadmin.findOne({ email }) ||
           await Employee.findOne({ email }) ||
           await Company.findOne({ businessEmail: email }) ||
           await Franchise.findOne({ franchiseEmail: email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate reset token
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const hashedToken = await bcrypt.hash(resetToken, 10);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send Reset Email using Resend
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await resend.emails.send({
      from: 'One Click CRM <onboarding@resend.dev>',
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



// Reset Password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    // Find user across models
    let user = await Superadmin.findById(userId);
    if (!user) user = await Employee.findById(userId);
    if (!user) user = await Company.findById(userId);
    if (!user) user = await Franchise.findById(userId);
    if (!user || !user.resetPasswordToken || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    const isValidToken = await bcrypt.compare(token, user.resetPasswordToken);
    if (!isValidToken) {
      return res.status(400).json({ message: 'Invalid token' });
    }
    // Update password
    user.password = newPassword;  // Hashed by pre-save
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
