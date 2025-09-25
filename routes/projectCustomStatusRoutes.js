const express = require('express');
const router = express.Router();
const projectCustomStatusController = require('../controllers/projectCustomStatusController');  
const authMiddleware = require('../middleware/authMiddleware'); 

router.post('/', authMiddleware, projectCustomStatusController.createStatus);

router.get('/', authMiddleware, projectCustomStatusController.getAllStatuses);

router.get('/:id', authMiddleware, projectCustomStatusController.getStatusById);

router.put('/:id', authMiddleware, projectCustomStatusController.updateStatus);

router.delete('/:id', authMiddleware, projectCustomStatusController.deleteStatus);

module.exports = router;
