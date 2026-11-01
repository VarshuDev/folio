import { NextResponse, type NextRequest } from 'next/server';
import { getAnalyticsRepository } from '@/lib/analytics/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    const repository = getAnalyticsRepository();
    const summary = await repository.getSummary(slug);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch analytics summary' },
      { status: 500 }
    );
  }
}
