const dashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/ApiResponse');

// Admin dashboard
const admin = async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminSummary();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Officer dashboard
const officer = async (req, res, next) => {
  try {
    const data = await dashboardService.getOfficerSummary();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Landlord dashboard
const landlord = async (req, res, next) => {
  try {
    const data = await dashboardService.getLandlordSummary(req.user._id);
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Collector dashboard
const collector = async (req, res, next) => {
  try {
    const data = await dashboardService.getCollectorSummary(req.user._id);
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Resident dashboard
const resident = async (req, res, next) => {
  try {
    const data = await dashboardService.getResidentSummary(req.user._id);
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// Collector AI Coach Tips
const coachTips = async (req, res, next) => {
  try {
    const data = await dashboardService.getCollectorCoachTips(req.user._id);
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

module.exports = { admin, officer, landlord, collector, resident, coachTips };
