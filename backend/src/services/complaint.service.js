const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { createNotification } = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const deepseekService = require('./deepseek.service');
const assignmentService = require('./assignment.service');
const logger = require('../utils/logger');

/** List complaints with optional filters and pagination */
const listComplaints = async ({ filter = {}, page = 1, limit = 20, sort = { createdAt: -1 } }) => {
  const skip = (page - 1) * limit;
  const complaints = await Complaint.find(filter)
    .populate('resident apartment assignedTo', 'firstName lastName email role')
    .sort(sort)
    .skip(skip)
    .limit(limit);
  const total = await Complaint.countDocuments(filter);
  return { complaints, total, page, limit };
};

/** Get single complaint */
const getComplaint = async (id) => {
  const complaint = await Complaint.findById(id)
    .populate('resident apartment assignedTo', 'firstName lastName email role');
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found');
  }
  return complaint;
};

/** Create a complaint (resident) – with automatic AI analysis */
const createComplaint = async (residentId, data) => {
  const complaint = new Complaint({
    ...data,
    resident: residentId,
    status: 'pending',
    priority: data.priority || 'medium',
  });
  await complaint.save();

  // Run AI analysis asynchronously (non-blocking)
  runAIAnalysis(complaint._id).catch((err) => {
    logger.error('Auto AI analysis failed for complaint %s: %s', complaint._id, err.message);
  });

  // Auto-assign to best collector asynchronously
  autoAssignComplaint(complaint._id).catch((err) => {
    logger.error('Auto-assignment failed for complaint %s: %s', complaint._id, err.message);
  });

  // Notify all county officers about the new complaint
  try {
    const officers = await User.find({ role: 'county_officer' });
    if (officers.length > 0) {
      await Promise.all(
        officers.map((off) =>
          createNotification({
            user: off._id,
            type: 'complaint_update',
            title: 'New complaint submitted',
            message: `Complaint "${complaint.title}" was submitted by a resident.`,
            metadata: { complaintId: complaint._id, residentId },
          })
        )
      );
    }
  } catch (e) {
    logger.error('Failed to create complaint notifications: %s', e.message);
  }
  return complaint;
};

/** Auto-assign complaint to best collector */
const autoAssignComplaint = async (complaintId) => {
  // Wait a bit for apartment population if needed
  await new Promise(r => setTimeout(r, 100));
  
  const complaint = await Complaint.findById(complaintId).populate('apartment');
  if (!complaint) {
    logger.warn('Complaint not found for auto-assignment', { complaintId });
    return null;
  }
  
  // Skip if already assigned
  if (complaint.assignedTo) {
    logger.info('Complaint already assigned, skipping auto-assignment', { complaintId });
    return complaint;
  }
  
  return assignmentService.autoAssignComplaint(complaint);
};

/** Update complaint (officer) */
const updateComplaint = async (id, data) => {
  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found');
  }
  const oldValue = complaint.toObject();

  // If resolving, set resolvedAt
  if (data.status === 'resolved' && complaint.status !== 'resolved') {
    data.resolvedAt = new Date();
  }

  Object.assign(complaint, data);
  await complaint.save();
  const newValue = complaint.toObject();
  return { oldValue, newValue };
};

/** Delete (reject) complaint – admin only */
const rejectComplaint = async (id) => {
  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found');
  }
  const oldValue = complaint.toObject();
  complaint.status = 'rejected';
  await complaint.save();
  const newValue = complaint.toObject();
  return { oldValue, newValue };
};

/** Run AI analysis on a complaint using DeepSeek – used both automatically and manually */
const runAIAnalysis = async (complaintId) => {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found');
  }

  const aiResult = await deepseekService.classifyComplaint(
    `Title: ${complaint.title}\nDescription: ${complaint.description}`,
    complaint.type
  );

  complaint.aiAnalysis = {
    category: aiResult.category,
    priority: aiResult.priority,
    sentiment: aiResult.sentiment,
    riskScore: aiResult.riskScore,
    recommendation: aiResult.recommendation,
    analyzedAt: new Date(),
    rawResponse: JSON.stringify(aiResult),
  };

  // Also update complaint priority if AI suggests higher priority
  const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const currentPriority = priorityOrder[complaint.priority] || 1;
  const aiPriority = priorityOrder[aiResult.priority] || 1;
  if (aiPriority > currentPriority) {
    complaint.priority = aiResult.priority;
  }

  await complaint.save();
  logger.info('AI analysis completed for complaint %s: priority=%s, risk=%d', complaintId, aiResult.priority, aiResult.riskScore);
  return complaint.aiAnalysis;
};

/** Manually trigger analysis (backwards compatible name) */
const analyzeComplaint = runAIAnalysis;

module.exports = {
  listComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  rejectComplaint,
  analyzeComplaint,
  runAIAnalysis,
  autoAssignComplaint,
};
