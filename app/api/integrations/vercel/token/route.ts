import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelService } from '@/lib/integrations/vercel';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

const MAX_BODY_BYTES = 16 * 1024; // 16 KB payload boundary

export async function POST(request: Request): Promise<Response> {
  // 1. Authorize calling Folio user
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  // 2. Request body size check
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: 'Payload exceeds maximum allowed size.', code: 'payload_too_large' },
      { status: 413, headers: responseHeaders },
    );
  }

  // 3. Safe JSON parsing
  let body: { token?: unknown; teamId?: unknown; ownerId?: unknown; userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON request body.', code: 'invalid_json' },
      { status: 400, headers: responseHeaders },
    );
  }

  // 4. Cross-user connection manipulation defense
  if (
    (typeof body.ownerId === 'string' && body.ownerId.trim() && body.ownerId.trim() !== auth.userId) ||
    (typeof body.userId === 'string' && body.userId.trim() && body.userId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: Cannot connect Vercel on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  // 5. Token validation & length boundaries
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return Response.json(
      { ok: false, error: 'A Vercel Personal Access Token is required.', code: 'missing_token' },
      { status: 400, headers: responseHeaders },
    );
  }

  if (token.length < 10 || token.length > 512) {
    return Response.json(
      { ok: false, error: 'Invalid Vercel token format or length.', code: 'invalid_token' },
      { status: 400, headers: responseHeaders },
    );
  }

  // 6. Optional teamId validation
  const teamId = typeof body.teamId === 'string' && body.teamId.trim() ? body.teamId.trim() : null;
  if (teamId && teamId.length > 100) {
    return Response.json(
      { ok: false, error: 'Invalid Vercel team identifier.', code: 'invalid_team_id' },
      { status: 400, headers: responseHeaders },
    );
  }

  // 7. Connect via VercelService with server-only secret persistence
  const vercelService = getVercelService();
  const result = await vercelService.connectWithToken({
    userId: auth.userId,
    token,
    teamId,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code || 'token_connection_failed' },
      { status: 400, headers: responseHeaders },
    );
  }

  // 8. Client-safe response: NEVER expose access token or secret credentials
  return Response.json(
    {
      ok: true,
      connected: true,
      accountName: result.accountName,
      teamName: result.teamName,
      configurationId: result.connection?.configurationId,
    },
    { status: 200, headers: responseHeaders },
  );
}
