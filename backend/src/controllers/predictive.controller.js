const predictiveSchedulerService = require('../services/predictiveScheduler.service');
const forecastingService = require('../services/forecasting.service');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const config = require('../config');

// Get fill-level forecast for a specific apartment
const getApartmentForecast = async (req, res, next) => {
  try {
    const { apartmentId } = req.params;
    const hoursAhead = parseInt(req.query.hoursAhead) || 48;

    const apartment = await Apartment.findById(apartmentId);
    if (!apartment) {
      return res.status(404).json(new ApiResponse({ success: false, message: 'Apartment not found' }));
    }

    const forecast = await forecastingService.predictFillLevel(apartmentId, hoursAhead);
    
    res.json(new ApiResponse({ 
      data: { 
        apartmentId,
        apartmentName: apartment.name,
        forecast 
      } 
    }));
  } catch (err) {
    next(err);
  }
};

// Get forecasts for all apartments (with optional collector filter)
const getAllForecasts = async (req, res, next) => {
  try {
    const { collectorId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (collectorId) filter.wasteCollector = collectorId;

    const apartments = await Apartment.find(filter)
      .select('_id name wasteCollector location')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const forecasts = await Promise.all(
      apartments.map(async (apt) => {
        try {
          const forecast = await forecastingService.predictFillLevel(apt._id, 48);
          return {
            apartmentId: apt._id,
            apartmentName: apt.name,
            collectorId: apt.wasteCollector,
            location: apt.location,
            forecast
          };
        } catch (err) {
          return {
            apartmentId: apt._id,
            apartmentName: apt.name,
            collectorId: apt.wasteCollector,
            location: apt.location,
            forecast: { error: err.message }
          };
        }
      })
    );

    const total = await Apartment.countDocuments(filter);
    
    res.json(new ApiResponse({ 
      data: { 
        forecasts,
        pagination: { page: parseInt(page), limit: parseInt(limit), total }
      } 
    }));
  } catch (err) {
    next(err);
  }
};

// Get optimized schedule for next N days
const getOptimizedSchedule = async (req, res, next) => {
  try {
    const daysAhead = parseInt(req.query.daysAhead) || 14;
    const schedule = await predictiveSchedulerService.generateOptimizedSchedule(daysAhead);
    
    res.json(new ApiResponse({ data: schedule }));
  } catch (err) {
    next(err);
  }
};

// Apply optimized schedule (create collection entries)
const applyOptimizedSchedule = async (req, res, next) => {
  try {
    const { daysAhead = 14, dryRun = true } = req.body;
    
    const schedule = await predictiveSchedulerService.generateOptimizedSchedule(daysAhead);
    const result = await predictiveSchedulerService.applyOptimizedSchedule(schedule, dryRun);
    
    res.json(new ApiResponse({ 
      data: { 
        dryRun,
        applied: result.created,
        errors: result.errors,
        details: result.details 
      } 
    }));
  } catch (err) {
    next(err);
  }
};

// Get collector-specific forecast summary
const getCollectorForecast = async (req, res, next) => {
  try {
    const { collectorId } = req.params;
    const hoursAhead = parseInt(req.query.hoursAhead) || 48;

    const collector = await User.findById(collectorId);
    if (!collector || collector.role !== 'waste_collector') {
      return res.status(404).json(new ApiResponse({ success: false, message: 'Collector not found' }));
    }

    const apartments = await Apartment.find({ 
      wasteCollector: collectorId, 
      isActive: true 
    }).select('_id name location').lean();

    const forecasts = await Promise.all(
      apartments.map(async (apt) => {
        try {
          const forecast = await forecastingService.predictFillLevel(apt._id, hoursAhead);
          return { apartmentId: apt._id, apartmentName: apt.name, location: apt.location, forecast };
        } catch (err) {
          return { apartmentId: apt._id, apartmentName: apt.name, location: apt.location, forecast: { error: err.message } };
        }
      })
    );

    // Summary stats
    const urgent = forecasts.filter(f => f.forecast.recommendedWindow === 'urgent').length;
    const soon = forecasts.filter(f => f.forecast.recommendedWindow === 'soon').length;
    const normal = forecasts.filter(f => f.forecast.recommendedWindow === 'normal').length;
    const deferred = forecasts.filter(f => f.forecast.recommendedWindow === 'deferred').length;

    res.json(new ApiResponse({ 
      data: { 
        collector: { _id: collector._id, name: `${collector.firstName} ${collector.lastName}` },
        apartments: forecasts,
        summary: { urgent, soon, normal, deferred, total: apartments.length }
      } 
    }));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getApartmentForecast,
  getAllForecasts,
  getOptimizedSchedule,
  applyOptimizedSchedule,
  getCollectorForecast
};