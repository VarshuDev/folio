import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { revalidatePortfolioPath } from '@/lib/publishing/revalidate';

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

  try {
    const body = await request.clone().json();
    if (body && typeof body === 'object') {
      const rawPayload = body as { ownerId?: unknown; userId?: unknown };
      if (
        (typeof rawPayload.ownerId === 'string' && rawPayload.ownerId.trim() && rawPayload.ownerId.trim() !== auth.userId) ||
        (typeof rawPayload.userId === 'string' && rawPayload.userId.trim() && rawPayload.userId.trim() !== auth.userId)
      ) {
        return Response.json(
          { ok: false, error: 'Forbidden: You cannot unpublish another user’s portfolio.', code: 'forbidden' },
          { status: 403, headers: responseHeaders },
        );
      }
    }
  } catch {
    // body is optional for unpublish
  }

  const repository = getPublishingRepository();
  const result = await repository.unpublishPortfolio(auth.userId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.message || 'Could not unpublish portfolio.' },
      { status: 500, headers: responseHeaders },
    );
  }

  if (result.unpublishedSlug) {
    await revalidatePortfolioPath(result.unpublishedSlug);
  }

  return Response.json(
    { ok: true, message: 'Portfolio unpublished.' },
    { status: 200, headers: responseHeaders },
  );
}
