const analysisService = require('../services/quality-analysis-service');

function create(request, response) {
  const { id } = request.validated.params;
  return response.status(201).json({ data: analysisService.analyzeMeasurement(
    request.app.locals.database, request.user.id, id
  ) });
}

function getLatest(request, response) {
  const { id } = request.validated.params;
  return response.json({ data: analysisService.getLatestAnalysis(request.app.locals.database, request.user.id, id) });
}

module.exports = { create, getLatest };
