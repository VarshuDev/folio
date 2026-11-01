import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getVercelDeploymentService } from '@/lib/integrations/vercel';
import { ProfileDocumentSchema } from '@/lib/profile-schema';
import { AdvancedPortfolioConfigSchema } from '@/lib/portfolio-mode';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: Request): Promise<Response> {
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
      { ok: false, error: 'Forbidden: Cross-user deployment access is not allowed.', code: 'forbidden' },
      { status: 403, headers: responseHeaders }
    );
  }

  // 3. Optional JSON payload (if passing draft updates from client)
  let raw: {
    profile?: unknown;
    config?: unknown;
    ownerId?: unknown;
    userId?: unknown;
    profileId?: unknown;
    teamId?: unknown;
    accessToken?: unknown;
  } = {};

  try {
    const text = await request.text();
    if (text && text.trim()) {
      raw = JSON.parse(text);
    }
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON request body.', code: 'invalid_request' },
      { status: 400, headers: responseHeaders }
    );
  }

  // 4. Forged owner/user ID check
  if (
    (typeof raw.ownerId === 'string' && raw.ownerId.trim() && raw.ownerId.trim() !== auth.userId) ||
    (typeof raw.userId === 'string' && raw.userId.trim() && raw.userId.trim() !== auth.userId) ||
    (typeof raw.profileId === 'string' && raw.profileId.trim() && raw.profileId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: You cannot deploy on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders }
    );
  }

  let profile;
  let config;

  if (raw.profile) {
    const parsed = ProfileDocumentSchema.safeParse(raw.profile);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: 'Invalid profile document structure.', code: 'invalid_profile' },
        { status: 400, headers: responseHeaders }
      );
    }
    profile = parsed.data;
  }

  if (raw.config) {
    const rawCfg = raw.config as { mode?: string; advanced?: unknown };
    let candidate: unknown = raw.config;
    if (rawCfg && typeof rawCfg === 'object' && 'mode' in rawCfg) {
      if (rawCfg.mode !== 'advanced') {
        return Response.json(
          { ok: false, error: 'Only Advanced mode portfolios can be deployed to Vercel.', code: 'unsupported_mode' },
          { status: 422, headers: responseHeaders }
        );
      }
      candidate = rawCfg.advanced;
    }

    const parsed = AdvancedPortfolioConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: `Invalid advanced config: ${parsed.error.issues[0]?.message || 'Schema mismatch'}`,
          code: 'invalid_config',
        },
        { status: 400, headers: responseHeaders }
      );
    }
    config = parsed.data;
  }

  // 5. Invoke Deployment Engine
  const deploymentService = getVercelDeploymentService();
  const result = await deploymentService.deploy({
    userId: auth.userId,
    profile,
    config,
  });

  if (!result.ok) {
    let statusCode = 400;
    if (result.code === 'unauthenticated' || result.code === 'unauthorized') {
      statusCode = 401;
    } else if (result.code === 'forbidden') {
      statusCode = 403;
    } else if (result.code === 'unsupported_mode') {
      statusCode = 422;
    } else if (result.code === 'deployment_in_progress') {
      statusCode = 409;
    }

    return Response.json(
      {
        ok: false,
        error: result.error,
        code: result.code,
      },
      { status: statusCode, headers: responseHeaders }
    );
  }

  return Response.json(
    {
      ok: true,
      status: result.status,
      deploymentId: result.deploymentId,
      projectId: result.projectId,
      projectName: result.projectName,
      deploymentUrl: result.deploymentUrl,
      productionUrl: result.productionUrl,
    },
    { status: 200, headers: responseHeaders }
  );
}
