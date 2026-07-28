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

// Leaderboard (admin/officer)
const leaderboard = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const data = await dashboardService.getCollectorLeaderboard({ limit });
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// KPI period comparison (admin/officer)
const kpi = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const data = await dashboardService.getKpiComparison({ days });
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

module.exports = { admin, officer, landlord, collector, resident, leaderboard, kpi };
