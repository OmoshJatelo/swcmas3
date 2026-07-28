const Complaint = require('../models/Complaint');
const Collection = require('../models/Collection');
const Apartment = require('../models/Apartment');
const SensorReading = require('../models/SensorReading');

/**
 * Complaint resolution time analytics.
 * Returns avg hours-to-resolve broken down by complaint type.
 */
const getResolutionTimeAnalytics = async ({ days = 90 } = {}) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const byType = await Complaint.aggregate([
    {
      $match: {
        status: 'resolved',
        resolvedAt: { $exists: true, $gte: since },
      },
    },
    {
      $addFields: {
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
        },
      },
    },
    {
      $group: {
        _id: '$type',
        avgResolutionHours: { $avg: '$resolutionHours' },
        minResolutionHours: { $min: '$resolutionHours' },
        maxResolutionHours: { $max: '$resolutionHours' },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgResolutionHours: 1 } },
    {
      $project: {
        type: '$_id',
        avgResolutionHours: { $round: ['$avgResolutionHours', 1] },
        minResolutionHours: { $round: ['$minResolutionHours', 1] },
        maxResolutionHours: { $round: ['$maxResolutionHours', 1] },
        count: 1,
      },
    },
  ]);

  const overall = await Complaint.aggregate([
    {
      $match: {
        status: 'resolved',
        resolvedAt: { $exists: true, $gte: since },
      },
    },
    {
      $addFields: {
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgResolutionHours: { $avg: '$resolutionHours' },
        totalResolved: { $sum: 1 },
      },
    },
  ]);

  return {
    periodDays: days,
    overall: overall.length > 0
      ? {
          avgResolutionHours: Math.round(overall[0].avgResolutionHours * 10) / 10,
          totalResolved: overall[0].totalResolved,
        }
      : { avgResolutionHours: 0, totalResolved: 0 },
    byType,
  };
};

/**
 * Zone-level health scores.
 * Groups apartments by city and computes composite health score from:
 * - compliance rate (40%)
 * - complaint rate per apartment (30%)
 * - sensor uptime (30%)
 */
const getZoneScores = async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Step 1: per-apartment compliance and complaint counts
  const apartmentStats = await Apartment.aggregate([
    { $match: { isActive: true } },
    // Join collections
    {
      $lookup: {
        from: 'collections',
        localField: '_id',
        foreignField: 'apartment',
        as: 'collections',
      },
    },
    // Join complaints
    {
      $lookup: {
        from: 'complaints',
        localField: '_id',
        foreignField: 'apartment',
        as: 'complaints',
      },
    },
    {
      $addFields: {
        totalCollections: { $size: '$collections' },
        verifiedCollections: {
          $size: {
            $filter: {
              input: '$collections',
              cond: { $eq: ['$$this.verificationStatus', 'verified'] },
            },
          },
        },
        totalComplaints: { $size: '$complaints' },
      },
    },
    {
      $project: {
        city: 1,
        county: 1,
        totalCollections: 1,
        verifiedCollections: 1,
        totalComplaints: 1,
      },
    },
  ]);

  // Step 2: sensor uptime per apartment (single aggregation)
  const latestReadings = await SensorReading.aggregate([
    { $sort: { recordedAt: -1 } },
    { $group: { _id: '$apartment', lastSeenAt: { $first: '$recordedAt' } } },
  ]);
  const sensorMap = {};
  for (const r of latestReadings) {
    sensorMap[r._id.toString()] = r.lastSeenAt > twentyFourHoursAgo;
  }

  // Step 3: group by city
  const cityMap = {};
  for (const apt of apartmentStats) {
    const city = apt.city || 'Unknown';
    if (!cityMap[city]) {
      cityMap[city] = {
        city,
        county: apt.county,
        apartments: 0,
        totalCollections: 0,
        verifiedCollections: 0,
        totalComplaints: 0,
        onlineSensors: 0,
      };
    }
    const zone = cityMap[city];
    zone.apartments += 1;
    zone.totalCollections += apt.totalCollections;
    zone.verifiedCollections += apt.verifiedCollections;
    zone.totalComplaints += apt.totalComplaints;
    if (sensorMap[apt._id.toString()]) zone.onlineSensors += 1;
  }

  // Step 4: compute scores
  const zones = Object.values(cityMap).map((zone) => {
    const complianceRate =
      zone.totalCollections > 0
        ? (zone.verifiedCollections / zone.totalCollections) * 100
        : 0;

    // Complaints per apartment (lower is better); cap at 10 per apt = score 0
    const complaintRatePerApt = zone.apartments > 0 ? zone.totalComplaints / zone.apartments : 0;
    const complaintScore = Math.max(0, 100 - complaintRatePerApt * 10);

    // Sensor uptime %
    const sensorUptimePct =
      zone.apartments > 0 ? (zone.onlineSensors / zone.apartments) * 100 : 0;

    // Composite score (weighted)
    const healthScore = Math.round(
      complianceRate * 0.4 + complaintScore * 0.3 + sensorUptimePct * 0.3
    );

    return {
      city: zone.city,
      county: zone.county,
      apartments: zone.apartments,
      totalCollections: zone.totalCollections,
      verifiedCollections: zone.verifiedCollections,
      totalComplaints: zone.totalComplaints,
      onlineSensors: zone.onlineSensors,
      complianceRate: Math.round(complianceRate * 10) / 10,
      complaintRatePerApt: Math.round(complaintRatePerApt * 10) / 10,
      sensorUptimePct: Math.round(sensorUptimePct * 10) / 10,
      healthScore,
      // Qualitative label
      healthLabel:
        healthScore >= 75 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Poor',
    };
  });

  return zones.sort((a, b) => b.healthScore - a.healthScore);
};

/**
 * Apartment compliance heatmap data.
 * Returns per-apartment compliance rate with coordinates, ready for a map overlay.
 */
const getComplianceHeatmap = async () => {
  const data = await Apartment.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'collections',
        localField: '_id',
        foreignField: 'apartment',
        as: 'cols',
      },
    },
    {
      $addFields: {
        totalCols: { $size: '$cols' },
        verifiedCols: {
          $size: {
            $filter: {
              input: '$cols',
              cond: { $eq: ['$$this.verificationStatus', 'verified'] },
            },
          },
        },
        lng: { $arrayElemAt: ['$location.coordinates', 0] },
        lat: { $arrayElemAt: ['$location.coordinates', 1] },
      },
    },
    {
      $addFields: {
        complianceRate: {
          $cond: [
            { $eq: ['$totalCols', 0] },
            0,
            {
              $round: [
                { $multiply: [{ $divide: ['$verifiedCols', '$totalCols'] }, 100] },
                1,
              ],
            },
          ],
        },
      },
    },
    {
      $project: {
        name: 1,
        address: 1,
        city: 1,
        lat: 1,
        lng: 1,
        totalCols: 1,
        verifiedCols: 1,
        complianceRate: 1,
      },
    },
  ]);

  return data;
};

module.exports = {
  getResolutionTimeAnalytics,
  getZoneScores,
  getComplianceHeatmap,
};
