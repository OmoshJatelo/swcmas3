const mapService = require('../services/map.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /maps/apartments
const apartments = async (req, res, next) => {
  try {
    const geo = await mapService.getApartmentsGeo();
    res.json(new ApiResponse({ data: geo }));
  } catch (err) {
    next(err);
  }
};

// GET /maps/complaints
const complaints = async (req, res, next) => {
  try {
    const geo = await mapService.getComplaintsGeo();
    res.json(new ApiResponse({ data: geo }));
  } catch (err) {
    next(err);
  }
};

// GET /maps/collections
const collections = async (req, res, next) => {
  try {
    const geo = await mapService.getCollectionsGeo();
    res.json(new ApiResponse({ data: geo }));
  } catch (err) {
    next(err);
  }
};

// GET /maps/violations
const violations = async (req, res, next) => {
  try {
    const geo = await mapService.getViolationsGeo();
    res.json(new ApiResponse({ data: geo }));
  } catch (err) {
    next(err);
  }
};

// GET /maps/heatmap
const heatmap = async (req, res, next) => {
  try {
    const data = await mapService.getHeatmapData();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

// GET /maps/compliance
const compliance = async (req, res, next) => {
  try {
    const data = await mapService.getComplianceOverlay();
    res.json(new ApiResponse({ data }));
  } catch (err) {
    next(err);
  }
};

module.exports = { apartments, complaints, collections, violations, heatmap, compliance };
