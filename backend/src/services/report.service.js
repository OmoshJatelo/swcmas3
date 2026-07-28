const Report = require('../models/Report');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const deepseekService = require('./deepseek.service');

const getTrendData = async (Model, dateField, start, end, query = {}) => {
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) || 1;
  const data = await Model.aggregate([
    { $match: { ...query, [dateField]: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trend = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const found = data.find((x) => x._id === dateStr);
    trend.push({ date: dateStr, count: found ? found.count : 0 });
  }
  return trend;
};

/** Generate a report for a given period */
const generateReport = async ({ type, periodStart, periodEnd, generatedBy }) => {
  if (!periodStart || !periodEnd) {
    throw new ApiError(400, 'Period start and end dates are required');
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  // Basic counts
  const [totalCollections, completedCollections, verifiedCollections, disputedCollections] = await Promise.all([
    Collection.countDocuments({ scheduledDate: { $gte: start, $lte: end } }),
    Collection.countDocuments({ status: 'completed', scheduledDate: { $gte: start, $lte: end } }),
    Collection.countDocuments({ verificationStatus: 'verified', scheduledDate: { $gte: start, $lte: end } }),
    Collection.countDocuments({ status: 'disputed', scheduledDate: { $gte: start, $lte: end } }),
  ]);

  const [totalComplaints, resolvedComplaints] = await Promise.all([
    Complaint.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Complaint.countDocuments({ status: 'resolved', createdAt: { $gte: start, $lte: end } }),
  ]);

  // Complaint breakdown by type
  const complaintBreakdownAgg = await Complaint.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);
  const complaintBreakdown = {};
  complaintBreakdownAgg.forEach((c) => {
    complaintBreakdown[c._id] = c.count;
  });

  // Collector performance summary
  const collectorPerfAgg = await Collection.aggregate([
    { $match: { scheduledDate: { $gte: start, $lte: end }, status: 'completed' } },
    { $group: {
        _id: '$wasteCollector',
        totalCollections: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] } },
        avgScore: { $avg: '$verificationScore.total' },
      }
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'collector' } },
    { $unwind: '$collector' },
    { $project: {
        collectorId: '$_id',
        name: { $concat: ['$collector.firstName', ' ', '$collector.lastName'] },
        totalCollections: 1,
        verified: 1,
        averageScore: { $round: ['$avgScore', 2] },
      }
    },
  ]);

  // Landlord compliance summary
  const landlordAgg = await Apartment.aggregate([
    { $match: {} }, // all apartments
    { $lookup: {
        from: 'collections',
        let: { aptId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$apartment', '$$aptId'] }, scheduledDate: { $gte: start, $lte: end }, status: 'completed' } },
        ],
        as: 'collections'
      }
    },
    { $lookup: {
        from: 'users',
        localField: 'landlord',
        foreignField: '_id',
        as: 'landlordInfo'
      }
    },
    { $unwind: '$landlordInfo' },
    { $project: {
        landlordId: '$landlord',
        name: { $concat: ['$landlordInfo.firstName', ' ', '$landlordInfo.lastName'] },
        totalVerifications: { $size: '$collections' },
        confirmed: { $size: { $filter: { input: '$collections', as: 'col', cond: { $eq: ['$$col.verificationStatus', 'verified'] } } } },
      }
    },
    { $addFields: { complianceRate: { $cond: [{ $eq: ['$totalVerifications', 0] }, 0, { $multiply: [{ $divide: ['$confirmed', '$totalVerifications'] }, 100] }] } } },
  ]);

  // High‑risk areas – apartments with > threshold complaints in period
  const highRiskAgg = await Complaint.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $lookup: { from: 'apartments', localField: 'apartment', foreignField: '_id', as: 'apt' } },
    { $unwind: '$apt' },
    { $group: { _id: '$apt._id', name: { $first: '$apt.name' }, complaintCount: { $sum: 1 } } },
    { $match: { complaintCount: { $gt: 5 } } },
  ]);

  const highRiskAreas = highRiskAgg.map((a) => ({
    apartment: a._id,
    name: a.name,
    complaintCount: a.complaintCount,
    riskScore: Math.min(100, a.complaintCount * 10), // simplistic scoring
  }));

  const [complaintTrends, collectionTrends, violationTrends] = await Promise.all([
    getTrendData(Complaint, 'createdAt', start, end),
    getTrendData(Collection, 'scheduledDate', start, end),
    getTrendData(Collection, 'scheduledDate', start, end, { status: 'disputed' })
  ]);

  const reportData = {
    totalCollections,
    completedCollections,
    verifiedCollections,
    disputedCollections,
    totalComplaints,
    resolvedComplaints,
    complaintBreakdown,
    collectorPerformance: collectorPerfAgg,
    landlordCompliance: landlordAgg,
    highRiskAreas,
    complaintTrends,
    collectionTrends,
    violationTrends,
  };

  const periodStr = `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;

  // Generate AI summary using the new deepseekService function
  let aiSummary = '';
  let recommendations = [];
  try {
    const aiResult = await deepseekService.generateReportSummary(reportData, type, periodStr);
    aiSummary = aiResult.summary || '';
    recommendations = aiResult.recommendations || [];
  } catch (e) {
    console.error('Failed to generate AI report summary:', e);
  }

  const report = new Report({
    type,
    generatedBy,
    period: { start, end },
    data: reportData,
    aiSummary,
    recommendations,
    isPublished: false,
  });
  await report.save();
  return report;
};

/** List reports with pagination */
const listReports = async ({ filter = {}, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const reports = await Report.find(filter)
    .populate('generatedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Report.countDocuments(filter);
  return { reports, total, page, limit };
};

/** Get a single report */
const getReport = async (id) => {
  const report = await Report.findById(id).populate('generatedBy', 'firstName lastName email');
  if (!report) throw new ApiError(404, 'Report not found');
  return report;
};

/**
 * Export a report as CSV.
 * Returns an object with { filename, csv } for the controller to stream.
 */
const exportReportCsv = async (id) => {
  const report = await getReport(id);
  const { Parser } = require('json2csv');
  const sections = [];

  // Section 1: Summary
  const summary = [
    {
      metric: 'Total Collections',
      value: report.data.totalCollections,
    },
    { metric: 'Completed Collections', value: report.data.completedCollections },
    { metric: 'Verified Collections', value: report.data.verifiedCollections },
    { metric: 'Disputed Collections', value: report.data.disputedCollections },
    { metric: 'Total Complaints', value: report.data.totalComplaints },
    { metric: 'Resolved Complaints', value: report.data.resolvedComplaints },
  ];
  const summaryParser = new Parser({ fields: ['metric', 'value'] });
  sections.push('=== SUMMARY ===');
  sections.push(summaryParser.parse(summary));

  // Section 2: Collector Performance
  if (report.data.collectorPerformance && report.data.collectorPerformance.length > 0) {
    const perfParser = new Parser({
      fields: ['name', 'totalCollections', 'verified', 'averageScore'],
    });
    sections.push('');
    sections.push('=== COLLECTOR PERFORMANCE ===');
    sections.push(perfParser.parse(report.data.collectorPerformance));
  }

  // Section 3: Landlord Compliance
  if (report.data.landlordCompliance && report.data.landlordCompliance.length > 0) {
    const landlordFields = ['name', 'totalVerifications', 'confirmed', 'complianceRate'];
    const landlordParser = new Parser({ fields: landlordFields });
    sections.push('');
    sections.push('=== LANDLORD COMPLIANCE ===');
    sections.push(landlordParser.parse(report.data.landlordCompliance));
  }

  // Section 4: High-Risk Areas
  if (report.data.highRiskAreas && report.data.highRiskAreas.length > 0) {
    const riskParser = new Parser({
      fields: ['name', 'complaintCount', 'riskScore'],
    });
    sections.push('');
    sections.push('=== HIGH RISK AREAS ===');
    sections.push(riskParser.parse(report.data.highRiskAreas));
  }

  const periodStr = `${new Date(report.period.start).toISOString().split('T')[0]}_${new Date(report.period.end).toISOString().split('T')[0]}`;
  const filename = `report_${report.type}_${periodStr}.csv`;

  return { filename, csv: sections.join('\n') };
};

module.exports = { generateReport, listReports, getReport, exportReportCsv };
