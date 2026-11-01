import { NextResponse, type NextRequest } from 'next/server';
import { getAnalyticsRepository } from '@/lib/analytics/repository';
import type { AnalyticsEventType } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, type, referrer, targetLabel } = body ?? {};

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    if (type !== 'view' && type !== 'click') {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Extract non-PII headers for daily hashing
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    const repository = getAnalyticsRepository();
    await repository.recordEvent(
      {
        slug: slug.toLowerCase().trim(),
        type: type as AnalyticsEventType,
        referrer: referrer || null,
        targetLabel: targetLabel || null,
      },
      ip,
      userAgent
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to record event' },
      { status: 500 }
    );
  }
}
