import { z } from 'zod';
import { ProofTypeSchema } from './evidence.js';

export const InsightClaimSchema = z.object({
  id: z.string().min(1),
  claimText: z.string().min(1),
  factIds: z.array(z.string().min(1)).min(1),
  numbersMentioned: z.array(z.number()).default([]),
  proofType: ProofTypeSchema.default('VERIFIED'),
  confidenceScore: z.number().min(0).max(1).default(1.0),
  isVerified: z.boolean().default(true),
  rejectionReason: z.string().optional(),
});

export type InsightClaim = z.infer<typeof InsightClaimSchema>;

export const VisualInsightSchema = z.object({
  id: z.string().min(1),
  visualSpecId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  claims: z.array(InsightClaimSchema).min(1),
  generatedBy: z.enum(['deterministic_template', 'grounded_llm']).default('deterministic_template'),
  overallConfidence: z.number().min(0).max(1).default(1.0),
  createdAt: z.string().datetime().optional(),
});

export type VisualInsight = z.infer<typeof VisualInsightSchema>;

export interface InsightGenerationOptions {
  mode?: 'deterministic_template' | 'grounded_llm';
  maxClaims?: number;
}
