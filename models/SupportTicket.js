// models/SupportTicket.js
const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema(
    {
        customerId: {
            type: String, 
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        image: [{
            type: String,
        }],
        status: {
            type: String,
            default: "open",
        },
        priority: {
            type: String,
            default: "medium",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);