const User = require('../models/User');
const Collection = require('../models/Collection');
const Apartment = require('../models/Apartment');
const { haversineDistance } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Calculate distance between two points in km
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  return haversineDistance(lat1, lon1, lat2, lon2);
};

/**
 * Get active collector workload for a given date range
 */
const getCollectorWorkload = async (collectorId, date = new Date()) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const count = await Collection.countDocuments({
    wasteCollector: collectorId,
    scheduledDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['scheduled', 'in_progress'] }
  });

  return count;
};

/**
 * Get collector's assigned zones/apartments for proximity scoring
 */
const getCollectorZone = async (collectorId) => {
  const apartments = await Apartment.find({ 
    wasteCollector: collectorId,
    isActive: true 
  }).select('location');

  if (apartments.length === 0) return null;

  // Calculate centroid of assigned apartments
  let totalLat = 0, totalLng = 0;
  apartments.forEach(apt => {
    if (apt.location?.coordinates) {
      totalLng += apt.location.coordinates[0];
      totalLat += apt.location.coordinates[1];
    }
  });

  return {
    lat: totalLat / apartments.length,
    lng: totalLng / apartments.length,
    apartmentCount: apartments.length
  };
};

/**
 * Score a collector for a given complaint based on:
 * - Proximity to complaint location (40%)
 * - Current workload (30%)
 * - Historical performance (20%)
 * - Zone familiarity (10%)
 */
const scoreCollectorForComplaint = async (collector, complaint) => {
  let score = 0;
  const factors = {};

  // 1. Proximity score (40% weight)
  let proximityScore = 0;
  if (complaint.location?.lat && complaint.location?.lng && collector.zone) {
    const distance = calculateDistance(
      complaint.location.lat,
      complaint.location.lng,
      collector.zone.lat,
      collector.zone.lng
    );
    // Score: 100 at 0km, 50 at 5km, 0 at 20km+
    proximityScore = Math.max(0, 100 - (distance * 5));
  } else if (complaint.apartment?.location?.coordinates) {
    // Try using apartment location
    const aptCoords = complaint.apartment.location.coordinates; // [lng, lat]
    if (collector.zone) {
      const distance = calculateDistance(
        aptCoords[1], aptCoords[0],
        collector.zone.lat, collector.zone.lng
      );
      proximityScore = Math.max(0, 100 - (distance * 5));
    }
  }
  factors.proximity = proximityScore;
  score += proximityScore * 0.4;

  // 2. Workload score (30% weight) - lower workload = higher score
  const workload = collector.workload || 0;
  const maxWorkload = 10; // config.maxCollectionsPerCollectorDay
  const workloadScore = Math.max(0, 100 - (workload / maxWorkload * 100));
  factors.workload = workloadScore;
  score += workloadScore * 0.3;

  // 3. Performance score (20% weight) - based on verification scores
  let performanceScore = 50; // default neutral
  if (collector.avgVerificationScore !== undefined) {
    performanceScore = collector.avgVerificationScore; // already 0-100
  }
  factors.performance = performanceScore;
  score += performanceScore * 0.2;

  // 4. Zone familiarity (10% weight)
  const zoneScore = collector.zone?.apartmentCount > 0 ? 
    Math.min(100, collector.zone.apartmentCount * 5) : 0;
  factors.zoneFamiliarity = zoneScore;
  score += zoneScore * 0.1;

  return {
    totalScore: Math.round(score),
    factors
  };
};

/**
 * Auto-assign a complaint to the best available collector
 */
const autoAssignComplaint = async (complaint) => {
  // Find all active waste collectors
  const collectors = await User.find({ 
    role: 'waste_collector',
    isActive: true 
  }).select('_id firstName lastName email');

  if (collectors.length === 0) {
    logger.warn('No active collectors available for auto-assignment');
    return null;
  }

  // Get workload and zone for each collector
  const collectorsWithMetrics = await Promise.all(
    collectors.map(async (collector) => {
      const [workload, zone] = await Promise.all([
        getCollectorWorkload(collector._id),
        getCollectorZone(collector._id)
      ]);

      // Get average verification score
      const collections = await Collection.find({ 
        wasteCollector: collector._id,
        status: 'verified',
        verificationScore: { $exists: true }
      }).select('verificationScore.total').limit(50);

      const avgScore = collections.length > 0
        ? collections.reduce((sum, c) => sum + (c.verificationScore?.total || 0), 0) / collections.length
        : undefined;

      return {
        _id: collector._id,
        firstName: collector.firstName,
        lastName: collector.lastName,
        email: collector.email,
        workload,
        zone,
        avgVerificationScore: avgScore
      };
    })
  );

  // Score each collector
  const scoredCollectors = await Promise.all(
    collectorsWithMetrics.map(async (collector) => {
      const { totalScore, factors } = await scoreCollectorForComplaint(collector, complaint);
      return { ...collector, totalScore, scoreFactors: factors };
    })
  );

  // Sort by score descending
  scoredCollectors.sort((a, b) => b.totalScore - a.totalScore);

  const bestCollector = scoredCollectors[0];

  if (!bestCollector || bestCollector.totalScore < 30) {
    logger.warn('No suitable collector found for auto-assignment', {
      complaintId: complaint._id,
      bestScore: bestCollector?.totalScore
    });
    return null;
  }

  // Assign the complaint
  complaint.assignedTo = bestCollector._id;
  complaint.status = 'assigned';
  await complaint.save();

  logger.info('Auto-assigned complaint to collector', {
    complaintId: complaint._id,
    collectorId: bestCollector._id,
    collectorName: `${bestCollector.firstName} ${bestCollector.lastName}`,
    score: bestCollector.totalScore,
    factors: bestCollector.scoreFactors
  });

  return {
    complaint,
    collector: bestCollector
  };
};

module.exports = { autoAssignComplaint, scoreCollectorForComplaint };