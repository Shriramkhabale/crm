const ProjectMgnt = require('../models/ProjectMgnt');
const Employee = require('../models/Employee');

// Helper to get company ID from user (unchanged)
async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// Create a new project
exports.createProject = async (req, res) => {
  console.log("req.user", req.user);

  try {
    const company = await getCompanyIdFromUser (req.user);

    const {
      title,
      description,
      department,
      status,
      startDate,
      dueDate,
      budget,
      teamMembers,
      progress,
      clientName,
      clientCompany,
      clientEmail,
      clientMobileNo,
      clientAddress,  // NEW
      clientCity,     // NEW
      clientState,    // NEW
      projectHead,    // NEW
      customFields    // NEW: Array of {key, value}
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // NEW: Validate projectHead is in teamMembers (if provided)
    if (projectHead && teamMembers && Array.isArray(teamMembers)) {
      if (!teamMembers.includes(projectHead)) {
        return res.status(400).json({ message: 'Project head must be one of the team members' });
      }
    }

    // NEW: Handle customFields (parse if stringified JSON)
    let parsedCustomFields = [];
    if (customFields) {
      if (typeof customFields === 'string') {
        try {
          parsedCustomFields = JSON.parse(customFields);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid customFields format. Use JSON array: [{"key": "Priority", "value": "High"}]' });
        }
      } else if (Array.isArray(customFields)) {
        parsedCustomFields = customFields;
      } else {
        return res.status(400).json({ message: 'customFields must be a JSON array' });
      }
      // Validate: Non-empty keys, no duplicates
      if (parsedCustomFields.length > 0) {
        const validFields = parsedCustomFields.filter(field => field.key && field.value && field.key.trim() !== '');
        if (validFields.length !== parsedCustomFields.length) {
          return res.status(400).json({ message: 'All customFields must have non-empty key and value' });
        }
        const uniqueKeys = [...new Set(validFields.map(f => f.key.toLowerCase()))];
        if (uniqueKeys.length !== validFields.length) {
          return res.status(400).json({ message: 'Duplicate custom field keys not allowed' });
        }
        parsedCustomFields = validFields.map(field => ({
          key: field.key.trim(),
          value: field.value
        }));
      }
    }

    const project = new ProjectMgnt({
      company,
      department,
      title,
      description,
      status,
      startDate,
      dueDate,
      budget,
      teamMembers,
      progress,
      clientName,
      clientCompany,
      clientEmail,
      clientMobileNo,
      clientAddress,  // NEW
      clientCity,     // NEW
      clientState,    // NEW
      projectHead,    // NEW
      customFields: parsedCustomFields  // NEW
    });

    await project.save();

    res.status(201).json({ message: 'ProjectMgnt created successfully', project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all projects for the company
exports.getAllProjects = async (req, res) => {
  console.log("req.user", req.user);
  
  try {
    const company = await getCompanyIdFromUser (req.user);

    const projects = await ProjectMgnt.find({ company })
      .populate('teamMembers', 'teamMemberName email')  // Fixed: Use 'teamMemberName' (from Employee model)
      .populate('projectHead', 'teamMemberName email')  // NEW: Populate project head
      .populate('department', 'name')  // Assuming Department has 'name' field
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get project by ID (only if belongs to company)
exports.getProjectById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const project = await ProjectMgnt.findOne({ _id: id, company })
      .populate('teamMembers', 'teamMemberName email')
      .populate('projectHead', 'teamMemberName email')  // NEW
      .populate('department', 'name');

    if (!project) {
      return res.status(404).json({ message: 'ProjectMgnt not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update project by ID (only if belongs to company)
exports.updateProject = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const project = await ProjectMgnt.findOne({ _id: id, company });
    if (!project) {
      return res.status(404).json({ message: 'ProjectMgnt not found' });
    }

    const {
      title,
      description,
      department,
      status,
      startDate,
      dueDate,
      budget,
      teamMembers,
      progress,
      clientName,
      clientCompany,
      clientEmail,
      clientMobileNo,
      clientAddress,  
      clientCity,     
      clientState,   
      projectHead,   
      customFields: updateCustomFields,  
      newCustomFields, 
      removeCustomFields 
    } = req.body;

    // Standard field updates (unchanged + new)
    if (title !== undefined) project.title = title;
    if (description !== undefined) project.description = description;
    if (department !== undefined) project.department = department;
    if (status !== undefined) project.status = status;
    if (startDate !== undefined) project.startDate = startDate;
    if (dueDate !== undefined) project.dueDate = dueDate;
    if (budget !== undefined) project.budget = budget;
    if (teamMembers !== undefined) project.teamMembers = teamMembers;
    if (progress !== undefined) project.progress = progress;
    if (clientName !== undefined) project.clientName = clientName;
    if (clientCompany !== undefined) project.clientCompany = clientCompany;
    if (clientEmail !== undefined) project.clientEmail = clientEmail;
    if (clientMobileNo !== undefined) project.clientMobileNo = clientMobileNo;
    if (clientAddress !== undefined) project.clientAddress = clientAddress; 
    if (clientCity !== undefined) project.clientCity = clientCity;          
    if (clientState !== undefined) project.clientState = clientState;        

    if (projectHead !== undefined) {
      if (projectHead && teamMembers && Array.isArray(teamMembers) && !teamMembers.includes(projectHead)) {
        return res.status(400).json({ message: 'Project head must be one of the team members' });
      }
      project.projectHead = projectHead;
    }

    if (removeCustomFields && Array.isArray(removeCustomFields) && removeCustomFields.length > 0) {
      const keysToRemove = removeCustomFields.filter(key => key && key.trim() !== '');
      for (const keyToRemove of keysToRemove) {
        const fieldIndex = project.customFields.findIndex(field => field.key.toLowerCase() === keyToRemove.toLowerCase());
        if (fieldIndex !== -1) {
          project.customFields.splice(fieldIndex, 1);
          console.log(`Removed custom field: ${keyToRemove}`);
        } else {
          console.warn(`Custom field key not found for removal: ${keyToRemove}`);
        }
      }
    }

    if (newCustomFields && Array.isArray(newCustomFields) && newCustomFields.length > 0) {
      // Parse if stringified
      let parsedNewFields = newCustomFields;
      if (typeof newCustomFields === 'string') {
        try {
          parsedNewFields = JSON.parse(newCustomFields);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid newCustomFields format' });
        }
      }
      // Validate new fields
      const validNewFields = parsedNewFields.filter(field => field.key && field.value && field.key.trim() !== '');
      if (validNewFields.length !== parsedNewFields.length) {
        return res.status(400).json({ message: 'All newCustomFields must have non-empty key and value' });
      }
      // Check duplicates with existing
      const existingKeys = project.customFields.map(field => field.key.toLowerCase());
      const newKeysLower = validNewFields.map(f => f.key.toLowerCase());
      const duplicates = newKeysLower.filter(k => existingKeys.includes(k));
      if (duplicates.length > 0) {
        return res.status(400).json({ message: `Duplicate custom field keys not allowed: ${duplicates.join(', ')}` });
      }
      // Add new
      const newFields = validNewFields.map(field => ({
        key: field.key.trim(),
        value: field.value
      }));
      project.customFields.push(...newFields);
      console.log('Added new custom fields:', newFields.map(f => f.key));
    }

    // Optional: Full replace customFields (if updateCustomFields provided)
    if (updateCustomFields !== undefined) {
      // Similar parsing/validation as in create
      let parsedUpdateFields = [];
      if (typeof updateCustomFields === 'string') {
        try {
          parsedUpdateFields = JSON.parse(updateCustomFields);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid updateCustomFields format' });
        }
      } else if (Array.isArray(updateCustomFields)) {
        parsedUpdateFields = updateCustomFields;
      }
      // Validate and set
      const validUpdateFields = parsedUpdateFields.filter(field => field.key && field.value && field.key.trim() !== '');
      if (validUpdateFields.length !== parsedUpdateFields.length) {
        return res.status(400).json({ message: 'All updateCustomFields must have non-empty key and value' });
      }
      const uniqueKeys = [...new Set(validUpdateFields.map(f => f.key.toLowerCase()))];
      if (uniqueKeys.length !== validUpdateFields.length) {
        return res.status(400).json({ message: 'Duplicate keys in updateCustomFields not allowed' });
      }
      project.customFields = validUpdateFields.map(field => ({
        key: field.key.trim(),
        value: field.value
      }));
      console.log('Replaced custom fields');
    }

    await project.save();

    res.json({ message: 'ProjectMgnt updated successfully', project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete project by ID (only if belongs to company) - unchanged
exports.deleteProject = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const project = await ProjectMgnt.findOneAndDelete({ _id: id, company });
    if (!project) {
      return res.status(404).json({ message: 'ProjectMgnt not found' });
    }

    res.json({ message: 'ProjectMgnt deleted successfully' });
  } catch (error) {    
    res.status(500).json({ message: error.message });
  }
};
