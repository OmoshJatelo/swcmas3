// Mock config BEFORE any other imports - must be at the very top
jest.mock('../src/config', () => ({
  maxCollectionsPerCollectorDay: 10,
  deepseek: { apiKey: 'test', apiUrl: 'test' },
  roles: {
    COUNTY_ADMIN: 'county_admin',
    COUNTY_OFFICER: 'county_officer',
    LANDLORD: 'landlord',
    WASTE_COLLECTOR: 'waste_collector',
    RESIDENT: 'resident'
  }
}), { virtual: true });

const assignmentService = require('../src/services/assignment.service');

jest.mock('../src/models/User');
jest.mock('../src/models/Collection');
jest.mock('../src/utils/helpers', () => ({
  haversineDistance: jest.fn((lat1, lon1, lat2, lon2) => {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2)) * 111;
  })
}));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const User = require('../src/models/User');
const Collection = require('../src/models/Collection');

describe('Assignment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreCollectorForComplaint', () => {
    it('should return score for a collector', async () => {
      const collector = {
        _id: 'c1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        workload: 2,
        zone: { lat: -1.3, lng: 36.8, apartmentCount: 5 },
        avgVerificationScore: 80
      };

      const complaint = {
        location: { lat: -1.3, lng: 36.8 },
        apartment: {
          location: { coordinates: [36.8, -1.3] }
        }
      };

      const result = await assignmentService.scoreCollectorForComplaint(collector, complaint);
      
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('factors');
      expect(typeof result.totalScore).toBe('number');
      expect(result.factors).toHaveProperty('proximity');
      expect(result.factors).toHaveProperty('workload');
      expect(result.factors).toHaveProperty('performance');
      expect(result.factors).toHaveProperty('zoneFamiliarity');
    });

    it('should give higher score for closer collector', async () => {
      const complaint = {
        location: { lat: -1.3, lng: 36.8 },
        apartment: {
          location: { coordinates: [36.8, -1.3] }
        }
      };

      const closeCollector = {
        _id: 'c1',
        workload: 5,
        zone: { lat: -1.31, lng: 36.81, apartmentCount: 5 },
        avgVerificationScore: 70
      };

      const farCollector = {
        _id: 'c2',
        workload: 5,
        zone: { lat: -2.0, lng: 37.0, apartmentCount: 5 },
        avgVerificationScore: 70
      };

      const closeResult = await assignmentService.scoreCollectorForComplaint(closeCollector, complaint);
      const farResult = await assignmentService.scoreCollectorForComplaint(farCollector, complaint);
      
      // Close collector should have higher proximity score
      expect(closeResult.factors.proximity).toBeGreaterThan(farResult.factors.proximity);
    });

    it('should give higher score for lower workload', async () => {
      const complaint = {
        location: { lat: -1.3, lng: 36.8 },
        apartment: { location: { coordinates: [36.8, -1.3] } }
      };

      const lowWorkloadCollector = {
        _id: 'c1',
        workload: 2,
        zone: { lat: -1.3, lng: 36.8, apartmentCount: 5 },
        avgVerificationScore: 70
      };

      const highWorkloadCollector = {
        _id: 'c2',
        workload: 8,
        zone: { lat: -1.3, lng: 36.8, apartmentCount: 5 },
        avgVerificationScore: 70
      };

      const lowResult = await assignmentService.scoreCollectorForComplaint(lowWorkloadCollector, complaint);
      const highResult = await assignmentService.scoreCollectorForComplaint(highWorkloadCollector, complaint);
      
      expect(lowResult.factors.workload).toBeGreaterThan(highResult.factors.workload);
    });
  });
});