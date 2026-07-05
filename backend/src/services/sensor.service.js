const SensorReading = require('../models/SensorReading');
const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const ApiError = require('../utils/ApiError');

/** Save a new sensor reading */
const saveSensorReading = async (apartmentId, payload) => {
  const apartment = await Apartment.findById(apartmentId);
  if (!apartment) throw new ApiError(404, 'Apartment not found');

  let fillLevelPercent = ((payload.binHeightCm - payload.rawDistanceCm) / payload.binHeightCm) * 100;
  fillLevelPercent = Math.max(0, Math.min(100, fillLevelPercent)); // clamp to 0-100

  const reading = new SensorReading({
    apartment: apartmentId,
    rawDistanceCm: payload.rawDistanceCm,
    binHeightCm: payload.binHeightCm,
    fillLevelPercent,
    deviceId: payload.deviceId,
    batteryVoltage: payload.batteryVoltage,
  });

  await reading.save();
  return reading;
};

/** Get the latest reading for an apartment */
const getLatestReading = async (apartmentId) => {
  return await SensorReading.findOne({ apartment: apartmentId }).sort({ recordedAt: -1 });
};

/** Get reading history for an apartment */
const getReadingHistory = async (apartmentId, { from, to, limit = 100 }) => {
  const query = { apartment: apartmentId };
  if (from || to) {
    query.recordedAt = {};
    if (from) query.recordedAt.$gte = new Date(from);
    if (to) query.recordedAt.$lte = new Date(to);
  }

  const readings = await SensorReading.find(query)
    .sort({ recordedAt: -1 })
    .limit(Number(limit));

  const total = await SensorReading.countDocuments(query);
  return { readings, total, limit };
};

/** Detect if collection happened from sensor data */
const detectCollectionFromSensor = async (collectionId) => {
  const collection = await Collection.findById(collectionId).populate('apartment');
  if (!collection) throw new ApiError(404, 'Collection not found');

  const preReading = await SensorReading.findOne({
    apartment: collection.apartment._id,
    recordedAt: { $lt: collection.startTime || collection.scheduledDate },
  }).sort({ recordedAt: -1 });

  const endTime = collection.endTime || new Date();
  const threeHoursAfterEnd = new Date(endTime.getTime() + 3 * 60 * 60 * 1000);

  const postReading = await SensorReading.findOne({
    apartment: collection.apartment._id,
    recordedAt: { $gt: endTime, $lte: threeHoursAfterEnd },
  }).sort({ recordedAt: -1 });

  if (!preReading || !postReading) {
    return { detected: false, reason: 'insufficient_sensor_data', sensorScore: 0 };
  }

  const fillDelta = preReading.fillLevelPercent - postReading.fillLevelPercent;

  let sensorScore = 0;
  let detected = false;

  const threshold = Number(process.env.SENSOR_FILL_THRESHOLD) || 60;
  const partialThreshold = Number(process.env.SENSOR_PARTIAL_THRESHOLD) || 30;

  if (fillDelta >= threshold) {
    sensorScore = 20;
    detected = true;
  } else if (fillDelta >= partialThreshold) {
    sensorScore = Math.round((fillDelta / threshold) * 20);
    detected = true;
  } else {
    sensorScore = 0;
    detected = false;
  }

  return {
    detected,
    fillDelta,
    preFill: preReading.fillLevelPercent,
    postFill: postReading.fillLevelPercent,
    sensorScore,
    preSensorReadingId: preReading._id,
    postSensorReadingId: postReading._id,
  };
};

/** Check health of sensors */
const checkSensorHealth = async () => {
  // active filter assuming isActive exists on Apartment, otherwise just get all
  const activeApartments = await Apartment.find(); 
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const healthResults = await Promise.all(
    activeApartments.map(async (apt) => {
      const latestReading = await getLatestReading(apt._id);
      
      let status = 'offline';
      let lastSeenAt = null;
      let fillLevelPercent = null;

      if (latestReading) {
        lastSeenAt = latestReading.recordedAt;
        fillLevelPercent = latestReading.fillLevelPercent;
        if (latestReading.recordedAt > twentyFourHoursAgo) {
          status = 'online';
        }
      }

      return {
        apartmentId: apt._id,
        apartmentName: apt.name,
        status,
        lastSeenAt,
        fillLevelPercent,
      };
    })
  );

  return healthResults;
};

module.exports = {
  saveSensorReading,
  getLatestReading,
  getReadingHistory,
  detectCollectionFromSensor,
  checkSensorHealth,
};
