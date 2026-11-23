const measurementsService = require('../services/measurements-service');

function list(request, response) {
  const filters = request.validated.query;
  const data = measurementsService.listMeasurements(request.app.locals.database, request.user.id, filters);
  return response.json({ data });
}

function listByPond(request, response) {
  const { pondId } = request.validated.params;
  const data = measurementsService.listPondMeasurements(request.app.locals.database, request.user.id, pondId, request.validated.query);
  return response.json({ data });
}

function getById(request, response) {
  const { id } = request.validated.params;
  return response.json({ data: measurementsService.getMeasurement(request.app.locals.database, request.user.id, id) });
}

function create(request, response) {
  const measurement = measurementsService.createMeasurement(request.app.locals.database, request.user.id, request.validated.body);
  return response.status(201).json({ data: measurement });
}

function remove(request, response) {
  measurementsService.deleteMeasurement(request.app.locals.database, request.user.id, request.validated.params.id);
  return response.status(204).end();
}

module.exports = { create, getById, list, listByPond, remove };
