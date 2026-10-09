import fs from 'node:fs';
import path from 'node:path';
import {
  type ModelProvider,
  type ModelProviderMetadata,
  type GenerateFactsOptions,
  type GenerateFactsResult,
  GenerateFactsResultSchema,
} from '../types.js';

export interface ReplayProviderOptions {
  fixturePath?: string;
  fixturesByDocName?: Record<string, string>;
}

export class ReplayProvider implements ModelProvider {
  public readonly metadata: ModelProviderMetadata;
  private readonly fixturePath?: string;
  private readonly fixturesByDocName: Record<string, string>;

  constructor(options: ReplayProviderOptions = {}) {
    // Fail closed in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FORBIDDEN_REPLAY_IN_PRODUCTION: The recorded replay provider is strictly forbidden in production mode.',
      );
    }

    this.metadata = {
      name: 'Recorded Replay Provider',
      modelId: 'recorded-replay-v1',
      provider: 'replay',
      temperature: 0,
    };
    this.fixturePath = options.fixturePath;
    this.fixturesByDocName = options.fixturesByDocName || {};
  }

  async generateFacts(options: GenerateFactsOptions): Promise<GenerateFactsResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FORBIDDEN_REPLAY_IN_PRODUCTION: The recorded replay provider is strictly forbidden in production mode.',
      );
    }

    let targetPath = this.fixturePath;

    if (options.documentTitle && this.fixturesByDocName[options.documentTitle]) {
      targetPath = this.fixturesByDocName[options.documentTitle];
    }

    if (!targetPath) {
      // Default fallback fixture
      const candidate = path.resolve(
        process.cwd(),
        'packages/evals/fixtures/budget-speech-analysis.json',
      );
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error(
        `FIXTURE_NOT_FOUND: No recorded replay fixture found at '${targetPath || 'unspecified'}'`,
      );
    }

    const raw = fs.readFileSync(targetPath, 'utf8');
    const json = JSON.parse(raw);

    // Normalize legacy fixture shape if needed (e.g. mapping legacy fact types to semantic fact types)
    const normalized = {
      documentTitle: json.documentTitle || options.documentTitle || 'Recorded Document',
      documentType: json.documentType || 'budget',
      summary: json.summary || '',
      keyFindings: json.keyFindings || [],
      facts: (json.facts || []).map((f: Record<string, unknown>) => {
        let type = 'measure';
        const rawType = String(f.type || '');
        if (/financial|money|allocation|expenditure|receipt|revenue/i.test(rawType)) {
          type = 'money';
        } else if (/date/i.test(rawType)) {
          type = 'date';
        } else if (/statistic|count|percentage|quantity/i.test(rawType)) {
          type = 'measure';
        }

        return {
          type,
          value: f.value !== undefined ? Number(f.value) : null,
          unit: f.unit || null,
          currency: f.currency || null,
          period: f.period ? String(f.period) : null,
          page: Number(f.page) || 1,
          quote: String(f.quote || ''),
          label: f.label || undefined,
        };
      }),
      risks: json.risks || [],
    };

    return GenerateFactsResultSchema.parse(normalized);
  }
}
