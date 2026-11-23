const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DEFAULT_DATABASE_PATH = path.resolve(__dirname, '../../data/aquamanejo.sqlite');

function openDatabase(databasePath = DEFAULT_DATABASE_PATH) {
  const resolvedPath = databasePath === ':memory:' ? databasePath : path.resolve(databasePath);

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const database = new Database(resolvedPath);
  database.pragma('foreign_keys = ON');

  // O SQLite exige que a opção seja habilitada em cada conexão.
  if (database.pragma('foreign_keys', { simple: true }) !== 1) {
    database.close();
    throw new Error('Não foi possível ativar as chaves estrangeiras do SQLite.');
  }

  return database;
}

module.exports = { DEFAULT_DATABASE_PATH, openDatabase };
