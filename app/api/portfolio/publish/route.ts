import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { validatePublishableDraft } from '@/lib/publishing/validation';
import { revalidatePortfolioPath } from '@/lib/publishing/revalidate';
import type { PublishResult } from '@/lib/publishing/types';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function POST(request: Request): Promise<Response> {
  // 1. Authentication
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    const errorBody: PublishResult = {
      ok: false,
      error: auth.error,
      code: 'unauthenticated',
    };
    return Response.json(errorBody, { status: 401, headers: responseHeaders });
  }

  // 2. Parse payload
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const errorBody: PublishResult = {
      ok: false,
      error: 'Invalid request body.',
      code: 'invalid_profile',
    };
    return Response.json(errorBody, { status: 400, headers: responseHeaders });
  }

  if (!payload || typeof payload !== 'object') {
    const errorBody: PublishResult = {
      ok: false,
      error: 'Request must be a JSON object.',
      code: 'invalid_profile',
    };
    return Response.json(errorBody, { status: 400, headers: responseHeaders });
  }

  const rawPayload = payload as {
    slug?: unknown;
    profile?: unknown;
    design?: unknown;
    mode?: unknown;
    portfolioConfig?: unknown;
    ownerId?: unknown;
    userId?: unknown;
  };

  if (
    (typeof rawPayload.ownerId === 'string' && rawPayload.ownerId.trim() && rawPayload.ownerId.trim() !== auth.userId) ||
    (typeof rawPayload.userId === 'string' && rawPayload.userId.trim() && rawPayload.userId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: You cannot publish on behalf of another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  // Reject publishing if request explicitly specifies advanced mode or advanced config
  if (
    rawPayload.mode === 'advanced' ||
    (rawPayload.portfolioConfig && typeof rawPayload.portfolioConfig === 'object' && (rawPayload.portfolioConfig as Record<string, unknown>).mode === 'advanced')
  ) {
    const errorBody: PublishResult = {
      ok: false,
      error: 'Advanced portfolio publishing is not available yet. Multi-page Vercel deployment will be available in a later step.',
      code: 'unsupported_mode',
    };
    return Response.json(errorBody, { status: 422, headers: responseHeaders });
  }

  const repository = getPublishingRepository();
  const existingDraft = await repository.getDraft(auth.userId);
  if (existingDraft?.portfolioConfig?.mode === 'advanced' && rawPayload.mode !== 'simple') {
    const errorBody: PublishResult = {
      ok: false,
      error: 'Advanced portfolio publishing is not available yet. Multi-page Vercel deployment will be available in a later step.',
      code: 'unsupported_mode',
    };
    return Response.json(errorBody, { status: 422, headers: responseHeaders });
  }

  const { slug, profile, design } = rawPayload;

  if (typeof slug !== 'string') {
    const errorBody: PublishResult = {
      ok: false,
      error: 'A portfolio address (slug) is required.',
      code: 'invalid_slug',
    };
    return Response.json(errorBody, { status: 400, headers: responseHeaders });
  }

  // 3. Validation
  const validation = validatePublishableDraft(profile, design, slug);
  if (!validation.ok) {
    const errorBody: PublishResult = {
      ok: false,
      error: validation.error,
      code: validation.code,
    };
    return Response.json(errorBody, { status: 422, headers: responseHeaders });
  }

  // 4. Persistence
  const publishResult = await repository.publishPortfolio(
    auth.userId,
    validation.cleanSlug,
    validation.cleanProfile,
    validation.cleanDesign,
  );

  if (!publishResult.ok) {
    const status = publishResult.code === 'slug_taken' ? 409 : 500;
    const errorBody: PublishResult = {
      ok: false,
      error: publishResult.error,
      code: publishResult.code,
    };
    return Response.json(errorBody, { status, headers: responseHeaders });
  }

  const { publication, previousSlug } = publishResult;

  // On-demand cache invalidation for the live public route(s)
  await revalidatePortfolioPath(publication.slug);
  if (previousSlug) {
    await revalidatePortfolioPath(previousSlug);
  }

  const successBody: PublishResult = {
    ok: true,
    slug: publication.slug,
    url: `/p/${publication.slug}`,
    publishedAt: publication.publishedAt,
    version: publication.version,
  };

  return Response.json(successBody, { status: 200, headers: responseHeaders });
}
