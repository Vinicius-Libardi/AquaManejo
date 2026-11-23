const { DEFAULT_DATABASE_PATH, openDatabase } = require('./connection');
const { createSchema } = require('./schema');
const { initializeDatabase } = require('./initialize');

module.exports = {
  DEFAULT_DATABASE_PATH,
  openDatabase,
  createSchema,
  initializeDatabase
};
