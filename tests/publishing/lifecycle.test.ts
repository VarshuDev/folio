import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST as publishHandler } from '../../app/api/portfolio/publish/route';
import { POST as unpublishHandler } from '../../app/api/portfolio/unpublish/route';
import { GET as statusGetHandler, POST as statusPostHandler } from '../../app/api/portfolio/status/route';
import { getInMemoryStoreForTests, getPublishingRepository } from '../../lib/publishing/repository';
import { createDefaultDesign, createEmptyProfile } from '../../lib/profile-schema';

const repository = getInMemoryStoreForTests();

beforeEach(() => {
  repository.clear();
});

function createSampleProfile(name = 'Alex Chen') {
  const profile = createEmptyProfile();
  profile.basics.name = name;
  profile.basics.role = 'Frontend Engineer';
  profile.basics.about = 'Building accessible, delightful web software.';
  profile.basics.originalNotes = 'Secret draft notes from intake!';
  profile.skills = ['TypeScript', 'React', 'Next.js'];
  profile.projects = [
    {
      id: 'proj-1',
      title: 'Folio Builder',
      description: 'Zero-config portfolio studio.',
      tools: 'Next.js, TypeScript',
      link: 'https://folio.dev',
    },
  ];
  return profile;
}

test('unauthenticated publish requests are rejected with 401', async () => {
  const profile = createSampleProfile();
  const design = createDefaultDesign();

  const req = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'alex-chen', profile, design }),
  });

  const res = await publishHandler(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'unauthenticated');
});

test('unauthenticated unpublish requests are rejected with 401', async () => {
  const req = new Request('http://localhost:3000/api/portfolio/unpublish', {
    method: 'POST',
  });

  const res = await unpublishHandler(req);
  assert.equal(res.status, 401);
});

test('authenticated owner publishes snapshot successfully', async () => {
  const profile = createSampleProfile();
  const design = createDefaultDesign();

  const req = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-123',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile, design }),
  });

  const res = await publishHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.ok, true);
  assert.equal(data.slug, 'alex-chen');
  assert.equal(data.url, '/p/alex-chen');
  assert.equal(data.version, 1);
  assert.ok(data.publishedAt);

  // Snapshot is accessible via repository
  const snapshot = await repository.getPublicationBySlug('alex-chen');
  assert.ok(snapshot);
  assert.equal(snapshot.ownerId, 'user-123');
  assert.equal(snapshot.profile.basics.name, 'Alex Chen');
  // Confirm private originalNotes was scrubbed from public snapshot
  assert.equal(snapshot.profile.basics.originalNotes, '');
});

test('slug conflict: another user cannot claim already published slug', async () => {
  const profile1 = createSampleProfile('Alex Chen');
  const design = createDefaultDesign();

  // User 1 publishes 'alex-chen'
  const req1 = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile: profile1, design }),
  });
  const res1 = await publishHandler(req1);
  assert.equal(res1.status, 200);

  // User 2 attempts to publish to 'alex-chen'
  const profile2 = createSampleProfile('Alexander Chen');
  const req2 = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-2',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile: profile2, design }),
  });
  const res2 = await publishHandler(req2);
  assert.equal(res2.status, 409);
  const data2 = await res2.json();
  assert.equal(data2.ok, false);
  assert.equal(data2.code, 'slug_taken');
});

test('owner can republish and increment snapshot version', async () => {
  const profile = createSampleProfile('Alex Chen');
  const design = createDefaultDesign();

  // Publish v1
  const req1 = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'owner-1',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile, design }),
  });
  const res1 = await publishHandler(req1);
  const data1 = await res1.json();
  assert.equal(data1.version, 1);

  // Update profile
  profile.basics.role = 'Senior Frontend Engineer';

  // Publish v2
  const req2 = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'owner-1',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile, design }),
  });
  const res2 = await publishHandler(req2);
  const data2 = await res2.json();
  assert.equal(data2.ok, true);
  assert.equal(data2.version, 2);

  const snapshot = await repository.getPublicationBySlug('alex-chen');
  assert.equal(snapshot?.profile.basics.role, 'Senior Frontend Engineer');
});

