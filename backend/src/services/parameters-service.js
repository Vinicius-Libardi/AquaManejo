const { ApiError } = require('../errors/api-error');

function listParameters(database) {
  return database.prepare(`SELECT id, name, unit, description, analyte_code AS analyteCode, created_at AS createdAt
    FROM water_parameters ORDER BY name COLLATE NOCASE, id`).all();
}

function getParameter(database, id) {
  const parameter = database.prepare(`SELECT id, name, unit, description, analyte_code AS analyteCode, created_at AS createdAt
    FROM water_parameters WHERE id = ?`).get(id);
  if (!parameter) throw new ApiError(404, 'PARAMETER_NOT_FOUND', 'Parâmetro não encontrado.');
  return parameter;
}

function createParameter(database, input) {
  const result = database.prepare('INSERT INTO water_parameters (name, unit, description, analyte_code) VALUES (?, ?, ?, ?)')
    .run(input.name, input.unit, input.description ?? null, input.analyteCode ?? null);
  return getParameter(database, Number(result.lastInsertRowid));
}

module.exports = { createParameter, getParameter, listParameters };
