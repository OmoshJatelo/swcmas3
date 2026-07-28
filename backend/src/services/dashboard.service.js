const User = require('../models/User');
const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const AnomalyAlert = require('../models/AnomalyAlert');
const ResidentVerification = require('../models/ResidentVerification');

const getTrendData = async (Model, dateField = 'createdAt', days = 30, query = {}) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);

  const data = await Model.aggregate([
    { $match: { ...query, [dateField]: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing dates
  const trend = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const found = data.find((x) => x._id === dateStr);
    trend.push({ date: dateStr, count: found ? found.count : 0 });
  }
  return trend;
};

/** Rich summary stats for admin dashboard */
const getAdminSummary = async () => {
  const [
    userCount,
    apartmentCount,
    collectionCount,
    complaintCount,
    completedCollections,
    verifiedCollections,
    resolvedComplaints,
    recentAnomalies,
    collectionTrend,
    complaintTrend,
  ] = await Promise.all([
    User.countDocuments({}),
    Apartment.countDocuments({}),
    Collection.countDocuments({}),
    Complaint.countDocuments({}),
    Collection.countDocuments({ status: 'completed' }),
    Collection.countDocuments({ verificationStatus: 'verified' }),
    Complaint.countDocuments({ status: 'resolved' }),
    AnomalyAlert.find({ status: 'new' }).sort({ createdAt: -1 }).limit(5).populate('apartment', 'name'),
    getTrendData(Collection, 'createdAt', 30),
    getTrendData(Complaint, 'createdAt', 30),
  ]);

  const complianceRate = collectionCount > 0 ? Math.round((verifiedCollections / collectionCount) * 100) : 0;
  const resolutionRate = complaintCount > 0 ? Math.round((resolvedComplaints / complaintCount) * 100) : 0;

  return {
    userCount,
    apartmentCount,
    collectionCount,
    complaintCount,
    completedCollections,
    verifiedCollections,
    complianceRate,
    resolutionRate,
    recentAnomalies,
    collectionTrend,
    complaintTrend,
  };
};

/** Officer dashboard - focused on complaints and anomalies */
const getOfficerSummary = async () => {
  const [
    activeComplaints,
    recentComplaints,
    unresolvedAnomalies,
    complaintTrend,
    complaintsByPriority
  ] = await Promise.all([
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
    Complaint.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).limit(10).populate('apartment', 'name').populate('resident', 'firstName lastName'),
    AnomalyAlert.find({ status: 'new' }).sort({ createdAt: -1 }).limit(10).populate('apartment', 'name'),
    getTrendData(Complaint, 'createdAt', 30),
    Complaint.aggregate([
      { $match: { status: { $ne: 'resolved' } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ])
  ]);

  return {
    activeComplaints,
    recentComplaints,
    unresolvedAnomalies,
    complaintTrend,
    complaintsByPriority: complaintsByPriority.reduce((acc, curr) => ({ ...acc, [curr._id || 'unassigned']: curr.count }), {}),
  };
};

/** Landlord dashboard - stats for apartments owned */
const getLandlordSummary = async (landlordId) => {
  const apartments = await Apartment.find({ landlord: landlordId });
  const apartmentIds = apartments.map((a) => a._id);

  const [
    apartmentCount,
    collectionCount,
    complaintCount,
    pendingVerifications,
    recentCollections,
    activeComplaints
  ] = await Promise.all([
    Apartment.countDocuments({ landlord: landlordId }),
    Collection.countDocuments({ apartment: { $in: apartmentIds } }),
    Complaint.countDocuments({ apartment: { $in: apartmentIds } }),
    Collection.countDocuments({ apartment: { $in: apartmentIds }, status: 'completed', verificationStatus: 'pending' }),
    Collection.find({ apartment: { $in: apartmentIds } }).sort({ createdAt: -1 }).limit(5).populate('apartment', 'name'),
    Complaint.find({ apartment: { $in: apartmentIds }, status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).limit(5).populate('apartment', 'name'),
  ]);

  return {
    apartmentCount,
    collectionCount,
    complaintCount,
    pendingVerifications,
    recentCollections,
    activeComplaints,
  };
};

/** Collector dashboard - assignments and performance */
const getCollectorSummary = async (collectorId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    assignedCount,
    completedCount,
    verifiedCount,
    todayAssignments,
    recentCollections
  ] = await Promise.all([
    Collection.countDocuments({ wasteCollector: collectorId }),
    Collection.countDocuments({ wasteCollector: collectorId, status: 'completed' }),
    Collection.countDocuments({ wasteCollector: collectorId, verificationStatus: 'verified' }),
    Collection.find({ wasteCollector: collectorId, scheduledDate: { $gte: today } }).sort({ scheduledDate: 1 }).populate('apartment', 'name address location'),
    Collection.find({ wasteCollector: collectorId, status: 'completed' }).sort({ completedAt: -1 }).limit(5).populate('apartment', 'name'),
  ]);

  const avgScoreRes = await Collection.aggregate([
    { $match: { wasteCollector: collectorId, status: 'completed', 'verificationScore.total': { $exists: true } } },
    { $group: { _id: null, avgScore: { $avg: '$verificationScore.total' } } }
  ]);

  const avgScore = avgScoreRes.length > 0 ? Math.round(avgScoreRes[0].avgScore) : 0;

  return {
    assignedCount,
    completedCount,
    verifiedCount,
    avgScore,
    todayAssignments,
    recentCollections,
  };
};

/** Resident dashboard - personal complaints and apartment info via ResidentVerification */
const getResidentSummary = async (residentId) => {
  const [
    complaintCount,
    activeComplaints,
    recentComplaints,
    verification,
  ] = await Promise.all([
    Complaint.countDocuments({ resident: residentId }),
    Complaint.countDocuments({ resident: residentId, status: { $ne: 'resolved' } }),
    Complaint.find({ resident: residentId }).sort({ createdAt: -1 }).limit(5),
    // Look up which apartment this resident is associated with via verification records
    ResidentVerification.findOne({ resident: residentId })
      .sort({ createdAt: -1 })
      .populate('apartment', 'name address city county'),
  ]);

  return {
    complaintCount,
    activeComplaints,
    recentComplaints,
    apartmentInfo: verification ? verification.apartment : null,
  };
};

/**
 * Collector leaderboard - ranked by avg verification score, then verified rate.
 * Returns top N collectors with their full performance breakdown.
 */
const getCollectorLeaderboard = async ({ limit = 10 } = {}) => {
  const leaderboard = await Collection.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$wasteCollector',
        totalCompleted: { $sum: 1 },
        verified: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] },
        },
        disputed: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'disputed'] }, 1, 0] },
        },
        avgScore: { $avg: '$verificationScore.total' },
      },
    },
    {
      $addFields: {
        verifiedRate: {
          $cond: [
            { $eq: ['$totalCompleted', 0] },
            0,
            { $multiply: [{ $divide: ['$verified', '$totalCompleted'] }, 100] },
          ],
        },
        disputeRate: {
          $cond: [
            { $eq: ['$totalCompleted', 0] },
            0,
            { $multiply: [{ $divide: ['$disputed', '$totalCompleted'] }, 100] },
          ],
        },
        avgScore: { $round: ['$avgScore', 1] },
      },
    },
    { $sort: { avgScore: -1, verifiedRate: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        collectorId: '$_id',
        name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
        email: '$user.email',
        totalCompleted: 1,
        verified: 1,
        disputed: 1,
        verifiedRate: { $round: ['$verifiedRate', 1] },
        disputeRate: { $round: ['$disputeRate', 1] },
        avgScore: 1,
      },
    },
  ]);

  return leaderboard.map((entry, index) => ({ rank: index + 1, ...entry }));
};

