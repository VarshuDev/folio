'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import {
  AIServiceResultSchema,
  type CopyImprovementAction,
  type CopyImprovementProposal,
  type ImproveCopyPath,
  projectIndexFromCopyPath,
} from '@/lib/ai/contract';
import { applyApprovedSuggestion, resolveSuggestion } from '@/lib/ai/proposal-lifecycle';
import type { ProfileDocument } from '@/lib/profile-schema';

const ACTIONS: Array<{ value: CopyImprovementAction; label: string }> = [
  { value: 'clearer', label: 'Make clearer' },
  { value: 'shorten', label: 'Shorten' },
  { value: 'professional', label: 'Make more professional' },
];

type Props = {
  profile: ProfileDocument;
  path: ImproveCopyPath;
  text: string;
  label: string;
  /** This id is local only and is never sent to /api/ai. */
  localProjectId?: string;
  onProfileChange: (profile: ProfileDocument) => void;
  onApplied?: () => void;
};

type Phase = 'closed' | 'choose' | 'consent' | 'processing' | 'results';

function targetStillMatches(profile: ProfileDocument, path: ImproveCopyPath, text: string, localProjectId?: string): boolean {
  if (path === 'basics.about') return profile.basics.about === text;
  const index = projectIndexFromCopyPath(path);
  if (index === null) return false;
  const project = profile.projects[index];
  return Boolean(project && project.description === text && (!localProjectId || project.id === localProjectId));
}

function errorForCopy(code: string) {
  switch (code) {
    case 'unavailable': return 'AI suggestions are not available right now. Your original text is unchanged; keep editing manually.';
    case 'timeout': return 'AI suggestions took too long. Your original text is unchanged; try again or keep editing manually.';
    case 'rate_limited': return 'AI suggestions are temporarily limited. Your original text is unchanged; try again later or keep editing manually.';
    case 'request_too_large': return 'This text is too long to send for suggestions. Your original text is unchanged; keep editing manually.';
    case 'invalid_response':
    case 'empty_response': return 'We could not safely use those suggestions. Your original text is unchanged; keep editing manually.';
    default: return 'AI suggestions are temporarily unavailable. Your original text is unchanged; keep editing manually.';
  }
}

function statusLabel(status: CopyImprovementProposal['status']) {
  switch (status) {
    case 'suggested': return 'Suggested · needs your review';
    case 'accepted': return 'Used in your profile';
    case 'edited': return 'Edited and used';
    case 'rejected': return 'Dismissed';
    case 'deferred': return 'Not selected';
  }
}

