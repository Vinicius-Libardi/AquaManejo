const { ApiError } = require('../errors/api-error');
const usersService = require('../services/users-service');

function create(request, response) {
  const user = usersService.createUser(request.app.locals.database, request.validated.body);
  return response.status(201).json({ data: user });
}

function getById(request, response) {
  const { id } = request.validated.params;
  if (request.user.id !== id) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  return response.json({ data: usersService.getUser(request.app.locals.database, id) });
}

module.exports = { create, getById };
