const express = require("express");
const router = express.Router();
const controller = require("../controllers/supportEngineerHistoryController");

// Get support engineer history by employeeId
router.get("/:employeeId", controller.getEngineerHistoryByEmployeeId);

// Get support engineer history by companyId
router.get("/:companyId", controller.getEngineerHistoryByCompanyId);

module.exports = router;
