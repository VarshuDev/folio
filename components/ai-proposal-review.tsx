'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { applyApprovedSuggestion, resolveSuggestion } from '@/lib/ai/proposal-lifecycle';
import { inspectProposal, type ProposalReviewAnalysis } from '@/lib/ai/review-merge';
import type { ClarifyingQuestion, ProfileSuggestion } from '@/lib/ai/contract';
import type { ProfileDocument } from '@/lib/profile-schema';

// Keep client form values aligned with the server allowlist without accepting arbitrary paths.
type ProjectValue = { title: string; description: string; tools: string; link: string };
type OtherLinkValue = { label: string; url: string };
type EditableValue = string | ProjectValue | OtherLinkValue;

const CONFIDENCE_LABELS = {
  high: 'Higher AI estimate — check',
  medium: 'Some uncertainty',
  low: 'Uncertain',
} as const;

function valueSummary(suggestion: ProfileSuggestion) {
  const value = suggestion.proposedValue;
  if (suggestion.path === 'projects' && value && typeof value === 'object') {
    const project = value as ProjectValue;
    return project.title || project.description || 'Project suggestion';
  }
  if (suggestion.path === 'links.other' && value && typeof value === 'object') {
    const link = value as OtherLinkValue;
    return link.label || link.url || 'Link suggestion';
  }
  return typeof value === 'string' ? value : 'Profile suggestion';
}

function editableValue(suggestion: ProfileSuggestion): EditableValue {
  if (suggestion.path === 'projects' && suggestion.proposedValue && typeof suggestion.proposedValue === 'object') {
    const value = suggestion.proposedValue as ProjectValue;
    return { title: value.title, description: value.description, tools: value.tools, link: value.link };
  }
  if (suggestion.path === 'links.other' && suggestion.proposedValue && typeof suggestion.proposedValue === 'object') {
    const value = suggestion.proposedValue as OtherLinkValue;
    return { label: value.label, url: value.url };
  }
  return typeof suggestion.proposedValue === 'string' ? suggestion.proposedValue : '';
}

function displayValue(suggestion: ProfileSuggestion) {
  if (suggestion.path === 'projects' && suggestion.proposedValue && typeof suggestion.proposedValue === 'object') {
    const project = suggestion.proposedValue as ProjectValue;
    return <div className="ai-proposed-fields">
      {project.title && <div><span>Project</span><p>{project.title}</p></div>}
      {project.description && <div><span>What you shared</span><p>{project.description}</p></div>}
      {project.tools && <div><span>Tools mentioned</span><p>{project.tools}</p></div>}
      {project.link && <div><span>Link</span><p>{project.link}</p></div>}
    </div>;
  }
  if (suggestion.path === 'links.other' && suggestion.proposedValue && typeof suggestion.proposedValue === 'object') {
    const link = suggestion.proposedValue as OtherLinkValue;
    return <div className="ai-proposed-fields">
      <div><span>Link name</span><p>{link.label}</p></div>
      <div><span>Address</span><p>{link.url}</p></div>
    </div>;
  }
  return <p className="ai-proposed-value">{typeof suggestion.proposedValue === 'string' ? suggestion.proposedValue : ''}</p>;
}

function maxLengthForSuggestion(suggestion: ProfileSuggestion) {
  switch (suggestion.path) {
    case 'basics.name': return 120;
    case 'basics.role': return 180;
    case 'basics.about': return 3000;
    case 'basics.location': return 120;
    case 'education.college': return 180;
    case 'education.degree': return 120;
    case 'education.branch': return 120;
    case 'education.gradYear': return 12;
    case 'education.note': return 1500;
    case 'skills': return 80;
    case 'interests': return 100;
    case 'highlights':
    case 'activities': return 2000;
    case 'learning': return 2000;
    case 'links.email': return 254;
    case 'links.github':
    case 'links.linkedin': return 500;
    default: return 2000;
  }
}

