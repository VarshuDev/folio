import { createClient } from '@supabase/supabase-js';

export type AuthUserResult =
  | { ok: true; userId: string; email?: string }
  | { ok: false; error: string };

/**
 * Strict fail-closed check: test-only headers (x-folio-test-user-id and Bearer test-*)
 * and local unauthenticated token fallbacks are strictly prohibited in production,
 * and fail-closed if the environment is misconfigured.
 */
function isTestAuthAllowed(): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  if (
    nodeEnv === 'production' ||
    nodeEnv === 'prod' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
  ) {
    return false;
  }

  // Explicit test or development environment
  if (nodeEnv === 'test' || nodeEnv === 'development') {
    return true;
  }

  // Automated test runner execution (node:test or tsx --test or npm test)
  if (
    process.env.NODE_TEST_CONTEXT !== undefined ||
    process.env.npm_lifecycle_event?.includes('test') ||
    process.argv.some((arg) => arg.includes('test')) ||
    process.execArgv.some((arg) => arg.includes('test'))
  ) {
    return true;
  }

  // Fail-closed for all unknown or misconfigured environments
  return false;
}

/**
 * Extracts and verifies the authenticated user from a Next.js / Web Request.
 */
export async function authenticateServerRequest(request: Request): Promise<AuthUserResult> {
  // 1. Check Authorization header
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  // 2. Allow test header only in verified non-production test/development environments
  if (isTestAuthAllowed()) {
    const testUserId = request.headers.get('x-folio-test-user-id');
    if (testUserId && testUserId.trim()) {
      return { ok: true, userId: testUserId.trim(), email: `${testUserId.trim()}@test.local` };
    }
    // Also allow "Bearer test-<id>" in tests
    if (token.startsWith('test-')) {
      const userId = token.slice(5).trim();
      if (userId) return { ok: true, userId, email: `${userId}@test.local` };
    }
  }

  if (!token) {
    return { ok: false, error: 'Sign in is required to publish or manage your portfolio.' };
  }

  // 3. Verify with Supabase if configured
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await client.auth.getUser(token);
      if (error || !user) {
        return { ok: false, error: 'Invalid or expired session. Please sign in again.' };
      }
      return { ok: true, userId: user.id, email: user.email };
    } catch {
      return { ok: false, error: 'Authentication verification failed.' };
    }
  }

  // If Supabase credentials are missing and we are not in verified test/dev, reject
  if (!isTestAuthAllowed()) {
    return { ok: false, error: 'Authentication service is not configured.' };
  }

  // Fallback for local development when token is provided without Supabase
  return { ok: true, userId: `local-user-${token.slice(0, 12)}` };
}
