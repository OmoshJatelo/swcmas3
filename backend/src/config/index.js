const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/swcmas',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
  },

  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY,
    apiUrl: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1',
    defaultModel: process.env.NVIDIA_DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct',
    // Per-use-case model overrides (optional)
    modelClassify: process.env.NVIDIA_MODEL_CLASSIFY,
    modelReport: process.env.NVIDIA_MODEL_REPORT,
    modelPlaybook: process.env.NVIDIA_MODEL_PLAYBOOK,
    modelCompliance: process.env.NVIDIA_MODEL_COMPLIANCE,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@swcmas.com',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  logLevel: process.env.LOG_LEVEL || 'debug',
  logFile: process.env.LOG_FILE || 'logs/app.log',
  // Maximum collections per collector per day (to avoid overload)
  maxCollectionsPerCollectorDay: parseInt(process.env.MAX_COLLECTIONS_PER_COLLECTOR_DAY, 10) || 10,

  allowedOrigins: [
    'http://localhost:5173',
    'https://swcmas3.vercel.app',
    'https://swcmas3-eiqeexc58-omoshjatelos-projects.vercel.app/',
    'http://localhost:3000',
    'http://localhost:80',
    'http://localhost',
  ],

  roles: {
    COUNTY_ADMIN: 'county_admin',
    COUNTY_OFFICER: 'county_officer',
    LANDLORD: 'landlord',
    WASTE_COLLECTOR: 'waste_collector',
    RESIDENT: 'resident',
  },

  complaintTypes: [
    'missed_collection',
    'illegal_dumping',
    'overflowing_bins',
    'bad_odor',
    'burning_waste',
    'other',
  ],

  complaintStatuses: ['pending', 'in_progress', 'resolved', 'rejected'],
  complaintPriorities: ['low', 'medium', 'high', 'critical'],

  collectionStatuses: ['scheduled', 'in_progress', 'completed', 'verified', 'disputed'],
  verificationStatuses: ['pending', 'verified', 'suspicious', 'requires_investigation', 'disputed'],

  reportTypes: ['daily', 'weekly', 'monthly'],

  anomalyTypes: [
    'false_reporting',
    'suspicious_duration',
    'repeated_complaints',
    'collection_gap',
    'collector_anomaly',
    'collector_performance',
    'sensor_tamper',
    'no_sensor_data',
  ],

  anomalySeverities: ['low', 'medium', 'high', 'critical'],

  notificationTypes: [
    'collection_reminder',
    'complaint_update',
    'verification_request',
    'alert',
    'system',
  ],
};

module.exports = config;