function EditProposalForm({
  suggestion,
  initialValue,
  onCancel,
  onSave,
}: {
  suggestion: ProfileSuggestion;
  initialValue: EditableValue;
  onCancel: () => void;
  onSave: (value: EditableValue) => void;
}) {
  const id = useId();
  const [value, setValue] = useState<EditableValue>(initialValue);
  const [error, setError] = useState('');
  const multiline = ['basics.about', 'education.note', 'learning', 'highlights', 'activities'].includes(suggestion.path);

  const updateText = (next: string) => { setValue(next); setError(''); };
  const updateProject = (key: keyof ProjectValue, next: string) => setValue((current) => ({ ...(current as ProjectValue), [key]: next }));
  const updateOtherLink = (key: keyof OtherLinkValue, next: string) => setValue((current) => ({ ...(current as OtherLinkValue), [key]: next }));
  const submit = () => {
    if (typeof value === 'string' && !value.trim()) {
      setError('Add a little text, or choose Cancel.');
      return;
    }
    if (suggestion.path === 'projects') {
      const project = value as ProjectValue;
      if (!project.title.trim() && !project.description.trim()) { setError('Add a title or description, or choose Cancel.'); return; }
      onSave({ ...project, title: project.title.trim(), description: project.description.trim(), tools: project.tools.trim(), link: project.link.trim() });
      return;
    }
    if (suggestion.path === 'links.other') {
      const link = value as OtherLinkValue;
      if (!link.label.trim() || !link.url.trim()) { setError('Add both a link name and address, or choose Cancel.'); return; }
      onSave({ label: link.label.trim(), url: link.url.trim() });
      return;
    }
    onSave(typeof value === 'string' ? value.trim() : value);
  };

  return <div className="ai-edit-form">
    {suggestion.path === 'projects' ? <div className="review-project-edit-grid">
      {(['title', 'description', 'tools', 'link'] as const).map((key) => <div className={`review-field ${key === 'description' ? 'review-project-description' : ''}`} key={key}>
        <label htmlFor={`${id}-${key}`}>{key === 'title' ? 'Project title' : key === 'description' ? 'Description' : key === 'tools' ? 'Tools / technologies' : 'Link (optional)'}</label>
        {key === 'description'
          ? <textarea autoFocus id={`${id}-${key}`} maxLength={key === 'description' ? 3000 : undefined} value={(value as ProjectValue)[key]} onChange={(event) => updateProject(key, event.target.value)} />
          : <input autoFocus={key === 'title'} id={`${id}-${key}`} maxLength={key === 'title' ? 120 : key === 'tools' ? 240 : 500} value={(value as ProjectValue)[key]} onChange={(event) => updateProject(key, event.target.value)} />}
      </div>)}
    </div> : suggestion.path === 'links.other' ? <div className="review-project-edit-grid">
      <div className="review-field"><label htmlFor={`${id}-label`}>Link name</label><input autoFocus id={`${id}-label`} maxLength={60} value={(value as OtherLinkValue).label} onChange={(event) => updateOtherLink('label', event.target.value)} /></div>
      <div className="review-field"><label htmlFor={`${id}-url`}>Address</label><input id={`${id}-url`} maxLength={500} value={(value as OtherLinkValue).url} onChange={(event) => updateOtherLink('url', event.target.value)} /></div>
    </div> : <div className="ai-edit-field">
      <label htmlFor={`${id}-value`}>{suggestion.path.split('.').at(-1)?.replace(/([A-Z])/g, ' $1') ?? 'Suggested value'}</label>
      {multiline
        ? <textarea autoFocus id={`${id}-value`} maxLength={maxLengthForSuggestion(suggestion)} value={typeof value === 'string' ? value : ''} onChange={(event) => updateText(event.target.value)} />
        : <input autoFocus id={`${id}-value`} type={suggestion.path === 'links.email' ? 'email' : 'text'} maxLength={maxLengthForSuggestion(suggestion)} value={typeof value === 'string' ? value : ''} onChange={(event) => updateText(event.target.value)} />}
    </div>}
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={onCancel}>Cancel</button><button type="button" className="button small" onClick={submit}>Save and keep</button></div>
  </div>;
}

