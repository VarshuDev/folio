import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReferrerSource,
  generatePrivacyVisitorHash,
  aggregateAnalyticsEvents,
  InMemoryAnalyticsRepository,
  getAnalyticsRepository,
} from '../../lib/analytics';
import type { StoredAnalyticsEvent } from '../../lib/analytics/types';
import { POST as handleEventPost } from '../../app/api/analytics/event/route';
import { GET as handleAnalyticsGet } from '../../app/api/analytics/route';
import { NextRequest } from 'next/server';

describe('Privacy-Friendly Analytics: Referrer Normalization', () => {
  it('handles empty, null, and blank referrers as Direct', () => {
    assert.equal(normalizeReferrerSource(null), 'Direct');
    assert.equal(normalizeReferrerSource(undefined), 'Direct');
    assert.equal(normalizeReferrerSource(''), 'Direct');
    assert.equal(normalizeReferrerSource('   '), 'Direct');
    assert.equal(normalizeReferrerSource('about:blank'), 'Direct');
  });

  it('filters out internal hosts as Direct', () => {
    assert.equal(normalizeReferrerSource('http://localhost:3000/studio'), 'Direct');
    assert.equal(normalizeReferrerSource('http://127.0.0.1:3000/account'), 'Direct');
    assert.equal(normalizeReferrerSource('https://jane.folio.site/p/jane'), 'Direct');
    assert.equal(normalizeReferrerSource('https://nive.app/studio'), 'Direct');
  });

  it('classifies major social platforms and search engines', () => {
    assert.equal(normalizeReferrerSource('https://www.linkedin.com/feed/'), 'LinkedIn');
    assert.equal(normalizeReferrerSource('https://lnkd.in/eXYZ123'), 'LinkedIn');
    assert.equal(normalizeReferrerSource('https://github.com/developer/project'), 'GitHub');
    assert.equal(normalizeReferrerSource('https://t.co/abc12345'), 'Twitter / X');
    assert.equal(normalizeReferrerSource('https://x.com/tech_leader'), 'Twitter / X');
    assert.equal(normalizeReferrerSource('https://www.google.com/search?q=jane+portfolio'), 'Search Engine');
    assert.equal(normalizeReferrerSource('https://duckduckgo.com/?q=portfolio'), 'Search Engine');
    assert.equal(normalizeReferrerSource('https://www.producthunt.com/posts/folio'), 'Product Hunt');
    assert.equal(normalizeReferrerSource('https://news.ycombinator.com/item?id=123'), 'Hacker News');
  });

  it('normalizes custom third-party domains cleanly', () => {
    assert.equal(normalizeReferrerSource('https://www.example.com/blog/article'), 'example.com');
  });
});

describe('Privacy-Friendly Analytics: Anonymized Visitor Hashing', () => {
  it('produces deterministic hash for same IP, UA, and date', () => {
    const hash1 = generatePrivacyVisitorHash('203.0.113.195', 'Mozilla/5.0', '2026-10-08', 'test-salt');
    const hash2 = generatePrivacyVisitorHash('203.0.113.195', 'Mozilla/5.0', '2026-10-08', 'test-salt');
    assert.equal(hash1, hash2);
    assert.ok(hash1.length >= 16);
  });

  it('rotates hash on different dates to prevent cross-day tracking', () => {
    const hashDay1 = generatePrivacyVisitorHash('203.0.113.195', 'Mozilla/5.0', '2026-10-08', 'test-salt');
    const hashDay2 = generatePrivacyVisitorHash('203.0.113.195', 'Mozilla/5.0', '2026-10-09', 'test-salt');
    assert.notEqual(hashDay1, hashDay2);
  });

  it('never leaks raw IP address in hash output', () => {
    const rawIp = '198.51.100.42';
    const hash = generatePrivacyVisitorHash(rawIp, 'Mozilla/5.0', '2026-10-08', 'test-salt');
    assert.equal(hash.includes(rawIp), false);
  });
});

