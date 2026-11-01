'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '@/components/icon';
import { PublishModal } from '@/components/publish-modal';
import { AdvancedDeployModal } from '@/components/advanced-deploy-modal';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { AccountInbox } from '@/components/account-inbox';
import { ShareModal } from '@/components/share-modal';
import { loadLocalDraft, saveLocalDraft } from '@/lib/local-draft';
import {
  createDefaultDesign,
  createEmptyProfile,
  type DesignConfig,
  type ProfileDocument,
  type PortfolioConfig,
} from '@/lib/profile-schema';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { loadRemoteDraft, saveRemoteDraft } from '@/lib/supabase/profile-repository';
import { getTemplateMeta } from '@/lib/template-catalog';
import type { VercelConnectionStatus } from '@/lib/integrations/vercel/types';
import type { ClientDeploymentStatus } from '@/lib/integrations/vercel/deployment-types';

type AccountData = {
  user: {
    userId: string;
    email: string | null;
  };
  portfolio: {
    title: string;
    templateId: string;
    templateName: string;
    mode?: 'simple' | 'advanced';
    activePagesCount?: number;
    totalPagesCount?: number;
    isPublished: boolean;
    slug: string | null;
    url: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
    hasUnpublishedChanges: boolean;
  };
  draft: {
    profile: ProfileDocument;
    design: DesignConfig;
    portfolioConfig?: PortfolioConfig;
    updatedAt: string;
  } | null;
};

type CreditData = {
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
};

