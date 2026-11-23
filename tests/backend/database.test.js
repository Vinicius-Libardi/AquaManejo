const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { initializeDatabase } = require('../../backend/src/database');

const expectedTables = [
  'users',
  'properties',
  'ponds',
  'species',
  'water_parameters',
  'measurements',
  'technical_references'
  , 'auth_sessions', 'quality_analyses', 'quality_analysis_items'
];

function withDatabase(callback) {
  const database = initializeDatabase(':memory:');
  try {
    return callback(database);
  } finally {
    database.close();
  }
}

function insertBaseRecords(database) {
  const userId = database.prepare('INSERT INTO users (name) VALUES (?)').run('Usuário de teste').lastInsertRowid;
  const propertyId = database.prepare('INSERT INTO properties (user_id, name) VALUES (?, ?)').run(userId, 'Propriedade de teste').lastInsertRowid;
  const speciesId = database.prepare('INSERT INTO species (common_name) VALUES (?)').run('Espécie de teste').lastInsertRowid;
  const parameterId = database.prepare('INSERT INTO water_parameters (name, unit) VALUES (?, ?)').run('Parâmetro de teste', 'unidade de teste').lastInsertRowid;
  const pondId = database.prepare('INSERT INTO ponds (property_id, species_id, name) VALUES (?, ?, ?)').run(propertyId, speciesId, 'Viveiro de teste').lastInsertRowid;
  return { userId, propertyId, speciesId, parameterId, pondId };
}

test('migra o esquema sem dados operacionais, ativa FKs e inclui catálogo com fonte documentada', () => {
  withDatabase((database) => {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
    assert.deepEqual(tables, [...expectedTables].sort());
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
    for (const table of ['users', 'properties', 'ponds', 'measurements', 'auth_sessions', 'quality_analyses', 'quality_analysis_items']) {
      assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0, `${table} não recebe registros de produtor`);
    }
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM species').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM water_parameters').get().count, 6);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM technical_references').get().count, 20);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM technical_references WHERE source_url LIKE '%asc-aqua.org%' AND reference_version = '1.0.1'").get().count, 20);
  });
});

test('aplica relacionamentos e rejeita referências a registros inexistentes', () => {
  withDatabase((database) => {
    const { propertyId, speciesId, parameterId, pondId } = insertBaseRecords(database);
    assert.throws(() => database.prepare('INSERT INTO properties (user_id, name) VALUES (?, ?)').run(9999, 'Propriedade órfã'));
    assert.throws(() => database.prepare('INSERT INTO ponds (property_id, name) VALUES (?, ?)').run(9999, 'Viveiro órfão'));
    assert.throws(() => database.prepare('INSERT INTO ponds (property_id, species_id, name) VALUES (?, ?, ?)').run(propertyId, 9999, 'Viveiro sem espécie'));
    assert.throws(() => database.prepare('INSERT INTO measurements (pond_id, parameter_id, value, unit) VALUES (?, ?, ?, ?)').run(9999, parameterId, 1, 'unidade'));
    assert.throws(() => database.prepare('INSERT INTO measurements (pond_id, parameter_id, value, unit) VALUES (?, ?, ?, ?)').run(pondId, 9999, 1, 'unidade'));
    assert.throws(() => database.prepare(`INSERT INTO technical_references
      (species_id, parameter_id, title, source_name, unit) VALUES (?, ?, ?, ?, ?)`)
      .run(9999, parameterId, 'Referência de teste', 'Fonte de teste', 'unidade'));
    assert.throws(() => database.prepare(`INSERT INTO technical_references
      (species_id, parameter_id, title, source_name, unit) VALUES (?, ?, ?, ?, ?)`)
      .run(speciesId, 9999, 'Referência de teste', 'Fonte de teste', 'unidade'));
  });
});

