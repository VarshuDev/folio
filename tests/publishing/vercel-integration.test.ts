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
import { GET as handleConnectApi } from '../../app/api/integrations/vercel/connect/route';
import { GET as handleStatusApi } from '../../app/api/integrations/vercel/status/route';
import { POST as handleDisconnectApi } from '../../app/api/integrations/vercel/disconnect/route';
import { GET as handleCallbackApi } from '../../app/api/integrations/vercel/callback/route';
import { POST as handleTokenApi } from '../../app/api/integrations/vercel/token/route';

test('Vercel Integration: OAuth State management and CSRF defense', async () => {
  resetNonceStoreForTesting();
  const userId = 'user-test-789';

  // 1. Generate valid state
  const state = await createOAuthState(userId, '/account');
  assert.ok(typeof state === 'string' && state.length > 20, 'State must be a non-empty string');

  // 2. Verify valid state succeeds
  const verification = await verifyOAuthState(state);
  assert.equal(verification.ok, true);
  if (verification.ok) {
    assert.equal(verification.payload.userId, userId);
    assert.equal(verification.payload.nextUrl, '/account');
  }

  // 3. Replay attack prevention: same state cannot be verified twice
  const replayVerification = await verifyOAuthState(state);
  assert.equal(replayVerification.ok, false);
  assert.equal(replayVerification.code, 'replayed');

  // 4. Reject tampered state
  const state2 = await createOAuthState(userId);
  const parts = state2.split('.');
  assert.equal(parts.length, 2);
  const tamperedState = `${parts[0]}.forgedsignature123`;
  const tamperedVerification = await verifyOAuthState(tamperedState);
  assert.equal(tamperedVerification.ok, false);
  assert.equal(tamperedVerification.code, 'invalid_signature');

  // 5. Reject malformed state
  const malformedVerification = await verifyOAuthState('not-even-a-token');
  assert.equal(malformedVerification.ok, false);
  assert.equal(malformedVerification.code, 'invalid_format');

  // 6. Reject expired state (craft payload with timestamp older than 10 mins)
  const expiredPayload = {
    userId,
    nonce: 'exp-nonce-123',
    timestamp: Date.now() - 15 * 60 * 1000, // 15 mins ago
  };
  const crypto = require('node:crypto');
  const secret = process.env.VERCEL_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'folio-state-signing-key-default-2026';
  const dataB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  const expiredState = `${dataB64}.${sig}`;

  const expiredVerification = await verifyOAuthState(expiredState);
  assert.equal(expiredVerification.ok, false);
  assert.equal(expiredVerification.code, 'expired');
});

