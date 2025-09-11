const express = require("express");
const router = express.Router();
const SupportTicketController = require("../controllers/SupportTicketController");

// CRUD APIs

router.post("/", SupportTicketController.createTicket);
router.get("/", SupportTicketController.getTickets);
router.get("/:id", SupportTicketController.getTicketById);
router.put("/:id", SupportTicketController.updateTicket);
router.delete("/:id", SupportTicketController.deleteTicket);

module.exports = router;
