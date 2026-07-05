const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true,
      index: true,
    },
    rawDistanceCm: {
      type: Number,
      required: true,
    },
    binHeightCm: {
      type: Number,
      required: true,
    },
    fillLevelPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deviceId: {
      type: String,
    },
    batteryVoltage: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

sensorReadingSchema.index({ apartment: 1, recordedAt: -1 });

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);
module.exports = SensorReading;
