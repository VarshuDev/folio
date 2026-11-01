import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_EMAIL = 'dev@folio.local';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Strict fail-closed check: Dev login is strictly prohibited in production,
 * and must be rejected if the environment is misconfigured or ambiguous.
 */
function isDevLoginAllowed(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  if (
    nodeEnv === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
  ) {
    return false;
  }
  // Fail-closed: only allowed when explicitly set to development or test
  return nodeEnv === 'development' || nodeEnv === 'test';
}

export async function POST(): Promise<Response> {
  if (!isDevLoginAllowed()) {
    return Response.json(
      { ok: false, error: 'Dev login is disabled in production.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return Response.json(
      { ok: false, error: 'Supabase credentials not configured.', code: 'unconfigured' },
      { status: 500, headers: responseHeaders },
    );
  }

  // Generate an ephemeral cryptographic password per request to avoid hardcoded/shared secrets
  const ephemeralPassword = `Dev_${crypto.randomBytes(18).toString('base64url')}!9`;

  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      return Response.json(
        { ok: false, error: listError.message, code: 'supabase_error' },
        { status: 500, headers: responseHeaders },
      );
    }

    let existing = users.find((u) => u.email === DEV_EMAIL);

    if (!existing) {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: ephemeralPassword,
        email_confirm: true,
        user_metadata: { name: 'Dev User' },
      });
      if (createError || !createData.user) {
        return Response.json(
          { ok: false, error: createError?.message || 'Failed to create dev user', code: 'creation_failed' },
          { status: 500, headers: responseHeaders },
        );
      }
      existing = createData.user;
    } else {
      await admin.auth.admin.updateUserById(existing.id, {
        password: ephemeralPassword,
        email_confirm: true,
      });
    }

    return Response.json(
      {
        ok: true,
        email: DEV_EMAIL,
        password: ephemeralPassword,
        userId: existing.id,
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { ok: false, error: message, code: 'internal_error' },
      { status: 500, headers: responseHeaders },
    );
  }
}
