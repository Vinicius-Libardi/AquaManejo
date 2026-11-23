const { ApiError } = require('../errors/api-error');

function notFound(request, response, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Endpoint não encontrado.'));
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error instanceof ApiError) {
    const payload = { error: { code: error.code, message: error.message } };
    if (error.details) payload.error.details = error.details;
    return response.status(error.status).json(payload);
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'O corpo da requisição contém JSON inválido.' } });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição excede o tamanho permitido.' } });
  }
  if (error.code === 'ORIGIN_NOT_ALLOWED') {
    return response.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origem não permitida.' } });
  }

  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    return response.status(409).json({ error: { code: 'DUPLICATE_RESOURCE', message: 'Já existe um registro com esses dados.' } });
  }
  // SQLite reports some ON DELETE RESTRICT constraints as trigger violations.
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.code === 'SQLITE_CONSTRAINT_TRIGGER') {
    return response.status(409).json({ error: { code: 'RELATIONSHIP_CONFLICT', message: 'O registro está relacionado a outros dados e não pode ser removido.' } });
  }
  if (error.code === 'SQLITE_CONSTRAINT_CHECK' || error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
    return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Os dados violam uma restrição do banco de dados.' } });
  }

  // Detalhes internos do SQLite e do servidor não são enviados ao cliente.
  console.error(error);
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno.' } });
}

module.exports = { errorHandler, notFound };
