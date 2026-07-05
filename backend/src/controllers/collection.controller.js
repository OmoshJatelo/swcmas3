const collectionService = require('../services/collection.service');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

// List collections
const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const filter = {};
    // optional filters: status, wasteCollector, apartment
    if (req.query.status) filter.status = req.query.status;
    if (req.query.wasteCollector) filter.wasteCollector = req.query.wasteCollector;
    if (req.query.apartment) filter.apartment = req.query.apartment;
    const result = await collectionService.listCollections({ filter, page, limit });
    res.json(new ApiResponse({ data: result }));
  } catch (err) {
    next(err);
  }
};

// Get single collection
const getOne = async (req, res, next) => {
  try {
    const collection = await collectionService.getCollection(req.params.id);
    res.json(new ApiResponse({ data: collection }));
  } catch (err) {
    next(err);
  }
};

// Create collection schedule (admin)
const create = async (req, res, next) => {
  try {
    const collection = await collectionService.createCollection(req.body, req.user._id);
    res.status(201).json(new ApiResponse({ data: collection }));
  } catch (err) {
    next(err);
  }
};

// Start collection (collector) – expects beforePhoto uploaded via Cloudinary
const start = async (req, res, next) => {
  try {
    let beforePhotoUrl;
    if (req.file) {
      // Cloudinary returns .path as a full URL; disk storage returns a local file path
      beforePhotoUrl = req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`;
    }
    const collection = await collectionService.startCollection(
      req.params.id,
      req.body,
      beforePhotoUrl
    );
    res.json(new ApiResponse({ data: collection }));
  } catch (err) {
    next(err);
  }
};

// Complete collection (collector) – expects afterPhoto upload
const complete = async (req, res, next) => {
  try {
    let afterPhotoUrl;
    if (req.file) {
      afterPhotoUrl = req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`;
    }
    const collection = await collectionService.completeCollection(
      req.params.id,
      req.body,
      afterPhotoUrl
    );
    res.json(new ApiResponse({ data: collection }));
  } catch (err) {
    next(err);
  }
};

// Verify collection (landlord)
const verify = async (req, res, next) => {
  try {
    const collection = await collectionService.verifyCollection(
      req.params.id,
      req.body,
      req.user._id
    );
    res.json(new ApiResponse({ data: collection }));
  } catch (err) {
    next(err);
  }
};

// Deactivate (admin)
const remove = async (req, res, next) => {
  try {
    const collection = await collectionService.deactivateCollection(req.params.id);
    res.json(new ApiResponse({ data: collection, message: 'Collection deactivated' }));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  start,
  complete,
  verify,
  remove,
};
