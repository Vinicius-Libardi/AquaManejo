const { ApiError } = require('../errors/api-error');
const { getMeasurement } = require('./measurements-service');

const RULESET_VERSION = '1.0.0';
const SEVERITY_ORDER = { adequate: 0, attention: 1, critical: 2, insufficient: 3 };

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function intervalContains(reference, value) {
  if (reference.minimumValue != null && (reference.minimumInclusive ? value < reference.minimumValue : value <= reference.minimumValue)) return false;
  if (reference.maximumValue != null && (reference.maximumInclusive ? value > reference.maximumValue : value >= reference.maximumValue)) return false;
  return true;
}

function contextMatches(reference, pond) {
  if (reference.cultivationPhase && normalized(reference.cultivationPhase) !== normalized(pond.cultivationPhase)) return false;
  if (reference.cultureSystem && normalized(reference.cultureSystem) !== normalized(pond.cultureSystem)) return false;
  if (reference.waterType && reference.waterType !== pond.waterType) return false;
  if (reference.salinityMinPpt != null && (pond.salinityPpt == null || pond.salinityPpt < reference.salinityMinPpt)) return false;
  if (reference.salinityMaxPpt != null && (pond.salinityPpt == null || pond.salinityPpt > reference.salinityMaxPpt)) return false;
  return true;
}

function sameSource(left, right) {
  return left.title === right.title && left.sourceName === right.sourceName
    && left.referenceVersion === right.referenceVersion
    && left.speciesId === right.speciesId && left.parameterId === right.parameterId;
}

function getExactSampleContext(database, measurement) {
  const rows = database.prepare(`SELECT water_parameters.analyte_code AS analyteCode,
      measurements.id, measurements.value, measurements.unit, measurements.measured_at AS measuredAt
    FROM measurements JOIN water_parameters ON water_parameters.id = measurements.parameter_id
    WHERE measurements.pond_id = ? AND measurements.measured_at = ? AND measurements.id <> ?`)
    .all(measurement.pondId, measurement.measuredAt, measurement.id);
  const context = {};
  for (const code of ['ph', 'temperature_c']) {
    const row = rows.find((candidate) => candidate.analyteCode === code);
    if (row) context[code] = row;
  }
  return context;
}

function derivedValue(database, measurement, pond, targetParameter) {
  const sourceParameter = database.prepare('SELECT analyte_code AS analyteCode FROM water_parameters WHERE id = ?').get(measurement.parameterId);
  if (sourceParameter?.analyteCode !== 'total_ammonia_nitrogen_tan_n'
      || targetParameter.analyteCode !== 'free_ammonia_nh3') return null;
  if (pond.waterType !== 'freshwater' || (pond.salinityPpt != null && pond.salinityPpt !== 0)) {
    return { insufficient: 'A conversão de TAN para NH₃ usa equilíbrio de água doce; o tipo de água informado não permite essa hipótese.' };
  }
  const unit = normalized(measurement.unit).replace(/\s/g, '');
  if (!['mg n/l', 'mg/l as n', 'mg-n/l', 'mgn/l'].includes(unit)) {
    return { insufficient: 'A conversão exige TAN expresso como mg de N/L.' };
  }
  const context = getExactSampleContext(database, measurement);
  const ph = context.ph;
  const temperature = context.temperature_c;
  if (!ph || !temperature || normalized(ph.unit) !== 'ph' || normalized(temperature.unit) !== '°c') {
    return { insufficient: 'A avaliação de TAN exige pH e temperatura medidos no mesmo instante e na mesma água.' };
  }
  // Emerson et al. (1975): fração de NH3 não ionizada em água doce em função de pH e temperatura.
  const pKa = 0.09018 + 2729.92 / (temperature.value + 273.15);
  const nh3Fraction = 1 / (1 + (10 ** (pKa - ph.value)));
  const nh3Value = measurement.value * nh3Fraction * (17.031 / 14.007);
  return {
    value: nh3Value,
    unit: 'mg/L',
    context: { method: 'Emerson et al. 1975, água doce', pHMeasurementId: ph.id, temperatureMeasurementId: temperature.id }
  };
}

