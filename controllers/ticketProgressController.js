const TicketProgress = require('../models/TicketProgress');
const SupportTicket = require('../models/SupportTicket');
exports.addProgressUpdate = async (req, res) => {
  try {
    const { ticketId, status, notes, updatedBy } = req.body;

    if (!ticketId || !status || !updatedBy) {
      return res.status(400).json({ message: 'ticketId, status and updatedBy are required' });
    }

    // Create new progress update
    const progress = new TicketProgress({
      ticketId,
      status,
      notes,
      updatedBy,
    });

    await progress.save();

    // Update status in SupportTicket
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'SupportTicket not found' });
    }

    ticket.status = status;
    await ticket.save();

    res.status(201).json({ message: 'Progress updated and ticket status changed', progress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProgressByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const progressUpdates = await TicketProgress.find({ ticketId })
      .populate('updatedBy', 'name email') // populate support engineer info
      .sort({ updatedAt: 1 });

    res.json(progressUpdates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
