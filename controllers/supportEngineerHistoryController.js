const SupportTicket = require("../models/SupportTicket");
const TicketProgress = require("../models/TicketProgress");
const TicketReview = require("../models/TicketReview");

// Fetch all tickets, progress, reviews for a given support engineer employeeId
exports.getEngineerHistoryByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Find tickets assigned to this employeeId
    const tickets = await SupportTicket.find({ assignedTo: employeeId });

    const ticketIds = tickets.map(t => t._id);

    // Get progress updates for these tickets
    const progress = await TicketProgress.find({ ticketId: { $in: ticketIds } });

    // Get reviews for these tickets
    const reviews = await TicketReview.find({ ticketId: { $in: ticketIds } });

    res.json({
      success: true,
      employeeId,
      tickets,
      progress,
      reviews,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Fetch all tickets, progress, reviews for a given companyId
exports.getEngineerHistoryByCompanyId = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Find tickets for this company
    const tickets = await SupportTicket.find({ companyId });

    const ticketIds = tickets.map(t => t._id);

    // Get progress updates for these tickets
    const progress = await TicketProgress.find({ ticketId: { $in: ticketIds } });

    // Get reviews for these tickets
    const reviews = await TicketReview.find({ ticketId: { $in: ticketIds } });

    res.json({
      success: true,
      companyId,
      tickets,
      progress,
      reviews,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