test('Vercel Integration: InMemoryVercelConnectionRepository lifecycle', async () => {
  const repo = new InMemoryVercelConnectionRepository();
  const ownerId = 'user-owner-101';

  // Initially empty
  const initial = await repo.findByOwnerId(ownerId);
  assert.equal(initial, null);

  // Save connection
  const mockConn: VercelConnection = {
    id: 'conn-1',
    ownerId,
    configurationId: 'icfg_test123',
    accountId: 'team_xyz',
    teamId: 'team_xyz',
    scope: 'read,write',
    accessToken: 'sec_mock_super_secret_token_123',
    tokenType: 'bearer',
    status: 'connected',
    metadata: {
      accountName: 'acme-corp',
      teamName: 'Acme Frontend Team',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repo.saveConnection(mockConn);

  const found = await repo.findByOwnerId(ownerId);
  assert.ok(found);
  assert.equal(found.id, 'conn-1');
  assert.equal(found.configurationId, 'icfg_test123');
  assert.equal(found.metadata.accountName, 'acme-corp');

  // Delete connection
  await repo.deleteConnection(ownerId);
  const afterDelete = await repo.findByOwnerId(ownerId);
  assert.equal(afterDelete, null);
});

test('Vercel Integration: VercelIntegrationService connect, callback, status, disconnect', async () => {
  resetNonceStoreForTesting();
  const repo = new InMemoryVercelConnectionRepository();
  const service = new VercelIntegrationService({ repository: repo });
  const userId = 'user-service-test-1';

  // 1. Initial status is disconnected
  const initialStatus = await service.getStatus(userId);
  assert.equal(initialStatus.connected, false);

  // 2. Generate connect URL
  const { url: connectUrl, state } = await service.getConnectUrl(userId);
  assert.ok(
    connectUrl.includes('vercel.com/oauth/authorize') || connectUrl.includes('vercel.com/integrations/'),
    'Connect URL must use official Vercel authorize or integration endpoint'
  );
  assert.ok(connectUrl.includes('state='));
  assert.ok(state.length > 10);

  // 3. Callback with missing code fails
  const missingCodeRes = await service.handleCallback({
    code: null,
    state,
    sessionUserId: userId,
    redirectUri: 'http://localhost:3000/api/integrations/vercel/callback',
  });
  assert.equal(missingCodeRes.ok, false);
  assert.equal(missingCodeRes.code, 'missing_code');

  // 4. Callback with mock code succeeds and connects
  const freshState = await createOAuthState(userId);
  const callbackRes = await service.handleCallback({
    code: 'mock-code-success-123',
    state: freshState,
    teamId: 'team_folio_beta',
    configurationId: 'icfg_folio_beta_99',
    sessionUserId: userId,
    redirectUri: 'http://localhost:3000/api/integrations/vercel/callback',
  });

  assert.equal(callbackRes.ok, true);
  assert.ok(callbackRes.connection);
  assert.equal(callbackRes.connection.configurationId, 'icfg_folio_beta_99');

  // 5. Status returns client-safe object with ZERO secret exposure
  const statusAfter = await service.getStatus(userId);
  assert.equal(statusAfter.connected, true);
  assert.equal(statusAfter.configurationId, 'icfg_folio_beta_99');
  assert.equal(statusAfter.teamId, 'team_folio_beta');

  // Explicit safety assertion: client status must NEVER have accessToken or secrets
  assert.equal('accessToken' in statusAfter, false);
  assert.equal('token' in statusAfter, false);
  assert.equal('secret' in statusAfter, false);
  assert.equal('key' in statusAfter, false);

  // 6. Disconnect
  const disconnectRes = await service.disconnect(userId);
  assert.equal(disconnectRes.ok, true);

  const statusAfterDisconnect = await service.getStatus(userId);
  assert.equal(statusAfterDisconnect.connected, false);
});

test('Vercel Integration API: /api/integrations/vercel/connect endpoint', async () => {
  // 1. Unauthenticated request rejected with 401
  const unauthReq = new Request('http://localhost:3000/api/integrations/vercel/connect', {
    method: 'GET',
  });
  const unauthRes = await handleConnectApi(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated request returns 200 with installUrl and state
  const testUserId = 'api-user-test-conn';
  const authReq = new Request('http://localhost:3000/api/integrations/vercel/connect?next=/account', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const authRes = await handleConnectApi(authReq);
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.equal(data.ok, true);
  assert.ok(
    data.installUrl.includes('vercel.com/oauth/authorize') || data.installUrl.includes('vercel.com/integrations/'),
    'installUrl must target official Vercel authorize or integrations endpoint'
  );
  assert.ok(data.state && data.state.length > 10);
});

test('Vercel Integration API: /api/integrations/vercel/status endpoint', async () => {
  // 1. Unauthenticated request rejected with 401
  const unauthReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
  });
  const unauthRes = await handleStatusApi(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated request without connection returns connected: false
  const testUserId = 'api-user-test-status';
  const authReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const authRes = await handleStatusApi(authReq);
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.equal(data.ok, true);
  assert.equal(data.connected, false);
});

test('Vercel Integration API: /api/integrations/vercel/callback endpoint', async () => {
  resetNonceStoreForTesting();
  const testUserId = 'api-user-test-cb';

  // 1. Missing state rejected with 400
  const noStateReq = new Request('http://localhost:3000/api/integrations/vercel/callback?code=mock-123&format=json', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const noStateRes = await handleCallbackApi(noStateReq);
  assert.equal(noStateRes.status, 400);
  const noStateData = await noStateRes.json();
  assert.equal(noStateData.code, 'missing_state');

  // 2. Tampered state rejected with 400
  const badStateReq = new Request('http://localhost:3000/api/integrations/vercel/callback?code=mock-123&state=bad.state&format=json', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const badStateRes = await handleCallbackApi(badStateReq);
  assert.equal(badStateRes.status, 400);

  // 3. User mismatch rejected with 403
  const otherUserState = await createOAuthState('other-user-456');
  const mismatchReq = new Request(`http://localhost:3000/api/integrations/vercel/callback?code=mock-123&state=${otherUserState}&format=json`, {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId, // testUserId !== 'other-user-456'
    },
  });
  const mismatchRes = await handleCallbackApi(mismatchReq);
  assert.equal(mismatchRes.status, 403);
  const mismatchData = await mismatchRes.json();
  assert.equal(mismatchData.code, 'user_mismatch');

  // 4. Valid mock code callback succeeds with 200 JSON
  const validState = await createOAuthState(testUserId);
  const validReq = new Request(`http://localhost:3000/api/integrations/vercel/callback?code=mock-code-cb-ok&state=${validState}&configurationId=icfg_api_99&teamId=team_api_99&format=json`, {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const validRes = await handleCallbackApi(validReq);
  assert.equal(validRes.status, 200);
  const validData = await validRes.json();
  assert.equal(validData.ok, true);
  assert.equal(validData.connected, true);

  // 5. Subsequent status call confirms connected
  const statusReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const statusRes = await handleStatusApi(statusReq);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.connected, true);
  assert.equal(statusData.configurationId, 'icfg_api_99');

  // 6. Disconnect endpoint disconnects successfully
  const disconnectReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const disconnectRes = await handleDisconnectApi(disconnectReq);
  assert.equal(disconnectRes.status, 200);
  const disconnectData = await disconnectRes.json();
  assert.equal(disconnectData.ok, true);
  assert.equal(disconnectData.disconnected, true);

  // 7. Verify status is now false
  const statusReq2 = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const statusRes2 = await handleStatusApi(statusReq2);
  const statusData2 = await statusRes2.json();
  assert.equal(statusData2.connected, false);
});

test('Vercel Integration: Direct Personal Access Token (PAT) connection', async () => {
  const repo = new InMemoryVercelConnectionRepository();
  const service = new VercelIntegrationService({ repository: repo });
  const userId = 'user-pat-test-1';

  // 1. Missing token rejected
  const emptyRes = await service.connectWithToken({ userId, token: '   ' });
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.code, 'missing_token');

  // 2. Valid token connects successfully
  const connectRes = await service.connectWithToken({
    userId,
    token: 'mock-pat-secret-12345',
    teamId: 'team_pat_enterprise',
  });
  assert.equal(connectRes.ok, true);
  assert.ok(connectRes.connection);
  assert.equal(connectRes.connection.ownerId, userId);
  assert.equal(connectRes.connection.status, 'connected');
  assert.equal(connectRes.connection.teamId, 'team_pat_enterprise');

  // 3. Status returns connected without secrets
  const status = await service.getStatus(userId);
  assert.equal(status.connected, true);
  assert.equal(status.teamId, 'team_pat_enterprise');
  assert.equal('accessToken' in status, false);
  assert.equal('token' in status, false);

  // 4. Disconnect cleanly removes connection
  const discRes = await service.disconnect(userId);
  assert.equal(discRes.ok, true);

  const statusAfterDisc = await service.getStatus(userId);
  assert.equal(statusAfterDisc.connected, false);
});

test('Vercel Integration API: /api/integrations/vercel/token endpoint', async () => {
  const testUserId = 'api-pat-user-test';

  // 1. Unauthenticated request rejected with 401
  const unauthReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'mock-token' }),
  });
  const unauthRes = await handleTokenApi(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Missing token rejected with 400
  const noTokenReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({ token: '' }),
  });
  const noTokenRes = await handleTokenApi(noTokenReq);
  assert.equal(noTokenRes.status, 400);
  const noTokenData = await noTokenRes.json();
  assert.equal(noTokenData.code, 'missing_token');

  // 3. Valid token succeeds with 200 and safe response
  const validTokenReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      token: 'mock-valid-pat-token-abc',
      teamId: 'team_xyz',
    }),
  });
  const validTokenRes = await handleTokenApi(validTokenReq);
  assert.equal(validTokenRes.status, 200);
  const validData = await validTokenRes.json();
  assert.equal(validData.ok, true);
  assert.equal(validData.connected, true);
  assert.equal('accessToken' in validData, false);
  assert.equal('token' in validData, false);

  // 4. Status endpoint confirms connected
  const statusReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  const statusRes = await handleStatusApi(statusReq);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.connected, true);

  // Clean up
  const disconnectReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: {
      'x-folio-test-user-id': testUserId,
    },
  });
  await handleDisconnectApi(disconnectReq);
});

