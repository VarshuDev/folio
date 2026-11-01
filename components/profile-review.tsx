'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { AIProposalReview } from '@/components/ai-proposal-review';
import type { ClarifyingQuestion, ProfileSuggestion } from '@/lib/ai/contract';
import { type ProfileDocument, type Project } from '@/lib/profile-schema';

type ReviewOrigin = 'quick' | 'paste' | 'existing';
type MoveTarget = 'highlights' | 'activities';
type ProfileListKey = 'skills' | 'interests' | 'highlights' | 'activities';

type ProfileReviewProps = {
  profile: ProfileDocument;
  saveStatus: string;
  origin: ReviewOrigin;
  sourceTextByKey?: Record<string, string>;
  onProfileChange: (profile: ProfileDocument) => void;
  onAnswerSync?: (key: string, value: string, index?: number) => void;
  onAnswerRemove?: (key: string, index?: number) => void;
  onSourceTextChange?: (oldKey: string, newKey: string, text: string) => void;
  aiSuggestions?: ProfileSuggestion[];
  aiClarifyingQuestions?: ClarifyingQuestion[];
  aiAlreadyPresent?: string[];
  aiRepeatedSuggestions?: string[];
  onAISuggestionAccepted?: (suggestion: ProfileSuggestion, profile: ProfileDocument) => void;
  unavailableSourceKeys?: string[];
  manualSourceKeys?: string[];
  onMarkManualSource?: (key: string) => void;
  onBack: () => void;
  backLabel: string;
  onContinueToDesign: () => void;
  onEditManually: () => void;
  onSaveExit: () => void;
};

type SourceInfo = { label: string; text?: string };

