import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  type ModelProvider,
  type ModelProviderMetadata,
  type GenerateFactsOptions,
  type GenerateFactsResult,
  GenerateFactsResultSchema,
} from '../types.js';

export interface GeminiProviderOptions {
  apiKey?: string;
  modelId?: string;
}

export class GeminiProvider implements ModelProvider {
  public readonly metadata: ModelProviderMetadata;
  private readonly client: GoogleGenAI;

  constructor(options: GeminiProviderOptions = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY_REQUIRED: An API key is required to initialize the Gemini provider.',
      );
    }

    const modelId = options.modelId || 'gemini-2.5-flash';
    this.metadata = {
      name: 'Google Gemini',
      modelId,
      provider: 'gemini',
      temperature: 0,
    };
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateFacts(options: GenerateFactsOptions): Promise<GenerateFactsResult> {
    const formattedPages = options.pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');

    const prompt = `${options.systemPrompt || 'Analyze this civic document and extract all key findings and numeric facts. Output valid JSON strictly conforming to the schema with temperature 0.'}

Document Text:
${formattedPages}`;

    const jsonSchema = zodToJsonSchema(GenerateFactsResultSchema, 'GenerateFactsResult');

    const response = await this.client.models.generateContent({
      model: this.metadata.modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as Record<string, unknown>,
        temperature: 0,
      },
    });

    const text = response.text || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Clean possible markdown code fences if emitted
      const cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    return GenerateFactsResultSchema.parse(parsed);
  }
}
