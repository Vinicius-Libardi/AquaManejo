const { ApiError } = require('../errors/api-error');

const pondColumns = {
  propertyId: 'property_id',
  speciesId: 'species_id',
  name: 'name',
  structureType: 'structure_type',
  cultivationPhase: 'cultivation_phase',
  volumeM3: 'volume_m3',
  cultureSystem: 'culture_system',
  waterType: 'water_type',
  salinityPpt: 'salinity_ppt'
};

function getProperty(database, userId, propertyId) {
  const property = database.prepare('SELECT id FROM properties WHERE id = ? AND user_id = ?').get(propertyId, userId);
  if (!property) throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Propriedade não encontrada.');
}

function getSpecies(database, speciesId) {
  const species = database.prepare('SELECT id FROM species WHERE id = ?').get(speciesId);
  if (!species) throw new ApiError(404, 'SPECIES_NOT_FOUND', 'Espécie não encontrada.');
}

function listPondsByProperty(database, userId, propertyId) {
  getProperty(database, userId, propertyId);
  return database.prepare(`SELECT ponds.id, ponds.property_id AS propertyId,
      ponds.species_id AS speciesId, species.common_name AS speciesName,
      ponds.name, ponds.structure_type AS structureType,
      ponds.cultivation_phase AS cultivationPhase, ponds.volume_m3 AS volumeM3,
      ponds.culture_system AS cultureSystem, ponds.water_type AS waterType,
      ponds.salinity_ppt AS salinityPpt,
      ponds.created_at AS createdAt
    FROM ponds LEFT JOIN species ON species.id = ponds.species_id
    WHERE ponds.property_id = ? ORDER BY ponds.name, ponds.id`).all(propertyId);
}

function getPond(database, userId, id) {
  const pond = database.prepare(`SELECT ponds.id, ponds.property_id AS propertyId,
      ponds.species_id AS speciesId, species.common_name AS speciesName,
      ponds.name, ponds.structure_type AS structureType,
      ponds.cultivation_phase AS cultivationPhase, ponds.volume_m3 AS volumeM3,
      ponds.culture_system AS cultureSystem, ponds.water_type AS waterType,
      ponds.salinity_ppt AS salinityPpt,
      ponds.created_at AS createdAt
    FROM ponds
    JOIN properties ON properties.id = ponds.property_id
    LEFT JOIN species ON species.id = ponds.species_id
    WHERE ponds.id = ? AND properties.user_id = ?`).get(id, userId);
  if (!pond) throw new ApiError(404, 'POND_NOT_FOUND', 'Viveiro ou tanque não encontrado.');
  return pond;
}

function createPond(database, userId, input) {
  getProperty(database, userId, input.propertyId);
  if (input.speciesId != null) getSpecies(database, input.speciesId);
  const result = database.prepare(`INSERT INTO ponds
    (property_id, species_id, name, structure_type, cultivation_phase, volume_m3, culture_system, water_type, salinity_ppt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.propertyId, input.speciesId ?? null, input.name,
      input.structureType ?? null, input.cultivationPhase ?? null, input.volumeM3 ?? null,
      input.cultureSystem ?? null, input.waterType ?? null, input.salinityPpt ?? null);
  return getPond(database, userId, Number(result.lastInsertRowid));
}

function updatePond(database, userId, id, input) {
  getPond(database, userId, id);
  if (Object.hasOwn(input, 'propertyId')) getProperty(database, userId, input.propertyId);
  if (Object.hasOwn(input, 'speciesId') && input.speciesId != null) getSpecies(database, input.speciesId);

  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(pondColumns)) {
    if (Object.hasOwn(input, key)) {
      assignments.push(`${column} = ?`);
      values.push(input[key]);
    }
  }
  database.prepare(`UPDATE ponds SET ${assignments.join(', ')} WHERE id = ? AND property_id IN
    (SELECT id FROM properties WHERE user_id = ?)`)
    .run(...values, id, userId);
  return getPond(database, userId, id);
}

function deletePond(database, userId, id) {
  getPond(database, userId, id);
  const result = database.prepare(`DELETE FROM ponds WHERE id = ? AND property_id IN
    (SELECT id FROM properties WHERE user_id = ?)`)
    .run(id, userId);
  if (result.changes === 0) throw new ApiError(404, 'POND_NOT_FOUND', 'Viveiro ou tanque não encontrado.');
}

function countPonds(database, userId) {
  return database.prepare(`SELECT COUNT(*) AS total FROM ponds
    JOIN properties ON properties.id = ponds.property_id WHERE properties.user_id = ?`).get(userId).total;
}

module.exports = { countPonds, createPond, deletePond, getPond, listPondsByProperty, updatePond };
