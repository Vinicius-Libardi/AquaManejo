const schemaSql = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    email TEXT COLLATE NOCASE UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    municipality TEXT CHECK (municipality IS NULL OR length(trim(municipality)) > 0),
    state TEXT CHECK (state IS NULL OR length(trim(state)) > 0),
    area_hectares REAL CHECK (area_hectares IS NULL OR (area_hectares > 0 AND area_hectares < 1.0e308)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS species (
    id INTEGER PRIMARY KEY,
    common_name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(common_name)) > 0),
    scientific_name TEXT COLLATE NOCASE CHECK (scientific_name IS NULL OR length(trim(scientific_name)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (common_name)
  );

  CREATE TABLE IF NOT EXISTS ponds (
    id INTEGER PRIMARY KEY,
    property_id INTEGER NOT NULL,
    species_id INTEGER,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    structure_type TEXT CHECK (structure_type IS NULL OR length(trim(structure_type)) > 0),
    cultivation_phase TEXT CHECK (cultivation_phase IS NULL OR length(trim(cultivation_phase)) > 0),
    volume_m3 REAL CHECK (volume_m3 IS NULL OR (volume_m3 > 0 AND volume_m3 < 1.0e308)),
    culture_system TEXT CHECK (culture_system IS NULL OR length(trim(culture_system)) > 0),
    water_type TEXT CHECK (water_type IS NULL OR water_type IN ('freshwater', 'brackish', 'saltwater')),
    salinity_ppt REAL CHECK (salinity_ppt IS NULL OR (salinity_ppt >= 0 AND salinity_ppt < 1.0e308)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (species_id) REFERENCES species(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE (property_id, name)
  );

  CREATE TABLE IF NOT EXISTS water_parameters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    description TEXT CHECK (description IS NULL OR length(trim(description)) > 0),
    analyte_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name)
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY,
    pond_id INTEGER NOT NULL,
    parameter_id INTEGER NOT NULL,
    value REAL NOT NULL CHECK (typeof(value) IN ('integer', 'real') AND value = value AND abs(value) < 1.0e308),
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    measured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      CHECK (
        length(measured_at) = 24
        AND substr(measured_at, 11, 1) = 'T'
        AND substr(measured_at, 24, 1) = 'Z'
        AND strftime('%Y-%m-%dT%H:%M:%fZ', measured_at) = measured_at
      ),
    notes TEXT CHECK (notes IS NULL OR length(trim(notes)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pond_id) REFERENCES ponds(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (parameter_id) REFERENCES water_parameters(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS technical_references (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER,
    species_id INTEGER NOT NULL,
    parameter_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
    source_url TEXT CHECK (source_url IS NULL OR length(trim(source_url)) > 0),
    published_year INTEGER CHECK (published_year IS NULL OR published_year BETWEEN 1000 AND 9999),
    cultivation_phase TEXT CHECK (cultivation_phase IS NULL OR length(trim(cultivation_phase)) > 0),
    culture_system TEXT CHECK (culture_system IS NULL OR length(trim(culture_system)) > 0),
    conditions TEXT CHECK (conditions IS NULL OR length(trim(conditions)) > 0),
    minimum_value REAL CHECK (minimum_value IS NULL OR (typeof(minimum_value) IN ('integer', 'real') AND minimum_value = minimum_value AND abs(minimum_value) < 1.0e308)),
    maximum_value REAL CHECK (maximum_value IS NULL OR (typeof(maximum_value) IN ('integer', 'real') AND maximum_value = maximum_value AND abs(maximum_value) < 1.0e308)),
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    notes TEXT CHECK (notes IS NULL OR length(trim(notes)) > 0),
    classification TEXT CHECK (classification IS NULL OR classification IN ('adequate', 'attention', 'critical')),
    reference_version TEXT,
    minimum_inclusive INTEGER NOT NULL DEFAULT 1 CHECK (minimum_inclusive IN (0, 1)),
    maximum_inclusive INTEGER NOT NULL DEFAULT 1 CHECK (maximum_inclusive IN (0, 1)),
    water_type TEXT CHECK (water_type IS NULL OR water_type IN ('freshwater', 'brackish', 'saltwater')),
    salinity_min_ppt REAL CHECK (salinity_min_ppt IS NULL OR salinity_min_ppt >= 0),
    salinity_max_ppt REAL CHECK (salinity_max_ppt IS NULL OR salinity_max_ppt >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (species_id) REFERENCES species(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (parameter_id) REFERENCES water_parameters(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CHECK (minimum_value IS NULL OR maximum_value IS NULL OR minimum_value <= maximum_value),
    CHECK (salinity_min_ppt IS NULL OR salinity_max_ppt IS NULL OR salinity_min_ppt <= salinity_max_ppt)
  );

  CREATE INDEX IF NOT EXISTS idx_properties_user_id
    ON properties(user_id);
  CREATE INDEX IF NOT EXISTS idx_ponds_property_id
    ON ponds(property_id);
  CREATE INDEX IF NOT EXISTS idx_ponds_species_id
    ON ponds(species_id);
  CREATE INDEX IF NOT EXISTS idx_measurements_pond_history
    ON measurements(pond_id, measured_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_measurements_parameter_id
    ON measurements(parameter_id);
  CREATE INDEX IF NOT EXISTS idx_technical_references_species_parameter
    ON technical_references(species_id, parameter_id);

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

  CREATE TABLE IF NOT EXISTS quality_analyses (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    measurement_id INTEGER NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('adequate', 'attention', 'critical', 'insufficient')),
    ruleset_version TEXT NOT NULL,
    analyzed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_quality_analyses_measurement ON quality_analyses(measurement_id, analyzed_at DESC);

  CREATE TABLE IF NOT EXISTS quality_analysis_items (
    id INTEGER PRIMARY KEY,
    analysis_id INTEGER NOT NULL,
    source_reference_id INTEGER,
    source_title TEXT,
    source_name TEXT,
    source_url TEXT,
    source_version TEXT,
    measurement_id INTEGER,
    measured_value REAL,
    measured_unit TEXT,
    evaluated_value REAL,
    evaluated_unit TEXT,
    classification TEXT NOT NULL CHECK (classification IN ('adequate', 'attention', 'critical', 'insufficient')),
    explanation TEXT NOT NULL,
    context_snapshot TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (analysis_id) REFERENCES quality_analyses(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (source_reference_id) REFERENCES technical_references(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON UPDATE CASCADE ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_quality_analysis_items_analysis ON quality_analysis_items(analysis_id);
`;

const legacyColumns = {
  users: {
    email: 'TEXT COLLATE NOCASE',
    password_hash: 'TEXT'
  },
  ponds: {
    culture_system: 'TEXT',
    water_type: 'TEXT',
    salinity_ppt: 'REAL'
  },
  water_parameters: {
    analyte_code: 'TEXT'
  },
  technical_references: {
    owner_user_id: 'INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE',
    classification: "TEXT CHECK (classification IS NULL OR classification IN ('adequate', 'attention', 'critical'))",
    reference_version: 'TEXT',
    minimum_inclusive: 'INTEGER NOT NULL DEFAULT 1 CHECK (minimum_inclusive IN (0, 1))',
    maximum_inclusive: 'INTEGER NOT NULL DEFAULT 1 CHECK (maximum_inclusive IN (0, 1))',
    water_type: "TEXT CHECK (water_type IS NULL OR water_type IN ('freshwater', 'brackish', 'saltwater'))",
    salinity_min_ppt: 'REAL',
    salinity_max_ppt: 'REAL'
  }
};

function migrateLegacyColumns(database) {
  for (const [table, columns] of Object.entries(legacyColumns)) {
    const existing = new Set(database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL');
}

function createSchema(database) {
  // A migração adiciona campos sem reconstruir tabelas nem apagar registros.
  database.transaction(() => {
    database.exec(schemaSql);
    migrateLegacyColumns(database);
  })();
}

module.exports = { createSchema };
