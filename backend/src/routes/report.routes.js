const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');

const reportController = require('../controllers/report.controller');

// Validation schema for report creation
const Joi = require('joi');
const createReportSchema = Joi.object({
  type: Joi.string().valid('daily', 'weekly', 'monthly').required(),
  periodStart: Joi.date().required(),
  periodEnd: Joi.date().required(),
});

router.use(protect);
router.use(authorize('county_admin', 'county_officer'));

router.get('/', reportController.getAll);
router.get('/:id', reportController.getOne);
router.post('/', validate(createReportSchema), reportController.create);
router.get('/:id/export', reportController.exportCsv);

module.exports = router;
