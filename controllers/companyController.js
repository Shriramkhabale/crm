const Company = require('../models/Company');
const Franchise = require('../models/Franchise');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// exports.createCompanyWithLogo = async (req, res) => {
//   try {
//     let {
//       businessName,
//       businessEmail,
//       businessPhone,
//       EmergencyMobNo,
//       password,
//       businessCreatedDate,
//       businessSubscriptionPlan,
//       weeklyHoliday,
//       address,
//       franchise
//     } = req.body;

//     // UPDATED: Parse weeklyHoliday from JSON string to array
//     let weeklyHolidayArr;
//     try {
//       weeklyHolidayArr = weeklyHoliday ? JSON.parse(weeklyHoliday) : ['Sunday']; // Default if empty
//     } catch (error) {
//       console.error('Error parsing weeklyHoliday:', error);
//       weeklyHolidayArr = ['Sunday']; // Fallback
//     }

//     const existing = await Company.findOne({ businessEmail });
//     if (existing) return res.status(400).json({ message: 'Company email already exists' });

//     const businessLogo = req.file ? req.file.path : undefined;

//     // Determine superadmin ID
//     let superadminId;
//     if (req.user.role === 'franchise') {
//       const franchiseUser = await Franchise.findById(req.user.id);
//       if (!franchiseUser) {
//         return res.status(404).json({ message: 'Franchise user not found' });
//       }
//       superadminId = franchiseUser.superadmin;
//     } else {
//       superadminId = req.user.id;
//     }

//     const company = new Company({
//       superadmin: superadminId,
//       franchise,
//       businessName,
//       businessEmail,
//       businessPhone,
//       EmergencyMobNo,
//       password,
//       businessCreatedDate,
//       businessSubscriptionPlan,
//       weeklyHoliday: weeklyHolidayArr,
//       address,
//       businessLogo
//     });

//     await company.save();
//     res.status(201).json({ message: 'Company created', company });
//   } catch (error) {
//     console.error('Error creating company:', error);
//     res.status(500).json({ message: 'Server error', error: error.message || error });
//   }
// };

// exports.getCompanies = async (req, res) => {
//   try {
//     let superadminId;
    
//     // If user is a super_employee, get their associated superadmin ID
//     if (req.user.role === 'super_employee') {
//       superadminId = req.user.superadmin;
//       if (!superadminId) {
//         return res.status(400).json({ message: 'Super employee has no associated superadmin' });
//       }
//     } else {
//       // For superadmin, use their own ID
//       superadminId = req.user.id;
//     }
    
//     const companies = await Company.find({ superadmin: superadminId });
//     res.json(companies);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error });
//   }
// };



