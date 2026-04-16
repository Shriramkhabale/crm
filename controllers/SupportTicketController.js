// controllers/SupportTicketController.js
const SupportTicket = require("../models/SupportTicket");
const TicketProgress = require("../models/TicketProgress");  // <-- ADD THIS LINE (fixes the ReferenceError)
const mongoose = require('mongoose');  // <-- ADD THIS LINE (for safe ObjectId conversion in refs)
const Notification = require('../models/Notification');
const Employee = require('../models/Employee');
const { emitToUser } = require('../config/socket');


// Get all tickets
exports.getTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find(); // no populate
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getTicketsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    if (!customerId) {
      return res.status(400).json({ message: 'customerId is required' });
    }
    const filter = { customerId };
    if (status) {
      filter.status = status;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await SupportTicket.countDocuments(filter);
    res.json({
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getTicketsByCustomer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get single ticket by ID
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id); // no populate
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Delete ticket
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.json({ success: true, message: "Ticket deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create new support ticket with images
exports.createTicketWithImages = async (req, res) => {
  try {
    const data = req.body;
    // Handle multiple images (existing logic)
    if (req.files && req.files['image'] && req.files['image'].length > 0) {
      data.image = req.files['image'].map(file => file.path);
    } else {
      data.image = [];  // Initialize empty array if no images
    }
    // NEW: Handle single signImage
    if (req.files && req.files['signImage'] && req.files['signImage'].length > 0) {
      data.signImage = req.files['signImage'][0].path;  // Single URL
      data.isSigned = true;  // Auto-set if signature uploaded
    } else {
      data.signImage = '';  // Or null/undefined if not required
      data.isSigned = req.body.isSigned === 'true' || false;  // From body if no file
    }
    const ticket = new SupportTicket(data);
    await ticket.save();
    // Create notification if assignedTo provided (robust resolver)
    const resolveEmployeeId = async (val) => {
      if (!val) return null;
      if (mongoose.Types.ObjectId.isValid(val)) return new mongoose.Types.ObjectId(val);
      // Try find by email/name
      const emp = await Employee.findOne({
        $or: [
          { email: val },
          { teamMemberEmail: val },
          { teamMemberName: val }
        ]
      }).select('_id').lean();
      return emp ? new mongoose.Types.ObjectId(emp._id) : null;
    };

    try {
      const recipientId = await resolveEmployeeId(ticket.assignedTo);
      if (recipientId) {
        const notif = await Notification.create({
          recipient: recipientId,
          type: 'ticket',
          title: 'Support Ticket Assigned',
          message: `New support ticket assigned: ${ticket.subject || 'Ticket'}`,
          relatedId: ticket._id,
          meta: {
            assignedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
            assignedByName: req.user?.id || req.user?.userId ? 'Manager' : 'System',
            priority: ticket.priority || 'medium'
          }
        });
        emitToUser(recipientId, 'notification:new', {
          id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          relatedId: notif.relatedId,
          createdAt: notif.createdAt,
          meta: notif.meta
        });
      }
    } catch (e) {
      console.warn('Failed to create/emit ticket assignment notification:', e.message);
    }
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update support ticket with images
exports.updateTicketWithImages = async (req, res) => {
  try {
    const data = req.body;
    const ticketId = req.params.id;

    // Fetch existing ticket
    const existingTicket = await SupportTicket.findById(ticketId);
    if (!existingTicket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    // Handle multiple images (append to existing)
    if (req.files && req.files['image'] && req.files['image'].length > 0) {
      const newImages = req.files['image'].map(file => file.path);
      data.image = existingTicket.image ? existingTicket.image.concat(newImages) : newImages;
    } else {
      data.image = existingTicket.image;  // Keep existing if no new
    }
    // NEW: Handle signImage (replace if new file provided)
    if (req.files && req.files['signImage'] && req.files['signImage'].length > 0) {
      data.signImage = req.files['signImage'][0].path;  // Replace with new URL
      data.isSigned = true;  // Auto-set
      // Optional: Log/delete old signImage public_id if Cloudinary cleanup needed
      console.log('Old signImage replaced:', existingTicket.signImage);
    } else {
      // Keep existing signImage and isSigned if no new file
      data.signImage = existingTicket.signImage;
      data.isSigned = existingTicket.isSigned || (req.body.isSigned === 'true');
    }
    // Update other fields from body (e.g., status, priority)
    const updatedTicket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      { ...data, updatedAt: new Date() },  // Spread data and ensure timestamps
      { new: true, runValidators: true }
    );
    res.json({ success: true, ticket: updatedTicket });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};


// Reassign ticket to another employee, log in progress history
exports.reassignTicket = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { newAssignedTo, reassigned_description = '', updatedBy } = req.body;
    // Validation
    if (!ticketId || !newAssignedTo) {
      return res.status(400).json({
        success: false,
        message: 'ticketId (from params) and newAssignedTo are required'
      });
    }
    // Fetch existing ticket
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (ticket.assignedTo === newAssignedTo) {
      return res.status(400).json({ success: false, message: 'Ticket is already assigned to this employee' });
    }
    // Convert to ObjectId
    const ticketIdObj = new mongoose.Types.ObjectId(ticketId);
    const updatedById = updatedBy && mongoose.Types.ObjectId.isValid(updatedBy)
      ? new mongoose.Types.ObjectId(updatedBy)
      : (req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined);

    // NEW: Handle assignee history before updating assignedTo
    const now = new Date();
    const oldAssignee = ticket.assignedTo;  // Capture old assignee

    // Append old assignee to history if it's not already there (avoids duplicates)
    if (oldAssignee && !ticket.assigneeHistory.some(h => h.employeeId === oldAssignee)) {
      ticket.assigneeHistory.push({ employeeId: oldAssignee, assignedAt: ticket.updatedAt || ticket.createdAt });
    }


    // Update ticket assignedTo
    ticket.assignedTo = newAssignedTo;
    ticket.updatedAt = new Date();

    // Append new assignee to history
    ticket.assigneeHistory.push({ employeeId: newAssignedTo, assignedAt: now });


    await ticket.save();


    // Standard description for reassignment (always set)
    const standardDescription = `Ticket reassigned to employee ${newAssignedTo}`;

    const progressDescription = standardDescription;  // Standard message in description
    const progressReassignDescription = reassigned_description;  // Custom reason in separate field


    const progress = new TicketProgress({
      ticketId: ticketIdObj,
      status: ticket.status, // Preserve current status
      description: progressDescription,  // <-- FIXED: Set standard/combined description
      reassignDescription: progressReassignDescription,  // <-- FIXED: Map body to schema field (was 'reassigned_description')
      updatedBy: updatedById,
    });
    await progress.save();
    // Populate for response
    await progress.populate('updatedBy', 'name email');
    // Notify new assignee
    const resolveEmployeeId = async (val) => {
      if (!val) return null;
      if (mongoose.Types.ObjectId.isValid(val)) return new mongoose.Types.ObjectId(val);
      const emp = await Employee.findOne({
        $or: [
          { email: val },
          { teamMemberEmail: val },
          { teamMemberName: val }
        ]
      }).select('_id').lean();
      return emp ? new mongoose.Types.ObjectId(emp._id) : null;
    };

    try {
      const recipientId = await resolveEmployeeId(newAssignedTo);
      if (recipientId) {
        const notif = await Notification.create({
          recipient: recipientId,
          type: 'ticket',
          title: 'Support Ticket Reassigned',
          message: `Ticket reassigned to you${ticket.subject ? `: ${ticket.subject}` : ''}`,
          relatedId: ticket._id,
          meta: {
            assignedBy: updatedById,
            assignedByName: 'Manager',
            priority: ticket.priority || 'medium'
          }
        });
        emitToUser(recipientId, 'notification:new', {
          id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          relatedId: notif.relatedId,
          createdAt: notif.createdAt,
          meta: notif.meta
        });
      }
    } catch (e) {
      console.warn('Failed to create/emit ticket reassignment notification:', e.message);
    }
    res.json({
      success: true,
      message: 'Ticket reassigned successfully. History updated.',
      ticket,
      progress  // Now includes both description and reassignDescription correctly
    });
  } catch (error) {
    console.error('Reassign ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
