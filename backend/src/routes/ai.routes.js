const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const deepseekService = require('../services/deepseek.service');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');

router.use(protect);
router.use(authorize('county_admin', 'county_officer'));

// Natural language query endpoint
router.post('/query', async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json(new ApiResponse({ 
        success: false, 
        message: 'Question is required' 
      }));
    }

    const result = await processNaturalLanguageQuery(question);
    res.json(new ApiResponse({ data: result }));
  } catch (err) {
    next(err);
  }
});

// Helper: Process natural language queries using LLM + MongoDB
async function processNaturalLanguageQuery(question) {
  const q = question.toLowerCase();
  
  // Define query templates
  const templates = {
    // Collections queries
    'missed collections': async () => {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      return Collection.find({ 
        status: { $ne: 'completed' },
        scheduledDate: { $lt: new Date() }
      })
      .populate('apartment', 'name address')
      .sort({ scheduledDate: 1 })
      .limit(20);
    },
    'overdue collections': async () => {
      return Collection.find({ 
        status: 'scheduled',
        scheduledDate: { $lt: new Date() }
      })
      .populate('apartment', 'name address')
      .populate('wasteCollector', 'firstName lastName')
      .sort({ scheduledDate: 1 })
      .limit(20);
    },
    'completed collections': async () => {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      return Collection.find({ 
        status: 'completed',
        completedAt: { $gte: date }
      })
      .populate('apartment', 'name')
      .populate('wasteCollector', 'firstName lastName')
      .sort({ completedAt: -1 })
      .limit(20);
    },
    
    // Complaints queries
    'complaints': async () => {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      return Complaint.find({ createdAt: { $gte: date } })
      .populate('apartment', 'name')
      .populate('resident', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20);
    },
    'unresolved complaints': async () => {
      return Complaint.find({ status: { $ne: 'resolved' } })
      .populate('apartment', 'name')
      .populate('resident', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(20);
    },
    'high priority complaints': async () => {
      return Complaint.find({ priority: { $in: ['high', 'critical'] } })
      .populate('apartment', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    },
    
    // Apartments queries
    'apartments': async () => {
      return Apartment.find({ isActive: true })
      .populate('landlord', 'firstName lastName')
      .populate('wasteCollector', 'firstName lastName')
      .limit(50);
    },
    'apartments without collector': async () => {
      return Apartment.find({ 
        isActive: true, 
        wasteCollector: { $exists: false } 
      }).limit(50);
    },
    
    // Collector queries
    'collectors': async () => {
      return User.find({ role: 'waste_collector', isActive: true })
      .select('firstName lastName email')
      .limit(50);
    },
    'collector performance': async () => {
      const collectors = await User.find({ role: 'waste_collector', isActive: true });
      const results = await Promise.all(collectors.map(async (c) => {
        const collections = await Collection.find({ 
          wasteCollector: c._id,
          status: 'completed',
          'verificationScore.total': { $exists: true }
        }).select('verificationScore');
        
        const avgScore = collections.length > 0 
          ? collections.reduce((a, b) => a + (b.verificationScore?.total || 0), 0) / collections.length
          : 0;
        
        return {
          collectorId: c._id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          completedCollections: collections.length,
          avgVerificationScore: Math.round(avgScore * 10) / 10
        };
      }));
      return results.sort((a, b) => b.avgVerificationScore - a.avgVerificationScore);
    },
    
    // Stats queries
    'stats': async () => {
      const [totalApts, totalCollections, totalComplaints, activeCollectors] = await Promise.all([
        Apartment.countDocuments({ isActive: true }),
        Collection.countDocuments({}),
        Complaint.countDocuments({}),
        User.countDocuments({ role: 'waste_collector', isActive: true })
      ]);
      return { totalApartments: totalApts, totalCollections, totalComplaints, activeCollectors };
    }
  };

  // Match question to template
  let matchedTemplate = null;
  for (const [key, fn] of Object.entries(templates)) {
    const keywords = key.split(' ');
    if (keywords.every(k => q.includes(k))) {
      matchedTemplate = fn;
      break;
    }
  }

  if (matchedTemplate) {
    const data = await matchedTemplate();
    return {
      question,
      matched: true,
      type: 'template',
      resultCount: Array.isArray(data) ? data.length : 1,
      data
    };
  }

  // Fallback: Use LLM to interpret the question
  try {
    const prompt = `You are a waste management data analyst. The user asked: "${question}"

Available data:
- Collections: scheduledDate, status, apartment, wasteCollector, verificationScore
- Complaints: type, status, priority, apartment, resident, createdAt
- Apartments: name, address, landlord, wasteCollector, isActive
- Users: role, firstName, lastName, email

Return a MongoDB query that answers this question. Only return the query object, no explanation.
If the question cannot be answered with available data, return { "error": "Cannot answer with available data" }.`;

    const raw = await deepseekService.callDeepSeek([
      { role: 'system', content: 'You are a MongoDB query generator. Return only valid JSON queries.' },
      { role: 'user', content: prompt }
    ], 500);

    const parsed = deepseekService.safeParseJSON(raw);
    if (parsed && !parsed.error) {
      // This is a safety risk - in production, validate the query structure
      return {
        question,
        matched: false,
        type: 'llm_generated',
        query: parsed,
        note: 'Query generated by LLM - validate before executing'
      };
    }
  } catch (err) {
    // Ignore LLM errors, return helpful message
  }

  return {
    question,
    matched: false,
    type: 'help',
    message: 'Could not understand query. Try: "show overdue collections", "unresolved complaints", "collector performance", "apartments without collector", "recent stats"',
    examples: [
      'Show overdue collections',
      'List unresolved complaints',
      'Show collector performance',
      'Apartments without collector',
      'Recent stats'
    ]
  };
}

module.exports = router;
