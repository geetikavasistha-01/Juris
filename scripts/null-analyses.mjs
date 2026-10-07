import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function getSupabaseKeys() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  try {
    const raw = execSync('pnpm exec supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    const parsed = JSON.parse(raw);
    return {
      url: parsed.API_URL || 'http://127.0.0.1:54321',
      serviceKey: parsed.SERVICE_ROLE_KEY,
    };
  } catch {
    return {
      url: 'http://127.0.0.1:54321',
      serviceKey: '',
    };
  }
}

async function main() {
  const { url, serviceKey } = getSupabaseKeys();
  const supabase = createClient(url, serviceKey);

  console.info('=== Nulling Fabricated Analyses Text Columns ===');
  const { data: beforeRows, error: beforeErr } = await supabase
    .from('analyses')
    .select('document_id, summary, key_findings, risks, verification_rate');

  if (beforeErr) {
    console.warn(
      'Could not query analyses (Supabase local DB might be offline or empty):',
      beforeErr.message,
    );
    return;
  }

  console.info(`Analyses rows count before: ${beforeRows ? beforeRows.length : 0}`);
  if (beforeRows && beforeRows.length > 0) {
    console.table(
      beforeRows.map((r) => ({
        document_id: r.document_id,
        has_summary: Boolean(r.summary),
        has_findings: Array.isArray(r.key_findings) ? r.key_findings.length : 0,
        has_risks: Array.isArray(r.risks) ? r.risks.length : 0,
        verification_rate: r.verification_rate,
      })),
    );

    const { error: updateErr } = await supabase
      .from('analyses')
      .update({
        summary: null,
        key_findings: [],
        risks: [],
      })
      .not('document_id', 'is', null);

    if (updateErr) {
      console.error('Update error:', updateErr);
    }
  }

  const { data: afterRows } = await supabase
    .from('analyses')
    .select('document_id, summary, key_findings, risks, verification_rate');

  console.info(`Analyses rows count after: ${afterRows ? afterRows.length : 0}`);
  if (afterRows && afterRows.length > 0) {
    console.table(
      afterRows.map((r) => ({
        document_id: r.document_id,
        summary: r.summary,
        key_findings_count: Array.isArray(r.key_findings) ? r.key_findings.length : 0,
        risks_count: Array.isArray(r.risks) ? r.risks.length : 0,
        verification_rate: r.verification_rate,
      })),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
