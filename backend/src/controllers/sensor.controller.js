const sensorService = require('../services/sensor.service');
const Apartment = require('../models/Apartment');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { getIO } = require('../utils/socket');

const ingestReading = async (req, res, next) => {
  try {
    const deviceKey = req.headers['x-device-key'];
    if (deviceKey !== process.env.SENSOR_DEVICE_KEY) {
      throw new ApiError(401, 'Unauthorized device');
    }

    let { apartmentId, apartmentName, rawDistanceCm, binHeightCm, fillPercent, deviceId, batteryVoltage, batteryLevel } = req.body;

    // ── Apartment lookup: support both ObjectId and name ─────────────
    if (!apartmentId && apartmentName) {
      const apt = await Apartment.findOne({ name: { $regex: new RegExp(`^${apartmentName}$`, 'i') } });
      if (!apt) throw new ApiError(404, `Apartment "${apartmentName}" not found`);
      apartmentId = apt._id.toString();
    }
    if (!apartmentId) {
      throw new ApiError(400, 'Missing required field: apartmentId or apartmentName');
    }

    // ── Convenience mode: accept fillPercent from Wokwi/simulator ────
    // If the device sends pre-calculated fillPercent instead of raw distance,
    // we back-calculate rawDistanceCm + binHeightCm so the service layer
    // doesn't need any changes.
    if (fillPercent !== undefined && (rawDistanceCm === undefined || binHeightCm === undefined)) {
      binHeightCm = binHeightCm || 60; // default bin height 60cm
      const clampedFill = Math.max(0, Math.min(100, fillPercent));
      rawDistanceCm = binHeightCm * (1 - clampedFill / 100);
    }

    // ── Battery convenience: accept integer % or float volts ─────────
    if (batteryVoltage === undefined && batteryLevel !== undefined) {
      // Map 0-100% to 3.0-4.2V (typical LiPo range)
      batteryVoltage = 3.0 + (batteryLevel / 100) * 1.2;
    }

    if (rawDistanceCm === undefined || binHeightCm === undefined) {
      throw new ApiError(400, 'Missing required fields: provide either (rawDistanceCm + binHeightCm) or fillPercent');
    }

    const reading = await sensorService.saveSensorReading(apartmentId, {
      rawDistanceCm,
      binHeightCm,
      deviceId,
      batteryVoltage,
    });

    try {
      const io = getIO();
      if (io) {
        io.to('county_admin').to('county_officer').emit('sensor_reading', reading);
      }
    } catch (ioErr) {
      // Ignore if socket not initialized yet during early test
    }

    res.status(201).json(new ApiResponse({ data: reading }));
  } catch (err) {
    next(err);
  }
};

const getLatestReading = async (req, res, next) => {
  try {
    const { apartmentId } = req.params;
    const reading = await sensorService.getLatestReading(apartmentId);
    if (!reading) {
      return res.status(200).json(new ApiResponse({ data: { fillLevelPercent: null, status: 'no_data' } }));
    }
    res.status(200).json(new ApiResponse({ data: reading }));
  } catch (err) {
    next(err);
  }
};

const getReadingHistory = async (req, res, next) => {
  try {
    const { apartmentId } = req.params;
    const { from, to, limit } = req.query;
    const history = await sensorService.getReadingHistory(apartmentId, { from, to, limit });
    res.status(200).json(new ApiResponse({ data: history }));
  } catch (err) {
    next(err);
  }
};

const getSensorHealth = async (req, res, next) => {
  try {
    const health = await sensorService.checkSensorHealth();
    res.status(200).json(new ApiResponse({ data: health }));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  ingestReading,
  getLatestReading,
  getReadingHistory,
  getSensorHealth,
};
