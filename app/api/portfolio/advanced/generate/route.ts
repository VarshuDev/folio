import { authenticateServerRequest } from '@/lib/publishing/auth';
import { generateAdvancedProject } from '@/lib/advanced-generator';
import { ProfileDocumentSchema } from '@/lib/profile-schema';
import { AdvancedPortfolioConfigSchema } from '@/lib/portfolio-mode';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: Request): Promise<Response> {
  // 1. Mandatory authentication
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
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
      { ok: false, error: 'Forbidden: Cross-user generation access is not allowed.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  // 3. Parse JSON body
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid request body.', code: 'invalid_request' },
      { status: 400, headers: responseHeaders },
    );
  }

  if (!payload || typeof payload !== 'object') {
    return Response.json(
      { ok: false, error: 'Request body must be a JSON object.', code: 'invalid_request' },
      { status: 400, headers: responseHeaders },
    );
  }

  const raw = payload as {
    profile?: unknown;
    config?: unknown;
    ownerId?: unknown;
    userId?: unknown;
    profileId?: unknown;
  };

  // 4. Forged owner/user ID check
  if (
    (typeof raw.ownerId === 'string' && raw.ownerId.trim() && raw.ownerId.trim() !== auth.userId) ||
    (typeof raw.userId === 'string' && raw.userId.trim() && raw.userId.trim() !== auth.userId) ||
    (typeof raw.profileId === 'string' && raw.profileId.trim() && raw.profileId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: You cannot generate on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  // 3. Validate presence of profile and config
  if (!raw.profile) {
    return Response.json(
      { ok: false, error: 'Profile document is required for project generation.', code: 'missing_profile' },
      { status: 400, headers: responseHeaders },
    );
  }

  if (!raw.config) {
    return Response.json(
      { ok: false, error: 'Advanced portfolio configuration is required.', code: 'missing_config' },
      { status: 400, headers: responseHeaders },
    );
  }

  // 4. Validate schemas
  const profileParsed = ProfileDocumentSchema.safeParse(raw.profile);
  if (!profileParsed.success) {
    return Response.json(
      { ok: false, error: 'Invalid profile document structure.', code: 'invalid_profile' },
      { status: 400, headers: responseHeaders },
    );
  }

  const configParsed = AdvancedPortfolioConfigSchema.safeParse(raw.config);
  if (!configParsed.success) {
    return Response.json(
      {
        ok: false,
        error: `Invalid advanced config: ${configParsed.error.issues[0]?.message || 'Schema mismatch'}`,
        code: 'invalid_config',
      },
      { status: 400, headers: responseHeaders },
    );
  }

  // 5. Run the in-memory controlled Next.js project generator
  const result = generateAdvancedProject({
    profile: profileParsed.data,
    config: configParsed.data,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status: 400, headers: responseHeaders },
    );
  }

  // 6. Return generated project details
  return Response.json(
    {
      ok: true,
      manifest: result.project.manifest,
      fileCount: result.project.files.length,
      files: result.project.files,
    },
    { status: 200, headers: responseHeaders },
  );
}
