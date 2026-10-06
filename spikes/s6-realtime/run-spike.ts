import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { runWorkerPipeline } from './worker.js';

import { getLocalSupabaseConfig } from '../../tests/supabase-helper.js';

function createStaticServer(port: number = 5678): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const htmlPath = path.resolve('spikes/s6-realtime/index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    server.listen(port, () => resolve(server));
  });
}

async function runS6Spike() {
  console.info('=== Spike S6: Realtime Pub/Sub & Polling Recovery Evaluation ===\n');

  const config = getLocalSupabaseConfig();
  const supabaseUrl = config.API_URL;
  const serviceRoleKey = config.SERVICE_ROLE_KEY;
  const anonKey = config.ANON_KEY;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.info('1. Creating test user & document in Supabase Postgres...');
  const testEmail = `realtime_test_${Date.now()}@juris.local`;
  const testPassword = 'Password123!Secure';
  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (userErr || !userData.user) {
    console.error('Failed to create test user for Realtime spike:', userErr);
    process.exit(1);
  }
  const ownerId = userData.user.id;

  // Sign in to obtain access_token for browser client RLS authentication
  const { data: authSession, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr || !authSession.session) {
    console.error('Failed to authenticate test user:', authErr);
    process.exit(1);
  }
  const accessToken = authSession.session.access_token;

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      owner_id: ownerId,
      original_name: 'test_realtime.pdf',
      storage_path: `${ownerId}/test_realtime.pdf`,
      size_bytes: 1024,
      sha256: `realtime_test_${Date.now()}`,
      status: 'queued',
      stage: 'validating',
    })
    .select()
    .single();

  if (docErr || !doc) {
    console.error('Failed to create test document:', docErr);
    process.exit(1);
  }

  const documentId = doc.id;
  const jobId = '11111111-1111-1111-1111-111111111111';

  // Create job row
  await supabase.from('jobs').insert({
    id: jobId,
    document_id: documentId,
    owner_id: ownerId,
    status: 'queued',
    stage: 'validating',
  });

  console.info(`   - Document created: ${documentId}`);

  console.info('2. Starting local client server on port 5678...');
  const server = await createStaticServer(5678);

  console.info('3. Launching Playwright Chromium & connecting to Supabase Realtime channel...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => console.info('  [Browser]', msg.text()));

  await page.goto('http://localhost:5678');

  // Initialize Realtime subscription in client with JWT
  await page.evaluate(
    ({ url, key, docId, token }) => {
      const win = window as unknown as {
        initRealtimeClient: (u: string, k: string, d: string, t: string) => void;
      };
      win.initRealtimeClient(url, key, docId, token);
    },
    { url: supabaseUrl, key: anonKey, docId: documentId, token: accessToken },
  );

  // Wait for Realtime connection subscription
  await page.waitForFunction(
    () => {
      const win = window as unknown as { __REALTIME_STATE__?: { connected?: boolean } };
      return win.__REALTIME_STATE__?.connected === true;
    },
    { timeout: 10000 },
  );

  // Coordinate stage gates so worker pauses after stage 6 until client recovers and reconnects
  let resumeFromStage6: () => void = () => {};
  const stage6Gate = new Promise<void>((resolve) => {
    resumeFromStage6 = resolve;
  });

  // Start background worker in background promise
  console.info('4. Worker starting processing pipeline...');
  const workerPromise = runWorkerPipeline(
    supabaseUrl,
    serviceRoleKey,
    documentId,
    jobId,
    ownerId,
    async (stage, seq) => {
      if (seq === 6) {
        await stage6Gate;
      }
    },
  );

  // Wait for stage 3 to arrive via live WebSocket
  await page.waitForFunction(
    () => {
      const win = window as unknown as { __REALTIME_STATE__?: { lastSequence?: number } };
      return (win.__REALTIME_STATE__?.lastSequence || 0) >= 3;
    },
    { timeout: 15000 },
  );

  console.info(
    '   - Live WebSocket events verified for initial stages (validating -> extracting -> chunking).',
  );

  // 5. Inject disconnect
  console.info(
    '5. Injecting intentional WebSocket disconnect at Stage 3 (simulating network dropout)...',
  );
  await page.evaluate(() => {
    const win = window as unknown as { simulateDisconnect: () => Promise<void> };
    return win.simulateDisconnect();
  });

  // Wait 1.2s for worker to publish stages 4 (embedding), 5 (classification), 6 (fact_extraction)
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // 6. Trigger Polling Recovery
  console.info(
    '6. Client triggering Polling Recovery (recovering missed stages via monotonic sequence)...',
  );
  await page.evaluate(() => {
    const win = window as unknown as { recoverViaPolling: () => Promise<void> };
    return win.recoverViaPolling();
  });

  const recoveredCount = await page.evaluate(() => {
    const win = window as unknown as { __REALTIME_STATE__?: { missedRecoveredCount?: number } };
    return win.__REALTIME_STATE__?.missedRecoveredCount || 0;
  });
  console.info(`   - Successfully recovered ${recoveredCount} missed stages via polling.`);

  // 7. Reconnect Realtime for remaining stages
  console.info(
    '7. Reconnecting WebSocket Realtime channel for remaining stages (verification -> synthesis -> visuals -> done)...',
  );
  await page.evaluate(() => {
    const win = window as unknown as { reconnectRealtime: () => Promise<boolean> };
    return win.reconnectRealtime();
  });

  console.info('   - Client re-subscribed. Resuming worker pipeline...');
  resumeFromStage6();

  // Wait for worker pipeline to complete and client to receive 'done'
  await workerPromise;
  await page.waitForFunction(
    () => {
      const win = window as unknown as { __REALTIME_STATE__?: { isDone?: boolean } };
      return win.__REALTIME_STATE__?.isDone === true;
    },
    { timeout: 15000 },
  );

  const finalState = await page.evaluate(() => {
    const win = window as unknown as {
      __REALTIME_STATE__: {
        lastSequence: number;
        events: Array<{ stage: string; sequence: number; progress: number }>;
        isDone: boolean;
        missedRecoveredCount: number;
      };
    };
    return win.__REALTIME_STATE__;
  });

  console.info('\n=== Spike S6 Results Summary ===');
  console.info(`Total Stages Received: ${finalState.events.length} / 10`);
  console.info(`Final Monotonic Sequence: ${finalState.lastSequence}`);
  console.info(`Missed Stages Recovered via Polling: ${finalState.missedRecoveredCount}`);
  console.info(`Final Document Status: ${finalState.isDone ? 'DONE' : 'INCOMPLETE'}`);

  console.info('\nObserved Sequence of Stages:');
  for (const ev of finalState.events) {
    console.info(`  [Seq ${ev.sequence}] Stage: ${ev.stage} (${ev.progress}%)`);
  }

  await browser.close();
  server.close();

  // Cleanup test doc
  await supabase.from('documents').delete().eq('id', documentId);

  const passed =
    finalState.events.length === 10 &&
    finalState.isDone === true &&
    finalState.lastSequence === 10 &&
    finalState.missedRecoveredCount > 0;

  const results = {
    spike: 'S6',
    totalStages: 10,
    receivedStages: finalState.events.length,
    finalSequence: finalState.lastSequence,
    missedRecoveredCount: finalState.missedRecoveredCount,
    stagesObserved: finalState.events.map((e) => ({
      seq: e.sequence,
      stage: e.stage,
      progress: e.progress,
    })),
    passed,
  };

  fs.writeFileSync('spikes/s6-realtime/results.json', JSON.stringify(results, null, 2));

  if (!passed) {
    console.error('\n❌ Spike S6 FAILED verification.');
    process.exit(1);
  } else {
    console.info(
      '\n✅ Spike S6 PASSED: Real worker published real job_events via Supabase Realtime to Playwright browser client with monotonic sequence deduplication and seamless polling recovery.',
    );
  }
}

runS6Spike().catch((err) => {
  console.error('Fatal error running Spike S6:', err);
  process.exit(1);
});
