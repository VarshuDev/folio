import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelService } from '@/lib/integrations/vercel';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function getBaseUrl(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    return `${proto}://${host}`;
  }
  const url = new URL(request.url);
  if (url.hostname === '0.0.0.0' || url.hostname === '::') {
    return `${url.protocol}//localhost:${url.port || '3000'}`;
  }
  return url.origin;
}

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
      { ok: false, error: 'Forbidden: Cannot initiate connection on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  // Fail-closed configuration check if credentials are not configured
  const clientId = process.env.VERCEL_CLIENT_ID;
  const slug = process.env.VERCEL_INTEGRATION_SLUG;
  if (!clientId && !slug && (process.env.NODE_ENV === 'production' || process.env.VERCEL_REQUIRE_CONFIG === '1')) {
    return Response.json(
      {
        ok: false,
        error: 'Vercel integration is not configured on the server. Please set VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET.',
        code: 'unconfigured_integration',
      },
      { status: 503, headers: responseHeaders },
    );
  }

  const baseUrl = getBaseUrl(request);
  const nextUrl = url.searchParams.get('next') || '/account';
  const redirectUri = process.env.VERCEL_REDIRECT_URI || `${baseUrl}/api/integrations/vercel/callback`;
  const teamSlug = url.searchParams.get('teamSlug') || undefined;

  const vercelService = getVercelService();
  try {
    const { url: installUrl, state } = await vercelService.getConnectUrl({
      userId: auth.userId,
      redirectUri,
      nextUrl,
      teamSlug,
    });

    return Response.json(
      {
        ok: true,
        installUrl,
        state,
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (err: unknown) {
    const errorObj = err as { message?: string; code?: string };
    return Response.json(
      {
        ok: false,
        error: errorObj.message || 'Failed to generate Vercel connection URL.',
        code: errorObj.code || 'connect_failed',
      },
      { status: 500, headers: responseHeaders },
    );
  }
}
