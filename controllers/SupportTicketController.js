// controllers/SupportTicketController.js
const SupportTicket = require("../models/SupportTicket");

// Create new support ticket
// exports.createTicket = async (req, res) => {
//     try {
//         const ticket = new SupportTicket(req.body);
//         await ticket.save();
//         res.status(201).json({ success: true, ticket });
//     } catch (err) {
//         res.status(400).json({ success: false, message: err.message });
//     }
// };

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
    const skip = (page - 1) * limit;
    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    const total = await SupportTicket.countDocuments(filter);
    res.json({
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
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

// Update ticket
// exports.updateTicket = async (req, res) => {
//     try {
//         const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true });
//         if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
//         res.json({ success: true, ticket });
//     } catch (err) {
//         res.status(400).json({ success: false, message: err.message });
//     }
// };

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

    // Extract uploaded image URLs
    if (req.files && req.files.length > 0) {
      data.image = req.files.map(file => file.path);
    }

    const ticket = new SupportTicket(data);
    await ticket.save();
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update support ticket with images
exports.updateTicketWithImages = async (req, res) => {
  try {
    const data = req.body;

    if (req.files && req.files.length > 0) {
      // Append new images to existing images array
      const ticket = await SupportTicket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

      const newImages = req.files.map(file => file.path);
      data.image = ticket.image ? ticket.image.concat(newImages) : newImages;
    }

    const updatedTicket = await SupportTicket.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!updatedTicket) return res.status(404).json({ success: false, message: "Ticket not found" });

    res.json({ success: true, ticket: updatedTicket });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

