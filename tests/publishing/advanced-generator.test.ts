import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAdvancedProject,
  validateGeneratorInput,
  validateFilePath,
  scanGeneratedFilesForForbiddenTokens,
  buildManifest,
  GENERATOR_VERSION,
} from '../../lib/advanced-generator';
import { createDefaultPortfolioConfig } from '../../lib/portfolio-mode';
import type { ProfileDocument } from '../../lib/profile-schema';
import { POST as handleGenerateApi } from '../../app/api/portfolio/advanced/generate/route';

const sampleProfile: ProfileDocument = {
  schemaVersion: 1,
  basics: {
    name: 'Niveen Varshan',
    role: 'Full Stack Engineer & AI Systems Architect',
    about: 'Passionate about distributed systems, resilient architectures, and generative interfaces.',
    location: 'Bengaluru, India',
    originalNotes: 'PRIVATE DRAFTING NOTES: Do not publish this confidential line anywhere!',
  },
  education: {
    college: 'National Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science & Engineering',
    gradYear: '2025',
    note: 'First Class with Distinction',
  },
  skills: ['TypeScript', 'Next.js', 'React', 'PostgreSQL', 'Go', 'Docker'],
  interests: ['Systems Programming', 'Compilers', 'Open Source'],
  projects: [
    {
      id: 'proj-1',
      title: 'NeonStrike Engine',
      description: 'High performance browser graphics rendering engine built with WebGPU and WebAssembly.',
      tools: 'Rust, WebGPU, WGSL',
      link: 'https://github.com/test/neonstrike',
    },
    {
      id: 'proj-2',
      title: 'Folio Studio',
      description: 'Autonomous portfolio generator and resilient single-page hosting platform.',
      tools: 'Next.js, TypeScript, Supabase',
      link: 'https://folio.example.com',
    },
  ],
  highlights: [
    'Built microservices serving 10M+ daily requests with 99.99% uptime.',
    'Authored top-ranking open source tools with over 2,000 GitHub stars.',
  ],
  activities: [
    'Lead Organizer, Open Source Developer Summit 2025',
    'Core Contributor to community React ecosystem libraries',
  ],
  recommendations: [],
  learning: 'Deep Learning Systems Optimization & Distributed LLM Inference',
  links: {
    email: 'niveen@example.com',
    github: 'https://github.com/niveen',
    linkedin: 'https://linkedin.com/in/niveen',
    other: [
      { label: 'Technical Blog', url: 'https://blog.niveen.dev' },
    ],
  },
};

