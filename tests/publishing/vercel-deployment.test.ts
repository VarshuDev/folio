import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VercelDeploymentService,
  InMemoryDeploymentRepository,
  InMemoryVercelConnectionRepository,
  resetMockVercelState,
  getVercelApiClient,
  generateDeterministicProjectName,
} from '../../lib/integrations/vercel';
import type { VercelConnection } from '../../lib/integrations/vercel';
import { createEmptyProfile, createDefaultAdvancedConfig } from '../../lib/profile-schema';
import { POST as deployRoute } from '../../app/api/portfolio/advanced/deploy/route';
import { GET as statusRoute } from '../../app/api/portfolio/advanced/deployment/route';
import { setDeploymentRepository } from '../../lib/integrations/vercel/deployment-repository';
import { setVercelConnectionRepository } from '../../lib/integrations/vercel/repository';
import { setVercelDeploymentService } from '../../lib/integrations/vercel/deployment-service';

test('Checkpoint 8J: Deterministic Project Name Generation', () => {
  const name1 = generateDeterministicProjectName({
    creatorName: 'Ada Lovelace',
    userId: 'user-12345678-abcd',
  });

  const name2 = generateDeterministicProjectName({
    creatorName: 'Ada Lovelace',
    userId: 'user-12345678-abcd',
  });

  // Must be deterministic
  assert.equal(name1, name2);
  // Must be lowercase
  assert.equal(name1, name1.toLowerCase());
  // Must be between 3 and 32 chars
  assert.ok(name1.length >= 3 && name1.length <= 32);
  // Alphanumeric + hyphen only
  assert.match(name1, /^[a-z0-9-]+$/);
  // Must not start or end with hyphen
  assert.ok(!name1.startsWith('-') && !name1.endsWith('-'));
  // Different user gets different hash postfix
  const nameDiffUser = generateDeterministicProjectName({
    creatorName: 'Ada Lovelace',
    userId: 'user-87654321-efgh',
  });
  assert.notEqual(name1, nameDiffUser);
});

