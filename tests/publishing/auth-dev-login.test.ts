import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as handleDevLogin } from '@/app/api/auth/dev-login/route';
import { authenticateServerRequest } from '@/lib/publishing/auth';

const mutableEnv = process.env as Record<string, string | undefined>;

test('Security Audit: /api/auth/dev-login - Production request prohibition', async () => {
  const originalNodeEnv = mutableEnv.NODE_ENV || 'test';
  const originalVercelEnv = mutableEnv.VERCEL_ENV;
  const originalPublicVercelEnv = mutableEnv.NEXT_PUBLIC_VERCEL_ENV;

  try {
    // 1. Strict NODE_ENV=production blocks dev login
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.VERCEL_ENV;
    delete mutableEnv.NEXT_PUBLIC_VERCEL_ENV;

    const res = await handleDevLogin();
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'forbidden');
    assert.match(data.error, /disabled in production/i);
    assert.equal(res.headers.get('Cache-Control'), 'no-store, max-age=0');
  } finally {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv !== undefined) mutableEnv.VERCEL_ENV = originalVercelEnv;
    else delete mutableEnv.VERCEL_ENV;
    if (originalPublicVercelEnv !== undefined) mutableEnv.NEXT_PUBLIC_VERCEL_ENV = originalPublicVercelEnv;
    else delete mutableEnv.NEXT_PUBLIC_VERCEL_ENV;
  }
});

test('Security Audit: /api/auth/dev-login - Fail-closed on misconfigured or missing environment', async () => {
  const originalNodeEnv = mutableEnv.NODE_ENV || 'test';
  const originalVercelEnv = mutableEnv.VERCEL_ENV;
  const originalPublicVercelEnv = mutableEnv.NEXT_PUBLIC_VERCEL_ENV;

  try {
    // Case A: Missing / undefined NODE_ENV
    delete mutableEnv.NODE_ENV;
    delete mutableEnv.VERCEL_ENV;
    const resA = await handleDevLogin();
    assert.equal(resA.status, 403, 'Must fail-closed when NODE_ENV is unset');
    const dataA = await resA.json();
    assert.equal(dataA.code, 'forbidden');

    // Case B: Misconfigured NODE_ENV = 'staging' or 'prod'
    mutableEnv.NODE_ENV = 'staging';
    const resB = await handleDevLogin();
    assert.equal(resB.status, 403, 'Must fail-closed when NODE_ENV is staging');

    mutableEnv.NODE_ENV = 'prod';
    const resC = await handleDevLogin();
    assert.equal(resC.status, 403, 'Must fail-closed when NODE_ENV is prod');

    // Case C: VERCEL_ENV = 'production' even if NODE_ENV is development
    mutableEnv.NODE_ENV = 'development';
    mutableEnv.VERCEL_ENV = 'production';
    const resD = await handleDevLogin();
    assert.equal(resD.status, 403, 'Must fail-closed when VERCEL_ENV is production');

    // Case D: NEXT_PUBLIC_VERCEL_ENV = 'production'
    mutableEnv.NODE_ENV = 'development';
    delete mutableEnv.VERCEL_ENV;
    mutableEnv.NEXT_PUBLIC_VERCEL_ENV = 'production';
    const resE = await handleDevLogin();
    assert.equal(resE.status, 403, 'Must fail-closed when NEXT_PUBLIC_VERCEL_ENV is production');
  } finally {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv !== undefined) mutableEnv.VERCEL_ENV = originalVercelEnv;
    else delete mutableEnv.VERCEL_ENV;
    if (originalPublicVercelEnv !== undefined) mutableEnv.NEXT_PUBLIC_VERCEL_ENV = originalPublicVercelEnv;
    else delete mutableEnv.NEXT_PUBLIC_VERCEL_ENV;
  }
});

test('Security Audit: Test-only headers strictly rejected in production (fail-closed)', async () => {
  const originalNodeEnv = mutableEnv.NODE_ENV || 'test';
  const originalVercelEnv = mutableEnv.VERCEL_ENV;
  const originalPublicVercelEnv = mutableEnv.NEXT_PUBLIC_VERCEL_ENV;

  try {
    // 1. In production (NODE_ENV=production), x-folio-test-user-id header is strictly rejected
    mutableEnv.NODE_ENV = 'production';
    delete mutableEnv.VERCEL_ENV;
    delete mutableEnv.NEXT_PUBLIC_VERCEL_ENV;

    const req1 = new Request('http://localhost:3000/api/portfolio/status', {
      headers: { 'x-folio-test-user-id': 'attacker-impersonated-user' },
    });
    const auth1 = await authenticateServerRequest(req1);
    assert.equal(auth1.ok, false, 'x-folio-test-user-id must be rejected in production');

    // 2. In production, Bearer test-<id> token is completely rejected
    const req2 = new Request('http://localhost:3000/api/portfolio/status', {
      headers: { Authorization: 'Bearer test-attacker-user' },
    });
    const auth2 = await authenticateServerRequest(req2);
    assert.equal(auth2.ok, false, 'Bearer test-* must be rejected in production');

    // 3. VERCEL_ENV=production strictly rejects test headers
    mutableEnv.NODE_ENV = 'development';
    mutableEnv.VERCEL_ENV = 'production';
    const req3 = new Request('http://localhost:3000/api/portfolio/status', {
      headers: { 'x-folio-test-user-id': 'attacker-user' },
    });
    const auth3 = await authenticateServerRequest(req3);
    assert.equal(auth3.ok, false, 'x-folio-test-user-id must be rejected when VERCEL_ENV is production');

    // 4. NEXT_PUBLIC_VERCEL_ENV=production strictly rejects test headers
    delete mutableEnv.VERCEL_ENV;
    mutableEnv.NEXT_PUBLIC_VERCEL_ENV = 'production';
    const req4 = new Request('http://localhost:3000/api/portfolio/status', {
      headers: { 'x-folio-test-user-id': 'attacker-user' },
    });
    const auth4 = await authenticateServerRequest(req4);
    assert.equal(auth4.ok, false, 'x-folio-test-user-id must be rejected when NEXT_PUBLIC_VERCEL_ENV is production');
  } finally {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalVercelEnv !== undefined) mutableEnv.VERCEL_ENV = originalVercelEnv;
    else delete mutableEnv.VERCEL_ENV;
    if (originalPublicVercelEnv !== undefined) mutableEnv.NEXT_PUBLIC_VERCEL_ENV = originalPublicVercelEnv;
    else delete mutableEnv.NEXT_PUBLIC_VERCEL_ENV;
  }
});

test('Security Audit: /api/auth/dev-login - Safe dev handling without hardcoded password', async () => {
  const originalNodeEnv = mutableEnv.NODE_ENV || 'test';
  const originalUrl = mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = mutableEnv.SUPABASE_SERVICE_ROLE_KEY;

  try {
    mutableEnv.NODE_ENV = 'test';

    // Without Supabase configured, returns 500 cleanly with no leak
    delete mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
    delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;

    const res = await handleDevLogin();
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'unconfigured');
    assert.match(data.error, /not configured/i);

    // Verify no password string is leaked in error response
    const rawText = JSON.stringify(data);
    assert.equal(rawText.includes('devpassword123'), false);
  } finally {
    mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalUrl !== undefined) mutableEnv.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    else delete mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
    if (originalKey !== undefined) mutableEnv.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    else delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;
  }
});
