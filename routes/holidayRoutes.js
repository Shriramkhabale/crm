const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');

router.post('/company/:companyId', holidayController.createHoliday);
router.get('/company/:companyId', holidayController.getHolidaysByCompany);
router.put('/:id', holidayController.updateHoliday);
router.delete('/:id', holidayController.deleteHoliday);

module.exports = router;