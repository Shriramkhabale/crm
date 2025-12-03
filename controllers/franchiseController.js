const Franchise = require('../models/Franchise');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

exports.createFranchiseWithLogo = async (req, res) => {
  try {
    const {
      franchiseName,
      franchiseEmail,
      franchisePhone,
      password,
      createdDate,
      address,
      userlimit,
      planPrice,
      duration,
      startDate,
      endDate
    } = req.body;

    // Check if franchise already exists
    const existing = await Franchise.findOne({ franchiseEmail });
    if (existing) return res.status(400).json({ message: 'Franchise email already exists' });

    const franchiseLogo = req.file ? req.file.path : undefined;

    // Determine superadmin ID based on user role (SAME AS COMPANIES)
    let superadminId;
    if (req.user.role === 'super_employee') {
      // Super employees: use their associated superadmin
      superadminId = req.user.superadmin;
      if (!superadminId) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
    } else {
      // Superadmin: use their own ID
      superadminId = req.user.id;
    }

    const franchise = new Franchise({
      superadmin: superadminId,
      franchiseName,
      franchisePhone,
      franchiseEmail,
      password,
      createdDate,
      address,
      userlimit,
      planPrice,
      duration,
      startDate,
      endDate,
      franchiseLogo
    });

    await franchise.save();
    res.status(201).json({ message: 'Franchise created', franchise });
  } catch (error) {
    console.error('Create franchise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// Get all franchises for superadmin and super_employee
// Updated getFranchises controller (EXACT SAME AS getCompanies)
exports.getFranchises = async (req, res) => {
  try {
    console.log('=== GET FRANCHISES REQUEST ===');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Superadmin:', req.user.superadmin);
    console.log('User Franchise:', req.user.franchise);
    
    let query = {};
    
    // Superadmin: can see all franchises they own
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
      console.log('Superadmin query: superadmin =', req.user.id);
    }
    // Super_employee: can see franchises under their associated superadmin
    else if (req.user.role === 'super_employee') {
      console.log('Super_employee detected');
      console.log('req.user.superadmin:', req.user.superadmin);
      
      if (!req.user.superadmin) {
        console.log('ERROR: Super employee has no associated superadmin');
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
      console.log('Super_employee query: superadmin =', req.user.superadmin);
    }
    // Other roles shouldn't access this endpoint
    else {
      console.log('Unauthorized role:', req.user.role);
      return res.status(403).json({ message: 'Unauthorized to view franchises' });
    }
    
    console.log('Final query:', query);
    const franchises = await Franchise.find(query);
    console.log('Found franchises:', franchises.length);
    
    res.json(franchises);
  } catch (error) {
    console.error('Error in getFranchises:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getFranchiseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Role-based authorization (SAME AS COMPANIES)
    let query = { _id: id };
    
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      // Super employees can view franchises under their superadmin
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else if (req.user.role === 'franchise') {
      // Franchise users can view their own record
      if (req.user.id !== id) {
        return res.status(403).json({ message: 'You can only view your own franchise information' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to view franchise information' });
    }
    
    const franchise = await Franchise.findOne(query);
    if (!franchise) {
      return res.status(404).json({ message: 'Franchise not found or access denied' });
    }
    res.json(franchise);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

exports.updateFranchiseWithLogo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid franchise ID' });
    }

    // Role-based authorization (SAME AS COMPANIES)
    let query = { _id: id };
    
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      // Super employees can update franchises under their superadmin
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else {
      return res.status(403).json({ message: 'Unauthorized to update franchise' });
    }

    const franchise = await Franchise.findOne(query);
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    // Handle file upload if present
    if (req.file) {
      updateData.franchiseLogo = req.file.path;
    }

    // Update and save
    Object.assign(franchise, updateData);
    await franchise.save();

    res.json({ message: 'Franchise updated', franchise });
  } catch (error) {
    console.error('Update franchise error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Role-based authorization (SAME AS COMPANIES)
    let query = { _id: id };
    
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      // Super employees can delete franchises under their superadmin
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else {
      return res.status(403).json({ message: 'Unauthorized to delete franchise' });
    }
    
    const franchise = await Franchise.findOneAndDelete(query);
    if (!franchise) return res.status(404).json({ message: 'Franchise not found' });

    res.json({ message: 'Franchise deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};