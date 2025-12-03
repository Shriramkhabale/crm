// const express = require('express');
// const router = express.Router();
// const protect = require('../middleware/protect');
// const authorizeRole = require('../middleware/authorizeRole');
// const franchiseController = require('../controllers/franchiseController');

// router.use(protect);
// router.use(authorizeRole('superadmin'));

// router.post('/', franchiseController.createFranchise);
// router.get('/:id', franchiseController.getFranchiseById);  // <-- Add this line
// router.get('/', franchiseController.getFranchises);
// router.put('/:id', franchiseController.updateFranchise);
// router.delete('/:id', franchiseController.deleteFranchise);

// module.exports = router;



const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');
const franchiseController = require('../controllers/franchiseController');
const upload = require('../middleware/multerCloudinary'); // multer-cloudinary middleware

router.use(protect);
// router.use(authorizeRole('superadmin' || 'super_employee'));

// Create franchise with logo upload
router.post(
  '/',
  upload.single('franchiseLogo'),
  franchiseController.createFranchiseWithLogo
);

// Get franchise by ID
router.get('/:id', franchiseController.getFranchiseById);

// Get all franchises
router.get('/', franchiseController.getFranchises);

// Update franchise with logo upload
router.put(
  '/:id',
  upload.single('franchiseLogo'),
  franchiseController.updateFranchiseWithLogo
);

// Delete franchise
router.delete('/:id', franchiseController.deleteFranchise);

module.exports = router;