export function AIImproveCopy({ profile, path, text, label, localProjectId, onProfileChange, onApplied }: Props) {
  const id = useId();
  const [phase, setPhase] = useState<Phase>('closed');
  const [action, setAction] = useState<CopyImprovementAction>('clearer');
  const [suggestions, setSuggestions] = useState<CopyImprovementProposal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [sourceAtRequest, setSourceAtRequest] = useState('');
  const latest = useRef({ profile, text, localProjectId });
  const abortRequest = useRef<AbortController | null>(null);
  const firstAction = useRef<HTMLInputElement>(null);
  const consentHeading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  latest.current = { profile, text, localProjectId };

  useEffect(() => {
    if (phase === 'choose') firstAction.current?.focus();
    if (phase === 'consent') consentHeading.current?.focus({ preventScroll: true });
    if (phase === 'results') resultsHeading.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => () => abortRequest.current?.abort(), []);

  const close = () => {
    abortRequest.current?.abort();
    abortRequest.current = null;
    setPhase('closed');
    setEditingId(null);
    setError('');
    setAnnouncement('');
    trigger.current?.focus();
  };

  const generate = async () => {
    const originalText = text;
    if (!originalText.trim()) {
      setError('Add some text before asking for alternatives.');
      setPhase('choose');
      return;
    }
    if (!targetStillMatches(profile, path, originalText, localProjectId)) {
      setError('This text changed. Close this panel and try again with the current version.');
      setPhase('choose');
      return;
    }

    setError('');
    setAnnouncement('');
    setSourceAtRequest(originalText);
    setPhase('processing');
    const controller = new AbortController();
    abortRequest.current = controller;
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'improve_copy', path, text: originalText, action }),
        signal: controller.signal,
        cache: 'no-store',
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        setError('AI suggestions could not be read. Your original text is unchanged; keep editing manually or try again.');
        setPhase('consent');
        return;
      }
      const parsed = AIServiceResultSchema.safeParse(body);
      if (!parsed.success || !response.ok || !parsed.data.ok) {
        const code = parsed.success && !parsed.data.ok ? parsed.data.error.code : 'provider_failure';
        setError(parsed.success && !parsed.data.ok ? errorForCopy(code) : errorForCopy('provider_failure'));
        setPhase('consent');
        return;
      }
      if (parsed.data.operation !== 'improve_copy' || parsed.data.mode !== 'provider'
        || parsed.data.suggestions.length < 2 || parsed.data.suggestions.length > 3
        || parsed.data.suggestions.some((item) => item.path !== path || item.originalText !== originalText || item.action !== action)) {
        setError(errorForCopy('invalid_response'));
        setPhase('consent');
        return;
      }
      const current = latest.current;
      if (current.text !== originalText || !targetStillMatches(current.profile, path, originalText, current.localProjectId)) {
        setError('The text changed while suggestions were being prepared. Nothing was applied. Keep editing or try again.');
        setPhase('consent');
        return;
      }
      setSuggestions(parsed.data.suggestions);
      setPhase('results');
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') return;
      setError('AI suggestions are temporarily unavailable. Your original text is unchanged; keep editing manually or try again.');
      setPhase('consent');
    } finally {
      abortRequest.current = null;
    }
  };

  const chooseStatus = (proposal: CopyImprovementProposal, decision: 'accept' | 'edit' | 'reject') => {
    if (!targetStillMatches(profile, proposal.path, proposal.originalText, localProjectId)) {
      setError('This text has changed since the suggestions were made. Nothing was applied; generate new suggestions for the current text.');
      setAnnouncement('Suggestions are out of date.');
      return;
    }

    if (decision === 'reject') {
      const resolved = resolveSuggestion(proposal, { action: 'reject' });
      if (!resolved.ok) { setError('This suggestion could not be dismissed safely.'); return; }
      setSuggestions((current) => current.map((item) => item.id === proposal.id ? resolved.suggestion : item));
      setAnnouncement('Suggestion dismissed. Your original text is unchanged.');
      return;
    }

    const rawDecision = decision === 'accept'
      ? { action: 'accept' as const }
      : { action: 'edit' as const, proposedValue: editedText.trim() };
    const resolved = resolveSuggestion(proposal, rawDecision);
    if (!resolved.ok) {
      setError(decision === 'edit' ? 'Add a little text before using this edited version.' : 'This suggestion could not be checked safely.');
      return;
    }
    const applied = applyApprovedSuggestion(profile, resolved.suggestion);
    if (!applied.ok) {
      setError(applied.reason === 'stale_source'
        ? 'The original text changed, so this suggestion was not applied. Generate new suggestions for the current text.'
        : 'This suggestion could not be applied safely. Your profile is unchanged.');
      return;
    }
    onProfileChange(applied.profile);
    onApplied?.();
    setSuggestions((current) => current.map((item) => {
      if (item.id === proposal.id) return resolved.suggestion as CopyImprovementProposal;
      const deferred = resolveSuggestion(item, { action: 'defer' });
      return deferred.ok ? deferred.suggestion : item;
    }));
    setAnnouncement(decision === 'edit' ? 'Your edited version is now in the profile. Other alternatives were left out.' : 'This version is now in the profile. Other alternatives were left out.');
    setError('');
    setEditingId(null);
  };

  const beginEdit = (proposal: CopyImprovementProposal) => {
    setEditingId(proposal.id);
    setEditedText(proposal.proposedText);
    setError('');
  };

  const dismissAll = () => {
    setSuggestions((current) => current.map((proposal) => {
      if (proposal.status !== 'suggested') return proposal;
      const dismissed = resolveSuggestion(proposal, { action: 'reject' });
      return dismissed.ok ? dismissed.suggestion : proposal;
    }));
    setAnnouncement('Suggestions dismissed. Your original text remains unchanged.');
    setError('');
  };

  const actionLabel = ACTIONS.find((item) => item.value === action)?.label ?? 'Improve';
  const canUse = targetStillMatches(profile, path, sourceAtRequest, localProjectId);
  const visibleSuggestions = suggestions.filter((proposal) => proposal.status === 'suggested');

  return <div className="ai-copy-tool" onKeyDown={(event) => {
    if (event.key === 'Escape' && phase !== 'closed') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }}>
    <button
      ref={trigger}
      type="button"
      className="review-action ai-copy-trigger"
      aria-label={`Improve ${label}`}
      aria-expanded={phase !== 'closed'}
      onClick={() => { if (phase === 'closed') { setError(''); setPhase('choose'); } else close(); }}
    >
      <Icon name="spark" size={12} />
      <span>Improve</span>
    </button>

    {phase === 'choose' && <section className="ai-copy-panel" aria-labelledby={`${id}-choose-title`}>
      <h3 id={`${id}-choose-title`} tabIndex={-1}>Improve this {label.toLocaleLowerCase()}</h3>
      <fieldset className="ai-copy-action-list">
        <legend>What would you like to change?</legend>
        {ACTIONS.map((item, index) => <label key={item.value}>
          <input
            ref={index === 0 ? firstAction : undefined}
            type="radio"
            name={`${id}-action`}
            value={item.value}
            checked={action === item.value}
            onChange={() => setAction(item.value)}
          />
          <span>{item.label}</span>
        </label>)}
      </fieldset>
      <p className="ai-copy-hint">Suggestions can change wording, not the facts. You’ll choose before anything changes.</p>
      {error && <p className="ai-copy-error" role="alert">{error}</p>}
      <div className="ai-copy-actions"><button type="button" className="button secondary small" onClick={close}>Cancel</button><button type="button" className="button small" onClick={() => { setError(''); setPhase('consent'); }}>Continue</button></div>
    </section>}

    {phase === 'consent' && <section className="ai-copy-panel" aria-labelledby={`${id}-consent-title`}>
      <h3 id={`${id}-consent-title`} ref={consentHeading} tabIndex={-1}>Before sending this text</h3>
      <p>The selected {label.toLocaleLowerCase()} and the action “{actionLabel}” will be sent to the configured AI provider, with fixed copy-editing instructions. Your other profile details and design are not sent. You can cancel and keep editing normally.</p>
      <details className="ai-copy-source-preview" open>
        <summary>Text to send</summary>
        <blockquote>{text}</blockquote>
      </details>
      {error && <p className="ai-copy-error" role="alert">{error}</p>}
      <div className="ai-copy-actions"><button type="button" className="button secondary small" onClick={() => { setError(''); setPhase('choose'); }}>Cancel</button><button type="button" className="button small" onClick={generate}>Send this text and generate</button></div>
    </section>}

    {phase === 'processing' && <section className="ai-copy-panel" aria-label="Generating copy alternatives">
      <p className="ai-copy-processing" role="status" aria-live="polite">Checking a few wording alternatives. Your original text is unchanged.</p>
      <button type="button" className="button secondary small" onClick={close}>Cancel request</button>
    </section>}

    {phase === 'results' && <section className="ai-copy-panel ai-copy-results" aria-labelledby={`${id}-results-title`}>
      <div className="ai-copy-results-head">
        <h3 id={`${id}-results-title`} ref={resultsHeading} tabIndex={-1}>Suggested versions</h3>
        <span className="ai-copy-review-state">Needs your review</span>
      </div>
      <div className="ai-copy-source-reference">
        <span>Original {label.toLocaleLowerCase()}</span>
        <blockquote>{sourceAtRequest}</blockquote>
      </div>
      {suggestions.map((proposal, index) => <article className={`ai-copy-option ${proposal.status !== 'suggested' ? 'is-resolved' : ''}`} key={proposal.id}>
        <div className="ai-copy-option-heading">
          <h4>Alternative {index + 1}</h4>
          <span>{statusLabel(proposal.status)}</span>
        </div>
        <p className="ai-copy-proposed-text">{proposal.proposedText}</p>
        <p className="ai-copy-reason">{proposal.reason} <strong>Some uncertainty — check before using.</strong></p>
        <details className="ai-copy-source-reference-details">
          <summary>Source reference</summary>
          <blockquote>{proposal.provenance.text}</blockquote>
        </details>
        {proposal.status === 'suggested' && editingId === proposal.id ? <div className="ai-copy-edit-form">
          <label htmlFor={`${id}-edit-${proposal.id}`}>Edit this version before using it</label>
          <textarea id={`${id}-edit-${proposal.id}`} value={editedText} maxLength={3000} onChange={(event) => { setEditedText(event.target.value); setError(''); }} />
          <div className="ai-copy-actions"><button type="button" className="button secondary small" onClick={() => setEditingId(null)}>Cancel edit</button><button type="button" className="button small" onClick={() => chooseStatus(proposal, 'edit')}>Use edited version</button></div>
        </div> : proposal.status === 'suggested' ? <div className="ai-copy-actions">
          <button type="button" className="button small" disabled={!canUse} onClick={() => chooseStatus(proposal, 'accept')}>Use this</button>
          <button type="button" className="button secondary small" onClick={() => beginEdit(proposal)}>Edit</button>
          <button type="button" className="button subtle small" onClick={() => chooseStatus(proposal, 'reject')}>Dismiss</button>
        </div> : null}
      </article>)}
      {error && <p className="ai-copy-error" role="alert">{error}</p>}
      {visibleSuggestions.length > 0 && <button type="button" className="button subtle small ai-copy-dismiss-all" onClick={dismissAll}>Dismiss all</button>}
      {announcement && <p className="ai-copy-announcement" role="status" aria-live="polite">{announcement}</p>}
      <button type="button" className="button secondary small ai-copy-close" onClick={close}>Done</button>
    </section>}

    {phase === 'closed' && announcement && <p className="ai-copy-announcement" role="status" aria-live="polite">{announcement}</p>}
  </div>;
}