describe('Privacy-Friendly Analytics: Aggregation Logic', () => {
  it('accurately aggregates views, unique visitors, referrers, and actions', () => {
    const sampleEvents: StoredAnalyticsEvent[] = [
      {
        id: '1',
        slug: 'sarah-design',
        type: 'view',
        visitorHash: 'hash-a',
        referrerSource: 'LinkedIn',
        createdAt: '2026-10-08T10:00:00Z',
      },
      {
        id: '2',
        slug: 'sarah-design',
        type: 'view',
        visitorHash: 'hash-a', // repeat visit from same visitor
        referrerSource: 'LinkedIn',
        createdAt: '2026-10-08T11:00:00Z',
      },
      {
        id: '3',
        slug: 'sarah-design',
        type: 'view',
        visitorHash: 'hash-b', // distinct visitor
        referrerSource: 'GitHub',
        createdAt: '2026-10-08T12:00:00Z',
      },
      {
        id: '4',
        slug: 'sarah-design',
        type: 'click',
        visitorHash: 'hash-b',
        referrerSource: 'Direct',
        targetLabel: 'Resume Download',
        createdAt: '2026-10-08T12:05:00Z',
      },
    ];

    const summary = aggregateAnalyticsEvents('sarah-design', sampleEvents, true);
    assert.equal(summary.slug, 'sarah-design');
    assert.equal(summary.totalViews, 3);
    assert.equal(summary.uniqueVisitors, 2);
    assert.equal(summary.totalClicks, 1);

    assert.equal(summary.referrers.length, 2);
    assert.equal(summary.referrers[0].source, 'LinkedIn');
    assert.equal(summary.referrers[0].count, 2);
    assert.equal(summary.referrers[0].percentage, 67);

    assert.equal(summary.topActions.length, 1);
    assert.equal(summary.topActions[0].label, 'Resume Download');
    assert.equal(summary.topActions[0].count, 1);

    assert.equal(summary.daily.length, 7);
  });
});

describe('Privacy-Friendly Analytics: Repository & API Endpoints', () => {
  let repo: InMemoryAnalyticsRepository;

  beforeEach(() => {
    repo = new InMemoryAnalyticsRepository();
    repo.clearForTest();
  });

  it('records view and click events through the repository', async () => {
    await repo.recordEvent(
      { slug: 'alex-code', type: 'view', referrer: 'https://github.com' },
      '192.168.1.5',
      'Chrome'
    );
    await repo.recordEvent(
      { slug: 'alex-code', type: 'click', targetLabel: 'GitHub Repo' },
      '192.168.1.5',
      'Chrome'
    );

    const summary = await repo.getSummary('alex-code');
    assert.equal(summary.totalViews, 1);
    assert.equal(summary.uniqueVisitors, 1);
    assert.equal(summary.totalClicks, 1);
    assert.equal(summary.referrers[0].source, 'GitHub');
    assert.equal(summary.topActions[0].label, 'GitHub Repo');
  });

  it('API POST /api/analytics/event validates payload and records events', async () => {
    // 1. Missing slug rejection
    const badReq = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ type: 'view' }),
    });
    const badRes = await handleEventPost(badReq);
    assert.equal(badRes.status, 400);

    // 2. Valid event ingestion
    const validReq = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-user',
        type: 'view',
        referrer: 'https://www.linkedin.com',
      }),
      headers: {
        'x-forwarded-for': '123.45.67.89',
        'user-agent': 'Safari',
      },
    });
    const validRes = await handleEventPost(validReq);
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.ok, true);
  });

  it('API GET /api/analytics validates slug query param and returns summary', async () => {
    // 1. Missing slug rejection
    const badReq = new NextRequest('http://localhost:3000/api/analytics');
    const badRes = await handleAnalyticsGet(badReq);
    assert.equal(badRes.status, 400);

    // 2. Valid slug lookup
    const validReq = new NextRequest('http://localhost:3000/api/analytics?slug=test-user');
    const validRes = await handleAnalyticsGet(validReq);
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.ok, true);
    assert.equal(validData.summary.slug, 'test-user');
  });
});
