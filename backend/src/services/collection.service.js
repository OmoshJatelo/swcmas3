const Collection = require('../models/Collection');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ApiError = require('../utils/ApiError');
const { haversineDistance } = require('../utils/helpers');
const notificationService = require('../services/notification.service');

/** List collections with pagination and filters */
const listCollections = async ({ filter = {}, page = 1, limit = 20, sort = { scheduledDate: -1 } }) => {
  const skip = (page - 1) * limit;
  const collections = await Collection.find(filter)
    .populate('apartment wasteCollector confirmedBy', 'name address city county location')
    .sort(sort)
    .skip(skip)
    .limit(limit);
  const total = await Collection.countDocuments(filter);
  return { collections, total, page, limit };
};

/** Get a single collection */
const getCollection = async (id) => {
  const collection = await Collection.findById(id)
    .populate('apartment wasteCollector confirmedBy', 'name address city county location');
  if (!collection) {
    throw new ApiError(404, 'Collection not found');
  }
  return collection;
};

/** Create a new collection schedule (admin) */
const createCollection = async (data, creatorId) => {
  // Validate referenced apartment and collector exist
  const apartment = await Apartment.findById(data.apartment);
  if (!apartment) throw new ApiError(404, 'Apartment not found');
  const collector = await User.findById(data.wasteCollector);
  if (!collector) throw new ApiError(404, 'Collector not found');
  if (collector.role !== 'waste_collector') {
    throw new ApiError(400, 'User is not a waste collector');
  }
  const collection = new Collection({
    ...data,
    status: 'scheduled',
  });
  await collection.save();
  return collection;
};

/** Collector starts collection – capture GPS and timestamp, upload before photo */
const startCollection = async (id, startData, beforePhotoUrl) => {
  const collection = await Collection.findById(id);
  if (!collection) throw new ApiError(404, 'Collection not found');
  if (collection.status !== 'scheduled') {
    throw new ApiError(400, 'Collection cannot be started in its current status');
  }
  collection.startTime = new Date();
  collection.startLocation = startData.startLocation;
  collection.beforePhoto = beforePhotoUrl;
  collection.status = 'in_progress';
  await collection.save();
  return collection;
};

/** Collector completes collection – capture end GPS, timestamp, upload after photo, compute time spent */
const completeCollection = async (id, completeData, afterPhotoUrl) => {
  const collection = await Collection.findById(id);
  if (!collection) throw new ApiError(404, 'Collection not found');
  if (collection.status !== 'in_progress') {
    throw new ApiError(400, 'Collection is not in progress');
  }
  collection.endTime = new Date();
  collection.endLocation = completeData.endLocation;
  collection.afterPhoto = afterPhotoUrl;
  collection.status = 'completed';
  // compute minutes spent
  const diffMs = collection.endTime - collection.startTime;
  collection.timeSpentMinutes = Math.round(diffMs / 60000);
  await collection.save();

  // --- Sensor-Based Auto-Verification ---
  const sensorService = require('./sensor.service');
  const sensorResult = await sensorService.detectCollectionFromSensor(collection._id);
  let autoVerified = false;
  
  if (sensorResult.detected) {
    collection.preSensorReadingId = sensorResult.preSensorReadingId;
    collection.postSensorReadingId = sensorResult.postSensorReadingId;
    collection.fillDeltaPercent = sensorResult.fillDelta;
    collection.sensorVerified = true;
    await collection.save();

    if (sensorResult.sensorScore === 20) {
      await module.exports.verifyCollection(collection._id, { verificationStatus: 'verified' }, null);
      autoVerified = true;
      require('../utils/logger').info(`Sensor auto-verified collection ${collection._id} - fill delta ${sensorResult.fillDelta}%`);
    } else {
      require('../utils/logger').info(`Sensor partial detection for collection ${collection._id} - fill delta ${sensorResult.fillDelta}%`);
    }
  } else {
    require('../utils/logger').warn(`Sensor data insufficient for collection ${collection._id}: ${sensorResult.reason}`);
  }

  // Notify landlord that collection is completed (if not auto-verified)
  if (!autoVerified && collection.apartment) {
    const apartment = await Apartment.findById(collection.apartment);
    if (apartment && apartment.landlord) {
      await notificationService.createNotification({
        user: apartment.landlord,
        type: 'collection_reminder',
        title: 'Collection Completed',
        message: `Collection for apartment ${apartment.name} has been completed by the collector. Please verify.`,
      });
    }
  }

  // Re-fetch to get updated status if auto-verified
  return Collection.findById(id).populate('apartment wasteCollector confirmedBy', 'name address city county');
};

