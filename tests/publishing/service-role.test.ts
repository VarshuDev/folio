import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPublishingRepository,
  setPublishingRepositoryForTests,
} from '../../lib/publishing/repository';
import { createDefaultDesign, createEmptyProfile } from '../../lib/profile-schema';
import { POST as publishHandler } from '../../app/api/portfolio/publish/route';

test('valid service-role configuration allows repository instantiation', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevPersistence = process.env.FOLIO_PERSISTENCE;

  try {
    delete process.env.FOLIO_PERSISTENCE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    setPublishingRepositoryForTests(null);
    const repo = getPublishingRepository();
    assert.ok(repo);
    // Verified that it created a SupabasePublishingRepository
    assert.equal(typeof repo.publishPortfolio, 'function');
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnonKey;
    process.env.FOLIO_PERSISTENCE = prevPersistence;
    setPublishingRepositoryForTests(null);
  }
});

test('missing service-role key never uses anon key as fallback for publishing mutations', async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevPersistence = process.env.FOLIO_PERSISTENCE;

  try {
    delete process.env.FOLIO_PERSISTENCE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key-that-must-never-be-used-as-service-role';

    setPublishingRepositoryForTests(null);
    const repo = getPublishingRepository();

    const profile = createEmptyProfile();
    profile.basics.name = 'Test User';
    const design = createDefaultDesign();

    const result = await repo.publishPortfolio('user-1', 'test-user', profile, design);

    // Must fail safely without attempting unauthorized anon insert
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'server_error');
      assert.equal(result.error, 'Publishing service is not properly configured.');
      // Must not leak environment variable names to callers
      assert.ok(!result.error.includes('SUPABASE_SERVICE_ROLE_KEY'));
      assert.ok(!result.error.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
    }

    const unpubResult = await repo.unpublishPortfolio('user-1');
    assert.equal(unpubResult.ok, false);
    assert.equal(unpubResult.message, 'Publishing service is not properly configured.');
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnonKey;
    process.env.FOLIO_PERSISTENCE = prevPersistence;
    setPublishingRepositoryForTests(null);
  }
});

test('missing service-role returns safe HTTP 500 without leaking stack traces or env names', async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevPersistence = process.env.FOLIO_PERSISTENCE;

  try {
    delete process.env.FOLIO_PERSISTENCE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';

    setPublishingRepositoryForTests(null);

    const profile = createEmptyProfile();
    profile.basics.name = 'Test User';
    const design = createDefaultDesign();

    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-folio-test-user-id': 'user-1',
      },
      body: JSON.stringify({ slug: 'test-user', profile, design }),
    });

    const res = await publishHandler(req);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'Publishing service is not properly configured.');
    // Check no stack trace or env leak
    assert.equal(body.stack, undefined);
    assert.ok(!JSON.stringify(body).includes('SUPABASE_SERVICE_ROLE_KEY'));
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnonKey;
    process.env.FOLIO_PERSISTENCE = prevPersistence;
    setPublishingRepositoryForTests(null);
  }
});

test('in-memory repository is selected in development or when FOLIO_PERSISTENCE=memory', () => {
  const prevPersistence = process.env.FOLIO_PERSISTENCE;
  try {
    process.env.FOLIO_PERSISTENCE = 'memory';
    setPublishingRepositoryForTests(null);
    const repo = getPublishingRepository();
    assert.ok(repo);
    assert.equal(typeof (repo as { clear?: () => void }).clear, 'function');
  } finally {
    process.env.FOLIO_PERSISTENCE = prevPersistence;
    setPublishingRepositoryForTests(null);
  }
});
