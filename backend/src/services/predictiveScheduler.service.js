const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const forecastingService = require('./forecasting.service');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Predict optimal collection dates for an apartment based on fill-level trends
 */
const predictOptimalCollectionDates = async (apartmentId, daysAhead = 14) => {
  try {
    const apartment = await Apartment.findById(apartmentId).lean();
    if (!apartment || !apartment.wasteCollector) {
      return { recommendations: [], message: 'Apartment not found or no collector assigned' };
    }

    // Get fill-level forecast
    const forecast = await forecastingService.predictFillLevel(apartmentId, daysAhead * 24);
    if (!forecast.predictedFillPercent || forecast.confidence === 'error') {
      return { recommendations: [], message: 'Insufficient data for prediction' };
    }

    // Get historical collection pattern
    const collections = await Collection.find({
      apartment: apartmentId,
      status: { $in: ['completed', 'verified'] }
    })
    .select('scheduledDate completedAt')
    .sort({ scheduledDate: -1 })
    .limit(20)
    .lean();

    // Calculate average interval between collections
    let avgIntervalDays = 7; // default weekly
    if (collections.length >= 2) {
      const intervals = [];
      for (let i = 1; i < collections.length; i++) {
        const diff = (collections[i-1].scheduledDate - collections[i].scheduledDate) / (1000 * 60 * 60 * 24);
        if (diff > 0 && diff < 30) intervals.push(diff);
      }
      if (intervals.length > 0) {
        avgIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }
    }

    const recommendations = [];
    const now = new Date();
    const lastCollection = collections[0]?.completedAt || collections[0]?.scheduledDate || now;

    // Generate recommendations based on fill-level trend
    if (forecast.recommendedWindow === 'urgent') {
      // Recommend immediate collection
      const urgentDate = new Date(now);
      urgentDate.setHours(8, 0, 0, 0);
      if (urgentDate <= now) urgentDate.setDate(urgentDate.getDate() + 1);
      
      recommendations.push({
        type: 'urgent',
        suggestedDate: urgentDate,
        reason: `Predicted fill level ${forecast.predictedFillPercent}% exceeds 80% threshold`,
        confidence: forecast.confidence,
        priority: 'high'
      });
    } else if (forecast.recommendedWindow === 'soon') {
      // Recommend within 2 days
      const soonDate = new Date(now);
      soonDate.setDate(soonDate.getDate() + 2);
      soonDate.setHours(8, 0, 0, 0);
      
      recommendations.push({
        type: 'soon',
        suggestedDate: soonDate,
        reason: `Predicted fill level ${forecast.predictedFillPercent}% approaching 80% threshold`,
        confidence: forecast.confidence,
        priority: 'medium'
      });
    } else if (forecast.recommendedWindow === 'normal') {
      // Follow regular schedule but optimize
      const nextScheduled = new Date(lastCollection);
      nextScheduled.setDate(nextScheduled.getDate() + Math.round(avgIntervalDays));
      nextScheduled.setHours(8, 0, 0, 0);
      
      // If prediction suggests we can wait longer, suggest that
      if (forecast.trend === 'decreasing' && forecast.predictedFillPercent < 30) {
        nextScheduled.setDate(nextScheduled.getDate() + 1);
      }
      
      recommendations.push({
        type: 'scheduled',
        suggestedDate: nextScheduled,
        reason: `Regular schedule (${Math.round(avgIntervalDays)} day interval). Predicted fill: ${forecast.predictedFillPercent}%`,
        confidence: forecast.confidence,
        priority: 'normal'
      });
    } else {
      // Deferred - bin is emptying slower than expected
      const deferredDate = new Date(lastCollection);
      deferredDate.setDate(deferredDate.getDate() + Math.round(avgIntervalDays) + 1);
      deferredDate.setHours(8, 0, 0, 0);
      
      recommendations.push({
        type: 'deferred',
        suggestedDate: deferredDate,
        reason: `Fill level decreasing (${forecast.predictedFillPercent}% predicted). Can extend interval.`,
        confidence: forecast.confidence,
        priority: 'low'
      });
    }

    return {
      apartmentId,
      apartmentName: apartment.name,
      currentSchedule: apartment.collectionSchedule,
      avgIntervalDays: Math.round(avgIntervalDays * 10) / 10,
      forecast,
      recommendations
    };

  } catch (err) {
    logger.error('Predictive scheduling failed for apartment %s: %s', apartmentId, err.message);
    return { recommendations: [], error: err.message };
  }
};

