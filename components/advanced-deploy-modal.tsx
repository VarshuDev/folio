'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '@/components/icon';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { ProfileDocument } from '@/lib/profile-schema';
import type { PortfolioConfig } from '@/lib/portfolio-mode';
import type { ClientDeploymentStatus } from '@/lib/integrations/vercel/deployment-types';

interface AdvancedDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  profile: ProfileDocument;
  portfolioConfig: PortfolioConfig;
  onToast: (message: string) => void;
  onSignIn: () => void;
}

export function AdvancedDeployModal({
  isOpen,
  onClose,
  user,
  profile,
  portfolioConfig,
  onToast,
  onSignIn,
}: AdvancedDeployModalProps) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [deployment, setDeployment] = useState<ClientDeploymentStatus | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showTokenInput, setShowTokenInput] = useState(false);
  const [modalToken, setModalToken] = useState('');
  const [modalTeamId, setModalTeamId] = useState('');
  const [connectingModalToken, setConnectingModalToken] = useState(false);
  const [modalTokenError, setModalTokenError] = useState<string | null>(null);

  const prevOpenRef = useRef(false);
  const pollIntervalRef = useRef<number | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    }
    const devId = typeof window !== 'undefined' ? window.sessionStorage.getItem('folio_dev_user') : null;
    if (devId) {
      return {
        Authorization: `Bearer test-${devId}`,
        'x-folio-test-user-id': devId,
      };
    }
    return {};
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;

      // Check Vercel connection
      const connRes = await fetch('/api/integrations/vercel/status', { headers });
      if (connRes.ok) {
        const connData = await connRes.json();
        setConnected(Boolean(connData.connected));
        setAccountName(connData.teamName || connData.accountName || null);
      }

      // Check latest deployment status
      const depRes = await fetch('/api/portfolio/advanced/deployment', { headers });
      if (depRes.ok) {
        const depData = await depRes.json();
        if (depData.ok && depData.deployment) {
          setDeployment(depData.deployment);
          if (['building', 'queued', 'uploading', 'deploying'].includes(depData.deployment.status)) {
            setDeploying(true);
          } else {
            setDeploying(false);
          }
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingStatus(false);
    }
  }, [getAuthHeaders]);

  // Initial fetch when opened
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setErrorMessage(null);
      setLoadingStatus(true);
      fetchStatus();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, fetchStatus]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deploying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, deploying, onClose]);

  // Polling loop while deploying
  useEffect(() => {
    if (deploying && isOpen) {
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch('/api/portfolio/advanced/deployment', { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.deployment) {
              setDeployment(data.deployment);
              if (data.deployment.status === 'ready') {
                setDeploying(false);
                onToast('Portfolio deployed successfully!');
              } else if (data.deployment.status === 'error' || data.deployment.status === 'canceled') {
                setDeploying(false);
                setErrorMessage(data.deployment.error || 'Deployment failed on Vercel.');
              }
            }
          }
        } catch {
          // Keep polling
        }
      }, 3000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [deploying, isOpen, getAuthHeaders, onToast]);

  const handleConnectModalToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!modalToken.trim()) {
      setModalTokenError('Please enter a Vercel Personal Access Token.');
      return;
    }
    setConnectingModalToken(true);
    setModalTokenError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/integrations/vercel/token', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: modalToken.trim(),
          teamId: modalTeamId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setModalTokenError(data.error || 'Failed to connect Vercel token.');
        setConnectingModalToken(false);
        return;
      }
      setModalToken('');
      setModalTeamId('');
      setShowTokenInput(false);
      setConnected(true);
      setAccountName(data.teamName || data.accountName || 'Authorized Vercel Account');
      onToast(`Connected to ${data.teamName || data.accountName || 'Vercel'} successfully!`);
    } catch {
      setModalTokenError('Network error connecting Vercel token.');
    } finally {
      setConnectingModalToken(false);
    }
  };

  const handleStartDeploy = async () => {
    setErrorMessage(null);
    setDeploying(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/portfolio/advanced/deploy', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile,
          config: portfolioConfig,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setDeploying(false);
        setErrorMessage(data.error || 'Deployment failed to initialize.');
        return;
      }

      setDeployment({
        status: data.status,
        deploymentId: data.deploymentId,
        projectId: data.projectId,
        projectName: data.projectName,
        deploymentUrl: data.deploymentUrl,
        productionUrl: data.productionUrl,
      });

      if (data.status === 'ready') {
        setDeploying(false);
        onToast('Portfolio deployed successfully!');
      }
    } catch (err: unknown) {
      setDeploying(false);
      setErrorMessage(err instanceof Error ? err.message : 'Network error initiating deployment.');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    onToast('Portfolio URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-deploy-title"
      data-testid="advanced-deploy-modal"
    >
      <div className="modal-card" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <h2 id="advanced-deploy-title" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>▲</span> Deploy to Vercel
          </h2>
          <button
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            disabled={deploying}
            aria-label="Close modal"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {loadingStatus ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#59655c' }}>
              Checking Vercel integration status…
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ margin: '0 0 16px', color: '#333' }}>
                You must be signed in to Folio to deploy your portfolio.
              </p>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
              >
                Sign in to Folio
              </button>
            </div>
          ) : !connected ? (
            <div>
              <div
                style={{
                  padding: '16px',
                  background: '#f8faf9',
                  borderRadius: '8px',
                  border: '1px solid #e1e7e3',
                  marginBottom: '16px',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '6px', color: '#1a241e' }}>
                  Connect your Vercel account
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#59655c', lineHeight: 1.5 }}>
                  Folio deploys your Advanced multi-page portfolio directly to your Vercel account.
                  You can connect instantly with a Vercel Access Token or through Account settings.
                </p>
              </div>

              {showTokenInput ? (
                <form
                  onSubmit={handleConnectModalToken}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '14px',
                    background: '#ffffff',
                    border: '1px solid #d2ded5',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                  data-testid="modal-vercel-token-form"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#1a241e' }}>Paste Vercel Personal Access Token</strong>
                    <button
                      type="button"
                      className="button subtle small"
                      onClick={() => {
                        setShowTokenInput(false);
                        setModalTokenError(null);
                      }}
                      style={{ padding: '2px 8px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#59655c' }}>
                    Generate a token in your Vercel dashboard at{' '}
                    <a
                      href="https://vercel.com/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1b4d3e', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      vercel.com/account/tokens ↗
                    </a>
                  </p>

                  {modalTokenError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#fff4f2',
                        border: '1px solid #f6c0b8',
                        borderRadius: '6px',
                        color: '#8a2c1a',
                        fontSize: '12px',
                      }}
                      data-testid="modal-token-error"
                    >
                      {modalTokenError}
                    </div>
                  )}

                  <input
                    type="password"
                    className="input"
                    placeholder="Vercel Access Token"
                    value={modalToken}
                    onChange={(e) => {
                      setModalToken(e.target.value);
                      setModalTokenError(null);
                    }}
                    disabled={connectingModalToken}
                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}
                    data-testid="modal-vercel-token-input"
                  />

                  <input
                    type="text"
                    className="input"
                    placeholder="Team ID or Slug (optional)"
                    value={modalTeamId}
                    onChange={(e) => setModalTeamId(e.target.value)}
                    disabled={connectingModalToken}
                    style={{ fontSize: '13px' }}
                    data-testid="modal-vercel-team-input"
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => setShowTokenInput(false)}
                      disabled={connectingModalToken}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="button small"
                      disabled={connectingModalToken || !modalToken.trim()}
                      data-testid="modal-submit-token-btn"
                    >
                      {connectingModalToken ? 'Connecting…' : 'Connect & Continue'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="button secondary small" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => setShowTokenInput(true)}
                    data-testid="modal-toggle-token-btn"
                  >
                    Connect with Token
                  </button>
                  <a
                    href="/account"
                    className="button small"
                    data-testid="go-to-account-connect-btn"
                  >
                    Go to Account settings <Icon name="arrow" size={12} />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div>
              {errorMessage && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: '#fff4f2',
                    border: '1px solid #f6c0b8',
                    borderRadius: '8px',
                    color: '#8a2c1a',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                  data-testid="deploy-error-banner"
                >
                  <strong>Deployment error:</strong> {errorMessage}
                </div>
              )}

              {/* Status details */}
              <div
                style={{
                  background: '#f8faf9',
                  border: '1px solid #e1e7e3',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#59655c' }}>Vercel target</span>
                  <strong style={{ fontSize: '13px', color: '#1a241e' }}>
                    {accountName || 'Authorized Vercel Account'}
                  </strong>
                </div>

                {deployment?.projectName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#59655c' }}>Project name</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, monospace',
                        color: '#1a241e',
                        background: '#eef2ef',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      data-testid="deploy-project-name"
                    >
                      {deployment.projectName}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#59655c' }}>Deployment status</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background:
                        deployment?.status === 'ready'
                          ? '#e6f4ea'
                          : deploying || ['building', 'queued'].includes(deployment?.status || '')
                          ? '#fef7e0'
                          : deployment?.status === 'error'
                          ? '#fce8e6'
                          : '#e8eaed',
                      color:
                        deployment?.status === 'ready'
                          ? '#137333'
                          : deploying || ['building', 'queued'].includes(deployment?.status || '')
                          ? '#703800'
                          : deployment?.status === 'error'
                          ? '#c5221f'
                          : '#5f6368',
                    }}
                    data-testid="deploy-status-badge"
                  >
                    {deploying
                      ? 'Deploying to Vercel…'
                      : deployment?.status === 'ready'
                      ? '● Live / Ready'
                      : deployment?.status === 'error'
                      ? '✕ Failed'
                      : deployment?.status || 'Not deployed'}
                  </span>
                </div>
              </div>

              {/* Ready Live URL display */}
              {deployment?.productionUrl && (
                <div
                  style={{
                    padding: '14px',
                    background: '#f0f9f4',
                    border: '1px solid #c2e5d3',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                  data-testid="deploy-success-card"
                >
                  <span style={{ display: 'block', fontSize: '12px', color: '#1b633e', fontWeight: 600, marginBottom: '4px' }}>
                    Live Production URL
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <a
                      href={deployment.productionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--studio-evergreen)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                        fontSize: '14px',
                      }}
                      data-testid="live-vercel-url"
                    >
                      {deployment.productionUrl} ↗
                    </a>
                    <button
                      type="button"
                      className="button subtle small"
                      onClick={() => copyUrl(deployment.productionUrl!)}
                      style={{ padding: '2px 8px', fontSize: '12px' }}
                    >
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={onClose}
                  disabled={deploying}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="button small"
                  onClick={handleStartDeploy}
                  disabled={deploying}
                  data-testid="trigger-deploy-btn"
                >
                  {deploying
                    ? 'Deploying to Vercel…'
                    : deployment?.status === 'ready'
                    ? 'Redeploy updates'
                    : 'Deploy to Vercel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
