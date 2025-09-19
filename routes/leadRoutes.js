// //routes/leadRoutes.js
// const express = require('express');
// const router = express.Router();
// const leadController = require('../controllers/leadController');
// const authMiddleware = require('../middleware/authMiddleware');

// router.post('/', authMiddleware, leadController.createLead);
// router.get('/', authMiddleware, leadController.getAllLeads);
// router.get('/:id', authMiddleware, leadController.getLeadById);
// router.put('/:id', authMiddleware, leadController.updateLead);
// router.delete('/:id', authMiddleware, leadController.deleteLead);

// module.exports = router;

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadImages'); // multer-cloudinary middleware

// Use upload.fields to accept multiple files with different field names
router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 5 },          // multiple images
    { name: 'audioRecording', maxCount: 1 }, // single audio file
    { name: 'documentUpload', maxCount: 1 }  // single document file
  ]),
  leadController.createLeadWithFiles
);

router.get('/', authMiddleware, leadController.getAllLeads);
router.get('/:id', authMiddleware, leadController.getLeadById);
router.put(
  '/:id',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'audioRecording', maxCount: 1 },
    { name: 'documentUpload', maxCount: 1 }
  ]),
  leadController.updateLeadWithFiles
);
router.delete('/:id', authMiddleware, leadController.deleteLead);

module.exports = router;
