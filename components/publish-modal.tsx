'use client';

import { useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '@/components/icon';
import { suggestSlug, validateSlug } from '@/lib/publishing/slug';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ShareModal } from '@/components/share-modal';
import type { DesignConfig, ProfileDocument } from '@/lib/profile-schema';
import type { PublishResult } from '@/lib/publishing/types';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: ProfileDocument;
  design: DesignConfig;
  isPublished: boolean;
  publishedSlug: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  onPublicationChange: (status: {
    isPublished: boolean;
    slug: string | null;
    publishedAt: string | null;
    url: string | null;
    hasUnpublishedChanges: boolean;
    publishedProfile?: ProfileDocument;
    publishedDesign?: DesignConfig;
  }) => void;
  onToast: (message: string) => void;
  onSignIn: () => void;
}

export function PublishModal({
  isOpen,
  onClose,
  user,
  profile,
  design,
  isPublished,
  publishedSlug,
  publishedAt,
  hasUnpublishedChanges,
  onPublicationChange,
  onToast,
  onSignIn,
}: PublishModalProps) {
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ url: string; slug: string } | null>(null);
  const [localDevUserId, setLocalDevUserId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const prevOpenRef = useRef(false);

  // Initialize slug and state on open
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setErrorMessage(null);
      setSuccessInfo(null);
      setConfirmingUnpublish(false);
      if (publishedSlug) {
        setSlug(publishedSlug);
      } else {
        setSlug(suggestSlug(profile.basics.name));
      }
      setSlugTouched(false);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, publishedSlug, profile.basics.name]);

  // Handle Escape key to safely close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !unpublishing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, unpublishing, onClose]);

  if (!isOpen) return null;

  const effectiveUser = user || (localDevUserId ? { id: localDevUserId, email: `${localDevUserId}@test.local` } as User : null);
  const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const isDevMode = process.env.NODE_ENV !== 'production';

  const slugValidation = validateSlug(slug);
  const isSlugChanged = isPublished && publishedSlug && slug !== publishedSlug && slugValidation.ok;

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
    const devId = user?.id || localDevUserId || (typeof window !== 'undefined' ? window.sessionStorage.getItem('folio_dev_user') : null);
    if (devId) {
      return {
        Authorization: `Bearer test-${devId}`,
        'x-folio-test-user-id': devId,
      };
    }
    return {};
  }

  const handlePublish = async () => {
    if (!profile.basics.name.trim()) {
      setErrorMessage('Please add your name in the About step before publishing.');
      return;
    }

    if (!slugValidation.ok) {
      setErrorMessage(slugValidation.error);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('You appear to be offline. Your draft is safe. Please check your connection and try again.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/portfolio/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          slug: slugValidation.slug,
          profile,
          design,
        }),
      });

      const data: PublishResult = await res.json();

      if (!res.ok || !data.ok) {
        if (res.status === 401 || (data as { code?: string }).code === 'unauthenticated') {
          setErrorMessage('Your session has expired or sign-in is required. Please sign in to publish.');
        } else if (res.status === 409 || (data as { code?: string }).code === 'slug_taken') {
          setErrorMessage(`The web address “/p/${slugValidation.slug}” is already taken by another user. Please choose a different address.`);
        } else {
          setErrorMessage(data.ok ? 'Failed to publish portfolio.' : data.error);
        }
        return;
      }

      setSuccessInfo({ url: data.url, slug: data.slug });
      onPublicationChange({
        isPublished: true,
        slug: data.slug,
        publishedAt: data.publishedAt,
        url: data.url,
        hasUnpublishedChanges: false,
        publishedProfile: profile,
        publishedDesign: design,
      });
      onToast('Portfolio published successfully!');
    } catch {
      setErrorMessage('A network error occurred while publishing. Your draft is safe. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('You appear to be offline. Please check your connection and try again.');
      return;
    }

    setUnpublishing(true);
    setErrorMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/portfolio/unpublish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 401 || data.code === 'unauthenticated') {
          setErrorMessage('Your session has expired. Please sign in to manage your portfolio.');
        } else {
          setErrorMessage(data.error || 'Failed to unpublish portfolio.');
        }
        return;
      }

      onPublicationChange({
        isPublished: false,
        slug: null,
        publishedAt: null,
        url: null,
        hasUnpublishedChanges: false,
      });
      onToast('Your portfolio has been unpublished and is no longer public.');
      onClose();
    } catch {
      setErrorMessage('A network error occurred while unpublishing. Please check your connection and try again.');
    } finally {
      setUnpublishing(false);
    }
  };

  const copyLiveLink = (url: string) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        onToast('Link copied to clipboard!');
      });
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting && !unpublishing) {
          onClose();
        }
      }}
    >
      <div
        className="modal publish-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
      >
        <div className="modal-icon">
          <Icon name="globe" size={18} />
        </div>

        {/* 1. Unauthenticated state */}
        {!effectiveUser ? (
          <>
            <h2 id="publish-dialog-title">Publish your portfolio</h2>
            <p>
              Publishing gives your portfolio a permanent address on the web. An account is required so only you can make updates or unpublish it.
            </p>
            <div className="modal-note">
              Your draft is saved on this device. Once you sign in, your draft will be saved to your account and ready to publish.
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="button secondary small" type="button" onClick={onClose}>
                Keep editing
              </button>
              {isSupabaseConfigured && (
                <button
                  className="button small"
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                >
                  Sign in to publish <Icon name="arrow" size={12} />
                </button>
              )}
              {isDevMode && (
                <button
                  className={isSupabaseConfigured ? 'button secondary small' : 'button small'}
                  type="button"
                  onClick={async () => {
                    const supabase = getSupabaseBrowserClient();
                    if (supabase) {
                      try {
                        const res = await fetch('/api/auth/dev-login', { method: 'POST' });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.ok && data.email && data.password) {
                            const { error } = await supabase.auth.signInWithPassword({
                              email: data.email,
                              password: data.password,
                            });
                            if (!error) return;
                          }
                        }
                      } catch {
                        // Fall through to local fallback
                      }
                    }
                    const devId = `dev-${Date.now().toString(36)}`;
                    setLocalDevUserId(devId);
                    if (typeof window !== 'undefined') {
                      window.sessionStorage.setItem('folio_dev_user', devId);
                    }
                  }}
                >
                  Continue with Dev Account <Icon name="arrow" size={12} />
                </button>
              )}
              {!isSupabaseConfigured && !isDevMode && (
                <button className="button small" type="button" disabled>
                  Sign in unavailable
                </button>
              )}
            </div>
          </>
        ) : confirmingUnpublish ? (
          /* 2. Explicit Unpublish Confirmation State */
          <>
            <h2 id="publish-dialog-title" style={{ color: '#b0351f' }}>Unpublish your portfolio?</h2>
            <p>
              Taking your portfolio offline will make <strong>/p/{publishedSlug}</strong> return a 404 page.
            </p>
            <div className="modal-note" style={{ background: '#fff4f2', border: '1px solid #f6c0b8', color: '#8a2c1a' }}>
              Your draft in the studio will be preserved intact. You can republish anytime with your latest edits.
            </div>

            {errorMessage && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 10px',
                  background: '#fff0ee',
                  border: '1px solid #f6c0b8',
                  borderRadius: '6px',
                  color: '#b0351f',
                  fontSize: '11px',
                }}
              >
                {errorMessage}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                className="button secondary small"
                type="button"
                disabled={unpublishing}
                onClick={() => setConfirmingUnpublish(false)}
              >
                Keep live
              </button>
              <button
                className="button small"
                type="button"
                disabled={unpublishing}
                onClick={handleUnpublish}
                style={{ background: '#b0351f', borderColor: '#b0351f' }}
              >
                {unpublishing ? 'Unpublishing…' : 'Yes, unpublish'}
              </button>
            </div>
          </>
        ) : successInfo ? (
          /* 3. Success state immediately after publishing */
          <>
            <h2 id="publish-dialog-title">Your portfolio is live!</h2>
            <p>
              Your portfolio is published and accessible worldwide at:
            </p>
            <div
              style={{
                marginTop: '12px',
                marginBottom: '16px',
                padding: '12px 14px',
                background: '#f4f7f3',
                border: '1px solid #d8e5d6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <a
                href={successInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontWeight: 600,
                  color: '#2d6a4f',
                  textDecoration: 'none',
                  fontSize: '13px',
                }}
              >
                /p/{successInfo.slug} <span aria-hidden="true">↗</span>
              </a>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="button secondary small"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => copyLiveLink(successInfo.url)}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  className="button small"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setShareModalOpen(true)}
                >
                  Share &amp; QR
                </button>
              </div>
            </div>
            <p className="modal-note">
              Future edits to your draft will remain private until you click &ldquo;Publish updates&rdquo; again.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="button secondary small"
                onClick={() => setShareModalOpen(true)}
              >
                Share &amp; QR Code
              </button>
              <button className="button small" type="button" onClick={onClose}>
                Done <Icon name="check" size={12} />
              </button>
            </div>
            {successInfo && (
              <ShareModal
                isOpen={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                slug={successInfo.slug}
                name={profile.basics.name}
                role={profile.basics.role}
              />
            )}
          </>
        ) : (
          /* 4. Authenticated owner publishing / managing form */
          <>
            <h2 id="publish-dialog-title">
              {isPublished ? 'Update published portfolio' : 'Publish your portfolio'}
            </h2>
            <p>
              {isPublished
                ? 'Your portfolio is currently published. You can publish your latest draft updates or adjust your address.'
                : 'Choose a web address for your public portfolio. Anyone with this link will be able to view your portfolio.'}
            </p>

            <div style={{ marginTop: '16px' }}>
              <label
                htmlFor="publish-slug-input"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
              >
                Portfolio address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: `1px solid ${slugTouched && !slugValidation.ok ? '#c94a29' : '#dfe4dc'}`,
                  borderRadius: '7px',
                  background: '#fff',
                  padding: '0 10px',
                  height: '38px',
                }}
              >
                <span
                  style={{
                    color: '#59655c',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                  }}
                >
                  /p/
                </span>
                <input
                  id="publish-slug-input"
                  type="text"
                  value={slug}
                  disabled={submitting}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().trim());
                    setSlugTouched(true);
                  }}
                  placeholder="your-name"
                  style={{
                    border: 'none',
                    outline: 'none',
                    padding: '6px 8px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    width: '100%',
                    background: 'transparent',
                  }}
                />
              </div>
              {slugTouched && !slugValidation.ok && (
                <div style={{ color: '#c94a29', fontSize: '11px', marginTop: '4px' }}>
                  {slugValidation.error}
                </div>
              )}
              {isSlugChanged && (
                <div style={{ color: '#9c6615', fontSize: '11px', marginTop: '4px' }}>
                  Notice: Publishing will move your portfolio to /p/{slug}. The previous address /p/{publishedSlug} will no longer be active.
                </div>
              )}
            </div>

            {isPublished && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 12px',
                  background: hasUnpublishedChanges ? '#fffbf0' : '#f4f7f3',
                  border: `1px solid ${hasUnpublishedChanges ? '#eed9a8' : '#d8e5d6'}`,
                  borderRadius: '7px',
                  fontSize: '11px',
                  color: hasUnpublishedChanges ? '#825b18' : '#2d6a4f',
                }}
              >
                {hasUnpublishedChanges ? (
                  <span>
                    <strong>Unpublished changes in draft:</strong> Your live site has not been updated with your latest changes yet.
                  </span>
                ) : (
                  <span>
                    <strong>Live &amp; up to date:</strong> Your public site matches your current draft.
                  </span>
                )}
                {publishedSlug && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '12px' }}>
                    <a
                      href={`/p/${publishedSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', fontWeight: 600 }}
                    >
                      View live portfolio ↗
                    </a>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}
                      onClick={() => copyLiveLink(`/p/${publishedSlug}`)}
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 10px',
                  background: '#fff0ee',
                  border: '1px solid #f6c0b8',
                  borderRadius: '6px',
                  color: '#b0351f',
                  fontSize: '11px',
                }}
              >
                {errorMessage}
              </div>
            )}

            <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '22px' }}>
              <div>
                {isPublished && (
                  <button
                    className="button subtle small"
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmingUnpublish(true)}
                    style={{ color: '#b0351f' }}
                  >
                    Unpublish
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="button secondary small"
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="button small"
                  type="button"
                  onClick={handlePublish}
                  disabled={submitting || (slugTouched && !slugValidation.ok)}
                >
                  {submitting
                    ? 'Publishing…'
                    : isPublished
                    ? hasUnpublishedChanges
                      ? 'Publish updates'
                      : 'Republish'
                    : 'Publish now'}{' '}
                  <Icon name="arrow" size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
