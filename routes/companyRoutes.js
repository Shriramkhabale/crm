const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');
const companyController = require('../controllers/companyController');
const upload = require('../middleware/multerCloudinary'); // multer-cloudinary middleware

router.use(protect);

// router.post('/', companyController.createCompany);
router.post(
  '/',
  upload.single('businessLogo'),
  companyController.createCompanyWithLogo
);

router.get('/', companyController.getCompanies);
router.get('/franchise/:franchiseId', companyController.getCompaniesByFranchise);
router.get('/:id', companyController.getCompanyById);
// router.put('/:id', companyController.updateCompany);
router.put(
  '/:id',
  upload.single('businessLogo'),
  companyController.updateCompanyWithLogo
);

router.delete('/:id', companyController.deleteCompany);


// router.post('/:companyId/branches', companyController.createBranch);
router.post(
  '/:companyId/branches',
  upload.single('businessLogo'),
  companyController.createBranchWithLogo
);

router.get('/:companyId/branches', companyController.getBranchesByCompany);

// router.put('/:companyId/branches/:branchId', companyController.updateBranch);

router.put(
  '/:companyId/branches/:branchId',
  upload.single('businessLogo'),
  companyController.updateBranchWithLogo
);

router.delete('/:companyId/branches/:branchId', companyController.deleteBranch);

module.exports = router;