test('Vercel Integration: getConnectUrl does not force teamSlug on external users', async () => {
  const service = new VercelIntegrationService();
  const userId = 'user-external-999';

  // Connecting without teamSlug option should NOT contain teamSlug in url
  const res = await service.getConnectUrl({
    userId,
    redirectUri: 'http://localhost:3000/api/integrations/vercel/callback',
  });
  assert.ok(!res.url.includes('teamSlug='), 'URL must not force teamSlug on external users');

  // Explicit teamSlug option is respected
  const resWithTeam = await service.getConnectUrl({
    userId,
    redirectUri: 'http://localhost:3000/api/integrations/vercel/callback',
    teamSlug: 'my-custom-team',
  });
  assert.ok(resWithTeam.url.includes('teamSlug=my-custom-team'));
});

test('Vercel Integration: Connectable Account Integration URL generation vs Sign-in OAuth fallback', async () => {
  const origSlug = process.env.VERCEL_INTEGRATION_SLUG;
  const origClientId = process.env.VERCEL_CLIENT_ID;

  try {
    process.env.VERCEL_INTEGRATION_SLUG = 'folio-official-integration';
    process.env.VERCEL_CLIENT_ID = 'oac_123456789';

    const service = new VercelIntegrationService();

    // 1. When integration slug is configured, it uses the official marketplace installation endpoint
    const res = await service.getConnectUrl({ userId: 'user-slug-test' });
    assert.ok(res.url.startsWith('https://vercel.com/integrations/folio-official-integration/new'));
    assert.ok(res.url.includes('state='));
    assert.ok(!res.url.includes('client_id='), 'Integration installation URL must not take client_id query param');

    // 2. If explicitly requesting oauth flow, it routes to /oauth/authorize
    const oauthRes = await service.getConnectUrl({ userId: 'user-slug-test', flow: 'oauth' });
    assert.ok(oauthRes.url.startsWith('https://vercel.com/oauth/authorize'));
    assert.ok(oauthRes.url.includes('client_id=oac_123456789'));

    // 3. If slug is absent, it falls back to OAuth client_id
    delete process.env.VERCEL_INTEGRATION_SLUG;
    const fallbackRes = await service.getConnectUrl({ userId: 'user-slug-test' });
    assert.ok(fallbackRes.url.startsWith('https://vercel.com/oauth/authorize'));
  } finally {
    if (origSlug !== undefined) process.env.VERCEL_INTEGRATION_SLUG = origSlug;
    else delete process.env.VERCEL_INTEGRATION_SLUG;
    if (origClientId !== undefined) process.env.VERCEL_CLIENT_ID = origClientId;
    else delete process.env.VERCEL_CLIENT_ID;
  }
});