test('Checkpoint 8J: Deployment Service - Missing Connection Rejection', async () => {
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  const service = new VercelDeploymentService({
    connectionRepo,
    deploymentRepo,
  });

  const profile = createEmptyProfile();
  profile.basics.name = 'Test User';
  const config = createDefaultAdvancedConfig();

  const res = await service.deploy({
    userId: 'user-unconnected',
    profile,
    config,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'missing_connection');
  assert.match(res.error || '', /not connected/i);
});

test('Checkpoint 8J: Deployment Service - Simple Mode Portfolio Rejection', async () => {
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  const service = new VercelDeploymentService({
    connectionRepo,
    deploymentRepo,
  });

  await connectionRepo.saveConnection({
    id: 'conn-1',
    ownerId: 'user-simple-mode',
    configurationId: 'icfg-1',
    accountId: 'usr_mock_1',
    teamId: null,
    scope: 'projects deployments',
    accessToken: 'mock_token_abc',
    tokenType: 'Bearer',
    status: 'connected',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const profile = createEmptyProfile();
  const res = await service.deploy({
    userId: 'user-simple-mode',
    profile,
    config: { mode: 'simple' } as any,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'unsupported_mode');
});

test('Checkpoint 8J: Full Deployment Cycle - Personal Scope & Project Reuse', async () => {
  resetMockVercelState();
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  const service = new VercelDeploymentService({
    connectionRepo,
    deploymentRepo,
  });

  const userId = 'user-owner-100';
  await connectionRepo.saveConnection({
    id: 'conn-100',
    ownerId: userId,
    configurationId: 'icfg-100',
    accountId: 'usr_mock_100',
    teamId: null, // Personal scope
    scope: 'projects deployments',
    accessToken: 'mock_token_user_100',
    tokenType: 'Bearer',
    status: 'connected',
    metadata: { accountName: 'User One Hundred' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const profile = createEmptyProfile();
  profile.basics.name = 'Ada Lovelace';
  profile.basics.role = 'Computing Pioneer';
  const config = createDefaultAdvancedConfig();

  // 1. Initial deployment
  const deploy1 = await service.deploy({
    userId,
    profile,
    config,
  });

  assert.equal(deploy1.ok, true);
  assert.ok(deploy1.deploymentId);
  assert.ok(deploy1.projectId);
  assert.ok(deploy1.deploymentUrl);
  assert.ok(deploy1.productionUrl);

  const initialProjectId = deploy1.projectId;

  // Verify project record was persisted
  const projectRecord = await deploymentRepo.getProject(userId);
  assert.ok(projectRecord);
  assert.equal(projectRecord?.vercelProjectId, initialProjectId);
  assert.equal(projectRecord?.ownerId, userId);

  // 2. Status polling advances mock to ready
  const status1 = await service.getStatus(userId);
  assert.equal(status1.status, 'ready');
  assert.equal(status1.projectId, initialProjectId);
  assert.equal(status1.deploymentId, deploy1.deploymentId);
  assert.ok(status1.productionUrl);

  // 3. Redeployment reuses the existing Vercel project
  const deploy2 = await service.deploy({
    userId,
    profile,
    config,
  });

  assert.equal(deploy2.ok, true);
  // Must reuse same project ID
  assert.equal(deploy2.projectId, initialProjectId);
  // Gets a fresh deployment ID
  assert.notEqual(deploy2.deploymentId, deploy1.deploymentId);
});

test('Checkpoint 8J: Team Scope Scoping Verification', async () => {
  resetMockVercelState();
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  const service = new VercelDeploymentService({
    connectionRepo,
    deploymentRepo,
  });

  const userId = 'user-team-member';
  const teamId = 'team_engineering_dept_123';

  await connectionRepo.saveConnection({
    id: 'conn-team',
    ownerId: userId,
    configurationId: 'icfg-team',
    accountId: 'usr_mock_team',
    teamId, // Explicit team scope
    scope: 'projects deployments',
    accessToken: 'mock_token_team',
    tokenType: 'Bearer',
    status: 'connected',
    metadata: { teamName: 'Engineering Team' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const profile = createEmptyProfile();
  profile.basics.name = 'Grace Hopper';
  const config = createDefaultAdvancedConfig();

  const deploy = await service.deploy({
    userId,
    profile,
    config,
  });

  assert.equal(deploy.ok, true);

  const projectRecord = await deploymentRepo.getProject(userId);
  assert.ok(projectRecord);
  assert.equal(projectRecord?.teamId, teamId);
});

test('Checkpoint 8J: API Route Security - Authentication & Cross-User Isolation', async () => {
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  setVercelConnectionRepository(connectionRepo);
  setDeploymentRepository(deploymentRepo);
  setVercelDeploymentService(null);

  const victimUserId = 'user-victim-1';
  const attackerUserId = 'user-attacker-2';

  // 1. Unauthenticated deploy attempt -> 401
  const unauthReq = new Request('http://localhost:3000/api/portfolio/advanced/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const unauthRes = await deployRoute(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Unauthenticated status attempt -> 401
  const unauthStatusReq = new Request('http://localhost:3000/api/portfolio/advanced/deployment', {
    method: 'GET',
  });
  const unauthStatusRes = await statusRoute(unauthStatusReq);
  assert.equal(unauthStatusRes.status, 401);

  // 3. Forged owner in query param -> 403
  const forgedQueryReq = new Request(
    `http://localhost:3000/api/portfolio/advanced/deploy?ownerId=${victimUserId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer test-${attackerUserId}`,
        'x-folio-test-user-id': attackerUserId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  const forgedQueryRes = await deployRoute(forgedQueryReq);
  assert.equal(forgedQueryRes.status, 403);

  // 4. Forged owner in body -> 403
  const forgedBodyReq = new Request('http://localhost:3000/api/portfolio/advanced/deploy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer test-${attackerUserId}`,
      'x-folio-test-user-id': attackerUserId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ownerId: victimUserId,
    }),
  });
  const forgedBodyRes = await deployRoute(forgedBodyReq);
  assert.equal(forgedBodyRes.status, 403);

  // 5. Cross-user status check in query param -> 403
  const forgedStatusReq = new Request(
    `http://localhost:3000/api/portfolio/advanced/deployment?ownerId=${victimUserId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer test-${attackerUserId}`,
        'x-folio-test-user-id': attackerUserId,
      },
    }
  );
  const forgedStatusRes = await statusRoute(forgedStatusReq);
  assert.equal(forgedStatusRes.status, 403);
});

test('Checkpoint 8J: Zero Token Leakage Guarantee', async () => {
  const connectionRepo = new InMemoryVercelConnectionRepository();
  const deploymentRepo = new InMemoryDeploymentRepository();
  setVercelConnectionRepository(connectionRepo);
  setDeploymentRepository(deploymentRepo);
  setVercelDeploymentService(null);

  const userId = 'user-token-secret-test';
  const superSecretToken = 'sec_super_secret_vercel_access_token_never_leak_this';

  await connectionRepo.saveConnection({
    id: 'conn-sec',
    ownerId: userId,
    configurationId: 'icfg-sec',
    accountId: 'usr_mock_sec',
    teamId: null,
    scope: 'projects deployments',
    accessToken: superSecretToken,
    tokenType: 'Bearer',
    status: 'connected',
    metadata: { accountName: 'Secret Keeper' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const profile = createEmptyProfile();
  profile.basics.name = 'Token Security Test';
  const config = createDefaultAdvancedConfig();

  // Test POST /api/portfolio/advanced/deploy response
  const deployReq = new Request('http://localhost:3000/api/portfolio/advanced/deploy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile,
      config,
    }),
  });

  const deployRes = await deployRoute(deployReq);
  assert.equal(deployRes.status, 200);
  const deployJsonText = await deployRes.text();

  assert.ok(!deployJsonText.includes(superSecretToken));
  assert.ok(!deployJsonText.includes('sec_super_secret'));
  assert.ok(!deployJsonText.includes('accessToken'));

  // Test GET /api/portfolio/advanced/deployment response
  const statusReq = new Request('http://localhost:3000/api/portfolio/advanced/deployment', {
    method: 'GET',
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
  });

  const statusRes = await statusRoute(statusReq);
  assert.equal(statusRes.status, 200);
  const statusJsonText = await statusRes.text();

  assert.ok(!statusJsonText.includes(superSecretToken));
  assert.ok(!statusJsonText.includes('sec_super_secret'));
  assert.ok(!statusJsonText.includes('accessToken'));
});
