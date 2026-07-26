const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const connectDB = require('./config/database');
const morgan = require('morgan');

// routers (placeholders for now)
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const apartmentRoutes = require('./routes/apartment.routes');
const collectionRoutes = require('./routes/collection.routes');
const complaintRoutes = require('./routes/complaint.routes');
const aiRoutes = require('./routes/ai.routes');
const reportRoutes = require('./routes/report.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationRoutes = require('./routes/notification.routes');
const anomalyRoutes = require('./routes/anomaly.routes');
const auditRoutes = require('./routes/audit.routes');
const mapRoutes = require('./routes/map.routes');
const residentVerificationRoutes = require('./routes/residentVerification.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const sensorRoutes = require('./routes/sensor.routes');
const forecastingRoutes = require('./routes/forecasting.routes');

const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Database connection
connectDB();

// Start automated collection scheduler
const collectionScheduler = require('./services/collectionScheduler.service');
collectionScheduler.start();

// Start automated anomaly detections
const anomalyService = require('./services/anomaly.service');
const cron = require('node-cron');
cron.schedule('0 3 * * *', async () => {
  try {
    await anomalyService.runDetections();
  } catch (err) {
    logger.error('Anomaly detections failed: %s', err.message);
  }
});
// Run once on startup for dev purposes
anomalyService.runDetections().catch(e => logger.error('Initial anomaly detection error: %s', e.message));

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (ESP32, curl, server-to-server)
    if (!origin) return cb(null, true);
    // Allow configured origins
    if (config.allowedOrigins.includes(origin)) return cb(null, true);
    // Allow ngrok tunnels
    if (/\.ngrok(-free)?\.app$/.test(origin) || /\.ngrok\.io$/.test(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());
app.use(xss());
app.use(rateLimiter);

// Serve uploaded files in local dev mode
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API prefix
app.use(config.apiPrefix, (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/users`, userRoutes);
app.use(`${config.apiPrefix}/apartments`, apartmentRoutes);
app.use(`${config.apiPrefix}/collections`, collectionRoutes);
app.use(`${config.apiPrefix}/complaints`, complaintRoutes);
app.use(`${config.apiPrefix}/ai`, aiRoutes);
app.use(`${config.apiPrefix}/reports`, reportRoutes);
app.use(`${config.apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${config.apiPrefix}/notifications`, notificationRoutes);
app.use(`${config.apiPrefix}/anomalies`, anomalyRoutes);
app.use(`${config.apiPrefix}/audit`, auditRoutes);
app.use(`${config.apiPrefix}/maps`, mapRoutes);
app.use(`${config.apiPrefix}/verifications`, residentVerificationRoutes);
app.use(`${config.apiPrefix}/invoices`, invoiceRoutes);
app.use(`${config.apiPrefix}/sensors`, sensorRoutes);
app.use(`${config.apiPrefix}/forecasting`, forecastingRoutes);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 404 handler
app.use((req, res, next) => {
  const ApiError = require('./utils/ApiError');
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Error handler
app.use(errorHandler);

module.exports = app;