test('Vercel Integration: Missing integration configuration returns unconfigured_integration', async () => {
  const origClientId = process.env.VERCEL_CLIENT_ID;
  const origSlug = process.env.VERCEL_INTEGRATION_SLUG;
  const origRequireConfig = process.env.VERCEL_REQUIRE_CONFIG;

  try {
    delete process.env.VERCEL_CLIENT_ID;
    delete process.env.VERCEL_INTEGRATION_SLUG;
    process.env.VERCEL_REQUIRE_CONFIG = '1';

    const service = new VercelIntegrationService();
    await assert.rejects(
      async () => {
        await service.getConnectUrl('user-test-unconfigured');
      },
      (err: unknown) => {
        const errorObj = err as { code?: string; message?: string };
        assert.equal(errorObj.code, 'unconfigured_integration');
        assert.ok(errorObj.message?.includes('VERCEL_CLIENT_ID'));
        return true;
      }
    );

    // Verify /api/integrations/vercel/connect endpoint returns 503
    const req = new Request('http://localhost:3000/api/integrations/vercel/connect', {
      headers: { 'x-folio-test-user-id': 'user-test-unconfigured' },
    });
    const res = await handleConnectApi(req);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'unconfigured_integration');
  } finally {
    if (origClientId !== undefined) process.env.VERCEL_CLIENT_ID = origClientId;
    else delete process.env.VERCEL_CLIENT_ID;
    if (origSlug !== undefined) process.env.VERCEL_INTEGRATION_SLUG = origSlug;
    else delete process.env.VERCEL_INTEGRATION_SLUG;
    if (origRequireConfig !== undefined) process.env.VERCEL_REQUIRE_CONFIG = origRequireConfig;
    else delete process.env.VERCEL_REQUIRE_CONFIG;
  }
});

