import { z } from 'zod';
import { ProofTypeSchema, type ProofType } from './evidence.js';

/* -------------------------------------------------------------------------- */
/* Visual Kinds                                                               */
/* -------------------------------------------------------------------------- */

export const VisualKindSchema = z.enum([
  'key_figures_strip',
  'donut_pie',
  'treemap',
  'sunburst',
  'sankey',
  'waterfall',
  'slope_chart',
  'line_area',
  'horizontal_ranked_bar',
  'grouped_stacked_bar',
  'heatmap',
  'bullet_gauge',
  'waffle_unit',
  'funnel',
  'timeline_gantt',
  'choropleth_map',
  'point_map',
  'network_graph',
  'calendar_heatmap',
  'histogram_box_violin',
  'scatter_trend',
  'correlation_heatmap',
]);
export type VisualKind = z.infer<typeof VisualKindSchema>;

/* -------------------------------------------------------------------------- */
/* Series Data Point (with mandatory non-empty factIds[])                     */
/* -------------------------------------------------------------------------- */

export const VisualSeriesPointSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  value: z.number(),
  formattedValue: z.string().optional(),
  unit: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  parent: z.string().nullable().optional(),
  color: z.string().optional(),
  factIds: z
    .array(z.string())
    .min(1, 'Every visual data point must cite at least one supporting fact ID'),
  proofType: ProofTypeSchema.default('VERIFIED'),
});
export type VisualSeriesPoint = z.infer<typeof VisualSeriesPointSchema>;

/* -------------------------------------------------------------------------- */
/* Declarative Visual Specification Schema (PRD Section 6.2)                  */
/* -------------------------------------------------------------------------- */

export const VisualEncodingsSchema = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  time: z.string().optional(),
  value: z.string().optional(),
  unit: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
});
export type VisualEncodings = z.infer<typeof VisualEncodingsSchema>;

export const VisualProofSummarySchema = z.object({
  totalPoints: z.number().int().nonnegative(),
  verifiedCount: z.number().int().nonnegative(),
  derivedCount: z.number().int().nonnegative().optional().default(0),
  computedCount: z.number().int().nonnegative().optional().default(0),
  estimatedCount: z.number().int().nonnegative().optional().default(0),
  overallProofType: ProofTypeSchema.default('VERIFIED'),
});

export interface VisualProofSummary {
  totalPoints: number;
  verifiedCount: number;
  derivedCount?: number;
  computedCount?: number;
  estimatedCount?: number;
  overallProofType: ProofType;
}

export const A11yTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});
export type A11yTable = z.infer<typeof A11yTableSchema>;

export const VisualSpecSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().uuid().optional(),
  kind: VisualKindSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  laymanQuestion: z.string().optional(),
  encodings: VisualEncodingsSchema.default({}),
  series: z
    .array(VisualSeriesPointSchema)
    .min(1, 'Visual specification requires at least one data point'),
  proofSummary: VisualProofSummarySchema,
  filters: z.record(z.string(), z.string()).optional(),
  a11yTable: A11yTableSchema,
  rank: z.number().int().positive().default(1),
});

export interface VisualSpec {
  id: string;
  documentId?: string;
  kind: VisualKind;
  title: string;
  subtitle?: string;
  laymanQuestion?: string;
  encodings?: VisualEncodings;
  series: VisualSeriesPoint[];
  proofSummary: VisualProofSummary;
  filters?: Record<string, string>;
  a11yTable: A11yTable;
  rank?: number;
}

/**
 * Validates that every series point in a visual specification cites valid fact IDs (EVD-01 / VIZ-01 guard).
 */
export function assertVisualSpecProvenance(spec: VisualSpec): void {
  for (const point of spec.series) {
    if (!point.factIds || point.factIds.length === 0) {
      throw new Error(
        `PROVENANCE_VIOLATION: Series point "${point.label}" in visual "${spec.id}" has no supporting fact IDs.`,
      );
    }
  }
}
