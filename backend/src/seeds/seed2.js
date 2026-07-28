/**
 * backend/src/seeds/seed2.js
 *
 * Full-coverage seeder for SWCMAS. Unlike seed.js (which only touched
 * User/Apartment/Collection/Complaint/AnomalyAlert/Report/SensorReading),
 * this script also populates Invoice, Notification, ResidentVerification,
 * and AuditLog, and cross-links everything so the dataset is coherent
 * enough to run real analytics against (fill deltas actually drive
 * verification outcomes, invoices point at real collections, audit logs
 * point at real complaint/collection/report/invoice/anomaly IDs, etc).
 *
 * Run with: node src/seeds/seed2.js
 * (or add "seed2": "node src/seeds/seed2.js" to package.json scripts)
 *
 * Notes on deviations from the spec doc, for transparency:
 *  - Sensor history is generated over 14 days (not 7) so it lines up with
 *    the 14-day Collection history window.
 *  - Reports are generated *before* AuditLogs (spec lists AuditLogs first)
 *    so a "REPORT_GENERATED" audit entry can point at a real Report._id
 *    instead of a throwaway ObjectId.
 */

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Apartment = require('../models/Apartment');
const Collection = require('../models/Collection');
const Complaint = require('../models/Complaint');
const AnomalyAlert = require('../models/AnomalyAlert');
const Report = require('../models/Report');
const SensorReading = require('../models/SensorReading');
const Invoice = require('../models/Invoice');
const Notification = require('../models/Notification');
const ResidentVerification = require('../models/ResidentVerification');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
};
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const deviceIdFor = (apt) => `ESP32-${apt.name.replace(/\s+/g, '-').substring(0, 12).toUpperCase()}`;
const jitterLocation = (apt) => ({
    lat: apt.location.coordinates[1] + (Math.random() - 0.5) * 0.002,
    lng: apt.location.coordinates[0] + (Math.random() - 0.5) * 0.002,
});
const mpesaCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
};

const BIN_HEIGHT = 100; // cm
const HISTORY_DAYS = 90;
const READING_INTERVAL_HOURS = 6;
const COLLECTION_COUNT = 120;

// Each sub-score is individually capped at 20 (per the schema), but `total`
// is separately capped at 100. Since there are 6 sub-scores, they can't all
// be allowed to hit 20 at once (6*20=120), so the ranges below are sized so
// the WORST-CASE sum per tier never exceeds 100 — verified tops out exactly
// at 100, every lower tier has headroom under it. `total` is then clamped
// as a defensive safety net on top of that.
function buildVerificationScore(outcome) {
    let s;
    switch (outcome) {
        case 'verified': // worst case: 20+15+15+15+15+20 = 100
            s = { gps: 20, timeSpent: randInt(10, 15), landlord: randInt(10, 15), resident: randInt(10, 15), image: randInt(10, 15), sensor: randInt(15, 20) };
            break;
        case 'pending': // worst case: 20+15+0+0+12+18 = 65
            s = { gps: 20, timeSpent: randInt(10, 15), landlord: 0, resident: 0, image: randInt(5, 12), sensor: randInt(10, 18) };
            break;
        case 'requires_investigation': // worst case: 12+10+8+8+8+10 = 56
            s = { gps: randInt(6, 12), timeSpent: randInt(4, 10), landlord: randInt(0, 8), resident: randInt(0, 8), image: randInt(3, 8), sensor: randInt(4, 10) };
            break;
        case 'suspicious': // worst case: 10+6+6+0+6+6 = 34
            s = { gps: randInt(4, 10), timeSpent: randInt(0, 6), landlord: randInt(0, 6), resident: 0, image: randInt(0, 6), sensor: randInt(0, 6) };
            break;
        default: // disputed, worst case: 8+6+0+0+0+0 = 14
            s = { gps: randInt(0, 8), timeSpent: randInt(0, 6), landlord: 0, resident: 0, image: 0, sensor: 0 };
    }
    s.total = Math.min(100, s.gps + s.timeSpent + s.landlord + s.resident + s.image + s.sensor);
    return s;
}

