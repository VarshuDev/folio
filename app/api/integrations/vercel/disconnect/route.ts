import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelService } from '@/lib/integrations/vercel';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  let body: { ownerId?: unknown; userId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Optional body
  }

  if (
    (typeof body.ownerId === 'string' && body.ownerId.trim() && body.ownerId.trim() !== auth.userId) ||
    (typeof body.userId === 'string' && body.userId.trim() && body.userId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: Cannot disconnect Vercel on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const vercelService = getVercelService();
  const result = await vercelService.disconnect(auth.userId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error || 'Failed to disconnect Vercel.' },
      { status: 500, headers: responseHeaders },
    );
  }

  return Response.json(
    {
      ok: true,
      disconnected: true,
    },
    { status: 200, headers: responseHeaders },
  );
}
