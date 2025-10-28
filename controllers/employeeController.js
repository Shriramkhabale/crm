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
 
    const {
      company,
      teamMemberName,
      mobileNumber,
      isActive = true,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining,
      shift,
      departments,  // Expect array from frontend
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
      documentTypes,  // Expect array (or string for single) from frontend for CREATE
      pfEnabled = false,  // From frontend
      esicEnabled = false,
    } = req.body;

    // FIXED: Robust departments parsing (prevents 400, handles single/multiple/JSON)
    let parsedDepartments = [];
    if (req.body.departmentsJSON) {  // Frontend JSON fallback
      try {
        parsedDepartments = JSON.parse(req.body.departmentsJSON);
      } catch (e) {
        console.warn('⚠️ Failed to parse departmentsJSON:', e.message);
      }
    } else if (Array.isArray(departments)) {
      parsedDepartments = departments;
    } else if (typeof departments === 'string') {
      // Handle repeated appends as comma-separated or single
      if (departments.includes(',')) {
        parsedDepartments = departments.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        parsedDepartments = [departments].filter(Boolean);
      }
    }
    // Also check for repeated 'department' fields (legacy)
    if (parsedDepartments.length === 0 && req.body.department) {
      if (Array.isArray(req.body.department)) {
        parsedDepartments = req.body.department.filter(Boolean);
      } else {
        parsedDepartments = [req.body.department].filter(Boolean);
      }
    }
    const validDepartments = [...new Set(parsedDepartments.filter(id => id && id.trim() !== ''))];
    console.log('📋 CREATE: Parsed departments:', validDepartments.length, 'IDs:', validDepartments);
    if (validDepartments.length === 0) {
      return res.status(400).json({ message: 'At least one department is required' });
    }

    // FIXED: Robust designation parsing (similar to departments)
    let parsedDesignation = [];
    if (req.body.designationJSON) {
      try {
        parsedDesignation = JSON.parse(req.body.designationJSON);
      } catch (e) {
        console.warn('⚠️ Failed to parse designationJSON:', e.message);
      }
    } else if (Array.isArray(designation)) {
      parsedDesignation = designation;
    } else if (typeof designation === 'string') {
      if (designation.includes(',')) {
        parsedDesignation = designation.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        parsedDesignation = [designation].filter(Boolean);
      }
    }
    const validDesignation = [...new Set(parsedDesignation.filter(id => id && id.trim() !== ''))];
    console.log('📋 CREATE: Parsed designation:', validDesignation.length, 'IDs:', validDesignation);
    if (validDesignation.length === 0) {
      return res.status(400).json({ message: 'At least one designation is required' });
    }

    // Email duplicate check
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Employee email already exists' });

    // Fixed images (unchanged)
    const adharImage = req.files?.adharImage ? req.files.adharImage[0].path : null;
    const panImage = req.files?.panImage ? req.files.panImage[0].path : null;
    const profileImage = req.files?.profileImage ? req.files.profileImage[0].path : null;

    console.log('🖼️ Fixed images processed:', {
      adharImage: adharImage ? 'present' : 'none',
      panImage: panImage ? 'present' : 'none',
      profileImage: profileImage ? 'present' : 'none'
    });

    // FIXED: Robust dynamic documents parsing (handles string/single vs array/multiple)
    let dynamicDocuments = [];
    let parsedDocumentTypes = [];
    if (documentTypes) {
      if (Array.isArray(documentTypes)) {
        parsedDocumentTypes = documentTypes;
      } else if (typeof documentTypes === 'string') {
        // Coerce single string to array (critical fix for single doc)
        parsedDocumentTypes = [documentTypes.trim()].filter(Boolean);
        console.log('📎 CREATE: Coerced single string documentTypes to array:', parsedDocumentTypes);
      } else {
        console.warn('⚠️ Invalid documentTypes format:', typeof documentTypes);
        parsedDocumentTypes = [];
      }
      console.log('📎 CREATE: Raw documentTypes:', typeof documentTypes, JSON.stringify(documentTypes));
      console.log('📎 CREATE: Parsed documentTypes:', parsedDocumentTypes.length, 'items:', parsedDocumentTypes);
    }

    const types = parsedDocumentTypes.filter(type => type && type.trim() !== '');
    console.log('📎 CREATE: Filtered types:', types.length, types);

    if (types.length > 0) {
      if (req.files?.documents && Array.isArray(req.files.documents) && req.files.documents.length > 0) {
        const files = req.files.documents;
        console.log('📎 CREATE: Files received:', files.length, 'details:', files.map((f, i) => ({
          index: i,
          name: f.originalname,
          path: f.path ? f.path.substring(0, 50) + '...' : 'no path',
          public_id: f.public_id || f.filename
        })));

        if (files.length !== types.length) {
          console.warn('⚠️ MISMATCH: Types:', types.length, 'vs Files:', files.length);
          return res.status(400).json({ 
            message: `Dynamic docs mismatch: ${types.length} types but ${files.length} files` 
          });
        }

        // Check duplicates (case-insensitive)
        const uniqueTypes = [...new Set(types.map(t => t.toLowerCase()))];
        if (uniqueTypes.length !== types.length) {
          return res.status(400).json({ message: 'Duplicate dynamic document types not allowed' });
        }

        // Create array - match by index
        dynamicDocuments = files.map((file, index) => ({
          type: types[index]?.trim() || 'Unknown',
          url: file.path,
          publicId: file.public_id || file.filename,
          uploadedAt: new Date()
        }));
        console.log('✅ CREATE: Created dynamic documents:', dynamicDocuments.length, 'items');
        dynamicDocuments.forEach(doc => {
          console.log(`│   ├── Type: "${doc.type}", URL: ${doc.url?.substring(0, 50)}..., PublicID: ${doc.publicId}`);
        });
      } else {
        console.warn('⚠️ CREATE: No documents files received (but types present):', req.files?.documents);
        return res.status(400).json({ message: 'Files required for dynamic document types' });
      }
    } else {
      console.log('ℹ️ CREATE: Skipping dynamic docs (no valid types)');
    }

    // Coerce other arrays (unchanged)
    const parsedPaidLeaves = Array.isArray(paidLeaves) ? paidLeaves : [];
    const parsedWeeklyHoliday = Array.isArray(weeklyHoliday) ? weeklyHoliday : [];
    const parsedAccessPermissions = Array.isArray(accessPermissions) ? accessPermissions : [];

    const employee = new Employee({
      company,
      teamMemberName,
      mobileNumber,
      isActive,
      emergencyMobileNumber,
      email,
      password,
      salary,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : undefined,
      shift,
      department: validDepartments, 
      role,
      designation: validDesignation,
      aadharNumber,
      panNumber,
      userUpi,
      pfPercentage: pfEnabled === 'true' || pfEnabled === true ? pfPercentage : undefined,
      esicPercentage: esicEnabled === 'true' || esicEnabled === true ? esicPercentage : undefined,
      paidLeaves: parsedPaidLeaves,
      weeklyHoliday: parsedWeeklyHoliday,
      address,
      accessPermissions: parsedAccessPermissions,
      adharImage,
      panImage,
      profileImage,
      documents: dynamicDocuments,
      qrCode
    });

    console.log('💾 CREATE: Saving employee with docs count:', dynamicDocuments.length);
    await employee.save();
    console.log('✅ CREATE: Employee saved! Final docs in DB:', employee.documents.length);

    // Remove password from response
    employee.password = undefined;
    res.status(201).json({ message: 'Employee created', employee });
  } catch (error) {
    console.error('❌ CREATE ERROR:', error.message);
    console.error('❌ Full error:', error);
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
      departments,  // Expect array/string/JSON from frontend
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
      newDocumentTypes,  // Expect array (or string for single) from frontend for new docs
      removeDocuments,  // Expect array (or string for single) of types to remove
      pfEnabled = false,  // From frontend
      esicEnabled = false,
      adharImage: adharImageNull,  // Explicit null to delete fixed image
      panImage: panImageNull,
      profileImage: profileImageNull
    } = req.body;

    // FIXED: Robust departments parsing (handles array/string/JSON/single/multiple)
    let parsedDepartments = [];
    if (req.body.departmentsJSON) {  // Frontend JSON fallback
      try {
        parsedDepartments = JSON.parse(req.body.departmentsJSON);
      } catch (e) {
        console.warn('⚠️ UPDATE: Failed to parse departmentsJSON:', e.message);
      }
    } else if (Array.isArray(departments)) {
      parsedDepartments = departments;
    } else if (typeof departments === 'string') {
      // Handle repeated appends as comma-separated or single
      if (departments.includes(',')) {
        parsedDepartments = departments.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        parsedDepartments = [departments].filter(Boolean);
      }
    }
    // Also check for repeated 'department' fields (legacy)
    if (parsedDepartments.length === 0 && req.body.department) {
      if (Array.isArray(req.body.department)) {
        parsedDepartments = req.body.department.filter(Boolean);
      } else {
        parsedDepartments = [req.body.department].filter(Boolean);
      }
    }
    const validDepartments = [...new Set(parsedDepartments.filter(id => id && id.trim() !== ''))];
    console.log('📋 UPDATE: Parsed departments:', validDepartments.length, 'IDs:', validDepartments);
    if (validDepartments.length === 0) {
      return res.status(400).json({ message: 'At least one department is required' });
    }
    employee.department = validDepartments;  // Assign to model field 'department' (array)

    // FIXED: Robust designation parsing (similar to departments)
    let parsedDesignation = [];
    if (req.body.designationJSON) {
      try {
        parsedDesignation = JSON.parse(req.body.designationJSON);
      } catch (e) {
        console.warn('⚠️ UPDATE: Failed to parse designationJSON:', e.message);
      }
    } else if (Array.isArray(designation)) {
      parsedDesignation = designation;
    } else if (typeof designation === 'string') {
      if (designation.includes(',')) {
        parsedDesignation = designation.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        parsedDesignation = [designation].filter(Boolean);
      }
    }
    const validDesignation = [...new Set(parsedDesignation.filter(id => id && id.trim() !== ''))];
    console.log('📋 UPDATE: Parsed designation:', validDesignation.length, 'IDs:', validDesignation);
    if (validDesignation.length === 0) {
      return res.status(400).json({ message: 'At least one designation is required' });
    }
    employee.designation = validDesignation;

    // Standard field updates
    if (teamMemberName !== undefined) employee.teamMemberName = teamMemberName;
    if (mobileNumber !== undefined) employee.mobileNumber = mobileNumber;
    if (isActive !== undefined) employee.isActive = isActive;
    if (emergencyMobileNumber !== undefined) employee.emergencyMobileNumber = emergencyMobileNumber;
    if (email !== undefined) employee.email = email;
    if (salary !== undefined) employee.salary = salary;  // FIXED: Proper undefined check
    if (dateOfJoining !== undefined) employee.dateOfJoining = dateOfJoining ? new Date(dateOfJoining) : undefined;
    if (shift !== undefined) employee.shift = shift;
    if (role !== undefined) employee.role = role;
    if (aadharNumber !== undefined) employee.aadharNumber = aadharNumber;
    if (panNumber !== undefined) employee.panNumber = panNumber;
    if (userUpi !== undefined) employee.userUpi = userUpi;
    if (address !== undefined) employee.address = address;
    if (qrCode !== undefined) employee.qrCode = qrCode;

    // PF/ESIC: Only set percentages if enabled
    // if (pfEnabled === 'true' || pfEnabled === true) {
    //   employee.pfEnabled = true;
    //   if (pfPercentage !== undefined) employee.pfPercentage = pfPercentage;
    // } else {
    //   employee.pfEnabled = false;
    //   employee.pfPercentage = undefined;
    // }
    // if (esicEnabled === 'true' || esicEnabled === true) {
    //   employee.esicEnabled = true;
    //   if (esicPercentage !== undefined) employee.esicPercentage = esicPercentage;
    // } else {
    //   employee.esicEnabled = false;
    //   employee.esicPercentage = undefined;
    // }


    // Replace the PF/ESIC block with this:
