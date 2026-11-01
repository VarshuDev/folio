import { NextResponse, type NextRequest } from 'next/server';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { exportSimplePortfolio, exportAdvancedPortfolio, exportResume } from '@/lib/export';
import type { ProfileDocument, DesignConfig, PortfolioConfig } from '@/lib/profile-schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    const format = (request.nextUrl.searchParams.get('format') || 'html') as 'html' | 'zip' | 'resume';

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    const repository = getPublishingRepository();
    const publication = await repository.getPublicationBySlug(slug);

    if (!publication || !publication.isPublic) {
      return NextResponse.json({ error: 'Publication not found' }, { status: 404 });
    }

    if (format === 'resume') {
      const exportResult = exportResume(publication.profile, slug);
      const isDownload = request.nextUrl.searchParams.get('download') === 'true';
      return new NextResponse(new Uint8Array(exportResult.buffer), {
        status: 200,
        headers: {
          'Content-Type': exportResult.mimeType,
          'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${exportResult.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const exportResult = exportSimplePortfolio(
      publication.profile,
      publication.design,
      slug,
      format
    );

    return new NextResponse(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      files,
      profile,
      design,
      portfolioConfig,
      slug = 'my-portfolio',
      format = 'html',
    } = body as {
      files?: Array<{ path: string; content: string }>;
      profile?: ProfileDocument;
      design?: DesignConfig;
      portfolioConfig?: PortfolioConfig;
      slug?: string;
      format?: 'html' | 'zip' | 'resume';
    };

    // If an explicit list of files is provided (e.g. from Advanced Project Inspector), zip them directly
    if (Array.isArray(files) && files.length > 0) {
      const { createZipArchive } = await import('@/lib/export/zip');
      const cleanSlug = (slug || 'portfolio-project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'portfolio-project';
      const zipBuffer = createZipArchive(files);
      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${cleanSlug}-nextjs-project.zip"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Missing profile data' }, { status: 400 });
    }

    if (format === 'resume') {
      const exportResult = exportResume(profile, slug);
      return new NextResponse(new Uint8Array(exportResult.buffer), {
        status: 200,
        headers: {
          'Content-Type': exportResult.mimeType,
          'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const isAdvanced = portfolioConfig?.mode === 'advanced' && portfolioConfig.advanced;

    const exportResult = isAdvanced
      ? exportAdvancedPortfolio(profile, portfolioConfig.advanced!, slug)
      : exportSimplePortfolio(profile, design, slug, format);

    return new NextResponse(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