function ProposalCard({
  suggestion,
  profile,
  onProfileChange,
  onAccepted,
  onRejected,
}: {
  suggestion: ProfileSuggestion;
  profile: ProfileDocument;
  onProfileChange: (profile: ProfileDocument) => void;
  onAccepted: (suggestion: ProfileSuggestion, profile: ProfileDocument) => void;
  onRejected: (suggestion: ProfileSuggestion) => void;
}) {
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [resolvedNote, setResolvedNote] = useState('');
  const analysis: ProposalReviewAnalysis = inspectProposal(profile, suggestion);
  const proposalLabel = valueSummary(suggestion);

  const apply = (decision: { action: 'accept' } | { action: 'edit'; proposedValue: EditableValue }) => {
    const resolved = resolveSuggestion(suggestion, decision);
    if (!resolved.ok) { setError('This suggestion could not be checked. Remove it and keep the original notes.'); return; }
    const applied = applyApprovedSuggestion(profile, resolved.suggestion);
    if (!applied.ok) {
      setError(applied.reason === 'collection_limit'
        ? 'This profile section is full. Remove or edit an existing item before keeping this one.'
        : 'This suggestion could not be added safely. Your profile is unchanged.');
      return;
    }
    if (applied.changed) onProfileChange(applied.profile);
    onAccepted(resolved.suggestion, applied.profile);
    setResolvedNote(applied.changed ? 'Kept and added to your profile.' : 'This value was already in your profile; no duplicate was added.');
    setError('');
    setEditing(false);
  };

  const reject = () => {
    const resolved = resolveSuggestion(suggestion, { action: 'reject' });
    if (!resolved.ok) { setError('This suggestion could not be removed safely.'); return; }
    onRejected(resolved.suggestion);
  };

  return <article className={`ai-suggestion-card ${analysis.kind === 'conflict' || analysis.kind === 'possible_duplicate' ? 'has-warning' : ''}`} aria-labelledby={titleId}>
    <div className="ai-suggestion-heading">
      <div><span className="ai-field-name">{analysis.label} suggestion</span><h3 id={titleId}>{proposalLabel}</h3></div>
      <span className={`ai-confidence ai-confidence-${suggestion.confidence}`}>{CONFIDENCE_LABELS[suggestion.confidence]}</span>
    </div>
    {!editing && <div className="ai-suggestion-value">{displayValue(suggestion)}</div>}
    <p className="ai-suggestion-reason">{suggestion.reason}</p>
    {analysis.message && <div className={`ai-merge-warning ai-merge-${analysis.kind}`} role={analysis.kind === 'conflict' ? 'note' : undefined}>
      <strong>{analysis.kind === 'duplicate' ? 'Already in your profile' : analysis.kind === 'possible_duplicate' ? 'Possible match' : analysis.kind === 'conflict' ? 'Check before replacing' : ''}</strong>
      <span>{analysis.message}</span>
      {analysis.existingValue && <blockquote>{analysis.existingValue}</blockquote>}
    </div>}
    {suggestion.provenance.status === 'exact' ? <details className="ai-source-excerpt">
      <summary>Show source note</summary><blockquote>{suggestion.provenance.text}</blockquote>
    </details> : <p className="ai-source-unavailable">Source excerpt not available — please verify this suggestion carefully.</p>}
    {editing ? <EditProposalForm suggestion={suggestion} initialValue={editableValue(suggestion)} onCancel={() => { setEditing(false); setError(''); }} onSave={(proposedValue) => apply({ action: 'edit', proposedValue })} /> : <div className="ai-suggestion-actions">
      <button type="button" className="button small" onClick={() => apply({ action: 'accept' })}>Keep</button>
      <button type="button" className="button secondary small" onClick={() => { setEditing(true); setError(''); }}>Edit</button>
      <button type="button" className="button subtle small" aria-label={`Remove suggestion: ${proposalLabel}`} onClick={reject}>Remove</button>
    </div>}
    {error && <p className="review-error" role="alert">{error}</p>}
    {resolvedNote && <p className="ai-resolved-note" role="status">{resolvedNote}</p>}
  </article>;
}

