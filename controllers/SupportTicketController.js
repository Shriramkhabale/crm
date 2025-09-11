// controllers/SupportTicketController.js
const SupportTicket = require("../models/SupportTicket");

// Create new support ticket
exports.createTicket = async (req, res) => {
    try {
        const ticket = new SupportTicket(req.body);
        await ticket.save();
        res.status(201).json({ success: true, ticket });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Get all tickets
exports.getTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find(); // no populate
        res.json({ success: true, tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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
exports.updateTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
        res.json({ success: true, ticket });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
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