test('Advanced Generator: Basic project compilation', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  const result = generateAdvancedProject({
    profile: sampleProfile,
    config: portfolioConfig.advanced,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { project } = result;
  assert.equal(project.framework, 'nextjs');
  assert.equal(project.manifest.generatorVersion, GENERATOR_VERSION);
  assert.equal(project.manifest.themeId, 'advanced-minimal-v1');
  assert.equal(project.manifest.siteTitle, 'Niveen Varshan');
  assert.equal(project.manifest.enabledPages.length, 5);

  // Check required core files exist
  const paths = project.files.map((f) => f.path);
  assert.ok(paths.includes('package.json'), 'package.json must exist');
  assert.ok(paths.includes('tsconfig.json'), 'tsconfig.json must exist');
  assert.ok(paths.includes('next.config.ts'), 'next.config.ts must exist');
  assert.ok(paths.includes('README.md'), 'README.md must exist');
  assert.ok(paths.includes('lib/portfolio-data.ts'), 'lib/portfolio-data.ts must exist');
  assert.ok(paths.includes('app/globals.css'), 'app/globals.css must exist');
  assert.ok(paths.includes('app/layout.tsx'), 'app/layout.tsx must exist');
  assert.ok(paths.includes('components/site-header.tsx'), 'components/site-header.tsx must exist');
  assert.ok(paths.includes('components/site-footer.tsx'), 'components/site-footer.tsx must exist');

  // Check all 5 canonical page routes exist
  assert.ok(paths.includes('app/page.tsx'), 'home route must exist');
  assert.ok(paths.includes('app/about/page.tsx'), 'about route must exist');
  assert.ok(paths.includes('app/projects/page.tsx'), 'projects route must exist');
  assert.ok(paths.includes('app/experience/page.tsx'), 'experience route must exist');
  assert.ok(paths.includes('app/contact/page.tsx'), 'contact route must exist');

  // Total files count check
  assert.equal(project.files.length, 14);
  assert.equal(project.manifest.generatedFileCount, 14);
});

test('Advanced Generator: Selective page generation when pages are disabled', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  // Disable 'projects' and 'experience' pages
  const modifiedConfig = {
    ...portfolioConfig.advanced,
    pages: portfolioConfig.advanced.pages.map((p) => {
      if (p.type === 'projects' || p.type === 'experience') {
        return { ...p, visible: false };
      }
      return p;
    }),
  };

  const result = generateAdvancedProject({
    profile: sampleProfile,
    config: modifiedConfig,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const paths = result.project.files.map((f) => f.path);

  // Disabled pages MUST NOT be generated
  assert.equal(paths.includes('app/projects/page.tsx'), false, 'disabled projects page must be omitted');
  assert.equal(paths.includes('app/experience/page.tsx'), false, 'disabled experience page must be omitted');

  // Active pages MUST remain
  assert.ok(paths.includes('app/page.tsx'));
  assert.ok(paths.includes('app/about/page.tsx'));
  assert.ok(paths.includes('app/contact/page.tsx'));

  // Manifest routes must reflect only the 3 enabled pages
  assert.equal(result.project.manifest.enabledPages.length, 3);
  assert.deepEqual(result.project.manifest.enabledPages, ['home', 'about', 'contact']);
  assert.equal(result.project.files.length, 12);
});

test('Advanced Generator: Section toggling and ordering', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  // Hide the 'skills' section on about page and move 'learning' to top
  const modifiedConfig = {
    ...portfolioConfig.advanced,
    pages: portfolioConfig.advanced.pages.map((p) => {
      if (p.type === 'about') {
        return {
          ...p,
          sections: [
            { key: 'learning' as const, visible: true },
            { key: 'summary' as const, visible: true },
            { key: 'skills' as const, visible: false },
            { key: 'education' as const, visible: true },
          ],
        };
      }
      return p;
    }),
  };

  const result = generateAdvancedProject({
    profile: sampleProfile,
    config: modifiedConfig,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const aboutPageFile = result.project.files.find((f) => f.path === 'app/about/page.tsx');
  assert.ok(aboutPageFile);

  // 'skills' section should not be rendered because visible was set to false
  assert.equal(aboutPageFile.content.includes('sec-skills'), false);
  // 'learning' section should appear before 'summary' section in the code
  const learningPos = aboutPageFile.content.indexOf('sec-learning');
  const summaryPos = aboutPageFile.content.indexOf('sec-about');
  assert.ok(learningPos !== -1);
  assert.ok(summaryPos !== -1);
  assert.ok(learningPos < summaryPos, 'sec-learning must appear before sec-about');
});

test('Advanced Generator: Determinism and alphabetized paths', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  const run1 = generateAdvancedProject({
    profile: sampleProfile,
    config: portfolioConfig.advanced,
  });

  const run2 = generateAdvancedProject({
    profile: sampleProfile,
    config: portfolioConfig.advanced,
  });

  assert.equal(run1.ok, true);
  assert.equal(run2.ok, true);
  if (!run1.ok || !run2.ok) return;

  assert.equal(run1.project.files.length, run2.project.files.length);

  for (let i = 0; i < run1.project.files.length; i++) {
    assert.equal(run1.project.files[i].path, run2.project.files[i].path);
    assert.equal(run1.project.files[i].content, run2.project.files[i].content);
  }

  // Verify paths are sorted alphabetically
  const paths = run1.project.files.map((f) => f.path);
  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(paths, sortedPaths, 'generated files must be sorted alphabetically by path');
});

test('Advanced Generator: Security scan & zero leakage of private notes', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  const result = generateAdvancedProject({
    profile: sampleProfile,
    config: portfolioConfig.advanced,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Forbidden token check
  const scan = scanGeneratedFilesForForbiddenTokens(result.project.files);
  assert.equal(scan.safe, true);
  assert.equal(scan.violations.length, 0);

  // Verify originalNotes is never leaked in any generated file
  for (const file of result.project.files) {
    assert.equal(
      file.content.includes('PRIVATE DRAFTING NOTES'),
      false,
      `file ${file.path} must not leak originalNotes`,
    );
  }
});

test('Advanced Generator: Safety validations reject dangerous protocols and paths', () => {
  // Test dangerous link
  const dangerousProfile: ProfileDocument = {
    ...sampleProfile,
    projects: [
      {
        id: 'bad-1',
        title: 'Exploit',
        description: 'Malicious payload',
        tools: 'JS',
        link: 'javascript:alert(1)',
      },
    ],
  };

  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  const result = generateAdvancedProject({
    profile: dangerousProfile,
    config: portfolioConfig.advanced,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_links');
  }

  // Path safety unit checks
  assert.equal(validateFilePath('app/page.tsx'), true);
  assert.equal(validateFilePath('components/site-header.tsx'), true);
  assert.equal(validateFilePath('../evil.js'), false);
  assert.equal(validateFilePath('/etc/passwd'), false);
  assert.equal(validateFilePath('C:\\Windows\\System32'), false);
  assert.equal(validateFilePath('app/evil\0.js'), false);
});

test('Advanced Generator: Standalone independence (no Folio dependencies)', () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  assert.ok(portfolioConfig.advanced);

  const result = generateAdvancedProject({
    profile: sampleProfile,
    config: portfolioConfig.advanced,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const pkgJsonFile = result.project.files.find((f) => f.path === 'package.json');
  assert.ok(pkgJsonFile);
  const pkg = JSON.parse(pkgJsonFile.content);

  // Must only have next, react, react-dom dependencies
  const deps = Object.keys(pkg.dependencies);
  assert.deepEqual(deps, ['next', 'react', 'react-dom']);

  // Check that no generated file imports supabase or gemini
  for (const file of result.project.files) {
    assert.equal(file.content.includes('@supabase'), false);
    assert.equal(file.content.includes('@google'), false);
  }
});

test('Advanced Generator API Route: POST /api/portfolio/advanced/generate', async () => {
  const portfolioConfig = createDefaultPortfolioConfig('advanced');
  const testUserId = 'test-owner-8i';

  // 1. Unauthenticated request is strictly rejected with 401
  const unauthReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: sampleProfile,
      config: portfolioConfig.advanced,
    }),
  });

  const unauthRes = await handleGenerateApi(unauthReq);
  assert.equal(unauthRes.status, 401);
  const unauthData = await unauthRes.json();
  assert.equal(unauthData.ok, false);
  assert.equal(unauthData.code, 'unauthenticated');

  // 2. Authenticated owner request succeeds with 200
  const validReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      profile: sampleProfile,
      config: portfolioConfig.advanced,
    }),
  });

  const res = await handleGenerateApi(validReq);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.manifest.generatorVersion, GENERATOR_VERSION);
  assert.equal(data.fileCount, 14);
  assert.equal(Array.isArray(data.files), true);

  // 3. Forged ownerId in body is rejected with 403
  const forgedOwnerReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      profile: sampleProfile,
      config: portfolioConfig.advanced,
      ownerId: 'victim-user-123',
    }),
  });

  const forgedOwnerRes = await handleGenerateApi(forgedOwnerReq);
  assert.equal(forgedOwnerRes.status, 403);
  const forgedOwnerData = await forgedOwnerRes.json();
  assert.equal(forgedOwnerData.ok, false);
  assert.equal(forgedOwnerData.code, 'forbidden');

  // 4. Forged userId in body is rejected with 403
  const forgedUserReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      profile: sampleProfile,
      config: portfolioConfig.advanced,
      userId: 'victim-user-456',
    }),
  });

  const forgedUserRes = await handleGenerateApi(forgedUserReq);
  assert.equal(forgedUserRes.status, 403);

  // 5. Cross-user query parameter is rejected with 403
  const crossUserReq = new Request('http://localhost:3000/api/portfolio/advanced/generate?ownerId=other-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      profile: sampleProfile,
      config: portfolioConfig.advanced,
    }),
  });

  const crossUserRes = await handleGenerateApi(crossUserReq);
  assert.equal(crossUserRes.status, 403);

  // 6. Missing profile returns 400
  const missingProfileReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      config: portfolioConfig.advanced,
    }),
  });

  const res2 = await handleGenerateApi(missingProfileReq);
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.equal(data2.ok, false);
  assert.equal(data2.code, 'missing_profile');

  // 7. Missing config returns 400
  const missingConfigReq = new Request('http://localhost:3000/api/portfolio/advanced/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-folio-test-user-id': testUserId,
    },
    body: JSON.stringify({
      profile: sampleProfile,
    }),
  });

  const res3 = await handleGenerateApi(missingConfigReq);
  assert.equal(res3.status, 400);
  const data3 = await res3.json();
  assert.equal(data3.ok, false);
  assert.equal(data3.code, 'missing_config');
});
