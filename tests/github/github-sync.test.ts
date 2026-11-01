import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  normalizeGitHubRepo,
  GitHubStatsCache,
  fetchGitHubRepoStats,
  formatRelativeTime,
  getLanguageColor,
  type GitHubRepoStats,
} from '@/lib/github/cache';
import { GET } from '@/app/api/portfolio/github-stats/route';

test('normalizeGitHubRepo: correctly parses varied URL formats and rejects non-GitHub strings', () => {
  // 1. Standard HTTPS
  const res1 = normalizeGitHubRepo('https://github.com/vercel/next.js');
  assert.deepEqual(res1, { owner: 'vercel', repo: 'next.js', slug: 'vercel/next.js' });

  // 2. Trailing slash and .git
  const res2 = normalizeGitHubRepo('https://github.com/torvalds/linux.git/');
  assert.deepEqual(res2, { owner: 'torvalds', repo: 'linux', slug: 'torvalds/linux' });

  // 3. Plain owner/repo slug
  const res3 = normalizeGitHubRepo('facebook/react');
  assert.deepEqual(res3, { owner: 'facebook', repo: 'react', slug: 'facebook/react' });

  // 4. Deep subpath on GitHub
  const res4 = normalizeGitHubRepo('https://github.com/tailwindlabs/tailwindcss/tree/main/src');
  assert.deepEqual(res4, { owner: 'tailwindlabs', repo: 'tailwindcss', slug: 'tailwindlabs/tailwindcss' });

  // 5. Invalid / Non-GitHub URLs
  assert.equal(normalizeGitHubRepo('https://gitlab.com/owner/repo'), null);
  assert.equal(normalizeGitHubRepo('https://google.com'), null);
  assert.equal(normalizeGitHubRepo(''), null);
  assert.equal(normalizeGitHubRepo('just-a-string'), null);
});

test('GitHubStatsCache: stores, retrieves, and expires entries accurately', async () => {
  const cache = new GitHubStatsCache({ defaultTtlMs: 50, maxEntries: 2 });

  const mockStats: GitHubRepoStats = {
    owner: 'test',
    repo: 'repo1',
    fullName: 'test/repo1',
    stars: 120,
    forks: 15,
    language: 'TypeScript',
    description: 'A test repo',
    updatedAt: new Date().toISOString(),
    pushedAt: new Date().toISOString(),
    openIssues: 3,
    htmlUrl: 'https://github.com/test/repo1',
    fetchedAt: Date.now(),
  };

  // Set and retrieve
  cache.set('test/repo1', mockStats);
  const hit = cache.get('test/repo1');
  assert.ok(hit);
  assert.equal(hit.stars, 120);
  assert.equal(hit.isCached, true);

  // Expiration test
  await new Promise((resolve) => setTimeout(resolve, 60));
  const expired = cache.get('test/repo1');
  assert.equal(expired, null);

  // Max entries eviction
  cache.set('test/repoA', { ...mockStats, repo: 'repoA' });
  cache.set('test/repoB', { ...mockStats, repo: 'repoB' });
  cache.set('test/repoC', { ...mockStats, repo: 'repoC' });
  assert.ok(cache.size() <= 2);
});

test('fetchGitHubRepoStats: fetches, parses, and caches GitHub response with mock fetcher', async () => {
  let fetchCount = 0;
  const mockFetch: typeof fetch = async (input, init) => {
    fetchCount++;
    return {
      status: 200,
      json: async () => ({
        owner: { login: 'octocat' },
        name: 'hello-world',
        full_name: 'octocat/hello-world',
        stargazers_count: 3500,
        forks_count: 500,
        language: 'TypeScript',
        description: 'My first repo',
        updated_at: '2026-10-01T12:00:00Z',
        pushed_at: '2026-10-15T12:00:00Z',
        open_issues_count: 12,
        html_url: 'https://github.com/octocat/hello-world',
      }),
    } as unknown as Response;
  };

  const isolatedCache = new GitHubStatsCache({ defaultTtlMs: 10000 });

  // First call fetches from API
  const result1 = await fetchGitHubRepoStats('octocat/hello-world', {
    cache: isolatedCache,
    fetchFn: mockFetch,
  });

  assert.equal(result1.ok, true);
  if (result1.ok) {
    assert.equal(result1.stats.stars, 3500);
    assert.equal(result1.stats.language, 'TypeScript');
    assert.equal(result1.stats.isCached, false);
  }
  assert.equal(fetchCount, 1);

  // Second call hits cache
  const result2 = await fetchGitHubRepoStats('octocat/hello-world', {
    cache: isolatedCache,
    fetchFn: mockFetch,
  });

  assert.equal(result2.ok, true);
  if (result2.ok) {
    assert.equal(result2.stats.stars, 3500);
    assert.equal(result2.stats.isCached, true);
  }
  assert.equal(fetchCount, 1); // No new network call
});

test('fetchGitHubRepoStats: handles 404 not found and 403 rate limits gracefully', async () => {
  const mockNotFoundFetch: typeof fetch = async () => ({
    status: 404,
    json: async () => ({ message: 'Not Found' }),
  } as unknown as Response);

  const mockRateLimitedFetch: typeof fetch = async () => ({
    status: 403,
    json: async () => ({ message: 'API rate limit exceeded' }),
  } as unknown as Response);

  const isolatedCache = new GitHubStatsCache();

  // 404 response
  const notFoundRes = await fetchGitHubRepoStats('nonexistent/ghost-repo', {
    cache: isolatedCache,
    fetchFn: mockNotFoundFetch,
  });
  assert.equal(notFoundRes.ok, false);
  if (!notFoundRes.ok) {
    assert.equal(notFoundRes.error, 'repository_not_found');
    assert.equal(notFoundRes.status, 404);
  }

  // 403 response
  const rateLimitRes = await fetchGitHubRepoStats('busy/popular-repo', {
    cache: isolatedCache,
    fetchFn: mockRateLimitedFetch,
  });
  assert.equal(rateLimitRes.ok, false);
  if (!rateLimitRes.ok) {
    assert.equal(rateLimitRes.error, 'rate_limit_exceeded');
    assert.equal(rateLimitRes.status, 403);
  }
});

test('API GET /api/portfolio/github-stats: validates parameters and returns json', async () => {
  // 1. Missing parameter
  const reqMissing = new NextRequest('http://localhost:3000/api/portfolio/github-stats');
  const resMissing = await GET(reqMissing);
  assert.equal(resMissing.status, 400);
  const dataMissing = await resMissing.json();
  assert.equal(dataMissing.ok, false);
  assert.equal(dataMissing.error, 'missing_repo_parameter');

  // 2. Malformed repo
  const reqBad = new NextRequest('http://localhost:3000/api/portfolio/github-stats?repo=invalid-format');
  const resBad = await GET(reqBad);
  assert.equal(resBad.status, 400);
  const dataBad = await resBad.json();
  assert.equal(dataBad.ok, false);
  assert.equal(dataBad.error, 'invalid_repository_format');
});

test('formatRelativeTime and getLanguageColor: produce human-friendly badges and palette colors', () => {
  assert.equal(getLanguageColor('TypeScript'), '#3178c6');
  assert.equal(getLanguageColor('Python'), '#3572A5');
  assert.equal(getLanguageColor('UnknownLanguage'), '#94a3b8');

  const now = new Date();
  assert.equal(formatRelativeTime(now.toISOString()), 'just now');

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
  assert.equal(formatRelativeTime(twoDaysAgo.toISOString()), '2d ago');
});
