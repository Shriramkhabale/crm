const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const cloudinary = require('../config/cloudinaryConfig');  // For deletion
const Leave = require('../models/Leave');  // Add import
const mongoose = require('mongoose');  // For validation

// NEW: Helper to extract publicId from Cloudinary URL (for fixed images)
const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    // Cloudinary URL format: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<publicId>.<ext>
    const parts = url.split('/');
    const publicIdPart = parts[parts.length - 1].split('.')[0];  // Last part before ext
    if (parts.includes('upload') && publicIdPart) {
      // Full publicId may include folder/path, but for deletion, base is fine
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1) {
        const potentialPublicId = parts.slice(uploadIndex + 2).join('/').split('.')[0];
        return potentialPublicId || null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting publicId:', error);
    return null;
  }
};

// NEW: Helper to delete from Cloudinary (generic for fixed/dynamic)
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;  // Skip if no ID
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    console.log('Cloudinary deletion result:', result);
    return result;
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

// Controller: Create employee (fixed + dynamic docs)
exports.createEmployee = async (req, res) => {
  try {
    // ADD: Log full incoming data for debugging (remove after fixing)
    console.log('🔍 CREATE DEBUG - Full req.body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 CREATE DEBUG - Full req.files:', req.files ? {
      adharImage: req.files.adharImage ? `${req.files.adharImage.length} file(s)` : 'none',
      panImage: req.files.panImage ? `${req.files.panImage.length} file(s)` : 'none',
      profileImage: req.files.profileImage ? `${req.files.profileImage.length} file(s)` : 'none',
      documents: req.files.documents ? `${req.files.documents.length} file(s)` : 'none'
    } : 'no files');

    const {
      company,
      teamMemberName,
      mobileNumber,
      isActive,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      departments,  // <-- Changed: Expect 'departments' (plural) from frontend
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      pfPercentage,
      esicPercentage,
      paidLeaves,
      weeklyHoliday,
      address,
      accessPermissions,
      qrCode,
      documentTypes,  // Expect array from frontend for CREATE
    } = req.body;

    // ADD: Specific logging for dynamic docs
    console.log('📎 CREATE: Received documentTypes:', documentTypes ? `${documentTypes.length} items: ${JSON.stringify(documentTypes)}` : 'undefined/empty');
    console.log('📎 CREATE: Received documents files:', req.files?.documents ? `${req.files.documents.length} file(s): ${req.files.documents.map(f => f.originalname || f.filename).join(', ')}` : 'none/missing');

    // Validate departments (unchanged)
    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ message: 'At least one department is required' });
    }
    const validDepartments = [...new Set(departments.filter(id => id && id.trim() !== ''))];
    if (validDepartments.length === 0) {
      return res.status(400).json({ message: 'Invalid departments provided' });
    }

    console.log('Creating employee with departments:', validDepartments); // Debug log

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Employee email already exists' });

    // FIXED: Extract uploaded file URLs
    const adharImage = req.files?.adharImage ? req.files.adharImage[0].path : null;
    const panImage = req.files?.panImage ? req.files.panImage[0].path : null;
    const profileImage = req.files?.profileImage ? req.files.profileImage[0].path : null;

    console.log('🖼️ Fixed images processed:', {
      adharImage: adharImage ? adharImage.substring(0, 50) + '...' : 'none',
      panImage: panImage ? panImage.substring(0, 50) + '...' : 'none',
      profileImage: profileImage ? profileImage.substring(0, 50) + '...' : 'none'
    });

    // NEW: Handle dynamic documents
    let dynamicDocuments = [];
    if (documentTypes && Array.isArray(documentTypes) && documentTypes.length > 0) {
      const types = documentTypes.filter(type => type && type.trim() !== '');
      console.log('📎 CREATE: Filtered types:', types);  // ADD: Log filtered types

      if (types.length === 0) {
        return res.status(400).json({ message: 'Invalid dynamic document types provided' });
      }
      if (req.files?.documents && Array.isArray(req.files.documents)) {
        const files = req.files.documents;
        console.log('📎 CREATE: Files details:', files.map((f, i) => ({ name: f.originalname, path: f.path?.substring(0, 50) + '...', public_id: f.public_id || f.filename })));  // ADD: Detailed file log

        if (files.length !== types.length) {
          console.warn('⚠️ MISMATCH: Types length:', types.length, 'vs Files length:', files.length);  // ADD: Warn on mismatch
          return res.status(400).json({ 
            message: `Dynamic docs mismatch: ${types.length} types but ${files.length} files` 
          });
        }
        // Check duplicates
        const uniqueTypes = [...new Set(types.map(t => t.toLowerCase()))];
        if (uniqueTypes.length !== types.length) {
          return res.status(400).json({ message: 'Duplicate dynamic document types not allowed' });
        }
        // Create array
        dynamicDocuments = files.map((file, index) => ({
          type: types[index].trim(),
          url: file.path,
          publicId: file.public_id || file.filename  // Cloudinary public ID
        }));
        console.log('✅ CREATE: Created dynamic documents:', dynamicDocuments.length, 'items');
        dynamicDocuments.forEach(doc => console.log(`│   ├── Type: ${doc.type}, URL: ${doc.url.substring(0, 50)}..., PublicID: ${doc.publicId}`));
      } else {
        console.warn('⚠️ No documents files received despite types');  // ADD: Warn if no files
        return res.status(400).json({ message: 'Files required for dynamic document types' });
      }
    } else {
      console.log('ℹ️ CREATE: Skipping dynamic docs (no valid documentTypes)');  // ADD: Log skip reason
    }

    const employee = new Employee({
      company,
      teamMemberName,
      mobileNumber,
      isActive,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      department: validDepartments, 
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      pfPercentage,
      esicPercentage,
      paidLeaves,
      weeklyHoliday,
      address,
      accessPermissions,
      // FIXED: Keep as is
      adharImage,
      panImage,
      profileImage,
      // NEW: Dynamic array
      documents: dynamicDocuments,
      qrCode
    });

    await employee.save();
    console.log('✅ Employee saved with documents count:', employee.documents.length);  // ADD: Final log

    // Remove password from response
    employee.password = undefined;

    res.status(201).json({ message: 'Employee created', employee });
  } catch (error) {
    console.error('Create employee error:', error); // Enhanced logging
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Controller: Update employee (fixed + dynamic docs)
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const {
      teamMemberName,
      mobileNumber,
      isActive,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      departments,  // <-- Changed: Expect 'departments' (plural) from frontend
      role,
      designation,
      aadharNumber,
      panNumber,
      userUpi,
      pfPercentage,
      esicPercentage,
      weeklyHoliday,
      paidLeaves,
      address,
      accessPermissions,
      qrCode,
      newDocumentTypes,
      // documents: newDocumentTypes,  // NEW: For adding new dynamic docs
      removeDocuments,  // NEW: Array of dynamic types to remove, e.g., ["Driving License"]
      adharImage: adharImageNull,  // NEW: Explicit null to delete fixed
      panImage: panImageNull,
      profileImage: profileImageNull
    } = req.body;

    // Handle departments update (unchanged)
    if (departments) {
      if (!Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({ message: 'Invalid departments provided' });
      }
      const validDepartments = [...new Set(departments.filter(id => id && id.trim() !== ''))];
      if (validDepartments.length === 0) {
        return res.status(400).json({ message: 'At least one department is required' });
      }
      employee.department = validDepartments;  // <-- Fixed: Assign to model field 'department' (as array)
      console.log('Updating employee departments:', validDepartments); // Debug log
    }

    // Standard field updates (unchanged)
    if (teamMemberName) employee.teamMemberName = teamMemberName;
    if (mobileNumber) employee.mobileNumber = mobileNumber;
    if (isActive) employee.isActive = isActive;
    if (emergencyMobileNumber) employee.emergencyMobileNumber = emergencyMobileNumber;
    if (email) employee.email = email;
    if (salary !== undefined) employee.salary = salary;
    if (dateOfJoining) employee.dateOfJoining = dateOfJoining;
    if (shift) employee.shift = shift;
    if (role) employee.role = role;
    if (designation) employee.designation = designation;
    if (aadharNumber) employee.aadharNumber = aadharNumber;
    if (panNumber) employee.panNumber = panNumber;
    if (userUpi) employee.userUpi = userUpi;
    if (pfPercentage) employee.pfPercentage = pfPercentage;
    if (esicPercentage) employee.esicPercentage = esicPercentage;

    if (weeklyHoliday) employee.weeklyHoliday = weeklyHoliday;
    if (paidLeaves) employee.paidLeaves = paidLeaves;
    if (address) employee.address = address;
    if (accessPermissions) employee.accessPermissions = accessPermissions;
    if (qrCode) employee.qrCode = qrCode;

    // FIXED: Update images if uploaded (unchanged)
    if (req.files?.adharImage) {
      employee.adharImage = req.files.adharImage[0].path;
    }
    if (req.files?.panImage) {
      employee.panImage = req.files.panImage[0].path;
    }
    if (req.files?.profileImage) {
      employee.profileImage = req.files.profileImage[0].path;
    }

        // NEW: Handle explicit deletion of fixed images (if body sends null)
    if (adharImageNull === null && employee.adharImage) {
      const publicId = extractPublicIdFromUrl(employee.adharImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.adharImage = null;
      console.log('Deleted Aadhar image from Cloudinary');
    }
    if (panImageNull === null && employee.panImage) {
      const publicId = extractPublicIdFromUrl(employee.panImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.panImage = null;
      console.log('Deleted PAN image from Cloudinary');
    }
    if (profileImageNull === null && employee.profileImage) {
      const publicId = extractPublicIdFromUrl(employee.profileImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.profileImage = null;
      console.log('Deleted Profile image from Cloudinary');
    }

    // NEW: Handle dynamic document removal (if removeDocuments in body)
    if (removeDocuments && Array.isArray(removeDocuments) && removeDocuments.length > 0) {
      const typesToRemove = removeDocuments.filter(type => type && type.trim() !== '');
      for (const typeToRemove of typesToRemove) {
        const docIndex = employee.documents.findIndex(doc => doc.type.toLowerCase() === typeToRemove.toLowerCase());
        if (docIndex !== -1) {
          const doc = employee.documents[docIndex];
          await deleteFromCloudinary(doc.publicId);  // Delete from Cloudinary
          employee.documents.splice(docIndex, 1);  // Remove from array
          console.log(`Removed dynamic document: ${doc.type}`);
        } else {
          console.warn(`Dynamic document type not found for removal: ${typeToRemove}`);
        }
      }
    }

    // NEW: Handle adding new dynamic documents
    if (newDocumentTypes && Array.isArray(newDocumentTypes) && newDocumentTypes.length > 0) {
      const types = newDocumentTypes.filter(type => type && type.trim() !== '');
      if (types.length === 0) {
        return res.status(400).json({ message: 'Invalid new dynamic document types provided' });
      }
      if (req.files?.documents && Array.isArray(req.files.documents)) {
        const files = req.files.documents;
        if (files.length !== types.length) {
          return res.status(400).json({ 
            message: `Dynamic docs mismatch: ${types.length} new types but ${files.length} new files` 
          });
        }
        // Check for duplicates with existing
        const existingTypes = employee.documents.map(doc => doc.type.toLowerCase());
        const newTypesLower = types.map(t => t.toLowerCase());
        const duplicates = newTypesLower.filter(t => existingTypes.includes(t));
        if (duplicates.length > 0) {
          return res.status(400).json({ message: `Duplicate dynamic types not allowed: ${duplicates.join(', ')}` });
        }
        // Add new documents
        const newDocs = files.map((file, index) => ({
          type: types[index].trim(),
          url: file.path,
          publicId: file.filename
        }));
        employee.documents.push(...newDocs);
        console.log('Added new dynamic documents:', newDocs.map(d => d.type));
      } else {
        return res.status(400).json({ message: 'Files required for new dynamic document types' });
      }
    }

    // Password hashing (fixed: your original code had a bug—salt was used twice)
    if (password) {
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password, salt);
    }

    await employee.save();
    res.json({ message: 'Employee updated', employee });
  } catch (error) {
    console.error('Update employee error:', error); // Enhanced logging
    res.status(500).json({ message: 'Server error', error: error.message || error });
  }
};

// NEW: Get all documents for an employee (fixed + dynamic)
exports.getEmployeeDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id).select('adharImage panImage profileImage documents');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    res.json({
      message: 'Employee documents retrieved',
      documents: {
        fixed: {
          adharImage: employee.adharImage || null,
          panImage: employee.panImage || null,
          profileImage: employee.profileImage || null
        },
        dynamic: employee.documents || []  // Array of { type, url, publicId, uploadedAt }
      }
    });
  } catch (error) {
    console.error('Get employee documents error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ... (Rest unchanged: getAllEmployees, getEmployeeById, getEmployeesByCompany, deleteEmployee)
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

exports.getEmployeesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employees = await Employee.find({ company: companyId });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Delete Employee (with full Cloudinary cleanup)
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // NEW/ENHANCED: Delete all associated images/documents from Cloudinary before DB deletion
    const deletionErrors = [];  // Track any failures

    // Fixed images
    if (employee.adharImage) {
      try {
        const publicId = extractPublicIdFromUrl(employee.adharImage);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log('Deleted adharImage from Cloudinary');
        }
      } catch (error) {
        console.error('Failed to delete adharImage from Cloudinary:', error);
        deletionErrors.push('adharImage');
      }
    }

    if (employee.panImage) {
      try {
        const publicId = extractPublicIdFromUrl(employee.panImage);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log('Deleted panImage from Cloudinary');
        }
      } catch (error) {
        console.error('Failed to delete panImage from Cloudinary:', error);
        deletionErrors.push('panImage');
      }
    }

    if (employee.profileImage) {
      try {
        const publicId = extractPublicIdFromUrl(employee.profileImage);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log('Deleted profileImage from Cloudinary');
        }
      } catch (error) {
        console.error('Failed to delete profileImage from Cloudinary:', error);
        deletionErrors.push('profileImage');
      }
    }

    // Dynamic documents
    if (employee.documents && employee.documents.length > 0) {
      for (const doc of employee.documents) {
        try {
          await deleteFromCloudinary(doc.publicId);
          console.log(`Deleted dynamic document "${doc.type}" from Cloudinary`);
        } catch (error) {
          console.error(`Failed to delete dynamic document "${doc.type}" from Cloudinary:`, error);
          deletionErrors.push(doc.type);
        }
      }
    }

    // Delete from DB
    await Employee.findByIdAndDelete(id);

    // Response
    const message = deletionErrors.length > 0 
      ? `Employee deleted. Warning: Failed to delete from Cloudinary: ${deletionErrors.join(', ')}`
      : 'Employee deleted successfully (including all images/documents from Cloudinary)';

    res.json({ message });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// NEW: Get employee's leave counts (allocated, taken, remaining per type)
