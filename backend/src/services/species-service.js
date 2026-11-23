const { ApiError } = require('../errors/api-error');

function listSpecies(database) {
  return database.prepare(`SELECT id, common_name AS commonName,
      scientific_name AS scientificName, created_at AS createdAt
    FROM species ORDER BY common_name COLLATE NOCASE, id`).all();
}

function getSpecies(database, id) {
  const species = database.prepare(`SELECT id, common_name AS commonName,
      scientific_name AS scientificName, created_at AS createdAt
    FROM species WHERE id = ?`).get(id);
  if (!species) throw new ApiError(404, 'SPECIES_NOT_FOUND', 'Espécie não encontrada.');
  return species;
}

function createSpecies(database, input) {
  const result = database.prepare('INSERT INTO species (common_name, scientific_name) VALUES (?, ?)')
    .run(input.commonName, input.scientificName ?? null);
  return getSpecies(database, Number(result.lastInsertRowid));
}

module.exports = { createSpecies, getSpecies, listSpecies };
