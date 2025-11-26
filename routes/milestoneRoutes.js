// routes/milestoneRoutes.js
const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/multerCloudinary');

// ✅ CREATE milestone - accept any file fields
router.post('/',
  authMiddleware,
  upload.any(),
  milestoneController.createMilestone
);

// ✅ UPDATE milestone - accept any file fields
router.put('/:id',
  authMiddleware,
  upload.any(),
  milestoneController.updateMilestone
);

// ✅ ADD THIS NEW ROUTE - Upload attachments to existing milestone
router.post('/:id/attachments',
  authMiddleware,
  upload.any(),
  milestoneController.uploadAttachments
);

router.get('/', authMiddleware, milestoneController.getMilestones);
router.get('/:id', authMiddleware, milestoneController.getMilestoneById);
router.delete('/:id', authMiddleware, milestoneController.deleteMilestone);

module.exports = router;