exports.getEmployeeLeaveCounts = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { includeUnpaid = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(employeeId).populate('company', 'name');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // 1. Get allocated leave types from employee.paidLeaves
    // Map: { lowerCaseType: { type: originalType, allocated: count } }
    const allocatedMap = {};
    employee.paidLeaves.forEach(pl => {
      allocatedMap[pl.type.toLowerCase()] = { type: pl.type, allocated: pl.count };
    });

    // 2. Get all paid leaves (approved/partially approved) for employee
    const paidLeaves = await Leave.find({
      employee: employeeId,
      leaveType: { $ne: 'unpaid' },
      status: { $in: ['Approved', 'Partially Approved'] }
    }).select('leaveType approvedDates fromDate toDate status').lean();

    // 3. Aggregate taken days by leaveType (case-insensitive)
    const takenMap = {};
    paidLeaves.forEach(leave => {
      const typeKey = leave.leaveType.toLowerCase();
      let days = 0;
      if (leave.status === 'Approved') {
        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);
        days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      } else if (leave.status === 'Partially Approved' && leave.approvedDates) {
        days = leave.approvedDates.length;
      }
      if (days > 0) {
        takenMap[typeKey] = (takenMap[typeKey] || 0) + days;
      }
    });

    // 4. Combine all leave types (union of allocated and taken)
    const allTypesSet = new Set([
      ...Object.keys(allocatedMap),
      ...Object.keys(takenMap)
    ]);

    // 5. Build leaveCounts array with allocated, taken, remaining
    const leaveCounts = [];
    allTypesSet.forEach(typeKey => {
      const allocatedEntry = allocatedMap[typeKey];
      const allocated = allocatedEntry ? allocatedEntry.allocated : 0;
      const originalType = allocatedEntry ? allocatedEntry.type : typeKey;  // Use original casing if allocated, else lowercase key
      const taken = takenMap[typeKey] || 0;
      const remaining = Math.max(0, allocated - taken);

      leaveCounts.push({
        type: originalType,
        allocated,
        taken,
        remaining
      });
    });

    // 6. Totals
    const totalAllocated = leaveCounts.reduce((sum, lc) => sum + lc.allocated, 0);
    const totalTaken = leaveCounts.reduce((sum, lc) => sum + lc.taken, 0);
    const totalRemaining = leaveCounts.reduce((sum, lc) => sum + lc.remaining, 0);

    // 7. Optional unpaid leaves summary
    let unpaidSummary = null;
    if (includeUnpaid === 'true') {
      const unpaidLeaves = await Leave.find({
        employee: employeeId,
        leaveType: 'unpaid',
        status: { $in: ['Approved', 'Partially Approved'] }
      }).select('reason fromDate toDate status approvedDates').populate('company', 'name').sort({ appliedDate: -1 });

      const totalUnpaidTaken = unpaidLeaves.reduce((sum, leave) => {
        return sum + (leave.status === 'Approved'
          ? Math.ceil((new Date(leave.toDate) - new Date(leave.fromDate)) / (1000 * 60 * 60 * 24)) + 1
          : leave.approvedDates ? leave.approvedDates.length : 0);
      }, 0);

      unpaidSummary = {
        unpaidLeaves,
        totalUnpaidTaken
      };
    }

    res.json({
      message: 'Employee leave counts fetched successfully',
      employeeId,
      employee: {
        teamMemberName: employee.teamMemberName,
        company: employee.company ? employee.company.name : null
      },
      leaveCounts,
      totals: {
        totalAllocated,
        totalTaken,
        totalRemaining
      },
      unpaidSummary
    });
  } catch (error) {
    console.error('Get employee leave counts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