// ---------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------
const seed = async () => {
    let exitCode = 0;
    try {
        await connectDB();
        logger.info('Connected to MongoDB. Clearing existing data...');

        await Promise.all([
            User.deleteMany({}),
            Apartment.deleteMany({}),
            Collection.deleteMany({}),
            Complaint.deleteMany({}),
            AnomalyAlert.deleteMany({}),
            Report.deleteMany({}),
            SensorReading.deleteMany({}),
            Invoice.deleteMany({}),
            Notification.deleteMany({}),
            ResidentVerification.deleteMany({}),
            AuditLog.deleteMany({}),
        ]);

        const defaultPassword = 'Password@123';
        const now = new Date();

        // ==================================================================
        // USERS
        // ==================================================================
        logger.info('Creating Users...');
        const baseUsers = [
            { firstName: 'Pato', lastName: 'Admin', email: 'pato@gmail.com', password: 'password', role: 'county_admin', phone: '+254700000001' },
            { firstName: 'John', lastName: 'Kamau', email: 'j.kamau@swcmas.com', password: defaultPassword, role: 'county_officer', phone: '+254711000002' },
            { firstName: 'Grace', lastName: 'Wanjiku', email: 'g.wanjiku@swcmas.com', password: defaultPassword, role: 'county_officer', phone: '+254711000003' },
            { firstName: 'Peter', lastName: 'Ochieng', email: 'peter.o@example.com', password: defaultPassword, role: 'landlord', phone: '+254722000004' },
            { firstName: 'Mary', lastName: 'Mutua', email: 'mary.m@example.com', password: defaultPassword, role: 'landlord', phone: '+254722000005' },
            { firstName: 'David', lastName: 'Kiprono', email: 'david.k@example.com', password: defaultPassword, role: 'landlord', phone: '+254722000006' },
            { firstName: 'Sarah', lastName: 'Hassan', email: 'sarah.h@example.com', password: defaultPassword, role: 'landlord', phone: '+254722000007' },
            { firstName: 'James', lastName: 'Mwangi', email: 'collector1@swcmas.com', password: defaultPassword, role: 'waste_collector', phone: '+254733000008' },
            { firstName: 'Alice', lastName: 'Achieng', email: 'collector2@swcmas.com', password: defaultPassword, role: 'waste_collector', phone: '+254733000009' },
            { firstName: 'Kevin', lastName: 'Otieno', email: 'collector3@swcmas.com', password: defaultPassword, role: 'waste_collector', phone: '+254733000010' },
            { firstName: 'Lucy', lastName: 'Wambui', email: 'collector4@swcmas.com', password: defaultPassword, role: 'waste_collector', phone: '+254733000011' },
            { firstName: 'Faith', lastName: 'Njeri', email: 'res1@example.com', password: defaultPassword, role: 'resident', phone: '+254700100001' },
            { firstName: 'Brian', lastName: 'Kiplagat', email: 'res2@example.com', password: defaultPassword, role: 'resident', phone: '+254700100002' },
            { firstName: 'Esther', lastName: 'Wafula', email: 'res3@example.com', password: defaultPassword, role: 'resident', phone: '+254700100003' },
            { firstName: 'Dennis', lastName: 'Omondi', email: 'res4@example.com', password: defaultPassword, role: 'resident', phone: '+254700100004' },
            { firstName: 'Purity', lastName: 'Chebet', email: 'res5@example.com', password: defaultPassword, role: 'resident', phone: '+254700100005' },
            { firstName: 'Samuel', lastName: 'Mburu', email: 'res6@example.com', password: defaultPassword, role: 'resident', phone: '+254700100006' },
            { firstName: 'Winnie', lastName: 'Adhiambo', email: 'res7@example.com', password: defaultPassword, role: 'resident', phone: '+254700100007' },
            { firstName: 'Elijah', lastName: 'Kiptoo', email: 'res8@example.com', password: defaultPassword, role: 'resident', phone: '+254700100008' },
        ];
        const usersData = baseUsers.map((u) => ({
            ...u,
            isVerified: true,
            isActive: true,
            preferences: { emailNotifications: true, smsNotifications: Math.random() < 0.6 },
            lastLogin: new Date(now.getTime() - rand(0, 10) * 24 * 60 * 60000),
        }));
        const users = await User.create(usersData); // User.create() -> pre-save hook hashes passwords

        const admin = users.find((u) => u.role === 'county_admin');
        const officers = users.filter((u) => u.role === 'county_officer');
        const landlords = users.filter((u) => u.role === 'landlord');
        const collectors = users.filter((u) => u.role === 'waste_collector');
        const residents = users.filter((u) => u.role === 'resident');

        // ==================================================================
        // APARTMENTS
        // ==================================================================
        logger.info('Creating Apartments...');
        const apartmentDefs = [
            { name: 'Sunrise Heights', address: 'Kilimani Ring Road', city: 'Nairobi', county: 'Nairobi', unitCount: 40, coords: [36.78, -1.29], schedule: { frequency: 'weekly', time: '08:00', days: ['Monday', 'Thursday'] } },
            { name: 'Oasis Residences', address: 'Westlands Close', city: 'Nairobi', county: 'Nairobi', unitCount: 65, coords: [36.80, -1.26], schedule: { frequency: 'daily', time: '07:30', days: [] } },
            { name: 'Kileleshwa Gardens', address: 'Kileleshwa Othaya Road', city: 'Nairobi', county: 'Nairobi', unitCount: 30, coords: [36.79, -1.28], schedule: { frequency: 'every_other_day', time: '09:00', days: [] } },
            { name: 'Lavington Villas', address: 'Lavington James Gichuru', city: 'Nairobi', county: 'Nairobi', unitCount: 25, coords: [36.77, -1.27], schedule: { frequency: 'weekly', time: '08:00', days: ['Tuesday', 'Friday'] } },
            { name: 'South B Apartments', address: 'South B Mukinduri', city: 'Nairobi', county: 'Nairobi', unitCount: 80, coords: [36.83, -1.31], schedule: { frequency: 'daily', time: '10:00', days: [] } },
            { name: 'Langata View', address: 'Langata Road', city: 'Nairobi', county: 'Nairobi', unitCount: 50, coords: [36.79, -1.32], schedule: { frequency: 'every_other_day', time: '07:00', days: [] } },
            { name: 'Ngong Road Flats', address: 'Ngong Road', city: 'Nairobi', county: 'Nairobi', unitCount: 120, coords: [36.76, -1.30], schedule: { frequency: 'daily', time: '08:30', days: [] } },
            { name: 'Parklands Court', address: 'Parklands 1st Ave', city: 'Nairobi', county: 'Nairobi', unitCount: 35, coords: [36.81, -1.26], schedule: { frequency: 'weekly', time: '09:00', days: ['Wednesday', 'Saturday'] } },
            { name: 'Upperhill Suites', address: 'Upper Hill Road', city: 'Nairobi', county: 'Nairobi', unitCount: 45, coords: [36.81, -1.29], schedule: { frequency: 'daily', time: '06:30', days: [] } },
            { name: 'Ruaka Gardens', address: 'Ruaka Limuru Road', city: 'Kiambu', county: 'Kiambu', unitCount: 90, coords: [36.77, -1.21], schedule: { frequency: 'every_other_day', time: '08:00', days: [] } },
            { name: 'Thika Greens', address: 'Thika Road', city: 'Kiambu', county: 'Kiambu', unitCount: 200, coords: [37.06, -1.03], schedule: { frequency: 'daily', time: '09:00', days: [] } },
            { name: 'Syokimau Estate', address: 'Mombasa Road', city: 'Machakos', county: 'Machakos', unitCount: 150, coords: [36.93, -1.37], schedule: { frequency: 'weekly', time: '10:00', days: ['Monday', 'Thursday'] } },
            { name: 'Kitengela Palms', address: 'Namanga Road', city: 'Kajiado', county: 'Kajiado', unitCount: 110, coords: [36.95, -1.48], schedule: { frequency: 'every_other_day', time: '07:30', days: [] } },
            { name: 'Karen Villas', address: 'Karen Road', city: 'Nairobi', county: 'Nairobi', unitCount: 20, coords: [36.72, -1.33], schedule: { frequency: 'weekly', time: '11:00', days: ['Friday'] } },
            { name: 'Roysambu Flats', address: 'Thika Road', city: 'Nairobi', county: 'Nairobi', unitCount: 300, coords: [36.88, -1.21], schedule: { frequency: 'daily', time: '06:00', days: [] } },
        ];
        const inactiveByName = new Set(['Syokimau Estate', 'Roysambu Flats']);
        const apartmentsData = apartmentDefs.map((a, i) => ({
            name: a.name,
            address: a.address,
            city: a.city,
            county: a.county,
            unitCount: a.unitCount,
            location: { type: 'Point', coordinates: a.coords },
            landlord: landlords[i % landlords.length]._id,
            wasteCollector: collectors[i % collectors.length]._id,
            collectionSchedule: a.schedule,
            isActive: !inactiveByName.has(a.name),
            notes: inactiveByName.has(a.name)
                ? 'Service temporarily suspended pending contract renewal.'
                : Math.random() < 0.3
                    ? 'Gate access code required for collector after 6pm.'
                    : undefined,
        }));
        const apartments = await Apartment.create(apartmentsData);
        const activeApartments = apartments.filter((a) => a.isActive !== false);

        // ==================================================================
        // SENSOR READINGS (ambient baseline, 14-day history)
        // ==================================================================
        logger.info('Creating baseline sensor reading history...');
        const ambientReadings = [];
        for (const apt of apartments) {
            let fillBase = randInt(15, 45);
            const deviceId = deviceIdFor(apt);
            for (let hoursAgo = HISTORY_DAYS * 24; hoursAgo >= 6; hoursAgo -= READING_INTERVAL_HOURS) {
                fillBase = Math.min(97, fillBase + rand(0.5, 2.2));
                if (Math.random() < 0.03) fillBase = randInt(5, 20); // occasional unlogged pickup
                const fillLevel = Math.max(1, Math.min(100, fillBase + rand(-2.5, 2.5)));
                ambientReadings.push({
                    apartment: apt._id,
                    binHeightCm: BIN_HEIGHT,
                    fillLevelPercent: round1(fillLevel),
                    rawDistanceCm: round1(BIN_HEIGHT * (1 - fillLevel / 100)),
                    recordedAt: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000),
                    deviceId,
                    batteryVoltage: round2(3.2 + Math.random() * 0.7),
                });
            }
        }

        // ==================================================================
        // COLLECTIONS (+ their dedicated pre/post sensor readings)
        // ==================================================================
        logger.info('Building Collections and linked sensor verification data...');
        const collectionsData = [];
        const collectionSensorReadings = [];

        for (let i = 0; i < COLLECTION_COUNT; i++) {
            const apt = pick(activeApartments);
            // Spread across 90 days so KPI comparison (0-30 vs 31-60 days ago) has real data
            const daysAgo = i < 5 ? randInt(0, 3) : randInt(0, 89);
            const scheduledDate = new Date(now);
            scheduledDate.setDate(now.getDate() - daysAgo);
            scheduledDate.setHours(randInt(6, 10), 0, 0, 0);

            const col = {
                apartment: apt._id,
                wasteCollector: apt.wasteCollector,
                scheduledDate,
                createdAt: new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000),
            };

            if (daysAgo === 0) {
                col.status = Math.random() > 0.5 ? 'scheduled' : 'in_progress';
                col.verificationStatus = 'pending';
                if (col.status === 'in_progress') {
                    col.startTime = new Date(scheduledDate.getTime() + rand(0, 30) * 60000);
                    col.startLocation = jitterLocation(apt);
                }
                collectionsData.push(col);
                continue;
            }

            const r = Math.random();
            let outcome;
            if (r < 0.08) outcome = 'disputed';
            else if (r < 0.18) outcome = 'suspicious';
            else if (r < 0.25) outcome = 'requires_investigation';
            else if (r < 0.42) outcome = 'pending';
            else outcome = 'verified';

            col.status = outcome === 'disputed' ? 'disputed' : 'completed';
            col.verificationStatus = outcome;
            col.startTime = new Date(scheduledDate.getTime() + rand(0, 30) * 60000);
            col.startLocation = jitterLocation(apt);
            col.timeSpentMinutes = outcome === 'suspicious' ? randInt(55, 110) : randInt(12, 42);
            col.endTime = new Date(col.startTime.getTime() + col.timeSpentMinutes * 60000);
            col.completedAt = col.endTime; // needed for gap detection queries
            col.endLocation = jitterLocation(apt);
            col.beforePhoto = `https://picsum.photos/seed/${apt._id}-b${i}/640/480`;
            col.afterPhoto = `https://picsum.photos/seed/${apt._id}-a${i}/640/480`;

            // Fill levels drive the outcome believably: a real drop -> verified,
            // little to no drop despite "completion" -> disputed/suspicious.
            let preFill, postFill;
            if (outcome === 'verified') { preFill = rand(55, 98); postFill = rand(2, 15); }
            else if (outcome === 'pending') { preFill = rand(35, 80); postFill = rand(3, 20); }
            else if (outcome === 'requires_investigation') { preFill = rand(45, 90); postFill = rand(18, 38); }
            else if (outcome === 'suspicious') { preFill = rand(50, 95); postFill = rand(32, 58); }
            else { preFill = rand(55, 97); postFill = rand(42, 72); } // disputed

            const preId = new mongoose.Types.ObjectId();
            const postId = new mongoose.Types.ObjectId();
            const deviceId = deviceIdFor(apt);

            collectionSensorReadings.push({
                _id: preId,
                apartment: apt._id,
                binHeightCm: BIN_HEIGHT,
                fillLevelPercent: round1(preFill),
                rawDistanceCm: round1(BIN_HEIGHT * (1 - preFill / 100)),
                recordedAt: new Date(col.startTime.getTime() - rand(5, 20) * 60000),
                deviceId,
                batteryVoltage: round2(3.2 + Math.random() * 0.7),
            });
            collectionSensorReadings.push({
                _id: postId,
                apartment: apt._id,
                binHeightCm: BIN_HEIGHT,
                fillLevelPercent: round1(postFill),
                rawDistanceCm: round1(BIN_HEIGHT * (1 - postFill / 100)),
                recordedAt: new Date(col.endTime.getTime() + rand(3, 15) * 60000),
                deviceId,
                batteryVoltage: round2(3.2 + Math.random() * 0.7),
            });

            col.preSensorReadingId = preId;
            col.postSensorReadingId = postId;
            col.fillDeltaPercent = Math.max(0, round1(preFill - postFill));
            col.sensorVerified = col.fillDeltaPercent >= 60;
            col.verificationScore = buildVerificationScore(outcome);

            if (['verified', 'disputed', 'requires_investigation'].includes(outcome)) {
                col.confirmedBy = apt.landlord;
                col.confirmedAt = new Date(col.endTime.getTime() + rand(1, 20) * 60 * 60000);
            }
            if (outcome === 'disputed') {
                col.notes = 'Resident reported the bin was not fully emptied; landlord flagged for review.';
            }

            collectionsData.push(col);
        }

        // A handful of future scheduled pickups
        for (let i = 0; i < 5; i++) {
            const apt = apartments[i % apartments.length];
            const future = new Date(now);
            future.setDate(now.getDate() + 1 + i);
            future.setHours(randInt(7, 10), 0, 0, 0);
            collectionsData.push({
                apartment: apt._id,
                wasteCollector: apt.wasteCollector,
                status: 'scheduled',
                verificationStatus: 'pending',
                scheduledDate: future,
                createdAt: now,
            });
        }

        logger.info('Inserting Sensor Readings...');
        const insertedSensorReadings = await SensorReading.insertMany([...ambientReadings, ...collectionSensorReadings]);

        logger.info('Inserting Collections...');
        const insertedCollections = await Collection.insertMany(collectionsData);

        // ==================================================================
        // INVOICES — one per completed collection
        // ==================================================================
        logger.info('Creating Invoices...');
        const invoicesData = [];
        const completedCollections = insertedCollections.filter((c) => c.status === 'completed');
        for (const c of completedCollections) {
            const apt = apartments.find((a) => a._id.equals(c.apartment));
            const r = Math.random();
            const status = r < 0.55 ? 'paid' : r < 0.8 ? 'pending' : 'overdue';
            const inv = {
                landlord: apt.landlord,
                apartment: apt._id,
                collectionRecord: c._id,
                amount: 1500,
                status,
                paymentMethod: null,
            };
            if (status === 'paid') {
                inv.paidAt = new Date(c.endTime.getTime() + rand(1, 72) * 60 * 60000);
                inv.paymentMethod = 'mpesa';
                inv.transactionId = mpesaCode();
            }
            invoicesData.push(inv);
        }
        const insertedInvoices = await Invoice.insertMany(invoicesData);

        // ==================================================================
        // COMPLAINTS
        // ==================================================================
        logger.info('Creating Complaints...');
        const complaintTypes = ['missed_collection', 'illegal_dumping', 'overflowing_bins', 'bad_odor', 'burning_waste', 'other'];
        const complaintStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
        const complaintTitleMap = {
            missed_collection: 'Missed scheduled waste collection',
            illegal_dumping: 'Illegal dumping spotted near property',
            overflowing_bins: 'Overflowing communal bins',
            bad_odor: 'Persistent bad odor from waste',
            burning_waste: 'Waste being burned in the open',
            other: 'General waste management concern',
        };
        const complaintDescMap = {
            missed_collection: 'The scheduled collection did not happen and waste has been piling up for days.',
            illegal_dumping: 'Someone has been dumping waste in an undesignated area near the estate.',
            overflowing_bins: 'The communal bins are overflowing and attracting pests.',
            bad_odor: 'There is a strong, persistent smell coming from the waste collection point.',
            burning_waste: 'Waste is being burned openly, creating smoke and a health hazard.',
            other: 'There is an ongoing waste management issue that needs attention.',
        };

        const complaintsData = [];
        for (let i = 0; i < 40; i++) {
            const res = pick(residents);
            const apt = pick(apartments);
            const type = pick(complaintTypes);
            const status = pick(complaintStatuses);
            const officer = pick(officers);
            // Spread across 90 days for meaningful resolution-time and KPI comparison data
            const daysAgo = randInt(0, 89);
            const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60000);
            const isNearApt = Math.random() > 0.3;
            const lat = isNearApt ? apt.location.coordinates[1] + (Math.random() - 0.5) * 0.005 : -1.2921 + (Math.random() - 0.5) * 0.1;
            const lng = isNearApt ? apt.location.coordinates[0] + (Math.random() - 0.5) * 0.005 : 36.8219 + (Math.random() - 0.5) * 0.1;

            let priority = 'medium', sentiment = 'neutral', riskScore = randInt(20, 50);
            if (type === 'burning_waste' || type === 'illegal_dumping') { priority = 'critical'; sentiment = 'angry'; riskScore = randInt(80, 97); }
            else if (type === 'missed_collection') { priority = 'high'; sentiment = 'negative'; riskScore = randInt(60, 79); }
            else if (type === 'overflowing_bins') { priority = 'high'; sentiment = 'negative'; riskScore = randInt(55, 75); }

            complaintsData.push({
                title: complaintTitleMap[type],
                description: complaintDescMap[type],
                type,
                status,
                priority,
                resident: res._id,
                apartment: isNearApt ? apt._id : undefined,
                images: Math.random() < 0.4 ? [`https://picsum.photos/seed/complaint-${i}/500/400`] : [],
                location: { lat, lng },
                createdAt,
                assignedTo: status !== 'pending' ? officer._id : undefined,
                resolution: status === 'resolved' ? 'Issue verified on-site and corrective action taken with the assigned collector.' : undefined,
                resolvedBy: status === 'resolved' ? officer._id : undefined,
                resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + rand(2, 48) * 60 * 60000) : undefined,
                aiAnalysis: {
                    category: type,
                    priority,
                    sentiment,
                    riskScore,
                    recommendation: 'Assign a field officer and cross-check the collection schedule for this location.',
                    analyzedAt: new Date(createdAt.getTime() + 10000),
                    rawResponse: '{}',
                },
            });
        }
        const insertedComplaints = await Complaint.insertMany(complaintsData);

        // ==================================================================
        // RESIDENT VERIFICATIONS
        // ==================================================================
        logger.info('Creating Resident Verifications...');
        const residentVerificationsData = [];
        const pickupAttempted = insertedCollections.filter((c) => c.status === 'completed' || c.status === 'disputed');
        for (const c of pickupAttempted) {
            const apt = apartments.find((a) => a._id.equals(c.apartment));
            const chosen = pickN(residents, randInt(2, 3));
            for (const res of chosen) {
                let trueProb;
                if (c.status === 'disputed') trueProb = 0.2;
                else if (c.verificationStatus === 'suspicious' || c.verificationStatus === 'requires_investigation') trueProb = 0.5;
                else trueProb = 0.9;
                const wasCollected = Math.random() < trueProb;
                residentVerificationsData.push({
                    collection: c._id,
                    resident: res._id,
                    apartment: apt._id,
                    wasCollected,
                    notes: wasCollected ? '' : 'Bin still appeared full at the reported collection time.',
                    respondedAt: new Date((c.endTime || c.scheduledDate).getTime() + rand(1, 10) * 60 * 60000),
                });
            }
        }
        await ResidentVerification.insertMany(residentVerificationsData);

        // ==================================================================
        // NOTIFICATIONS
        // ==================================================================
        logger.info('Creating Notifications...');
        const notifTemplates = {
            collection_reminder: { title: 'Upcoming Waste Collection', message: 'Your scheduled waste collection is coming up soon. Please ensure bins are accessible.' },
            complaint_update: { title: 'Complaint Status Updated', message: 'There has been an update on a complaint you filed. Check the app for details.' },
            verification_request: { title: 'Verification Needed', message: 'Please confirm whether your waste was collected as scheduled.' },
            alert: { title: 'System Alert', message: 'An anomaly was detected that may require your attention.' },
            system: { title: 'System Update', message: 'SWCMAS has been updated with new features and improvements.' },
        };
        const notifTypes = Object.keys(notifTemplates);
        const notificationsData = [];
        for (const u of users) {
            const chosenTypes = pickN(notifTypes, randInt(2, 3));
            for (const t of chosenTypes) {
                const createdAt = new Date(now.getTime() - rand(0, 14) * 24 * 60 * 60000);
                const isRead = Math.random() < 0.6;
                notificationsData.push({
                    user: u._id,
                    type: t,
                    title: notifTemplates[t].title,
                    message: notifTemplates[t].message,
                    isRead,
                    readAt: isRead ? new Date(createdAt.getTime() + rand(1, 20) * 60 * 60000) : undefined,
                    createdAt,
                    metadata: {},
                });
            }
        }
        await Notification.insertMany(notificationsData);

        // ==================================================================
        // ANOMALY ALERTS
        // ==================================================================
        logger.info('Creating Anomaly Alerts...');
        const disputedCollection = insertedCollections.find((c) => c.status === 'disputed') || insertedCollections[0];
        const suspiciousCollection = insertedCollections.find((c) => c.verificationStatus === 'suspicious') || insertedCollections.find((c) => c.status === 'completed');
        const anomalyData = [
            {
                type: 'repeated_complaints',
                severity: 'high',
                entityType: 'Apartment',
                entityId: apartments[0]._id,
                description: `${apartments[0].name} has received multiple waste-related complaints in the last 30 days.`,
                details: { complaintCount: insertedComplaints.filter((c) => c.apartment && c.apartment.equals(apartments[0]._id)).length, windowDays: 30 },
                isResolved: false,
            },
            {
                type: 'suspicious_duration',
                severity: 'medium',
                entityType: 'Collection',
                entityId: suspiciousCollection._id,
                description: 'Collection duration significantly exceeds the average for this route.',
                details: { timeSpentMinutes: suspiciousCollection.timeSpentMinutes, averageMinutes: 25 },
                isResolved: false,
            },
            {
                type: 'collector_performance',
                severity: 'critical',
                entityType: 'User',
                entityId: collectors[2]._id,
                description: `${collectors[2].firstName} ${collectors[2].lastName} has an elevated dispute rate over the last 30 days.`,
                details: { disputeRate: 0.4, totalCollections: 10, disputedCollections: 4 },
                isResolved: false,
            },
            {
                type: 'collection_gap',
                severity: 'high',
                entityType: 'Apartment',
                entityId: apartments[3]._id,
                description: `${apartments[3].name} has gone without a verified collection for an extended period.`,
                details: { daysSinceLastCollection: 9 },
                isResolved: true,
                resolvedBy: officers[0]._id,
                resolvedAt: new Date(now.getTime() - 2 * 24 * 60 * 60000),
                resolution: 'Backup collector dispatched; schedule restored.',
            },
            {
                type: 'false_reporting',
                severity: 'critical',
                entityType: 'Collection',
                entityId: disputedCollection._id,
                description: 'Sensor data shows minimal bin-level change despite the collection being marked complete.',
                details: { fillDeltaPercent: disputedCollection.fillDeltaPercent || 0 },
                isResolved: false,
            },
            {
                type: 'sensor_tamper',
                severity: 'medium',
                entityType: 'Apartment',
                entityId: apartments[7]._id,
                description: `IoT sensor readings for ${apartments[7].name} show irregular gaps inconsistent with normal operation.`,
                details: { gapHours: 36 },
                isResolved: true,
                resolvedBy: officers[1]._id,
                resolvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60000),
                resolution: 'Device battery replaced during site visit.',
            },
        ];
        const insertedAnomalyAlerts = await AnomalyAlert.insertMany(anomalyData);

        // ==================================================================
        // REPORTS (built before AuditLogs so REPORT_GENERATED can reference a real _id)
        // ==================================================================
        logger.info('Creating Reports...');
        const totalCollectionsCount = insertedCollections.length;
        const completedCount = insertedCollections.filter((c) => c.status === 'completed').length;
        const verifiedCount = insertedCollections.filter((c) => c.verificationStatus === 'verified').length;
        const disputedCount = insertedCollections.filter((c) => c.status === 'disputed').length;
        const totalComplaintsCount = insertedComplaints.length;
        const resolvedComplaintsCount = insertedComplaints.filter((c) => c.status === 'resolved').length;

        const complaintBreakdown = {};
        for (const t of complaintTypes) complaintBreakdown[t] = insertedComplaints.filter((c) => c.type === t).length;

        const collectorPerformance = collectors.map((col) => {
            const mine = insertedCollections.filter((c) => c.wasteCollector && c.wasteCollector.equals(col._id));
            const completed = mine.filter((c) => c.status === 'completed').length;
            const disputed = mine.filter((c) => c.status === 'disputed').length;
            return {
                collector: col._id,
                totalCollections: mine.length,
                completedCollections: completed,
                disputedCollections: disputed,
                complianceRate: mine.length ? Math.round((completed / mine.length) * 100) : 0,
            };
        });

        const landlordCompliance = landlords.map((l) => {
            const theirApts = apartments.filter((a) => a.landlord.equals(l._id)).map((a) => a._id.toString());
            const related = insertedCollections.filter((c) => theirApts.includes(c.apartment.toString()));
            const verified = related.filter((c) => c.verificationStatus === 'verified').length;
            return {
                landlord: l._id,
                apartmentCount: theirApts.length,
                verifiedCollections: verified,
                complianceScore: related.length ? Math.round((verified / related.length) * 100) : 0,
            };
        });

        const highRiskAreas = apartments
            .map((a) => ({ apartment: a._id, name: a.name, complaintCount: insertedComplaints.filter((c) => c.apartment && c.apartment.equals(a._id)).length }))
            .filter((x) => x.complaintCount > 0)
            .sort((a, b) => b.complaintCount - a.complaintCount)
            .slice(0, 5);

        const buildReportData = () => ({
            totalCollections: totalCollectionsCount,
            completedCollections: completedCount,
            verifiedCollections: verifiedCount,
            disputedCollections: disputedCount,
            totalComplaints: totalComplaintsCount,
            resolvedComplaints: resolvedComplaintsCount,
            complaintBreakdown,
            collectorPerformance,
            landlordCompliance,
            highRiskAreas,
            complaintTrends: 'Illegal dumping and overflowing-bin reports are trending upward in higher-density estates.',
            violationTrends: 'Missed collections and delayed pickups remain the leading cause of resident complaints.',
        });

        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const verifiedRate = totalCollectionsCount ? Math.round((verifiedCount / totalCollectionsCount) * 100) : 0;
        const avgComplianceRate = collectorPerformance.length ? Math.round(collectorPerformance.reduce((s, c) => s + c.complianceRate, 0) / collectorPerformance.length) : 0;
        const avgLandlordScore = landlordCompliance.length ? Math.round(landlordCompliance.reduce((s, l) => s + l.complianceScore, 0) / landlordCompliance.length) : 0;

        const reportsData = [
            {
                type: 'daily',
                generatedBy: admin._id,
                period: { start: startOfDay, end: now },
                data: buildReportData(),
                aiSummary: `In the last 24 hours, ${completedCount} of ${totalCollectionsCount} tracked collections were completed with a ${verifiedRate}% sensor-verified rate. ${disputedCount} collection(s) are currently disputed.`,
                recommendations: ['Follow up on disputed collections within 24 hours.', 'Prioritize routes with low sensor-verification rates.'],
                isPublished: true,
            },
            {
                type: 'weekly',
                generatedBy: admin._id,
                period: { start: startOfWeek, end: now },
                data: buildReportData(),
                aiSummary: `This week, ${totalComplaintsCount} complaints were logged county-wide, with ${resolvedComplaintsCount} resolved. Collector compliance averaged ${avgComplianceRate}% across active routes.`,
                recommendations: ['Deploy additional collectors to high-risk estates.', 'Audit sensors with prolonged data gaps.'],
                isPublished: true,
            },
            {
                type: 'monthly',
                generatedBy: admin._id,
                period: { start: startOfMonth, end: now },
                data: buildReportData(),
                aiSummary: `Month to date, landlord compliance averaged ${avgLandlordScore}%, with ${highRiskAreas.length} estate(s) flagged as high-risk based on complaint volume.`,
                recommendations: ['Review landlord contracts with compliance below 70%.', 'Expand sensor coverage to unmonitored apartments.'],
                isPublished: Math.random() < 0.8,
            },
        ];
        const insertedReports = await Report.insertMany(reportsData);

        // ==================================================================
        // AUDIT LOGS
        // ==================================================================
        logger.info('Creating Audit Logs...');
        const auditTemplates = [
            { action: 'USER_LOGIN', entity: 'User' },
            { action: 'USER_VERIFIED', entity: 'User' },
            { action: 'COMPLAINT_CREATED', entity: 'Complaint' },
            { action: 'COMPLAINT_RESOLVED', entity: 'Complaint' },
            { action: 'COLLECTION_COMPLETED', entity: 'Collection' },
            { action: 'COLLECTION_DISPUTED', entity: 'Collection' },
            { action: 'INVOICE_PAID', entity: 'Invoice' },
            { action: 'ANOMALY_FLAGGED', entity: 'AnomalyAlert' },
            { action: 'REPORT_GENERATED', entity: 'Report' },
        ];
        const entityPools = {
            User: users,
            Complaint: insertedComplaints,
            Collection: insertedCollections,
            Invoice: insertedInvoices,
            AnomalyAlert: insertedAnomalyAlerts,
            Report: insertedReports,
        };
        const staffActors = [admin, ...officers];
        const auditLogsData = [];
        const auditCount = randInt(12, 15);
        for (let i = 0; i < auditCount; i++) {
            const template = pick(auditTemplates);
            const actor = pick(staffActors);
            const pool = entityPools[template.entity];
            const entityId = pool && pool.length ? pick(pool)._id : new mongoose.Types.ObjectId();
            auditLogsData.push({
                user: actor._id,
                action: template.action,
                entity: template.entity,
                entityId,
                ipAddress: `${pick([41, 105, 197])}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`,
                oldValue: {},
                newValue: {},
                metadata: { source: 'seed2' },
                timestamp: new Date(now.getTime() - rand(0, 20) * 24 * 60 * 60000),
            });
        }
        await AuditLog.insertMany(auditLogsData);

        // ==================================================================
        // SUMMARY
        // ==================================================================
        logger.info('');
        logger.info('==============================================');
        logger.info('  Database seeded successfully (seed2.js)');
        logger.info('==============================================');
        logger.info(`  Users:                   ${users.length}`);
        logger.info(`  Apartments:              ${apartments.length}`);
        logger.info(`  Sensor Readings:         ${insertedSensorReadings.length}`);
        logger.info(`  Collections:             ${insertedCollections.length}`);
        logger.info(`  Invoices:                ${insertedInvoices.length}`);
        logger.info(`  Complaints:              ${insertedComplaints.length}`);
        logger.info(`  Resident Verifications:  ${residentVerificationsData.length}`);
        logger.info(`  Notifications:           ${notificationsData.length}`);
        logger.info(`  Anomaly Alerts:          ${insertedAnomalyAlerts.length}`);
        logger.info(`  Reports:                 ${insertedReports.length}`);
        logger.info(`  Audit Logs:              ${auditLogsData.length}`);
        logger.info('==============================================');
        logger.info('  LOGIN CREDENTIALS');
        logger.info('==============================================');
        logger.info('  County Admin:   pato@gmail.com / password');
        logger.info(`  County Officer: ${officers[0].email} / ${defaultPassword}`);
        logger.info(`  Landlord:       ${landlords[0].email} / ${defaultPassword}`);
        logger.info(`  Collector:      ${collectors[0].email} / ${defaultPassword}`);
        logger.info(`  Resident:       ${residents[0].email} / ${defaultPassword}`);
        logger.info('  (all non-admin accounts share the password above)');
        logger.info('==============================================');
    } catch (err) {
        logger.error('Seeding failed: %s', err.message);
        console.error(err);
        exitCode = 1;
    } finally {
        try {
            await mongoose.disconnect();
            logger.info('Disconnected from MongoDB.');
        } catch (discErr) {
            console.error('Error disconnecting from MongoDB:', discErr);
        }
        process.exit(exitCode);
    }
};

seed();