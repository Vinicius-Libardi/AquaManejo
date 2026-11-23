const { ApiError } = require('../errors/api-error');
const { getPond } = require('./ponds-service');
const { getParameter } = require('./parameters-service');

const measurementSelect = `SELECT measurements.id, measurements.pond_id AS pondId,
    ponds.name AS pondName, properties.id AS propertyId, properties.name AS propertyName,
    measurements.parameter_id AS parameterId, water_parameters.name AS parameterName,
    measurements.value, measurements.unit, measurements.measured_at AS measuredAt,
    measurements.notes, measurements.created_at AS createdAt
    ,(SELECT quality_analyses.classification FROM quality_analyses
      WHERE quality_analyses.measurement_id = measurements.id
      ORDER BY quality_analyses.id DESC LIMIT 1) AS analysisClassification
  FROM measurements
  JOIN ponds ON ponds.id = measurements.pond_id
  JOIN properties ON properties.id = ponds.property_id
  JOIN water_parameters ON water_parameters.id = measurements.parameter_id`;

function listMeasurements(database, userId, filters = {}) {
  const conditions = ['properties.user_id = ?'];
  const values = [userId];
  if (filters.pondId != null) {
    conditions.push('measurements.pond_id = ?');
    values.push(filters.pondId);
  }
  if (filters.parameterId != null) {
    conditions.push('measurements.parameter_id = ?');
    values.push(filters.parameterId);
  }
  if (filters.from) {
    conditions.push('measurements.measured_at >= ?');
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push('measurements.measured_at <= ?');
    values.push(filters.to);
  }

  return database.prepare(`${measurementSelect}
    WHERE ${conditions.join(' AND ')}
    ORDER BY measurements.measured_at DESC, measurements.id DESC`).all(...values);
}

function getMeasurement(database, userId, id) {
  const measurement = database.prepare(`${measurementSelect}
    WHERE measurements.id = ? AND properties.user_id = ?`).get(id, userId);
  if (!measurement) throw new ApiError(404, 'MEASUREMENT_NOT_FOUND', 'Medição não encontrada.');
  return measurement;
}

function createMeasurement(database, userId, input) {
  getPond(database, userId, input.pondId);
  getParameter(database, input.parameterId);

  let result;
  if (input.measuredAt) {
    result = database.prepare(`INSERT INTO measurements
      (pond_id, parameter_id, value, unit, measured_at, notes) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(input.pondId, input.parameterId, input.value, input.unit, input.measuredAt, input.notes ?? null);
  } else {
    result = database.prepare(`INSERT INTO measurements
      (pond_id, parameter_id, value, unit, notes) VALUES (?, ?, ?, ?, ?)`)
      .run(input.pondId, input.parameterId, input.value, input.unit, input.notes ?? null);
  }

  return getMeasurement(database, userId, Number(result.lastInsertRowid));
}

function listPondMeasurements(database, userId, pondId, filters = {}) {
  getPond(database, userId, pondId);
  return listMeasurements(database, userId, { ...filters, pondId });
}

function deleteMeasurement(database, userId, id) {
  const result = database.prepare(`DELETE FROM measurements WHERE id = ? AND pond_id IN (
      SELECT ponds.id FROM ponds
      JOIN properties ON properties.id = ponds.property_id
      WHERE properties.user_id = ?
    )`).run(id, userId);
  if (result.changes === 0) throw new ApiError(404, 'MEASUREMENT_NOT_FOUND', 'Medição não encontrada.');
}

function countMeasurements(database, userId) {
  return database.prepare(`SELECT COUNT(*) AS total FROM measurements
    JOIN ponds ON ponds.id = measurements.pond_id
    JOIN properties ON properties.id = ponds.property_id
    WHERE properties.user_id = ?`).get(userId).total;
}

module.exports = {
  countMeasurements,
  createMeasurement,
  deleteMeasurement,
  getMeasurement,
  listMeasurements,
  listPondMeasurements
};
