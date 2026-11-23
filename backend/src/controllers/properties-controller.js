const propertiesService = require('../services/properties-service');

function list(request, response) {
  return response.json({ data: propertiesService.listProperties(request.app.locals.database, request.user.id) });
}

function getById(request, response) {
  const { id } = request.validated.params;
  return response.json({ data: propertiesService.getProperty(request.app.locals.database, request.user.id, id) });
}

function create(request, response) {
  const property = propertiesService.createProperty(request.app.locals.database, request.user.id, request.validated.body);
  return response.status(201).json({ data: property });
}

function update(request, response) {
  const { id } = request.validated.params;
  const property = propertiesService.updateProperty(request.app.locals.database, request.user.id, id, request.validated.body);
  return response.json({ data: property });
}

function remove(request, response) {
  propertiesService.deleteProperty(request.app.locals.database, request.user.id, request.validated.params.id);
  return response.status(204).end();
}

module.exports = { create, getById, list, remove, update };
