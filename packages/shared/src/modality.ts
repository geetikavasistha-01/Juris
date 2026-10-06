// packages/shared/src/modality.ts
// Contracts for multi-modal ingestion (ING-05..08, EVD-06, VIZ-07, CHT-05).
// Export from packages/shared/src/index.ts.

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Modality + verification                                                    */
/* -------------------------------------------------------------------------- */

export const ModalitySchema = z.enum([
  'text_pdf',
  'scanned_pdf',
  'image',
  'table', // CSV / XLSX
  'geo_data', // GeoJSON, CSV with lat/lon or region codes
  'map_image',
  'pasted_text',
]);
export type Modality = z.infer<typeof ModalitySchema>;

export const VerificationMethodSchema = z.enum([
  'quote_on_page', // verbatim quote located on the page (text PDFs)
  'ocr_crosscheck', // vision transcription agreed with an independent OCR pass
  'computed_from_table', // computed by code from table data, never by the LLM
  'geo_parsed', // read directly from a geo file and validated in code
  'unverified', // shown as unverified, excluded from charts (VIZ-01)
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

/* -------------------------------------------------------------------------- */
/* Upload allowlist, magic bytes, limits                                      */
/* -------------------------------------------------------------------------- */

export const FileKindSchema = z.enum(['pdf', 'png', 'jpeg', 'webp', 'csv', 'xlsx', 'geojson']);
export type FileKind = z.infer<typeof FileKindSchema>;

/** SVG, HTML, and executables are intentionally absent: never accepted. */
export const FILE_KIND_RULES: Record<
  FileKind,
  {
    mimeTypes: readonly string[];
    extensions: readonly string[];
    /** Byte signatures checked server-side. Empty = content is text-validated instead. */
    signatures: readonly { offset: number; bytes: readonly number[] }[];
    modalities: readonly Modality[];
  }
> = {
  pdf: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }],
    modalities: ['text_pdf', 'scanned_pdf'],
  },
  png: {
    mimeTypes: ['image/png'],
    extensions: ['.png'],
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    modalities: ['image', 'map_image'],
  },
  jpeg: {
    mimeTypes: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    modalities: ['image', 'map_image'],
  },
  webp: {
    mimeTypes: ['image/webp'],
    extensions: ['.webp'],
    // "RIFF" at 0 and "WEBP" at 8
    signatures: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
    modalities: ['image', 'map_image'],
  },
  xlsx: {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    extensions: ['.xlsx'],
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // ZIP container
    modalities: ['table', 'geo_data'],
  },
  csv: {
    mimeTypes: ['text/csv', 'text/plain'],
    extensions: ['.csv'],
    signatures: [], // validate: UTF-8 decodes, consistent column count, row cap
    modalities: ['table', 'geo_data'],
  },
  geojson: {
    mimeTypes: ['application/geo+json', 'application/json'],
    extensions: ['.geojson', '.json'],
    signatures: [], // validate: JSON parses, type is FeatureCollection/Feature, feature cap
    modalities: ['geo_data'],
  },
};

export const UPLOAD_LIMITS = {
  maxBytes: {
    pdf: 25 * 1024 * 1024,
    png: 15 * 1024 * 1024,
    jpeg: 15 * 1024 * 1024,
    webp: 15 * 1024 * 1024,
    csv: 25 * 1024 * 1024,
    xlsx: 25 * 1024 * 1024,
    geojson: 25 * 1024 * 1024,
  } satisfies Record<FileKind, number>,
  maxImagePixels: 40_000_000, // reject decompression-bomb images
  maxImageSidePx: 10_000,
  maxTableRows: 200_000,
  maxTableColumns: 200,
  maxXlsxUncompressedBytes: 200 * 1024 * 1024, // zip bomb guard
  maxGeoFeatures: 50_000,
} as const;

/* -------------------------------------------------------------------------- */
/* Source locators: where a fact or citation comes from, per modality         */
/* -------------------------------------------------------------------------- */

/** Normalized 0..1 coordinates relative to the page or image, origin top-left. */
export const BBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine((b) => b.x + b.width <= 1.0001 && b.y + b.height <= 1.0001, {
    message: 'bbox must stay inside the page/image',
  });
export type BBox = z.infer<typeof BBoxSchema>;

export const SourceLocatorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('page_quote'),
    page: z.number().int().positive(),
    quote: z.string().min(1).max(2000),
  }),
  z.object({
    kind: z.literal('image_region'),
    page: z.number().int().positive().optional(), // set for scanned PDFs
    bbox: BBoxSchema,
    text: z.string().max(2000).optional(), // transcribed text of the region
  }),
  z.object({
    kind: z.literal('table_range'),
    sheet: z.string().min(1).max(128).optional(),
    rowStart: z.number().int().nonnegative(),
    rowEnd: z.number().int().nonnegative(),
    columns: z.array(z.string().min(1).max(128)).min(1).max(50),
  }),
  z.object({
    kind: z.literal('geo_feature'),
    featureId: z.string().min(1).max(256),
    property: z.string().min(1).max(128).optional(),
  }),
]);
export type SourceLocator = z.infer<typeof SourceLocatorSchema>;