test('Vercel Integration: Personal Account vs Team Scope separation', async () => {
  const repo = new InMemoryVercelConnectionRepository();
  const service = new VercelIntegrationService({ repository: repo });
  const userPersonal = 'user-personal-scope';
  const userTeam = 'user-team-scope';

  // 1. Connect Personal Scope
  const personalState = await createOAuthState(userPersonal);
  const personalRes = await service.handleCallback({
    code: 'mock-code-personal',
    state: personalState,
    teamId: null,
    sessionUserId: userPersonal,
  });
  assert.equal(personalRes.ok, true);

  const personalStatus = await service.getStatus(userPersonal);
  assert.equal(personalStatus.connected, true);
  assert.equal(personalStatus.teamId, null);
  assert.equal(personalStatus.scope, 'Personal Account');

  // 2. Connect Team Scope
  const teamState = await createOAuthState(userTeam);
  const teamRes = await service.handleCallback({
    code: 'mock-code-team',
    state: teamState,
    teamId: 'team_acme_corp',
    sessionUserId: userTeam,
  });
  assert.equal(teamRes.ok, true);

  const teamStatus = await service.getStatus(userTeam);
  assert.equal(teamStatus.connected, true);
  assert.equal(teamStatus.teamId, 'team_acme_corp');
  assert.ok(teamStatus.scope?.includes('team_acme_corp') || teamStatus.scope === 'Team team_acme_corp');
});

test('Vercel Integration: Cross-user status and disconnect endpoint protection', async () => {
  const victimId = 'user-victim-100';
  const attackerId = 'user-attacker-200';

  // 1. Status query with mismatched ownerId parameter rejected with 403
  const statusReq = new Request(`http://localhost:3000/api/integrations/vercel/status?userId=${victimId}`, {
    headers: { 'x-folio-test-user-id': attackerId },
  });
  const statusRes = await handleStatusApi(statusReq);
  assert.equal(statusRes.status, 403);
  const statusData = await statusRes.json();
  assert.equal(statusData.code, 'forbidden');

  // 2. Disconnect request on behalf of another user rejected with 403
  const disReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': attackerId,
    },
    body: JSON.stringify({ userId: victimId }),
  });
  const disRes = await handleDisconnectApi(disReq);
  assert.equal(disRes.status, 403);
  const disData = await disRes.json();
  assert.equal(disData.code, 'forbidden');
});

