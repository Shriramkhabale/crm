const Milestone = require('../models/Milestone');
const ProjectMgnt = require('../models/ProjectMgnt');  // NEW: To validate against project
const Employee = require('../models/Employee');  // NEW: For company fetching

// Helper to get company ID from user (from your Project controller)
async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId; // userId is companyId
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// Create a milestone
exports.createMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);  // NEW: Auto-set company from user

    const { title, project, description, dueDate, status, assignedTeamMember, nextFollowUp } = req.body;

    if (!title || !project || !dueDate) {
      return res.status(400).json({ message: 'Title, project, and dueDate are required' });
    }

    // NEW: Validate project exists and belongs to company
    const proj = await ProjectMgnt.findOne({ _id: project, company });
    if (!proj) {
      return res.status(400).json({ message: 'Invalid project: Must exist and belong to your company' });
    }

    // NEW: Validate assignedTeamMember is in project's teamMembers (if provided)
    if (assignedTeamMember) {
      if (!proj.teamMembers.includes(assignedTeamMember)) {
        return res.status(400).json({ message: 'Assigned team member must be one of the project\'s team members' });
      }
    }

    const milestone = new Milestone({
      title,
      project,
      description,
      dueDate: new Date(dueDate),  // Ensure Date object
      status,
      assignedTeamMember,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,  // NEW: Parse date-time
      company
    });

    await milestone.save();

    // NEW: Populate for response
    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('project', 'title status')  // Project details
      .populate('assignedTeamMember', 'teamMemberName email');  // Team member details

    res.status(201).json({ message: 'Milestone created', milestone: populatedMilestone });
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all milestones (filtered by company)
exports.getMilestones = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);  // NEW: Auto-filter by company
    const { project, status, assignedTeamMember } = req.query;  // NEW: Optional filters
    const filter = { company };

    if (project) filter.project = project;
    if (status) filter.status = status;
    if (assignedTeamMember) filter.assignedTeamMember = assignedTeamMember;

    const milestones = await Milestone.find(filter)
      .populate('project', 'title status')  // NEW: Populate project
      .populate('assignedTeamMember', 'teamMemberName email')  // NEW: Populate team member
      .sort({ dueDate: 1 });  // Ascending due date

    res.json({ milestones });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get milestone by ID (scoped to company)
exports.getMilestoneById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const milestone = await Milestone.findOne({ _id: id, company })
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email');

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ milestone });
  } catch (error) {
    console.error('Get milestone by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update milestone (scoped to company)
exports.updateMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;
    const updates = req.body;

    const milestone = await Milestone.findOne({ _id: id, company });
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    // NEW: Handle specific updates with validation
    if (updates.project) {
      // Re-validate project if changed
      const proj = await ProjectMgnt.findOne({ _id: updates.project, company });
      if (!proj) {
        return res.status(400).json({ message: 'Invalid project: Must exist and belong to your company' });
      }
      milestone.project = updates.project;
    }

    if (updates.description !== undefined) milestone.description = updates.description;
    if (updates.dueDate !== undefined) milestone.dueDate = new Date(updates.dueDate);
    if (updates.status !== undefined) milestone.status = updates.status;

    // NEW: Handle assignedTeamMember update
    if (updates.assignedTeamMember !== undefined) {
      if (updates.assignedTeamMember) {
        // Fetch current project (or updated one)
        const currentProject = updates.project || milestone.project;
        const proj = await ProjectMgnt.findById(currentProject).select('teamMembers');
        if (!proj || !proj.teamMembers.includes(updates.assignedTeamMember)) {
          return res.status(400).json({ message: 'Assigned team member must be one of the project\'s team members' });
        }
      }
      milestone.assignedTeamMember = updates.assignedTeamMember;
    }

    // NEW: Handle nextFollowUp update
    if (updates.nextFollowUp !== undefined) {
      milestone.nextFollowUp = updates.nextFollowUp ? new Date(updates.nextFollowUp) : null;
    }

    await milestone.save();

    // NEW: Populate for response
    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email');

    res.json({ message: 'Milestone updated', milestone: populatedMilestone });
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete milestone (scoped to company)
exports.deleteMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser (req.user);
    const { id } = req.params;

    const milestone = await Milestone.findOneAndDelete({ _id: id, company });

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
