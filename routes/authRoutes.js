const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');

// Register superadmin (initially you can remove protect & authorizeRole to create first superadmin)
// router.post('/register-superadmin', protect, authorizeRole('superadmin'), authController.registerSuperadmin);
router.post('/register-superadmin', authController.registerSuperadmin);

// Login
router.post('/login', authController.login);

// Update superadmin profile
router.put('/update-superadmin/:id', protect, authorizeRole('superadmin'), authController.updateSuperadmin);

module.exports = router;
