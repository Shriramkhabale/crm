//authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const protect = require('../middleware/protect');
const authMiddleware = require('../middleware/authMiddleware'); 
const authorizeRole = require('../middleware/authorizeRole');
const changePasswordController = require('../controllers/changePasswordController');

router.post('/change-password', authMiddleware, changePasswordController.changePassword);

// Register superadmin (initially unprotected)
router.post('/register-superadmin', authController.registerSuperadmin);

// Login route
router.post('/login', authController.login);

router.get('/superadmin', protect, authorizeRole('superadmin'), authController.getSuperadmin);

// Update superadmin profile (protected, superadmin only)
router.put('/update-superadmin/:id', protect, authorizeRole('superadmin'), authController.updateSuperadmin);

module.exports = router;