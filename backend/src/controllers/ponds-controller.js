const pondsService = require('../services/ponds-service');

function listByProperty(request, response) {
  const { propertyId } = request.validated.params;
  return response.json({ data: pondsService.listPondsByProperty(request.app.locals.database, request.user.id, propertyId) });
}

function getById(request, response) {
  const { id } = request.validated.params;
  return response.json({ data: pondsService.getPond(request.app.locals.database, request.user.id, id) });
}

function create(request, response) {
  const pond = pondsService.createPond(request.app.locals.database, request.user.id, request.validated.body);
  return response.status(201).json({ data: pond });
}

function update(request, response) {
  const { id } = request.validated.params;
  const pond = pondsService.updatePond(request.app.locals.database, request.user.id, id, request.validated.body);
  return response.json({ data: pond });
}

function remove(request, response) {
  pondsService.deletePond(request.app.locals.database, request.user.id, request.validated.params.id);
  return response.status(204).end();
}

module.exports = { create, getById, listByProperty, remove, update };