/** Landlord verifies collection and calculates verification score */
const verifyCollection = async (id, { verificationStatus }, verifierId) => {
  const collection = await Collection.findById(id).populate('apartment');
  if (!collection) throw new ApiError(404, 'Collection not found');
  if (collection.status !== 'completed') {
    throw new ApiError(400, 'Only completed collections can be verified');
  }
  // GPS match score – distance between startLocation and the apartment location
  const apartmentCoords = collection.apartment.location.coordinates; // [lng, lat]
  const startDist = haversineDistance(
    collection.startLocation.lat,
    collection.startLocation.lng,
    apartmentCoords[1],
    apartmentCoords[0]
  );
  // 0-20 points: perfect match (0m) = 20, distance > 200m => 0
  const maxGpsScore = 20;
  const gpsScore = Math.max(0, maxGpsScore - (startDist / 10)); // 10m => 1 point loss

  // Time spent score: expected duration based on schedule frequency could be derived; for simplicity give max if <30 mins, else reduce.
  const maxTimeScore = 20;
  const expectedMinutes = 30; // placeholder
  const actual = collection.timeSpentMinutes || expectedMinutes;
  const timeScore = Math.max(0, maxTimeScore - Math.abs(actual - expectedMinutes) / 2);

  // Landlord confirmation score – grant full if verificationStatus is 'verified'
  const landlordScore = verificationStatus === 'verified' ? 20 : 0;

  // Resident feedback score – check if there are recent complaints for this apartment around collection time
  // If no complaints about missed collection in the last 48 hours, full score.
  let residentScore = 20;
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentComplaints = await Complaint.countDocuments({
    apartment: collection.apartment._id,
    type: { $in: ['missed_collection', 'overflowing_bins'] },
    createdAt: { $gte: twoDaysAgo }
  });
  if (recentComplaints > 0) {
    residentScore = Math.max(0, 20 - (recentComplaints * 10));
  }

  // Sensor analysis score
  const sensorService = require('./sensor.service');
  const sensorResult = await sensorService.detectCollectionFromSensor(collection._id);
  const sensorScore = collection.sensorVerified
    ? (sensorResult?.sensorScore ?? 20)
    : 0;

  const totalScore = Math.round(gpsScore + timeScore + landlordScore + residentScore + sensorScore);

  collection.verificationScore = {
    gps: Math.round(gpsScore),
    timeSpent: Math.round(timeScore),
    landlord: landlordScore,
    resident: residentScore,
    sensor: sensorScore,
    total: totalScore,
  };
  collection.verificationStatus = verificationStatus;
  collection.confirmedBy = verifierId;
  collection.confirmedAt = new Date();
  
  const Invoice = require('../models/Invoice');
  
  // If disputed, status becomes disputed. Otherwise verified.
  if (verificationStatus === 'disputed') {
    collection.status = 'disputed';
  } else {
    collection.status = 'verified';
    
    // Auto-generate invoice
    if (collection.apartment && collection.apartment.landlord) {
      await Invoice.create({
        landlord: collection.apartment.landlord,
        apartment: collection.apartment._id,
        collectionRecord: collection._id,
        amount: 1500, // Dynamic pricing based on apartment size could go here
      });
    }
  }

  await collection.save();
  return collection;
};

/** Soft‑delete collection (admin) */
const deactivateCollection = async (id) => {
  const collection = await Collection.findById(id);
  if (!collection) throw new ApiError(404, 'Collection not found');
  collection.status = 'disputed'; // or a custom flag
  await collection.save();
  return collection;
};

module.exports = {
  listCollections,
  getCollection,
  createCollection,
  startCollection,
  completeCollection,
  verifyCollection,
  deactivateCollection,
};
