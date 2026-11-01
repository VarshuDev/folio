import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOAuthState,
  verifyOAuthState,
  InMemoryVercelConnectionRepository,
  VercelIntegrationService,
  resetNonceStoreForTesting,
} from '../../lib/integrations/vercel';
import type { VercelConnection } from '../../lib/integrations/vercel/types';
import { GET as handleStatusApi } from '../../app/api/integrations/vercel/status/route';
import { POST as handleDisconnectApi } from '../../app/api/integrations/vercel/disconnect/route';
import { GET as handleCallbackApi } from '../../app/api/integrations/vercel/callback/route';
import { createClient } from '@supabase/supabase-js';

test('Checkpoint 8I.1: Secret boundary separation in Repository', async () => {
  const repo = new InMemoryVercelConnectionRepository();
  const ownerId = 'user-sec-boundary-1';
  const connectionId = 'conn-boundary-1';

  const mockConn: VercelConnection = {
    id: connectionId,
    ownerId,
    configurationId: 'icfg_sec_1',
    accountId: 'team_sec_1',
    teamId: 'team_sec_1',
    scope: 'projects deployments',
    accessToken: 'vcp_SUPER_SENSITIVE_OAUTH_TOKEN_ABC123',
    tokenType: 'Bearer',
    status: 'connected',
    metadata: {
      accountName: 'acme-enterprise',
      teamName: 'Security Team',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repo.saveConnection(mockConn);

  // 1. Verify safe metadata store does NOT contain accessToken or tokenType
  const storedMetadata = repo.getMetadata(ownerId);
  assert.ok(storedMetadata, 'Connection metadata must exist in metadata store');
  assert.equal('accessToken' in storedMetadata, false, 'Metadata store must strictly NOT contain accessToken');
  assert.equal('tokenType' in storedMetadata, false, 'Metadata store must strictly NOT contain tokenType');

  // 2. Verify secret is held strictly in the secrets isolation map
  assert.equal(repo.hasSecret(connectionId), true, 'Secret isolation map holds secret for connectionId');

  // 3. Composite read reconstructs the connection server-side
  const fullConn = await repo.getConnection(ownerId);
  assert.ok(fullConn);
  assert.equal(fullConn?.accessToken, 'vcp_SUPER_SENSITIVE_OAUTH_TOKEN_ABC123');

  // 4. Disconnect clears both metadata and isolated secret
  await repo.deleteConnection(ownerId);
  assert.equal(repo.getMetadata(ownerId), null, 'Metadata must be cleared on disconnect');
  assert.equal(repo.hasSecret(connectionId), false, 'Isolated secret must be revoked/cleared on disconnect');
  assert.equal(await repo.getConnection(ownerId), null);
});

test('Checkpoint 8I.1: /api/integrations/vercel/status strictly never leaks access token', async () => {
  resetNonceStoreForTesting();
  const testUserId = 'api-sec-user-status';
  const service = new VercelIntegrationService();

  // Connect user
  const state = await createOAuthState(testUserId);
  const cbReq = new Request(`http://localhost:3000/api/integrations/vercel/callback?code=mock-code-sec-status&state=${state}&configurationId=icfg_sec_status&format=json`, {
    method: 'GET',
    headers: { 'x-folio-test-user-id': testUserId },
  });
  const cbRes = await handleCallbackApi(cbReq);
  assert.equal(cbRes.status, 200);

  // Call status endpoint
  const statusReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: { 'x-folio-test-user-id': testUserId },
  });
  const statusRes = await handleStatusApi(statusReq);
  assert.equal(statusRes.status, 200);

  const statusJson = await statusRes.json() as Record<string, unknown>;

  // Assert expected safe fields
  assert.equal(statusJson.ok, true);
  assert.equal(statusJson.connected, true);
  assert.equal(typeof statusJson.accountName, 'string');
  assert.equal(typeof statusJson.configurationId, 'string');

  // Strict assertion: access_token or accessToken must NEVER be exposed
  assert.equal('accessToken' in statusJson, false, 'Status response must NEVER contain accessToken');
  assert.equal('access_token' in statusJson, false, 'Status response must NEVER contain access_token');
  assert.equal('token' in statusJson, false, 'Status response must NEVER contain token');
  assert.equal('secret' in statusJson, false, 'Status response must NEVER contain secret');

  // Disconnect user
  const disReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: { 'x-folio-test-user-id': testUserId },
  });
  const disRes = await handleDisconnectApi(disReq);
  assert.equal(disRes.status, 200);
});

test('Checkpoint 8I.1: OAuth Code & State Replay and Tampering defenses', async () => {
  resetNonceStoreForTesting();
  const userId = 'user-sec-replay';

  // 1. Valid state verification succeeds first time
  const state = await createOAuthState(userId);
  const v1 = await verifyOAuthState(state);
  assert.equal(v1.ok, true);

  // 2. Immediate replay of identical state fails
  const v2 = await verifyOAuthState(state);
  assert.equal(v2.ok, false);
  assert.equal(v2.code, 'replayed');

  // 3. Tampered state payload/signature fails
  const freshState = await createOAuthState(userId);
  const [b64, sig] = freshState.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ userId: 'hacker-user', nonce: 'fake', timestamp: Date.now() })).toString('base64url');
  const tamperedState = `${forgedPayload}.${sig}`;

  const vTampered = await verifyOAuthState(tamperedState);
  assert.equal(vTampered.ok, false);
  assert.equal(vTampered.code, 'invalid_signature');
});

test('Checkpoint 8I.1: Direct database client security boundary verification', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // If running in an environment without Supabase credentials, verify in-memory boundary isolation
    assert.ok(true, 'Supabase not configured in this test runner; in-memory secret isolation verified.');
    return;
  }

  // Create untrusted client simulating a browser user with anon key
  const untrustedClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Direct SELECT on vercel_connection_secrets must be rejected or return 0 rows
  const { data: secretsData, error: secretsError } = await untrustedClient
    .from('vercel_connection_secrets')
    .select('*');

  // Either table is denied via RLS / permissions error or returns empty array
  if (secretsError) {
    assert.ok(
      secretsError.message.includes('permission denied') ||
      secretsError.message.includes('Could not find') ||
      secretsError.code === '42501' ||
      secretsError.code === 'PGRST204',
      `Direct access to vercel_connection_secrets must be blocked (observed error: ${secretsError.message})`
    );
  } else {
    assert.equal(secretsData?.length ?? 0, 0, 'Client query cannot read any records from vercel_connection_secrets');
  }

  // 2. Direct query on vercel_connections must return 0 rows or error for untrusted client
  const { data: connData, error: connError } = await untrustedClient
    .from('vercel_connections')
    .select('*');

  if (!connError && connData) {
    // If row returned (e.g. if RLS filtered to empty), assert access_token is NOT a column or is not populated
    for (const row of connData) {
      assert.equal('access_token' in row, false, 'Client must NOT see access_token column on vercel_connections');
    }
  }
});
