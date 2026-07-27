const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const forecastingService = require('../services/forecasting.service');
const Apartment = require('../models/Apartment');
const ApiResponse = require('../utils/ApiResponse');

router.use(protect);

// Get fill-level forecast for a specific apartment
router.get('/apartments/:id/forecast', authorize('county_admin', 'county_officer', 'waste_collector', 'landlord'), async (req, res, next) => {
  try {
    const hoursAhead = parseInt(req.query.hoursAhead, 10) || 48;
    const forecast = await forecastingService.predictFillLevel(req.params.id, hoursAhead);
    res.json(new ApiResponse({ data: forecast }));
  } catch (err) {
    next(err);
  }
});

// Get forecasts for all apartments (admin/officer only)
router.get('/forecasts', authorize('county_admin', 'county_officer'), async (req, res, next) => {
  try {
    const hoursAhead = parseInt(req.query.hoursAhead, 10) || 48;
    const forecasts = await forecastingService.getAllPredictions(hoursAhead);
    res.json(new ApiResponse({ data: forecasts }));
  } catch (err) {
    next(err);
  }
});

// Get fill-level trend for an apartment
router.get('/apartments/:id/trend', authorize('county_admin', 'county_officer', 'waste_collector', 'landlord'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const apartment = await Apartment.findById(req.params.id).lean();
    if (!apartment) {
      return res.status(404).json(new ApiResponse({ success: false, message: 'Apartment not found' }));
    }
    
    const forecast = await forecastingService.predictFillLevel(req.params.id, days * 24);
    res.json(new ApiResponse({ data: forecast }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;