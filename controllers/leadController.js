//controllers/leadController.js
const Lead = require('../models/Lead');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { emitToUser } = require('../config/socket');

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


// exports.createLead = async (req, res) => {
//   try {
//     const {
//       workflow,
//       stage,
//       title,
//       description,
//       product,
//       customer,
//       department,
//       teamMember,
//       amount,
//       endDate,
//       location,
//       source,
//       images,
//       audioRecording,
//       documentUpload,
//       sendWhatsappNotification,
//     } = req.body;

//     if (!title ) {
//       return res.status(400).json({ message: 'Required fields missing' });
//     }

//     const lead = new Lead({
//       workflow,
//       stage,
//       title,
//       description,
//       product,
//       customer,
//       department,
//       teamMember,
//       amount,
//       endDate,
//       location,
//       source,
//       images,
//       audioRecording,
//       documentUpload,
//       sendWhatsappNotification,
//     });

//     await lead.save();

//     // Optionally, trigger WhatsApp notification here if sendWhatsappNotification is true

//     res.status(201).json({ message: 'Lead created successfully', lead });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('workflow')
      .populate('product')
      .populate('customer')
      .populate('department')
      .populate('teamMember');

    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('workflow')
      .populate('product')
      .populate('customer')
      .populate('department')
      .populate('teamMember');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update Lead
// exports.updateLead = async (req, res) => {
//   try {
//     const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true,
//     });

//     if (!updatedLead) {
//       return res.status(404).json({ message: 'Lead not found' });
//     }

//     res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Delete Lead
exports.deleteLead = async (req, res) => {
  try {
    const deletedLead = await Lead.findByIdAndDelete(req.params.id);

    if (!deletedLead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


async function getCompanyIdFromUser (user) {
  if (user.role === 'company') {
    return user.userId;
  } else {
    const employee = await Employee.findById(user.userId).select('company');
    if (!employee) throw new Error('Employee not found');
    return employee.company.toString();
  }
}

exports.createLeadWithFiles = async (req, res) => {
  try {
    const {
      workflow,
      stage,
      title,
      description,
      product,
      customer,
      department,
      teamMember,
      amount,
      endDate,
      location,
      source,
      sendWhatsappNotification,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Extract uploaded files URLs
    const images = req.files['images'] ? req.files['images'].map(file => file.path) : [];
    const audioRecording = req.files['audioRecording'] ? req.files['audioRecording'][0].path : null;
    const documentUpload = req.files['documentUpload'] ? req.files['documentUpload'][0].path : null;

    const lead = new Lead({
      workflow,
      stage,
      title,
      description,
      product,
      customer,
      department,
      teamMember,
      amount,
      endDate,
      location,
      source,
      images,
      audioRecording,
      documentUpload,
      sendWhatsappNotification,
    });

    await lead.save();

    // Optionally trigger WhatsApp notification here if sendWhatsappNotification is true
    // Create notifications for assigned team members
    try {
      if (Array.isArray(teamMember) && teamMember.length) {
        const notifications = teamMember
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(empId => ({
            recipient: new mongoose.Types.ObjectId(empId),
            type: 'lead',
            title: 'Lead Assigned',
            message: `New lead assigned: ${title}`,
            relatedId: lead._id,
            meta: {
              assignedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
              assignedByName: 'Manager',
              priority: 'medium'
            }
          }));
        if (notifications.length) {
          const created = await Notification.insertMany(notifications);
          created.forEach(n => {
            emitToUser(n.recipient, 'notification:new', {
              id: n._id,
              type: n.type,
              title: n.title,
              message: n.message,
              relatedId: n.relatedId,
              createdAt: n.createdAt,
              meta: n.meta
            });
          });
        }
      }
    } catch (e) {
      console.warn('Failed to create/emit lead assignment notifications:', e.message);
    }

    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateLeadWithFiles = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Append uploaded files URLs to existing arrays or replace
    if (req.files['images']) {
      // If you want to append new images to existing ones, fetch existing lead first
      const lead = await Lead.findById(req.params.id);
      if (!lead) return res.status(404).json({ message: 'Lead not found' });

      const newImages = req.files['images'].map(file => file.path);
      updateData.images = lead.images ? lead.images.concat(newImages) : newImages;
    }

    if (req.files['audioRecording']) {
      updateData.audioRecording = req.files['audioRecording'][0].path;
    }

    if (req.files['documentUpload']) {
      updateData.documentUpload = req.files['documentUpload'][0].path;
    }

    // Detect newly added team members for notifications
    let newlyAssigned = [];
    if (updateData.teamMember) {
      try {
        const existing = await Lead.findById(req.params.id).select('teamMember title');
        if (existing) {
          const oldSet = new Set((existing.teamMember || []).map(id => id.toString()));
          const newArr = Array.isArray(updateData.teamMember) ? updateData.teamMember : [updateData.teamMember];
          newlyAssigned = newArr
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => id.toString())
            .filter(id => !oldSet.has(id));
        }
      } catch (e) {
        newlyAssigned = [];
      }
    }

    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedLead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Create notifications for any newly assigned team members
    try {
      if (newlyAssigned.length) {
        const notifications = newlyAssigned.map(empId => ({
          recipient: new mongoose.Types.ObjectId(empId),
          type: 'lead',
          title: 'Lead Assigned',
          message: `New lead assigned: ${updatedLead.title || 'Lead'}`,
          relatedId: updatedLead._id,
          meta: {
            assignedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
            assignedByName: 'Manager',
            priority: 'medium'
          }
        }));
        const created = await Notification.insertMany(notifications);
        created.forEach(n => {
          emitToUser(n.recipient, 'notification:new', {
            id: n._id,
            type: n.type,
            title: n.title,
            message: n.message,
            relatedId: n.relatedId,
            createdAt: n.createdAt,
            meta: n.meta
          });
        });
      }
    } catch (e) {
      console.warn('Failed to create/emit lead assignment notifications (update):', e.message);
    }

    res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: error.message });
  }
};
