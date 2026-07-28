const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const mapController = require('../controllers/map.controller');

router.use(protect);
router.use(authorize('county_admin', 'county_officer', 'landlord', 'waste_collector', 'resident'));

router.get('/apartments', mapController.apartments);
router.get('/complaints', mapController.complaints);
router.get('/collections', mapController.collections);
router.get('/violations', mapController.violations);
router.get('/heatmap', mapController.heatmap);
router.get('/compliance', mapController.compliance);

module.exports = router;
