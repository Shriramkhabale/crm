const express = require("express");
const router = express.Router();
const SupportTicketController = require("../controllers/SupportTicketController");
const upload = require("../middleware/uploadImages"); // your multer-cloudinary middleware

// POST: Create ticket with images and optional signImage
router.post(
  "/",
  upload.fields([
    { name: 'image', maxCount: 10 },  // Multiple images
    { name: 'signImage', maxCount: 1 }  // Single signature image
  ]),
  SupportTicketController.createTicketWithImages
);

// GET routes (unchanged)
router.get("/", SupportTicketController.getTickets);
router.get("/:id", SupportTicketController.getTicketById);
router.get('/customer/:customerId', SupportTicketController.getTicketsByCustomer);

// PUT: Update ticket with images and optional new signImage (replaces old signature)
router.put(
  "/:id",
  upload.fields([
    { name: 'image', maxCount: 10 },  // Append new images
    { name: 'signImage', maxCount: 1 }  // Replace signature if provided
  ]),
  SupportTicketController.updateTicketWithImages
);

// DELETE (unchanged)
router.delete("/:id", SupportTicketController.deleteTicket);

module.exports = router;
