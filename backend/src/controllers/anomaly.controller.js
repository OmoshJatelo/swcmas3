const anomalyService = require('../services/anomaly.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /anomalies – list (admin/officer)
const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.isResolved !== undefined) filter.isResolved = req.query.isResolved === 'true';
    const result = await anomalyService.listAlerts({ filter, page, limit });
    res.json(new ApiResponse({ data: result }));
  } catch (err) {
    next(err);
  }
};

// PATCH /anomalies/:id/resolve – resolve alert
const resolve = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    const alert = await anomalyService.resolveAlert(req.params.id, req.user._id, resolution);
    res.json(new ApiResponse({ data: alert }));
  } catch (err) {
    next(err);
  }
};

// GET /anomalies/:id/playbook – get AI remediation playbook
const getPlaybook = async (req, res, next) => {
  try {
    const playbook = await anomalyService.getPlaybook(req.params.id);
    res.json(new ApiResponse({ data: playbook }));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, resolve, getPlaybook };
