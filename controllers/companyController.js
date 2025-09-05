const Company = require('../models/Company');
const bcrypt = require('bcryptjs');

exports.createCompany = async (req, res) => {
  try {
    let {
      businessName,
      businessEmail,
      businessPhone,
      EmergencyMobNo,
      password,
      businessCreatedDate,
      businessSubscriptionPlan,
      weeklyHoliday,
      address,
      businessLogo,
      franchise
    } = req.body;

    // Convert weeklyHoliday to array if string
    if (typeof weeklyHoliday === 'string') {
      weeklyHoliday = [weeklyHoliday];
    }

    const existing = await Company.findOne({ businessEmail });
    if (existing) return res.status(400).json({ message: 'Company email already exists' });

    // Hash password if provided
    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const company = new Company({
      superadmin: req.user.userId,
      franchise,
      businessName,
      businessEmail,
      businessPhone,
      EmergencyMobNo,
      password: hashedPassword,
      businessCreatedDate,
      businessSubscriptionPlan,
      weeklyHoliday,
      address,
      businessLogo
    });

    await company.save();
    res.status(201).json({ message: 'Company created', company });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};


// Get all companies for superadmin
exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ superadmin: req.user.userId }); 
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};



exports.getCompanyById = async (req, res) => {
  try {
    const companies = await Company.findById(req.params.id);
    if (!companies) {
      return res.status(404).json({ message: 'companies not found' });
    }
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


// Update Company
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findOne({ _id: id, superadmin: req.user.userId });
    if (!company) return res.status(404).json({ message: 'Company not found' });

    Object.assign(company, req.body);
    await company.save();

    res.json({ message: 'Company updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Delete Company
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findOneAndDelete({ _id: id, superadmin: req.user.userId });
    if (!company) return res.status(404).json({ message: 'Company not found' });

    res.json({ message: 'Company deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
