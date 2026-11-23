const { z } = require('zod');

const positiveId = z.coerce.number().int().positive().refine(Number.isSafeInteger);
const text = (maximum = 160) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum = 500) => text(maximum).nullable().optional();

const utcDateTime = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}, 'Use data/hora UTC no formato ISO 8601 com milissegundos.');

function requireNonEmptyPatch(value, context) {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: 'custom', message: 'Envie ao menos um campo para atualizar.' });
  }
}

const schemas = {
  idParams: z.object({ id: positiveId }).strict(),
  propertyIdParams: z.object({ propertyId: positiveId }).strict(),
  pondIdParams: z.object({ pondId: positiveId }).strict(),
  speciesIdParams: z.object({ speciesId: positiveId }).strict(),
  referenceFilters: z.object({ speciesId: positiveId.optional() }).strict(),

  registerUser: z.object({
    name: text(120),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(128)
  }).strict(),
  login: z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128)
  }).strict(),

  createProperty: z.object({
    name: text(120),
    municipality: optionalText(100),
    state: optionalText(80),
    areaHectares: z.number().finite().positive().nullable().optional()
  }).strict(),
  updateProperty: z.object({
    name: text(120).optional(),
    municipality: optionalText(100),
    state: optionalText(80),
    areaHectares: z.number().finite().positive().nullable().optional()
  }).strict().superRefine(requireNonEmptyPatch),

  createPond: z.object({
    propertyId: positiveId,
    speciesId: positiveId.nullable().optional(),
    name: text(120),
    structureType: optionalText(80),
    cultivationPhase: optionalText(100),
    volumeM3: z.number().finite().positive().nullable().optional(),
    cultureSystem: optionalText(100),
    waterType: z.enum(['freshwater', 'brackish', 'saltwater']).nullable().optional(),
    salinityPpt: z.number().finite().min(0).max(1000).nullable().optional()
  }).strict(),
  updatePond: z.object({
    propertyId: positiveId.optional(),
    speciesId: positiveId.nullable().optional(),
    name: text(120).optional(),
    structureType: optionalText(80),
    cultivationPhase: optionalText(100),
    volumeM3: z.number().finite().positive().nullable().optional(),
    cultureSystem: optionalText(100),
    waterType: z.enum(['freshwater', 'brackish', 'saltwater']).nullable().optional(),
    salinityPpt: z.number().finite().min(0).max(1000).nullable().optional()
  }).strict().superRefine(requireNonEmptyPatch),

  createSpecies: z.object({
    commonName: text(120),
    scientificName: optionalText(160)
  }).strict(),

  createParameter: z.object({
    name: text(120),
    unit: text(40),
    description: optionalText(500),
    analyteCode: z.enum(['temperature_c', 'ph', 'oxygen_saturation', 'free_ammonia_nh3', 'total_ammonia_nitrogen_tan_n', 'nitrite']).nullable().optional()
  }).strict(),

  createMeasurement: z.object({
    pondId: positiveId,
    parameterId: positiveId,
    value: z.number().finite(),
    unit: text(40),
    measuredAt: utcDateTime.optional(),
    notes: optionalText(2000)
  }).strict(),
  measurementFilters: z.object({
    pondId: positiveId.optional(),
    parameterId: positiveId.optional(),
    from: utcDateTime.optional(),
    to: utcDateTime.optional()
  }).strict().superRefine((filters, context) => {
    if (filters.from && filters.to && filters.from > filters.to) {
      context.addIssue({ code: 'custom', path: ['from'], message: 'A data inicial deve ser anterior ou igual à data final.' });
    }
  }),

  createReference: z.object({
    speciesId: positiveId,
    parameterId: positiveId,
    title: text(240),
    sourceName: text(240),
    sourceUrl: z.string().url().max(1000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'A fonte deve usar HTTP ou HTTPS.').nullable().optional(),
    publishedYear: z.number().int().min(1000).max(9999).nullable().optional(),
    cultivationPhase: optionalText(120),
    cultureSystem: optionalText(120),
    conditions: optionalText(2000),
    minimumValue: z.number().finite().nullable().optional(),
    maximumValue: z.number().finite().nullable().optional(),
    unit: text(40),
    notes: optionalText(2000),
    classification: z.enum(['adequate', 'attention', 'critical']).nullable().optional(),
    referenceVersion: text(80).nullable().optional(),
    minimumInclusive: z.boolean().optional(),
    maximumInclusive: z.boolean().optional(),
    waterType: z.enum(['freshwater', 'brackish', 'saltwater']).nullable().optional(),
    salinityMinPpt: z.number().finite().min(0).nullable().optional(),
    salinityMaxPpt: z.number().finite().min(0).nullable().optional()
  }).strict().superRefine((reference, context) => {
    if (reference.minimumValue != null && reference.maximumValue != null && reference.minimumValue > reference.maximumValue) {
      context.addIssue({ code: 'custom', path: ['minimumValue'], message: 'O limite mínimo não pode exceder o máximo.' });
    }
    if (reference.salinityMinPpt != null && reference.salinityMaxPpt != null && reference.salinityMinPpt > reference.salinityMaxPpt) {
      context.addIssue({ code: 'custom', path: ['salinityMinPpt'], message: 'A salinidade mínima não pode exceder a máxima.' });
    }
  }),
  updateReference: z.object({
    speciesId: positiveId.optional(),
    parameterId: positiveId.optional(),
    title: text(240).optional(),
    sourceName: text(240).optional(),
    sourceUrl: z.string().url().max(1000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'A fonte deve usar HTTP ou HTTPS.').nullable().optional(),
    publishedYear: z.number().int().min(1000).max(9999).nullable().optional(),
    cultivationPhase: optionalText(120),
    cultureSystem: optionalText(120),
    conditions: optionalText(2000),
    minimumValue: z.number().finite().nullable().optional(),
    maximumValue: z.number().finite().nullable().optional(),
    unit: text(40).optional(),
    notes: optionalText(2000),
    classification: z.enum(['adequate', 'attention', 'critical']).optional(),
    referenceVersion: text(80).nullable().optional(),
    minimumInclusive: z.boolean().optional(),
    maximumInclusive: z.boolean().optional(),
    waterType: z.enum(['freshwater', 'brackish', 'saltwater']).nullable().optional(),
    salinityMinPpt: z.number().finite().min(0).nullable().optional(),
    salinityMaxPpt: z.number().finite().min(0).nullable().optional()
  }).strict().superRefine((reference, context) => {
    requireNonEmptyPatch(reference, context);
    if (reference.minimumValue != null && reference.maximumValue != null && reference.minimumValue > reference.maximumValue) {
      context.addIssue({ code: 'custom', path: ['minimumValue'], message: 'O limite mínimo não pode exceder o máximo.' });
    }
    if (reference.salinityMinPpt != null && reference.salinityMaxPpt != null && reference.salinityMinPpt > reference.salinityMaxPpt) {
      context.addIssue({ code: 'custom', path: ['salinityMinPpt'], message: 'A salinidade mínima não pode exceder a máxima.' });
    }
  })
};

module.exports = { schemas, utcDateTime };