export function AIProposalReview({
  profile,
  suggestions,
  clarifyingQuestions,
  alreadyPresent,
  repeatedSuggestions,
  onProfileChange,
  onSuggestionAccepted,
}: {
  profile: ProfileDocument;
  suggestions: ProfileSuggestion[];
  clarifyingQuestions: ClarifyingQuestion[];
  alreadyPresent: string[];
  repeatedSuggestions: string[];
  onProfileChange: (profile: ProfileDocument) => void;
  onSuggestionAccepted: (suggestion: ProfileSuggestion, profile: ProfileDocument) => void;
}) {
  const [pending, setPending] = useState(() => suggestions);
  const [decisionSummary, setDecisionSummary] = useState('');
  const decisionSummaryRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (decisionSummary) decisionSummaryRef.current?.focus(); }, [decisionSummary]);

  const rejectSuggestion = (suggestion: ProfileSuggestion) => {
    setPending((current) => current.filter((item) => item.id !== suggestion.id));
    setDecisionSummary(`Removed “${valueSummary(suggestion)}”. Your profile was not changed by this suggestion.`);
  };

  const acceptSuggestion = (suggestion: ProfileSuggestion, nextProfile: ProfileDocument) => {
    onSuggestionAccepted(suggestion, nextProfile);
    setPending((current) => current.filter((item) => item.id !== suggestion.id));
    setDecisionSummary(`Kept “${valueSummary(suggestion)}”.`);
  };

  return <section className="ai-suggestions-panel" aria-labelledby="ai-suggestions-title">
    <div className="ai-suggestions-head">
      <span className="eyebrow">FROM YOUR NOTES</span>
      <h2 id="ai-suggestions-title">Suggestions to review</h2>
      <p>Nothing is added until you choose <strong>Keep</strong> or edit and save it. You can remove anything you don’t want.</p>
    </div>
    {alreadyPresent.length > 0 && <p className="ai-already-present" role="note"><strong>Already in your profile:</strong> {alreadyPresent.join(' · ')}. No changes were made for these values.</p>}
    {repeatedSuggestions.length > 0 && <p className="ai-repeated-note" role="note"><strong>Repeated suggestions were left out:</strong> {repeatedSuggestions.join(' · ')}. Your profile was not changed for these values.</p>}
    {clarifyingQuestions.length > 0 && <div className="ai-clarifying-box">
      <h3>One or two details may need a check</h3>
      <ul>{clarifyingQuestions.map((item, index) => <li key={`${index}:${item.question}`}>
        <p>{item.question}</p>
        {item.provenance.status === 'exact' ? <details className="ai-source-excerpt"><summary>Show related note</summary><blockquote>{item.provenance.text}</blockquote></details> : <span className="ai-source-unavailable">No exact source excerpt.</span>}
      </li>)}</ul>
      <p className="ai-clarifying-manual">You can answer by adding a little more to your notes or leave it blank for now.</p>
    </div>}
    {pending.length > 0 ? <div className="ai-suggestion-list">
      {pending.map((suggestion) => <ProposalCard key={suggestion.id} suggestion={suggestion} profile={profile} onProfileChange={onProfileChange} onAccepted={acceptSuggestion} onRejected={rejectSuggestion} />)}
    </div> : <p className="ai-suggestions-complete" role="status">{suggestions.length === 0 && alreadyPresent.length === 0
      ? 'No profile suggestions were ready. Your original notes are still here.'
      : 'You’ve reviewed every suggestion. Kept details are in your profile; removed suggestions were left out.'}</p>}
    {decisionSummary && <p ref={decisionSummaryRef} tabIndex={-1} className="ai-decision-summary" role="status" aria-live="polite">{decisionSummary}</p>}
  </section>;
}
