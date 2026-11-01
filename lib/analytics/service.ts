import crypto from 'node:crypto';
import type {
  AnalyticsEventInput,
  StoredAnalyticsEvent,
  PortfolioAnalyticsSummary,
  ReferrerStat,
  ActionStat,
  DailyViewStat,
} from './types';

/**
 * Normalizes an incoming raw referrer string into a clean, human-readable traffic source.
 * Filters out internal hosts, query parameters, and private URLs.
 */
export function normalizeReferrerSource(rawReferrer?: string | null): string {
  if (!rawReferrer || typeof rawReferrer !== 'string') {
    return 'Direct';
  }

  const trimmed = rawReferrer.trim();
  if (!trimmed || trimmed === 'about:blank') {
    return 'Direct';
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    // Check for internal hosts
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host.includes('folio.site') ||
      host.includes('nive.app')
    ) {
      return 'Direct';
    }

    if (host.includes('linkedin.com') || host.includes('lnkd.in')) {
      return 'LinkedIn';
    }
    if (host.includes('github.com')) {
      return 'GitHub';
    }
    if (host.includes('twitter.com') || host === 't.co' || host.endsWith('.t.co') || host === 'x.com' || host.endsWith('.x.com')) {
      return 'Twitter / X';
    }
    if (
      host.includes('google.') ||
      host.includes('bing.com') ||
      host.includes('duckduckgo.com') ||
      host.includes('ecosia.org')
    ) {
      return 'Search Engine';
    }
    if (host.includes('producthunt.com')) {
      return 'Product Hunt';
    }
    if (host.includes('reddit.com')) {
      return 'Reddit';
    }
    if (host.includes('news.ycombinator.com')) {
      return 'Hacker News';
    }
    if (host.includes('substack.com')) {
      return 'Substack';
    }
    if (host.includes('medium.com')) {
      return 'Medium';
    }

    // Strip 'www.' and return base domain
    return host.replace(/^www\./, '');
  } catch {
    return 'Direct';
  }
}

/**
 * Generates an anonymous, daily-rotating visitor hash.
 * Combines IP and User-Agent with a daily salt so the raw IP is NEVER stored.
 * The salt resets daily, preventing cross-day correlation while accurately
 * counting daily unique visitors.
 */
export function generatePrivacyVisitorHash(
  ip: string = '0.0.0.0',
  userAgent: string = '',
  dateStr?: string,
  saltSecret?: string
): string {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const salt = saltSecret || process.env.ANALYTICS_SALT || 'folio-daily-privacy-salt';
  return crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}:${date}:${salt}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Aggregates a list of stored analytics events into an authoritative summary.
 */
export function aggregateAnalyticsEvents(
  slug: string,
  events: StoredAnalyticsEvent[],
  isPublished = true
): PortfolioAnalyticsSummary {
  const views = events.filter((e) => e.type === 'view');
  const clicks = events.filter((e) => e.type === 'click');

  const uniqueVisitors = new Set(views.map((e) => e.visitorHash)).size;

  // Aggregate Referrers
  const referrerCounts: Record<string, number> = {};
  for (const v of views) {
    const src = v.referrerSource || 'Direct';
    referrerCounts[src] = (referrerCounts[src] || 0) + 1;
  }

  const totalViews = views.length;
  const referrers: ReferrerStat[] = Object.entries(referrerCounts)
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalViews > 0 ? Math.round((count / totalViews) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Aggregate Click Actions
  const actionCounts: Record<string, number> = {};
  for (const c of clicks) {
    const label = c.targetLabel || 'External Link';
    actionCounts[label] = (actionCounts[label] || 0) + 1;
  }

  const topActions: ActionStat[] = Object.entries(actionCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Daily Trends for past 7 days
  const dailyMap: Record<string, { views: number; visitors: Set<string> }> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    dailyMap[dateKey] = { views: 0, visitors: new Set() };
  }

  for (const v of views) {
    const dateKey = v.createdAt.slice(0, 10);
    if (dailyMap[dateKey]) {
      dailyMap[dateKey].views += 1;
      dailyMap[dateKey].visitors.add(v.visitorHash);
    }
  }

  const daily: DailyViewStat[] = Object.entries(dailyMap).map(([date, data]) => ({
    date,
    views: data.views,
    uniqueVisitors: data.visitors.size,
  }));

  return {
    slug,
    totalViews,
    uniqueVisitors,
    totalClicks: clicks.length,
    referrers,
    topActions,
    daily,
    isPublished,
  };
}
