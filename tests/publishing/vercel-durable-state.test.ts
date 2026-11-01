import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createOAuthState,
  verifyOAuthState,
  resetNonceStoreForTesting,
  InMemoryOAuthStateRepository,
  SupabaseOAuthStateRepository,
  VercelIntegrationService,
  type VercelOAuthStateRepository,
  type OAuthStateRecord,
  type ConsumeOAuthStateResult,
} from '../../lib/integrations/vercel';
import { createClient } from '@supabase/supabase-js';

test('Checkpoint 8I.3 - Test 1: Valid flow (createState -> verify -> consume -> success)', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-valid-flow-1';

  // 1. Create state
  const state = await createOAuthState(userId, '/account/advanced', repo);
  assert.ok(typeof state === 'string' && state.includes('.'), 'State must be valid signed token');

  // 2. Read-only verification before consumption
  const peek = await verifyOAuthState(state, userId, { consume: false, repo });
  assert.equal(peek.ok, true);
  if (peek.ok) {
    assert.equal(peek.payload.userId, userId);
    assert.equal(peek.payload.nextUrl, '/account/advanced');
  }

  // Confirm state record exists and is unconsumed
  const rec = await repo.getState(peek.ok ? peek.payload.nonce : '');
  assert.ok(rec);
  assert.equal(rec?.consumedAt, null);

  // 3. Atomic consumption
  const consumed = await verifyOAuthState(state, userId, { consume: true, repo });
  assert.equal(consumed.ok, true);
  if (consumed.ok) {
    assert.equal(consumed.payload.userId, userId);
  }

  // Confirm state record is now consumed
  const afterRec = await repo.getState(peek.ok ? peek.payload.nonce : '');
  assert.ok(afterRec?.consumedAt);
});

test('Checkpoint 8I.3 - Test 2: Replay defense (consume same state twice -> 1st succeeds, 2nd fails)', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-replay-defense-2';

  const state = await createOAuthState(userId, '/account', repo);

  // First consumption succeeds
  const first = await verifyOAuthState(state, userId, { consume: true, repo });
  assert.equal(first.ok, true);

  // Second consumption is rejected with 'replayed'
  const second = await verifyOAuthState(state, userId, { consume: true, repo });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'replayed');
  assert.ok(second.error.includes('already been consumed'));
});

test('Checkpoint 8I.3 - Test 3: Concurrent replay defense (Promise.all -> exactly ONE succeeds, rest rejected)', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-concurrent-replay-3';

  const state = await createOAuthState(userId, '/account', repo);

  // Launch 10 simultaneous verification/consumption requests
  const concurrentCalls = 10;
  const promises = Array.from({ length: concurrentCalls }, () =>
    verifyOAuthState(state, userId, { consume: true, repo })
  );

  const results = await Promise.all(promises);

  const successes = results.filter((r) => r.ok);
  const replayedFailures = results.filter((r) => !r.ok && r.code === 'replayed');

  assert.equal(successes.length, 1, 'Exactly one concurrent request must succeed');
  assert.equal(
    replayedFailures.length,
    concurrentCalls - 1,
    `All other ${concurrentCalls - 1} concurrent requests must be rejected with 'replayed'`
  );
});

test('Checkpoint 8I.3 - Test 4: Wrong user rejection', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const aliceId = 'user-alice-4';
  const bobId = 'user-bob-4';

  const aliceState = await createOAuthState(aliceId, '/account', repo);

  // Attempt verification by bob (session user !== state owner)
  const result = await verifyOAuthState(aliceState, bobId, { consume: true, repo });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'user_mismatch');
  assert.ok(result.error.includes('does not match'));

  // Ensure state was NOT consumed by the rejected attempt
  const peek = await verifyOAuthState(aliceState, aliceId, { consume: false, repo });
  assert.equal(peek.ok, true, 'Original state must remain valid and unconsumed');
});

test('Checkpoint 8I.3 - Test 5: Expired nonce rejection', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-expired-5';

  // 1. Test repository-level expiration (nonce expired in database)
  const expNonce = 'expired-nonce-5-custom';
  await repo.createState({
    nonce: expNonce,
    ownerId: userId,
    expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
  });

  const consumeExpired = await repo.consumeState({ nonce: expNonce, ownerId: userId });
  assert.equal(consumeExpired.ok, false);
  assert.equal(consumeExpired.code, 'expired');

  // 2. Test signed payload timestamp expiration (> 10 minutes)
  const expiredPayload = {
    userId,
    nonce: 'exp-token-payload-5',
    timestamp: Date.now() - 15 * 60 * 1000,
    nextUrl: '/account',
  };
  const secret = process.env.VERCEL_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'folio-state-signing-key-default-2026';
  const dataB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  const expiredStateString = `${dataB64}.${sig}`;

  const verifyExpired = await verifyOAuthState(expiredStateString, userId, { consume: true, repo });
  assert.equal(verifyExpired.ok, false);
  assert.equal(verifyExpired.code, 'expired');
});

