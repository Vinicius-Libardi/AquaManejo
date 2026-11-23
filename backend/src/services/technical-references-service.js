const { ApiError } = require('../errors/api-error');
const { getSpecies } = require('./species-service');
const { getParameter } = require('./parameters-service');

const referenceColumns = {
  speciesId: 'species_id',
  parameterId: 'parameter_id',
  title: 'title',
  sourceName: 'source_name',
  sourceUrl: 'source_url',
  publishedYear: 'published_year',
  cultivationPhase: 'cultivation_phase',
  cultureSystem: 'culture_system',
  conditions: 'conditions',
  minimumValue: 'minimum_value',
  maximumValue: 'maximum_value',
  unit: 'unit',
  notes: 'notes',
  classification: 'classification',
  referenceVersion: 'reference_version',
  minimumInclusive: 'minimum_inclusive',
  maximumInclusive: 'maximum_inclusive',
  waterType: 'water_type',
  salinityMinPpt: 'salinity_min_ppt',
  salinityMaxPpt: 'salinity_max_ppt'
};

const referenceSelect = `SELECT id, owner_user_id AS ownerUserId, species_id AS speciesId, parameter_id AS parameterId,
    title, source_name AS sourceName, source_url AS sourceUrl,
    published_year AS publishedYear, cultivation_phase AS cultivationPhase,
    culture_system AS cultureSystem, conditions, minimum_value AS minimumValue,
    maximum_value AS maximumValue, unit, notes, classification,
    reference_version AS referenceVersion, minimum_inclusive AS minimumInclusive,
    maximum_inclusive AS maximumInclusive, water_type AS waterType,
    salinity_min_ppt AS salinityMinPpt, salinity_max_ppt AS salinityMaxPpt,
    created_at AS createdAt
  FROM technical_references`;

function listReferences(database, userId, speciesId) {
  if (speciesId != null) getSpecies(database, speciesId);
  const query = speciesId == null
    ? `${referenceSelect} WHERE owner_user_id IS NULL OR owner_user_id = ? ORDER BY title, id`
    : `${referenceSelect} WHERE species_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?) ORDER BY title, id`;
  return speciesId == null ? database.prepare(query).all(userId) : database.prepare(query).all(speciesId, userId);
}

function getReference(database, userId, id) {
  const reference = database.prepare(`${referenceSelect} WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)`).get(id, userId);
  if (!reference) throw new ApiError(404, 'REFERENCE_NOT_FOUND', 'Referência técnica não encontrada.');
  return reference;
}

function validateRelations(database, input) {
  if (input.speciesId != null) getSpecies(database, input.speciesId);
  if (input.parameterId != null) getParameter(database, input.parameterId);
}

function createReference(database, userId, input) {
  validateRelations(database, input);
  if ((input.minimumValue != null || input.maximumValue != null) && !input.classification) {
    throw new ApiError(400, 'REFERENCE_CLASSIFICATION_REQUIRED', 'Informe a classificação técnica das faixas cadastradas.');
  }
  const result = database.prepare(`INSERT INTO technical_references (
      owner_user_id, species_id, parameter_id, title, source_name, source_url, published_year,
      cultivation_phase, culture_system, conditions, minimum_value, maximum_value, unit, notes,
      classification, reference_version, minimum_inclusive, maximum_inclusive, water_type,
      salinity_min_ppt, salinity_max_ppt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, input.speciesId, input.parameterId, input.title, input.sourceName,
      input.sourceUrl ?? null, input.publishedYear ?? null, input.cultivationPhase ?? null,
      input.cultureSystem ?? null, input.conditions ?? null, input.minimumValue ?? null,
      input.maximumValue ?? null, input.unit, input.notes ?? null, input.classification ?? null,
      input.referenceVersion ?? null, input.minimumInclusive === false ? 0 : 1,
      input.maximumInclusive === false ? 0 : 1, input.waterType ?? null,
      input.salinityMinPpt ?? null, input.salinityMaxPpt ?? null);
  return getReference(database, userId, Number(result.lastInsertRowid));
}

function updateReference(database, userId, id, input) {
  const existing = getReference(database, userId, id);
  if (existing.ownerUserId == null) throw new ApiError(403, 'SYSTEM_REFERENCE_READ_ONLY', 'Referências institucionais são somente leitura.');
  const next = { ...existing, ...input };
  if ((next.minimumValue != null || next.maximumValue != null) && !next.classification) {
    throw new ApiError(400, 'REFERENCE_CLASSIFICATION_REQUIRED', 'Informe a classificação técnica das faixas cadastradas.');
  }
  validateRelations(database, input);
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(referenceColumns)) {
    if (Object.hasOwn(input, key)) {
      assignments.push(`${column} = ?`);
      values.push(key === 'minimumInclusive' || key === 'maximumInclusive'
        ? Number(input[key]) : input[key]);
    }
  }
  database.prepare(`UPDATE technical_references SET ${assignments.join(', ')} WHERE id = ? AND owner_user_id = ?`)
    .run(...values, id, userId);
  return getReference(database, userId, id);
}

module.exports = { createReference, getReference, listReferences, updateReference };
