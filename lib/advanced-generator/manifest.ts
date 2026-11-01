import type { AdvancedPortfolioConfig } from '@/lib/portfolio-mode';
import type { CleanPortfolioData, GenerationManifest, GeneratedRouteMeta } from './types';

export const GENERATOR_VERSION = '1.0.0';

/**
 * Builds a deterministic project manifest from validated configuration and data.
 */
export function buildManifest(
  config: AdvancedPortfolioConfig,
  cleanData: CleanPortfolioData,
  filePaths: string[],
): GenerationManifest {
  const visiblePages = config.pages
    .filter((p) => p.visible)
    .sort((a, b) => a.order - b.order);

  const routes: GeneratedRouteMeta[] = visiblePages.map((p) => ({
    pageType: p.type,
    route: p.slug === '' ? '/' : `/${p.slug}`,
    title: p.title,
    navLabel: p.navLabel,
  }));

  const sortedPaths = [...filePaths].sort();

  return {
    generatorVersion: GENERATOR_VERSION,
    framework: 'nextjs',
    themeId: config.themeId,
    themeVersion: config.themeVersion,
    siteTitle: cleanData.siteTitle,
    enabledPages: visiblePages.map((p) => p.type),
    routes,
    generatedFileCount: sortedPaths.length,
    filePaths: sortedPaths,
  };
}
