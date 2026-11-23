const { ApiError } = require('../errors/api-error');

// A autenticação futura deve preencher req.user a partir de uma sessão ou token validado.
// Nunca aceite o identificador do produtor diretamente do corpo, query ou cabeçalho livre.
function requireAuthenticatedUser(request, response, next) {
  const userId = request.user?.id;

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação necessária para acessar este recurso.'));
  }

  return next();
}

module.exports = { requireAuthenticatedUser };
