const mongoose = require('mongoose');
const config = require('../config');

const verificationScoreSchema = new mongoose.Schema({
  gps: { type: Number, default: 0, max: 20 },
  timeSpent: { type: Number, default: 0, max: 20 },
  landlord: { type: Number, default: 0, max: 20 },
  resident: { type: Number, default: 0, max: 20 },
  image: { type: Number, default: 0, max: 20 },
  sensor: { type: Number, default: 0, max: 20 },
  total: { type: Number, default: 0, max: 100 },
}, { _id: false });

const collectionSchema = new mongoose.Schema(
  {
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true,
    },
    wasteCollector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: config.collectionStatuses,
      default: 'scheduled',
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    startTime: { type: Date },
    endTime: { type: Date },
    startLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    endLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    beforePhoto: { type: String },
    afterPhoto: { type: String },
    preSensorReadingId: { type: mongoose.Schema.Types.ObjectId, ref: 'SensorReading' },
    postSensorReadingId: { type: mongoose.Schema.Types.ObjectId, ref: 'SensorReading' },
    fillDeltaPercent: { type: Number },
    sensorVerified: { type: Boolean, default: false },
    verificationScore: {
      type: verificationScoreSchema,
      default: () => ({}),
    },
    verificationStatus: {
      type: String,
      enum: config.verificationStatuses,
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmedAt: { type: Date },
    notes: { type: String, maxlength: 500 },
    timeSpentMinutes: { type: Number },
  },
  {
    timestamps: true,
  }
);

collectionSchema.index({ apartment: 1, scheduledDate: 1 });
collectionSchema.index({ wasteCollector: 1, scheduledDate: 1 });
collectionSchema.index({ status: 1 });
collectionSchema.index({ verificationStatus: 1 });
collectionSchema.index({ scheduledDate: -1 });
collectionSchema.index({ 'verificationScore.total': -1 }); // leaderboard sorting
collectionSchema.index({ completedAt: -1 });               // gap detection
collectionSchema.index({ wasteCollector: 1, verificationStatus: 1 }); // collector perf aggregation

const Collection = mongoose.model('Collection', collectionSchema);
module.exports = Collection;