const mongoose = require('mongoose');
const config = require('../config');
const connectDB = require('../config/database');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const AnomalyAlert = require('../models/AnomalyAlert');
const Report = require('../models/Report');
const SensorReading = require('../models/SensorReading');
const logger = require('../utils/logger');

const seed = async () => {
  try {
    await connectDB();
    logger.info('Connected to MongoDB. Clearing existing data...');

    // Clear existing data
    await User.deleteMany({});
    await Apartment.deleteMany({});
    await Collection.deleteMany({});
    await Complaint.deleteMany({});
    await AnomalyAlert.deleteMany({});
    await Report.deleteMany({});
    await SensorReading.deleteMany({});

    const defaultPassword = 'Password@123';

    logger.info('Creating Users...');
    // --- USERS ---
    const usersData = [
      // Admins
      { firstName: 'Admin', lastName: 'System', email: 'admin@swcmas.com', password: defaultPassword, role: 'county_admin', isVerified: true },
      // Officers
      { firstName: 'John', lastName: 'Kamau', email: 'j.kamau@swcmas.com', password: defaultPassword, role: 'county_officer', isVerified: true },
      { firstName: 'Grace', lastName: 'Wanjiku', email: 'g.wanjiku@swcmas.com', password: defaultPassword, role: 'county_officer', isVerified: true },
      // Landlords
      { firstName: 'Peter', lastName: 'Ochieng', email: 'peter.o@example.com', password: defaultPassword, role: 'landlord', isVerified: true },
      { firstName: 'Mary', lastName: 'Mutua', email: 'mary.m@example.com', password: defaultPassword, role: 'landlord', isVerified: true },
      { firstName: 'David', lastName: 'Kiprono', email: 'david.k@example.com', password: defaultPassword, role: 'landlord', isVerified: true },
      { firstName: 'Sarah', lastName: 'Hassan', email: 'sarah.h@example.com', password: defaultPassword, role: 'landlord', isVerified: true },
      { firstName: 'Joseph', lastName: 'Njoroge', email: 'joseph.n@example.com', password: defaultPassword, role: 'landlord', isVerified: true },
      // Collectors
      { firstName: 'James', lastName: 'Mwangi', email: 'collector1@swcmas.com', password: defaultPassword, role: 'waste_collector', isVerified: true },
      { firstName: 'Alice', lastName: 'Achieng', email: 'collector2@swcmas.com', password: defaultPassword, role: 'waste_collector', isVerified: true },
      { firstName: 'Kevin', lastName: 'Otieno', email: 'collector3@swcmas.com', password: defaultPassword, role: 'waste_collector', isVerified: true },
      { firstName: 'Lucy', lastName: 'Wambui', email: 'collector4@swcmas.com', password: defaultPassword, role: 'waste_collector', isVerified: true },
      // Residents
      { firstName: 'Resident', lastName: 'One', email: 'res1@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Two', email: 'res2@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Three', email: 'res3@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Four', email: 'res4@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Five', email: 'res5@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Six', email: 'res6@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Seven', email: 'res7@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Eight', email: 'res8@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Nine', email: 'res9@example.com', password: defaultPassword, role: 'resident', isVerified: true },
      { firstName: 'Resident', lastName: 'Ten', email: 'res10@example.com', password: defaultPassword, role: 'resident', isVerified: true },
    ];

    const users = await User.create(usersData);

    const admin = users.find(u => u.role === 'county_admin');
    const officers = users.filter(u => u.role === 'county_officer');
    const landlords = users.filter(u => u.role === 'landlord');
    const collectors = users.filter(u => u.role === 'waste_collector');
    const residents = users.filter(u => u.role === 'resident');

    logger.info('Creating Apartments...');
    // --- APARTMENTS ---
    const apartmentsData = [
      { name: 'Sunrise Heights', address: 'Kilimani Ring Road', city: 'Nairobi', county: 'Nairobi', unitCount: 40, location: { type: 'Point', coordinates: [36.78, -1.29] }, landlord: landlords[0]._id, wasteCollector: collectors[0]._id, collectionSchedule: { frequency: 'weekly', time: '08:00', days: ['Monday', 'Thursday'] }, isVerified: true },
      { name: 'Oasis Residences', address: 'Westlands Close', city: 'Nairobi', county: 'Nairobi', unitCount: 65, location: { type: 'Point', coordinates: [36.80, -1.26] }, landlord: landlords[1]._id, wasteCollector: collectors[1]._id, collectionSchedule: { frequency: 'daily', time: '07:30' }, isVerified: true },
      { name: 'Kileleshwa Gardens', address: 'Kileleshwa Othaya Road', city: 'Nairobi', county: 'Nairobi', unitCount: 30, location: { type: 'Point', coordinates: [36.79, -1.28] }, landlord: landlords[2]._id, wasteCollector: collectors[2]._id, collectionSchedule: { frequency: 'every_other_day', time: '09:00' }, isVerified: true },
      { name: 'Lavington Villas', address: 'Lavington James Gichuru', city: 'Nairobi', county: 'Nairobi', unitCount: 25, location: { type: 'Point', coordinates: [36.77, -1.27] }, landlord: landlords[3]._id, wasteCollector: collectors[3]._id, collectionSchedule: { frequency: 'weekly', time: '08:00', days: ['Tuesday', 'Friday'] }, isVerified: true },
      { name: 'South B Apartments', address: 'South B Mukinduri', city: 'Nairobi', county: 'Nairobi', unitCount: 80, location: { type: 'Point', coordinates: [36.83, -1.31] }, landlord: landlords[4]._id, wasteCollector: collectors[0]._id, collectionSchedule: { frequency: 'daily', time: '10:00' }, isVerified: true },
      { name: 'Langata View', address: 'Langata Road', city: 'Nairobi', county: 'Nairobi', unitCount: 50, location: { type: 'Point', coordinates: [36.79, -1.32] }, landlord: landlords[0]._id, wasteCollector: collectors[1]._id, collectionSchedule: { frequency: 'every_other_day', time: '07:00' }, isVerified: true },
      { name: 'Ngong Road Flats', address: 'Ngong Road', city: 'Nairobi', county: 'Nairobi', unitCount: 120, location: { type: 'Point', coordinates: [36.76, -1.30] }, landlord: landlords[1]._id, wasteCollector: collectors[2]._id, collectionSchedule: { frequency: 'daily', time: '08:30' }, isVerified: true },
      { name: 'Parklands Court', address: 'Parklands 1st Ave', city: 'Nairobi', county: 'Nairobi', unitCount: 35, location: { type: 'Point', coordinates: [36.81, -1.26] }, landlord: landlords[2]._id, wasteCollector: collectors[3]._id, collectionSchedule: { frequency: 'weekly', time: '09:00', days: ['Wednesday', 'Saturday'] }, isVerified: true },
      { name: 'Upperhill Suites', address: 'Upper Hill Road', city: 'Nairobi', county: 'Nairobi', unitCount: 45, location: { type: 'Point', coordinates: [36.81, -1.29] }, landlord: landlords[3]._id, wasteCollector: collectors[0]._id, collectionSchedule: { frequency: 'daily', time: '06:30' }, isVerified: true },
      { name: 'Ruaka Gardens', address: 'Ruaka Limuru Road', city: 'Kiambu', county: 'Kiambu', unitCount: 90, location: { type: 'Point', coordinates: [36.77, -1.21] }, landlord: landlords[4]._id, wasteCollector: collectors[1]._id, collectionSchedule: { frequency: 'every_other_day', time: '08:00' }, isVerified: true },
      { name: 'Thika Greens', address: 'Thika Road', city: 'Kiambu', county: 'Kiambu', unitCount: 200, location: { type: 'Point', coordinates: [37.06, -1.03] }, landlord: landlords[0]._id, wasteCollector: collectors[2]._id, collectionSchedule: { frequency: 'daily', time: '09:00' }, isVerified: true },
      { name: 'Syokimau Estate', address: 'Mombasa Road', city: 'Machakos', county: 'Machakos', unitCount: 150, location: { type: 'Point', coordinates: [36.93, -1.37] }, landlord: landlords[1]._id, wasteCollector: collectors[3]._id, collectionSchedule: { frequency: 'weekly', time: '10:00', days: ['Monday', 'Thursday'] }, isVerified: true },
      { name: 'Kitengela Palms', address: 'Namanga Road', city: 'Kajiado', county: 'Kajiado', unitCount: 110, location: { type: 'Point', coordinates: [36.95, -1.48] }, landlord: landlords[2]._id, wasteCollector: collectors[0]._id, collectionSchedule: { frequency: 'every_other_day', time: '07:30' }, isVerified: true },
      { name: 'Karen Villas', address: 'Karen Road', city: 'Nairobi', county: 'Nairobi', unitCount: 20, location: { type: 'Point', coordinates: [36.72, -1.33] }, landlord: landlords[3]._id, wasteCollector: collectors[1]._id, collectionSchedule: { frequency: 'weekly', time: '11:00', days: ['Friday'] }, isVerified: true },
      { name: 'Roysambu Flats', address: 'Thika Road', city: 'Nairobi', county: 'Nairobi', unitCount: 300, location: { type: 'Point', coordinates: [36.88, -1.21] }, landlord: landlords[4]._id, wasteCollector: collectors[2]._id, collectionSchedule: { frequency: 'daily', time: '06:00' }, isVerified: true },
    ];

    const apartments = await Apartment.create(apartmentsData);

    // =============================================
    // SENSOR READINGS — seed realistic history
    // =============================================
    logger.info('Creating Sensor Readings...');
    const sensorReadings = [];
    const BIN_HEIGHT = 100; // 100 cm standard bin

    // For each apartment, create readings over the past 7 days (every ~6 hours)
    for (const apt of apartments) {
      const fillBase = 20 + Math.random() * 60; // base fill 20-80%
      for (let hoursAgo = 7 * 24; hoursAgo >= 0; hoursAgo -= 6) {
        // Fill level gradually rises over time (waste accumulates), with some noise
        const fillDrift = Math.min(95, fillBase + (7 * 24 - hoursAgo) * 0.3 + (Math.random() - 0.5) * 10);
        const fillClamped = Math.max(0, Math.min(100, fillDrift));
        const rawDistance = BIN_HEIGHT * (1 - fillClamped / 100);
        const recordedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        sensorReadings.push({
          apartment: apt._id,
          rawDistanceCm: Math.round(rawDistance * 10) / 10,
          binHeightCm: BIN_HEIGHT,
          fillLevelPercent: Math.round(fillClamped * 10) / 10,
          recordedAt,
          deviceId: `ESP32-${apt.name.replace(/\s+/g, '-').substring(0, 12).toUpperCase()}`,
          batteryVoltage: 3.3 + Math.random() * 0.6,
        });
      }
    }

    const insertedSensorReadings = await SensorReading.insertMany(sensorReadings);
    logger.info(`Inserted ${insertedSensorReadings.length} sensor readings`);

    // Build a quick lookup: apartmentId -> latest sensor reading _id
    const latestSensorByApt = {};
    for (const sr of insertedSensorReadings) {
      const aptKey = sr.apartment.toString();
      if (!latestSensorByApt[aptKey] || sr.recordedAt > latestSensorByApt[aptKey].recordedAt) {
        latestSensorByApt[aptKey] = sr;
      }
    }

    // =============================================
    // COLLECTIONS — with sensor-based verification
    // =============================================
    logger.info('Creating Collections...');
    const collectionsData = [];
    const now = new Date();

    // Generate history over the last 14 days
    for (let i = 0; i < 50; i++) {
      const apt = apartments[Math.floor(Math.random() * apartments.length)];
      const collector = apt.wasteCollector;
      const daysAgo = Math.floor(Math.random() * 14);
      const scheduledDate = new Date(now);
      scheduledDate.setDate(now.getDate() - daysAgo);
      scheduledDate.setHours(1 + Math.floor(Math.random() * 4), 0, 0, 0);

      let status = 'completed';
      let verificationStatus = 'pending';
      let verificationScore = {};

      const rand = Math.random();
      if (daysAgo === 0) {
        // Today's collections: make half in_progress, half scheduled
        status = rand > 0.5 ? 'scheduled' : 'in_progress';
      } else {
        if (rand > 0.8) {
          verificationStatus = 'disputed';
          status = 'disputed';
          verificationScore = { gps: 10, timeSpent: 5, landlord: 0, resident: 0, sensor: 0, total: 15 };
        } else if (rand > 0.2) {
          verificationStatus = 'verified';
          // Sensor-verified collections get a high sensor score
          const sensorScore = 15 + Math.floor(Math.random() * 6); // 15-20
          verificationScore = { gps: 20, timeSpent: 18, landlord: 20, resident: 20, sensor: sensorScore, total: 78 + sensorScore };
        } else {
          verificationStatus = 'pending';
        }
      }

      const col = {
        apartment: apt._id,
        wasteCollector: collector,
        status,
        scheduledDate,
        createdAt: new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000),
        verificationStatus,
        verificationScore: status === 'completed' || status === 'verified' || status === 'disputed' ? verificationScore : undefined,
      };

      if (status !== 'scheduled') {
        col.startTime = new Date(scheduledDate.getTime() + Math.random() * 30 * 60 * 1000);
        col.startLocation = { lat: apt.location.coordinates[1] + (Math.random() * 0.001), lng: apt.location.coordinates[0] + (Math.random() * 0.001) };

        // Link a pre-sensor reading for in_progress collections
        const aptKey = apt._id.toString();
        if (latestSensorByApt[aptKey]) {
          col.preSensorReadingId = latestSensorByApt[aptKey]._id;
        }

        if (status !== 'in_progress') {
          col.timeSpentMinutes = 15 + Math.floor(Math.random() * 30);
          col.endTime = new Date(col.startTime.getTime() + col.timeSpentMinutes * 60 * 1000);
          col.endLocation = { lat: apt.location.coordinates[1] + (Math.random() * 0.001), lng: apt.location.coordinates[0] + (Math.random() * 0.001) };

          // Completed collections get both sensor readings and a fill delta
          if (latestSensorByApt[aptKey]) {
            col.postSensorReadingId = latestSensorByApt[aptKey]._id;
            col.fillDeltaPercent = 55 + Math.floor(Math.random() * 40); // 55-94% drop
            col.sensorVerified = col.fillDeltaPercent >= 60;
          }

          if (verificationStatus === 'verified' || verificationStatus === 'disputed') {
            col.confirmedBy = apt.landlord;
            col.confirmedAt = new Date(col.endTime.getTime() + Math.random() * 24 * 60 * 60 * 1000);
          }
        }
      }
      collectionsData.push(col);
    }

    // Add some scheduled for tomorrow
    for (let i = 0; i < 5; i++) {
      const apt = apartments[i];
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      collectionsData.push({
        apartment: apt._id,
        wasteCollector: apt.wasteCollector,
        status: 'scheduled',
        scheduledDate: tomorrow,
        createdAt: now
      });
    }

    const insertedCollections = await Collection.insertMany(collectionsData);

    // =============================================
    // Print in_progress collection IDs for testing
    // =============================================
    const inProgressCollections = insertedCollections.filter(c => c.status === 'in_progress');
    const scheduledCollections = insertedCollections.filter(c => c.status === 'scheduled');

    logger.info('');
    logger.info('========================================================');
    logger.info('  IN-PROGRESS Collections (use these IDs with curl):');
    logger.info('========================================================');
    for (const c of inProgressCollections) {
      const apt = apartments.find(a => a._id.toString() === c.apartment.toString());
      logger.info(`  ID: ${c._id}  |  Apartment: ${apt?.name || 'Unknown'}  |  Pre-Sensor: ${c.preSensorReadingId || 'none'}`);
    }
    logger.info('');
    logger.info(`  Total in_progress: ${inProgressCollections.length}`);
    logger.info(`  Total scheduled:   ${scheduledCollections.length}`);
    logger.info('');
    logger.info('  Example curl to COMPLETE a collection:');
    if (inProgressCollections.length > 0) {
      const exId = inProgressCollections[0]._id;
      logger.info(`  curl -X PATCH http://localhost:5000/api/v1/collections/${exId}/complete \\`);
      logger.info(`    -H "Content-Type: application/json" \\`);
      logger.info(`    -H "Authorization: Bearer <COLLECTOR_JWT>" \\`);
      logger.info(`    -d '{"endLocation": {"lat": -1.29, "lng": 36.78}}'`);
    }
    logger.info('========================================================');
    logger.info('');

    logger.info('Creating Complaints...');
    // --- COMPLAINTS ---
    const complaintsData = [];
    const complaintTypes = ['missed_collection', 'illegal_dumping', 'overflowing_bins', 'bad_odor', 'burning_waste', 'other'];
    const complaintStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];

    for (let i = 0; i < 25; i++) {
      const res = residents[Math.floor(Math.random() * residents.length)];
      const apt = apartments[Math.floor(Math.random() * apartments.length)];
      const type = complaintTypes[Math.floor(Math.random() * complaintTypes.length)];
      const status = complaintStatuses[Math.floor(Math.random() * complaintStatuses.length)];
      const officer = officers[Math.floor(Math.random() * officers.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const createdAt = new Date(now);
      createdAt.setDate(now.getDate() - daysAgo);

      const isNearApt = Math.random() > 0.3;
      let lat, lng;
      if (isNearApt) {
        lat = apt.location.coordinates[1] + (Math.random() - 0.5) * 0.005;
        lng = apt.location.coordinates[0] + (Math.random() - 0.5) * 0.005;
      } else {
        lat = -1.2921 + (Math.random() - 0.5) * 0.1;
        lng = 36.8219 + (Math.random() - 0.5) * 0.1;
      }

      let priority = 'medium';
      let sentiment = 'neutral';
      let riskScore = 40;
      if (type === 'burning_waste' || type === 'illegal_dumping') {
        priority = 'critical';
        sentiment = 'angry';
        riskScore = 90;
      } else if (type === 'missed_collection') {
        priority = 'high';
        sentiment = 'negative';
        riskScore = 70;
      }

      const comp = {
        title: `Issue with ${type.replace('_', ' ')}`,
        description: `I am reporting an issue regarding ${type.replace('_', ' ')} near my location. It has been a problem for a while.`,
        type,
        status,
        priority,
        resident: res._id,
        apartment: isNearApt ? apt._id : undefined,
        location: { lat, lng },
        createdAt,
        assignedTo: status !== 'pending' ? officer._id : undefined,
        resolution: status === 'resolved' ? 'Investigated and resolved the issue with the local collector.' : undefined,
        resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) : undefined,
        aiAnalysis: {
          category: type,
          priority,
          sentiment,
          riskScore,
          recommendation: `Assign to an officer and verify collection schedule for the area.`,
          analyzedAt: new Date(createdAt.getTime() + 10000),
          rawResponse: "{}"
        }
      };
      complaintsData.push(comp);
    }
    await Complaint.insertMany(complaintsData);

    logger.info('Creating Anomaly Alerts...');
    // --- ANOMALY ALERTS ---
    const anomalyData = [
      { type: 'repeated_complaints', severity: 'high', entityType: 'Apartment', entityId: apartments[0]._id, description: 'Apartment has 6 complaints in the last 30 days', details: { complaintCount: 6 }, status: 'new', createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { type: 'suspicious_duration', severity: 'medium', entityType: 'Collection', entityId: (await Collection.findOne({ status: 'completed' }))._id, description: 'Collection took 85 mins, > 2x average (30 mins)', details: { timeSpent: 85, avgTime: 30 }, status: 'new', createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { type: 'collector_performance', severity: 'critical', entityType: 'User', entityId: collectors[2]._id, description: 'Collector has 60% dispute rate (3/5)', details: { disputeRate: 0.6, totalCollections: 5, disputedCollections: 3 }, status: 'new', createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { type: 'collection_gap', severity: 'high', entityType: 'Apartment', entityId: apartments[3]._id, description: 'No completed collections for 10 days', details: { daysSinceLastCollection: 10 }, status: 'new', createdAt: new Date() }
    ];
    await AnomalyAlert.insertMany(anomalyData);

    logger.info('Creating Reports...');
    // --- REPORTS ---
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const reportData = [
      {
        type: 'weekly',
        generatedBy: admin._id,
        period: { start: startOfWeek, end: now },
        data: {
          totalCollections: 25,
          completedCollections: 22,
          verifiedCollections: 18,
          disputedCollections: 2,
          totalComplaints: 12,
          resolvedComplaints: 8
        },
        aiSummary: "The weekly operations show a stable completion rate of 88%, though dispute rates require attention. 12 complaints were filed, with 8 successfully resolved. Continued focus on high-density areas is recommended.",
        recommendations: [
          "Investigate collector performance anomalies.",
          "Deploy additional bins to high-risk areas identified."
        ],
        isPublished: true,
        createdAt: now
      }
    ];
    await Report.insertMany(reportData);

    logger.info('✅ Database seeded successfully!');
    logger.info('');
    logger.info('=== LOGIN CREDENTIALS ===');
    logger.info(`Admin:     admin@swcmas.com`);
    logger.info(`Officer:   j.kamau@swcmas.com`);
    logger.info(`Landlord:  peter.o@example.com`);
    logger.info(`Collector: collector1@swcmas.com`);
    logger.info(`Resident:  res1@example.com`);
    logger.info(`Password:  ${defaultPassword}`);
    logger.info('=========================');
    process.exit(0);
  } catch (err) {
    logger.error('Seeding failed: %s', err.message);
    console.error(err);
    process.exit(1);
  }
};

seed();
