const forecastingService = require('../src/services/forecasting.service');

// Mock the models
jest.mock('../src/models/SensorReading');
jest.mock('../src/models/Apartment');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const SensorReading = require('../src/models/SensorReading');
const Apartment = require('../src/models/Apartment');

describe('Forecasting Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockQuery = (readings) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(readings) })
  });

  describe('predictFillLevel', () => {
    it('should return insufficient_data when < 10 readings', async () => {
      SensorReading.find.mockReturnValue(createMockQuery([
        { fillLevelPercent: 50, recordedAt: new Date() }
      ]));

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.confidence).toBe('insufficient_data');
      expect(result.message).toContain('Only 1 readings');
    });

    it('should predict fill level with sufficient data', async () => {
      const now = new Date();
      const readings = Array.from({ length: 20 }, (_, i) => ({
        fillLevelPercent: 10 + i * 3, // increasing trend
        recordedAt: new Date(now.getTime() - (19 - i) * 3600000) // hourly
      }));

      SensorReading.find.mockReturnValue(createMockQuery(readings));

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.currentFillPercent).toBe(67);
      expect(result.predictedFillPercent).toBeGreaterThan(67);
      expect(result.trend).toBe('increasing');
      expect(['low', 'medium', 'high']).toContain(result.confidence);
      expect(['urgent', 'soon', 'normal', 'deferred']).toContain(result.recommendedWindow);
    });

    it('should detect decreasing trend', async () => {
      const now = new Date();
      const readings = Array.from({ length: 20 }, (_, i) => ({
        fillLevelPercent: 80 - i * 2, // decreasing trend
        recordedAt: new Date(now.getTime() - (19 - i) * 3600000)
      }));

      SensorReading.find.mockReturnValue(createMockQuery(readings));

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.trend).toBe('decreasing');
      expect(result.fillRatePerDay).toBeLessThan(0);
    });

    it('should recommend urgent when predicted > 85%', async () => {
      const now = new Date();
      const readings = Array.from({ length: 30 }, (_, i) => ({
        fillLevelPercent: 70 + i * 0.5, // will exceed 85% in 48h
        recordedAt: new Date(now.getTime() - (29 - i) * 3600000)
      }));

      SensorReading.find.mockReturnValue(createMockQuery(readings));

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.recommendedWindow).toBe('urgent');
    });

    it('should calculate hours to 80% threshold', async () => {
      const now = new Date();
      const readings = Array.from({ length: 20 }, (_, i) => ({
        fillLevelPercent: 30 + i * 2, // 30% to 68%
        recordedAt: new Date(now.getTime() - (19 - i) * 3600000)
      }));

      SensorReading.find.mockReturnValue(createMockQuery(readings));

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.hoursTo80Percent).toBeGreaterThan(0);
    });

    it('should return error on DB failure', async () => {
      SensorReading.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('DB Error')) })
      });

      const result = await forecastingService.predictFillLevel('apt123', 48);
      
      expect(result.confidence).toBe('error');
      expect(result.error).toBe('DB Error');
    });
  });

  describe('getMultipleForecasts', () => {
    it('should return forecasts for multiple apartments', async () => {
      Apartment.find.mockResolvedValue([
        { _id: 'apt1', name: 'Apt 1', location: { coordinates: [36.8, -1.3] } },
        { _id: 'apt2', name: 'Apt 2', location: { coordinates: [36.9, -1.4] } }
      ]);

      SensorReading.find.mockReturnValue(createMockQuery(
        Array.from({ length: 20 }, (_, i) => ({
          fillLevelPercent: 20 + i,
          recordedAt: new Date(Date.now() - (19 - i) * 3600000)
        }))
      ));

      const results = await forecastingService.getMultipleForecasts(['apt1', 'apt2'], 48);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('apartmentId');
      expect(results[0]).toHaveProperty('forecast');
    });
  });

  describe('linearRegression', () => {
    it('should calculate slope and intercept', () => {
      const data = [
        { x: 0, y: 10 },
        { x: 1, y: 12 },
        { x: 2, y: 14 },
        { x: 3, y: 16 }
      ];

      const result = forecastingService.linearRegression(data);
      
      expect(result.slope).toBeCloseTo(2);
      expect(result.intercept).toBeCloseTo(10);
      expect(result.r2).toBeCloseTo(1);
    });

    it('should handle flat line', () => {
      const data = [
        { x: 0, y: 10 },
        { x: 1, y: 10 },
        { x: 2, y: 10 }
      ];

      const result = forecastingService.linearRegression(data);
      
      expect(result.slope).toBeCloseTo(0);
      expect(result.r2).toBeCloseTo(1);
    });

    it('should return zero slope for single point', () => {
      const result = forecastingService.linearRegression([{ x: 1, y: 2 }]);
      
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(2);
    });
  });
});