function evaluateMeasurement(database, userId, measurementId) {
  const measurement = getMeasurement(database, userId, measurementId);
  const pond = database.prepare(`SELECT ponds.id, ponds.species_id AS speciesId,
      ponds.cultivation_phase AS cultivationPhase, ponds.culture_system AS cultureSystem,
      ponds.water_type AS waterType, ponds.salinity_ppt AS salinityPpt,
      species.common_name AS speciesName
    FROM ponds LEFT JOIN species ON species.id = ponds.species_id WHERE ponds.id = ?`)
    .get(measurement.pondId);
  const parameter = database.prepare(`SELECT id, name, unit, analyte_code AS analyteCode FROM water_parameters WHERE id = ?`)
    .get(measurement.parameterId);
  let classification = 'insufficient';
  let explanation = '';
  let evaluatedValue = measurement.value;
  let evaluatedUnit = measurement.unit;
  let contextSnapshot = pond ? {
    speciesId: pond.speciesId,
    speciesName: pond.speciesName,
    cultivationPhase: pond.cultivationPhase,
    cultureSystem: pond.cultureSystem,
    waterType: pond.waterType,
    salinityPpt: pond.salinityPpt
  } : {};
  let references = [];

  if (!pond?.speciesId) {
    explanation = 'O viveiro não tem espécie cultivada vinculada; não há referência suficientemente específica.';
  } else {
    let targetParameter = parameter;
    let candidateReferences = database.prepare(`SELECT technical_references.id AS id,
        technical_references.species_id AS speciesId, technical_references.parameter_id AS parameterId,
        technical_references.title, technical_references.source_name AS sourceName,
        technical_references.source_url AS sourceUrl, technical_references.published_year AS publishedYear,
        technical_references.cultivation_phase AS cultivationPhase, technical_references.culture_system AS cultureSystem,
        technical_references.conditions, technical_references.minimum_value AS minimumValue,
        technical_references.maximum_value AS maximumValue, technical_references.unit,
        technical_references.classification, technical_references.reference_version AS referenceVersion,
        technical_references.minimum_inclusive AS minimumInclusive,
        technical_references.maximum_inclusive AS maximumInclusive,
        technical_references.water_type AS waterType,
        technical_references.salinity_min_ppt AS salinityMinPpt,
        technical_references.salinity_max_ppt AS salinityMaxPpt,
        water_parameters.analyte_code AS analyteCode
      FROM technical_references JOIN water_parameters ON water_parameters.id = technical_references.parameter_id
      WHERE technical_references.species_id = ? AND technical_references.parameter_id = ?
        AND (technical_references.owner_user_id IS NULL OR technical_references.owner_user_id = ?)`);
    references = candidateReferences.all(pond.speciesId, measurement.parameterId, userId);

    // TAN só é convertido quando existe referência específica para NH3 e contexto medido simultaneamente.
    if (parameter.analyteCode === 'total_ammonia_nitrogen_tan_n') {
      const nh3Target = database.prepare(`SELECT id, name, unit, analyte_code AS analyteCode FROM water_parameters
        WHERE analyte_code = 'free_ammonia_nh3'`).get();
      if (nh3Target) {
        const derived = derivedValue(database, measurement, pond, nh3Target);
        if (derived?.insufficient) explanation = derived.insufficient;
        else if (derived) {
          evaluatedValue = derived.value;
          evaluatedUnit = derived.unit;
          contextSnapshot = derived.context;
          targetParameter = nh3Target;
          references = candidateReferences.all(pond.speciesId, nh3Target.id, userId);
        }
      }
    }

    if (!explanation) {
      const applicable = references.filter((reference) => contextMatches(reference, pond));
      const sourceGroups = [];
      for (const reference of applicable) {
        let group = sourceGroups.find((candidate) => candidate.length > 0 && sameSource(candidate[0], reference));
        if (!group) { group = []; sourceGroups.push(group); }
        group.push(reference);
      }
      if (sourceGroups.length === 0) {
        explanation = `Não há referência cadastrada compatível com ${pond.speciesName}, fase ${pond.cultivationPhase || 'não informada'}, sistema ${pond.cultureSystem || 'não informado'} e condições de água declaradas.`;
      } else if (sourceGroups.length > 1) {
        explanation = 'Há mais de uma referência aplicável. A API não escolhe entre fontes potencialmente divergentes.';
      } else {
        const group = sourceGroups[0];
        const unitMatches = group.filter((reference) => normalized(reference.unit) === normalized(evaluatedUnit));
        const classifiable = unitMatches.filter((reference) => reference.classification);
        const matches = classifiable.filter((reference) => intervalContains(reference, evaluatedValue));
        if (unitMatches.length === 0) {
          explanation = `A unidade medida (${evaluatedUnit}) não coincide com a unidade da referência.`;
        } else if (classifiable.length === 0) {
          explanation = 'A referência não registra uma classificação explícita para esta faixa.';
        } else if (matches.length !== 1) {
          explanation = matches.length > 1
            ? 'Os intervalos de referência se sobrepõem; o parâmetro permanece sem classificação.'
            : 'O valor está fora dos intervalos publicados ou em uma lacuna entre faixas; não foi extrapolado.';
        } else {
          const match = matches[0];
          classification = match.classification;
          explanation = match.conditions;
          references = [match];
        }
      }
    }
  }

  const chosenReference = references.length === 1 ? references[0] : null;
  return {
    measurement,
    classification,
    rulesetVersion: RULESET_VERSION,
    explanation,
    reference: chosenReference ? {
      id: chosenReference.id, title: chosenReference.title, sourceName: chosenReference.sourceName,
      sourceUrl: chosenReference.sourceUrl, publishedYear: chosenReference.publishedYear,
      version: chosenReference.referenceVersion
    } : null,
    evaluatedValue,
    evaluatedUnit,
    contextSnapshot
  };
}

