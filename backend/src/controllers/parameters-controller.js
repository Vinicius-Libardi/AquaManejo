const parametersService = require('../services/parameters-service');

function list(request, response) {
  return response.json({ data: parametersService.listParameters(request.app.locals.database) });
}

function getById(request, response) {
  return response.json({ data: parametersService.getParameter(request.app.locals.database, request.validated.params.id) });
}

function create(request, response) {
  const parameter = parametersService.createParameter(request.app.locals.database, request.validated.body);
  return response.status(201).json({ data: parameter });
}

module.exports = { create, getById, list };