/** Which locator kinds each verification method may use. 'unverified' may use any. */
export const METHOD_LOCATOR_KINDS: Record<VerificationMethod, readonly SourceLocator['kind'][]> = {
  quote_on_page: ['page_quote'],
  ocr_crosscheck: ['image_region'],
  computed_from_table: ['table_range'],
  geo_parsed: ['geo_feature'],
  unverified: ['page_quote', 'image_region', 'table_range', 'geo_feature'],
};

/* -------------------------------------------------------------------------- */
/* Fact                                                                       */
/* -------------------------------------------------------------------------- */

export const ModalFactSchema = z
  .object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    modality: ModalitySchema,
    type: z.string().min(1).max(100),
    value: z.number().finite(),
    unit: z.string().max(32).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'ISO 4217 code')
      .nullable(),
    period: z.string().max(64).nullable(),
    locator: SourceLocatorSchema,
    verified: z.boolean(),
    verificationMethod: VerificationMethodSchema,
    /** 0..1 agreement between vision transcription and independent OCR. */
    ocrAgreement: z.number().min(0).max(1).nullable(),
    failReason: z.string().max(500).nullable(),
  })
  .superRefine((fact, ctx) => {
    const allowed = METHOD_LOCATOR_KINDS[fact.verificationMethod];
    if (!allowed.includes(fact.locator.kind)) {
      ctx.addIssue({
        code: 'custom',
        path: ['locator', 'kind'],
        message: `${fact.verificationMethod} cannot use a ${fact.locator.kind} locator`,
      });
    }
    if (fact.verified !== (fact.verificationMethod !== 'unverified')) {
      ctx.addIssue({
        code: 'custom',
        path: ['verified'],
        message: 'verified must be true exactly when verificationMethod is not "unverified"',
      });
    }
    if (!fact.verified && !fact.failReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['failReason'],
        message: 'unverified facts must record a failReason',
      });
    }
    if (fact.verified && fact.failReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['failReason'],
        message: 'verified facts must not have a failReason',
      });
    }
    if (fact.verificationMethod === 'ocr_crosscheck' && fact.ocrAgreement === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['ocrAgreement'],
        message: 'ocr_crosscheck requires ocrAgreement',
      });
    }
  });
export type ModalFact = z.infer<typeof ModalFactSchema>;

/** VIZ-01: only verified facts may feed a chart. Single place this rule lives. */
export const isChartEligible = (fact: Pick<ModalFact, 'verified'>): boolean => fact.verified;

/* -------------------------------------------------------------------------- */
/* Query plan for tables (CHT-05): the LLM emits this, CODE executes it       */
/* -------------------------------------------------------------------------- */

const ColumnNameSchema = z.string().min(1).max(128);
const ScalarSchema = z.union([z.string().max(500), z.number().finite(), z.boolean()]);

export const FilterOpSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
  'is_null',
  'not_null',
]);

export const QueryFilterSchema = z
  .object({
    column: ColumnNameSchema,
    op: FilterOpSchema,
    value: z.union([ScalarSchema, z.array(ScalarSchema).min(1).max(100)]).optional(),
  })
  .superRefine((f, ctx) => {
    const noValue = f.op === 'is_null' || f.op === 'not_null';
    if (noValue && f.value !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: `${f.op} takes no value` });
    }
    if (!noValue && f.value === undefined) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: `${f.op} requires a value` });
    }
    if (f.op === 'in' && !Array.isArray(f.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'in requires an array' });
    }
    if (f.op !== 'in' && Array.isArray(f.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: `${f.op} requires a scalar` });
    }
  });

export const AggregateFnSchema = z.enum(['sum', 'avg', 'min', 'max', 'count', 'count_distinct']);

export const QueryAggregateSchema = z
  .object({
    fn: AggregateFnSchema,
    column: ColumnNameSchema.optional(), // optional only for count(*)
    alias: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  })
  .refine((a) => a.fn === 'count' || a.column !== undefined, {
    message: 'column is required unless fn is count',
    path: ['column'],
  });

export const QueryPlanSchema = z.object({
  version: z.literal(1),
  filters: z.array(QueryFilterSchema).max(10).default([]),
  groupBy: z.array(ColumnNameSchema).max(3).default([]),
  aggregates: z.array(QueryAggregateSchema).min(1).max(5),
  orderBy: z
    .array(z.object({ key: z.string().min(1).max(128), direction: z.enum(['asc', 'desc']) }))
    .max(3)
    .default([]),
  limit: z.number().int().positive().max(1000).default(100),
});
export type QueryPlan = z.infer<typeof QueryPlanSchema>;

/* -------------------------------------------------------------------------- */
/* Geo                                                                        */
/* -------------------------------------------------------------------------- */

export const LonLatSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type LonLat = z.infer<typeof LonLatSchema>;

/* -------------------------------------------------------------------------- */
/* Export safety                                                              */
/* -------------------------------------------------------------------------- */

/** Neutralize CSV/spreadsheet formula injection in any exported or rendered cell. */
export const neutralizeFormula = (cell: string): string =>
  /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
