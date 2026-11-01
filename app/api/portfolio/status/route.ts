import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getPublishingRepository } from '@/lib/publishing/repository';
import type { DesignConfig, ProfileDocument } from '@/lib/profile-schema';

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
      { ok: false, error: 'Forbidden: You cannot access status for another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const repository = getPublishingRepository();
  const status = await repository.getPublicationStatus(auth.userId);

  return Response.json({ ok: true, ...status }, { status: 200, headers: responseHeaders });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  let profile: ProfileDocument | undefined;
  let design: DesignConfig | undefined;

  try {
    const body = await request.json();
    if (body && typeof body === 'object') {
      const rawPayload = body as { ownerId?: unknown; userId?: unknown; profile?: unknown; design?: unknown };
      if (
        (typeof rawPayload.ownerId === 'string' && rawPayload.ownerId.trim() && rawPayload.ownerId.trim() !== auth.userId) ||
        (typeof rawPayload.userId === 'string' && rawPayload.userId.trim() && rawPayload.userId.trim() !== auth.userId)
      ) {
        return Response.json(
          { ok: false, error: 'Forbidden: You cannot access status for another user.', code: 'forbidden' },
          { status: 403, headers: responseHeaders },
        );
      }
      profile = rawPayload.profile as ProfileDocument;
      design = rawPayload.design as DesignConfig;
    }
  } catch {
    // optional body, ignore parse errors
  }

  const repository = getPublishingRepository();
  const status = await repository.getPublicationStatus(auth.userId, profile, design);

  return Response.json({ ok: true, ...status }, { status: 200, headers: responseHeaders });
}
