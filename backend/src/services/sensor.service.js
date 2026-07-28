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

/** Check health of sensors — single aggregation instead of N+1 queries */
const checkSensorHealth = async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // One aggregation to get the latest reading per apartment
  const latestPerApartment = await SensorReading.aggregate([
    { $sort: { recordedAt: -1 } },
    {
      $group: {
        _id: '$apartment',
        lastSeenAt: { $first: '$recordedAt' },
        fillLevelPercent: { $first: '$fillLevelPercent' },
        batteryVoltage: { $first: '$batteryVoltage' },
      },
    },
  ]);

  // Build a lookup map: apartmentId → reading info
  const readingMap = {};
  for (const r of latestPerApartment) {
    readingMap[r._id.toString()] = r;
  }

  const activeApartments = await Apartment.find({ isActive: true }, { name: 1 }).lean();

  const healthResults = activeApartments.map((apt) => {
    const r = readingMap[apt._id.toString()];
    const lastSeenAt = r ? r.lastSeenAt : null;
    const fillLevelPercent = r ? r.fillLevelPercent : null;
    const batteryVoltage = r ? r.batteryVoltage : null;
    const status = r && lastSeenAt > twentyFourHoursAgo ? 'online' : 'offline';

    return {
      apartmentId: apt._id,
      apartmentName: apt.name,
      status,
      lastSeenAt,
      fillLevelPercent,
      batteryVoltage,
    };
  });

  return healthResults;
};

/**
 * Get daily-averaged fill level trend for an apartment.
 * Returns [{date, avgFill, maxFill, minFill}] ready for a chart.
 */
const getDailyFillTrend = async (apartmentId, { days = 30 } = {}) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const data = await SensorReading.aggregate([
    {
      $match: {
        apartment: require('mongoose').Types.ObjectId.createFromHexString
          ? require('mongoose').Types.ObjectId.createFromHexString(apartmentId.toString())
          : new (require('mongoose').Types.ObjectId)(apartmentId.toString()),
        recordedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' } },
        avgFill: { $avg: '$fillLevelPercent' },
        maxFill: { $max: '$fillLevelPercent' },
        minFill: { $min: '$fillLevelPercent' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing dates with null so charts render correctly
  const trend = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const found = data.find((x) => x._id === dateStr);
    trend.push({
      date: dateStr,
      avgFill: found ? Math.round(found.avgFill * 10) / 10 : null,
      maxFill: found ? Math.round(found.maxFill * 10) / 10 : null,
      minFill: found ? Math.round(found.minFill * 10) / 10 : null,
      readingCount: found ? found.count : 0,
    });
  }
  return trend;
};

module.exports = {
  saveSensorReading,
  getLatestReading,
  getReadingHistory,
  detectCollectionFromSensor,
  checkSensorHealth,
  getDailyFillTrend,
};
