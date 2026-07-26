const SensorReading = require('../models/SensorReading');
const Collection = require('../models/Collection');
const logger = require('../utils/logger');

/**
 * Simple linear regression for trend analysis
 */
const linearRegression = (data) => {
  if (data.length < 2) return { slope: 0, intercept: data[0]?.y || 0, r2: 0 };
  
  const n = data.length;
  const sumX = data.reduce((a, b) => a + b.x, 0);
  const sumY = data.reduce((a, b) => a + b.y, 0);
  const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
  const sumX2 = data.reduce((a, b) => a + b.x * b.x, 0);
  const sumY2 = data.reduce((a, b) => a + b.y * b.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared
  const yMean = sumY / n;
  const ssTot = data.reduce((a, b) => a + Math.pow(b.y - yMean, 2), 0);
  const ssRes = data.reduce((a, b) => a + Math.pow(b.y - (slope * b.x + intercept), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  return { slope, intercept, r2 };
};

/**
 * Predict fill level for an apartment using sensor history
 */
const predictFillLevel = async (apartmentId, hoursAhead = 48) => {
  try {
    // Get recent sensor readings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const readings = await SensorReading.find({
      apartment: apartmentId,
      recordedAt: { $gte: thirtyDaysAgo }
    })
    .select('fillLevelPercent recordedAt')
    .sort({ recordedAt: 1 })
    .limit(500)
    .lean();

    if (readings.length < 10) {
      return {
        predictedFillPercent: null,
        confidence: 'insufficient_data',
        trend: 'unknown',
        recommendedWindow: 'unknown',
        message: `Only ${readings.length} readings in 30 days. Need at least 10.`
      };
    }

    // Prepare data for regression (x = hours since first reading, y = fill level)
    const firstTime = readings[0].recordedAt.getTime();
    const regressionData = readings.map((r, i) => ({
      x: (r.recordedAt.getTime() - firstTime) / (1000 * 60 * 60), // hours
      y: r.fillLevelPercent
    }));

    const { slope, intercept, r2 } = linearRegression(regressionData);
    
    // Current fill level (most recent reading)
    const currentFill = readings[readings.length - 1].fillLevelPercent;
    const currentTime = readings[readings.length - 1].recordedAt.getTime();
    
    // Predict future fill level
    const futureHours = (currentTime - firstTime) / (1000 * 60 * 60) + hoursAhead;
    let predictedFill = slope * futureHours + intercept;
    
    // Clamp to 0-100
    predictedFill = Math.max(0, Math.min(100, predictedFill));
    
    // Determine trend
    let trend = 'stable';
    if (slope > 0.5) trend = 'increasing';
    else if (slope < -0.5) trend = 'decreasing';
    
    // Confidence based on R² and data quantity
    let confidence = 'low';
    if (r2 > 0.7 && readings.length > 50) confidence = 'high';
    else if (r2 > 0.4 && readings.length > 20) confidence = 'medium';
    
    // Determine recommended collection window
    let recommendedWindow = 'normal';
    if (predictedFill >= 85) recommendedWindow = 'urgent';
    else if (predictedFill >= 70) recommendedWindow = 'soon';
    else if (predictedFill <= 20 && trend === 'decreasing') recommendedWindow = 'deferred';
    
    // Calculate fill rate per day
    const fillRatePerDay = slope * 24;
    
    // Time to reach 80% threshold
    let hoursToThreshold = null;
    if (slope > 0 && currentFill < 80) {
      hoursToThreshold = (80 - currentFill) / slope;
    } else if (currentFill >= 80) {
      hoursToThreshold = 0;
    }
    
    return {
      currentFillPercent: Math.round(currentFill * 10) / 10,
      predictedFillPercent: Math.round(predictedFill * 10) / 10,
      hoursAhead,
      trend,
      fillRatePerDay: Math.round(fillRatePerDay * 10) / 10,
      hoursTo80Percent: hoursToThreshold ? Math.round(hoursToThreshold * 10) / 10 : null,
      confidence,
      r2: Math.round(r2 * 100) / 100,
      recommendedWindow,
      dataPoints: readings.length,
      readingSpanDays: Math.round((readings[readings.length - 1].recordedAt - readings[0].recordedAt) / (1000 * 60 * 60 * 24)),
      lastReadingAt: readings[readings.length - 1].recordedAt
    };
    
  } catch (err) {
    logger.error('Forecasting error for apartment %s: %s', apartmentId, err.message);
    return {
      error: err.message,
      predictedFillPercent: null,
      confidence: 'error',
      trend: 'unknown',
      recommendedWindow: 'unknown'
    };
  }
};

/**
 * Get forecast for multiple apartments
 */
const getMultipleForecasts = async (apartmentIds, hoursAhead = 48) => {
  const results = await Promise.all(
    apartmentIds.map(async (id) => {
      const forecast = await predictFillLevel(id, hoursAhead);
      return { apartmentId: id, forecast };
    })
  );
  return results;
};

module.exports = {
  predictFillLevel,
  getMultipleForecasts,
  linearRegression
};