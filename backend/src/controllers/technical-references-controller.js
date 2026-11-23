const referencesService = require('../services/technical-references-service');

function list(request, response) {
  const speciesId = request.validated.query.speciesId;
  return response.json({ data: referencesService.listReferences(request.app.locals.database, request.user.id, speciesId) });
}

function listBySpecies(request, response) {
  const { speciesId } = request.validated.params;
  return response.json({ data: referencesService.listReferences(request.app.locals.database, request.user.id, speciesId) });
}

function getById(request, response) {
  return response.json({ data: referencesService.getReference(request.app.locals.database, request.user.id, request.validated.params.id) });
}

function create(request, response) {
  const reference = referencesService.createReference(request.app.locals.database, request.user.id, request.validated.body);
  return response.status(201).json({ data: reference });
}

function update(request, response) {
  const reference = referencesService.updateReference(request.app.locals.database, request.user.id, request.validated.params.id, request.validated.body);
  return response.json({ data: reference });
}

module.exports = { create, getById, list, listBySpecies, update };
