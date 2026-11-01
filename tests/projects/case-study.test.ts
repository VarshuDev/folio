import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProjectSchema,
  ProjectCaseStudySchema,
  ProjectGithubStatsSchema,
  ProfileDocumentSchema,
  createEmptyProfile,
  safeExternalUrl,
} from '@/lib/profile-schema';

test('ProjectCaseStudySchema: parses complete case studies and applies safe defaults', () => {
  // 1. Full case study
  const full = ProjectCaseStudySchema.safeParse({
    problem: 'Slow search latency due to unbounded linear scanning in the database.',
    solution: 'Designed an in-memory inverted index with token normalization and caching.',
    architecture: 'Client (Next.js) -> Edge Worker -> In-Memory Index -> PostgreSQL',
    takeaways: [
      'Tokenization dramatically improves query relevance.',
      'Edge caching reduces 95th percentile latency by 80%.',
    ],
    metrics: '85ms p95 latency down from 650ms, 12k daily queries',
    liveDemoUrl: 'https://demo.example.com/search',
  });
  assert.equal(full.success, true);
  if (full.success) {
    assert.equal(full.data.takeaways.length, 2);
    assert.equal(full.data.metrics.includes('85ms'), true);
  }

  // 2. Empty payload applies defaults
  const empty = ProjectCaseStudySchema.safeParse({});
  assert.equal(empty.success, true);
  if (empty.success) {
    assert.equal(empty.data.problem, '');
    assert.equal(empty.data.solution, '');
    assert.equal(empty.data.architecture, '');
    assert.deepEqual(empty.data.takeaways, []);
    assert.equal(empty.data.metrics, '');
  }

  // 3. Excessively long problem statement (> 3000 chars) fails validation
  const tooLong = ProjectCaseStudySchema.safeParse({
    problem: 'x'.repeat(3001),
  });
  assert.equal(tooLong.success, false);

  // 4. Excessively many takeaways (> 10 items) fails validation
  const tooManyTakeaways = ProjectCaseStudySchema.safeParse({
    takeaways: Array.from({ length: 11 }, (_, i) => `Takeaway ${i + 1}`),
  });
  assert.equal(tooManyTakeaways.success, false);
});

test('ProjectGithubStatsSchema: parses repository metrics and guards non-negative numbers', () => {
  const valid = ProjectGithubStatsSchema.safeParse({
    stars: 340,
    forks: 42,
    language: 'TypeScript',
    updatedAt: '2026-10-20T12:00:00Z',
    openIssues: 5,
  });
  assert.equal(valid.success, true);

  const negative = ProjectGithubStatsSchema.safeParse({
    stars: -1,
  });
  assert.equal(negative.success, false);
});

test('ProjectSchema: guarantees 100% backward compatibility for legacy drafts', () => {
  // Legacy project without new fields
  const legacy = ProjectSchema.safeParse({
    id: 'proj-legacy-01',
    title: 'Minimalist Weather App',
    description: 'A clean weather dashboard using the OpenWeather API.',
    tools: 'React, CSS Modules',
    link: 'https://weather.example.com',
  });

  assert.equal(legacy.success, true);
  if (legacy.success) {
    assert.equal(legacy.data.githubUrl, undefined);
    assert.equal(legacy.data.caseStudy, undefined);
    assert.equal(legacy.data.githubStats, undefined);
  }

  // Modern project with case study and GitHub info
  const modern = ProjectSchema.safeParse({
    id: 'proj-modern-02',
    title: 'Distributed Event Bus',
    description: 'High-throughput publish-subscribe message broker.',
    tools: 'Go, gRPC, Protobuf',
    link: 'https://github.com/alex/event-bus',
    githubUrl: 'https://github.com/alex/event-bus',
    githubStats: {
      stars: 890,
      forks: 120,
      language: 'Go',
      updatedAt: '2026-10-25T08:00:00Z',
    },
    caseStudy: {
      problem: 'Kafka was too heavy for our resource-constrained edge gateways.',
      solution: 'Created a zero-allocation circular buffer streaming events over gRPC.',
      architecture: 'Producer -> gRPC -> Ring Buffer -> Consumer Group',
      takeaways: ['Profiling memory allocations in Go yields 5x throughput gains.'],
      metrics: '1.2M msg/sec with < 5MB RAM consumption',
      liveDemoUrl: 'https://event-bus.demo',
    },
  });

  assert.equal(modern.success, true);
  if (modern.success) {
    assert.equal(modern.data.githubStats?.stars, 890);
    assert.equal(modern.data.caseStudy?.takeaways.length, 1);
  }
});

test('ProfileDocumentSchema: parses whole profile with project intelligence', () => {
  const profile = createEmptyProfile();
  profile.projects.push({
    id: 'proj-test-01',
    title: 'Folio Studio',
    description: 'Organic portfolio builder.',
    tools: 'Next.js, TypeScript',
    link: 'https://github.com/user/folio',
    githubUrl: 'https://github.com/user/folio',
    caseStudy: {
      problem: 'Existing portfolio builders lock users into subscription walls.',
      solution: 'Built a zero lock-in code exporter and direct git sync.',
      architecture: 'Next.js 16 -> Tailwind -> In-Memory Caching -> Vercel API',
      takeaways: ['Design constraints cultivate focus.'],
      metrics: 'Over 5,000 exported developer portfolios',
      liveDemoUrl: 'https://folio.example.com',
    },
  });

  const parsed = ProfileDocumentSchema.safeParse(profile);
  assert.equal(parsed.success, true);
});

test('safeExternalUrl: sanitizes URLs and guards against javascript: schemes', () => {
  assert.equal(safeExternalUrl('https://example.com'), 'https://example.com/');
  assert.equal(safeExternalUrl('http://example.com/demo'), 'http://example.com/demo');
  assert.equal(safeExternalUrl('example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl(''), null);
  assert.equal(safeExternalUrl(undefined), null);
});