test('draft isolation: modifying local draft does not alter published snapshot until republish', async () => {
  const profile = createSampleProfile('Alex Chen');
  const design = createDefaultDesign();

  // Publish v1
  const req = new Request('http://localhost:3000/api/portfolio/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'owner-1',
    },
    body: JSON.stringify({ slug: 'alex-chen', profile, design }),
  });
  await publishHandler(req);

  // User edits local draft in Studio
  const modifiedDraft = structuredClone(profile);
  modifiedDraft.basics.name = 'Alexander The Great';
  modifiedDraft.basics.role = 'AI Architect';

  // Published snapshot remains strictly unchanged!
  const liveSnapshot = await repository.getPublicationBySlug('alex-chen');
  assert.equal(liveSnapshot?.profile.basics.name, 'Alex Chen');
  assert.equal(liveSnapshot?.profile.basics.role, 'Frontend Engineer');
});

test('publication status reports unpublished changes accurately', async () => {
  const profile = createSampleProfile('Alex Chen');
  const design = createDefaultDesign();

  // Initially unpublished
  const statusReq1 = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'owner-1',
    },
    body: JSON.stringify({ profile, design }),
  });
  const statusRes1 = await statusPostHandler(statusReq1);
  const status1 = await statusRes1.json();
  assert.equal(status1.isPublished, false);
  assert.equal(status1.hasUnpublishedChanges, false);

  // Publish
  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'owner-1',
      },
      body: JSON.stringify({ slug: 'alex-chen', profile, design }),
    }),
  );

  // Status now published, no unpublished changes
  const statusRes2 = await statusPostHandler(
    new Request('http://localhost:3000/api/portfolio/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'owner-1',
      },
      body: JSON.stringify({ profile, design }),
    }),
  );
  const status2 = await statusRes2.json();
  assert.equal(status2.isPublished, true);
  assert.equal(status2.hasUnpublishedChanges, false);

  // Draft edited with new role
  const modifiedProfile = structuredClone(profile);
  modifiedProfile.basics.role = 'Staff Engineer';

  // Status should now report unpublished changes!
  const statusRes3 = await statusPostHandler(
    new Request('http://localhost:3000/api/portfolio/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'owner-1',
      },
      body: JSON.stringify({ profile: modifiedProfile, design }),
    }),
  );
  const status3 = await statusRes3.json();
  assert.equal(status3.isPublished, true);
  assert.equal(status3.hasUnpublishedChanges, true);
});

test('owner can unpublish, making portfolio 404', async () => {
  const profile = createSampleProfile('Alex Chen');
  const design = createDefaultDesign();

  // Publish
  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'owner-1',
      },
      body: JSON.stringify({ slug: 'alex-chen', profile, design }),
    }),
  );

  // Verify published
  const snapshotBefore = await repository.getPublicationBySlug('alex-chen');
  assert.ok(snapshotBefore);

  // Unpublish
  const unpubRes = await unpublishHandler(
    new Request('http://localhost:3000/api/portfolio/unpublish', {
      method: 'POST',
      headers: {
        'x-folio-test-user-id': 'owner-1',
      },
    }),
  );
  assert.equal(unpubRes.status, 200);

  // Reading by slug returns null
  const snapshotAfter = await repository.getPublicationBySlug('alex-chen');
  assert.equal(snapshotAfter, null);

  // Status reflects unpublished
  const statusRes = await statusGetHandler(
    new Request('http://localhost:3000/api/portfolio/status', {
      headers: { 'x-folio-test-user-id': 'owner-1' },
    }),
  );
  const statusData = await statusRes.json();
  assert.equal(statusData.isPublished, false);
});
