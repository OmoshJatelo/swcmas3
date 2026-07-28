const mongoose = require('mongoose');
const config = require('../config');

const aiAnalysisSchema = new mongoose.Schema({
  category: { type: String },
  priority: { type: String },
  sentiment: { type: String },
  riskScore: { type: Number, min: 0, max: 100 },
  recommendation: { type: String },
  analyzedAt: { type: Date },
  rawResponse: { type: String },
}, { _id: false });

const complaintSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
    },
    type: {
      type: String,
      required: true,
      enum: config.complaintTypes,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    images: [{ type: String }],
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    status: {
      type: String,
      enum: config.complaintStatuses,
      default: 'pending',
    },
    priority: {
      type: String,
      enum: config.complaintPriorities,
      default: 'medium',
    },
    aiAnalysis: {
      type: aiAnalysisSchema,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolution: {
      type: String,
      maxlength: 1000,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ resident: 1 });
complaintSchema.index({ apartment: 1 });
complaintSchema.index({ type: 1 });
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ type: 1, status: 1 });   // complaint type breakdown queries
complaintSchema.index({ resolvedAt: -1 });         // resolution time analytics
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;