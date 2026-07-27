const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const predictiveController = require('../controllers/predictive.controller');

router.use(protect);
router.use(authorize('county_admin', 'county_officer'));

// Fill-level forecasting
router.get('/forecast/:apartmentId', predictiveController.getApartmentForecast);
router.get('/forecast', predictiveController.getAllForecasts);

// Predictive scheduling
router.get('/schedule/optimized', predictiveController.getOptimizedSchedule);
router.post('/schedule/apply', predictiveController.applyOptimizedSchedule);

// Collector-specific predictions
router.get('/collector/:collectorId/forecast', predictiveController.getCollectorForecast);

module.exports = router;