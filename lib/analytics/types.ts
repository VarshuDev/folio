export type AnalyticsEventType = 'view' | 'click';

export interface AnalyticsEventInput {
  slug: string;
  type: AnalyticsEventType;
  referrer?: string | null;
  targetLabel?: string | null;
}

export interface ReferrerStat {
  source: string;
  count: number;
  percentage: number;
}

export interface ActionStat {
  label: string;
  count: number;
}

export interface DailyViewStat {
  date: string; // YYYY-MM-DD
  views: number;
  uniqueVisitors: number;
}

export interface PortfolioAnalyticsSummary {
  slug: string;
  totalViews: number;
  uniqueVisitors: number;
  totalClicks: number;
  referrers: ReferrerStat[];
  topActions: ActionStat[];
  daily: DailyViewStat[];
  isPublished: boolean;
}

export interface StoredAnalyticsEvent {
  id: string;
  slug: string;
  type: AnalyticsEventType;
  visitorHash: string; // Salted SHA-256 daily rotating hash (no IP stored)
  referrerSource: string; // Cleaned domain or category (e.g., 'LinkedIn', 'GitHub', 'Direct')
  targetLabel?: string;
  createdAt: string; // ISO 8601
}
