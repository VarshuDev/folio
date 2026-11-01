'use client';

import { useEffect } from 'react';

interface AnalyticsTrackerProps {
  slug: string;
}

export function AnalyticsTracker({ slug }: AnalyticsTrackerProps) {
  useEffect(() => {
    if (!slug || typeof window === 'undefined') return;

    // 1. Record Page View (non-blocking)
    const payload = JSON.stringify({
      slug,
      type: 'view',
      referrer: document.referrer || null,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/event', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }

    // 2. Track Outbound Links & Resume Clicks
    const handleLinkClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      let actionLabel = '';
      const href = target.href.toLowerCase();

      if (href.startsWith('mailto:')) {
        actionLabel = 'Email Contact';
      } else if (href.includes('github.com')) {
        actionLabel = 'GitHub Profile/Project';
      } else if (href.includes('linkedin.com')) {
        actionLabel = 'LinkedIn Link';
      } else if (href.endsWith('.pdf') || target.hasAttribute('download')) {
        actionLabel = 'Resume / Document Download';
      } else if (target.host !== window.location.host) {
        actionLabel = `Outbound: ${target.hostname.replace(/^www\./, '')}`;
      }

      if (actionLabel) {
        const clickPayload = JSON.stringify({
          slug,
          type: 'click',
          targetLabel: actionLabel,
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/analytics/event',
            new Blob([clickPayload], { type: 'application/json' })
          );
        } else {
          fetch('/api/analytics/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: clickPayload,
            keepalive: true,
          }).catch(() => {});
        }
      }
    };

    document.addEventListener('click', handleLinkClick, { passive: true });
    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [slug]);

  return null;
}
