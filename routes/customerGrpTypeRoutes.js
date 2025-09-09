const express = require('express');
const router = express.Router();
const customerGrpTypeController = require('../controllers/customerGrpTypeController');
const authMiddleware = require('../middleware/authMiddleware'); // if you have auth

router.post('/', authMiddleware, customerGrpTypeController.createGroupType);
router.get('/', authMiddleware, customerGrpTypeController.getGroupTypes);
router.get('/:id', authMiddleware, customerGrpTypeController.getGroupTypeById);
router.put('/:id', authMiddleware, customerGrpTypeController.updateGroupType);
router.delete('/:id', authMiddleware, customerGrpTypeController.deleteGroupType);

module.exports = router;