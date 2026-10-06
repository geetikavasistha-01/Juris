import { z } from 'zod';

export const ExtractedFactSchema = z.object({
  type: z.enum([
    'financial_total',
    'financial_allocation',
    'financial_trend',
    'policy_target',
    'statistic',
  ]),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  currency: z.string().nullable(),
  period: z.string().nullable(),
  page: z.number().int().positive(),
  quote: z.string().min(1),
});

export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;

export const DocumentAnalysisSchema = z.object({
  documentTitle: z.string(),
  documentType: z.enum(['budget', 'financial_report', 'policy', 'audit', 'general']),
  summary: z.string(),
  keyFindings: z.array(z.string()),
  facts: z.array(ExtractedFactSchema),
  risks: z.array(z.string()),
});

export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;
