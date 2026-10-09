import { z } from 'zod';
import {
  SemanticFactTypeSchema,
  DocumentTypeSchema,
  type SemanticFactType,
  type DocumentType,
} from '@juris/shared';

export type { SemanticFactType, DocumentType };

export const ProposedFactSchema = z.object({
  type: SemanticFactTypeSchema,
  value: z.number().nullable(),
  unit: z.string().nullable().default(null),
  currency: z.string().nullable().default(null),
  period: z.string().nullable().default(null),
  page: z.number().int().positive(),
  quote: z.string().min(1),
  label: z.string().optional(),
});
export type ProposedFact = z.infer<typeof ProposedFactSchema>;

export const GenerateFactsResultSchema = z.object({
  documentTitle: z.string().default('Untitled Document'),
  documentType: DocumentTypeSchema.default('generic'),
  summary: z.string().default(''),
  keyFindings: z.array(z.string()).default([]),
  facts: z.array(ProposedFactSchema).default([]),
  risks: z.array(z.string()).default([]),
});
export type GenerateFactsResult = z.infer<typeof GenerateFactsResultSchema>;

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface GenerateFactsOptions {
  pages: PageContent[];
  documentTitle?: string;
  systemPrompt?: string;
}

export interface ModelProviderMetadata {
  name: string;
  modelId: string;
  provider: 'gemini' | 'ollama' | 'replay';
  temperature: number;
}

export interface ModelProvider {
  readonly metadata: ModelProviderMetadata;
  generateFacts(options: GenerateFactsOptions): Promise<GenerateFactsResult>;
}
