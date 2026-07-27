const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Call DeepSeek chat completions API with retry logic.
 * Returns the assistant message content as a string.
 */
const callDeepSeek = async (messages, maxTokens = 500) => {
  if (!config.deepseek.apiKey || config.deepseek.apiKey === 'your-deepseek-api-key') {
    logger.warn('DeepSeek API key not configured – returning null');
    return null;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${config.deepseek.apiUrl}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${config.deepseek.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      logger.warn('DeepSeek API attempt %d failed: %s', attempt + 1, err.message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  logger.error('DeepSeek API exhausted retries: %s', lastError?.message);
  return null;
};

/**
 * Safely parse JSON from a string. Tries direct parse first,
 * then attempts to extract JSON from markdown code fences.
 */
const safeParseJSON = (str) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    // Try extracting JSON from markdown code fence
    const match = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // fall through
      }
    }
    // Try extracting first { ... } block
    const braceMatch = str.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }
    return null;
  }
};

/* ─────────────────────────────────────────────────────────────
   1. COMPLAINT CLASSIFICATION
   ───────────────────────────────────────────────────────────── */

const COMPLAINT_SYSTEM_PROMPT = `You are an AI assistant for a waste management compliance system used by county governments in Kenya.
Your task is to analyze citizen complaints about waste collection and provide structured classification.
Always respond with valid JSON in the following format:
{
  "category": "missed_collection|illegal_dumping|overflowing_bins|bad_odor|burning_waste|other",
  "priority": "low|medium|high|critical",
  "sentiment": "positive|neutral|negative|angry",
  "riskScore": <number 0-100>,
  "recommendation": "<specific actionable recommendation>"
}`;

/**
 * Classify a complaint using AI.
 * @param {string} complaintText - The complaint description
 * @param {string} complaintType - The user-selected type (for context)
 * @returns {Object} Analysis result
 */
