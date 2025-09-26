const TicketProgress = require('../models/TicketProgress');
const SupportTicket = require('../models/SupportTicket');
const mongoose = require('mongoose');  // <-- ADD: For ObjectId conversion

exports.addProgressUpdate = async (req, res) => {
  try {
    const { ticketId, status, notes, updatedBy } = req.body;  // Keep 'notes' from body for backward compatibility

    if (!ticketId || !status || !updatedBy) {
      return res.status(400).json({ message: 'ticketId, status and updatedBy are required' });
    }

    // Convert to ObjectId for refs
    const ticketIdObj = new mongoose.Types.ObjectId(ticketId);
    const updatedById = new mongoose.Types.ObjectId(updatedBy);

    // Create new progress update - FIXED: Map 'notes' to 'description' (schema field)
    const progress = new TicketProgress({
      ticketId: ticketIdObj,
      status,
      description: notes,  // <-- FIXED: Use schema field 'description' (from body 'notes')
      // reassignDescription remains undefined for general updates
      updatedBy: updatedById,
    });

    await progress.save();

    // Update status in SupportTicket
    const ticket = await SupportTicket.findById(ticketIdObj);
    if (!ticket) {
      return res.status(404).json({ message: 'SupportTicket not found' });
    }

    ticket.status = status;
    await ticket.save();

    // Populate for response
    await progress.populate('updatedBy', 'name email');

    res.status(201).json({ message: 'Progress updated and ticket status changed', progress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProgressByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Convert ticketId to ObjectId for query
    const ticketIdObj = new mongoose.Types.ObjectId(ticketId);

    const progressUpdates = await TicketProgress.find({ ticketId: ticketIdObj })
      .populate('updatedBy', 'name email') // populate support engineer info
      .sort({ updatedAt: 1 });

    res.json(progressUpdates);  // Now includes description and reassignDescription where applicable
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
