const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');

const dashboardController = require('../controllers/dashboard.controller');

router.use(protect);

router.get('/admin', dashboardController.admin);
router.get('/officer', dashboardController.officer);
router.get('/landlord', dashboardController.landlord);
router.get('/collector', dashboardController.collector);
router.get('/resident', dashboardController.resident);
router.get('/collector/coach-tips', dashboardController.coachTips);

module.exports = router;
