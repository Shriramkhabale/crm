const express = require('express');
const router = express.Router();
const protect = require('../middleware/protect');
const authorizeRole = require('../middleware/authorizeRole');
const companyController = require('../controllers/companyController');

router.use(protect);
router.use(authorizeRole('superadmin'));

router.post('/', companyController.createCompany);
router.get('/', companyController.getCompanies);
router.get('/:id', companyController.getCompanyById);
router.put('/:id', companyController.updateCompany);
router.delete('/:id', companyController.deleteCompany);

module.exports = router;
