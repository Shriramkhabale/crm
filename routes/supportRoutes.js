// const express = require("express");
// const router = express.Router();
// const SupportTicketController = require("../controllers/SupportTicketController");

// router.post("/", SupportTicketController.createTicket);
// router.get("/", SupportTicketController.getTickets);
// router.get("/:id", SupportTicketController.getTicketById);
// router.put("/:id", SupportTicketController.updateTicket);
// router.delete("/:id", SupportTicketController.deleteTicket);
// router.get('/customer/:customerId', SupportTicketController.getTicketsByCustomer);

// module.exports = router;

const express = require("express");
const router = express.Router();
const SupportTicketController = require("../controllers/SupportTicketController");
const upload = require("../middleware/uploadImages"); // your multer-cloudinary middleware

router.post(
  "/",
  upload.array('image', 5), // accept up to 5 images
  SupportTicketController.createTicketWithImages
);

router.get("/", SupportTicketController.getTickets);
router.get("/:id", SupportTicketController.getTicketById);
router.put(
  "/:id",
  upload.array('image', 5), // accept images on update as well
  SupportTicketController.updateTicketWithImages
);
router.delete("/:id", SupportTicketController.deleteTicket);
router.get('/customer/:customerId', SupportTicketController.getTicketsByCustomer);

module.exports = router;