function analyzeMeasurement(database, userId, measurementId) {
  const result = evaluateMeasurement(database, userId, measurementId);
  const save = database.transaction(() => {
    const analysisId = database.prepare(`INSERT INTO quality_analyses (user_id, measurement_id, classification, ruleset_version)
      VALUES (?, ?, ?, ?)`).run(userId, measurementId, result.classification, result.rulesetVersion).lastInsertRowid;
    database.prepare(`INSERT INTO quality_analysis_items (
      analysis_id, source_reference_id, source_title, source_name, source_url, source_version,
      measurement_id, measured_value, measured_unit, evaluated_value, evaluated_unit,
      classification, explanation, context_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(analysisId, result.reference?.id ?? null, result.reference?.title ?? null,
        result.reference?.sourceName ?? null, result.reference?.sourceUrl ?? null,
        result.reference?.version ?? null, measurementId, result.measurement.value,
        result.measurement.unit, result.evaluatedValue, result.evaluatedUnit,
        result.classification, result.explanation, JSON.stringify(result.contextSnapshot));
    return Number(analysisId);
  });
  const analysisId = save();
  return getAnalysis(database, userId, analysisId);
}

function getAnalysis(database, userId, analysisId) {
  const analysis = database.prepare(`SELECT id, measurement_id AS measurementId,
      classification, ruleset_version AS rulesetVersion, analyzed_at AS analyzedAt
    FROM quality_analyses WHERE id = ? AND user_id = ?`).get(analysisId, userId);
  if (!analysis) throw new ApiError(404, 'ANALYSIS_NOT_FOUND', 'Análise não encontrada.');
  const items = database.prepare(`SELECT id, source_reference_id AS sourceReferenceId,
      source_title AS sourceTitle, source_name AS sourceName, source_url AS sourceUrl,
      source_version AS sourceVersion, measurement_id AS measurementId,
      measured_value AS measuredValue, measured_unit AS measuredUnit,
      evaluated_value AS evaluatedValue, evaluated_unit AS evaluatedUnit,
      classification, explanation, context_snapshot AS contextSnapshot
    FROM quality_analysis_items WHERE analysis_id = ? ORDER BY id`).all(analysisId)
    .map((item) => ({ ...item, contextSnapshot: JSON.parse(item.contextSnapshot) }));
  return { ...analysis, items };
}

function getLatestAnalysis(database, userId, measurementId) {
  getMeasurement(database, userId, measurementId);
  const latest = database.prepare(`SELECT id FROM quality_analyses
    WHERE user_id = ? AND measurement_id = ? ORDER BY analyzed_at DESC, id DESC LIMIT 1`).get(userId, measurementId);
  if (!latest) return null;
  return getAnalysis(database, userId, latest.id);
}

function overallClassification(classifications) {
  return classifications.reduce((worst, current) => SEVERITY_ORDER[current] > SEVERITY_ORDER[worst] ? current : worst, 'adequate');
}

module.exports = { analyzeMeasurement, evaluateMeasurement, getAnalysis, getLatestAnalysis, overallClassification, RULESET_VERSION };