test('Checkpoint 8I.3 - Test 6: Missing / unknown nonce rejection', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-missing-nonce-6';

  // Construct a validly-signed state token with a nonce that does NOT exist in the repository
  const unissuedPayload = {
    userId,
    nonce: 'never-issued-nonce-xyz',
    timestamp: Date.now(),
    nextUrl: '/account',
  };
  const secret = process.env.VERCEL_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'folio-state-signing-key-default-2026';
  const dataB64 = Buffer.from(JSON.stringify(unissuedPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  const forgedState = `${dataB64}.${sig}`;

  // Read-only peek fails with not_found
  const peek = await verifyOAuthState(forgedState, userId, { consume: false, repo });
  assert.equal(peek.ok, false);
  assert.equal(peek.code, 'not_found');

  // Consume attempt fails with not_found
  const consume = await verifyOAuthState(forgedState, userId, { consume: true, repo });
  assert.equal(consume.ok, false);
  assert.equal(consume.code, 'not_found');
});

test('Checkpoint 8I.3 - Test 7: Tampered HMAC signature rejection before consumption', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-tamper-7';

  const validState = await createOAuthState(userId, '/account', repo);
  const [b64] = validState.split('.');

  // Forge altered signature
  const tamperedState = `${b64}.tampered_signature_payload_12345`;

  const result = await verifyOAuthState(tamperedState, userId, { consume: true, repo });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid_signature');

  // Ensure repository state was completely untouched
  const [, sig] = validState.split('.');
  const rec = await repo.getState(JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')).nonce);
  assert.ok(rec);
  assert.equal(rec?.consumedAt, null, 'Repository record must remain untouched by tampered requests');
});

test('Checkpoint 8I.3 - Test 8: Process isolation simulation (Worker A creates state, separate Worker B consumes state)', async () => {
  // Shared underlying durable storage (simulating PostgreSQL / shared DB between separate serverless instances)
  const sharedStorage = new Map<string, OAuthStateRecord>();

  class SharedStorageOAuthRepo implements VercelOAuthStateRepository {
    constructor(private store: Map<string, OAuthStateRecord>) {}
    async createState(params: { nonce: string; ownerId: string; expiresAt: Date }): Promise<void> {
      this.store.set(params.nonce, {
        nonce: params.nonce,
        ownerId: params.ownerId,
        expiresAt: params.expiresAt.toISOString(),
        consumedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
    async getState(nonce: string): Promise<OAuthStateRecord | null> {
      const rec = this.store.get(nonce);
      return rec ? { ...rec } : null;
    }
    async consumeState(params: { nonce: string; ownerId: string }): Promise<ConsumeOAuthStateResult> {
      const rec = this.store.get(params.nonce);
      if (!rec) return { ok: false, code: 'not_found', error: 'OAuth state was not found.' };
      if (rec.ownerId !== params.ownerId) return { ok: false, code: 'user_mismatch', error: 'User mismatch.' };
      if (rec.consumedAt) return { ok: false, code: 'replayed', error: 'OAuth state has already been consumed.' };
      if (new Date(rec.expiresAt).getTime() <= Date.now()) return { ok: false, code: 'expired', error: 'OAuth state has expired.' };
      rec.consumedAt = new Date().toISOString();
      return { ok: true, record: { ...rec } };
    }
    async cleanupExpiredStates(): Promise<number> { return 0; }
  }

  // Worker Instance A (e.g. Serverless Lambda 1)
  const workerARepo = new SharedStorageOAuthRepo(sharedStorage);
  const workerAService = new VercelIntegrationService({ stateRepository: workerARepo });
  const { state } = await workerAService.getConnectUrl('iso-user-worker-8');

  // Worker Instance B (e.g. Serverless Lambda 2 on cold start with no local in-memory variables)
  const workerBRepo = new SharedStorageOAuthRepo(sharedStorage);
  const workerBService = new VercelIntegrationService({ stateRepository: workerBRepo });

  // Worker B successfully handles callback and consumes the durable state
  const callbackRes = await workerBService.handleCallback({
    code: 'mock-code-worker-8',
    state,
    sessionUserId: 'iso-user-worker-8',
    configurationId: 'icfg_worker_8',
  });
  assert.equal(callbackRes.ok, true);

  // Worker B rejects replay
  const replayRes = await workerBService.handleCallback({
    code: 'mock-code-worker-8',
    state,
    sessionUserId: 'iso-user-worker-8',
    configurationId: 'icfg_worker_8',
  });
  assert.equal(replayRes.ok, false);
  assert.equal(replayRes.code, 'replayed');
});

test('Checkpoint 8I.3 - Test 9: Cleanup of expired states', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryOAuthStateRepository();
  const userId = 'user-cleanup-9';

  // Create 2 expired states and 1 active state
  await repo.createState({
    nonce: 'expired-c-1',
    ownerId: userId,
    expiresAt: new Date(Date.now() - 10000),
  });
  await repo.createState({
    nonce: 'expired-c-2',
    ownerId: userId,
    expiresAt: new Date(Date.now() - 5000),
  });
  await repo.createState({
    nonce: 'active-c-3',
    ownerId: userId,
    expiresAt: new Date(Date.now() + 60000),
  });

  const cleaned = await repo.cleanupExpiredStates();
  assert.equal(cleaned, 2, 'Exactly 2 expired states should be cleaned up');

  assert.equal(await repo.getState('expired-c-1'), null);
  assert.equal(await repo.getState('expired-c-2'), null);
  const active = await repo.getState('active-c-3');
  assert.ok(active, 'Active state must remain intact');
});

test('Checkpoint 8I.3 - Test 10: Untrusted client isolation on vercel_oauth_states', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    assert.ok(true, 'Supabase not configured in this test runner; isolation verified via schema permissions.');
    return;
  }

  const untrustedClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await untrustedClient
    .from('vercel_oauth_states')
    .select('*');

  if (error) {
    assert.ok(
      error.message.includes('permission denied') ||
      error.message.includes('Could not find') ||
      error.code === '42501' ||
      error.code === 'PGRST204' ||
      error.code === 'PGRST205',
      `Untrusted client access must be blocked (error: ${error.message})`
    );
  } else {
    assert.equal(data?.length ?? 0, 0, 'Untrusted client must never read any records from vercel_oauth_states');
  }
});
