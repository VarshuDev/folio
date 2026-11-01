import type {
  GeneratedFile,
  GeneratedProject,
  GeneratorInput,
} from './types';
import {
  validateGeneratorInput,
  validateFilePath,
  scanGeneratedFilesForForbiddenTokens,
} from './validate';
import { buildManifest } from './manifest';
import {
  generatePackageJson,
  generateTsConfig,
  generateNextConfig,
  generateReadme,
  generateGlobalsCss,
  generateRootLayout,
  generateSiteHeader,
  generateSiteFooter,
  generatePortfolioData,
  generatePageSource,
} from './templates';

export type GenerateProjectResult =
  | {
      ok: true;
      project: GeneratedProject;
    }
  | {
      ok: false;
      error: string;
      code: string;
    };

/**
 * Compiles an Advanced portfolio configuration and profile document into
 * a complete, standalone Next.js project tree in memory.
 */
export function generateAdvancedProject(input: GeneratorInput): GenerateProjectResult {
  // 1. Validate inputs
  const validation = validateGeneratorInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      code: validation.code,
    };
  }

  const { cleanData, cleanConfig } = validation;

  // 2. Compute navigation items from visible pages ordered by order
  const visiblePages = cleanConfig.pages
    .filter((p) => p.visible)
    .sort((a, b) => a.order - b.order);

  const navigation = visiblePages.map((p) => ({
    pageType: p.type,
    route: p.slug === '' ? '/' : `/${p.slug}`,
    label: p.navLabel,
  }));

  const files: GeneratedFile[] = [];

  // 3. Project configuration & core assets
  files.push({
    path: 'package.json',
    content: generatePackageJson(),
  });

  files.push({
    path: 'tsconfig.json',
    content: generateTsConfig(),
  });

  files.push({
    path: 'next.config.ts',
    content: generateNextConfig(),
  });

  files.push({
    path: 'README.md',
    content: generateReadme(cleanData.siteTitle),
  });

  files.push({
    path: 'lib/portfolio-data.ts',
    content: generatePortfolioData(cleanData, navigation),
  });

  files.push({
    path: 'app/globals.css',
    content: generateGlobalsCss(),
  });

  files.push({
    path: 'app/layout.tsx',
    content: generateRootLayout(cleanData.siteTitle),
  });

  files.push({
    path: 'components/site-header.tsx',
    content: generateSiteHeader(),
  });

  files.push({
    path: 'components/site-footer.tsx',
    content: generateSiteFooter(),
  });

  // 4. Generate page routes only for visible pages
  for (const page of visiblePages) {
    const pagePath = page.slug === '' ? 'app/page.tsx' : `app/${page.slug}/page.tsx`;
    files.push({
      path: pagePath,
      content: generatePageSource(page),
    });
  }

  // 5. Validate all file paths
  for (const file of files) {
    if (!validateFilePath(file.path)) {
      return {
        ok: false,
        error: `Generated invalid file path: ${file.path}`,
        code: 'invalid_generated_path',
      };
    }
  }

  // 6. Security scan: ensure no forbidden tokens / secrets / arbitrary eval
  const scan = scanGeneratedFilesForForbiddenTokens(files);
  if (!scan.safe) {
    const firstViolation = scan.violations[0];
    return {
      ok: false,
      error: `Security scan failed: forbidden token "${firstViolation.token}" detected in ${firstViolation.path}`,
      code: 'forbidden_token_detected',
    };
  }

  // 7. Sort files deterministically by relative path
  files.sort((a, b) => a.path.localeCompare(b.path));

  // 8. Construct manifest
  const filePaths = files.map((f) => f.path);
  const manifest = buildManifest(cleanConfig, cleanData, filePaths);

  return {
    ok: true,
    project: {
      framework: 'nextjs',
      files,
      manifest,
    },
  };
}