function safeExternalUrl(raw: string) {
  const value = raw.trim();
  if (!value) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLearningList(profile: ProfileDocument) {
  const learning = profile.learning.trim();
  const topics = new Set(uniqueValues([...profile.skills, ...profile.interests]).map((topic) => topic.toLocaleLowerCase()));
  if (!learning || topics.size === 0) return false;
  if (topics.has(learning.toLocaleLowerCase())) return true;
  const parts = learning.split(/[,;\n]+|\s+and\s+|\s*&\s*/i).map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 && !/[.!?]/.test(learning) && parts.every((item) => topics.has(item.toLocaleLowerCase()));
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = value.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function StageProgress() {
  return (
    <ol className="intake-stage-list profile-review-progress" aria-label="Portfolio creation progress">
      <li className="complete"><span>1</span><b>Tell us</b></li>
      <li className="current" aria-current="step"><span>2</span><b>Review</b></li>
      <li><span>3</span><b>Design</b></li>
      <li><span>4</span><b>Edit</b></li>
    </ol>
  );
}

function ReviewSource({ source, fallback }: { source?: SourceInfo; fallback: string }) {
  if (!source?.text) return <span className="review-source-label">{source?.label ?? fallback}</span>;
  return <details className="review-source">
    <summary>{source.label}</summary>
    <blockquote>{source.text}</blockquote>
  </details>;
}

function MoreActions({
  label,
  onRemove,
  moveOptions,
  onMove,
}: {
  label: string;
  onRemove?: () => void;
  moveOptions?: { value: MoveTarget; label: string }[];
  onMove?: (target: MoveTarget) => void;
}) {
  const [moveTo, setMoveTo] = useState('');
  if (!onRemove && !moveOptions?.length) return null;
  return (
    <details className="review-more-actions">
      <summary aria-label={`More actions for ${label}`}>More</summary>
      <div className="review-more-menu">
        {moveOptions?.length && onMove && <label className="review-move-label">
          <span>Move to</span>
          <select aria-label={`Move ${label} to`} value={moveTo} onChange={(event) => {
            const target = event.target.value as MoveTarget;
            if (!target) return;
            onMove(target);
            setMoveTo('');
          }}>
            <option value="">Choose a section</option>
            {moveOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>}
        {onRemove && <button type="button" className="review-remove-action" onClick={onRemove}>Remove</button>}
      </div>
    </details>
  );
}

function ReviewTextItem({
  itemKey,
  label,
  value,
  source,
  fallbackSource,
  multiline = false,
  maxLength,
  inputType = 'text',
  onSave,
  onRemove,
  moveOptions,
  onMove,
  onEditStart,
  required = false,
  hint,
}: {
  itemKey: string;
  label: string;
  value: string;
  source?: SourceInfo;
  fallbackSource: string;
  multiline?: boolean;
  maxLength?: number;
  inputType?: string;
  onSave: (value: string) => boolean | void;
  onRemove?: () => void;
  moveOptions?: { value: MoveTarget; label: string }[];
  onMove?: (target: MoveTarget) => void;
  onEditStart?: () => void;
  required?: boolean;
  hint?: string;
}) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState('');

  const beginEdit = () => {
    setDraft(value);
    setEditing(true);
    setError('');
    setKept(false);
    onEditStart?.();
  };
  const itemName = `${label}: ${value.length > 80 ? `${value.slice(0, 77)}…` : value}`;
  const save = () => {
    const next = draft.trim();
    if (required && !next) {
      setError('Add a little text, or choose Cancel.');
      return;
    }
    const result = onSave(next);
    if (result === false) { setError('Check this value and try again.'); return; }
    setEditing(false);
    setError('');
  };

  return (
    <article className={`review-item ${editing ? 'is-editing' : ''}`} data-review-key={itemKey}>
      {editing ? <div className="review-edit-form">
        <label htmlFor={fieldId}>{label}</label>
        {multiline
          ? <textarea autoFocus id={fieldId} value={draft} maxLength={maxLength} onChange={(event) => { setDraft(event.target.value); setError(''); }} />
          : <input autoFocus id={fieldId} type={inputType} value={draft} maxLength={maxLength} onChange={(event) => { setDraft(event.target.value); setError(''); }} />}
        {hint && <p className="review-field-hint">{hint}</p>}
        {error && <p className="review-error" role="alert">{error}</p>}
        <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={() => { setEditing(false); setError(''); }}>Cancel</button><button type="button" className="button small" onClick={save}>Save</button></div>
      </div> : <>
        <div className="review-item-copy">
          <span className="review-item-label">{label}</span>
          <p>{value}</p>
          <ReviewSource source={source} fallback={fallbackSource} />
        </div>
        <div className="review-item-actions">
          <button type="button" className="review-action" aria-label={`Edit ${itemName}`} onClick={beginEdit}>Edit</button>
          <button type="button" className={`review-action review-keep ${kept ? 'kept' : ''}`} aria-label={`${kept ? 'Unkeep' : 'Keep'} ${itemName}`} aria-pressed={kept} onClick={() => setKept((current) => !current)}>{kept ? 'Kept' : 'Keep'}</button>
          <MoreActions label={itemName} onRemove={onRemove} moveOptions={moveOptions} onMove={onMove} />
        </div>
      </>}
    </article>
  );
}

function ReviewProjectItem({
  project,
  source,
  fallbackSource,
  onSave,
  onRemove,
}: {
  project: Project;
  source?: SourceInfo;
  fallbackSource: string;
  onSave: (project: Project) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Project>(project);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState('');
  const beginEdit = () => { setDraft(project); setEditing(true); setKept(false); setError(''); };
  const save = () => {
    const next = { ...draft, title: draft.title.trim(), description: draft.description.trim(), tools: draft.tools.trim(), link: draft.link.trim() };
    if (!next.title && !next.description && !next.tools && !next.link) {
      setError('Add a title or description, or choose Cancel.');
      return;
    }
    onSave(next);
    setEditing(false);
    setError('');
  };
  const update = (key: keyof Pick<Project, 'title' | 'description' | 'tools' | 'link'>, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  return <article className={`review-item review-project ${editing ? 'is-editing' : ''}`} data-review-key={`project:${project.id}`}>
    {editing ? <div className="review-edit-form">
      <div className="review-project-edit-grid">
        <div className="review-field"><label htmlFor={`${id}-title`}>Title</label><input autoFocus id={`${id}-title`} value={draft.title} maxLength={120} onChange={(event) => update('title', event.target.value)} placeholder="Project title" /></div>
        <div className="review-field review-project-description"><label htmlFor={`${id}-description`}>Description</label><textarea id={`${id}-description`} value={draft.description} maxLength={3000} onChange={(event) => update('description', event.target.value)} placeholder="What does it do, or what did you learn?" /></div>
        <div className="review-field"><label htmlFor={`${id}-tools`}>Tools / technologies</label><input id={`${id}-tools`} value={draft.tools} maxLength={240} onChange={(event) => update('tools', event.target.value)} placeholder="e.g. Next.js, Supabase" /></div>
        <div className="review-field"><label htmlFor={`${id}-link`}>Link (optional)</label><input id={`${id}-link`} value={draft.link} maxLength={500} onChange={(event) => update('link', event.target.value)} placeholder="example.com/project" /></div>
      </div>
      {error && <p className="review-error" role="alert">{error}</p>}
      <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={() => { setEditing(false); setError(''); }}>Cancel</button><button type="button" className="button small" onClick={save}>Save</button></div>
    </div> : <>
      <div className="review-item-copy">
        <span className="review-item-label">Project</span>
        <h3 className="review-project-title">{project.title || 'Untitled project'}</h3>
        {project.description && <p>{project.description}</p>}
        {project.tools && <p className="review-project-meta"><strong>Tools / technologies</strong> · {project.tools}</p>}
        {project.link && <p className="review-project-meta"><strong>Link</strong> · {project.link}</p>}
        <ReviewSource source={source} fallback={fallbackSource} />
      </div>
      <div className="review-item-actions">
        <button type="button" className="review-action" aria-label={`Edit project ${project.title || 'untitled project'}`} onClick={beginEdit}>Edit</button>
        <button type="button" className={`review-action review-keep ${kept ? 'kept' : ''}`} aria-label={`${kept ? 'Unkeep' : 'Keep'} project ${project.title || 'untitled project'}`} aria-pressed={kept} onClick={() => setKept((current) => !current)}>{kept ? 'Kept' : 'Keep'}</button>
        <MoreActions label={project.title || 'project'} onRemove={onRemove} />
      </div>
    </>}
  </article>;
}

function ReviewLinkItem({
  index,
  label,
  url,
  source,
  fallbackSource,
  onSave,
  onRemove,
}: {
  index: number;
  label: string;
  url: string;
  source?: SourceInfo;
  fallbackSource: string;
  onSave: (label: string, url: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftUrl, setDraftUrl] = useState(url);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState('');
  const beginEdit = () => { setDraftLabel(label); setDraftUrl(url); setEditing(true); setKept(false); setError(''); };
  const save = () => {
    if (!draftUrl.trim() || !safeExternalUrl(draftUrl)) {
      setError('Add a valid website address, or choose Cancel.');
      return;
    }
    onSave(draftLabel.trim() || 'Portfolio or social link', draftUrl.trim());
    setEditing(false);
    setError('');
  };
  return <article className={`review-item review-link-item ${editing ? 'is-editing' : ''}`} data-review-key={`link:other:${index}`}>
    {editing ? <div className="review-edit-form">
      <div className="review-project-edit-grid">
        <div className="review-field"><label htmlFor={`${id}-name`}>Link name</label><input autoFocus id={`${id}-name`} value={draftLabel} maxLength={60} onChange={(event) => { setDraftLabel(event.target.value); setError(''); }} placeholder="e.g. Portfolio or Instagram" /></div>
        <div className="review-field"><label htmlFor={`${id}-url`}>Link address</label><input id={`${id}-url`} value={draftUrl} maxLength={500} onChange={(event) => { setDraftUrl(event.target.value); setError(''); }} placeholder="example.com/you" /></div>
      </div>
      {error && <p className="review-error" role="alert">{error}</p>}
      <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={() => { setEditing(false); setError(''); }}>Cancel</button><button type="button" className="button small" onClick={save}>Save</button></div>
    </div> : <>
      <div className="review-item-copy">
        <span className="review-item-label">{label || 'Portfolio or social link'}</span>
        <p>{url}</p>
        <ReviewSource source={source} fallback={fallbackSource} />
      </div>
      <div className="review-item-actions">
        <button type="button" className="review-action" aria-label={`Edit link ${label || 'portfolio or social link'}`} onClick={beginEdit}>Edit</button>
        <button type="button" className={`review-action review-keep ${kept ? 'kept' : ''}`} aria-label={`${kept ? 'Unkeep' : 'Keep'} link ${label || 'portfolio or social link'}`} aria-pressed={kept} onClick={() => setKept((current) => !current)}>{kept ? 'Kept' : 'Keep'}</button>
        <MoreActions label={label || 'link'} onRemove={onRemove} />
      </div>
    </>}
  </article>;
}

function AddTextForm({
  label,
  placeholder,
  maxLength = 2000,
  onCancel,
  onSave,
}: {
  label: string;
  placeholder: string;
  maxLength?: number;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { inputRef.current?.focus(); }, []);
  const save = () => {
    if (!value.trim()) { setError('Add a little text, or choose Cancel.'); return; }
    onSave(value.trim());
    setValue('');
    setError('');
  };
  return <div className="review-add-form">
    <label htmlFor={id}>{label}</label>
    <input ref={inputRef} id={id} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => { setValue(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); save(); } }} />
    {error && <p className="review-error" role="alert">{error}</p>}
    <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={onCancel}>Cancel</button><button type="button" className="button small" onClick={save}>Save</button></div>
  </div>;
}

function ReviewSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return <section className={`review-section ${className}`} aria-labelledby={id}>
    <div className="review-section-head"><h2 id={id}>{title}</h2></div>
    {children}
  </section>;
}

export function ProfileReview({
  profile,
  saveStatus,
  origin,
  sourceTextByKey = {},
  onProfileChange,
  onAnswerSync,
  onAnswerRemove,
  onSourceTextChange,
  aiSuggestions,
  aiClarifyingQuestions = [],
  aiAlreadyPresent = [],
  aiRepeatedSuggestions = [],
  onAISuggestionAccepted,
  unavailableSourceKeys = [],
  manualSourceKeys: persistedManualSourceKeys = [],
  onMarkManualSource,
  onBack,
  backLabel,
  onContinueToDesign,
  onEditManually,
  onSaveExit,
}: ProfileReviewProps) {
  const titleId = useId();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById(titleId)?.focus({ preventScroll: true });
  }, [titleId]);
  const [addingProject, setAddingProject] = useState(false);
  const [newProject, setNewProject] = useState<Project>({ id: '', title: '', description: '', tools: '', link: '' });
  const [projectError, setProjectError] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  const [localManualSourceKeys, setLocalManualSourceKeys] = useState<Set<string>>(new Set());
  const source = (key: string): SourceInfo => {
    if (localManualSourceKeys.has(key) || persistedManualSourceKeys.includes(key)) return { label: 'Added by you' };
    if (unavailableSourceKeys.includes(key)) return { label: 'Source excerpt not available' };
    const text = sourceTextByKey[key];
    if (text) return { label: origin === 'paste' ? 'From your note' : 'From your answer', text };
    return { label: origin === 'existing' ? 'From your profile' : origin === 'paste' ? 'From your note' : 'From your answers' };
  };
  const markManual = (key: string) => {
    setLocalManualSourceKeys((current) => new Set(current).add(key));
    onMarkManualSource?.(key);
  };

  const updateBasics = (key: keyof ProfileDocument['basics'], value: string) => onProfileChange({ ...profile, basics: { ...profile.basics, [key]: value } });
  const updateEducation = (key: keyof ProfileDocument['education'], value: string) => onProfileChange({ ...profile, education: { ...profile.education, [key]: value } });
  const updateLink = (key: 'email' | 'github' | 'linkedin', value: string) => onProfileChange({ ...profile, links: { ...profile.links, [key]: value } });

  const syncAnswer = (key: string, value: string, index?: number) => onAnswerSync?.(key, value, index);
  const answerKeyFor = (sourceKey: string) => origin === 'quick' && sourceTextByKey[sourceKey] ? sourceKey : undefined;
  const carrySource = (oldKey: string, newKey: string) => {
    const text = sourceTextByKey[oldKey];
    if (text && newKey && oldKey !== newKey) onSourceTextChange?.(oldKey, newKey, text);
    if ((localManualSourceKeys.has(oldKey) || persistedManualSourceKeys.includes(oldKey)) && newKey && oldKey !== newKey) markManual(newKey);
  };

  const topicSourceKey = (key: 'skills' | 'interests', value: string) => `${key === 'skills' ? 'skill' : 'interest'}:${value}`;
  const updateTopic = (key: 'skills' | 'interests', index: number, value: string) => {
    const oldValue = profile[key][index];
    const nextItems = [...profile[key]];
    if (value.trim()) nextItems[index] = value.trim();
    else nextItems.splice(index, 1);
    const next: ProfileDocument = { ...profile, [key]: uniqueValues(nextItems) };
    const newValue = value.trim();
    carrySource(topicSourceKey(key, oldValue), newValue ? topicSourceKey(key, newValue) : '');
    if (isLearningList(profile)) {
      const learning = uniqueValues([...next.skills, ...next.interests]).join(', ');
      next.learning = learning;
      if (profile.basics.role === profile.learning) next.basics = { ...profile.basics, role: learning.slice(0, 180) };
    }
    onProfileChange(next);
    if (answerKeyFor(topicSourceKey(key, oldValue))) syncAnswer('learning', uniqueValues([...next.skills, ...next.interests]).join(', '));
  };

  const moveTopic = (key: 'skills' | 'interests', index: number, target: MoveTarget) => {
    const value = profile[key][index];
    const nextSource = profile[key].filter((_, itemIndex) => itemIndex !== index);
    const next = { ...profile, [key]: nextSource, [target]: uniqueValues([...profile[target], value]) };
    const oldSourceKey = topicSourceKey(key, value);
    const newSourceKey = `${target === 'highlights' ? 'highlight' : 'activity'}:${value}`;
    carrySource(oldSourceKey, newSourceKey);
    if (isLearningList(profile)) {
      const learning = uniqueValues([...next.skills, ...next.interests]).join(', ');
      next.learning = learning;
      if (profile.basics.role === profile.learning) next.basics = { ...profile.basics, role: learning.slice(0, 180) };
    }
    onProfileChange(next);
    if (answerKeyFor(oldSourceKey)) syncAnswer('learning', uniqueValues([...next.skills, ...next.interests]).join(', '));
  };

  const removeTopic = (key: 'skills' | 'interests', index: number) => updateTopic(key, index, '');

  const movePlainItem = (from: 'highlights' | 'activities', index: number, target: 'highlights' | 'activities') => {
    const value = profile[from][index];
    const nextFrom = profile[from].filter((_, itemIndex) => itemIndex !== index);
    const nextTarget = uniqueValues([...profile[target], value]);
    const next = { ...profile, [from]: nextFrom, [target]: nextTarget };
    onProfileChange(next);
    const sourceKey = `${from === 'highlights' ? 'highlight' : 'activity'}:${value}`;
    const targetSourceKey = `${target === 'highlights' ? 'highlight' : 'activity'}:${value}`;
    carrySource(sourceKey, targetSourceKey);
    if (answerKeyFor(sourceKey)) syncAnswer(from === 'highlights' ? 'proud' : 'participated', value);
  };

  const addText = (key: 'skills' | 'highlights' | 'activities', value: string) => {
    const list = profile[key];
    const limit = key === 'skills' ? 50 : 40;
    if (list.length >= limit || list.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onProfileChange({ ...profile, [key]: [...list, value] });
    markManual(key === 'skills' ? `skill:${value}` : key === 'highlights' ? `highlight:${value}` : `activity:${value}`);
    if (key === 'skills') setAddingSkill(false);
    if (key === 'highlights') setAddingHighlight(false);
    if (key === 'activities') setAddingActivity(false);
  };

  const projectKey = (project: Project) => `project:${project.id}`;
  const otherLinkKey = (label: string, url: string) => `other:${label}::${url}`;
  const handleProjectSave = (project: Project) => {
    const next = { ...profile, projects: profile.projects.map((item) => item.id === project.id ? project : item) };
    onProfileChange(next);
    if (project.id === 'intake-tried' && answerKeyFor(projectKey(project))) syncAnswer('tried', [project.title, project.description].filter(Boolean).join('. '));
    if (project.id === 'intake-proud-project' && answerKeyFor(projectKey(project))) syncAnswer('proud', [project.title, project.description].filter(Boolean).join('. '));
  };

  const removeProject = (project: Project) => {
    onProfileChange({ ...profile, projects: profile.projects.filter((item) => item.id !== project.id) });
    if (project.id === 'intake-tried' && answerKeyFor(projectKey(project))) onAnswerRemove?.('tried');
    if (project.id === 'intake-proud-project' && answerKeyFor(projectKey(project))) onAnswerRemove?.('proud');
  };

  const addProjectItem = () => {
    if (profile.projects.length >= 30) { setProjectError('You can add up to 30 projects.'); return; }
    const title = newProject.title.trim();
    const description = newProject.description.trim();
    if (!title && !description) { setProjectError('Add a title or description, or choose Cancel.'); return; }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `review-project-${Date.now()}`;
    onProfileChange({ ...profile, projects: [...profile.projects, { ...newProject, id, title, description, tools: newProject.tools.trim(), link: newProject.link.trim() }] });
    markManual(`project:${id}`);
    setNewProject({ id: '', title: '', description: '', tools: '', link: '' });
    setProjectError('');
    setAddingProject(false);
  };

  const addLinkItem = () => {
    if (!newLinkUrl.trim() || !safeExternalUrl(newLinkUrl)) { setLinkError('Add a valid website address, or choose Cancel.'); return; }
    if (profile.links.other.length >= 12) { setLinkError('You can add up to 12 extra links.'); return; }
    const label = newLinkLabel.trim() || 'Portfolio or social link';
    const url = newLinkUrl.trim();
    onProfileChange({ ...profile, links: { ...profile.links, other: [...profile.links.other, { label, url }] } });
    markManual(otherLinkKey(label, url));
    setNewLinkLabel('');
    setNewLinkUrl('');
    setLinkError('');
    setAddingLink(false);
  };

  const removeOtherLink = (index: number) => {
    const item = profile.links.other[index];
    onProfileChange({ ...profile, links: { ...profile.links, other: profile.links.other.filter((_, itemIndex) => itemIndex !== index) } });
    if (item && answerKeyFor(otherLinkKey(item.label, item.url))) onAnswerRemove?.('otherLink', index);
  };

  const updateOtherLink = (index: number, label: string, url: string) => {
    const oldItem = profile.links.other[index];
    const next = { ...profile, links: { ...profile.links, other: profile.links.other.map((item, itemIndex) => itemIndex === index ? { label, url } : item) } };
    onProfileChange(next);
    if (oldItem && answerKeyFor(otherLinkKey(oldItem.label, oldItem.url))) {
      carrySource(otherLinkKey(oldItem.label, oldItem.url), otherLinkKey(label, url));
      syncAnswer('otherLinkLabel', label, index);
      syncAnswer('otherLinkUrl', url, index);
    }
  };

  const learningTopics = [
    ...profile.skills.map((value, index) => ({ key: 'skills' as const, index, value })),
    ...profile.interests.map((value, index) => ({ key: 'interests' as const, index, value })),
  ];
  const learningIsList = isLearningList(profile);
  const learningNote = profile.learning && !learningIsList ? profile.learning : '';
  const visibleRole = profile.basics.role && profile.basics.role !== profile.learning ? profile.basics.role : '';
  const hasIntro = Boolean(profile.basics.name || visibleRole || profile.basics.about || profile.basics.location);
  const hasEducation = Boolean(profile.education.college || profile.education.degree || profile.education.branch || profile.education.gradYear || profile.education.note);

  const fallbackItemSource = origin === 'quick' ? 'From your answers' : origin === 'paste' ? 'From your note' : 'From your profile';

  return (
    <div className="studio screen-fade content-intake profile-review-screen">
      <header className="studio-bar intake-bar">
        <div className="studio-brand"><span className="logo"><span className="logo-mark"><Icon name="leaf" size={14} /></span><span>folio</span></span><span className="bar-separator" /><span className="draft-label">Review your story</span></div>
        <div className="studio-center" role="status" aria-live="polite" aria-atomic="true"><span className="save-dot" aria-hidden="true" /><span>{saveStatus}</span></div>
        <div className="studio-actions"><button className="button subtle small" type="button" onClick={onSaveExit}>Save &amp; exit</button></div>
      </header>

      <main className="intake-main" aria-labelledby={titleId}>
        <section className="profile-review-page">
          <StageProgress />
          <span className="eyebrow">REVIEW YOUR STORY</span>
          <h1 id={titleId} tabIndex={-1}>{aiSuggestions !== undefined ? 'Here’s what I understood' : 'Here’s what you told us'}</h1>
          <p className="profile-review-lead">{aiSuggestions !== undefined
            ? 'Review each optional suggestion. Nothing enters your profile until you keep it or edit and save it.'
            : 'We organized what you shared into a few simple sections. Check anything that needs changing before we use it for your portfolio.'}</p>
          {origin === 'paste' && aiSuggestions === undefined && <p className="profile-review-method-note">Only clearly labelled details are placed into sections. Anything uncertain stays in your original notes.</p>}
          {aiSuggestions !== undefined && <AIProposalReview
            profile={profile}
            suggestions={aiSuggestions}
            clarifyingQuestions={aiClarifyingQuestions}
            alreadyPresent={aiAlreadyPresent}
            repeatedSuggestions={aiRepeatedSuggestions}
            onProfileChange={onProfileChange}
            onSuggestionAccepted={(suggestion, nextProfile) => onAISuggestionAccepted?.(suggestion, nextProfile)}
          />}
          <div className="review-groups">
            <ReviewSection title="A little about you">
              {hasIntro ? <div className="review-items">
                {profile.basics.name && <ReviewTextItem itemKey="basics.name" label="Name" value={profile.basics.name} source={source('name')} fallbackSource={fallbackItemSource} maxLength={120} required onSave={(value) => { updateBasics('name', value); if (answerKeyFor('name')) syncAnswer('name', value); }} onRemove={() => { updateBasics('name', ''); if (answerKeyFor('name')) onAnswerRemove?.('name'); }} />}
                {visibleRole && <ReviewTextItem itemKey="basics.role" label="Short introduction" value={profile.basics.role} source={source('role')} fallbackSource={fallbackItemSource} maxLength={180} onSave={(value) => { updateBasics('role', value); if (answerKeyFor('role')) syncAnswer('learning', value); }} onRemove={() => updateBasics('role', '')} />}
                {profile.basics.about && <ReviewTextItem itemKey="basics.about" label="Short introduction" value={profile.basics.about} source={source('about')} fallbackSource={fallbackItemSource} multiline maxLength={3000} onSave={(value) => updateBasics('about', value)} onRemove={() => updateBasics('about', '')} />}
                {profile.basics.location && <ReviewTextItem itemKey="basics.location" label="Location" value={profile.basics.location} source={source('location')} fallbackSource={fallbackItemSource} maxLength={120} onSave={(value) => { updateBasics('location', value); if (answerKeyFor('location')) syncAnswer('location', value); }} onRemove={() => { updateBasics('location', ''); if (answerKeyFor('location')) onAnswerRemove?.('location'); }} />}
              </div> : <p className="review-empty-copy">Nothing added yet. You can add a name or short introduction later.</p>}
            </ReviewSection>

            <ReviewSection title="Things you’re learning">
              {learningTopics.length > 0 || learningNote ? <div className="review-items">
                {learningTopics.map((topic, index) => {
                  const key = `${topic.key}:${topic.index}:${topic.value}`;
                  const moves = [{ value: 'highlights' as const, label: 'Things you’re proud of' }, { value: 'activities' as const, label: 'Things you participated in' }];
                  return <ReviewTextItem key={key} itemKey={`learning:${key}`} label={topic.key === 'skills' ? 'Skill' : 'Interest'} value={topic.value} source={source(topicSourceKey(topic.key, topic.value))} fallbackSource={fallbackItemSource} maxLength={topic.key === 'skills' ? 80 : 100} required onSave={(value) => updateTopic(topic.key, topic.index, value)} onRemove={() => removeTopic(topic.key, topic.index)} moveOptions={moves} onMove={(target) => moveTopic(topic.key, topic.index, target)} />;
                })}
                {learningNote && <ReviewTextItem itemKey="learning:note" label="Learning note" value={learningNote} source={source('learning')} fallbackSource={fallbackItemSource} multiline maxLength={2000} onSave={(value) => { const next = { ...profile, learning: value, basics: profile.basics.role === profile.learning ? { ...profile.basics, role: value.slice(0, 180) } : profile.basics }; onProfileChange(next); if (answerKeyFor('learning')) syncAnswer('learning', value); }} onRemove={() => { const next = { ...profile, learning: '', basics: profile.basics.role === profile.learning ? { ...profile.basics, role: '' } : profile.basics }; onProfileChange(next); if (answerKeyFor('learning')) onAnswerRemove?.('learning'); }} moveOptions={[{ value: 'highlights', label: 'Things you’re proud of' }, { value: 'activities', label: 'Things you participated in' }]} onMove={(target) => { const text = profile.learning; const next = { ...profile, learning: '', [target]: uniqueValues([...profile[target], text]), basics: profile.basics.role === profile.learning ? { ...profile.basics, role: '' } : profile.basics }; carrySource('learning', `${target === 'highlights' ? 'highlight' : 'activity'}:${text}`); onProfileChange(next); }} />}
              </div> : <p className="review-empty-copy">Nothing added yet. That’s okay—you can add a skill or interest later.</p>}
              {addingSkill ? <AddTextForm label="Skill or topic" placeholder="e.g. Python" maxLength={80} onCancel={() => setAddingSkill(false)} onSave={(value) => addText('skills', value)} /> : profile.skills.length < 50 && <button type="button" className="review-add-button" onClick={() => setAddingSkill(true)}>+ Add skill</button>}
            </ReviewSection>

            <ReviewSection title="Things you tried">
              {profile.projects.length ? <div className="review-items">{profile.projects.map((project) => <ReviewProjectItem key={project.id} project={project} source={source(projectKey(project))} fallbackSource={fallbackItemSource} onSave={handleProjectSave} onRemove={() => removeProject(project)} />)}</div> : <div className="review-empty-state"><strong>You haven’t added a project yet.</strong><p>That’s completely fine. You can add one later.</p></div>}
              {addingProject ? <div className="review-add-form review-project-add-form">
                <div className="review-project-edit-grid">
                  <div className="review-field"><label htmlFor="new-review-project-title">Title</label><input autoFocus id="new-review-project-title" value={newProject.title} maxLength={120} onChange={(event) => setNewProject((current) => ({ ...current, title: event.target.value }))} placeholder="Project title" /></div>
                  <div className="review-field review-project-description"><label htmlFor="new-review-project-description">Description</label><textarea id="new-review-project-description" value={newProject.description} maxLength={3000} onChange={(event) => setNewProject((current) => ({ ...current, description: event.target.value }))} placeholder="What does it do, or what did you learn?" /></div>
                  <div className="review-field"><label htmlFor="new-review-project-tools">Tools / technologies</label><input id="new-review-project-tools" value={newProject.tools} maxLength={240} onChange={(event) => setNewProject((current) => ({ ...current, tools: event.target.value }))} placeholder="e.g. Next.js, Supabase" /></div>
                  <div className="review-field"><label htmlFor="new-review-project-link">Link (optional)</label><input id="new-review-project-link" value={newProject.link} maxLength={500} onChange={(event) => setNewProject((current) => ({ ...current, link: event.target.value }))} placeholder="example.com/project" /></div>
                </div>
                {projectError && <p className="review-error" role="alert">{projectError}</p>}
                <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={() => { setAddingProject(false); setProjectError(''); }}>Cancel</button><button type="button" className="button small" onClick={addProjectItem}>Save project</button></div>
              </div> : profile.projects.length < 30 && <button type="button" className="review-add-button" onClick={() => { setNewProject({ id: '', title: '', description: '', tools: '', link: '' }); setProjectError(''); setAddingProject(true); }}>+ Add project</button>}
            </ReviewSection>

            <ReviewSection title="Things you’re proud of">
              {profile.highlights.length ? <div className="review-items">{profile.highlights.map((value, index) => {
                const key = `${index}:${value}`;
                const answerKey = answerKeyFor(`highlight:${value}`);
                return <ReviewTextItem key={key} itemKey={`highlight:${key}`} label="Highlight" value={value} source={source(`highlight:${value}`)} fallbackSource={fallbackItemSource} multiline maxLength={2000} onSave={(nextValue) => { carrySource(`highlight:${value}`, `highlight:${nextValue}`); const next = [...profile.highlights]; next[index] = nextValue; onProfileChange({ ...profile, highlights: uniqueValues(next) }); if (answerKey) syncAnswer('proud', nextValue); }} onRemove={() => { onProfileChange({ ...profile, highlights: profile.highlights.filter((_, itemIndex) => itemIndex !== index) }); if (answerKey) onAnswerRemove?.('proud'); }} moveOptions={[{ value: 'activities', label: 'Things you participated in' }]} onMove={() => movePlainItem('highlights', index, 'activities')} />;
              })}</div> : <div className="review-empty-state"><strong>Nothing added yet.</strong><p>You can add achievements, events, certifications, or anything meaningful to you later.</p></div>}
              {addingHighlight ? <AddTextForm label="Achievement or something meaningful" placeholder="Add something you’re proud of" onCancel={() => setAddingHighlight(false)} onSave={(value) => addText('highlights', value)} /> : profile.highlights.length < 40 && <button type="button" className="review-add-button" onClick={() => setAddingHighlight(true)}>+ Add something</button>}
            </ReviewSection>

            <ReviewSection title="Things you participated in">
              {profile.activities.length ? <div className="review-items">{profile.activities.map((value, index) => {
                const key = `${index}:${value}`;
                const answerKey = answerKeyFor(`activity:${value}`);
                return <ReviewTextItem key={key} itemKey={`activity:${key}`} label="Activity" value={value} source={source(`activity:${value}`)} fallbackSource={fallbackItemSource} multiline maxLength={2000} onSave={(nextValue) => { carrySource(`activity:${value}`, `activity:${nextValue}`); const next = [...profile.activities]; next[index] = nextValue; onProfileChange({ ...profile, activities: uniqueValues(next) }); if (answerKey) syncAnswer('participated', nextValue); }} onRemove={() => { onProfileChange({ ...profile, activities: profile.activities.filter((_, itemIndex) => itemIndex !== index) }); if (answerKey) onAnswerRemove?.('participated'); }} moveOptions={[{ value: 'highlights', label: 'Things you’re proud of' }]} onMove={() => movePlainItem('activities', index, 'highlights')} />;
              })}</div> : <div className="review-empty-state"><strong>Nothing added here yet.</strong><p>Clubs, events, volunteering, or teams count. You can add something later.</p></div>}
              {addingActivity ? <AddTextForm label="Club, event, team, or contribution" placeholder="What did you take part in?" onCancel={() => setAddingActivity(false)} onSave={(value) => addText('activities', value)} /> : profile.activities.length < 40 && <button type="button" className="review-add-button" onClick={() => setAddingActivity(true)}>+ Add something</button>}
            </ReviewSection>

            <ReviewSection title="Where people can find you">
              <div className="review-items">
                {profile.links.github && <ReviewTextItem itemKey="link:github" label="GitHub" value={profile.links.github} source={source('github')} fallbackSource={fallbackItemSource} maxLength={500} onSave={(value) => { updateLink('github', value); if (answerKeyFor('github')) syncAnswer('github', value); }} onRemove={() => { updateLink('github', ''); if (answerKeyFor('github')) onAnswerRemove?.('github'); }} />}
                {profile.links.linkedin && <ReviewTextItem itemKey="link:linkedin" label="LinkedIn" value={profile.links.linkedin} source={source('linkedin')} fallbackSource={fallbackItemSource} maxLength={500} onSave={(value) => { updateLink('linkedin', value); if (answerKeyFor('linkedin')) syncAnswer('linkedin', value); }} onRemove={() => { updateLink('linkedin', ''); if (answerKeyFor('linkedin')) onAnswerRemove?.('linkedin'); }} />}
                {profile.links.email && <ReviewTextItem itemKey="link:email" label="Email" value={profile.links.email} source={source('email')} fallbackSource={fallbackItemSource} inputType="email" maxLength={254} onSave={(value) => { if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false; updateLink('email', value); if (answerKeyFor('email')) syncAnswer('email', value); return true; }} onRemove={() => { updateLink('email', ''); if (answerKeyFor('email')) onAnswerRemove?.('email'); }} />}
                {profile.links.other.map((item, index) => <ReviewLinkItem key={`${item.label}:${item.url}`} index={index} label={item.label} url={item.url} source={source(otherLinkKey(item.label, item.url))} fallbackSource={fallbackItemSource} onSave={(label, url) => updateOtherLink(index, label, url)} onRemove={() => removeOtherLink(index)} />)}
                {!profile.links.email && !profile.links.github && !profile.links.linkedin && profile.links.other.length === 0 && <p className="review-empty-copy">No links added yet. You can choose what to share later.</p>}
              </div>
              {addingLink ? <div className="review-add-form">
                <div className="review-project-edit-grid">
                  <div className="review-field"><label htmlFor="new-review-link-name">Link name</label><input autoFocus id="new-review-link-name" value={newLinkLabel} maxLength={60} onChange={(event) => { setNewLinkLabel(event.target.value); setLinkError(''); }} placeholder="e.g. Personal website" /></div>
                  <div className="review-field"><label htmlFor="new-review-link-url">Link address</label><input id="new-review-link-url" value={newLinkUrl} maxLength={500} onChange={(event) => { setNewLinkUrl(event.target.value); setLinkError(''); }} placeholder="example.com/you" /></div>
                </div>
                {linkError && <p className="review-error" role="alert">{linkError}</p>}
                <div className="review-edit-actions"><button type="button" className="button secondary small" onClick={() => { setAddingLink(false); setLinkError(''); }}>Cancel</button><button type="button" className="button small" onClick={addLinkItem}>Save link</button></div>
              </div> : profile.links.other.length < 12 && <button type="button" className="review-add-button" onClick={() => { setAddingLink(true); setLinkError(''); }}>+ Add link</button>}
            </ReviewSection>

            {hasEducation && <ReviewSection title="Education" className="review-education-section">
              <div className="review-items">
                {profile.education.college && <ReviewTextItem itemKey="education.college" label="College or university" value={profile.education.college} source={source('education:college')} fallbackSource={fallbackItemSource} maxLength={180} onSave={(value) => { updateEducation('college', value); if (answerKeyFor('education:college')) syncAnswer('college', value); }} onRemove={() => { updateEducation('college', ''); if (answerKeyFor('education:college')) onAnswerRemove?.('college'); }} />}
                {profile.education.degree && <ReviewTextItem itemKey="education.degree" label="Course or degree" value={profile.education.degree} source={source('education:degree')} fallbackSource={fallbackItemSource} maxLength={120} onSave={(value) => { updateEducation('degree', value); if (answerKeyFor('education:degree')) syncAnswer('course', value); }} onRemove={() => { updateEducation('degree', ''); if (answerKeyFor('education:degree')) onAnswerRemove?.('course'); }} />}
                {profile.education.branch && <ReviewTextItem itemKey="education.branch" label="Branch or subject" value={profile.education.branch} source={source('education:branch')} fallbackSource={fallbackItemSource} maxLength={120} onSave={(value) => { updateEducation('branch', value); if (answerKeyFor('education:branch')) syncAnswer('branch', value); }} onRemove={() => { updateEducation('branch', ''); if (answerKeyFor('education:branch')) onAnswerRemove?.('branch'); }} />}
                {profile.education.gradYear && <ReviewTextItem itemKey="education.gradYear" label="Expected graduation year" value={profile.education.gradYear} source={source('education:year')} fallbackSource={fallbackItemSource} maxLength={12} onSave={(value) => { updateEducation('gradYear', value); if (answerKeyFor('education:year')) syncAnswer('gradYear', value); }} onRemove={() => { updateEducation('gradYear', ''); if (answerKeyFor('education:year')) onAnswerRemove?.('gradYear'); }} />}
                {profile.education.note && <ReviewTextItem itemKey="education.note" label="Study note" value={profile.education.note} source={source('education:note')} fallbackSource={fallbackItemSource} multiline maxLength={1500} onSave={(value) => updateEducation('note', value)} onRemove={() => updateEducation('note', '')} />}
              </div>
            </ReviewSection>}
          </div>

          {profile.basics.originalNotes && <details className="review-original-notes">
            <summary><span>Your original notes</span><span className="review-original-open">View original notes</span></summary>
            <pre>{profile.basics.originalNotes}</pre>
          </details>}
          <p className="review-approval-note">Keep, edit, remove, or move details as needed. Continuing approves what’s here for your portfolio; you can still edit it later.</p>
          <div className="profile-review-actions">
            <button type="button" className="button secondary small" onClick={onBack}><Icon name="arrowLeft" size={12} /> {backLabel}</button>
            <div className="profile-review-actions-end"><button type="button" className="button secondary small" onClick={onEditManually}>Edit manually</button><button type="button" className="button small" onClick={onContinueToDesign}>Continue to design <Icon name="arrow" size={12} /></button></div>
          </div>
        </section>
      </main>
    </div>
  );
}
