'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Builder } from '@/components/builder';
import { ContentIntake } from '@/components/content-intake';
import { LandingPage } from '@/components/landing-page';
import { ProfileReview } from '@/components/profile-review';
import { PublishModal } from '@/components/publish-modal';
import { AdvancedDeployModal } from '@/components/advanced-deploy-modal';
import { loadLocalDraft, saveLocalDraft } from '@/lib/local-draft';
import {
  createDefaultDesign,
  createEmptyProfile,
  createDefaultPortfolioConfig,
  createDefaultAdvancedConfig,
  type DesignConfig,
  type DraftBundle,
  type ProfileDocument,
  type PortfolioConfig,
  type PortfolioMode,
} from '@/lib/profile-schema';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { loadRemoteDraft, saveRemoteDraft } from '@/lib/supabase/profile-repository';
import { computeHasUnpublishedChanges } from '@/lib/publishing/status';

type Screen = 'landing' | 'onboarding' | 'review' | 'builder';

export function PortfolioStudio({ initialScreen = 'landing' }: { initialScreen?: Screen } = {}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [intakeStarted, setIntakeStarted] = useState(false);
  const [builderInitialStep, setBuilderInitialStep] = useState(0);
  const [profile, setProfile] = useState<ProfileDocument>(createEmptyProfile());
  const [design, setDesign] = useState<DesignConfig>(createDefaultDesign());
  const [portfolioConfig, setPortfolioConfig] = useState<PortfolioConfig>(() => createDefaultPortfolioConfig('simple'));
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [remoteHydrated, setRemoteHydrated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Draft not saved yet');
  const [publishOpen, setPublishOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Publication state
  const [isPublished, setIsPublished] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [lastPublishedSnapshot, setLastPublishedSnapshot] = useState<{
    profile: ProfileDocument;
    design: DesignConfig;
  } | null>(null);

  const checkPublicationStatus = async (userId: string, currentProfile?: ProfileDocument, currentDesign?: DesignConfig) => {
    const supabase = getSupabaseBrowserClient();
    let authHeader = '';
    if (supabase) {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      if (token) authHeader = `Bearer ${token}`;
    } else if (process.env.NODE_ENV !== 'production' && userId) {
      authHeader = `Bearer test-${userId}`;
    }
    if (!authHeader) return;

    try {
      const res = await fetch('/api/portfolio/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'x-folio-test-user-id': userId,
        },
        body: JSON.stringify({ profile: currentProfile, design: currentDesign }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setIsPublished(data.isPublished);
          setPublishedSlug(data.slug);
          setPublishedAt(data.publishedAt);
          setPublishedUrl(data.url);
          setHasUnpublishedChanges(data.hasUnpublishedChanges);
        }
      }
    } catch {
      // non-blocking status check
    }
  };

  useEffect(() => {
    setMounted(true);
    const local = loadLocalDraft();
    if (local) {
      setProfile(local.profile);
      setDesign(local.design);
      if (local.portfolioConfig) {
        setPortfolioConfig(local.portfolioConfig);
      }
      setDraftAvailable(true);
      setSaveStatus('Saved on this device');
    }
    setReady(true);

    const getDevUser = (): User | null => {
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        const devUserId = window.sessionStorage.getItem('folio_dev_user');
        if (devUserId) {
          return { id: devUserId, email: `${devUserId}@test.local` } as User;
        }
      }
      return null;
    };

    const initialDevUser = getDevUser();
    if (initialDevUser) {
      setUser(initialDevUser);
      if (local) {
        void fetch('/api/portfolio/account', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer test-${initialDevUser.id}`,
            'x-folio-test-user-id': initialDevUser.id,
          },
          body: JSON.stringify(local),
        });
      }
      void checkPublicationStatus(initialDevUser.id, local?.profile, local?.design);
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      setRemoteHydrated(true);
      return;
    }

    const hydrateUserDraft = async (userId: string) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      let remote: DraftBundle | null = null;
      if (isUuid) {
        remote = await loadRemoteDraft(supabase, userId);
      } else {
        try {
          const res = await fetch('/api/portfolio/account', {
            headers: {
              Authorization: `Bearer test-${userId}`,
              'x-folio-test-user-id': userId,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.draft) remote = data.draft;
          }
        } catch {
          // ignore network error
        }
      }

      const syncDraft = async (d: DraftBundle): Promise<{ ok: boolean; message?: string }> => {
        if (isUuid) {
          return saveRemoteDraft(supabase, userId, d);
        }
        try {
          const res = await fetch('/api/portfolio/account', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer test-${userId}`,
              'x-folio-test-user-id': userId,
            },
            body: JSON.stringify(d),
          });
          return { ok: res.ok, message: res.ok ? undefined : 'Sync failed' };
        } catch {
          return { ok: false, message: 'Sync failed' };
        }
      };

      const localDraft = loadLocalDraft();
      let activeProfile = profile;
      let activeDesign = design;

      if (remote && localDraft && Date.parse(localDraft.updatedAt) > Date.parse(remote.updatedAt)) {
        const synced = await syncDraft(localDraft);
        if (!synced.ok) setSaveStatus('Saved on this device · cloud sync needs attention');
        activeProfile = localDraft.profile;
        activeDesign = localDraft.design;
        if (localDraft.portfolioConfig) setPortfolioConfig(localDraft.portfolioConfig);
      } else if (remote) {
        setProfile(remote.profile);
        setDesign(remote.design);
        if (remote.portfolioConfig) setPortfolioConfig(remote.portfolioConfig);
        setDraftAvailable(true);
        saveLocalDraft(remote);
        setSaveStatus('Saved to your account');
        activeProfile = remote.profile;
        activeDesign = remote.design;
      } else if (localDraft) {
        // User had a local draft before authenticating - migrate to remote account
        const synced = await syncDraft(localDraft);
        if (synced.ok) setSaveStatus('Saved to your account');
        activeProfile = localDraft.profile;
        activeDesign = localDraft.design;
        if (localDraft.portfolioConfig) setPortfolioConfig(localDraft.portfolioConfig);
      }
      setRemoteHydrated(true);
      void checkPublicationStatus(userId, activeProfile, activeDesign);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? getDevUser();
      setUser(nextUser);
      setAuthReady(true);
      if (session?.user) {
        setRemoteHydrated(false);
        // Supabase recommends deferring follow-up async work outside the auth callback.
        window.setTimeout(() => { void hydrateUserDraft(session.user.id); }, 0);
      } else if (nextUser) {
        setRemoteHydrated(true);
        void checkPublicationStatus(nextUser.id, profile, design);
      } else {
        setRemoteHydrated(true);
        setIsPublished(false);
        setPublishedSlug(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready || screen === 'landing' || (screen === 'onboarding' && !intakeStarted)) return;

    const bundle: DraftBundle = {
      profile,
      design,
      portfolioConfig,
      updatedAt: new Date().toISOString(),
    };
    const savedLocally = saveLocalDraft(bundle);
    setDraftAvailable(savedLocally);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSaveStatus('Offline · Saved on this device');
      return;
    }

    setSaveStatus(user && authReady && remoteHydrated ? 'Saving to your account…' : 'Saving…');
    const timeout = window.setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSaveStatus('Offline · Saved on this device');
        return;
      }

      if (user && authReady && remoteHydrated) {
        const supabase = getSupabaseBrowserClient();
        let result: { ok: boolean; message?: string } = { ok: false };
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
        if (supabase && isUuid) {
          result = await saveRemoteDraft(supabase, user.id, bundle);
        } else {
          try {
            const res = await fetch('/api/portfolio/account', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer test-${user.id}`,
                'x-folio-test-user-id': user.id,
              },
              body: JSON.stringify(bundle),
            });
            result = { ok: res.ok, message: res.ok ? undefined : 'Sync failed' };
          } catch {
            result = { ok: false, message: 'Sync failed' };
          }
        }
        setSaveStatus(result.ok ? 'Saved to your account' : 'Saved on this device · cloud sync needs attention');
        if (isPublished) {
          void checkPublicationStatus(user.id, profile, design);
        }
      } else {
        setSaveStatus(savedLocally ? 'Saved on this device' : 'Changes not saved');
      }

      if (isPublished && lastPublishedSnapshot) {
        const changed = computeHasUnpublishedChanges(
          profile,
          design,
          lastPublishedSnapshot.profile,
          lastPublishedSnapshot.design
        );
        setHasUnpublishedChanges(changed);
      }
    }, user && authReady && remoteHydrated ? 1000 : 350);
    return () => window.clearTimeout(timeout);
  }, [ready, screen, intakeStarted, profile, design, portfolioConfig, user, authReady, remoteHydrated, isPublished, lastPublishedSnapshot]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const notify = (message: string) => setToastMessage(message);

  const startPortfolio = () => {
    setBuilderInitialStep(0);
    if (draftAvailable) {
      setScreen('builder');
      window.scrollTo(0, 0);
      return;
    }
    setProfile(createEmptyProfile());
    setDesign(createDefaultDesign());
    setPortfolioConfig(createDefaultPortfolioConfig('simple'));
    setIntakeStarted(false);
    setSaveStatus('Draft not saved yet');
    setScreen('onboarding');
    window.scrollTo(0, 0);
  };

  const resumeDraft = () => {
    setBuilderInitialStep(0);
    setScreen('builder');
    window.scrollTo(0, 0);
  };

  const chooseLook = () => {
    setBuilderInitialStep(5);
    setScreen('builder');
    window.scrollTo(0, 0);
  };

  const editManually = () => {
    setBuilderInitialStep(0);
    setScreen('builder');
    window.scrollTo(0, 0);
  };

  const reviewExistingProfile = () => {
    setBuilderInitialStep(0);
    setScreen('review');
    window.scrollTo(0, 0);
  };

  const backToExistingEditor = () => {
    setBuilderInitialStep(0);
    setScreen('builder');
    window.scrollTo(0, 0);
  };

  const switchMode = (nextMode: PortfolioMode) => {
    if (nextMode === portfolioConfig.mode) return;
    setPortfolioConfig((prev) => {
      if (nextMode === 'advanced') {
        return {
          mode: 'advanced',
          advanced: prev.advanced ?? createDefaultAdvancedConfig(),
        };
      }
      return {
        mode: 'simple',
        advanced: prev.advanced,
      };
    });
    notify(nextMode === 'advanced' ? 'Switched to Advanced Portfolio mode' : 'Switched to Simple Portfolio mode');
  };

  const saveAndExit = async () => {
    const bundle: DraftBundle = {
      profile,
      design,
      portfolioConfig,
      updatedAt: new Date().toISOString(),
    };
    const saved = saveLocalDraft(bundle);
    setDraftAvailable(saved);
    setSaveStatus(saved ? 'Saved on this device' : 'Changes not saved');
    if (user && authReady && remoteHydrated) {
      const supabase = getSupabaseBrowserClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      let result: { ok: boolean; message?: string } = { ok: false };
      if (supabase && isUuid) {
        result = await saveRemoteDraft(supabase, user.id, bundle);
      } else {
        try {
          const res = await fetch('/api/portfolio/account', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer test-${user.id}`,
              'x-folio-test-user-id': user.id,
            },
            body: JSON.stringify(bundle),
          });
          result = { ok: res.ok };
        } catch {
          result = { ok: false };
        }
      }
      if (result.ok) setSaveStatus('Saved to your account');
      else setSaveStatus('Saved on this device · cloud sync needs attention');
    }
    setScreen('landing');
    setBuilderInitialStep(0);
    setIntakeStarted(false);
    setPublishOpen(false);
    window.scrollTo(0, 0);
  };

  const signIn = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      notify('Supabase isn’t configured yet. Add the project URL and public anon key to enable sign-in.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      if (
        error.message.includes('Unsupported provider') ||
        error.message.includes('provider is not enabled') ||
        error.message.includes('validation_failed')
      ) {
        notify('Google Sign-In is not enabled in your Supabase project. Head to /account to sign in with Email or Dev Account.');
      } else {
        notify(`Sign-in could not start: ${error.message}`);
      }
    }
  };

  const displayedSaveStatus = isPublished
    ? (hasUnpublishedChanges ? 'Published · Draft has unpublished changes' : `Published · /p/${publishedSlug}`)
    : (saveStatus.startsWith('Saved') ? `${saveStatus} · Not published` : saveStatus);

  return (
    <>
      {screen === 'landing' ? (
        <LandingPage hasDraft={draftAvailable} user={mounted ? user : null} onStart={startPortfolio} onResume={resumeDraft} onLogin={signIn} />
      ) : screen === 'onboarding' ? (
        <ContentIntake
          profile={profile}
          saveStatus={displayedSaveStatus}
          onProfileChange={setProfile}
          onIntakeStarted={() => setIntakeStarted(true)}
          onChooseLook={chooseLook}
          onEditManually={editManually}
          onSaveExit={saveAndExit}
        />
      ) : screen === 'review' ? (
        <ProfileReview
          profile={profile}
          saveStatus={displayedSaveStatus}
          origin="existing"
          onProfileChange={setProfile}
          onBack={backToExistingEditor}
          backLabel="Back to editor"
          onContinueToDesign={chooseLook}
          onEditManually={editManually}
          onSaveExit={saveAndExit}
        />
      ) : (
        <Builder
          profile={profile}
          design={design}
          portfolioConfig={portfolioConfig}
          onModeChange={switchMode}
          onPortfolioConfigChange={setPortfolioConfig}
          setProfile={setProfile}
          setDesign={setDesign}
          saveStatus={displayedSaveStatus}
          onSaveExit={saveAndExit}
          onPublish={() => setPublishOpen(true)}
          onDeploy={() => setDeployOpen(true)}
          onToast={notify}
          onReview={reviewExistingProfile}
          initialStep={builderInitialStep}
          isPublished={isPublished}
          publishedSlug={publishedSlug}
          hasUnpublishedChanges={hasUnpublishedChanges}
          user={mounted ? user : null}
          onSignIn={signIn}
        />
      )}

      <PublishModal
        isOpen={publishOpen}
        onClose={() => setPublishOpen(false)}
        user={mounted ? user : null}
        profile={profile}
        design={design}
        isPublished={isPublished}
        publishedSlug={publishedSlug}
        publishedAt={publishedAt}
        hasUnpublishedChanges={hasUnpublishedChanges}
        onPublicationChange={(status) => {
          setIsPublished(status.isPublished);
          setPublishedSlug(status.slug);
          setPublishedAt(status.publishedAt);
          setPublishedUrl(status.url);
          setHasUnpublishedChanges(status.hasUnpublishedChanges);
          if (status.isPublished && status.publishedProfile && status.publishedDesign) {
            setLastPublishedSnapshot({
              profile: status.publishedProfile,
              design: status.publishedDesign,
            });
          } else if (!status.isPublished) {
            setLastPublishedSnapshot(null);
          }
        }}
        onToast={notify}
        onSignIn={signIn}
      />

      <AdvancedDeployModal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        user={mounted ? user : null}
        profile={profile}
        portfolioConfig={portfolioConfig}
        onToast={notify}
        onSignIn={signIn}
      />

      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status" aria-live="polite">{toastMessage}</div>
    </>
  );
}
