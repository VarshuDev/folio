import crypto from 'node:crypto';
import type {
  AnalyticsEventInput,
  StoredAnalyticsEvent,
  PortfolioAnalyticsSummary,
} from './types';
import {
  generatePrivacyVisitorHash,
  normalizeReferrerSource,
  aggregateAnalyticsEvents,
} from './service';

export interface AnalyticsRepository {
  recordEvent(
    input: AnalyticsEventInput,
    ip?: string,
    userAgent?: string
  ): Promise<StoredAnalyticsEvent>;
  getSummary(slug: string): Promise<PortfolioAnalyticsSummary>;
  clearForTest(): void;
  seedDemoEvents(slug: string): void;
}

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private events: StoredAnalyticsEvent[] = [];

  constructor() {
    // Seed initial demo data for common testing slugs
    this.seedDemoEvents('jane-dev');
  }

  async recordEvent(
    input: AnalyticsEventInput,
    ip = '127.0.0.1',
    userAgent = ''
  ): Promise<StoredAnalyticsEvent> {
    const visitorHash = generatePrivacyVisitorHash(ip, userAgent);
    const referrerSource = normalizeReferrerSource(input.referrer);

    const event: StoredAnalyticsEvent = {
      id: crypto.randomUUID(),
      slug: input.slug.toLowerCase().trim(),
      type: input.type,
      visitorHash,
      referrerSource,
      targetLabel: input.targetLabel ? input.targetLabel.slice(0, 64) : undefined,
      createdAt: new Date().toISOString(),
    };

    this.events.push(event);
    return event;
  }

  async getSummary(slug: string): Promise<PortfolioAnalyticsSummary> {
    const normalizedSlug = slug.toLowerCase().trim();
    const slugEvents = this.events.filter((e) => e.slug === normalizedSlug);

    return aggregateAnalyticsEvents(normalizedSlug, slugEvents, true);
  }

  clearForTest(): void {
    this.events = [];
  }

  seedDemoEvents(slug: string): void {
    const normalizedSlug = slug.toLowerCase().trim();
    const now = new Date();

    const sampleReferrers = [
      'https://www.linkedin.com/in/profile',
      'https://www.linkedin.com/feed',
      'https://github.com/developer',
      'https://t.co/share123',
      'https://www.google.com/search?q=portfolio',
      'about:blank',
      'https://news.ycombinator.com',
    ];

    const sampleActions = [
      'Resume Download',
      'GitHub Repository',
      'LinkedIn Profile',
      'Email Contact',
      'Project Demo',
    ];

    // Seed realistic 7-day events
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() - dayOffset);
      const dateStr = dayDate.toISOString().slice(0, 10);

      // 10-25 views per day
      const viewsCount = 12 + Math.floor(Math.sin(dayOffset) * 6) + dayOffset;
      for (let i = 0; i < viewsCount; i++) {
        const fakeIp = `192.168.1.${(i % 15) + 1}`;
        const refUrl = sampleReferrers[i % sampleReferrers.length];
        const hash = generatePrivacyVisitorHash(fakeIp, 'Mozilla/5.0', dateStr);

        this.events.push({
          id: crypto.randomUUID(),
          slug: normalizedSlug,
          type: 'view',
          visitorHash: hash,
          referrerSource: normalizeReferrerSource(refUrl),
          createdAt: `${dateStr}T${String(10 + (i % 12)).padStart(2, '0')}:15:00.000Z`,
        });
      }

      // 2-6 clicks per day
      const clicksCount = 2 + (dayOffset % 4);
      for (let j = 0; j < clicksCount; j++) {
        const fakeIp = `192.168.1.${j + 2}`;
        const action = sampleActions[j % sampleActions.length];
        const hash = generatePrivacyVisitorHash(fakeIp, 'Mozilla/5.0', dateStr);

        this.events.push({
          id: crypto.randomUUID(),
          slug: normalizedSlug,
          type: 'click',
          visitorHash: hash,
          referrerSource: 'Direct',
          targetLabel: action,
          createdAt: `${dateStr}T${String(12 + (j % 8)).padStart(2, '0')}:30:00.000Z`,
        });
      }
    }
  }
}

// Global singleton instance
let globalRepository: AnalyticsRepository | null = null;

export function getAnalyticsRepository(): AnalyticsRepository {
  if (!globalRepository) {
    globalRepository = new InMemoryAnalyticsRepository();
  }
  return globalRepository;
}