const classifyComplaint = async (complaintText, complaintType = '') => {
  const fallback = {
    category: complaintType || 'other',
    priority: 'medium',
    sentiment: 'negative',
    riskScore: 40,
    recommendation: 'Requires manual review by county officer.',
  };

  const userPrompt = `Analyze the following waste management complaint and classify it.

Complaint Type (selected by user): ${complaintType || 'not specified'}
Complaint Text: "${complaintText}"

Provide your analysis as JSON.`;

  const raw = await callDeepSeek([
    { role: 'system', content: COMPLAINT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  const parsed = safeParseJSON(raw);
  if (!parsed) return fallback;

  return {
    category: parsed.category || fallback.category,
    priority: parsed.priority || fallback.priority,
    sentiment: parsed.sentiment || fallback.sentiment,
    riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : fallback.riskScore,
    recommendation: parsed.recommendation || fallback.recommendation,
  };
};

/* ─────────────────────────────────────────────────────────────
   2. REPORT SUMMARY GENERATION
   ───────────────────────────────────────────────────────────── */

const REPORT_SYSTEM_PROMPT = `You are a senior waste management analyst for a Kenyan county government.
Generate a concise but insightful executive summary for a waste management operations report.
Always respond with valid JSON in the following format:
{
  "summary": "<3-5 paragraph executive summary>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
  "riskAreas": ["<risk area 1>", "<risk area 2>", ...],
  "positiveHighlights": ["<highlight 1>", "<highlight 2>", ...]
}`;

/**
 * Generate an AI-powered report summary.
 * @param {Object} reportData - Aggregated report statistics
 * @param {string} reportType - daily|weekly|monthly
 * @param {string} periodStr - Human-readable period string
 * @returns {Object} { summary, recommendations, riskAreas, positiveHighlights }
 */
const generateReportSummary = async (reportData, reportType, periodStr) => {
  const fallback = {
    summary: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} waste management report for ${periodStr}. Total collections: ${reportData.totalCollections || 0}, Completed: ${reportData.completedCollections || 0}, Complaints: ${reportData.totalComplaints || 0}.`,
    recommendations: ['Continue monitoring collection compliance.', 'Address high-risk areas promptly.'],
    riskAreas: [],
    positiveHighlights: [],
  };

  const userPrompt = `Generate an executive summary for the following ${reportType} waste management report covering ${periodStr}.

Statistics:
- Total Collections Scheduled: ${reportData.totalCollections || 0}
- Completed Collections: ${reportData.completedCollections || 0}
- Verified Collections: ${reportData.verifiedCollections || 0}
- Disputed Collections: ${reportData.disputedCollections || 0}
- Total Complaints: ${reportData.totalComplaints || 0}
- Resolved Complaints: ${reportData.resolvedComplaints || 0}
- Complaint Types: ${JSON.stringify(reportData.complaintBreakdown || {})}
- High Risk Areas: ${JSON.stringify((reportData.highRiskAreas || []).map((a) => a.name))}
- Collector Count: ${(reportData.collectorPerformance || []).length}

Provide your analysis as JSON.`;

  const raw = await callDeepSeek(
    [
      { role: 'system', content: REPORT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    800
  );

  const parsed = safeParseJSON(raw);
  if (!parsed) return fallback;

  return {
    summary: parsed.summary || fallback.summary,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : fallback.recommendations,
    riskAreas: Array.isArray(parsed.riskAreas) ? parsed.riskAreas : [],
    positiveHighlights: Array.isArray(parsed.positiveHighlights) ? parsed.positiveHighlights : [],
  };
};

/* ─────────────────────────────────────────────────────────────
   3. COMPLIANCE INSIGHTS
   ───────────────────────────────────────────────────────────── */

const COMPLIANCE_SYSTEM_PROMPT = `You are an AI compliance analyst for waste management operations.
Analyze the provided data patterns and identify compliance issues, trends, and recommendations.
Always respond with valid JSON in the following format:
{
  "insights": ["<insight 1>", "<insight 2>", ...],
  "patterns": ["<pattern 1>", "<pattern 2>", ...],
  "urgentActions": ["<action 1>", "<action 2>", ...],
  "overallRisk": "low|medium|high|critical"
}`;

/**
 * Get AI compliance insights from aggregated data.
 * @param {Object} data - { complaints, collections, anomalies }
 * @returns {Object}
 */
const getComplianceInsights = async (data) => {
  const fallback = {
    insights: ['Insufficient data for AI-powered insights.'],
    patterns: [],
    urgentActions: [],
    overallRisk: 'medium',
  };

  const userPrompt = `Analyze the following waste management compliance data and provide insights:

Recent Complaints (last 30 days): ${data.recentComplaintCount || 0}
Missed Collections: ${data.missedCollectionCount || 0}
Disputed Collections: ${data.disputedCount || 0}
Active Anomalies: ${data.anomalyCount || 0}
Average Verification Score: ${data.avgVerificationScore || 'N/A'}
Top Complaint Types: ${JSON.stringify(data.topComplaintTypes || [])}
Repeat Offender Apartments: ${JSON.stringify(data.repeatOffenders || [])}

Provide your analysis as JSON.`;

  const raw = await callDeepSeek([
    { role: 'system', content: COMPLIANCE_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  const parsed = safeParseJSON(raw);
  if (!parsed) return fallback;

  return {
    insights: Array.isArray(parsed.insights) ? parsed.insights : fallback.insights,
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    urgentActions: Array.isArray(parsed.urgentActions) ? parsed.urgentActions : [],
    overallRisk: parsed.overallRisk || 'medium',
  };
};

/* ─────────────────────────────────────────────────────────────
   4. LEGACY analyzeText (backwards compatible)
   ───────────────────────────────────────────────────────────── */

/**
 * Generic text analysis – used as a fallback for simple prompts.
 */
const analyzeText = async (prompt) => {
  const result = await classifyComplaint(prompt, '');
  return result;
};

/* ─────────────────────────────────────────────────────────────
   5. ANOMALY PLAYBOOK GENERATION
   ───────────────────────────────────────────────────────────── */

const PLAYBOOK_SYSTEM_PROMPT = `You are a waste management operations expert for Kenyan county governments.
Given an anomaly alert, provide a structured remediation playbook.
Always respond with valid JSON in the following format:
{
  "rootCause": "<most likely root cause>",
  "immediateSteps": ["<step 1>", "<step 2>", "<step 3>"],
  "preventionTips": ["<tip 1>", "<tip 2>"],
  "estimatedResolutionTime": "<e.g., '2-4 hours', '1 day'>",
  "escalationPath": "<when to escalate and to whom>"
}`;

/**
 * Generate an AI remediation playbook for an anomaly alert.
 * @param {Object} alert - Anomaly alert object
 * @returns {Object} Playbook with root cause, steps, prevention, time estimate, escalation
 */
const generateAnomalyPlaybook = async (alert) => {
  const fallback = {
    rootCause: 'Unable to determine root cause automatically.',
    immediateSteps: [
      'Investigate the anomaly manually.',
      'Check related sensor data and collection records.',
      'Contact the assigned collector or landlord for context.',
    ],
    preventionTips: [
      'Review collection schedules for gaps.',
      'Ensure sensors are calibrated and online.',
    ],
    estimatedResolutionTime: 'Unknown',
    escalationPath: 'Escalate to County Officer if unresolved after 24 hours.',
  };

  const userPrompt = `Generate a remediation playbook for the following anomaly alert:

Anomaly Type: ${alert.type}
Severity: ${alert.severity}
Entity: ${alert.entityType} (ID: ${alert.entityId})
Description: ${alert.description}
Details: ${JSON.stringify(alert.details || {})}

Provide your analysis as JSON.`;

  const raw = await callDeepSeek([
    { role: 'system', content: PLAYBOOK_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], 600);

  const parsed = safeParseJSON(raw);
  if (!parsed) return fallback;

  return {
    rootCause: parsed.rootCause || fallback.rootCause,
    immediateSteps: Array.isArray(parsed.immediateSteps) ? parsed.immediateSteps : fallback.immediateSteps,
    preventionTips: Array.isArray(parsed.preventionTips) ? parsed.preventionTips : fallback.preventionTips,
    estimatedResolutionTime: parsed.estimatedResolutionTime || fallback.estimatedResolutionTime,
    escalationPath: parsed.escalationPath || fallback.escalationPath,
  };
};

module.exports = {
  classifyComplaint,
  generateReportSummary,
  getComplianceInsights,
  generateAnomalyPlaybook,
  analyzeText,
  callDeepSeek,
  safeParseJSON,
};
