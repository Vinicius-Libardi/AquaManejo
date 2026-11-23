const { createSchema } = require('./schema');
const { DEFAULT_DATABASE_PATH, openDatabase } = require('./connection');
const { seedTechnicalReferences } = require('./technical-reference-seed');

function initializeDatabase(databasePath = process.env.AQUAMANEJO_DB_PATH || DEFAULT_DATABASE_PATH) {
  let database;

  try {
    database = openDatabase(databasePath);
    createSchema(database);
    database.transaction(() => seedTechnicalReferences(database))();
    return database;
  } catch (error) {
    if (database?.open) database.close();
    throw error;
  }
}

module.exports = { initializeDatabase };