export function AccountView() {
  const [authReady, setAuthReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [localDevUserId, setLocalDevUserId] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  // Vercel Integration State
  const [vercelStatus, setVercelStatus] = useState<VercelConnectionStatus | null>(null);
  const [vercelLoading, setVercelLoading] = useState(false);
  const [connectingVercel, setConnectingVercel] = useState(false);
  const [confirmingDisconnectVercel, setConfirmingDisconnectVercel] = useState(false);
  const [disconnectingVercel, setDisconnectingVercel] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<ClientDeploymentStatus | null>(null);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [showTokenConnect, setShowTokenConnect] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenTeamId, setTokenTeamId] = useState('');
  const [connectingToken, setConnectingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Local active portfolio draft state for publishing/editing
  const [activeProfile, setActiveProfile] = useState<ProfileDocument>(createEmptyProfile());
  const [activeDesign, setActiveDesign] = useState<DesignConfig>(createDefaultDesign());
  const [activePortfolioConfig, setActivePortfolioConfig] = useState<PortfolioConfig>({ mode: 'simple' });
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [devLoginLoading, setDevLoginLoading] = useState(false);

  const notify = (msg: string) => setToastMessage(msg);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      setIsOffline(!window.navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const effectiveUser = mounted
    ? (user || (localDevUserId ? ({ id: localDevUserId, email: `${localDevUserId}@test.local` } as User) : null))
    : null;
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const isDevMode = process.env.NODE_ENV !== 'production';

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    }
    const devId = localDevUserId || (typeof window !== 'undefined' ? window.sessionStorage.getItem('folio_dev_user') : null);
    if (devId) {
      return {
        Authorization: `Bearer test-${devId}`,
        'x-folio-test-user-id': devId,
      };
    }
    return {};
  }, [localDevUserId]);

  const fetchDeploymentStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      const res = await fetch('/api/portfolio/advanced/deployment', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.deployment) {
          setDeploymentStatus(data.deployment);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [getAuthHeaders]);

  const fetchVercelStatus = useCallback(async () => {
    setVercelLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setVercelStatus(null);
        setDeploymentStatus(null);
        return;
      }
      const res = await fetch('/api/integrations/vercel/status', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setVercelStatus({
            connected: data.connected,
            accountName: data.accountName,
            teamName: data.teamName,
            teamId: data.teamId,
            configurationId: data.configurationId,
            connectedAt: data.connectedAt,
          });
          if (data.connected) {
            await fetchDeploymentStatus();
          }
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setVercelLoading(false);
    }
  }, [getAuthHeaders, fetchDeploymentStatus]);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    // First load local draft as foundation
    const local = loadLocalDraft();
    if (local) {
      setActiveProfile(local.profile);
      setActiveDesign(local.design);
      if (local.portfolioConfig) {
        setActivePortfolioConfig(local.portfolioConfig);
      }
    }

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setAccountData(null);
        setVercelStatus(null);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/portfolio/account', {
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Session expired or unauthenticated
          setUser(null);
          setAccountData(null);
          setVercelStatus(null);
          setErrorMessage('Your session has expired. Please sign in again.');
        } else {
          setErrorMessage('Unable to load account information. Please try again.');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setAccountData(data);

        // Reconcile draft: If local draft is newer, keep local; else hydrate with cloud draft
        if (data.draft) {
          if (!local || Date.parse(data.draft.updatedAt) > Date.parse(local.updatedAt)) {
            setActiveProfile(data.draft.profile);
            setActiveDesign(data.draft.design);
            if (data.draft.portfolioConfig) {
              setActivePortfolioConfig(data.draft.portfolioConfig);
            }
            saveLocalDraft(data.draft);
          }
        }

        // Fetch dev credits
        try {
          const creditRes = await fetch('/api/credits', { headers });
          if (creditRes.ok) {
            const creditJson = await creditRes.json();
            if (creditJson.ok) {
              setCreditData({
                balance: creditJson.account.balance,
                lifetimeGranted: creditJson.account.lifetimeGranted,
                lifetimeUsed: creditJson.account.lifetimeUsed,
                transactions: creditJson.transactions || [],
              });
            }
          }
        } catch {
          // Dev credits fetch is non-blocking
        }

        // Fetch Vercel integration status
        void fetchVercelStatus();
      }
    } catch {
      setErrorMessage('Network error while connecting to account service. Your local draft is safe.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, fetchVercelStatus]);

  useEffect(() => {
    setMounted(true);
    // Check local storage for dev session in non-production
    if (typeof window !== 'undefined') {
      const savedDevUser = window.sessionStorage.getItem('folio_dev_user');
      if (savedDevUser) {
        setLocalDevUserId(savedDevUser);
      }
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authReady) {
      void fetchAccount();
    }
  }, [authReady, fetchAccount]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('vercel_connected') === '1') {
        notify('Vercel account connected successfully!');
        params.delete('vercel_connected');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
        void fetchVercelStatus();
      } else if (params.has('vercel_error')) {
        const err = params.get('vercel_error');
        notify(`Vercel connection error: ${err}`);
        params.delete('vercel_error');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [fetchVercelStatus]);

  const handleSignIn = async () => {
    setOauthError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (isDevMode) {
        return handleDevSignIn();
      }
      notify('Supabase is not configured. Add environment variables to enable sign-in.');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined },
    });
    if (error) {
      if (
        error.message.includes('Unsupported provider') ||
        error.message.includes('provider is not enabled') ||
        error.message.includes('validation_failed')
      ) {
        setOauthError(
          'Google Sign-In is not enabled in your Supabase project dashboard yet. You can enable it in Supabase under Authentication → Providers → Google, or use Instant Dev Sign-In or Email Sign-In below.'
        );
      } else {
        notify(`Sign-in failed: ${error.message}`);
      }
    }
  };

  const handleDevSignIn = async () => {
    setDevLoginLoading(true);
    setOauthError(null);
    const supabase = getSupabaseBrowserClient();

    if (supabase) {
      try {
        const res = await fetch('/api/auth/dev-login', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.email && data.password) {
            const { data: signInData, error } = await supabase.auth.signInWithPassword({
              email: data.email,
              password: data.password,
            });
            if (!error && signInData.session) {
              setUser(signInData.session.user);
              notify('Signed in with Supabase Dev Account.');
              void fetchAccount();
              setDevLoginLoading(false);
              return;
            }
          }
        }
      } catch {
        // Fallback to local session storage below
      }
    }

    const devId = `dev-${Date.now().toString(36)}`;
    setLocalDevUserId(devId);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('folio_dev_user', devId);
    }
    notify('Signed in with local test account.');
    const local = loadLocalDraft();
    if (local) {
      void fetch('/api/portfolio/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer test-${devId}`,
          'x-folio-test-user-id': devId,
        },
        body: JSON.stringify(local),
      }).then(() => {
        void fetchAccount();
      });
    } else {
      void fetchAccount();
    }
    setDevLoginLoading(false);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setEmailSending(true);
    setOauthError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        notify('Supabase is not configured.');
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined,
        },
      });
      if (error) {
        notify(`Email sign-in failed: ${error.message}`);
      } else {
        setEmailSent(true);
        notify('Check your email for the magic sign-in link!');
      }
    } catch {
      notify('Failed to send sign-in link.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      // no-op
    } else {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('folio_dev_user');
    }
    setUser(null);
    setLocalDevUserId(null);
    setAccountData(null);
    setCreditData(null);
    setVercelStatus(null);
    notify('You have been signed out. Your local draft remains safe.');
  };

  const handleConnectVercel = async (flow?: 'integration' | 'oauth') => {
    if (isOffline) {
      notify('You are offline. Please reconnect to link your Vercel account.');
      return;
    }
    setConnectingVercel(true);
    try {
      const headers = await getAuthHeaders();
      const query = flow ? `?flow=${flow}` : '';
      const res = await fetch(`/api/integrations/vercel/connect${query}`, { headers });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Failed to initiate Vercel connection.');
        setConnectingVercel(false);
        return;
      }
      if (typeof window !== 'undefined') {
        (window as unknown as { __LAST_VERCEL_STATE__?: string }).__LAST_VERCEL_STATE__ = data.state;
        window.sessionStorage.setItem('folio_last_vercel_state', data.state);
      }
      if (data.installUrl) {
        window.location.href = data.installUrl;
      }
    } catch {
      notify('Network error initiating Vercel connection.');
      setConnectingVercel(false);
    }
  };

  const handleConnectWithToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tokenInput.trim()) {
      setTokenError('Please enter a Vercel Personal Access Token.');
      return;
    }
    if (isOffline) {
      notify('You are offline. Please reconnect to link your Vercel account.');
      return;
    }
    setConnectingToken(true);
    setTokenError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/integrations/vercel/token', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenInput.trim(),
          teamId: tokenTeamId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTokenError(data.error || 'Failed to connect Vercel token.');
        setConnectingToken(false);
        return;
      }
      setTokenInput('');
      setTokenTeamId('');
      setShowTokenConnect(false);
      notify(`Connected to ${data.teamName || data.accountName || 'Vercel'} successfully!`);
      void fetchVercelStatus();
    } catch {
      setTokenError('Network error connecting Vercel token.');
    } finally {
      setConnectingToken(false);
    }
  };

  const handleSimulateDevConnect = async () => {
    if (isOffline) {
      notify('You are offline. Please reconnect to link your Vercel account.');
      return;
    }
    setConnectingVercel(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/integrations/vercel/connect', { headers });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Failed to initiate Vercel connection.');
        setConnectingVercel(false);
        return;
      }
      window.location.href = `/api/integrations/vercel/callback?code=mock-code-dev-success&state=${encodeURIComponent(
        data.state,
      )}&configurationId=icfg_dev_local&teamId=team_dev_local`;
    } catch {
      notify('Network error initiating Vercel connection.');
      setConnectingVercel(false);
    }
  };

  const handleDisconnectVercel = async () => {
    if (isOffline) {
      notify('You are offline. Please reconnect to modify Vercel connection.');
      return;
    }
    setDisconnectingVercel(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/integrations/vercel/disconnect', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setVercelStatus({ connected: false });
        setDeploymentStatus(null);
        setConfirmingDisconnectVercel(false);
        notify('Vercel account disconnected successfully.');
      } else {
        notify(data.error || 'Failed to disconnect Vercel.');
      }
    } catch {
      notify('Network error while disconnecting Vercel.');
    } finally {
      setDisconnectingVercel(false);
    }
  };

  const handleUnpublish = async () => {
    if (isOffline) {
      notify('You are offline. Please reconnect to change portfolio publication.');
      return;
    }

    setUnpublishing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/portfolio/unpublish', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        notify('Your portfolio has been unpublished and is no longer public.');
        setConfirmingUnpublish(false);
        setAccountData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            portfolio: {
              ...prev.portfolio,
              isPublished: false,
              slug: null,
              url: null,
              publishedAt: null,
              hasUnpublishedChanges: false,
            },
          };
        });
        void fetchAccount();
      } else {
        notify(data.error || 'Failed to unpublish portfolio.');
      }
    } catch {
      notify('Network error while unpublishing.');
    } finally {
      setUnpublishing(false);
    }
  };

  const copyUrl = (url: string) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        notify('Portfolio link copied to clipboard!');
      });
    }
  };

  const templateMeta = accountData
    ? getTemplateMeta(accountData.portfolio.templateId as never)
    : getTemplateMeta(activeDesign.templateId);

  const isAdvancedMode =
    activePortfolioConfig.mode === 'advanced' || accountData?.portfolio.mode === 'advanced';

  return (
    <div className="account-screen">
      <header className="topbar account-header" role="banner">
        <a className="logo" href="/" aria-label="folio home">
          <span className="logo-mark">
            <Icon name="leaf" size={15} />
          </span>
          <span>folio</span>
        </a>
        <nav className="nav-links account-header-nav" aria-label="Main navigation">
          <a href="/#how">How it works</a>
          <a href="/#designs">Designs</a>
          <a href="/template-demos">Style showcase</a>
        </nav>
        <div className="nav-actions">
          <a href="/studio" className="button small">
            Open Studio <Icon name="arrow" size={12} />
          </a>
          {effectiveUser && (
            <button
              type="button"
              className="text-button"
              onClick={handleSignOut}
              aria-label="Sign out of your account"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="account-container" role="main">
        {isOffline && (
          <div className="account-banner offline" role="status">
            <Icon name="light" size={16} />
            <span>You’re currently offline. Your local draft is safe on this device.</span>
          </div>
        )}

        {errorMessage && (
          <div className="account-banner error" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        <header className="account-hero">
          <div className="hero-kicker">
            <span className="kicker-dot" /> Your Workspace &amp; Identity
          </div>
          <h1 className="account-title">
            Manage your <em>portfolio.</em>
          </h1>
          <p className="account-subtitle">
            Control your single portfolio, cloud draft synchronization, Vercel deployments, and public web address.
          </p>

          {effectiveUser && (
            <div className="account-summary-strip" aria-label="Workspace overview">
              <div className="summary-chip">
                <span className="chip-dot" />
                <span>Format: <strong>{isAdvancedMode ? 'Advanced Multi-page' : 'Simple Single-page'}</strong></span>
              </div>
              <div className="summary-chip">
                <span className={`chip-dot ${accountData?.portfolio.isPublished ? '' : 'apricot'}`} />
                <span>Status: <strong>{accountData?.portfolio.isPublished ? 'Published & Live' : 'Draft only'}</strong></span>
              </div>
              {accountData?.portfolio.isPublished && accountData.portfolio.slug && (
                <div className="summary-chip">
                  <span className="chip-dot" />
                  <span>Public address: <strong>/p/{accountData.portfolio.slug}</strong></span>
                </div>
              )}
              <div className="summary-chip">
                <span className="chip-dot" />
                <span>Dev Credits: <strong>{creditData ? creditData.balance : 12} available</strong></span>
              </div>
            </div>
          )}
        </header>

        {!effectiveUser ? (
          /* Signed-Out State */
          <div className="account-signed-out-grid">
            <section className="account-card" aria-label="Sign in required">
              <div className="account-card-header">
                <div className="account-card-header-left">
                  <span className="account-card-eyebrow">AUTHENTICATION</span>
                  <h2 className="account-card-title">Sign in to manage your portfolio</h2>
                </div>
              </div>
              <p className="account-subtitle">
                Sign in to sync your draft to your account, manage your published link, and access your portfolio from any device.
              </p>
              <div
                style={{
                  padding: '13px 16px',
                  background: 'var(--green-soft)',
                  border: '1px solid #b8d4bb',
                  borderRadius: '10px',
                  color: '#1e4620',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  lineHeight: 1.45,
                }}
              >
                <Icon name="lock" size={15} />
                <span>Your local draft in the studio remains intact on this device even before signing in.</span>
              </div>

              {oauthError && (
                <div
                  style={{
                    padding: '14px 16px',
                    background: '#fff9e6',
                    border: '1px solid #ffe58f',
                    borderRadius: '10px',
                    color: '#874d00',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Google Sign-In is not enabled in your Supabase project
                  </div>
                  <p style={{ margin: '0 0 8px 0' }}>
                    Supabase returned: <code>Unsupported provider: provider is not enabled</code>.
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    To enable Google OAuth in your Supabase project:
                  </p>
                  <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>
                    <li>Open your <strong>Supabase Dashboard</strong></li>
                    <li>Go to <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Google</strong></li>
                    <li>Toggle <strong>Enable Sign in with Google</strong> to ON</li>
                    <li>Enter your Google Cloud <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                  </ol>
                  <p style={{ margin: 0 }}>
                    In the meantime, you can use <strong>Instant Dev Sign-In</strong> or <strong>Email Link</strong> below.
                  </p>
                </div>
              )}

              <div className="account-actions">
                {isSupabaseConfigured && (
                  <button
                    type="button"
                    className="button small"
                    onClick={handleSignIn}
                    aria-label="Sign in with Google"
                  >
                    Sign in with Google <Icon name="arrow" size={12} />
                  </button>
                )}
                {isDevMode && (
                  <button
                    type="button"
                    className={isSupabaseConfigured ? 'button secondary small' : 'button small'}
                    onClick={handleDevSignIn}
                    disabled={devLoginLoading}
                    aria-label="Sign in with Dev Account"
                  >
                    {devLoginLoading ? 'Signing in…' : 'Instant Dev Sign-In'} <Icon name="arrow" size={12} />
                  </button>
                )}
                {!isSupabaseConfigured && !isDevMode && (
                  <button type="button" className="button small" disabled>
                    Sign in unavailable
                  </button>
                )}
                <a href="/studio" className="button secondary small">
                  Open Studio
                </a>
              </div>

              {isSupabaseConfigured && (
                <div
                  style={{
                    paddingTop: '20px',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <h3 style={{ fontSize: '14px', fontWeight: 650, margin: '0 0 6px 0', color: 'var(--ink)' }}>
                    Sign in with Email Link
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
                    Receive a magic sign-in link in your inbox. Supported directly by your connected Supabase project.
                  </p>
                  {emailSent ? (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'var(--green-soft)',
                        border: '1px solid #b8d4bb',
                        borderRadius: '8px',
                        color: '#1e4620',
                        fontSize: '13px',
                      }}
                    >
                      Magic link sent! Check your inbox at <strong>{emailInput}</strong> to finish signing in.
                    </div>
                  ) : (
                    <form onSubmit={handleEmailSignIn} style={{ display: 'flex', gap: '8px', maxWidth: '440px' }}>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                        style={{
                          flex: 1,
                          padding: '9px 14px',
                          fontSize: '13px',
                          borderRadius: '8px',
                          border: '1px solid var(--line-dark)',
                          background: '#ffffff',
                          color: 'var(--ink)',
                        }}
                      />
                      <button
                        type="submit"
                        className="button secondary small"
                        disabled={emailSending || !emailInput.trim()}
                      >
                        {emailSending ? 'Sending…' : 'Send Link'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </section>

            <aside className="account-showcase-sidebar" aria-label="Folio platform features">
              <div className="account-feature-card">
                <div className="account-feature-icon">
                  <Icon name="leaf" size={16} />
                </div>
                <div>
                  <h4>One Polished Story</h4>
                  <p>Keep your focus on one high-quality portfolio link that presents your best work clearly.</p>
                </div>
              </div>
              <div className="account-feature-card">
                <div className="account-feature-icon apricot">
                  <Icon name="globe" size={16} />
                </div>
                <div>
                  <h4>Instant Live Deployment</h4>
                  <p>Publish single-page portfolios to folio.site or deploy multi-page Next.js apps straight to Vercel.</p>
                </div>
              </div>
              <div className="account-feature-card">
                <div className="account-feature-icon">
                  <Icon name="spark" size={16} />
                </div>
                <div>
                  <h4>Zero Code Required</h4>
                  <p>Pick from 22 handcrafted designs. Your content formats beautifully across all devices.</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* Authenticated State in 2-Column Balanced Grid */
          <div className="account-main-grid">
            <div className="account-column">
              {/* 1. Single Portfolio Management Card */}
              <section className="account-card" aria-label="My portfolio">
                <div className="account-card-header">
                  <div className="account-card-header-left">
                    <span className="account-card-eyebrow">PORTFOLIO WORKSPACE</span>
                    <h2 className="account-card-title">My portfolio</h2>
                  </div>
                  {accountData?.portfolio.isPublished ? (
                    accountData.portfolio.hasUnpublishedChanges ? (
                      <span className="account-badge unpublished-changes">
                        <span className="account-badge-dot" /> Published · Draft has changes
                      </span>
                    ) : (
                      <span className="account-badge published">
                        <span className="account-badge-dot" /> Published
                      </span>
                    )
                  ) : (
                    <span className="account-badge not-published">
                      <span className="account-badge-dot" /> Not published
                    </span>
                  )}
                </div>

                <div className="account-grid">
                  <div className="account-field">
                    <span className="account-field-label">
                      <Icon name="user" size={11} /> Portfolio title
                    </span>
                    <span className="account-field-value">
                      {activeProfile.basics.name?.trim() || accountData?.portfolio.title || 'Untitled portfolio'}
                    </span>
                  </div>

                  <div className="account-field">
                    <span className="account-field-label">
                      <Icon name="spark" size={11} /> Visual design
                    </span>
                    <span className="account-field-value">
                      {templateMeta.name} <small style={{ color: 'var(--muted)' }}>({templateMeta.category})</small>
                    </span>
                  </div>

                  <div className="account-field">
                    <span className="account-field-label">
                      <Icon name="pencil" size={11} /> Draft status
                    </span>
                    <span className="account-field-value">
                      {isOffline
                        ? 'Offline · Saved on this device'
                        : accountData?.portfolio.updatedAt
                        ? `Saved to your account (${new Date(accountData.portfolio.updatedAt).toLocaleDateString()})`
                        : 'Saved on this device'}
                    </span>
                  </div>

                  <div className="account-field">
                    <span className="account-field-label">
                      <Icon name="layers" size={11} /> Portfolio format
                    </span>
                    <span className="account-field-value">
                      {isAdvancedMode ? (
                        (() => {
                          const advConfig =
                            activePortfolioConfig.mode === 'advanced'
                              ? activePortfolioConfig.advanced
                              : accountData?.draft?.portfolioConfig?.mode === 'advanced'
                              ? accountData.draft.portfolioConfig.advanced
                              : undefined;
                          const totalPages = advConfig?.pages?.length ?? accountData?.portfolio.totalPagesCount ?? 5;
                          const activePages = advConfig?.pages
                            ? advConfig.pages.filter((p) => p.visible).length
                            : accountData?.portfolio.activePagesCount ?? 5;
                          return (
                            <>
                              <span><strong>Advanced</strong> · Multi-page (Vercel deployment)</span>
                              <small style={{ display: 'block', color: 'var(--muted)', marginTop: '4px', fontSize: '12px' }}>
                                {totalPages} pages · {activePages} active · Deploys directly to your Vercel account.
                              </small>
                            </>
                          );
                        })()
                      ) : (
                        <span><strong>Simple</strong> · Single-page (Folio hosted)</span>
                      )}
                    </span>
                  </div>

                  <div className="account-field" style={{ gridColumn: '1 / -1' }}>
                    <span className="account-field-label">
                      <Icon name="globe" size={11} /> Web address
                    </span>
                    <span className="account-field-value">
                      {isAdvancedMode && deploymentStatus?.productionUrl ? (
                        <a
                          href={deploymentStatus.productionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--green)', fontWeight: 650, textDecoration: 'underline' }}
                          data-testid="advanced-live-url"
                        >
                          {deploymentStatus.productionUrl} ↗
                        </a>
                      ) : accountData?.portfolio.isPublished && accountData.portfolio.slug ? (
                        <a
                          href={`/p/${accountData.portfolio.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--green)', fontWeight: 650, textDecoration: 'underline' }}
                        >
                          /p/{accountData.portfolio.slug} ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>None (not published yet)</span>
                      )}
                    </span>
                  </div>
                </div>

                {confirmingUnpublish ? (
                  <div
                    style={{
                      padding: '16px',
                      background: '#fff4f2',
                      border: '1px solid #f6c0b8',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <strong style={{ color: '#8a2c1a', fontSize: '14px' }}>Unpublish this portfolio?</strong>
                    <p style={{ margin: 0, color: '#8a2c1a', fontSize: '13px' }}>
                      Taking your portfolio offline will cause <strong>/p/{accountData?.portfolio.slug}</strong> to return a 404. Your draft in the studio is completely safe.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="button small"
                        style={{ background: '#b0351f', color: '#ffffff' }}
                        disabled={unpublishing}
                        onClick={handleUnpublish}
                      >
                        {unpublishing ? 'Unpublishing…' : 'Confirm unpublish'}
                      </button>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => setConfirmingUnpublish(false)}
                        disabled={unpublishing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="account-actions">
                    <a href="/studio" className="button small">
                      Edit portfolio <Icon name="arrow" size={12} />
                    </a>

                    {isAdvancedMode && deploymentStatus?.productionUrl && (
                      <>
                        <a
                          href={deploymentStatus.productionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button secondary small"
                          data-testid="account-view-live-btn"
                        >
                          View live portfolio ↗
                        </a>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => copyUrl(deploymentStatus.productionUrl!)}
                        >
                          Copy link
                        </button>
                      </>
                    )}

                    {!isAdvancedMode && accountData?.portfolio.isPublished && accountData.portfolio.slug && (
                      <>
                        <a
                          href={`/p/${accountData.portfolio.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button secondary small"
                        >
                          View live portfolio ↗
                        </a>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => copyUrl(`/p/${accountData.portfolio.slug}`)}
                        >
                          Copy link
                        </button>
                      </>
                    )}

                    {isAdvancedMode ? (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => setDeployModalOpen(true)}
                        data-testid="account-deploy-advanced-btn"
                      >
                        {deploymentStatus?.status === 'ready' ? 'Redeploy to Vercel' : 'Deploy to Vercel'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => setPublishModalOpen(true)}
                      >
                        {accountData?.portfolio.isPublished
                          ? accountData.portfolio.hasUnpublishedChanges
                            ? 'Publish updates'
                            : 'Republish settings'
                          : 'Publish portfolio'}
                      </button>
                    )}

                    {accountData?.portfolio.isPublished && accountData.portfolio.slug && (
                      <>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => setShareModalOpen(true)}
                        >
                          Share &amp; QR
                        </button>
                        <a
                          href={`/api/portfolio/export?slug=${accountData.portfolio.slug}&format=html`}
                          className="button subtle small"
                          title="Download standalone HTML for offline viewing or hosting"
                        >
                          Export HTML
                        </a>
                        <a
                          href={`/api/portfolio/export?slug=${accountData.portfolio.slug}&format=resume`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button subtle small"
                          title="View and download your ATS-compliant printable PDF resume"
                        >
                          Resume (PDF)
                        </a>
                      </>
                    )}

                    {accountData?.portfolio.isPublished && (
                      <button
                        type="button"
                        className="button subtle small"
                        style={{ color: '#b0351f', marginLeft: 'auto' }}
                        onClick={() => setConfirmingUnpublish(true)}
                      >
                        Unpublish
                      </button>
                    )}
                  </div>
                )}
              </section>

              {accountData?.portfolio.slug && (
                <ShareModal
                  isOpen={shareModalOpen}
                  onClose={() => setShareModalOpen(false)}
                  slug={accountData.portfolio.slug}
                  name={activeProfile.basics.name}
                  role={activeProfile.basics.role}
                  isAdvanced={isAdvancedMode}
                />
              )}


              {/* 3. Vercel Integration Card (Advanced Mode or Connected) */}
              {(() => {
                if (!isAdvancedMode && !vercelStatus?.connected) return null;

                return (
                  <section
                    className="account-card"
                    aria-label="Vercel Deployment Integration"
                    data-testid="vercel-integration-card"
                  >
                    <div className="account-card-header">
                      <div className="account-card-header-left">
                        <span className="account-card-eyebrow">DEPLOYMENT PIPELINE</span>
                        <h2 className="account-card-title">Vercel Integration</h2>
                      </div>
                      {vercelStatus?.connected ? (
                        <span className="account-badge published" data-testid="vercel-status-connected">
                          <span className="account-badge-dot" /> Connected
                        </span>
                      ) : (
                        <span className="account-badge not-published" data-testid="vercel-status-disconnected">
                          <span className="account-badge-dot" /> Not connected
                        </span>
                      )}
                    </div>

                    <div className="account-grid">
                      <div className="account-field">
                        <span className="account-field-label">Integration status</span>
                        <span className="account-field-value" data-testid="vercel-connection-state">
                          {vercelLoading ? (
                            'Checking connection…'
                          ) : vercelStatus?.connected ? (
                            'Connected to Vercel'
                          ) : (
                            'Not connected'
                          )}
                        </span>
                      </div>

                      {vercelStatus?.connected && (
                        <>
                          <div className="account-field">
                            <span className="account-field-label">Vercel account / team</span>
                            <span className="account-field-value" data-testid="vercel-account-name">
                              {vercelStatus.teamName || vercelStatus.accountName || 'Authorized Account'}
                            </span>
                          </div>

                          {vercelStatus.configurationId && (
                            <div className="account-field">
                              <span className="account-field-label">Configuration ID</span>
                              <span
                                className="account-field-value"
                                data-testid="vercel-config-id"
                                style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                              >
                                {vercelStatus.configurationId}
                              </span>
                            </div>
                          )}

                          {vercelStatus.connectedAt && (
                            <div className="account-field">
                              <span className="account-field-label">Connected date</span>
                              <span className="account-field-value" data-testid="vercel-connected-date">
                                {new Date(vercelStatus.connectedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          {deploymentStatus?.projectName && (
                            <div className="account-field">
                              <span className="account-field-label">Vercel project</span>
                              <span className="account-field-value" data-testid="vercel-project-name" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}>
                                {deploymentStatus.projectName}
                              </span>
                            </div>
                          )}

                          <div className="account-field">
                            <span className="account-field-label">Deployment status</span>
                            <span className="account-field-value" data-testid="vercel-deployment-state">
                              {deploymentStatus?.status === 'ready' ? (
                                <span style={{ color: '#137333', fontWeight: 650 }}>● Live</span>
                              ) : deploymentStatus?.status === 'building' || deploymentStatus?.status === 'queued' ? (
                                <span style={{ color: '#703800', fontWeight: 650 }}>Building on Vercel…</span>
                              ) : deploymentStatus?.status === 'error' ? (
                                <span style={{ color: '#c5221f', fontWeight: 650 }}>Failed</span>
                              ) : (
                                'Not deployed yet'
                              )}
                            </span>
                          </div>

                          {deploymentStatus?.productionUrl && (
                            <div className="account-field">
                              <span className="account-field-label">Live URL</span>
                              <span className="account-field-value">
                                <a
                                  href={deploymentStatus.productionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--green)', fontWeight: 650, textDecoration: 'underline' }}
                                >
                                  {deploymentStatus.productionUrl} ↗
                                </a>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px', lineHeight: 1.55 }}>
                      {vercelStatus?.connected
                        ? 'Your Vercel account is authorized for automated Next.js deployments for your Advanced multi-page portfolio.'
                        : 'Connect your Vercel account to authorize automated deployments for your multi-page Advanced portfolio.'}
                    </p>

                    {confirmingDisconnectVercel ? (
                      <div
                        style={{
                          padding: '16px',
                          background: '#fff4f2',
                          border: '1px solid #f6c0b8',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                        data-testid="vercel-disconnect-confirmation"
                      >
                        <strong style={{ color: '#8a2c1a', fontSize: '14px' }}>Disconnect Vercel account?</strong>
                        <p style={{ margin: 0, color: '#8a2c1a', fontSize: '13px' }}>
                          Unlinking your Vercel account removes deployment authorization. Your portfolio content and Studio draft are completely safe.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button
                            type="button"
                            className="button small"
                            style={{ background: '#b0351f', color: '#ffffff' }}
                            disabled={disconnectingVercel}
                            onClick={handleDisconnectVercel}
                            data-testid="confirm-disconnect-vercel-btn"
                          >
                            {disconnectingVercel ? 'Disconnecting…' : 'Confirm disconnect'}
                          </button>
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => setConfirmingDisconnectVercel(false)}
                            disabled={disconnectingVercel}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="account-actions">
                        {vercelStatus?.connected ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="button small"
                              onClick={() => setDeployModalOpen(true)}
                              data-testid="account-vercel-deploy-btn"
                            >
                              {deploymentStatus?.status === 'ready' ? 'Redeploy to Vercel' : 'Deploy to Vercel'}
                            </button>
                            <button
                              type="button"
                              className="button subtle small"
                              style={{ color: '#b0351f' }}
                              onClick={() => setConfirmingDisconnectVercel(true)}
                              data-testid="disconnect-vercel-btn"
                            >
                              Disconnect Vercel
                            </button>
                          </div>
                        ) : showTokenConnect ? (
                          <form
                            onSubmit={handleConnectWithToken}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              padding: '16px',
                              background: 'var(--surface-muted)',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                            data-testid="vercel-token-form"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>Connect with Vercel Token</strong>
                              <button
                                type="button"
                                className="button subtle small"
                                onClick={() => {
                                  setShowTokenConnect(false);
                                  setTokenError(null);
                                }}
                                style={{ padding: '2px 8px', fontSize: '12px' }}
                              >
                                Cancel
                              </button>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                              Create a Personal Access Token in your Vercel account at{' '}
                              <a
                                href="https://vercel.com/account/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--green)', textDecoration: 'underline' }}
                              >
                                vercel.com/account/tokens ↗
                              </a>
                              .
                            </p>

                            {tokenError && (
                              <div
                                style={{
                                  padding: '8px 12px',
                                  background: '#fff4f2',
                                  border: '1px solid #f6c0b8',
                                  borderRadius: '8px',
                                  color: '#8a2c1a',
                                  fontSize: '12px',
                                }}
                                data-testid="vercel-token-error"
                              >
                                {tokenError}
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '12px', fontWeight: 650, color: 'var(--foreground)' }} htmlFor="vercel-token-input">
                                Access Token
                              </label>
                              <input
                                id="vercel-token-input"
                                type="password"
                                className="input"
                                placeholder="Paste your token here"
                                value={tokenInput}
                                onChange={(e) => {
                                  setTokenInput(e.target.value);
                                  setTokenError(null);
                                }}
                                disabled={connectingToken}
                                style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}
                                data-testid="vercel-token-input"
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontSize: '12px', fontWeight: 650, color: 'var(--foreground)' }} htmlFor="vercel-team-input">
                                Team ID or Slug <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                              </label>
                              <input
                                id="vercel-team-input"
                                type="text"
                                className="input"
                                placeholder="e.g. team_abc123 or your-team-slug"
                                value={tokenTeamId}
                                onChange={(e) => setTokenTeamId(e.target.value)}
                                disabled={connectingToken}
                                style={{ fontSize: '13px' }}
                                data-testid="vercel-team-input"
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button
                                type="submit"
                                className="button small"
                                disabled={connectingToken || !tokenInput.trim() || isOffline}
                                data-testid="submit-vercel-token-btn"
                              >
                                {connectingToken ? 'Connecting…' : 'Connect Token'}
                              </button>
                              <button
                                type="button"
                                className="button secondary small"
                                onClick={() => {
                                  setShowTokenConnect(false);
                                  setTokenError(null);
                                }}
                                disabled={connectingToken}
                              >
                                Back
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="button small"
                              onClick={() => handleConnectVercel()}
                              disabled={connectingVercel || isOffline}
                              data-testid="connect-vercel-btn"
                            >
                              {connectingVercel ? 'Initiating…' : 'Connect Vercel'} <Icon name="arrow" size={12} />
                            </button>
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => setShowTokenConnect(true)}
                              disabled={connectingVercel || isOffline}
                              data-testid="toggle-token-connect-btn"
                              title="Connect directly using a Vercel Personal Access Token"
                            >
                              Connect with Token
                            </button>
                            {process.env.NODE_ENV !== 'production' && (
                              <button
                                type="button"
                                className="button subtle small"
                                onClick={handleSimulateDevConnect}
                                disabled={connectingVercel || isOffline}
                                title="Simulate successful Vercel authorization in local development"
                                data-testid="simulate-dev-connect-btn"
                              >
                                Simulate Dev Connection
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* 3. Account Identity Card */}
              <section className="account-card" aria-label="Account identity">
                <div className="account-card-header">
                  <div className="account-card-header-left">
                    <span className="account-card-eyebrow">USER PROFILE</span>
                    <h2 className="account-card-title">Account details</h2>
                  </div>
                  <span className="account-badge published">
                    <span className="account-badge-dot" /> Signed in
                  </span>
                </div>
                <div className="account-grid">
                  <div className="account-field">
                    <span className="account-field-label">Email address</span>
                    <span className="account-field-value">{effectiveUser.email || 'Connected'}</span>
                  </div>
                  <div className="account-field">
                    <span className="account-field-label">Account status</span>
                    <span className="account-field-value">Single portfolio active</span>
                  </div>
                </div>
                <div className="account-actions">
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={handleSignOut}
                    aria-label="Sign out"
                  >
                    Sign out
                  </button>
                </div>
              </section>
            </div>

            <div className="account-column">
              {/* 4. Privacy-Friendly Visitor Analytics */}
              <AnalyticsDashboard
                slug={accountData?.portfolio.slug}
                isPublished={accountData?.portfolio.isPublished ?? false}
              />

              {/* 5. Inquiries & Lead Capture Inbox */}
              <AccountInbox />

              {/* 4. Dev Credits Card */}
              <section className="account-card" aria-label="Dev Credits">
                <div className="account-card-header">
                  <div className="account-card-header-left">
                    <span className="account-card-eyebrow">DEVELOPER SYSTEM</span>
                    <h2 className="account-card-title">Dev Credits</h2>
                  </div>
                  <span className="account-badge published">
                    <span className="account-badge-dot" /> Experimental
                  </span>
                </div>
                <div className="account-credits-display">
                  <div className="credits-balance-row">
                    <span className="credits-number">{creditData ? creditData.balance : '—'}</span>
                    <span className="credits-unit">credits</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5 }}>
                    Dev Credits are currently experimental and have no monetary value. They may be used by future Folio features.
                  </p>
                </div>
                <div className="credits-activity">
                  <span className="account-field-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Recent Activity
                  </span>
                  {creditData && creditData.transactions.length > 0 ? (
                    <ul className="credits-activity-list">
                      {creditData.transactions.slice(0, 5).map((tx) => (
                        <li key={tx.id} className="credits-activity-item">
                          <span>{tx.reason}</span>
                          <span className={`credits-amount ${tx.type === 'consume' ? 'consume' : 'grant'}`}>
                            {tx.type === 'consume' ? `-${tx.amount}` : `+${tx.amount}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '13px' }}>No activity yet.</span>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <PublishModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        user={effectiveUser}
        profile={activeProfile}
        design={activeDesign}
        isPublished={Boolean(accountData?.portfolio.isPublished)}
        publishedSlug={accountData?.portfolio.slug ?? null}
        publishedAt={accountData?.portfolio.publishedAt ?? null}
        hasUnpublishedChanges={Boolean(accountData?.portfolio.hasUnpublishedChanges)}
        onPublicationChange={(status) => {
          setAccountData((prev) => {
            if (!prev) {
              return {
                user: {
                  userId: effectiveUser?.id || '',
                  email: effectiveUser?.email || null,
                },
                portfolio: {
                  title: activeProfile.basics.name?.trim() || 'Untitled portfolio',
                  templateId: activeDesign.templateId,
                  templateName: getTemplateMeta(activeDesign.templateId).name,
                  isPublished: status.isPublished,
                  slug: status.slug,
                  url: status.url,
                  publishedAt: status.publishedAt,
                  updatedAt: new Date().toISOString(),
                  hasUnpublishedChanges: status.hasUnpublishedChanges,
                },
                draft: {
                  profile: activeProfile,
                  design: activeDesign,
                  updatedAt: new Date().toISOString(),
                },
              };
            }
            return {
              ...prev,
              portfolio: {
                ...prev.portfolio,
                isPublished: status.isPublished,
                slug: status.slug,
                url: status.url,
                publishedAt: status.publishedAt,
                hasUnpublishedChanges: status.hasUnpublishedChanges,
              },
            };
          });
          void fetchAccount();
        }}
        onToast={notify}
        onSignIn={handleSignIn}
      />

      <AdvancedDeployModal
        isOpen={deployModalOpen}
        onClose={() => {
          setDeployModalOpen(false);
          void fetchDeploymentStatus();
        }}
        user={effectiveUser}
        profile={activeProfile}
        portfolioConfig={activePortfolioConfig}
        onToast={notify}
        onSignIn={handleSignIn}
      />

      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMessage}
      </div>
    </div>
  );
}
