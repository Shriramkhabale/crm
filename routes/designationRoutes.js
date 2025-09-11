const express = require('express');
const router = express.Router();
const designationController = require('../controllers/designationController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, designationController.createDesignation);
router.get('/', authMiddleware, designationController.getDesignations);
router.get('/:id', authMiddleware, designationController.getDesignationById);
router.put('/:id', authMiddleware, designationController.updateDesignation);
router.delete('/:id', authMiddleware, designationController.deleteDesignation);

module.exports = router;