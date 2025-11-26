// controllers/milestoneController.js - CLEAN VERSION (NO DUPLICATES)

const Milestone = require('../models/Milestone');
const ProjectMgnt = require('../models/ProjectMgnt');
const Employee = require('../models/Employee');

// Helper to get company ID from user
async function getCompanyIdFromUser(user) {
  if (user.role === 'company') {
    return user.userId;
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

// ✅ CREATE MILESTONE
exports.createMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { title, project, description, dueDate, status, assignedTeamMember, nextFollowUp } = req.body;

    console.log('📝 CREATE Milestone Request:', { title, project, description, status });

    if (!title || !project || !dueDate) {
      return res.status(400).json({ message: 'Title, project, and dueDate are required' });
    }

    const proj = await ProjectMgnt.findOne({ _id: project, company });
    if (!proj) {
      return res.status(400).json({ message: 'Invalid project: Must exist and belong to your company' });
    }

    if (assignedTeamMember && assignedTeamMember.length > 0) {
      const invalidMembers = assignedTeamMember.filter(m => !proj.teamMembers.includes(m));
      if (invalidMembers.length > 0) {
        return res.status(400).json({ message: 'All assigned members must be part of the project team' });
      }
    }

    // Handle initial description
    let descriptionArray = [];
    if (description) {
      if (Array.isArray(description)) {
        descriptionArray = description.filter(d => d && d.trim());
      } else if (typeof description === 'string' && description.trim()) {
        descriptionArray = description.split('\n').filter(line => line.trim() !== '');
      }
    }

    console.log('📝 Initial description array:', descriptionArray);

    // ✅ HANDLE FILE UPLOADS (same as task controller)
    const images = req.files?.images ? req.files.images.map(f => f.path || f.secure_url) : [];
    const audios = req.files?.audios ? req.files.audios.map(f => f.path || f.secure_url) : [];
    const files = req.files?.files ? req.files.files.map(f => f.path || f.secure_url) : [];

    console.log('📎 Processed files:', { images, audios, files });

    // ✅ Create initial status history entry
    const initialStatus = status || 'Pending';
    const statusHistory = [{
      status: initialStatus,
      description: descriptionArray,
      updatedAt: new Date(),
      updatedBy: req.user.userId,
      images,
      audios,
      files
    }];

    const milestone = new Milestone({
      title,
      project,
      description: descriptionArray,
      dueDate: new Date(dueDate),
      status: initialStatus,
      statusHistory,
      assignedTeamMember,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
      company,
      // ✅ ADD FILE FIELDS
      images,
      audios,
      files
    });

    await milestone.save();

    console.log('✅ Milestone created:', {
      id: milestone._id,
      descriptionCount: milestone.description?.length,
      historyCount: milestone.statusHistory?.length
    });

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email')
      .populate('statusHistory.updatedBy', 'teamMemberName email');

    res.status(201).json({ message: 'Milestone created', milestone: populatedMilestone });
  } catch (error) {
    console.error('❌ Create milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/milestoneController.js - ADD THIS NEW FUNCTION

// ✅ UPLOAD ATTACHMENTS TO EXISTING MILESTONE
exports.uploadAttachments = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;

    console.log('📎 UPLOAD Attachments Request:', { id, filesCount: req.files?.length });

    const milestone = await Milestone.findOne({ _id: id, company });
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    // ✅ Handle file uploads from req.files (multer)
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('📎 Processing uploaded files:', req.files.length);

      req.files.forEach(file => {
        const fileUrl = file.path || file.secure_url || file.location;
        if (!fileUrl) return;

        console.log('📎 File details:', {
          fieldname: file.fieldname,
          mimetype: file.mimetype,
          originalname: file.originalname,
          url: fileUrl
        });

        // Categorize by mimetype or fieldname
        if (file.mimetype?.startsWith('image/') || file.fieldname === 'images') {
          if (!Array.isArray(milestone.images)) milestone.images = [];
          milestone.images.push(fileUrl);
        } else if (file.mimetype?.startsWith('audio/') || file.fieldname === 'audios') {
          if (!Array.isArray(milestone.audios)) milestone.audios = [];
          milestone.audios.push(fileUrl);
        } else {
          // Default to files array for PDFs, docs, etc.
          if (!Array.isArray(milestone.files)) milestone.files = [];
          milestone.files.push(fileUrl);
        }

        // Also add to attachmentUrls for compatibility
        if (!Array.isArray(milestone.attachmentUrls)) milestone.attachmentUrls = [];
        milestone.attachmentUrls.push(fileUrl);
      });

      console.log('✅ Files processed and added:', {
        images: milestone.images?.length || 0,
        audios: milestone.audios?.length || 0,
        files: milestone.files?.length || 0,
        attachmentUrls: milestone.attachmentUrls?.length || 0
      });
    } else {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    await milestone.save();

    console.log('✅ Attachments uploaded successfully to milestone:', {
      id: milestone._id,
      totalImages: milestone.images?.length || 0,
      totalAudios: milestone.audios?.length || 0,
      totalFiles: milestone.files?.length || 0,
      totalAttachments: milestone.attachmentUrls?.length || 0
    });

    // Populate for response
    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email')
      .populate('statusHistory.updatedBy', 'teamMemberName email');

    res.json({
      message: 'Attachments uploaded successfully',
      milestone: populatedMilestone,
      uploadedCount: req.files.length
    });
  } catch (error) {
    console.error('❌ Upload attachments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// controllers/milestoneController.js - FIXED updateMilestone
exports.updateMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;
    const updates = req.body;

    console.log('📝 UPDATE Milestone Request:', { id, updates });

    // ✅ FIX: Declare milestone FIRST before using it
    const milestone = await Milestone.findOne({ _id: id, company });
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    console.log('📊 Current milestone state:', {
      status: milestone.status,
      descriptionCount: milestone.description?.length,
      historyCount: milestone.statusHistory?.length
    });

    // Track if we need to add a status history entry
    let shouldAddHistory = false;
    let newHistoryEntry = {
      status: milestone.status, // Default to current status
      description: [],
      updatedAt: new Date(),
      updatedBy: req.user.userId
    };

    // Handle project update
    if (updates.project) {
      const proj = await ProjectMgnt.findOne({ _id: updates.project, company });
      if (!proj) {
        return res.status(400).json({ message: 'Invalid project: Must exist and belong to your company' });
      }
      milestone.project = updates.project;
    }

    // ✅ Handle status update
    if (updates.status !== undefined && updates.status !== milestone.status) {
      console.log('📊 Status changing from', milestone.status, 'to', updates.status);
      newHistoryEntry.status = updates.status;
      milestone.status = updates.status;
      shouldAddHistory = true;
    } else if (updates.status !== undefined) {
      newHistoryEntry.status = updates.status;
    }

    // ✅ Handle description update
    if (updates.description !== undefined) {
      let newDescriptions = [];

      if (Array.isArray(updates.description)) {
        newDescriptions = updates.description.filter(d => d && typeof d === 'string' && d.trim());
      } else if (typeof updates.description === 'string' && updates.description.trim()) {
        newDescriptions = updates.description.split('\n').filter(line => line.trim() !== '');
      }

      console.log('📝 New descriptions to add:', newDescriptions);

      if (newDescriptions.length > 0) {
        if (!Array.isArray(milestone.description)) {
          milestone.description = [];
        }
        milestone.description.push(...newDescriptions);
        newHistoryEntry.description = newDescriptions;
        shouldAddHistory = true;
        console.log('✅ Description array after append:', milestone.description);
      }
    }

    // ✅ Handle statusNote
    if (updates.statusNote !== undefined && !updates.description) {
      let newNotes = [];

      if (Array.isArray(updates.statusNote)) {
        newNotes = updates.statusNote.filter(d => d && typeof d === 'string' && d.trim());
      } else if (typeof updates.statusNote === 'string' && updates.statusNote.trim()) {
        newNotes = updates.statusNote.split('\n').filter(line => line.trim() !== '');
      }

      if (newNotes.length > 0) {
        if (!Array.isArray(milestone.description)) {
          milestone.description = [];
        }
        milestone.description.push(...newNotes);
        newHistoryEntry.description = newNotes;
        shouldAddHistory = true;
      }
    }

    // ✅ Handle notes field
    if (updates.notes !== undefined && !updates.description && !updates.statusNote) {
      let newNotes = [];

      if (Array.isArray(updates.notes)) {
        newNotes = updates.notes.filter(d => d && typeof d === 'string' && d.trim());
      } else if (typeof updates.notes === 'string' && updates.notes.trim()) {
        newNotes = updates.notes.split('\n').filter(line => line.trim() !== '');
      }

      if (newNotes.length > 0) {
        if (!Array.isArray(milestone.description)) {
          milestone.description = [];
        }
        milestone.description.push(...newNotes);
        newHistoryEntry.description = newNotes;
        shouldAddHistory = true;
      }
    }

    // ✅ Add to status history if there were changes
    if (shouldAddHistory) {
      if (!Array.isArray(milestone.statusHistory)) {
        milestone.statusHistory = [];
      }
      console.log('✅ Adding new status history entry:', newHistoryEntry);
      milestone.statusHistory.push(newHistoryEntry);
    }

    // Handle other updates
    if (updates.dueDate !== undefined) {
      milestone.dueDate = new Date(updates.dueDate);
    }

    if (updates.assignedTeamMember !== undefined) {
      if (updates.assignedTeamMember && updates.assignedTeamMember.length > 0) {
        const currentProject = updates.project || milestone.project;
        const proj = await ProjectMgnt.findById(currentProject).select('teamMembers');

        const invalidMembers = updates.assignedTeamMember.filter(m => !proj.teamMembers.includes(m));
        if (invalidMembers.length > 0) {
          return res.status(400).json({ message: 'All assigned members must be part of the project team' });
        }
      }
      milestone.assignedTeamMember = updates.assignedTeamMember;
    }

    if (updates.nextFollowUp !== undefined) {
      milestone.nextFollowUp = updates.nextFollowUp ? new Date(updates.nextFollowUp) : null;
    }

    // ✅ Handle file uploads from req.files (multer)
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('📎 Processing uploaded files:', req.files.length);

      req.files.forEach(file => {
        const fileUrl = file.path || file.secure_url || file.location;
        if (!fileUrl) return;

        // Categorize by mimetype or fieldname
        if (file.mimetype?.startsWith('image/') || file.fieldname === 'images') {
          if (!Array.isArray(milestone.images)) milestone.images = [];
          milestone.images.push(fileUrl);

          // Add to history
          if (!newHistoryEntry.images) newHistoryEntry.images = [];
          newHistoryEntry.images.push(fileUrl);
          shouldAddHistory = true;

        } else if (file.mimetype?.startsWith('audio/') || file.fieldname === 'audios') {
          if (!Array.isArray(milestone.audios)) milestone.audios = [];
          milestone.audios.push(fileUrl);

          // Add to history
          if (!newHistoryEntry.audios) newHistoryEntry.audios = [];
          newHistoryEntry.audios.push(fileUrl);
          shouldAddHistory = true;

        } else {
          // Default to files array
          if (!Array.isArray(milestone.files)) milestone.files = [];
          milestone.files.push(fileUrl);

          // Add to history
          if (!newHistoryEntry.files) newHistoryEntry.files = [];
          newHistoryEntry.files.push(fileUrl);
          shouldAddHistory = true;
        }
      });

      console.log('✅ Files processed:', {
        images: milestone.images?.length || 0,
        audios: milestone.audios?.length || 0,
        files: milestone.files?.length || 0
      });
    }

    // Handle image/attachment URLs from body
    if (updates.images !== undefined) {
      milestone.images = updates.images;
    }
    if (updates.attachmentUrls !== undefined) {
      milestone.attachmentUrls = updates.attachmentUrls;
    }

    await milestone.save();

    console.log('✅ Milestone updated successfully:', {
      id: milestone._id,
      status: milestone.status,
      descriptionCount: milestone.description?.length || 0,
      historyCount: milestone.statusHistory?.length || 0,
      imagesCount: milestone.images?.length || 0,
      audiosCount: milestone.audios?.length || 0,
      filesCount: milestone.files?.length || 0
    });

    // Populate for response
    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email')
      .populate('statusHistory.updatedBy', 'teamMemberName email');

    res.json({ message: 'Milestone updated', milestone: populatedMilestone });
  } catch (error) {
    console.error('❌ Update milestone error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ GET ALL MILESTONES
exports.getMilestones = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { project, status, assignedTeamMember } = req.query;
    const filter = { company };

    if (project) filter.project = project;
    if (status) filter.status = status;
    if (assignedTeamMember) filter.assignedTeamMember = assignedTeamMember;

    const milestones = await Milestone.find(filter)
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email')
      .populate('statusHistory.updatedBy', 'teamMemberName email')
      .sort({ dueDate: 1 });

    res.json({ milestones });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ GET MILESTONE BY ID
exports.getMilestoneById = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
    const { id } = req.params;

    const milestone = await Milestone.findOne({ _id: id, company })
      .populate('project', 'title status')
      .populate('assignedTeamMember', 'teamMemberName email')
      .populate('statusHistory.updatedBy', 'teamMemberName email');

    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    res.json({ milestone });
  } catch (error) {
    console.error('Get milestone by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ DELETE MILESTONE
exports.deleteMilestone = async (req, res) => {
  try {
    const company = await getCompanyIdFromUser(req.user);
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