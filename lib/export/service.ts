import type { ProfileDocument, DesignConfig } from '@/lib/profile-schema';
import type { AdvancedPortfolioConfig } from '@/lib/portfolio-mode';
import { generateAdvancedProject } from '@/lib/advanced-generator';
import { generateStandalonePortfolioHtml } from './html-export';
import { generateAtsResumeHtml } from './resume-export';
import { createZipArchive, type ZipFileInput } from './zip';

export interface ExportResult {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Exports a Simple mode portfolio as either a standalone HTML file or a complete ZIP package.
 */
export function exportSimplePortfolio(
  profile: ProfileDocument,
  design?: DesignConfig,
  slug = 'portfolio',
  format: 'html' | 'zip' = 'html'
): ExportResult {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'portfolio';
  const html = generateStandalonePortfolioHtml(profile, design, cleanSlug);

  if (format === 'html') {
    return {
      filename: `${cleanSlug}.html`,
      mimeType: 'text/html; charset=utf-8',
      buffer: Buffer.from(html, 'utf8'),
    };
  }

  // Bundle into a full static ZIP package with README
  const readmeContent = `# ${profile.basics.name || 'Portfolio'}

This is your standalone, self-contained personal portfolio exported from Folio.

## How to use:
- **Offline / Local**: Double-click \`index.html\` to open your portfolio directly in any browser.
- **GitHub Pages**: Upload \`index.html\` to the root of a GitHub repository and turn on GitHub Pages.
- **Netlify / Cloudflare / Vercel**: Drag and drop this folder directly into Netlify Drop or Cloudflare Pages.

Generated with Folio · https://nive.app
`;

  const files: ZipFileInput[] = [
    { path: 'index.html', content: html },
    { path: 'README.md', content: readmeContent },
  ];

  const zipBuffer = createZipArchive(files);
  return {
    filename: `${cleanSlug}-static-portfolio.zip`,
    mimeType: 'application/zip',
    buffer: zipBuffer,
  };
}

/**
 * Exports an Advanced mode portfolio as a complete, standalone Next.js project ZIP archive.
 */
export function exportAdvancedPortfolio(
  profile: ProfileDocument,
  config: AdvancedPortfolioConfig,
  slug = 'portfolio-project'
): ExportResult {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'portfolio-project';
  const result = generateAdvancedProject({ profile, config });

  if (!result.ok) {
    throw new Error(`Failed to generate project: ${result.error}`);
  }

  const files: ZipFileInput[] = result.project.files.map((f) => ({
    path: f.path,
    content: f.content,
  }));

  const zipBuffer = createZipArchive(files);
  return {
    filename: `${cleanSlug}-nextjs-project.zip`,
    mimeType: 'application/zip',
    buffer: zipBuffer,
  };
}

/**
 * Exports a clean, ATS-compliant printable PDF resume as an HTML document.
 */
export function exportResume(
  profile: ProfileDocument,
  slug = 'portfolio'
): ExportResult {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'portfolio';
  const html = generateAtsResumeHtml(profile, cleanSlug);
  return {
    filename: `${cleanSlug}-resume.html`,
    mimeType: 'text/html; charset=utf-8',
    buffer: Buffer.from(html, 'utf8'),
  };
}

