import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as handleTokenApi } from '@/app/api/integrations/vercel/token/route';
import { GET as handleStatusApi } from '@/app/api/integrations/vercel/status/route';
import { POST as handleDisconnectApi } from '@/app/api/integrations/vercel/disconnect/route';
import { getVercelService } from '@/lib/integrations/vercel';

test('Security Audit: /api/integrations/vercel/token - Authentication & Cross-User Isolation', async () => {
  const aliceUserId = 'user-alice-security-test';
  const bobUserId = 'user-bob-security-test';

  // 1. Unauthenticated request rejected with 401
  const unauthReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'mock-valid-pat-token-alice' }),
  });
  const unauthRes = await handleTokenApi(unauthReq);
  assert.equal(unauthRes.status, 401);
  const unauthData = await unauthRes.json();
  assert.equal(unauthData.code, 'unauthenticated');

  // 2. Cross-user attempt: Alice tries to connect on behalf of Bob using ownerId
  const crossUserReq1 = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': aliceUserId,
    },
    body: JSON.stringify({
      token: 'mock-valid-pat-token-alice',
      ownerId: bobUserId,
    }),
  });
  const crossRes1 = await handleTokenApi(crossUserReq1);
  assert.equal(crossRes1.status, 403, 'Cross-user attempt with ownerId must be rejected with 403');
  const crossData1 = await crossRes1.json();
  assert.equal(crossData1.code, 'forbidden');

  // 3. Cross-user attempt: Alice tries to connect on behalf of Bob using userId in body
  const crossUserReq2 = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': aliceUserId,
    },
    body: JSON.stringify({
      token: 'mock-valid-pat-token-alice',
      userId: bobUserId,
    }),
  });
  const crossRes2 = await handleTokenApi(crossUserReq2);
  assert.equal(crossRes2.status, 403, 'Cross-user attempt with userId must be rejected with 403');
  const crossData2 = await crossRes2.json();
  assert.equal(crossData2.code, 'forbidden');
});

test('Security Audit: /api/integrations/vercel/token - Abuse Protection & Input Validation', async () => {
  const userId = 'user-validation-test';

  // 1. Missing / empty token
  const emptyReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({ token: '   ' }),
  });
  const emptyRes = await handleTokenApi(emptyReq);
  assert.equal(emptyRes.status, 400);
  const emptyData = await emptyRes.json();
  assert.equal(emptyData.code, 'missing_token');

  // 2. Short token (< 10 chars)
  const shortReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({ token: 'tiny' }),
  });
  const shortRes = await handleTokenApi(shortReq);
  assert.equal(shortRes.status, 400);
  const shortData = await shortRes.json();
  assert.equal(shortData.code, 'invalid_token');

  // 3. Oversized token (> 512 chars)
  const hugeToken = 'a'.repeat(600);
  const hugeTokenReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({ token: hugeToken }),
  });
  const hugeTokenRes = await handleTokenApi(hugeTokenReq);
  assert.equal(hugeTokenRes.status, 400);
  const hugeTokenData = await hugeTokenRes.json();
  assert.equal(hugeTokenData.code, 'invalid_token');

  // 4. Oversized teamId (> 100 chars)
  const hugeTeam = 't'.repeat(150);
  const hugeTeamReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({ token: 'mock-valid-pat-token-xyz', teamId: hugeTeam }),
  });
  const hugeTeamRes = await handleTokenApi(hugeTeamReq);
  assert.equal(hugeTeamRes.status, 400);
  const hugeTeamData = await hugeTeamRes.json();
  assert.equal(hugeTeamData.code, 'invalid_team_id');

  // 5. Oversized payload (content-length header exceeds 16KB)
  const hugeBodyReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '25000',
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({ token: 'mock-valid-token' }),
  });
  const hugeBodyRes = await handleTokenApi(hugeBodyReq);
  assert.equal(hugeBodyRes.status, 413);
  const hugeBodyData = await hugeBodyRes.json();
  assert.equal(hugeBodyData.code, 'payload_too_large');

  // 6. Malformed JSON
  const badJsonReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': userId,
    },
    body: 'this-is-not-json{',
  });
  const badJsonRes = await handleTokenApi(badJsonReq);
  assert.equal(badJsonRes.status, 400);
  const badJsonData = await badJsonRes.json();
  assert.equal(badJsonData.code, 'invalid_json');
});

test('Security Audit: /api/integrations/vercel/token - Zero Credential Leakage & Cross-User Guard', async () => {
  const aliceUserId = 'user-alice-pat-secrets';
  const bobUserId = 'user-bob-pat-secrets';
  const patToken = 'mock-super-secret-pat-999999999';

  // 1. Alice connects valid PAT
  const connectReq = new Request('http://localhost:3000/api/integrations/vercel/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': aliceUserId,
    },
    body: JSON.stringify({
      token: patToken,
      teamId: 'team_alice_pro',
    }),
  });
  const connectRes = await handleTokenApi(connectReq);
  assert.equal(connectRes.status, 200);

  // Response must NEVER leak the secret token
  const connectData = await connectRes.json();
  assert.equal(connectData.ok, true);
  assert.equal(connectData.connected, true);
  assert.equal('accessToken' in connectData, false, 'Client response must never expose accessToken');
  assert.equal('token' in connectData, false, 'Client response must never expose token');
  assert.equal('client_secret' in connectData, false);
  const rawResponse = JSON.stringify(connectData);
  assert.equal(rawResponse.includes(patToken), false, 'Raw token string must not appear in JSON response');

  // 2. Status check for Alice verifies connection without leaking token
  const statusReq = new Request('http://localhost:3000/api/integrations/vercel/status', {
    method: 'GET',
    headers: { 'x-folio-test-user-id': aliceUserId },
  });
  const statusRes = await handleStatusApi(statusReq);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.connected, true);
  assert.equal('accessToken' in statusData, false);
  assert.equal('token' in statusData, false);

  // 3. Bob attempts to inspect Alice's connection via status query param
  const bobSnoopReq = new Request(`http://localhost:3000/api/integrations/vercel/status?ownerId=${aliceUserId}`, {
    method: 'GET',
    headers: { 'x-folio-test-user-id': bobUserId },
  });
  const bobSnoopRes = await handleStatusApi(bobSnoopReq);
  assert.equal(bobSnoopRes.status, 403, 'Bob must be forbidden from inspecting Alice status');

  // 4. Bob attempts to disconnect Alice
  const bobDiscReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': bobUserId,
    },
    body: JSON.stringify({ ownerId: aliceUserId }),
  });
  const bobDiscRes = await handleDisconnectApi(bobDiscReq);
  assert.equal(bobDiscRes.status, 403, 'Bob must be forbidden from disconnecting Alice');

  // 5. Clean disconnect by Alice herself
  const aliceDiscReq = new Request('http://localhost:3000/api/integrations/vercel/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': aliceUserId,
    },
  });
  const aliceDiscRes = await handleDisconnectApi(aliceDiscReq);
  assert.equal(aliceDiscRes.status, 200);

  // Status is now disconnected
  const statusAfterDisc = await getVercelService().getStatus(aliceUserId);
  assert.equal(statusAfterDisc.connected, false);
});
