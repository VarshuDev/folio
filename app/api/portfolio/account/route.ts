import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { DraftBundleSchema } from '@/lib/profile-schema';
import { getTemplateMeta } from '@/lib/template-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  Pragma: 'no-cache',
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
      { ok: false, error: 'Forbidden: You cannot access account data for another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const repository = getPublishingRepository();
  const draft = await repository.getDraft(auth.userId);
  const status = await repository.getPublicationStatus(auth.userId, draft?.profile, draft?.design);
  const pub = await repository.getPublicationByOwnerId(auth.userId);

  const templateId = draft?.design.templateId || pub?.design.templateId || 'editorial';
  const templateMeta = getTemplateMeta(templateId);
  const title = draft?.profile.basics.name?.trim() || pub?.profile.basics.name?.trim() || 'Untitled Portfolio';

  return Response.json(
    {
      ok: true,
      user: {
        userId: auth.userId,
        email: auth.email || null,
      },
      portfolio: {
        title,
        templateId,
        templateName: templateMeta.name,
        mode: draft?.portfolioConfig?.mode ?? 'simple',
        activePagesCount:
          draft?.portfolioConfig?.mode === 'advanced' && draft.portfolioConfig.advanced
            ? draft.portfolioConfig.advanced.pages.filter((p) => p.visible).length
            : undefined,
        totalPagesCount:
          draft?.portfolioConfig?.mode === 'advanced' && draft.portfolioConfig.advanced
            ? draft.portfolioConfig.advanced.pages.length
            : undefined,
        isPublished: status.isPublished,
        slug: status.slug,
        url: status.url,
        publishedAt: status.publishedAt,
        updatedAt: draft?.updatedAt || pub?.updatedAt || null,
        hasUnpublishedChanges: status.hasUnpublishedChanges,
      },
      draft: draft
        ? {
            profile: draft.profile,
            design: draft.design,
            portfolioConfig: draft.portfolioConfig ?? { mode: 'simple' },
            updatedAt: draft.updatedAt,
          }
        : null,
    },
    { status: 200, headers: responseHeaders },
  );
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid JSON request body.', code: 'invalid_draft' },
      { status: 400, headers: responseHeaders },
    );
  }

  if (!body || typeof body !== 'object') {
    return Response.json(
      { ok: false, error: 'Request body must be an object.', code: 'invalid_draft' },
      { status: 400, headers: responseHeaders },
    );
  }

  const rawPayload = body as { ownerId?: unknown; userId?: unknown };
  if (
    (typeof rawPayload.ownerId === 'string' && rawPayload.ownerId.trim() && rawPayload.ownerId.trim() !== auth.userId) ||
    (typeof rawPayload.userId === 'string' && rawPayload.userId.trim() && rawPayload.userId.trim() !== auth.userId)
  ) {
    return Response.json(
      { ok: false, error: 'Forbidden: You cannot modify draft for another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const parsed = DraftBundleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Draft bundle failed validation.', details: parsed.error.format(), code: 'invalid_draft' },
      { status: 400, headers: responseHeaders },
    );
  }

  const repository = getPublishingRepository();
  const saveResult = await repository.saveDraft(auth.userId, parsed.data);
  if (!saveResult.ok) {
    return Response.json(
      { ok: false, error: saveResult.message || 'Failed to save cloud draft.', code: 'server_error' },
      { status: 500, headers: responseHeaders },
    );
  }

  return Response.json(
    { ok: true, updatedAt: parsed.data.updatedAt },
    { status: 200, headers: responseHeaders },
  );
}

export async function POST(request: Request): Promise<Response> {
  return PUT(request);
}