/**
 * Generate optimized schedule for all apartments
 */
const generateOptimizedSchedule = async (daysAhead = 14) => {
  const apartments = await Apartment.find({ 
    isActive: true,
    wasteCollector: { $exists: true }
  }).select('_id name wasteCollector collectionSchedule').lean();

  const results = await Promise.all(
    apartments.map(async (apt) => {
      const prediction = await predictOptimalCollectionDates(apt._id, daysAhead);
      return {
        apartmentId: apt._id,
        apartmentName: apt.name,
        collectorId: apt.wasteCollector,
        ...prediction
      };
    })
  );

  // Group by collector for workload balancing
  const byCollector = {};
  results.forEach(r => {
    if (r.recommendations?.length > 0) {
      const collectorId = r.collectorId.toString();
      if (!byCollector[collectorId]) byCollector[collectorId] = [];
      byCollector[collectorId].push({
        apartmentId: r.apartmentId,
        apartmentName: r.apartmentName,
        ...r.recommendations[0]
      });
    }
  });

  // Check for collector overload
  const maxPerDay = config.maxCollectionsPerCollectorDay || 10;
  const overloadWarnings = [];
  
  Object.entries(byCollector).forEach(([collectorId, tasks]) => {
    const byDate = {};
    tasks.forEach(task => {
      const dateStr = task.suggestedDate.toISOString().split('T')[0];
      if (!byDate[dateStr]) byDate[dateStr] = 0;
      byDate[dateStr]++;
    });
    
    Object.entries(byDate).forEach(([date, count]) => {
      if (count > maxPerDay) {
        overloadWarnings.push({
          collectorId,
          date,
          scheduledCount: count,
          maxAllowed: maxPerDay
        });
      }
    });
  });

  return {
    generatedAt: new Date(),
    apartmentCount: results.length,
    recommendations: results,
    byCollector,
    overloadWarnings,
    summary: {
      urgent: results.filter(r => r.recommendations?.[0]?.type === 'urgent').length,
      soon: results.filter(r => r.recommendations?.[0]?.type === 'soon').length,
      scheduled: results.filter(r => r.recommendations?.[0]?.type === 'scheduled').length,
      deferred: results.filter(r => r.recommendations?.[0]?.type === 'deferred').length
    }
  };
};

/**
 * Apply optimized schedule (create collection entries)
 */
const applyOptimizedSchedule = async (optimizedSchedule, dryRun = true) => {
  const created = [];
  const errors = [];

  for (const aptResult of optimizedSchedule.recommendations) {
    if (!aptResult.recommendations?.length) continue;
    
    const rec = aptResult.recommendations[0];
    if (rec.type !== 'urgent' && rec.type !== 'soon') continue; // Only apply urgent/soon for now

    try {
      const existing = await Collection.findOne({
        apartment: aptResult.apartmentId,
        scheduledDate: {
          $gte: new Date(rec.suggestedDate.getFullYear(), rec.suggestedDate.getMonth(), rec.suggestedDate.getDate()),
          $lt: new Date(rec.suggestedDate.getFullYear(), rec.suggestedDate.getMonth(), rec.suggestedDate.getDate() + 1)
        }
      });

      if (existing) {
        errors.push({ apartmentId: aptResult.apartmentId, reason: 'Already scheduled' });
        continue;
      }

      if (!dryRun) {
        const collection = new Collection({
          apartment: aptResult.apartmentId,
          wasteCollector: aptResult.collectorId,
          status: 'scheduled',
          scheduledDate: rec.suggestedDate,
          notes: `AI-suggested: ${rec.reason}`
        });
        await collection.save();
        created.push(collection);
      } else {
        created.push({ apartmentId: aptResult.apartmentId, suggestedDate: rec.suggestedDate, type: rec.type });
      }
    } catch (err) {
      errors.push({ apartmentId: aptResult.apartmentId, error: err.message });
    }
  }

  return { created: created.length, errors: errors.length, details: { created, errors } };
};

module.exports = {
  predictOptimalCollectionDates,
  generateOptimizedSchedule,
  applyOptimizedSchedule
};