/**
 * KPI comparison - current period vs previous period.
 * Computes % change for key metrics so the frontend can show delta indicator cards.
 */
const getKpiComparison = async ({ days = 30 } = {}) => {
  const now = new Date();
  const currentStart = new Date(now - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now - 2 * days * 24 * 60 * 60 * 1000);

  const pctChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const [
    currCollections,
    prevCollections,
    currVerified,
    prevVerified,
    currComplaints,
    prevComplaints,
    currResolved,
    prevResolved,
    currAnomalies,
    prevAnomalies,
  ] = await Promise.all([
    Collection.countDocuments({ createdAt: { $gte: currentStart } }),
    Collection.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
    Collection.countDocuments({ verificationStatus: 'verified', createdAt: { $gte: currentStart } }),
    Collection.countDocuments({ verificationStatus: 'verified', createdAt: { $gte: previousStart, $lt: currentStart } }),
    Complaint.countDocuments({ createdAt: { $gte: currentStart } }),
    Complaint.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
    // Resolution rate: resolved-in-period / created-in-period (same window)
    Complaint.countDocuments({ status: 'resolved', resolvedAt: { $gte: currentStart } }),
    Complaint.countDocuments({ status: 'resolved', resolvedAt: { $gte: previousStart, $lt: currentStart } }),
    AnomalyAlert.countDocuments({ status: 'new', createdAt: { $gte: currentStart } }),
    AnomalyAlert.countDocuments({ status: 'new', createdAt: { $gte: previousStart, $lt: currentStart } }),
  ]);

  const currComplianceRate = currCollections > 0 ? Math.round((currVerified / currCollections) * 100) : 0;
  const prevComplianceRate = prevCollections > 0 ? Math.round((prevVerified / prevCollections) * 100) : 0;
  const currResolutionRate = currComplaints > 0 ? Math.round((currResolved / currComplaints) * 100) : 0;
  const prevResolutionRate = prevComplaints > 0 ? Math.round((prevResolved / prevComplaints) * 100) : 0;

  return {
    periodDays: days,
    collections: {
      current: currCollections,
      previous: prevCollections,
      change: pctChange(currCollections, prevCollections),
    },
    complianceRate: {
      current: currComplianceRate,
      previous: prevComplianceRate,
      change: pctChange(currComplianceRate, prevComplianceRate),
    },
    complaints: {
      current: currComplaints,
      previous: prevComplaints,
      change: pctChange(currComplaints, prevComplaints),
    },
    resolutionRate: {
      current: currResolutionRate,
      previous: prevResolutionRate,
      change: pctChange(currResolutionRate, prevResolutionRate),
    },
    newAnomalies: {
      current: currAnomalies,
      previous: prevAnomalies,
      change: pctChange(currAnomalies, prevAnomalies),
    },
  };
};

module.exports = {
  getAdminSummary,
  getOfficerSummary,
  getLandlordSummary,
  getCollectorSummary,
  getResidentSummary,
  getCollectorLeaderboard,
  getKpiComparison,
};
