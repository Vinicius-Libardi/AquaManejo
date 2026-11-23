const { ApiError } = require('../errors/api-error');

function createUser(database, input) {
  const result = database.prepare('INSERT INTO users (name) VALUES (?)').run(input.name);
  return getUser(database, Number(result.lastInsertRowid));
}

function getUser(database, id) {
  const user = database.prepare(`SELECT id, name, created_at AS createdAt
    FROM users WHERE id = ?`).get(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  return user;
}

module.exports = { createUser, getUser };
