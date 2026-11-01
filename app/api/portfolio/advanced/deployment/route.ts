import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelDeploymentService } from '@/lib/integrations/vercel';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request): Promise<Response> {
  // 1. Mandatory server-side authentication
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders }
    );
  }

  // 2. Query param cross-user check
  const url = new URL(request.url);
  const queryOwnerId =
    url.searchParams.get('ownerId') ||
    url.searchParams.get('userId') ||
    url.searchParams.get('profileId');

  if (queryOwnerId && queryOwnerId.trim() && queryOwnerId.trim() !== auth.userId) {
    return Response.json(
      { ok: false, error: 'Forbidden: Cross-user deployment status access is not allowed.', code: 'forbidden' },
      { status: 403, headers: responseHeaders }
    );
  }

  // 3. Fetch latest deployment status
  const deploymentService = getVercelDeploymentService();
  const status = await deploymentService.getStatus(auth.userId);

  return Response.json(
    {
      ok: true,
      deployment: status,
    },
    { status: 200, headers: responseHeaders }
  );
}
