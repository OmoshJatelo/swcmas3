const deepseekService = require('../src/services/deepseek.service');

jest.mock('../src/config', () => ({
  deepseek: { apiKey: 'test', apiUrl: 'test' }
}));
jest.mock('axios');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('DeepSeek Service - Anomaly Playbook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAnomalyPlaybook', () => {
    it('should generate playbook for anomaly alert', async () => {
      const mockAlert = {
        type: 'collection_gap',
        severity: 'high',
        entityType: 'Apartment',
        entityId: 'apt123',
        description: 'No completed collections for 7 days',
        details: { daysSinceLastCollection: 7 }
      };

      const mockLLMResponse = JSON.stringify({
        rootCause: 'Collector schedule not updated after route change',
        immediateSteps: [
          'Contact assigned collector to verify status',
          'Check if apartment was reassigned to another collector',
          'Schedule emergency collection within 24 hours'
        ],
        preventionTips: [
          'Update collector schedules when routes change',
          'Set up automated alerts for collection gaps > 3 days'
        ],
        estimatedResolutionTime: '2-4 hours',
        escalationPath: 'Escalate to County Officer if not resolved in 24 hours'
      });

      // Since generateAnomalyPlaybook uses callDeepSeek internally,
      // we test it by calling the actual function with mocked axios
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: mockLLMResponse } }]
        }
      });

      const result = await deepseekService.generateAnomalyPlaybook(mockAlert);
      
      expect(result.rootCause).toBe('Collector schedule not updated after route change');
      expect(result.immediateSteps).toHaveLength(3);
      expect(result.preventionTips).toHaveLength(2);
      expect(result.estimatedResolutionTime).toBe('2-4 hours');
      expect(result.escalationPath).toContain('County Officer');
    });

    it('should return fallback when LLM fails', async () => {
      const mockAlert = {
        type: 'sensor_tamper',
        severity: 'high',
        entityType: 'Apartment',
        entityId: 'apt456',
        description: 'Sensor fill level jumped +45%',
        details: { delta: 45 }
      };

      const axios = require('axios');
      axios.post.mockRejectedValue(new Error('API timeout'));

      const result = await deepseekService.generateAnomalyPlaybook(mockAlert);
      
      expect(result.rootCause).toBe('Unable to determine root cause automatically.');
      expect(result.immediateSteps).toContain('Investigate the anomaly manually.');
      expect(result.preventionTips).toContain('Review collection schedules for gaps.');
      expect(result.escalationPath).toContain('County Officer');
    });

    it('should handle malformed JSON response', async () => {
      const mockAlert = {
        type: 'repeated_complaints',
        severity: 'medium',
        entityType: 'Apartment',
        entityId: 'apt789',
        description: '5 complaints in 30 days',
        details: { complaintCount: 5 }
      };

      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'not valid json' } }]
        }
      });

      const result = await deepseekService.generateAnomalyPlaybook(mockAlert);
      
      expect(result.rootCause).toBe('Unable to determine root cause automatically.');
      expect(Array.isArray(result.immediateSteps)).toBe(true);
    });

    it('should handle partial LLM response', async () => {
      const mockAlert = {
        type: 'collector_performance',
        severity: 'critical',
        entityType: 'User',
        entityId: 'coll123',
        description: 'Collector has 75% dispute rate',
        details: { disputeRate: 0.75 }
      };

      const partialResponse = JSON.stringify({
        rootCause: 'Collector not following verification protocol',
        immediateSteps: ['Review recent disputed collections'],
        // missing preventionTips, estimatedResolutionTime, escalationPath
      });

      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: partialResponse } }]
        }
      });

      const result = await deepseekService.generateAnomalyPlaybook(mockAlert);
      
      expect(result.rootCause).toBe('Collector not following verification protocol');
      expect(result.immediateSteps).toHaveLength(1);
      expect(result.preventionTips).toEqual([
        'Review collection schedules for gaps.',
        'Ensure sensors are calibrated and online.'
      ]);
      expect(result.estimatedResolutionTime).toBe('Unknown');
      expect(result.escalationPath).toBe('Escalate to County Officer if unresolved after 24 hours.');
    });
  });

  describe('safeParseJSON', () => {
    it('should parse valid JSON', () => {
      const result = deepseekService.safeParseJSON('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from markdown code fences', () => {
      const result = deepseekService.safeParseJSON('```json\n{"key": "value"}\n```');
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract first JSON object from text', () => {
      const result = deepseekService.safeParseJSON('Here is the result: {"key": "value"} and more text');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid input', () => {
      expect(deepseekService.safeParseJSON(null)).toBeNull();
      expect(deepseekService.safeParseJSON('')).toBeNull();
      expect(deepseekService.safeParseJSON('not json')).toBeNull();
    });
  });
});