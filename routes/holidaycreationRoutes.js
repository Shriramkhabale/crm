const express = require('express');
const {
  createHoliday,
  getHolidays,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidaycreationController');

const router = express.Router();

router.post("/company/:companyId", createHoliday);     // ADD with companyId
router.get("/company/:companyId", getHolidays);        // GET ALL for company
router.put("/:id", updateHoliday);   // UPDATE
router.delete("/:id", deleteHoliday); // DELETE

module.exports = router;