if (pfEnabled !== undefined) {
  const isEnabled = pfEnabled === 'true' || pfEnabled === true;
  employee.pfEnabled = isEnabled;
  if (pfPercentage !== undefined) {
    employee.pfPercentage = pfPercentage;
  } else if (!isEnabled) {
    employee.pfPercentage = undefined;  // Only remove if disabled and no percentage sent
  }
}
if (esicEnabled !== undefined) {
  const isEnabled = esicEnabled === 'true' || esicEnabled === true;
  employee.esicEnabled = isEnabled;
  if (esicPercentage !== undefined) {
    employee.esicPercentage = esicPercentage;
  } else if (!isEnabled) {
    employee.esicPercentage = undefined;  // Only remove if disabled and no percentage sent
  }
}


    // Arrays: Coerce if needed
    if (paidLeaves !== undefined) {
      employee.paidLeaves = Array.isArray(paidLeaves) ? paidLeaves : [];
    }
    if (weeklyHoliday !== undefined) {
      employee.weeklyHoliday = JSON.parse(weeklyHoliday || '[]');
    }
    if (accessPermissions !== undefined) {
      employee.accessPermissions = Array.isArray(accessPermissions) ? accessPermissions : [];
    }

    // FIXED: Update fixed images if uploaded
    if (req.files?.adharImage && req.files.adharImage.length > 0) {
      // Delete old if exists
      if (employee.adharImage) {
        const oldPublicId = extractPublicIdFromUrl(employee.adharImage);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId);
      }
      employee.adharImage = req.files.adharImage[0].path;
      console.log('🖼️ UPDATE: Updated adharImage');
    }
    if (req.files?.panImage && req.files.panImage.length > 0) {
      if (employee.panImage) {
        const oldPublicId = extractPublicIdFromUrl(employee.panImage);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId);
      }
      employee.panImage = req.files.panImage[0].path;
      console.log('🖼️ UPDATE: Updated panImage');
    }
    if (req.files?.profileImage && req.files.profileImage.length > 0) {
      if (employee.profileImage) {
        const oldPublicId = extractPublicIdFromUrl(employee.profileImage);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId);
      }
      employee.profileImage = req.files.profileImage[0].path;
      console.log('🖼️ UPDATE: Updated profileImage');
    }

    // NEW: Handle explicit deletion of fixed images (if body sends null)
    if (adharImageNull === null && employee.adharImage) {
      const publicId = extractPublicIdFromUrl(employee.adharImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.adharImage = null;
      console.log('🗑️ UPDATE: Deleted adharImage from Cloudinary');
    }
    if (panImageNull === null && employee.panImage) {
      const publicId = extractPublicIdFromUrl(employee.panImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.panImage = null;
      console.log('🗑️ UPDATE: Deleted panImage from Cloudinary');
    }
    if (profileImageNull === null && employee.profileImage) {
      const publicId = extractPublicIdFromUrl(employee.profileImage);
      if (publicId) await deleteFromCloudinary(publicId);
      employee.profileImage = null;
      console.log('🗑️ UPDATE: Deleted profileImage from Cloudinary');
    }

    // NEW: Handle dynamic document removal (with coercion for single/string)
    let parsedRemoveDocuments = [];
    if (removeDocuments) {
      if (Array.isArray(removeDocuments)) {
        parsedRemoveDocuments = removeDocuments;
      } else if (typeof removeDocuments === 'string') {
        // Coerce single string to array (fix for single removal)
        parsedRemoveDocuments = [removeDocuments.trim()].filter(Boolean);
        console.log('📎 UPDATE: Coerced single string removeDocuments to array:', parsedRemoveDocuments);
      } else {
        console.warn('⚠️ UPDATE: Invalid removeDocuments format:', typeof removeDocuments);
      }
      console.log('📎 UPDATE: Raw removeDocuments:', typeof removeDocuments, JSON.stringify(removeDocuments));
      console.log('📎 UPDATE: Parsed removeDocuments:', parsedRemoveDocuments.length, 'items:', parsedRemoveDocuments);
    }

    const typesToRemove = parsedRemoveDocuments.filter(type => type && type.trim() !== '');
    if (typesToRemove.length > 0) {
      console.log('🗑️ UPDATE: Removing docs:', typesToRemove);
      for (const typeToRemove of typesToRemove) {
        const docIndex = employee.documents.findIndex(doc => doc.type.toLowerCase() === typeToRemove.toLowerCase());
        if (docIndex !== -1) {
          const doc = employee.documents[docIndex];
          if (doc.publicId) {
            await deleteFromCloudinary(doc.publicId);  // Delete from Cloudinary
          }
          employee.documents.splice(docIndex, 1);  // Remove from array
          console.log(`🗑️ UPDATE: Removed dynamic doc: "${doc.type}"`);
        } else {
          console.warn(`⚠️ UPDATE: Doc type not found for removal: "${typeToRemove}"`);
        }
      }
      console.log('🗑️ UPDATE: After removal, remaining docs:', employee.documents.length);
    } else {
      console.log('ℹ️ UPDATE: Skipping removal (no valid removeDocuments)');
    }

    // NEW: Handle adding new dynamic documents (with coercion for single/string)
    let parsedNewDocumentTypes = [];
    if (newDocumentTypes) {
      if (Array.isArray(newDocumentTypes)) {
        parsedNewDocumentTypes = newDocumentTypes;
      } else if (typeof newDocumentTypes === 'string') {
        // Coerce single string to array (critical fix for single new doc)
        parsedNewDocumentTypes = [newDocumentTypes.trim()].filter(Boolean);
        console.log('📎 UPDATE: Coerced single string newDocumentTypes to array:', parsedNewDocumentTypes);
      } else {
        console.warn('⚠️ UPDATE: Invalid newDocumentTypes format:', typeof newDocumentTypes);
      }
      console.log('📎 UPDATE: Raw newDocumentTypes:', typeof newDocumentTypes, JSON.stringify(newDocumentTypes));
      console.log('📎 UPDATE: Parsed newDocumentTypes:', parsedNewDocumentTypes.length, 'items:', parsedNewDocumentTypes);
    }

    const types = parsedNewDocumentTypes.filter(type => type && type.trim() !== '');
    console.log('📎 UPDATE: Filtered new types:', types.length, types);

    if (types.length > 0) {
      if (req.files?.documents && Array.isArray(req.files.documents) && req.files.documents.length > 0) {
        const files = req.files.documents;
        console.log('📎 UPDATE: New files received:', files.length, 'details:', files.map((f, i) => ({
          index: i,
          name: f.originalname,
          path: f.path ? f.path.substring(0, 50) + '...' : 'no path',
          public_id: f.public_id || f.filename
        })));

        if (files.length !== types.length) {
          console.warn('⚠️ UPDATE: MISMATCH: New types:', types.length, 'vs New files:', files.length);
          return res.status(400).json({ 
            message: `Dynamic docs mismatch: ${types.length} new types but ${files.length} new files` 
          });
        }

        // Check for duplicates with existing docs
        const existingTypes = employee.documents.map(doc => doc.type.toLowerCase());
        const newTypesLower = types.map(t => t.toLowerCase());
        const duplicates = newTypesLower.filter(t => existingTypes.includes(t));
        if (duplicates.length > 0) {
          return res.status(400).json({ message: `Duplicate dynamic types not allowed: ${duplicates.join(', ')}` });
        }

        // Add new documents
        const newDocs = files.map((file, index) => ({
          type: types[index]?.trim() || 'Unknown',
          url: file.path,
          publicId: file.public_id || file.filename,
          uploadedAt: new Date()
        }));
        employee.documents.push(...newDocs);
        console.log('✅ UPDATE: Added new dynamic documents:', newDocs.length, 'items');
        newDocs.forEach(doc => {
          console.log(`│   ├── Type: "${doc.type}", URL: ${doc.url?.substring(0, 50)}..., PublicID: ${doc.publicId}`);
        });
      } else {
        console.warn('⚠️ UPDATE: No new documents files received (but types present):', req.files?.documents);
        return res.status(400).json({ message: 'Files required for new dynamic document types' });
      }
    } else {
      console.log('ℹ️ UPDATE: Skipping new dynamic docs (no valid newDocumentTypes)');
    }

    // Password hashing (only if provided)
    if (password) {
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password, salt);
      console.log('🔐 UPDATE: Password hashed');
    }

    console.log('💾 UPDATE: Saving employee with final docs count:', employee.documents.length);
    await employee.save();
    console.log('✅ UPDATE: Employee saved! Final docs in DB:', employee.documents.length);

    // Remove password from response
    employee.password = undefined;
    res.json({ message: 'Employee updated', employee });
  } catch (error) {
    console.error('❌ UPDATE ERROR:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