exports.createCompanyWithLogo = async (req, res) => {
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
      franchise
    } = req.body;

    // Parse weeklyHoliday from JSON string to array
    let weeklyHolidayArr;
    try {
      weeklyHolidayArr = weeklyHoliday ? JSON.parse(weeklyHoliday) : ['Sunday'];
    } catch (error) {
      console.error('Error parsing weeklyHoliday:', error);
      weeklyHolidayArr = ['Sunday'];
    }

    const existing = await Company.findOne({ businessEmail });
    if (existing) return res.status(400).json({ message: 'Company email already exists' });

    const businessLogo = req.file ? req.file.path : undefined;

    // Determine superadmin ID based on user role
    let superadminId;
    if (req.user.role === 'franchise') {
      // Franchise users: get superadmin from their franchise record
      const franchiseUser = await Franchise.findById(req.user.id);
      if (!franchiseUser) {
        return res.status(404).json({ message: 'Franchise user not found' });
      }
      superadminId = franchiseUser.superadmin;
    } else if (req.user.role === 'super_employee') {
      // Super employees: use their associated superadmin
      superadminId = req.user.superadmin;
      if (!superadminId) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
    } else {
      // Superadmin: use their own ID
      superadminId = req.user.id;
    }

    const company = new Company({
      superadmin: superadminId,
      franchise,
      businessName,
      businessEmail,
      businessPhone,
      EmergencyMobNo,
      password,
      businessCreatedDate,
      businessSubscriptionPlan,
      weeklyHoliday: weeklyHolidayArr,
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


exports.getCompanies = async (req, res) => {
  try {
    console.log('=== GET COMPANIES REQUEST ===');
    console.log('User ID:', req.user.id);
    console.log('User Role:', req.user.role);
    console.log('User Superadmin:', req.user.superadmin);
    console.log('User Franchise:', req.user.franchise);
    
    let query = {};
    
    // Superadmin: can see all companies they own
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
      console.log('Superadmin query: superadmin =', req.user.id);
    }
    // Super_employee: can see companies under their associated superadmin
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
    // Franchise: can see their own companies
    else if (req.user.role === 'franchise') {
      query.franchise = req.user.id;
      console.log('Franchise query: franchise =', req.user.id);
    }
    // Other roles (company, branch, employee) shouldn't access this endpoint
    else {
      console.log('Unauthorized role:', req.user.role);
      return res.status(403).json({ message: 'Unauthorized to view companies' });
    }
    
    console.log('Final query:', query);
    const companies = await Company.find(query);
    console.log('Found companies:', companies.length);
    
    res.json(companies);
  } catch (error) {
    console.error('Error in getCompanies:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// exports.getCompanyById = async (req, res) => {
//   try {
//     const companies = await Company.findById(req.params.id);
//     if (!companies) {
//       return res.status(404).json({ message: 'companies not found' });
//     }
//     res.json(companies);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error });
//   }
// };



exports.getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = { _id: id };
    
    // Add authorization based on role
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else if (req.user.role === 'franchise') {
      query.franchise = req.user.id;
    } else if (req.user.role === 'company') {
      // Company can view their own record
      if (req.user.id !== id) {
        return res.status(403).json({ message: 'You can only view your own company information' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to view company information' });
    }
    
    const company = await Company.findOne(query);
    if (!company) {
      return res.status(404).json({ message: 'Company not found or access denied' });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

exports.getCompaniesByFranchise = async (req, res) => {
  try {
    const { franchiseId } = req.params;

    // Find all companies where franchise field matches the franchiseId
    const companies = await Company.find({ franchise: franchiseId });

    res.json({ companies });
  } catch (error) {
    console.error('Error fetching companies by franchise:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// exports.updateCompanyWithLogo = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     // Validate ID
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({ message: 'Invalid company ID' });
//     }

//     // Role-based authorization
//     let query = { _id: id };
//     if (req.user.role === 'superadmin') {
//       // Superadmin can update companies they own
//       query.superadmin = req.user.id;
//     } else if (req.user.role === 'company') {
//       // Company can only update their own record
//       if (req.user.id !== id) {
//         return res.status(403).json({ message: 'You can only update your own company information' });
//       }
//       // No additional query filter needed since _id is already checked
//     } else {
//       return res.status(403).json({ message: 'Unauthorized to update company information' });
//     }

//     const company = await Company.findOne(query);
//     if (!company) {
//       return res.status(404).json({ message: 'Company not found or access denied' });
//     }

//     // Handle file upload if present
//     if (req.file) {
//       updateData.businessLogo = req.file.path;
//     }


//     // UPDATED: Parse weeklyHoliday if present
//     if (updateData.weeklyHoliday) {
//       try {
//         updateData.weeklyHoliday = JSON.parse(updateData.weeklyHoliday);
//       } catch (error) {
//         console.error('Error parsing weeklyHoliday in update:', error);
//         updateData.weeklyHoliday = ['Sunday']; // Fallback or keep existing
//       }
//     }



//     // Update and save
//     Object.assign(company, updateData);
//     await company.save();

//     res.json({ message: 'Company updated successfully', company });
//   } catch (error) {
//     console.error('Update company error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };


// Delete Company




exports.updateCompanyWithLogo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid company ID' });
    }

    // Role-based authorization
    let query = { _id: id };
    
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      // Super employees can update companies under their superadmin
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else if (req.user.role === 'franchise') {
      // Franchise can update their own companies
      query.franchise = req.user.id;
    } else if (req.user.role === 'company') {
      // Company can only update their own record
      if (req.user.id !== id) {
        return res.status(403).json({ message: 'You can only update your own company information' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to update company information' });
    }

    const company = await Company.findOne(query);
    if (!company) {
      return res.status(404).json({ message: 'Company not found or access denied' });
    }

    // Handle file upload if present
    if (req.file) {
      updateData.businessLogo = req.file.path;
    }

    // Parse weeklyHoliday if present
    if (updateData.weeklyHoliday) {
      try {
        updateData.weeklyHoliday = JSON.parse(updateData.weeklyHoliday);
      } catch (error) {
        console.error('Error parsing weeklyHoliday in update:', error);
        updateData.weeklyHoliday = ['Sunday'];
      }
    }

    // Update and save
    Object.assign(company, updateData);
    await company.save();

    res.json({ message: 'Company updated successfully', company });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// exports.deleteCompany = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const company = await Company.findOneAndDelete({ _id: id, superadmin: req.user.id });
//     if (!company) return res.status(404).json({ message: 'Company not found' });

//     res.json({ message: 'Company deleted' });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error', error });
//   }
// };


exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = { _id: id };
    
    // Determine query based on user role
    if (req.user.role === 'superadmin') {
      query.superadmin = req.user.id;
    } else if (req.user.role === 'super_employee') {
      // Super employees can delete companies under their superadmin
      if (!req.user.superadmin) {
        return res.status(400).json({ message: 'Super employee has no associated superadmin' });
      }
      query.superadmin = req.user.superadmin;
    } else if (req.user.role === 'franchise') {
      query.franchise = req.user.id;
    } else {
      return res.status(403).json({ message: 'Unauthorized to delete companies' });
    }
    
    const company = await Company.findOneAndDelete(query);
    if (!company) return res.status(404).json({ message: 'Company not found or access denied' });

    res.json({ message: 'Company deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

exports.createBranchWithLogo = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      businessName,
      businessEmail,
      businessPhone,
      EmergencyMobNo,
      password,
      businessCreatedDate,
      businessSubscriptionPlan,
      weeklyHoliday,
      address,
      franchise
    } = req.body;

    if (!businessName || !businessEmail || !password) {
      return res.status(400).json({ message: 'businessName, businessEmail and password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: 'Invalid parent company ID' });
    }

    const parentCompany = await Company.findById(companyId);
    if (!parentCompany) {
      return res.status(404).json({ message: 'Parent company not found' });
    }

    if (parentCompany.isBranch) {
      return res.status(400).json({ message: 'Cannot add branch to a branch' });
    }

    const existingBranch = await Company.findOne({ businessEmail });
    if (existingBranch) {
      return res.status(400).json({ message: 'Branch email already exists' });
    }

    // UPDATED: Parse weeklyHoliday from JSON string to array
    let weeklyHolidayArr;
    try {
      weeklyHolidayArr = weeklyHoliday ? JSON.parse(weeklyHoliday) : ['Sunday'];
    } catch (error) {
      console.error('Error parsing weeklyHoliday in branch:', error);
      weeklyHolidayArr = ['Sunday'];
    }

    const businessLogo = req.file ? req.file.path : undefined;

    const branch = new Company({
      businessName,
      businessEmail,
      businessPhone,
      EmergencyMobNo,
      password,
      businessCreatedDate,
      businessSubscriptionPlan,
      weeklyHoliday: weeklyHolidayArr,
      address,
      businessLogo,
      franchise,
      isBranch: true,
      parentCompanyId: parentCompany._id,
      branches: []
    });

    await branch.save();

    parentCompany.branches.push(branch._id);
    await parentCompany.save();

    res.status(201).json({ message: 'Branch created successfully', branch });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateBranchWithLogo = async (req, res) => {
  try {
    const { companyId, branchId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid company or branch ID' });
    }

    const parentCompany = await Company.findById(companyId);
    if (!parentCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (parentCompany.isBranch) {
      return res.status(400).json({ message: 'Provided company ID is a branch, not a company' });
    }

    const branch = await Company.findOne({ _id: branchId, parentCompanyId: companyId, isBranch: true });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found for this company' });
    }

    delete updateData.parentCompanyId;
    delete updateData.isBranch;

    if (req.file) {
      updateData.businessLogo = req.file.path;
    }
    // UPDATED: Parse weeklyHoliday if present
    if (updateData.weeklyHoliday) {
      try {
        updateData.weeklyHoliday = JSON.parse(updateData.weeklyHoliday);
      } catch (error) {
        console.error('Error parsing weeklyHoliday in branch update:', error);
        updateData.weeklyHoliday = ['Sunday']; // Fallback
      }
    }
    Object.assign(branch, updateData);
    await branch.save();

    res.json({ message: 'Branch updated successfully', branch });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getBranchesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: 'Invalid company ID' });
    }

    // Verify parent company exists and is not a branch
    const parentCompany = await Company.findById(companyId);
    if (!parentCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (parentCompany.isBranch) {
      return res.status(400).json({ message: 'Provided ID is a branch, not a company' });
    }

    // Find branches with parentCompanyId = companyId
    const branches = await Company.find({ parentCompanyId: companyId, isBranch: true });

    res.json({ branches });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { companyId, branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid company or branch ID' });
    }

    // Verify parent company exists and is not a branch
    const parentCompany = await Company.findById(companyId);
    if (!parentCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }
    if (parentCompany.isBranch) {
      return res.status(400).json({ message: 'Provided company ID is a branch, not a company' });
    }

    // Find and delete branch if it belongs to the company
    const branch = await Company.findOneAndDelete({ _id: branchId, parentCompanyId: companyId, isBranch: true });
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found for this company' });
    }

    // Remove branch ID from parent company's branches array
    parentCompany.branches.pull(branchId);
    await parentCompany.save();

    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
