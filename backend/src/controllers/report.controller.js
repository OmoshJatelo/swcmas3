const reportService = require('../services/report.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /reports – list (admin/officer)
const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const result = await reportService.listReports({ filter, page, limit });
    res.json(new ApiResponse({ data: result }));
  } catch (err) {
    next(err);
  }
};

// GET /reports/:id – detail
const getOne = async (req, res, next) => {
  try {
    const report = await reportService.getReport(req.params.id);
    res.json(new ApiResponse({ data: report }));
  } catch (err) {
    next(err);
  }
};

// POST /reports – generate a new report (admin/officer)
const create = async (req, res, next) => {
  try {
    const { type, periodStart, periodEnd } = req.body;
    const generatedBy = req.user._id;
    const report = await reportService.generateReport({ type, periodStart, periodEnd, generatedBy });
    res.status(201).json(new ApiResponse({ data: report }));
  } catch (err) {
    next(err);
  }
};

// GET /reports/:id/export?format=csv – download report as CSV
const exportCsv = async (req, res, next) => {
  try {
    const { filename, csv } = await reportService.exportReportCsv(req.params.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, exportCsv };
