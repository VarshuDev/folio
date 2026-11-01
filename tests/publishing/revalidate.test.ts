import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerRevalidationCallbackForTests,
  revalidatePortfolioPath,
} from '../../lib/publishing/revalidate';
import {
  getInMemoryStoreForTests,
  setPublishingRepositoryForTests,
} from '../../lib/publishing/repository';
import { createDefaultDesign, createEmptyProfile } from '../../lib/profile-schema';
import { POST as publishHandler } from '../../app/api/portfolio/publish/route';
import { POST as unpublishHandler } from '../../app/api/portfolio/unpublish/route';
import PublicPortfolioPage, { generateMetadata } from '../../app/p/[slug]/page';

const repository = getInMemoryStoreForTests();

beforeEach(() => {
  setPublishingRepositoryForTests(null);
  repository.clear();
});

test('revalidatePortfolioPath normalizes slug and invokes listeners', async () => {
  const revalidated: string[] = [];
  const cleanup = registerRevalidationCallbackForTests((slug) => {
    revalidated.push(slug);
  });

  try {
    const res = await revalidatePortfolioPath('  Alex-Chen  ');
    assert.equal(res.ok, true);
    assert.equal(res.slug, 'alex-chen');
    assert.deepEqual(revalidated, ['alex-chen']);
  } finally {
    cleanup();
  }
});

test('publishing a portfolio triggers cache invalidation for the published slug', async () => {
  const revalidated: string[] = [];
  const cleanup = registerRevalidationCallbackForTests((slug) => {
    revalidated.push(slug);
  });

  try {
    const profile = createEmptyProfile();
    profile.basics.name = 'Alex Chen';
    const design = createDefaultDesign();

    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex-chen', profile, design }),
    });

    const res = await publishHandler(req);
    assert.equal(res.status, 200);

    assert.ok(revalidated.includes('alex-chen'), 'Expected alex-chen to be revalidated upon publish');
  } finally {
    cleanup();
  }
});

test('republishing a modified portfolio triggers cache invalidation', async () => {
  const revalidated: string[] = [];
  const cleanup = registerRevalidationCallbackForTests((slug) => {
    revalidated.push(slug);
  });

  try {
    const profile = createEmptyProfile();
    profile.basics.name = 'Alex Chen';
    const design = createDefaultDesign();

    // 1. Initial publish
    await publishHandler(
      new Request('http://localhost:3000/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-test-user-id': 'user-1',
        },
        body: JSON.stringify({ slug: 'alex-chen', profile, design }),
      }),
    );

    revalidated.length = 0; // reset

    // 2. Republish with changes
    profile.basics.role = 'Staff Engineer';
    const res2 = await publishHandler(
      new Request('http://localhost:3000/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-test-user-id': 'user-1',
        },
        body: JSON.stringify({ slug: 'alex-chen', profile, design }),
      }),
    );
    assert.equal(res2.status, 200);

    assert.ok(revalidated.includes('alex-chen'), 'Expected alex-chen to be revalidated on republish');
  } finally {
    cleanup();
  }
});

test('changing slug during publish invalidates both new slug and previous slug', async () => {
  const revalidated: string[] = [];
  const cleanup = registerRevalidationCallbackForTests((slug) => {
    revalidated.push(slug);
  });

  try {
    const profile = createEmptyProfile();
    profile.basics.name = 'Alex Chen';
    const design = createDefaultDesign();

    // Initial publish at old-slug
    await publishHandler(
      new Request('http://localhost:3000/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-test-user-id': 'user-1',
        },
        body: JSON.stringify({ slug: 'old-slug', profile, design }),
      }),
    );

    revalidated.length = 0; // reset

    // Republish with new-slug
    const res2 = await publishHandler(
      new Request('http://localhost:3000/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-test-user-id': 'user-1',
        },
        body: JSON.stringify({ slug: 'new-slug', profile, design }),
      }),
    );
    assert.equal(res2.status, 200);

    assert.ok(revalidated.includes('new-slug'), 'Expected new-slug to be invalidated');
    assert.ok(revalidated.includes('old-slug'), 'Expected old-slug to be invalidated');
  } finally {
    cleanup();
  }
});

test('unpublishing invalidates the affected public route and public page returns 404', async () => {
  const revalidated: string[] = [];
  const cleanup = registerRevalidationCallbackForTests((slug) => {
    revalidated.push(slug);
  });

  try {
    const profile = createEmptyProfile();
    profile.basics.name = 'Alex Chen';
    const design = createDefaultDesign();

    // 1. Publish
    await publishHandler(
      new Request('http://localhost:3000/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-folio-test-user-id': 'user-1',
        },
        body: JSON.stringify({ slug: 'alex-chen', profile, design }),
      }),
    );

    revalidated.length = 0;

    // 2. Unpublish
    const unpubRes = await unpublishHandler(
      new Request('http://localhost:3000/api/portfolio/unpublish', {
        method: 'POST',
        headers: {
          'x-folio-test-user-id': 'user-1',
        },
      }),
    );
    assert.equal(unpubRes.status, 200);

    assert.ok(revalidated.includes('alex-chen'), 'Expected alex-chen to be revalidated upon unpublish');

    // 3. Verify public page throws notFound
    await assert.rejects(
      async () => {
        await PublicPortfolioPage({ params: Promise.resolve({ slug: 'alex-chen' }) });
      },
      (err: Error) => {
        return err.message.includes('NEXT_HTTP_ERROR_FALLBACK;404') || err.message.includes('NEXT_NOT_FOUND');
      },
    );
  } finally {
    cleanup();
  }
});

test('public metadata never leaks private draft originalNotes', async () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';
  profile.basics.about = 'Public bio statement.';
  profile.basics.originalNotes = 'Secret private notes from interview!';
  const design = createDefaultDesign();

  await publishHandler(
    new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'alex-chen', profile, design }),
    }),
  );

  const meta = await generateMetadata({ params: Promise.resolve({ slug: 'alex-chen' }) });
  assert.equal(meta.title, 'Alex Chen — folio');
  assert.ok(meta.description?.includes('Public bio statement'));
  assert.ok(!meta.description?.includes('Secret private notes'));
  assert.ok(!JSON.stringify(meta).includes('Secret private notes'));
});
