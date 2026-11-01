import { NextResponse, type NextRequest } from 'next/server';
import { fetchGitHubRepoStats, normalizeGitHubRepo } from '@/lib/github/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const repoParam = searchParams.get('repo') || searchParams.get('url');

    if (!repoParam) {
      return NextResponse.json(
        { ok: false, error: 'missing_repo_parameter' },
        { status: 400 }
      );
    }

    const normalized = normalizeGitHubRepo(repoParam);
    if (!normalized) {
      return NextResponse.json(
        { ok: false, error: 'invalid_repository_format' },
        { status: 400 }
      );
    }

    const result = await fetchGitHubRepoStats(normalized.slug);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        stats: result.stats,
      });
    }

    const status = result.status ?? (result.error === 'rate_limit_exceeded' ? 429 : 400);

    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        fallback: result.fallback,
      },
      { status }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'internal_server_error',
      },
      { status: 500 }
    );
  }
}
