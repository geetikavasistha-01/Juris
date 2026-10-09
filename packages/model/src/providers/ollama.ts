import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  type ModelProvider,
  type ModelProviderMetadata,
  type GenerateFactsOptions,
  type GenerateFactsResult,
  GenerateFactsResultSchema,
} from '../types.js';

export interface OllamaProviderOptions {
  baseUrl?: string;
  modelId?: string; // 'llama3.1:8b-instruct-q8_0' | 'qwen2.5:7b-instruct-q8_0'
}

export class OllamaProvider implements ModelProvider {
  public readonly metadata: ModelProviderMetadata;
  private readonly baseUrl: string;

  constructor(options: OllamaProviderOptions = {}) {
    const modelId = options.modelId || 'llama3.1:8b-instruct-q8_0';
    this.baseUrl = (
      options.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    this.metadata = {
      name: `Ollama (${modelId})`,
      modelId,
      provider: 'ollama',
      temperature: 0,
    };
  }

  async generateFacts(options: GenerateFactsOptions): Promise<GenerateFactsResult> {
    const formattedPages = options.pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');

    const prompt = `${options.systemPrompt || 'Analyze this civic document and extract all key findings and numeric facts. Output valid JSON strictly conforming to the schema with temperature 0.'}

Document Text:
${formattedPages}`;

    // Pass the schema as a strict JSON schema derived via zodToJsonSchema, never format: "json" alone
    const jsonSchema = zodToJsonSchema(GenerateFactsResultSchema, {
      name: 'GenerateFactsResult',
      $refStrategy: 'none',
    });

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.metadata.modelId,
        prompt,
        format: jsonSchema, // Strict JSON Schema constraint
        stream: false,
        options: {
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OLLAMA_REQUEST_FAILED: HTTP ${response.status} - ${errorText}`);
    }

    const payload = (await response.json()) as { response: string };
    const rawText = payload.response || '{}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    return GenerateFactsResultSchema.parse(parsed);
  }
}
