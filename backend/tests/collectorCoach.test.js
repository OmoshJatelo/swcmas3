const collectorCoachService = require('../src/services/collectorCoach.service');
const Collection = require('../src/models/Collection');
const deepseekService = require('../src/services/deepseek.service');

jest.mock('../src/models/Collection');
jest.mock('../src/services/deepseek.service');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Collector Coach Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockQuery = (collections) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(collections) })
  });

  describe('getCollectorCoachTips', () => {
    it('should return fallback tips when insufficient data', async () => {
      Collection.find.mockReturnValue(createMockQuery([]));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.focusArea).toBe('consistency');
      expect(result.tips).toHaveLength(3);
      expect(result.dataPoints).toBe(0);
    });

    it('should return basic tips when few collections (< 5)', async () => {
      Collection.find.mockReturnValue(createMockQuery([
        { verificationScore: { gps: 10, timeSpent: 10, landlord: 10, resident: 10, sensor: 10, total: 50 } },
        { verificationScore: { gps: 12, timeSpent: 12, landlord: 12, resident: 12, sensor: 12, total: 60 } },
        { verificationScore: { gps: 8, timeSpent: 8, landlord: 8, resident: 8, sensor: 8, total: 40 } },
        { verificationScore: { gps: 15, timeSpent: 15, landlord: 15, resident: 15, sensor: 15, total: 75 } },
      ]));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.dataPoints).toBe(4);
      expect(result.tips).toContainEqual(expect.stringContaining('Complete more collections'));
    });

    it('should identify weakest area and generate targeted tips (GPS)', async () => {
      // Create 10 collections with GPS being the weakest (avg 5) vs others avg 15
      const collections = Array.from({ length: 10 }, () => ({
        verificationScore: {
          gps: 5,
          timeSpent: 15,
          landlord: 16,
          resident: 14,
          sensor: 17,
          total: 67
        }
      }));

      Collection.find.mockReturnValue(createMockQuery(collections));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.focusArea).toBe('gps');
      expect(result.weakestScore).toBe(5);
      expect(result.tips[0]).toContain('50m');
      expect(result.tips[1]).toContain('high-accuracy');
    });

    it('should identify timeSpent as weakest when lowest', async () => {
      const collections = Array.from({ length: 8 }, () => ({
        verificationScore: {
          gps: 18,
          timeSpent: 6,
          landlord: 17,
          resident: 15,
          sensor: 16,
          total: 72
        }
      }));

      Collection.find.mockReturnValue(createMockQuery(collections));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.focusArea).toBe('timeSpent');
      expect(result.weakestScore).toBe(6);
      expect(result.tips[0]).toContain('20-30 minutes');
    });

    it('should identify landlord as weakest when lowest', async () => {
      const collections = Array.from({ length: 8 }, () => ({
        verificationScore: {
          gps: 15,
          timeSpent: 15,
          landlord: 4,
          resident: 14,
          sensor: 16,
          total: 64
        }
      }));

      Collection.find.mockReturnValue(createMockQuery(collections));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.focusArea).toBe('landlord');
      expect(result.weakestScore).toBe(4);
      expect(result.tips[0]).toContain('Notify the landlord');
    });

    it('should identify sensor as weakest when lowest', async () => {
      const collections = Array.from({ length: 8 }, () => ({
        verificationScore: {
          gps: 15,
          timeSpent: 15,
          landlord: 15,
          resident: 15,
          sensor: 3,
          total: 63
        }
      }));

      Collection.find.mockReturnValue(createMockQuery(collections));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.focusArea).toBe('sensor');
      expect(result.weakestScore).toBe(3);
      expect(result.tips[0]).toContain('sensor fill level');
    });

    it('should include averages and dataPoints in result', async () => {
      const collections = Array.from({ length: 10 }, () => ({
        verificationScore: {
          gps: 10,
          timeSpent: 12,
          landlord: 14,
          resident: 11,
          sensor: 13,
          total: 60
        }
      }));

      Collection.find.mockReturnValue(createMockQuery(collections));

      const result = await collectorCoachService.getCollectorCoachTips('collector123');
      
      expect(result.averages).toHaveProperty('gps');
      expect(result.averages).toHaveProperty('timeSpent');
      expect(result.averages).toHaveProperty('landlord');
      expect(result.averages).toHaveProperty('resident');
      expect(result.averages).toHaveProperty('sensor');
      expect(result.dataPoints).toBe(10);
      expect(result.encouragement).toBeDefined();
    });
  });
});