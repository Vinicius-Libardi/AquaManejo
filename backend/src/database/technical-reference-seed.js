const sourceName = 'Aquaculture Stewardship Council (ASC)';
const sourceTitle = 'Farm Standard Interpretation Manual v1.0.1, Table 6 — Nile tilapia';
const sourceUrl = 'https://programme-centre.asc-aqua.org/farm-v1/farm-interpretation/';
const sourceConditions = 'A tabela apresenta exemplos de níveis aceitáveis, de alerta e inaceitáveis para tilápia-do-Nilo. O próprio manual declara caráter orientativo, não normativo. O quadro não detalha fase, sistema ou salinidade; por prudência, o aplicativo restringe a análise pré-cadastrada a engorda, sistema semi-intensivo e água doce. Valores de fronteira não cobertos permanecem sem classificação.';

const catalog = [
  { name: 'Temperatura da água', unit: '°C', code: 'temperature_c', ranges: [
    ['adequate', 25, 32, true, true], ['attention', 20, 24, true, true], ['attention', 33, 37, true, true],
    ['critical', null, 19, true, true], ['critical', 38, null, true, true]
  ] },
  { name: 'pH', unit: 'pH', code: 'ph', ranges: [
    ['adequate', 6, 8.5, true, true], ['attention', 5.5, 5.9, true, true], ['attention', 8.6, 8.9, true, true],
    ['critical', null, 5.4, true, true], ['critical', 9, null, true, true]
  ] },
  { name: 'Saturação de oxigênio', unit: '%', code: 'oxygen_saturation', ranges: [
    ['adequate', 70, 95, true, true], ['attention', 40, 69, true, true],
    ['critical', null, 39, true, true], ['critical', 95, null, false, true]
  ] },
  { name: 'Amônia não ionizada (NH₃)', unit: 'mg/L', code: 'free_ammonia_nh3', ranges: [
    ['adequate', 0, 0.05, true, true], ['attention', 0.051, 0.1, true, true], ['critical', 0.11, null, true, true]
  ] },
  { name: 'Amônia total (TAN-N)', unit: 'mg N/L', code: 'total_ammonia_nitrogen_tan_n', ranges: [] },
  { name: 'Nitrito', unit: 'mg/L', code: 'nitrite', ranges: [
    ['adequate', 0, 0.5, true, true], ['attention', 0.51, 1, true, true], ['critical', 1.01, null, true, true]
  ] }
];

function seedTechnicalReferences(database) {
  const insertSpecies = database.prepare(`INSERT INTO species (common_name, scientific_name)
    SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM species WHERE common_name = ? COLLATE NOCASE)`);
  insertSpecies.run('Tilápia-do-Nilo', 'Oreochromis niloticus', 'Tilápia-do-Nilo');
  const species = database.prepare('SELECT id FROM species WHERE common_name = ? COLLATE NOCASE').get('Tilápia-do-Nilo');
  const insertParameter = database.prepare(`INSERT INTO water_parameters (name, unit, analyte_code)
    SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM water_parameters WHERE analyte_code = ?)`);
  const insertReference = database.prepare(`INSERT INTO technical_references (
      species_id, parameter_id, title, source_name, source_url, published_year,
      cultivation_phase, culture_system, conditions, minimum_value, maximum_value,
      unit, classification, reference_version, minimum_inclusive, maximum_inclusive, water_type
    ) SELECT ?, ?, ?, ?, ?, 2025, ?, ?, ?, ?, ?, ?, ?, '1.0.1', ?, ?, 'freshwater'
      WHERE NOT EXISTS (SELECT 1 FROM technical_references WHERE species_id = ? AND parameter_id = ?
        AND title = ? AND classification = ? AND minimum_value IS ? AND maximum_value IS ?)`);

  for (const entry of catalog) {
    insertParameter.run(entry.name, entry.unit, entry.code, entry.code);
    const parameter = database.prepare('SELECT id FROM water_parameters WHERE analyte_code = ?').get(entry.code);
    for (const [classification, minimumValue, maximumValue, minimumInclusive, maximumInclusive] of entry.ranges) {
      insertReference.run(species.id, parameter.id, sourceTitle, sourceName, sourceUrl, 'Engorda', 'semi-intensivo',
        sourceConditions, minimumValue, maximumValue, entry.unit, classification,
        Number(minimumInclusive), Number(maximumInclusive), species.id, parameter.id, sourceTitle,
        classification, minimumValue, maximumValue);
    }
  }
}

module.exports = { seedTechnicalReferences };
