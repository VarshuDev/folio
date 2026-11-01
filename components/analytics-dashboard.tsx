'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/icon';
import type { PortfolioAnalyticsSummary } from '@/lib/analytics/types';

interface AnalyticsDashboardProps {
  slug?: string | null;
  isPublished?: boolean;
}

export function AnalyticsDashboard({ slug, isPublished = false }: AnalyticsDashboardProps) {
  const [summary, setSummary] = useState<PortfolioAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to load analytics.');
      }
    } catch {
      setError('Unable to load analytics metrics.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchAnalytics();
    }
  }, [slug, fetchAnalytics]);

  if (!slug) {
    return (
      <section className="account-card analytics-card" aria-label="Portfolio Analytics">
        <div className="account-card-header">
          <div className="account-card-header-left">
            <span className="account-card-eyebrow">PORTFOLIO VISITOR INSIGHTS</span>
            <h2 className="account-card-title">Live Analytics</h2>
          </div>
        </div>
        <div className="analytics-empty-state">
          <div className="analytics-empty-icon">
            <Icon name="globe" size={24} />
          </div>
          <h3>Publish your portfolio to view live traffic</h3>
          <p>Once your portfolio is published, cookieless visitor stats, top referrers, and outbound link clicks will appear here.</p>
        </div>
      </section>
    );
  }

  const totalViews = summary?.totalViews ?? 0;
  const uniqueVisitors = summary?.uniqueVisitors ?? 0;
  const totalClicks = summary?.totalClicks ?? 0;
  const engagementRate = uniqueVisitors > 0 ? Math.round((totalClicks / uniqueVisitors) * 100) : 0;
  const referrers = summary?.referrers ?? [];
  const topActions = summary?.topActions ?? [];
  const daily = summary?.daily ?? [];

  const maxDailyViews = Math.max(...daily.map((d) => d.views), 1);

  return (
    <section className="account-card analytics-card" aria-label="Portfolio Analytics">
      <div className="account-card-header">
        <div className="account-card-header-left">
          <span className="account-card-eyebrow">PORTFOLIO VISITOR INSIGHTS</span>
          <div className="analytics-title-row">
            <h2 className="account-card-title">Visitor Analytics</h2>
            <span className="analytics-live-tag">
              <span className="analytics-pulse-dot" /> Live Tracking Active
            </span>
          </div>
        </div>
        <button
          type="button"
          className="button secondary small analytics-refresh-btn"
          onClick={fetchAnalytics}
          disabled={loading}
          aria-label="Refresh analytics data"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="account-alert error">{error}</div>
      ) : (
        <>
          {/* 1. Core Stat Cards */}
          <div className="analytics-metrics-grid">
            <div className="analytics-metric-box">
              <span className="analytics-metric-label">
                <Icon name="eye" size={13} /> Total Page Views
              </span>
              <strong className="analytics-metric-num">{totalViews.toLocaleString()}</strong>
              <span className="analytics-metric-sub">Past 7 days</span>
            </div>

            <div className="analytics-metric-box">
              <span className="analytics-metric-label">
                <Icon name="user" size={13} /> Unique Visitors
              </span>
              <strong className="analytics-metric-num">{uniqueVisitors.toLocaleString()}</strong>
              <span className="analytics-metric-sub">Cookieless daily hashes</span>
            </div>

            <div className="analytics-metric-box">
              <span className="analytics-metric-label">
                <Icon name="external" size={13} /> Link &amp; Resume Clicks
              </span>
              <strong className="analytics-metric-num">{totalClicks.toLocaleString()}</strong>
              <span className="analytics-metric-sub">Outbound interactions</span>
            </div>

            <div className="analytics-metric-box">
              <span className="analytics-metric-label">
                <Icon name="spark" size={13} /> Engagement Rate
              </span>
              <strong className="analytics-metric-num">{engagementRate}%</strong>
              <span className="analytics-metric-sub">Clicks per visitor</span>
            </div>
          </div>

          {/* 2. Mini 7-Day View Trend */}
          {daily.length > 0 && (
            <div className="analytics-trend-section">
              <div className="analytics-section-header">
                <h4>7-Day Traffic Activity</h4>
                <span className="analytics-date-range">Last 7 days</span>
              </div>
              <div className="analytics-bar-chart" role="img" aria-label="Daily views chart for past 7 days">
                {daily.map((day) => {
                  const heightPercent = Math.max(Math.round((day.views / maxDailyViews) * 100), 8);
                  const dayName = new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'short',
                    timeZone: 'UTC',
                  });
                  return (
                    <div className="analytics-chart-col" key={day.date}>
                      <div className="analytics-bar-track">
                        <div
                          className="analytics-bar-fill"
                          style={{ height: `${heightPercent}%` }}
                          title={`${day.date}: ${day.views} views (${day.uniqueVisitors} unique)`}
                        />
                      </div>
                      <span className="analytics-chart-day">{dayName}</span>
                      <span className="analytics-chart-val">{day.views}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Traffic Sources & Actions Breakdown */}
          <div className="analytics-breakdown-grid">
            {/* Referrers */}
            <div className="analytics-breakdown-card">
              <h4 className="analytics-breakdown-heading">
                <Icon name="globe" size={13} /> Top Traffic Sources
              </h4>
              {referrers.length === 0 ? (
                <p className="analytics-quiet-hint">No external referrals recorded yet.</p>
              ) : (
                <ul className="analytics-source-list">
                  {referrers.slice(0, 5).map((ref) => (
                    <li key={ref.source} className="analytics-source-item">
                      <div className="analytics-source-row">
                        <span className="analytics-source-name">{ref.source}</span>
                        <span className="analytics-source-count">
                          {ref.count} <small>({ref.percentage}%)</small>
                        </span>
                      </div>
                      <div className="analytics-source-bar-track">
                        <div
                          className="analytics-source-bar-fill"
                          style={{ width: `${Math.min(ref.percentage, 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Outbound Actions */}
            <div className="analytics-breakdown-card">
              <h4 className="analytics-breakdown-heading">
                <Icon name="arrow" size={13} /> Outbound Link Interactions
              </h4>
              {topActions.length === 0 ? (
                <p className="analytics-quiet-hint">No link clicks recorded yet.</p>
              ) : (
                <ul className="analytics-action-list">
                  {topActions.slice(0, 5).map((action) => (
                    <li key={action.label} className="analytics-action-item">
                      <span className="analytics-action-label">{action.label}</span>
                      <span className="analytics-action-count">{action.count} clicks</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 4. Privacy Pledge Banner */}
          <div className="analytics-privacy-banner">
            <div className="analytics-privacy-icon">
              <Icon name="lock" size={14} />
            </div>
            <div className="analytics-privacy-text">
              <strong>100% Privacy-First &amp; Cookieless</strong>
              <p>
                Folio never uses tracking cookies, fingerprinting, or cross-site identifiers. Visitor hashes rotate daily and IP addresses are strictly never stored. Fully compliant with GDPR, CCPA, and PECR.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
