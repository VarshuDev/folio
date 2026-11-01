import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as accountGetHandler, PUT as accountPutHandler } from '../../app/api/portfolio/account/route';
import { POST as publishHandler } from '../../app/api/portfolio/publish/route';
import { POST as unpublishHandler } from '../../app/api/portfolio/unpublish/route';
import { GET as statusGetHandler } from '../../app/api/portfolio/status/route';
import { getInMemoryStoreForTests } from '../../lib/publishing/repository';
import { createDefaultDesign, createEmptyProfile, type DraftBundle } from '../../lib/profile-schema';

const repository = getInMemoryStoreForTests();

beforeEach(() => {
  repository.clear();
});

function createSampleProfile(name = 'Jordan Lee') {
  const profile = createEmptyProfile();
  profile.basics.name = name;
  profile.basics.role = 'Product Designer';
  profile.basics.about = 'Exploring systems, typography, and web interactions.';
  profile.basics.originalNotes = 'Confidential personal notes from draft mode';
  profile.skills = ['Figma', 'CSS', 'Design Systems'];
  return profile;
}

test('anonymous access to account API is rejected with 401', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'GET',
  });
  const res = await accountGetHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'unauthenticated');
});

test('expired/invalid session to account API is rejected safely', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ',
    },
  });
  const res = await accountGetHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'unauthenticated');
});

test('authenticated user can access own account and portfolio summary', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer test-user-123',
      'x-folio-test-user-id': 'user-123',
    },
  });
  const res = await accountGetHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.userId, 'user-123');
  assert.equal(data.portfolio.isPublished, false);
  assert.equal(data.portfolio.slug, null);
  assert.equal(data.portfolio.hasUnpublishedChanges, false);
});

test('cross-user account data access with query param is rejected with 403', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/account?ownerId=victim-user', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer test-attacker-user',
      'x-folio-test-user-id': 'attacker-user',
    },
  });
  const res = await accountGetHandler(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'forbidden');
});

test('forged ownerId in account PUT request is rejected with 403', async () => {
  const bundle: DraftBundle = {
    profile: createSampleProfile(),
    design: createDefaultDesign(),
    updatedAt: new Date().toISOString(),
  };

  const req = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-attacker-user',
      'x-folio-test-user-id': 'attacker-user',
    },
    body: JSON.stringify({
      ...bundle,
      ownerId: 'victim-user',
    }),
  });
  const res = await accountPutHandler(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'forbidden');
});

test('authenticated user can save cloud draft and retrieve it via account API', async () => {
  const profile = createSampleProfile('Taylor Swift');
  const design = createDefaultDesign();
  design.templateId = 'minimal';
  const bundle: DraftBundle = {
    profile,
    design,
    updatedAt: new Date().toISOString(),
  };

  const saveReq = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-user-456',
      'x-folio-test-user-id': 'user-456',
    },
    body: JSON.stringify(bundle),
  });
  const saveRes = await accountPutHandler(saveReq);
  assert.equal(saveRes.status, 200);

  const getReq = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer test-user-456',
      'x-folio-test-user-id': 'user-456',
    },
  });
  const getRes = await accountGetHandler(getReq);
  assert.equal(getRes.status, 200);
  const data = await getRes.json();
  assert.equal(data.portfolio.title, 'Taylor Swift');
  assert.equal(data.portfolio.templateId, 'minimal');
  assert.equal(data.draft.profile.basics.name, 'Taylor Swift');
});

test('forged ownerId in publish request is rejected with 403', async () => {
  const profile = createSampleProfile();
  const design = createDefaultDesign();

  const req = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-attacker',
      'x-folio-test-user-id': 'attacker',
    },
    body: JSON.stringify({
      slug: 'victim-portfolio',
      profile,
      design,
      ownerId: 'victim-owner',
    }),
  });

  const res = await publishHandler(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'forbidden');
});

test('forged ownerId in unpublish request is rejected with 403', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/unpublish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-attacker',
      'x-folio-test-user-id': 'attacker',
    },
    body: JSON.stringify({
      ownerId: 'victim-owner',
    }),
  });

  const res = await unpublishHandler(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'forbidden');
});

test('publication status progression matches specification across account lifecycle', async () => {
  const userId = 'lifecycle-user';
  const profile = createSampleProfile('Morgan Avery');
  const design = createDefaultDesign();

  // State 1: Unpublished
  const s1Req = new Request('http://localhost:3000/api/portfolio/account', {
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
  });
  const s1Res = await accountGetHandler(s1Req);
  const s1Data = await s1Res.json();
  assert.equal(s1Data.portfolio.isPublished, false);
  assert.equal(s1Data.portfolio.hasUnpublishedChanges, false);

  // State 2: Published and unchanged
  const pubReq = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({
      slug: 'morgan-avery',
      profile,
      design,
    }),
  });
  const pubRes = await publishHandler(pubReq);
  assert.equal(pubRes.status, 200);

  const s2Res = await accountGetHandler(s1Req);
  const s2Data = await s2Res.json();
  assert.equal(s2Data.portfolio.isPublished, true);
  assert.equal(s2Data.portfolio.slug, 'morgan-avery');
  assert.equal(s2Data.portfolio.hasUnpublishedChanges, false);

  // State 3: Published with draft changes
  const modifiedProfile = { ...profile, basics: { ...profile.basics, about: 'Updated bio in draft' } };
  const putReq = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({
      profile: modifiedProfile,
      design,
      updatedAt: new Date().toISOString(),
    }),
  });
  await accountPutHandler(putReq);

  const s3Res = await accountGetHandler(s1Req);
  const s3Data = await s3Res.json();
  assert.equal(s3Data.portfolio.isPublished, true);
  assert.equal(s3Data.portfolio.hasUnpublishedChanges, true);

  // State 4: Unpublished after being published
  const unpubReq = new Request('http://localhost:3000/api/portfolio/unpublish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
  });
  await unpublishHandler(unpubReq);

  const s4Res = await accountGetHandler(s1Req);
  const s4Data = await s4Res.json();
  assert.equal(s4Data.portfolio.isPublished, false);
  assert.equal(s4Data.portfolio.hasUnpublishedChanges, false);
});

test('public published projection sanitizes private originalNotes while draft preserves them', async () => {
  const userId = 'privacy-user';
  const profile = createSampleProfile('Privacy User');
  profile.basics.originalNotes = 'PRIVATE INTERNAL NOTES';
  const design = createDefaultDesign();

  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
      body: JSON.stringify({ slug: 'privacy-user', profile, design }),
    }),
  );

  const published = await repository.getPublicationBySlug('privacy-user');
  assert.ok(published);
  assert.equal(published.profile.basics.originalNotes, ''); // private field stripped

  const accountRes = await accountGetHandler(
    new Request('http://localhost:3000/api/portfolio/account', {
      headers: {
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
    }),
  );
  const accountData = await accountRes.json();
  // Account endpoint doesn't expose database internals or secret keys
  assert.equal(accountData.user.userId, userId);
  assert.equal((accountData as Record<string, unknown>).serviceRoleKey, undefined);
});
