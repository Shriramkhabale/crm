const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');
const franchiseController = require('../controllers/franchiseController');

router.use(protect);
router.use(authorizeRole('superadmin'));

router.post('/', franchiseController.createFranchise);
router.get('/:id', franchiseController.getFranchiseById);  // <-- Add this line
router.get('/', franchiseController.getFranchises);
router.put('/:id', franchiseController.updateFranchise);
router.delete('/:id', franchiseController.deleteFranchise);

module.exports = router;
