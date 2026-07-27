const Collection = require('../models/Collection');
const logger = require('../utils/logger');

/**
 * Generate personalized coach tips for a collector based on their verification score breakdown
 * @param {string} collectorId - Collector user ID
 * @returns {Object} Coach tips with focus area and actionable advice
 */
const getCollectorCoachTips = async (collectorId) => {
  // Get last 20 completed collections with verification scores
  const collections = await Collection.find({
    wasteCollector: collectorId,
    status: { $in: ['verified', 'completed'] },
    'verificationScore.total': { $exists: true }
  })
  .select('verificationScore')
  .sort({ completedAt: -1 })
  .limit(20)
  .lean();

  // Default tips if no data
  const fallback = {
    focusArea: 'consistency',
    tips: [
      'Start collections within 50m of the building entrance for better GPS scores.',
      'Aim to complete each stop in 20-30 minutes for optimal time scores.',
      'Wait for sensor fill level to drop below 20% before marking complete.'
    ],
    encouragement: 'Keep up the good work! Consistent habits build great scores.'
  };

  if (collections.length < 5) {
    return {
      ...fallback,
      tips: [
        'Complete more collections to unlock personalized AI coaching.',
        'Focus on GPS accuracy: start within 50m of the building.',
        'Take clear before/after photos for better verification.'
      ],
      dataPoints: collections.length
    };
  }

  // Calculate average scores for each component
  const scoreComponents = ['gps', 'timeSpent', 'landlord', 'resident', 'sensor'];
  const averages = {};
  
  scoreComponents.forEach(component => {
    const scores = collections
      .map(c => c.verificationScore?.[component])
      .filter(s => typeof s === 'number' && s !== undefined);
    
    averages[component] = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  });

  // Find weakest area
  const weakest = Object.entries(averages).sort((a, b) => a[1] - b[1])[0];
  const [focusArea, weakestScore] = weakest;

  // Generate targeted tips based on weakest area
  const tipMap = {
    gps: {
      tips: [
        'Start collection within 50m of the building entrance for maximum GPS score.',
        'Enable high-accuracy GPS mode on your device before starting.',
        'Wait for GPS signal to stabilize (green indicator) before tapping Start.'
      ],
      encouragement: 'GPS accuracy is the easiest score to improve with a small habit change.'
    },
    timeSpent: {
      tips: [
        'Target 20-30 minutes per stop. Too fast looks rushed, too slow triggers alerts.',
        'Pre-sort bins before arriving to reduce on-site time.',
        'Use the route optimizer in the dashboard to minimize travel between stops.'
      ],
      encouragement: 'Efficient timing shows professionalism — you\'re close to mastering this.'
    },
    landlord: {
      tips: [
        'Notify the landlord 1 hour before arrival via the in-app notification.',
        'Share the after-photo immediately after completing the collection.',
        'If landlord is unresponsive, escalate to county officer after 24 hours.'
      ],
      encouragement: 'Landlord verification is about communication — a quick message goes a long way.'
    },
    resident: {
      tips: [
        'Complete collections on schedule to avoid missed-collection complaints.',
        'Take clear before/after photos showing bin condition.',
        'Check for overflowing bins before marking complete — residents notice.'
      ],
      encouragement: 'Happy residents mean fewer complaints and better scores.'
    },
    sensor: {
      tips: [
        'Wait for sensor fill level to drop below 20% before marking collection complete.',
        'If sensor reads high after collection, double-check the bin was fully emptied.',
        'Report faulty sensors immediately — they affect your verification score.'
      ],
      encouragement: 'Sensor verification is the most objective score — nail this and you\'re golden.'
    }
  };

  const guidance = tipMap[focusArea] || tipMap.gps;

  // Add a general consistency tip
  const allTips = [
    ...guidance.tips.slice(0, 2),
    'Review your score breakdown daily in the dashboard to track progress.'
  ];

  return {
    focusArea,
    weakestScore: Math.round(weakestScore),
    tips: allTips,
    encouragement: guidance.encouragement,
    averages: Object.fromEntries(
      Object.entries(averages).map(([k, v]) => [k, Math.round(v)])
    ),
    dataPoints: collections.length
  };
};

module.exports = {
  getCollectorCoachTips
};