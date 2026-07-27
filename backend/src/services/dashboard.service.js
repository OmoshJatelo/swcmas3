const User = require('../models/User');
const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const AnomalyAlert = require('../models/AnomalyAlert');
const collectorCoachService = require('./collectorCoach.service');

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

/** Officer dashboard – focused on complaints and anomalies */
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

/** Landlord dashboard – stats for apartments owned */
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

/** Collector dashboard – assignments and performance */
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

/** Resident dashboard – personal complaints and verification responses */
const getResidentSummary = async (residentId) => {
  const [
    complaintCount,
    activeComplaints,
    recentComplaints,
    apartmentInfo
  ] = await Promise.all([
    Complaint.countDocuments({ resident: residentId }),
    Complaint.countDocuments({ resident: residentId, status: { $ne: 'resolved' } }),
    Complaint.find({ resident: residentId }).sort({ createdAt: -1 }).limit(5),
    // For now we don't strictly tie residents to apartments in the schema via a direct field on user,
    // so we just return the counts.
    Promise.resolve(null)
  ]);

  return {
    complaintCount,
    activeComplaints,
    recentComplaints,
    apartmentInfo
  };
};

/** Collector AI Coach – personalized performance tips */
const getCollectorCoachTips = async (collectorId) => {
  return await collectorCoachService.getCollectorCoachTips(collectorId);
};

module.exports = {
  getAdminSummary,
  getOfficerSummary,
  getLandlordSummary,
  getCollectorSummary,
  getResidentSummary,
  getCollectorCoachTips,
};
