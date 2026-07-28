const AnomalyAlert = require('../models/AnomalyAlert');
const Complaint = require('../models/Complaint');
const Collection = require('../models/Collection');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const SensorReading = require('../models/SensorReading');
const sensorService = require('./sensor.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/** Helper to create an anomaly alert if not already existing for the same entity and type (open) */
const createAlertIfNotExists = async ({ type, severity, entityType, entityId, description, details }) => {
  const existing = await AnomalyAlert.findOne({ type, entityType, entityId, isResolved: false });
  if (!existing) {
    const alert = new AnomalyAlert({
      type,
      severity,
      entityType,
      entityId,
      description,
      details,
      status: 'new',
    });
    await alert.save();
    logger.info('Created anomaly alert: %s on %s %s', type, entityType, entityId);
    return alert;
  }
  return existing;
};

/** Run detection rules – can be scheduled via cron */
const runDetections = async () => {
  logger.info('Running anomaly detections...');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Frequent complaints on an apartment (more than 5 in past 30 days)
  const complaintAgg = await Complaint.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$apartment', count: { $sum: 1 } } },
    { $match: { count: { $gt: 5 } } },
  ]);
  for (const item of complaintAgg) {
    if (item._id) {
      await createAlertIfNotExists({
        type: 'repeated_complaints',
        severity: 'high',
        entityType: 'Apartment',
        entityId: item._id,
        description: `Apartment has ${item.count} complaints in the last 30 days`,
        details: { complaintCount: item.count },
      });
    }
  }

  // 2. Collection time spent unusually long ( > 2 * average )
  const avgTimeAgg = await Collection.aggregate([
    { $match: { timeSpentMinutes: { $exists: true } } },
    { $group: { _id: null, avgTime: { $avg: '$timeSpentMinutes' } } },
  ]);
  const avgTime = avgTimeAgg[0]?.avgTime || 0;
  if (avgTime > 0) {
    const longCollections = await Collection.find({
      timeSpentMinutes: { $gt: avgTime * 2 },
    });
    for (const col of longCollections) {
      await createAlertIfNotExists({
        type: 'suspicious_duration',
        severity: 'medium',
        entityType: 'Collection',
        entityId: col._id,
        description: `Collection took ${col.timeSpentMinutes} mins, > 2x average (${Math.round(avgTime)} mins)`,
        details: { timeSpent: col.timeSpentMinutes, avgTime: Math.round(avgTime) },
      });
    }
  }

  // 3. Residents with repeated missed collection complaints (>=3 in last 30 days)
  const residentMissedAgg = await Complaint.aggregate([
    { $match: { type: 'missed_collection', createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$resident', count: { $sum: 1 } } },
    { $match: { count: { $gte: 3 } } },
  ]);
  for (const item of residentMissedAgg) {
    await createAlertIfNotExists({
      type: 'false_reporting', // placeholder classification
      severity: 'low',
      entityType: 'User',
      entityId: item._id,
      description: `Resident reported missed collection ${item.count} times in last 30 days`,
      details: { complaintCount: item.count },
    });
  }

  // 4. Collection Gap Detection: Apartments without any completed collection in the last 7 days
  const apartments = await Apartment.find({ isActive: true });
  for (const apt of apartments) {
    const recentCollection = await Collection.findOne({
      apartment: apt._id,
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    });
    if (!recentCollection) {
      // Find the last completed collection ever
      const lastCollection = await Collection.findOne({
        apartment: apt._id,
        status: 'completed'
      }).sort({ completedAt: -1 });

      const daysSince = lastCollection && lastCollection.completedAt
        ? Math.floor((Date.now() - lastCollection.completedAt.getTime()) / (1000 * 60 * 60 * 24))
        : '> 7';

      await createAlertIfNotExists({
        type: 'collection_gap',
        severity: 'high',
        entityType: 'Apartment',
        entityId: apt._id,
        description: `No completed collections for ${daysSince} days`,
        details: { daysSinceLastCollection: daysSince, lastCollectionId: lastCollection?._id },
      });
    }
  }

  // 5. Collector Anomaly: Collector with >50% disputed collections (min 5 collections)
  const collectorDisputeAgg = await Collection.aggregate([
    { $match: { status: 'completed' } }, // consider only completed ones
    {
      $group: {
        _id: '$wasteCollector',
        totalCollections: { $sum: 1 },
        disputedCollections: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'disputed'] }, 1, 0] }
        }
      }
    },
    { $match: { totalCollections: { $gte: 5 } } }
  ]);

  for (const item of collectorDisputeAgg) {
    if (item._id) {
      const disputeRate = item.disputedCollections / item.totalCollections;
      if (disputeRate > 0.5) {
        await createAlertIfNotExists({
          type: 'collector_performance',
          severity: 'critical',
          entityType: 'User',
          entityId: item._id,
          description: `Collector has ${Math.round(disputeRate * 100)}% dispute rate (${item.disputedCollections}/${item.totalCollections})`,
          details: { disputeRate, totalCollections: item.totalCollections, disputedCollections: item.disputedCollections },
        });
      }
    }
  }

  // 6. Sensor tamper detection
  const readings = await SensorReading.aggregate([
    { $sort: { apartment: 1, recordedAt: 1 } },
    {
      $group: {
        _id: '$apartment',
        readings: { $push: { fill: '$fillLevelPercent', at: '$recordedAt' } }
      }
    }
  ]);
  for (const aptReadings of readings) {
    const r = aptReadings.readings;
    for (let i = 1; i < r.length; i++) {
      const delta = r[i].fill - r[i - 1].fill;
      if (delta > 40) {
        await createAlertIfNotExists({
          type: 'sensor_tamper',
          severity: 'high',
          entityType: 'Apartment',
          entityId: aptReadings._id,
          description: `Sensor fill level jumped +${delta.toFixed(1)}% - possible tamper`,
          details: { delta, at: r[i].at },
        });
      }
    }
  }

  // 7. No sensor data
  const healthResults = await sensorService.checkSensorHealth();
  for (const h of healthResults) {
    if (h.status === 'offline') {
      await createAlertIfNotExists({
        type: 'no_sensor_data',
        severity: 'medium',
        entityType: 'Apartment',
        entityId: h.apartmentId,
        description: `No sensor readings received for over 24 hours`,
        details: { lastSeenAt: h.lastSeenAt },
      });
    }
  }

  logger.info('Anomaly detections completed.');
};

/** List anomaly alerts */
const listAlerts = async ({ filter = {}, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;
  const alerts = await AnomalyAlert.find(filter)
    .populate('entityId', 'firstName lastName name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await AnomalyAlert.countDocuments(filter);
  return { alerts, total, page, limit };
};

/** Resolve an anomaly alert */
const resolveAlert = async (id, resolverId, resolution) => {
  const alert = await AnomalyAlert.findById(id);
  if (!alert) throw new ApiError(404, 'Anomaly alert not found');
  alert.isResolved = true;
  alert.status = 'resolved';
  alert.resolvedBy = resolverId;
  alert.resolvedAt = new Date();
  alert.resolution = resolution;
  await alert.save();
  return alert;
};

module.exports = { runDetections, listAlerts, resolveAlert };