test('rejeita nomes vazios, valores inválidos e intervalos de referência invertidos', () => {
  withDatabase((database) => {
    const { userId, speciesId, parameterId, pondId } = insertBaseRecords(database);
    assert.throws(() => database.prepare('INSERT INTO users (name) VALUES (?)').run('   '));
    assert.throws(() => database.prepare('INSERT INTO properties (user_id, name, area_hectares) VALUES (?, ?, ?)').run(userId, 'Área inválida', 0));
    assert.throws(() => database.prepare('INSERT INTO measurements (pond_id, parameter_id, value, unit) VALUES (?, ?, ?, ?)').run(pondId, parameterId, 1, '   '));
    assert.throws(() => database.prepare('INSERT INTO measurements (pond_id, parameter_id, value, unit) VALUES (?, ?, ?, ?)').run(pondId, parameterId, 'valor inválido', 'unidade'));
    assert.throws(() => database.prepare(`INSERT INTO measurements (pond_id, parameter_id, value, unit, measured_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(pondId, parameterId, 1, 'unidade', 'data inválida'));
    assert.throws(() => database.prepare(`INSERT INTO measurements (pond_id, parameter_id, value, unit, measured_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(pondId, parameterId, 1, 'unidade', '2026-11-22 10:00:00'));
    assert.throws(() => database.prepare(`INSERT INTO technical_references
      (species_id, parameter_id, title, source_name, minimum_value, maximum_value, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(speciesId, parameterId, 'Referência de teste', 'Fonte de teste', 10, 5, 'unidade'));
    assert.throws(() => database.prepare(`INSERT INTO technical_references
      (species_id, parameter_id, title, source_name, minimum_value, unit)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(speciesId, parameterId, 'Referência de teste', 'Fonte de teste', 'valor inválido', 'unidade'));
  });
});

test('aceita referências vinculadas sem limites técnicos preenchidos', () => {
  withDatabase((database) => {
    const { speciesId, parameterId } = insertBaseRecords(database);
    const referenceId = database.prepare(`INSERT INTO technical_references
      (species_id, parameter_id, title, source_name, cultivation_phase, culture_system, conditions, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(speciesId, parameterId, 'Referência de teste', 'Fonte de teste', 'Fase de teste', 'Sistema de teste', 'Condição de teste', 'unidade').lastInsertRowid;
    const reference = database.prepare('SELECT * FROM technical_references WHERE id = ?').get(referenceId);
    assert.equal(reference.species_id, speciesId);
    assert.equal(reference.parameter_id, parameterId);
    assert.equal(reference.minimum_value, null);
    assert.equal(reference.maximum_value, null);
    assert.equal(reference.conditions, 'Condição de teste');
  });
});

test('consulta medições de um viveiro em ordem cronológica e mantém unidades e horários', () => {
  withDatabase((database) => {
    const { propertyId, parameterId, pondId } = insertBaseRecords(database);
    const otherPondId = database.prepare('INSERT INTO ponds (property_id, name) VALUES (?, ?)').run(propertyId, 'Outro viveiro de teste').lastInsertRowid;
    const insertMeasurement = database.prepare(`INSERT INTO measurements (pond_id, parameter_id, value, unit, measured_at)
      VALUES (?, ?, ?, ?, ?)`);
    insertMeasurement.run(pondId, parameterId, 12.5, 'unidade A', '2026-11-20T10:00:00.000Z');
    insertMeasurement.run(pondId, parameterId, 13.5, 'unidade B', '2026-11-22T10:00:00.000Z');
    insertMeasurement.run(otherPondId, parameterId, 99, 'unidade C', '2026-11-22T11:00:00.000Z');

    const history = database.prepare(`SELECT value, unit, measured_at FROM measurements
      WHERE pond_id = ? ORDER BY measured_at DESC, id DESC`).all(pondId);
    assert.deepEqual(history.map((row) => row.value), [13.5, 12.5]);
    assert.equal(history[0].unit, 'unidade B');
    assert.equal(history[0].measured_at, '2026-11-22T10:00:00.000Z');
    assert.equal(database.pragma('index_list(measurements)').some((index) => index.name === 'idx_measurements_pond_history'), true);
  });
});

test('reinicializa o esquema sem apagar dados e cria a pasta do arquivo automaticamente', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aquamanejo-db-'));
  const databasePath = path.join(temporaryDirectory, 'nested', 'aquamanejo.sqlite');
  let database = initializeDatabase(databasePath);
  database.prepare('INSERT INTO users (name) VALUES (?)').run('Registro preservado');
  database.close();

  try {
    database = initializeDatabase(databasePath);
    assert.equal(database.prepare('SELECT name FROM users').get().name, 'Registro preservado');
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
    assert.ok(fs.existsSync(databasePath));
  } finally {
    if (database?.open) database.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
