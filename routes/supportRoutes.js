//routes/supportRoutes.js
const express = require("express");
const router = express.Router();
const SupportTicketController = require("../controllers/SupportTicketController");
const upload = require("../middleware/multerCloudinary"); // your multer-cloudinary middleware

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
router.put('/:id/reassign', SupportTicketController.reassignTicket);

router.put(
  "/:id",
  upload.fields([
    { name: 'image', maxCount: 10 },  // Append new images
    { name: 'signImage', maxCount: 1 }  // Replace signature if provided
  ]),
  SupportTicketController.updateTicketWithImages
);

router.delete("/:id", SupportTicketController.deleteTicket);

module.exports = router;
