const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');
const upload = require('../middleware/multerCloudinary');
const superadminController = require('../controllers/superadminController');

// Business Profile routes
router.post(
  '/business-profile',
  protect,
  authorizeRole('superadmin'),
  upload.single('businessLogo'),
  superadminController.createOrUpdateBusinessProfile
);

router.delete(
  '/business-profile',
  protect,
  authorizeRole('superadmin'),
  superadminController.deleteBusinessProfile
);

// TODO: Add routes for managing franchises, companies, employees here

module.exports = router;