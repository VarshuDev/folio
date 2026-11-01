import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getInMemoryStoreForTests,
  setPublishingRepositoryForTests,
} from '../../lib/publishing/repository';
import {
  computeHasUnpublishedChanges,
} from '../../lib/publishing/status';
import { createDefaultDesign, createEmptyProfile } from '../../lib/profile-schema';
import { POST as statusPostHandler } from '../../app/api/portfolio/status/route';
import { POST as publishHandler } from '../../app/api/portfolio/publish/route';
import { POST as unpublishHandler } from '../../app/api/portfolio/unpublish/route';

const repository = getInMemoryStoreForTests();

beforeEach(() => {
  setPublishingRepositoryForTests(null);
  repository.clear();
});

function createSampleProfile(name = 'Alex Chen') {
  const profile = createEmptyProfile();
  profile.basics.name = name;
  profile.basics.role = 'Product Designer';
  profile.basics.about = 'Designing clear web interfaces.';
  profile.basics.originalNotes = 'Secret draft notes.';
  profile.skills = ['Figma', 'CSS'];
  profile.projects = [
    { id: 'p1', title: 'Design System', description: 'Tokens & components', tools: 'Figma', link: 'https://ds.example.com' },
  ];
  return profile;
}

test('computeHasUnpublishedChanges unit tests', () => {
  const profile1 = createSampleProfile('Alex');
  const design1 = createDefaultDesign();

  // 1. Identical draft and published
  assert.equal(computeHasUnpublishedChanges(profile1, design1, profile1, design1), false);

  // 2. Profile changed (e.g. role)
  const profileChanged = structuredClone(profile1);
  profileChanged.basics.role = 'Lead Product Designer';
  assert.equal(computeHasUnpublishedChanges(profileChanged, design1, profile1, design1), true);

  // 3. Design changed (e.g. templateId)
  const designChanged = structuredClone(design1);
  designChanged.templateId = 'editorial';
  assert.equal(computeHasUnpublishedChanges(profile1, designChanged, profile1, design1), true);

  // 4. Both changed
  assert.equal(computeHasUnpublishedChanges(profileChanged, designChanged, profile1, design1), true);

  // 5. Invariant: Editing originalNotes only does NOT trigger unpublished changes
  const notesChanged = structuredClone(profile1);
  notesChanged.basics.originalNotes = 'Brand new private thought that is never public';
  assert.equal(computeHasUnpublishedChanges(notesChanged, design1, profile1, design1), false);

  // 6. Invariant: Insignificant whitespace trimming does NOT trigger false positive
  const whitespaceChanged = structuredClone(profile1);
  whitespaceChanged.basics.name = '  Alex  ';
  assert.equal(computeHasUnpublishedChanges(whitespaceChanged, design1, profile1, design1), false);
});

test('Case 1: No publication -> isPublished: false, hasUnpublishedChanges: false', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile, design }),
  });

  const res = await statusPostHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.isPublished, false);
  assert.equal(data.hasUnpublishedChanges, false);
});

test('Case 2: Published and draft identical -> isPublished: true, hasUnpublishedChanges: false', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  // Publish
  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex', profile, design }),
    }),
  );

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile, design }),
  });

  const res = await statusPostHandler(req);
  const data = await res.json();
  assert.equal(data.isPublished, true);
  assert.equal(data.hasUnpublishedChanges, false);
});

test('Case 3: Published but profile changed -> isPublished: true, hasUnpublishedChanges: true', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex', profile, design }),
    }),
  );

  const modifiedProfile = structuredClone(profile);
  modifiedProfile.basics.about = 'Updated bio for Alex.';

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile: modifiedProfile, design }),
  });

  const res = await statusPostHandler(req);
  const data = await res.json();
  assert.equal(data.isPublished, true);
  assert.equal(data.hasUnpublishedChanges, true);
});

test('Case 4: Published but design changed -> isPublished: true, hasUnpublishedChanges: true', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex', profile, design }),
    }),
  );

  const modifiedDesign = structuredClone(design);
  modifiedDesign.templateId = 'bauhaus';

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile, design: modifiedDesign }),
  });

  const res = await statusPostHandler(req);
  const data = await res.json();
  assert.equal(data.isPublished, true);
  assert.equal(data.hasUnpublishedChanges, true);
});

test('Case 5: Published but both changed -> isPublished: true, hasUnpublishedChanges: true', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex', profile, design }),
    }),
  );

  const modifiedProfile = structuredClone(profile);
  modifiedProfile.skills.push('TypeScript');
  const modifiedDesign = structuredClone(design);
  modifiedDesign.templateId = 'zine';

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile: modifiedProfile, design: modifiedDesign }),
  });

  const res = await statusPostHandler(req);
  const data = await res.json();
  assert.equal(data.isPublished, true);
  assert.equal(data.hasUnpublishedChanges, true);
});

test('Case 6: Unpublished after previously being published -> isPublished: false, hasUnpublishedChanges: false', async () => {
  const profile = createSampleProfile('Alex');
  const design = createDefaultDesign();

  // 1. Publish
  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex', profile, design }),
    }),
  );

  // 2. Unpublish
  await unpublishHandler(
    new Request('http://localhost:3000/api/portfolio/unpublish', {
      method: 'POST',
      headers: {
        'x-folio-test-user-id': 'user-1',
      },
    }),
  );

  // 3. Status check with any edits
  const modifiedProfile = structuredClone(profile);
  modifiedProfile.basics.name = 'Alexander';

  const req = new Request('http://localhost:3000/api/portfolio/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': 'user-1',
    },
    body: JSON.stringify({ profile: modifiedProfile, design }),
  });

  const res = await statusPostHandler(req);
  const data = await res.json();
  assert.equal(data.isPublished, false);
  assert.equal(data.hasUnpublishedChanges, false);
});
