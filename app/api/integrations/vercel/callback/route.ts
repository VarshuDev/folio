import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelService, verifyOAuthState } from '@/lib/integrations/vercel';

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
  const baseUrl = getBaseUrl(request);
  const url = new URL(request.url, baseUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const teamId = url.searchParams.get('teamId');
  const configurationId = url.searchParams.get('configurationId');
  const errorParam = url.searchParams.get('error');

  const wantsJson = request.headers.get('accept')?.includes('application/json') || url.searchParams.get('format') === 'json';

  // Check if provider returned an error
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') || errorParam;
    if (wantsJson) {
      return Response.json(
        { ok: false, error: `Vercel authorization failed: ${errorDesc}`, code: 'provider_error' },
        { status: 400, headers: responseHeaders },
      );
    }
    return Response.redirect(new URL(`/account?vercel_error=${encodeURIComponent(errorDesc)}`, baseUrl).toString(), 302);
  }

  // 1. Validate state parameter exists
  if (!state) {
    if (wantsJson) {
      return Response.json(
        { ok: false, error: 'Missing OAuth state parameter.', code: 'missing_state' },
        { status: 400, headers: responseHeaders },
      );
    }
    return Response.redirect(new URL('/account?vercel_error=missing_state', baseUrl).toString(), 302);
  }

  // 2. Validate state cryptographically without prematurely consuming the nonce
  const stateVerify = await verifyOAuthState(state, undefined, { consume: false });
  if (!stateVerify.ok) {
    if (wantsJson) {
      return Response.json(
        { ok: false, error: stateVerify.error, code: stateVerify.code },
        { status: 400, headers: responseHeaders },
      );
    }
    return Response.redirect(new URL(`/account?vercel_error=${encodeURIComponent(stateVerify.code)}`, baseUrl).toString(), 302);
  }

  const { payload } = stateVerify;

  // 3. Optional session cross-check if session credentials are present in request
  const auth = await authenticateServerRequest(request);
  if (auth.ok && auth.userId !== payload.userId) {
    if (wantsJson) {
      return Response.json(
        { ok: false, error: 'Mismatched user session during OAuth callback.', code: 'user_mismatch' },
        { status: 403, headers: responseHeaders },
      );
    }
    return Response.redirect(new URL('/account?vercel_error=user_mismatch', baseUrl).toString(), 302);
  }

  const sessionUserId = payload.userId;
  const redirectUri = process.env.VERCEL_REDIRECT_URI || `${baseUrl}/api/integrations/vercel/callback`;

  // 4. Handle token exchange and connection persistence
  const vercelService = getVercelService();
  const callbackResult = await vercelService.handleCallback({
    code,
    state,
    teamId,
    configurationId,
    sessionUserId,
    redirectUri,
  });

  if (!callbackResult.ok) {
    if (wantsJson) {
      return Response.json(
        { ok: false, error: callbackResult.error, code: callbackResult.code },
        { status: 400, headers: responseHeaders },
      );
    }
    return Response.redirect(new URL(`/account?vercel_error=${encodeURIComponent(callbackResult.code || 'callback_failed')}`, baseUrl).toString(), 302);
  }

  if (wantsJson) {
    return Response.json(
      {
        ok: true,
        connected: true,
        configurationId: callbackResult.connection?.configurationId,
        accountName: callbackResult.connection?.metadata.accountName,
        teamName: callbackResult.connection?.metadata.teamName,
        scope: callbackResult.connection?.metadata.scope,
      },
      { status: 200, headers: responseHeaders },
    );
  }

  const targetNext = payload.nextUrl || '/account';
  const targetUrl = new URL(targetNext, baseUrl);
  targetUrl.searchParams.set('vercel_connected', '1');
  return Response.redirect(targetUrl.toString(), 302);
}
