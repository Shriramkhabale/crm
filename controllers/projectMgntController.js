const ProjectMgnt = require('../models/ProjectMgnt');
const Employee = require('../models/Employee');

// Helper to get company ID from user (similar to your previous function)
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
    console.log("req.user",req.user);

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
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
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
    });

    await project.save();

    res.status(201).json({ message: 'ProjectMgnt created successfully', project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all projects for the company
exports.getAllProjects = async (req, res) => {
  console.log("req.user",req.user);
  
  try {
    const company = await getCompanyIdFromUser (req.user);

    const projects = await ProjectMgnt.find({ company })
      .populate('teamMembers', 'name email') // populate team member names and emails
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
      .populate('teamMembers', 'name email');

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
    } = req.body;

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

    await project.save();

    res.json({ message: 'ProjectMgnt updated successfully', project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete project by ID (only if belongs to company)
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