const express = require('express');
const sensorController = require('../controllers/sensor.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

// No JWT needed for ESP32 ingestion, uses X-Device-Key in controller
router.post('/reading', sensorController.ingestReading);

// Admin/Officer routes
router.get('/health', protect, authorize('county_admin', 'county_officer'), sensorController.getSensorHealth);

// Generic access for authenticated users
router.get('/:apartmentId', protect, sensorController.getLatestReading);
router.get('/:apartmentId/history', protect, sensorController.getReadingHistory);

module.exports = router;
