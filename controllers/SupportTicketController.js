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