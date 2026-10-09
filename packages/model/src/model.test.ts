import { describe, expect, it, afterEach } from 'vitest';
import {
  GenerateFactsResultSchema,
  GeminiProvider,
  OllamaProvider,
  ReplayProvider,
} from './index.js';

describe('Model Provider Abstraction (@juris/model)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('validates GenerateFactsResultSchema with semantic fact types', () => {
    const sample = {
      documentTitle: 'Test Budget',
      documentType: 'budget',
      summary: 'Summary text',
      keyFindings: ['Finding 1'],
      facts: [
        {
          type: 'money',
          value: 1000,
          unit: 'crore',
          currency: 'INR',
          period: '2026-27',
          page: 1,
          quote: 'Quote 1000 crore',
        },
      ],
      risks: ['Risk 1'],
    };

    const parsed = GenerateFactsResultSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it('ensures ReplayProvider loads and validates recorded gold fixtures', async () => {
    const provider = new ReplayProvider();
    expect(provider.metadata.temperature).toBe(0);
    expect(provider.metadata.provider).toBe('replay');

    const result = await provider.generateFacts({
      pages: [{ pageNumber: 1, text: 'Sample text' }],
    });

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0]?.type).toBeDefined();
    expect(result.facts[0]?.quote).toBeDefined();
  });

  it('strictly fails closed when ReplayProvider is invoked in production', async () => {
    process.env.NODE_ENV = 'production';

    // Instantiation must throw in production
    expect(() => new ReplayProvider()).toThrow(/FORBIDDEN_REPLAY_IN_PRODUCTION/);

    // Any call must also throw in production
    process.env.NODE_ENV = 'development';
    const provider = new ReplayProvider();
    process.env.NODE_ENV = 'production';

    await expect(
      provider.generateFacts({
        pages: [{ pageNumber: 1, text: 'Sample text' }],
      }),
    ).rejects.toThrow(/FORBIDDEN_REPLAY_IN_PRODUCTION/);
  });

  it('ensures OllamaProvider metadata has temperature 0 and model configuration', () => {
    const provider = new OllamaProvider({
      modelId: 'llama3.1:8b-instruct-q8_0',
    });

    expect(provider.metadata.temperature).toBe(0);
    expect(provider.metadata.modelId).toBe('llama3.1:8b-instruct-q8_0');
    expect(provider.metadata.provider).toBe('ollama');
  });

  it('ensures GeminiProvider requires API key and configures temperature 0', () => {
    const originalKey = process.env.GEMINI_API_KEY;
    const originalGenaiKey = process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;

    try {
      expect(() => new GeminiProvider({ apiKey: '' })).toThrow(/GEMINI_API_KEY_REQUIRED/);

      const provider = new GeminiProvider({ apiKey: 'fake-test-key-12345' });
      expect(provider.metadata.temperature).toBe(0);
      expect(provider.metadata.provider).toBe('gemini');
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      if (originalGenaiKey) process.env.GOOGLE_GENAI_API_KEY = originalGenaiKey;
    }
  });
});
