const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const analyticsController = require('../controllers/analytics.controller');

router.use(protect);
router.use(authorize('county_admin', 'county_officer'));

// GET /api/v1/analytics/resolution-time?days=90
router.get('/resolution-time', analyticsController.resolutionTime);

// GET /api/v1/analytics/zone-scores
router.get('/zone-scores', analyticsController.zoneScores);

// GET /api/v1/analytics/compliance-heatmap
router.get('/compliance-heatmap', analyticsController.complianceHeatmap);

module.exports = router;
