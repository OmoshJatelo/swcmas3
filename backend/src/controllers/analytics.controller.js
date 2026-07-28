const analyticsService = require('../services/analytics.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /analytics/resolution-time?days=90
const resolutionTime = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 90;
    const data = await analyticsService.getResolutionTimeAnalytics({ days });
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// GET /analytics/zone-scores
const zoneScores = async (req, res, next) => {
  try {
    const data = await analyticsService.getZoneScores();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// GET /analytics/compliance-heatmap
const complianceHeatmap = async (req, res, next) => {
  try {
    const data = await analyticsService.getComplianceHeatmap();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

module.exports = { resolutionTime, zoneScores, complianceHeatmap };
