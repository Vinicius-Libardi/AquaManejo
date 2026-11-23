const speciesService = require('../services/species-service');

function list(request, response) {
  return response.json({ data: speciesService.listSpecies(request.app.locals.database) });
}

function getById(request, response) {
  return response.json({ data: speciesService.getSpecies(request.app.locals.database, request.validated.params.id) });
}

function create(request, response) {
  const species = speciesService.createSpecies(request.app.locals.database, request.validated.body);
  return response.status(201).json({ data: species });
}

module.exports = { create, getById, list };
