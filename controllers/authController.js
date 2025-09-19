const Superadmin = require('../models/User');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const Branch = require('../models/Branch');

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
