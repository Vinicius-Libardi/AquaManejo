function getSummary(database, userId) {
  const properties = database.prepare('SELECT COUNT(*) AS total FROM properties WHERE user_id = ?').get(userId).total;
  const ponds = database.prepare(`SELECT COUNT(*) AS total FROM ponds
    JOIN properties ON properties.id = ponds.property_id WHERE properties.user_id = ?`).get(userId).total;
  const measurements = database.prepare(`SELECT COUNT(*) AS total FROM measurements
    JOIN ponds ON ponds.id = measurements.pond_id
    JOIN properties ON properties.id = ponds.property_id
    WHERE properties.user_id = ?`).get(userId).total;
  return { properties, ponds, measurements };
}

module.exports = { getSummary };
