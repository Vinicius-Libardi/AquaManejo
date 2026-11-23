const { ApiError } = require('../errors/api-error');

const propertyColumns = {
  name: 'name',
  municipality: 'municipality',
  state: 'state',
  areaHectares: 'area_hectares'
};

function listProperties(database, userId) {
  return database.prepare(`SELECT id, name, municipality, state,
      area_hectares AS areaHectares, created_at AS createdAt
    FROM properties WHERE user_id = ? ORDER BY name, id`).all(userId);
}

function getProperty(database, userId, id) {
  const property = database.prepare(`SELECT id, name, municipality, state,
      area_hectares AS areaHectares, created_at AS createdAt
    FROM properties WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!property) throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Propriedade não encontrada.');
  return property;
}

function createProperty(database, userId, input) {
  const result = database.prepare(`INSERT INTO properties
    (user_id, name, municipality, state, area_hectares) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, input.name, input.municipality ?? null, input.state ?? null, input.areaHectares ?? null);
  return getProperty(database, userId, Number(result.lastInsertRowid));
}

function updateProperty(database, userId, id, input) {
  getProperty(database, userId, id);
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(propertyColumns)) {
    if (Object.hasOwn(input, key)) {
      assignments.push(`${column} = ?`);
      values.push(input[key]);
    }
  }
  database.prepare(`UPDATE properties SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values, id, userId);
  return getProperty(database, userId, id);
}

function deleteProperty(database, userId, id) {
  const result = database.prepare('DELETE FROM properties WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Propriedade não encontrada.');
}

function countProperties(database, userId) {
  return database.prepare('SELECT COUNT(*) AS total FROM properties WHERE user_id = ?').get(userId).total;
}

module.exports = { createProperty, countProperties, deleteProperty, getProperty, listProperties, updateProperty };
