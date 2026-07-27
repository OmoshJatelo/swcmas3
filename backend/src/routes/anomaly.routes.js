const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const Joi = require('joi');

const anomalyController = require('../controllers/anomaly.controller');

router.use(protect);
router.use(authorize('county_admin', 'county_officer'));

router.get('/', anomalyController.getAll);
router.get('/:id/playbook', anomalyController.getPlaybook);
router.patch('/:id/resolve', validate(Joi.object({ resolution: Joi.string().max(500).required() })), anomalyController.resolve);

module.exports = router;
