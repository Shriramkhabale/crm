const Workflow = require('../models/WorkFlow');

const Employee = require('../models/Employee');

async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else{
    // Find employee by userId and get companyId
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  } 
}


// Create a new workflow
exports.createWorkflow = async (req, res) => {
  try {
    const { name, company, openStages, closeStages } = req.body;
    if (!name || !company) {
      return res.status(400).json({ message: 'Name and company are required' });
    }
    const workflow = new Workflow({
      name,
      company,
      openStages,
      closeStages,
    });
    await workflow.save();
    res.status(201).json({ message: 'Workflow created successfully', workflow });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Workflow name must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Get all workflows for the company
exports.getWorkflows = async (req, res) => {
  try {
    // const companyId = req.user.companyId;
     const companyId = await getCompanyIdFromUser (req.user);
console.log("companyId",companyId);

    console.log("req.user", req.user);

    // Since company is at workflow level, query by company field
    const workflows = await Workflow.find({ company: companyId });

    res.json(workflows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get workflow by ID
exports.getWorkflowById = async (req, res) => {
  try {
    const { id } = req.params;
     const companyId = await getCompanyIdFromUser (req.user);

    // const companyId = req.user.companyId;

    // Find workflow by _id and company
    const workflow = await Workflow.findOne({ _id: id, company: companyId });

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update workflow by ID
exports.updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, openStages, closeStages } = req.body;
    // const companyId = req.user.companyId;
     const companyId = await getCompanyIdFromUser (req.user);

    // Find workflow by id and company to ensure ownership
    const workflow = await Workflow.findOne({ _id: id, company: companyId });

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Update fields if provided
    if (name) workflow.name = name;
    if (openStages) workflow.openStages = openStages;
    if (closeStages) workflow.closeStages = closeStages;

    await workflow.save();

    res.json({ message: 'Workflow updated successfully', workflow });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Workflow name must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete workflow by ID
exports.deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    // const companyId = req.user.companyId;
     const companyId = await getCompanyIdFromUser (req.user);

    // Delete only if workflow belongs to the company
    const workflow = await Workflow.findOneAndDelete({ _id: id, company: companyId });

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
