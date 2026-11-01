'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ContactSubmission, ContactSubmissionStatus } from '@/lib/contact/types';
import { Icon } from '@/components/icon';

export function AccountInbox() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContactSubmissionStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/contact?status=${filter}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubmissions(data.submissions || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError(data.error || 'Failed to load inquiries');
      }
    } catch {
      setError('Network error loading messages');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const handleUpdateStatus = async (id: string, newStatus: ContactSubmissionStatus) => {
    setMutatingId(id);
    try {
      const res = await fetch('/api/portfolio/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        // Optimistically update
        setSubmissions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
        );
        if (newStatus === 'read') {
          setUnreadCount((c) => Math.max(0, c - 1));
        } else if (newStatus === 'unread') {
          setUnreadCount((c) => c + 1);
        }
      }
    } catch {
      // Ignore
    } finally {
      setMutatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    setMutatingId(id);
    try {
      const res = await fetch(`/api/portfolio/contact?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // Ignore
    } finally {
      setMutatingId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="account-inbox-section">
      <div className="inbox-header">
        <div className="inbox-title-wrap">
          <div className="inbox-badge">
            <span className="inbox-dot" />
            <span>Lead Capture</span>
          </div>
          <h2 className="inbox-title">
            Inquiries &amp; Messages
            {unreadCount > 0 && <span className="unread-counter-pill">{unreadCount} unread</span>}
          </h2>
          <p className="inbox-subtitle">
            Direct messages sent to your published portfolio via the contact form.
          </p>
        </div>

        <div className="inbox-filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({submissions.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'archived' ? 'active' : ''}`}
            onClick={() => setFilter('archived')}
          >
            Archived
          </button>
        </div>
      </div>

      {loading ? (
        <div className="inbox-loading">
          <span className="inbox-spinner" />
          <span>Loading inquiries...</span>
        </div>
      ) : error ? (
        <div className="inbox-error">
          <Icon name="close" size={16} />
          <span>{error}</span>
          <button type="button" className="retry-btn" onClick={fetchInbox}>
            Retry
          </button>
        </div>
      ) : submissions.length === 0 ? (
        <div className="inbox-empty-state">
          <div className="inbox-empty-icon">✉</div>
          <h3>No inquiries found</h3>
          <p>
            {filter === 'all'
              ? 'When visitors and recruiters send messages through your published portfolio, they will appear here.'
              : `No messages currently matching the "${filter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="inbox-list">
          {submissions.map((sub) => {
            const isUnread = sub.status === 'unread';
            const isArchived = sub.status === 'archived';
            const isExpanded = expandedId === sub.id;

            return (
              <div
                key={sub.id}
                className={`inbox-card ${isUnread ? 'is-unread' : ''} ${isArchived ? 'is-archived' : ''}`}
              >
                <div
                  className="inbox-card-header"
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setExpandedId(isExpanded ? null : sub.id);
                    }
                  }}
                >
                  <div className="inbox-sender-avatar">
                    {sub.senderName ? sub.senderName[0].toUpperCase() : '?'}
                  </div>
                  <div className="inbox-meta-primary">
                    <div className="inbox-sender-row">
                      <span className="sender-name">{sub.senderName}</span>
                      <span className="sender-email">&lt;{sub.senderEmail}&gt;</span>
                      {isUnread && <span className="status-pill unread">New</span>}
                      {isArchived && <span className="status-pill archived">Archived</span>}
                    </div>
                    <div className="inbox-subject-preview">
                      <strong>{sub.subject ? `${sub.subject} — ` : ''}</strong>
                      <span className="message-snippet">{sub.message}</span>
                    </div>
                  </div>
                  <div className="inbox-meta-secondary">
                    <span className="inbox-timestamp">{formatDate(sub.createdAt)}</span>
                    <span className="expand-indicator">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="inbox-card-body">
                    <div className="inbox-full-message">
                      <p>{sub.message}</p>
                    </div>

                    <div className="inbox-actions-row">
                      <a
                        href={`mailto:${sub.senderEmail}?subject=${encodeURIComponent(
                          sub.subject ? `Re: ${sub.subject}` : 'Re: Portfolio Inquiry'
                        )}`}
                        className="inbox-action-btn primary"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ✉ Reply via Email
                      </a>

                      {isUnread ? (
                        <button
                          type="button"
                          className="inbox-action-btn secondary"
                          disabled={mutatingId === sub.id}
                          onClick={() => handleUpdateStatus(sub.id, 'read')}
                        >
                          Mark as Read
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inbox-action-btn secondary"
                          disabled={mutatingId === sub.id}
                          onClick={() => handleUpdateStatus(sub.id, 'unread')}
                        >
                          Mark as Unread
                        </button>
                      )}

                      {!isArchived ? (
                        <button
                          type="button"
                          className="inbox-action-btn secondary"
                          disabled={mutatingId === sub.id}
                          onClick={() => handleUpdateStatus(sub.id, 'archived')}
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inbox-action-btn secondary"
                          disabled={mutatingId === sub.id}
                          onClick={() => handleUpdateStatus(sub.id, 'read')}
                        >
                          Unarchive
                        </button>
                      )}

                      <button
                        type="button"
                        className="inbox-action-btn danger"
                        disabled={mutatingId === sub.id}
                        onClick={() => handleDelete(sub.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .account-inbox-section {
          margin-top: 0;
          padding: clamp(22px, 3.2vw, 32px);
          background: var(--surface, #ffffff);
          border: 1px solid rgba(49, 65, 54, 0.11);
          border-radius: 14px;
          box-shadow: var(--shadow-soft);
          font-family: inherit;
        }
        .inbox-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line, #e2e8f0);
        }
        .inbox-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent, #365d4a);
          background: rgba(54, 93, 74, 0.1);
          padding: 4px 10px;
          border-radius: 99px;
          margin-bottom: 8px;
        }
        .inbox-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent, #365d4a);
        }
        .inbox-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 750;
          color: var(--ink, #1a202c);
          margin-bottom: 4px;
        }
        .unread-counter-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          background: #ef4444;
          color: #ffffff;
          border-radius: 99px;
          text-transform: uppercase;
        }
        .inbox-subtitle {
          font-size: 14px;
          color: var(--muted, #64748b);
        }
        .inbox-filter-tabs {
          display: flex;
          gap: 6px;
          background: var(--bg, #f1f5f9);
          padding: 4px;
          border-radius: 8px;
        }
        .filter-tab {
          padding: 6px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--muted, #64748b);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-tab.active {
          background: var(--surface, #ffffff);
          color: var(--ink, #0f172a);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .inbox-loading,
        .inbox-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          text-align: center;
          color: var(--muted, #64748b);
        }
        .inbox-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(54, 93, 74, 0.08);
          color: var(--accent, #365d4a);
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .inbox-empty-state h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--ink, #1e293b);
          margin-bottom: 6px;
        }
        .inbox-empty-state p {
          font-size: 13px;
          max-width: 400px;
          line-height: 1.5;
        }
        .inbox-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .inbox-card {
          border: 1px solid var(--line, #e2e8f0);
          border-radius: 8px;
          background: var(--surface, #ffffff);
          transition: all 0.15s ease;
        }
        .inbox-card.is-unread {
          border-left: 4px solid var(--accent, #365d4a);
          background: rgba(54, 93, 74, 0.02);
        }
        .inbox-card.is-archived {
          opacity: 0.7;
        }
        .inbox-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          cursor: pointer;
        }
        .inbox-sender-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(54, 93, 74, 0.12);
          color: var(--accent, #365d4a);
          font-weight: 750;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
        }
        .inbox-meta-primary {
          flex: 1;
          min-width: 0;
        }
        .inbox-sender-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 3px;
          flex-wrap: wrap;
        }
        .sender-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--ink, #0f172a);
        }
        .sender-email {
          font-size: 12px;
          color: var(--muted, #64748b);
        }
        .status-pill {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 99px;
          text-transform: uppercase;
        }
        .status-pill.unread {
          background: #dcfce7;
          color: #15803d;
        }
        .status-pill.archived {
          background: #f1f5f9;
          color: #64748b;
        }
        .inbox-subject-preview {
          font-size: 13px;
          color: var(--ink, #334155);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .message-snippet {
          color: var(--muted, #64748b);
        }
        .inbox-meta-secondary {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .inbox-timestamp {
          font-size: 12px;
          color: var(--muted, #94a3b8);
        }
        .expand-indicator {
          font-size: 10px;
          color: var(--muted, #94a3b8);
        }
        .inbox-card-body {
          padding: 16px 18px 18px;
          border-top: 1px solid var(--line, #e2e8f0);
          background: var(--bg, #f8fafc);
        }
        .inbox-full-message {
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink, #1e293b);
          margin-bottom: 16px;
          white-space: pre-wrap;
        }
        .inbox-actions-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .inbox-action-btn {
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .inbox-action-btn.primary {
          background: var(--accent, #365d4a);
          color: #ffffff;
          border: none;
        }
        .inbox-action-btn.secondary {
          background: var(--surface, #ffffff);
          border: 1px solid var(--line, #cbd5e1);
          color: var(--ink, #334155);
        }
        .inbox-action-btn.danger {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}
