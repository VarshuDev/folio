import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelService } from '@/lib/integrations/vercel';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  const url = new URL(request.url);
  const queryOwnerId = url.searchParams.get('ownerId') || url.searchParams.get('userId');
  if (queryOwnerId && queryOwnerId.trim() && queryOwnerId.trim() !== auth.userId) {
    return Response.json(
      { ok: false, error: 'Forbidden: Cannot access Vercel connection status for another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const vercelService = getVercelService();
  const status = await vercelService.getStatus(auth.userId);

  return Response.json(
    {
      ok: true,
      ...status,
    },
    { status: 200, headers: responseHeaders },
  );
}
