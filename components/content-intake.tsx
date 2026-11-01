'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { ProfileReview } from '@/components/profile-review';
import { AIServiceResultSchema, type ClarifyingQuestion, type ProfileSuggestion } from '@/lib/ai/contract';
import { prepareProposalReview } from '@/lib/ai/review-merge';
import { type ProfileDocument, type Project } from '@/lib/profile-schema';

type IntakeMethod = 'quick' | 'paste';
type IntakeRoute = 'choice' | 'quick' | 'paste' | 'review';
type OtherLinkDraft = { id: string; label: string; url: string };
type QuickAnswers = {
  name: string;
  learning: string;
  tried: string;
  proud: string;
  participated: string;
  location: string;
  college: string;
  course: string;
  branch: string;
  gradYear: string;
  email: string;
  github: string;
  linkedin: string;
  otherLinks: OtherLinkDraft[];
};

type ContentIntakeProps = {
  profile: ProfileDocument;
  saveStatus: string;
  onProfileChange: (profile: ProfileDocument) => void;
  onIntakeStarted: () => void;
  onChooseLook: () => void;
  onEditManually: () => void;
  onSaveExit: () => void;
};

const QUESTION_COUNT = 6;
const EMPTY_ANSWERS: QuickAnswers = {
  name: '', learning: '', tried: '', proud: '', participated: '', location: '',
  college: '', course: '', branch: '', gradYear: '', email: '', github: '', linkedin: '', otherLinks: [],
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeExternalUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function extractSimpleTopics(raw: string) {
  const text = raw.trim();
  if (!text || /[.!?]/.test(text) || /\b(i|i'm|im|i am|my|currently|interested|curious|learning)\b/i.test(text)) return [];
  const topics = text.split(/[,;\n]+|\s+and\s+|\s*&\s*/i).map((item) => item.trim().replace(/^(?:and|&)\s+/i, '')).filter(Boolean);
  return topics.length > 1 && topics.length <= 50 && topics.every((item) => item.length <= 100) ? topics : [];
}

function projectFieldsFromNotes(raw: string) {
  const text = raw.trim();
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[0].trim()) {
    return { title: lines[0].trim().slice(0, 120), description: lines.slice(1).join('\n').trim() };
  }
  const firstSentence = text.match(/^(.{1,90}?[.!?])(?:\s+|$)/);
  if (firstSentence) {
    return { title: firstSentence[1].trim().slice(0, 120), description: text.slice(firstSentence[0].length).trim() };
  }
  if (text.length <= 84) return { title: text || 'A small thing I tried', description: '' };
  const splitAt = text.lastIndexOf(' ', 80);
  const boundary = splitAt > 24 ? splitAt : 80;
  return { title: `${text.slice(0, boundary).trim()}…`, description: text.slice(boundary).trim() };
}

function clearlyDescribesProject(raw: string) {
  return /\b(built|made|created|developed|designed|coded|programmed|prototyped|wrote|launched)\b/i.test(raw)
    && /\b(app|website|web site|site|program|prototype|tool|game|project|bot|model|page)\b/i.test(raw);
}

function uniqueText(values: string[]) {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = value.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function replaceAnswerText(values: string[], previous: string, next: string) {
  const result = [...values];
  const previousIndex = previous ? result.indexOf(previous) : -1;
  if (previousIndex >= 0) {
    if (next) result[previousIndex] = next;
    else result.splice(previousIndex, 1);
  } else if (next && !result.includes(next)) {
    result.push(next);
  }
  return uniqueText(result);
}

function mergeAnswerTopics(values: string[], previous: string[], next: string[]) {
  const previousSet = new Set(previous.map((item) => item.toLocaleLowerCase()));
  return uniqueText([...values.filter((item) => !previousSet.has(item.toLocaleLowerCase())), ...next]);
}

function upsertMappedProject(projects: Project[], id: string, note: string) {
  if (!note.trim()) return projects.filter((project) => project.id !== id);
  const existing = projects.find((project) => project.id === id);
  const fields = projectFieldsFromNotes(note);
  const next = { id, ...fields, tools: existing?.tools ?? '', link: existing?.link ?? '' };
  const index = projects.findIndex((project) => project.id === id);
  return index < 0 ? [...projects, next] : projects.map((project) => project.id === id ? next : project);
}

function applyQuickAnswerChange(current: ProfileDocument, before: QuickAnswers, after: QuickAnswers, key: keyof QuickAnswers): ProfileDocument {
  const next: ProfileDocument = { ...current };
  if (key === 'name') return { ...next, basics: { ...current.basics, name: after.name.trim() } };
  if (key === 'location') return { ...next, basics: { ...current.basics, location: after.location.trim() } };
  if (key === 'college') return { ...next, education: { ...current.education, college: after.college.trim() } };
  if (key === 'course') return { ...next, education: { ...current.education, degree: after.course.trim() } };
  if (key === 'branch') return { ...next, education: { ...current.education, branch: after.branch.trim() } };
  if (key === 'gradYear') return { ...next, education: { ...current.education, gradYear: after.gradYear.trim() } };
  if (key === 'email') return { ...next, links: { ...current.links, email: after.email.trim() && isValidEmail(after.email) ? after.email.trim() : '' } };
  if (key === 'github') return { ...next, links: { ...current.links, github: after.github.trim() } };
  if (key === 'linkedin') return { ...next, links: { ...current.links, linkedin: after.linkedin.trim() } };
  if (key === 'learning') {
    const previousTopics = extractSimpleTopics(before.learning);
    const nextTopics = extractSimpleTopics(after.learning);
    const role = current.basics.role === before.learning || !current.basics.role ? after.learning.trim().length <= 180 ? after.learning.trim() : '' : current.basics.role;
    return {
      ...next,
      basics: { ...current.basics, role },
      interests: mergeAnswerTopics(current.interests, previousTopics, nextTopics),
      learning: after.learning.trim(),
    };
  }
  if (key === 'tried') return { ...next, projects: upsertMappedProject(current.projects, 'intake-tried', after.tried.trim()) };
  if (key === 'proud') {
    const isNowProject = Boolean(after.proud.trim() && clearlyDescribesProject(after.proud));
    const hadMappedProject = current.projects.some((project) => project.id === 'intake-proud-project');
    let projects = current.projects;
    let highlights = current.highlights;
    if (isNowProject) {
      projects = upsertMappedProject(projects, 'intake-proud-project', after.proud.trim());
      if (!hadMappedProject && before.proud && !clearlyDescribesProject(before.proud)) highlights = replaceAnswerText(highlights, before.proud.trim(), '');
    } else {
      if (hadMappedProject) projects = projects.filter((project) => project.id !== 'intake-proud-project');
      highlights = replaceAnswerText(highlights, before.proud.trim(), after.proud.trim());
    }
    return { ...next, projects, highlights };
  }
  if (key === 'participated') return { ...next, activities: replaceAnswerText(current.activities, before.participated.trim(), after.participated.trim()) };
  if (key === 'otherLinks') {
    const previousPairs = new Set(before.otherLinks.map((item) => `${item.label.trim().toLocaleLowerCase()}\u0000${item.url.trim().toLocaleLowerCase()}`));
    const preserved = current.links.other.filter((item) => !previousPairs.has(`${item.label.trim().toLocaleLowerCase()}\u0000${item.url.trim().toLocaleLowerCase()}`));
    const mapped = after.otherLinks.filter((item) => item.label.trim() || item.url.trim()).slice(0, 12).map((item) => ({ label: item.label.trim().slice(0, 60), url: item.url.trim().slice(0, 500) }));
    const seen = new Set<string>();
    const other = [...preserved, ...mapped].filter((item) => {
      const id = `${item.label.toLocaleLowerCase()}\u0000${item.url.toLocaleLowerCase()}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 12);
    return { ...next, links: { ...current.links, other } };
  }
  return next;
}

function splitLabeledTopics(value: string) {
  const text = value.trim().replace(/[.!?]+$/, '');
  if (!text || /\b(i|i'm|im|i am|my|currently|interested|curious|learning)\b/i.test(text)) return [];
  return uniqueText(text.split(/[,;|]+|\s+and\s+|\s*&\s*/i).map((item) => item.trim()).filter(Boolean));
}

function stableNoteId(line: string) {
  let hash = 2166136261;
  for (let index = 0; index < line.length; index += 1) hash = Math.imul(hash ^ line.charCodeAt(index), 16777619);
  return `note-project-${(hash >>> 0).toString(36)}`;
}

type PasteParseResult = { profile: ProfileDocument; sources: Record<string, string>; appliedLines: string[] };

function parseLabeledNotes(raw: string, current: ProfileDocument, alreadyApplied: Set<string>): PasteParseResult {
  const profile: ProfileDocument = {
    ...current,
    basics: { ...current.basics },
    education: { ...current.education },
    skills: [...current.skills],
    interests: [...current.interests],
    projects: [...current.projects],
    highlights: [...current.highlights],
    activities: [...current.activities],
    links: { ...current.links, other: [...current.links.other] },
  };
  const sources: Record<string, string> = {};
  const appliedLines: string[] = [];
  const lines = raw.split(/\r?\n/);
  const setText = (value: string, sourceKey: string, line: string, maxLength: number, getCurrent: () => string, setValue: (next: string) => void) => {
    if (getCurrent() || !value.trim() || value.trim().length > maxLength) return;
    setValue(value.trim());
    sources[sourceKey] = line;
    appliedLines.push(line);
  };
  const addList = (key: 'skills' | 'interests' | 'highlights' | 'activities', value: string, sourcePrefix: string, line: string, maxLength: number) => {
    const items = (key === 'highlights' || key === 'activities') ? [value.trim()] : splitLabeledTopics(value);
    if (!items.length || items.some((item) => item.length > maxLength)) return;
    for (const item of items) {
      if (!profile[key].some((existing) => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) profile[key] = [...profile[key], item];
      sources[`${sourcePrefix}:${item}`] = line;
    }
    appliedLines.push(line);
  };
  const setSimpleLink = (key: 'email' | 'github' | 'linkedin', value: string, line: string) => {
    const cleaned = value.trim();
    if (!cleaned || profile.links[key] || cleaned.length > 500) return;
    if (key === 'email' && !isValidEmail(cleaned)) return;
    if (key !== 'email' && !safeExternalUrl(cleaned)) return;
    profile.links = { ...profile.links, [key]: cleaned };
    sources[key] = line;
    appliedLines.push(line);
  };

  for (const line of lines) {
    const match = line.match(/^\s*([^:]{1,40})\s*:\s*(.*?)\s*$/);
    if (!match || !match[2].trim() || alreadyApplied.has(line)) continue;
    const label = match[1].trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const value = match[2].trim();
    if (label === 'name' || label === 'full name') setText(value, 'name', line, 120, () => profile.basics.name, (next) => { profile.basics.name = next; });
    else if (label === 'location' || label === 'city' || label === 'based in') setText(value, 'location', line, 120, () => profile.basics.location, (next) => { profile.basics.location = next; });
    else if (['intro', 'introduction', 'short introduction', 'short intro', 'about', 'about me'].includes(label)) setText(value, 'role', line, 180, () => profile.basics.role, (next) => { profile.basics.role = next; });
    else if (label === 'learning' || label === 'currently learning' || label === 'learning about' || label === 'curious about') {
      if (!profile.learning && value.length <= 2000) {
        profile.learning = value;
        if (!profile.basics.role && value.length <= 180) profile.basics.role = value;
        sources.learning = line;
      }
      const topics = splitLabeledTopics(value);
      for (const topic of topics) {
        if (!profile.interests.some((item) => item.toLocaleLowerCase() === topic.toLocaleLowerCase())) profile.interests.push(topic);
        sources[`interest:${topic}`] = line;
      }
      if (!appliedLines.includes(line) && (topics.length > 0 || sources.learning === line)) appliedLines.push(line);
    }
    else if (label === 'skill' || label === 'skills' || label === 'tools') addList('skills', value, 'skill', line, 80);
    else if (label === 'interest' || label === 'interests' || label === 'topics') addList('interests', value, 'interest', line, 100);
    else if (label === 'proud' || label === 'proud of' || label === 'achievement' || label === 'achievements' || label === 'highlight') addList('highlights', value, 'highlight', line, 2000);
    else if (label === 'activity' || label === 'activities' || label === 'participation' || label === 'participated in' || label === 'volunteering') addList('activities', value, 'activity', line, 2000);
    else if (label === 'college' || label === 'university' || label === 'college or university') setText(value, 'education:college', line, 180, () => profile.education.college, (next) => { profile.education.college = next; });
    else if (label === 'course' || label === 'degree') setText(value, 'education:degree', line, 120, () => profile.education.degree, (next) => { profile.education.degree = next; });
    else if (label === 'branch' || label === 'subject') setText(value, 'education:branch', line, 120, () => profile.education.branch, (next) => { profile.education.branch = next; });
    else if (label === 'graduation year' || label === 'grad year' || label === 'expected graduation year') setText(value, 'education:year', line, 12, () => profile.education.gradYear, (next) => { profile.education.gradYear = next; });
    else if (label === 'email') setSimpleLink('email', value, line);
    else if (label === 'github') setSimpleLink('github', value, line);
    else if (label === 'linkedin') setSimpleLink('linkedin', value, line);
    else if (label === 'project' || label === 'built' || label === 'tried') {
      const parts = value.split('|').map((part) => part.trim());
      const title = parts[0]?.slice(0, 120) ?? '';
      const description = (parts[1] ?? '').slice(0, 3000);
      const tools = (parts[2] ?? '').slice(0, 240);
      const link = (parts[3] ?? '').slice(0, 500);
      if (title && (!link || safeExternalUrl(link))) {
        const id = stableNoteId(line);
        if (!profile.projects.some((project) => project.id === id)) profile.projects.push({ id, title, description, tools, link });
        sources[`project:${id}`] = line;
        appliedLines.push(line);
      }
    }
    else if (label === 'link' || label === 'social link' || label === 'portfolio link' || label === 'website') {
      const [linkLabel = '', linkUrl = ''] = value.split('|').map((part) => part.trim());
      if (linkLabel && linkUrl && safeExternalUrl(linkUrl) && profile.links.other.length < 12) {
        const cleanLabel = linkLabel.slice(0, 60);
        const cleanUrl = linkUrl.slice(0, 500);
        if (!profile.links.other.some((link) => link.label === cleanLabel && link.url === cleanUrl)) profile.links.other.push({ label: cleanLabel, url: cleanUrl });
        sources[`other:${cleanLabel}::${cleanUrl}`] = line;
        appliedLines.push(line);
      }
    }
  }
  return { profile, sources, appliedLines };
}

function quickAnswerSources(answers: QuickAnswers) {
  const sources: Record<string, string> = {};
  if (answers.name) sources.name = answers.name;
  if (answers.location) sources.location = answers.location;
  if (answers.learning) {
    sources.learning = answers.learning;
    sources.role = answers.learning;
    for (const topic of extractSimpleTopics(answers.learning)) sources[`interest:${topic}`] = answers.learning;
  }
  if (answers.tried) sources['project:intake-tried'] = answers.tried;
  if (answers.proud) {
    if (clearlyDescribesProject(answers.proud)) sources['project:intake-proud-project'] = answers.proud;
    else sources[`highlight:${answers.proud}`] = answers.proud;
  }
  if (answers.participated) sources[`activity:${answers.participated}`] = answers.participated;
  if (answers.college) sources['education:college'] = answers.college;
  if (answers.course) sources['education:degree'] = answers.course;
  if (answers.branch) sources['education:branch'] = answers.branch;
  if (answers.gradYear) sources['education:year'] = answers.gradYear;
  if (answers.email) sources.email = answers.email;
  if (answers.github) sources.github = answers.github;
  if (answers.linkedin) sources.linkedin = answers.linkedin;
  for (const link of answers.otherLinks) {
    const key = `other:${link.label.trim()}::${link.url.trim()}`;
    const excerpt = link.url.trim() || link.label.trim();
    if (excerpt) sources[key] = excerpt;
  }
  return sources;
}

function IntakeField({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} maxLength={maxLength} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {hint && <div className="field-help">{hint}</div>}
    </div>
  );
}

function aiProposalSourceKey(suggestion: ProfileSuggestion, profile: ProfileDocument): string | null {
  const value = suggestion.proposedValue;
  switch (suggestion.path) {
    case 'basics.name': return 'name';
    case 'basics.role': return 'role';
    case 'basics.about': return 'about';
    case 'basics.location': return 'location';
    case 'education.college': return 'education:college';
    case 'education.degree': return 'education:degree';
    case 'education.branch': return 'education:branch';
    case 'education.gradYear': return 'education:year';
    case 'education.note': return 'education:note';
    case 'skills': return typeof value === 'string' ? `skill:${value}` : null;
    case 'interests': return typeof value === 'string' ? `interest:${value}` : null;
    case 'highlights': return typeof value === 'string' ? `highlight:${value}` : null;
    case 'activities': return typeof value === 'string' ? `activity:${value}` : null;
    case 'learning': return 'learning';
    case 'links.email': return 'email';
    case 'links.github': return 'github';
    case 'links.linkedin': return 'linkedin';
    case 'links.other': {
      if (!value || typeof value !== 'object') return null;
      const link = value as { label?: unknown; url?: unknown };
      return typeof link.label === 'string' && typeof link.url === 'string' ? `other:${link.label}::${link.url}` : null;
    }
    case 'projects': {
      if (!value || typeof value !== 'object') return null;
      const project = value as { title?: unknown; description?: unknown };
      if (typeof project.title !== 'string' || typeof project.description !== 'string') return null;
      const projectTitle = project.title;
      const projectDescription = project.description;
      const match = [...profile.projects].reverse().find((item) =>
        item.title.trim().toLocaleLowerCase() === projectTitle.trim().toLocaleLowerCase()
        && item.description.trim().toLocaleLowerCase() === projectDescription.trim().toLocaleLowerCase(),
      );
      return match ? `project:${match.id}` : null;
    }
    default: return null;
  }
}

export function ContentIntake({ profile, saveStatus, onProfileChange, onIntakeStarted, onChooseLook, onEditManually, onSaveExit }: ContentIntakeProps) {
  const [route, setRoute] = useState<IntakeRoute>('choice');
  const [method, setMethod] = useState<IntakeMethod>('quick');
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuickAnswers>({ ...EMPTY_ANSWERS });
  const [sourceAnswers, setSourceAnswers] = useState<QuickAnswers | null>(null);
  const [pasteNotes, setPasteNotes] = useState(profile.basics.originalNotes || profile.basics.about);
  const [pasteSources, setPasteSources] = useState<Record<string, string>>({});
  const [reviewSourceOverrides, setReviewSourceOverrides] = useState<Record<string, string>>({});
  const [reviewManualSourceKeys, setReviewManualSourceKeys] = useState<Set<string>>(new Set());
  const [reviewUnavailableSourceKeys, setReviewUnavailableSourceKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [aiConsentOpen, setAIConsentOpen] = useState(false);
  const [aiProcessing, setAIProcessing] = useState(false);
  const [aiFailure, setAIFailure] = useState('');
  const [aiFailureRetryable, setAIFailureRetryable] = useState(false);
  const [aiEmptyState, setAIEmptyState] = useState(false);
  const [aiEmptyQuestion, setAIEmptyQuestion] = useState('');
  const [aiSuggestions, setAISuggestions] = useState<ProfileSuggestion[] | null>(null);
  const [aiClarifyingQuestions, setAIClarifyingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [aiAlreadyPresent, setAIAlreadyPresent] = useState<string[]>([]);
  const [aiRepeatedSuggestions, setAIRepeatedSuggestions] = useState<string[]>([]);
  const appliedPasteLines = useRef<Set<string>>(new Set());
  const linkId = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const pasteTextarea = useRef<HTMLTextAreaElement>(null);
  const consentSendButton = useRef<HTMLButtonElement>(null);
  const fallbackManualButton = useRef<HTMLButtonElement>(null);
  const emptyAddDetailsButton = useRef<HTMLButtonElement>(null);
  const processingStatus = useRef<HTMLParagraphElement>(null);
  const rootId = useId();

  useEffect(() => () => requestAbort.current?.abort(), []);
  useEffect(() => {
    if (aiConsentOpen) consentSendButton.current?.focus();
    else if (aiProcessing) processingStatus.current?.focus();
    else if (aiEmptyState) emptyAddDetailsButton.current?.focus();
    else if (aiFailure) fallbackManualButton.current?.focus();
  }, [aiConsentOpen, aiProcessing, aiEmptyState, aiFailure]);

  const sourceKeysForAnswer = (snapshot: QuickAnswers, key: keyof QuickAnswers) => {
    if (key === 'learning') return ['learning', 'role', ...extractSimpleTopics(snapshot.learning).map((topic) => `interest:${topic}`)];
    if (key === 'tried') return ['project:intake-tried'];
    if (key === 'proud') return ['project:intake-proud-project', ...(snapshot.proud ? [`highlight:${snapshot.proud}`] : [])];
    if (key === 'participated') return snapshot.participated ? [`activity:${snapshot.participated}`] : [];
    if (key === 'otherLinks') return snapshot.otherLinks.map((link) => `other:${link.label.trim()}::${link.url.trim()}`);
    if (key === 'name' || key === 'location' || key === 'college' || key === 'course' || key === 'branch' || key === 'gradYear' || key === 'email' || key === 'github' || key === 'linkedin') return [key === 'college' ? 'education:college' : key === 'course' ? 'education:degree' : key === 'branch' ? 'education:branch' : key === 'gradYear' ? 'education:year' : key];
    return [];
  };
  const clearReviewSourcesForAnswer = (snapshot: QuickAnswers, keys: (keyof QuickAnswers)[]) => {
    const staleKeys = new Set(keys.flatMap((key) => sourceKeysForAnswer(snapshot, key)));
    if (staleKeys.size) setReviewSourceOverrides((current) => {
      const next = { ...current };
      staleKeys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const updateAnswers = (next: QuickAnswers, key: keyof QuickAnswers) => {
    clearReviewSourcesForAnswer(answers, [key]);
    setAnswers(next);
    setError('');
    onProfileChange(applyQuickAnswerChange(profile, answers, next, key));
    if (sourceAnswers) setSourceAnswers((current) => current ? { ...current, [key]: next[key] } : current);
  };

  const updateAnswersForKeys = (next: QuickAnswers, keys: (keyof QuickAnswers)[]) => {
    clearReviewSourcesForAnswer(answers, keys);
    setAnswers(next);
    setError('');
    const updatedProfile = keys.reduce((current, key) => applyQuickAnswerChange(current, answers, next, key), profile);
    onProfileChange(updatedProfile);
    if (sourceAnswers) setSourceAnswers((current) => current ? keys.reduce((snapshot, key) => ({ ...snapshot, [key]: next[key] }), current) : current);
  };

  const updateAnswer = <K extends keyof Omit<QuickAnswers, 'otherLinks'>>(key: K, value: QuickAnswers[K]) => {
    updateAnswers({ ...answers, [key]: value }, key);
  };

  const chooseMethod = (next: IntakeMethod) => {
    setMethod(next);
    setError('');
    onIntakeStarted();
    if (next === 'quick') {
      setQuestion(0);
      setRoute('quick');
    } else {
      setPasteNotes(profile.basics.originalNotes || profile.basics.about);
      setRoute('paste');
    }
  };

  const updatePasteNotes = (value: string) => {
    setPasteNotes(value);
    setPasteSources({});
    setError('');
    setAIConsentOpen(false);
    setAIFailure('');
    setAIEmptyState(false);
    setAIEmptyQuestion('');
    setAISuggestions(null);
    setAIClarifyingQuestions([]);
    setAIAlreadyPresent([]);
    setAIRepeatedSuggestions([]);
    onProfileChange({ ...profile, basics: { ...profile.basics, originalNotes: value } });
  };

  const proceedToReview = () => {
    setError('');
    setAIConsentOpen(false);
    setAISuggestions(null);
    setAIClarifyingQuestions([]);
    setAIAlreadyPresent([]);
    setAIRepeatedSuggestions([]);
    if (method === 'quick') {
      setSourceAnswers((current) => current ?? { ...answers, otherLinks: answers.otherLinks.map((link) => ({ ...link })) });
    } else {
      const base = {
        ...profile,
        basics: {
          ...profile.basics,
          originalNotes: pasteNotes,
        },
      };
      const parsed = parseLabeledNotes(pasteNotes, base, appliedPasteLines.current);
      appliedPasteLines.current = new Set([...appliedPasteLines.current, ...parsed.appliedLines]);
      setPasteSources((current) => ({ ...current, ...(pasteNotes ? { about: pasteNotes } : {}), ...parsed.sources }));
      onProfileChange(parsed.profile);
    }
    setRoute('review');
  };

  const proceedToAIReview = (suggestions: ProfileSuggestion[], questions: ClarifyingQuestion[]) => {
    const base = {
      ...profile,
      basics: { ...profile.basics, originalNotes: pasteNotes },
    };
    const prepared = prepareProposalReview(base, suggestions);
    setPasteSources({});
    setAISuggestions(prepared.suggestions);
    setAIAlreadyPresent(prepared.alreadyPresent);
    setAIRepeatedSuggestions(prepared.repeatedSuggestions);
    setAIClarifyingQuestions(questions);
    setAIEmptyState(false);
    setAIFailure('');
    onProfileChange(base);
    setRoute('review');
  };

  const continueManuallyFromPaste = () => {
    setAIFailure('');
    setAIEmptyState(false);
    setAIConsentOpen(false);
    proceedToReview();
  };

  const showAIEmptyState = (question = '') => {
    setAIEmptyState(true);
    setAIEmptyQuestion(question);
    setAIFailure('');
    setAIConsentOpen(false);
  };

  const sendPasteNotesToAI = async () => {
    if (!pasteNotes.trim()) {
      showAIEmptyState();
      return;
    }
    setAIConsentOpen(false);
    setAIFailure('');
    setAIEmptyState(false);
    setAIProcessing(true);
    const controller = new AbortController();
    requestAbort.current = controller;
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'extract_profile', sourceText: pasteNotes }),
        signal: controller.signal,
        cache: 'no-store',
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        setAIFailure('AI assistance could not be used right now. Your notes are unchanged; continue manually or try again.');
        setAIFailureRetryable(true);
        return;
      }
      const parsed = AIServiceResultSchema.safeParse(body);
      if (!parsed.success) {
        setAIFailure('AI assistance returned information we could not safely use. Your notes are unchanged; continue manually.');
        setAIFailureRetryable(false);
        return;
      }
      if (!response.ok || !parsed.data.ok) {
        if (!parsed.data.ok && parsed.data.error.code === 'empty_response') {
          showAIEmptyState();
          return;
        }
        setAIFailure(!parsed.data.ok
          ? parsed.data.error.message
          : 'AI assistance could not be used right now. Your notes are unchanged; continue manually.');
        setAIFailureRetryable(!parsed.data.ok && parsed.data.error.retryable);
        return;
      }
      if (parsed.data.operation !== 'extract_profile') {
        setAIFailure('That assistance is not available here. Your notes are unchanged; continue manually.');
        setAIFailureRetryable(false);
        return;
      }
      // Development fixtures are never shown in the product workflow.
      if (parsed.data.mode !== 'provider') {
        setAIFailure('AI suggestions are not available right now. Your notes are unchanged; continue manually.');
        setAIFailureRetryable(false);
        return;
      }
      if (parsed.data.suggestions.length === 0) {
        showAIEmptyState(parsed.data.clarifyingQuestions[0]?.question ?? '');
        return;
      }
      proceedToAIReview(parsed.data.suggestions, parsed.data.clarifyingQuestions);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') return;
      setAIFailure('AI assistance is temporarily unavailable. Your notes are unchanged; continue manually or try again.');
      setAIFailureRetryable(true);
    } finally {
      requestAbort.current = null;
      setAIProcessing(false);
    }
  };

  const handlePasteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMethod('paste');
    setError('');
    if (!pasteNotes.trim()) {
      showAIEmptyState();
      return;
    }
    setAIFailure('');
    setAIEmptyState(false);
    setAIConsentOpen(true);
  };

  const recordAISuggestionAccepted = (suggestion: ProfileSuggestion, nextProfile: ProfileDocument) => {
    const key = aiProposalSourceKey(suggestion, nextProfile);
    if (!key) return;
    if (suggestion.status === 'edited') {
      setReviewManualSourceKeys((current) => new Set(current).add(key));
      setReviewUnavailableSourceKeys((current) => { const next = new Set(current); next.delete(key); return next; });
      return;
    }
    if (suggestion.provenance.status === 'exact') {
      const excerpt = suggestion.provenance.text;
      setReviewSourceOverrides((current) => ({ ...current, [key]: excerpt }));
      setReviewUnavailableSourceKeys((current) => { const next = new Set(current); next.delete(key); return next; });
    } else {
      setReviewUnavailableSourceKeys((current) => new Set(current).add(key));
    }
  };

  const validateLinks = () => {
    if (answers.email.trim() && !isValidEmail(answers.email)) {
      setError('That email address doesn’t look complete yet. Fix it or choose “Skip for now.”');
      return false;
    }
    const invalidProfileUrl = [
      ['GitHub', answers.github],
      ['LinkedIn', answers.linkedin],
      ...answers.otherLinks.map((link, index) => [link.label.trim() || `Other link ${index + 1}`, link.url] as [string, string]),
    ].find(([, url]) => url.trim() && !safeExternalUrl(url));
    if (invalidProfileUrl) {
      setError(`${invalidProfileUrl[0]} needs a website address, like github.com/you. You can also skip links for now.`);
      return false;
    }
    return true;
  };

  const handleContinue = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (question === QUESTION_COUNT - 1 && !validateLinks()) return;
    setError('');
    if (question === QUESTION_COUNT - 1) {
      proceedToReview();
      return;
    }
    setQuestion((current) => Math.min(QUESTION_COUNT - 1, current + 1));
  };

  const handleSkip = () => {
    const blank: QuickAnswers = { ...answers };
    let changedKeys: (keyof QuickAnswers)[] = [];
    if (question === 0) {
      blank.name = ''; blank.location = ''; blank.college = ''; blank.course = ''; blank.branch = ''; blank.gradYear = '';
      changedKeys = ['name', 'location', 'college', 'course', 'branch', 'gradYear'];
    }
    if (question === 1) { blank.learning = ''; changedKeys = ['learning']; }
    if (question === 2) { blank.tried = ''; changedKeys = ['tried']; }
    if (question === 3) { blank.proud = ''; changedKeys = ['proud']; }
    if (question === 4) { blank.participated = ''; changedKeys = ['participated']; }
    if (question === 5) {
      blank.email = '';
      blank.github = '';
      blank.linkedin = '';
      blank.otherLinks = [];
      changedKeys = ['email', 'github', 'linkedin', 'otherLinks'];
    }
    updateAnswersForKeys(blank, changedKeys);
    if (question === QUESTION_COUNT - 1) {
      setMethod('quick');
      setRoute('review');
      setSourceAnswers((current) => current ?? { ...blank, otherLinks: blank.otherLinks.map((link) => ({ ...link })) });
    } else {
      setQuestion((current) => Math.min(QUESTION_COUNT - 1, current + 1));
    }
  };

  const handleBack = () => {
    setError('');
    if (question === 0) {
      setRoute('choice');
      return;
    }
    setQuestion((current) => Math.max(0, current - 1));
  };

  const addOtherLink = () => {
    const next = { ...answers, otherLinks: [...answers.otherLinks, { id: `other-${linkId.current++}`, label: '', url: '' }] };
    updateAnswers(next, 'otherLinks');
  };

  const updateOtherLink = (id: string, key: 'label' | 'url', value: string) => {
    updateAnswers({ ...answers, otherLinks: answers.otherLinks.map((link) => link.id === id ? { ...link, [key]: value } : link) }, 'otherLinks');
  };

  const removeOtherLink = (id: string) => updateAnswers({ ...answers, otherLinks: answers.otherLinks.filter((link) => link.id !== id) }, 'otherLinks');

  const progressValue = Math.round(((question + 1) / QUESTION_COUNT) * 100);
  const isSaved = saveStatus.startsWith('Saved');
  const statusState = saveStatus.toLowerCase().includes('attention') || saveStatus === 'Changes not saved' ? 'attention' : saveStatus.startsWith('Saving') ? 'saving' : isSaved ? 'saved' : 'idle';

  useLayoutEffect(() => {
    if (route === 'review') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById(`${rootId}-title`)?.focus({ preventScroll: true });
  }, [rootId, route, question]);

  const sourceTextByKey = {
    ...(method === 'quick' ? quickAnswerSources(sourceAnswers ?? answers) : pasteSources),
    ...reviewSourceOverrides,
  };
  const syncAnswerFromReview = (key: string, value: string, index?: number) => {
    if (key === 'otherLinkLabel' || key === 'otherLinkUrl') {
      if (index === undefined) return;
      setAnswers((current) => ({ ...current, otherLinks: current.otherLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [key === 'otherLinkLabel' ? 'label' : 'url']: value } : link) }));
      return;
    }
    const scalarKeys: (keyof Omit<QuickAnswers, 'otherLinks'>)[] = ['name', 'learning', 'tried', 'proud', 'participated', 'location', 'college', 'course', 'branch', 'gradYear', 'email', 'github', 'linkedin'];
    if (scalarKeys.includes(key as keyof Omit<QuickAnswers, 'otherLinks'>)) setAnswers((current) => ({ ...current, [key]: value }));
  };
  const removeAnswerFromReview = (key: string, index?: number) => {
    if (key === 'otherLink') {
      if (index === undefined) return;
      setAnswers((current) => ({ ...current, otherLinks: current.otherLinks.filter((_, linkIndex) => linkIndex !== index) }));
      return;
    }
    syncAnswerFromReview(key, '');
  };
  const carryReviewSource = (oldKey: string, newKey: string, text: string) => setReviewSourceOverrides((current) => {
    const next = { ...current };
    delete next[oldKey];
    if (newKey) next[newKey] = text;
    return next;
  });

  if (route === 'review') return <ProfileReview
    profile={profile}
    saveStatus={saveStatus}
    origin={method}
    sourceTextByKey={sourceTextByKey}
    aiSuggestions={aiSuggestions ?? undefined}
    aiClarifyingQuestions={aiClarifyingQuestions}
    aiAlreadyPresent={aiAlreadyPresent}
    aiRepeatedSuggestions={aiRepeatedSuggestions}
    onAISuggestionAccepted={recordAISuggestionAccepted}
    unavailableSourceKeys={[...reviewUnavailableSourceKeys]}
    onProfileChange={onProfileChange}
    onAnswerSync={syncAnswerFromReview}
    onAnswerRemove={removeAnswerFromReview}
    onSourceTextChange={carryReviewSource}
    manualSourceKeys={[...reviewManualSourceKeys]}
    onMarkManualSource={(key) => setReviewManualSourceKeys((current) => new Set(current).add(key))}
    onBack={() => {
      setError('');
      if (method === 'paste') {
        setPasteNotes(profile.basics.originalNotes || profile.basics.about);
        setRoute('paste');
      } else {
        setQuestion(QUESTION_COUNT - 1);
        setRoute('quick');
      }
    }}
    backLabel={method === 'paste' ? 'Back to my notes' : 'Back to my answers'}
    onContinueToDesign={onChooseLook}
    onEditManually={onEditManually}
    onSaveExit={onSaveExit}
  />;

  return (
    <div className="studio screen-fade content-intake">
      <header className="studio-bar intake-bar">
        <div className="studio-brand"><span className="logo"><span className="logo-mark"><Icon name="leaf" size={14} /></span><span>folio</span></span><span className="bar-separator" /><span className="draft-label">Start your portfolio</span></div>
        <div className="studio-center" data-state={statusState} role="status" aria-live="polite" aria-atomic="true"><span className="save-dot" aria-hidden="true" /><span>{saveStatus}</span></div>
        <div className="studio-actions"><button className="button subtle small" type="button" onClick={onSaveExit}>Save &amp; exit</button></div>
      </header>

      <main className="intake-main" aria-labelledby={`${rootId}-title`}>
        {route === 'choice' && <section className="intake-page intake-choice">
          <div className="intake-flowline" role="group" aria-label="Your path: tell us, review, design, edit">
            <span>Tell us</span><b aria-hidden="true">→</b><span>Review</span><b aria-hidden="true">→</b><span>Design</span><b aria-hidden="true">→</b><span>Edit</span>
          </div>
          <span className="eyebrow">A GOOD FIRST STEP</span>
          <h1 tabIndex={-1} id={`${rootId}-title`}>How would you like to start?</h1>
          <p className="intake-lead">You don’t need to know what belongs in a portfolio. Start with what you have — rough notes are welcome.</p>
          <div className="intake-path-grid">
            <button type="button" className="intake-path-card recommended" onClick={() => chooseMethod('quick')}>
              <span className="intake-path-heading"><strong>Quick questions</strong><span className="recommended-label">Recommended</span></span>
              <span className="intake-path-copy">Answer a few simple questions. Rough answers are completely fine.</span>
              <span className="intake-path-action">Start with questions <Icon name="arrow" size={13} /></span>
            </button>
            <button type="button" className="intake-path-card" onClick={() => chooseMethod('paste')}>
              <span className="intake-path-heading"><strong>Paste rough notes</strong></span>
              <span className="intake-path-copy">Already have a few thoughts? Paste them as they are. Lists and unfinished sentences are welcome.</span>
              <span className="intake-path-action">Paste my notes <Icon name="arrow" size={13} /></span>
            </button>
          </div>
          <div className="intake-planned-card" role="note" aria-label="Resume import is planned and not available yet">
            <span className="intake-planned-icon" aria-hidden="true"><Icon name="book" size={16} /></span>
            <span><strong>Use a resume</strong><small>Coming soon — resume upload isn’t available yet.</small></span>
            <span className="planned-label">Planned</span>
          </div>
          <div className="intake-manual-callout"><span>Prefer to organize things yourself?</span><button className="text-button" type="button" onClick={onEditManually}>Edit your profile manually</button></div>
        </section>}

        {route === 'quick' && <section className="intake-page intake-quick">
          <div className="intake-progress">
            <div className="intake-progress-label"><span>Question {question + 1} of {QUESTION_COUNT}</span><span>You can skip anything</span></div>
            <div className="intake-progress-track" role="progressbar" aria-label="Quick questions progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}><span style={{ width: `${progressValue}%` }} /></div>
          </div>
          <form className="intake-question-card" noValidate onSubmit={handleContinue}>
            <div className="intake-question-heading">
              <span className="eyebrow">QUICK QUESTIONS</span>
              {question === 0 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What’s your name?</h1><p>Use the name you’d like people to see. You can add it later if you prefer.</p></>}
              {question === 1 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What are you currently learning or curious about?</h1><p>Tell us what you’re exploring right now. It can be a technology, subject, field, or anything you’re interested in.</p></>}
              {question === 2 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What have you built or tried?</h1><p>Small projects count. College assignments, experiments, websites, apps, designs, hackathon prototypes, or anything you made while learning.</p></>}
              {question === 3 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What are you proud of?</h1><p>This could be an achievement, competition, certification, event, contribution, improvement, or something you simply enjoyed accomplishing. It doesn’t need to sound impressive.</p></>}
              {question === 4 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What have you participated in or helped with?</h1><p>Hackathons, clubs, college events, volunteering, teams, communities, or things you helped organize.</p></>}
              {question === 5 && <><h1 tabIndex={-1} id={`${rootId}-title`}>What links should people find?</h1><p>Share only the places you’re comfortable making public. Every link is optional.</p></>}
            </div>

            {question === 0 && <div className="intake-question-fields">
              <IntakeField label="Your name" value={answers.name} maxLength={120} placeholder="e.g. Asha Raman" onChange={(value) => updateAnswer('name', value)} />
              <details className="intake-more-details">
                <summary>Add a little more detail <span>(optional)</span></summary>
                <div className="intake-details-grid">
                  <IntakeField label="Where are you based?" value={answers.location} maxLength={120} placeholder="City or region" onChange={(value) => updateAnswer('location', value)} />
                  <IntakeField label="College or university" value={answers.college} maxLength={180} placeholder="You can leave this blank" onChange={(value) => updateAnswer('college', value)} />
                  <IntakeField label="Course" value={answers.course} maxLength={120} placeholder="e.g. B.E." onChange={(value) => updateAnswer('course', value)} />
                  <IntakeField label="Branch or subject" value={answers.branch} maxLength={120} placeholder="e.g. Computer Science" onChange={(value) => updateAnswer('branch', value)} />
                  <IntakeField label="Expected graduation year" value={answers.gradYear} maxLength={12} placeholder="e.g. 2029" onChange={(value) => updateAnswer('gradYear', value)} />
                </div>
              </details>
            </div>}

            {question === 1 && <div className="intake-question-fields">
              <label htmlFor={`${rootId}-learning`}>What are you exploring right now?</label>
              <textarea id={`${rootId}-learning`} maxLength={2000} value={answers.learning} onChange={(event) => updateAnswer('learning', event.target.value)} placeholder="e.g. Python, web development, AI, UI design, cybersecurity…" />
              <p className="intake-example">You can write a list or a sentence. “Python, C++, HTML, CSS” is a useful answer.</p>
            </div>}

            {question === 2 && <div className="intake-question-fields">
              <label htmlFor={`${rootId}-tried`}>Tell us about something you made or tried</label>
              <textarea id={`${rootId}-tried`} maxLength={3000} value={answers.tried} onChange={(event) => updateAnswer('tried', event.target.value)} placeholder="A rough note is enough. What was it, and what did you try?" />
              <p className="intake-example">For example: “I made a small weather app to practice using an API. It’s unfinished, but I learned how to display the forecast.”</p>
              <p className="intake-reassurance"><strong>No projects yet?</strong> That’s completely fine. Skip this and keep going.</p>
            </div>}

            {question === 3 && <div className="intake-question-fields">
              <label htmlFor={`${rootId}-proud`}>Anything you feel good about doing?</label>
              <textarea id={`${rootId}-proud`} maxLength={2000} value={answers.proud} onChange={(event) => updateAnswer('proud', event.target.value)} placeholder="Finishing a course, helping someone, improving at something, or anything else." />
              <p className="intake-example">It can be a small win. You don’t need a prize or a certificate.</p>
            </div>}

            {question === 4 && <div className="intake-question-fields">
              <label htmlFor={`${rootId}-participated`}>What did you take part in or help make happen?</label>
              <textarea id={`${rootId}-participated`} maxLength={2000} value={answers.participated} onChange={(event) => updateAnswer('participated', event.target.value)} placeholder="A club, team, event, community, or something you helped organize." />
              <p className="intake-example">Helping with a college event or showing up for a team counts too.</p>
            </div>}

            {question === 5 && <div className="intake-question-fields intake-link-fields">
              <div className="field-row"><IntakeField label="Email" type="email" value={answers.email} maxLength={254} placeholder="you@example.com" onChange={(value) => updateAnswer('email', value)} /><IntakeField label="GitHub profile" value={answers.github} maxLength={500} placeholder="github.com/you" onChange={(value) => updateAnswer('github', value)} /></div>
              <IntakeField label="LinkedIn profile" value={answers.linkedin} maxLength={500} placeholder="linkedin.com/in/you" onChange={(value) => updateAnswer('linkedin', value)} />
              <div className="intake-other-links">
                <div className="intake-links-heading"><div><strong>Portfolio or social links</strong><span>optional</span><p>A personal website, Instagram, or anywhere else you’d like people to find.</p></div></div>
                {answers.otherLinks.map((link, index) => <div className="intake-link-row" key={link.id}>
                  <IntakeField label={`Link name ${index + 1}`} value={link.label} maxLength={60} placeholder="e.g. Personal website" onChange={(value) => updateOtherLink(link.id, 'label', value)} />
                  <IntakeField label={`Link address ${index + 1}`} value={link.url} maxLength={500} placeholder="example.com/you" onChange={(value) => updateOtherLink(link.id, 'url', value)} />
                  <button type="button" className="remove-button" aria-label={`Remove link ${index + 1}`} onClick={() => removeOtherLink(link.id)}>Remove</button>
                </div>)}
                {answers.otherLinks.length < 12 && <button type="button" className="add-row" onClick={addOtherLink}><span>+</span> Add a portfolio or social link</button>}
              </div>
              {error && <p className="intake-error" role="alert">{error}</p>}
            </div>}

            {question !== 5 && <p className="intake-rough-note"><Icon name="light" size={14} /> You don’t need to write this perfectly.</p>}
            {question === 5 && !error && <p className="intake-rough-note"><Icon name="lock" size={14} /> Only the links you add can appear on your portfolio.</p>}
            <div className="intake-question-actions">
              <button type="button" className="button secondary small" onClick={handleBack}><Icon name="arrowLeft" size={12} /> Back</button>
              <div className="intake-question-actions-end">
                <button type="button" className="button subtle small" onClick={handleSkip}>Skip for now</button>
                <button type="submit" className="button small">{question === QUESTION_COUNT - 1 ? 'Review what I shared' : 'Continue'} <Icon name="arrow" size={12} /></button>
              </div>
            </div>
            {error && question !== 5 && <p className="intake-error" role="alert">{error}</p>}
          </form>
        </section>}

        {route === 'paste' && <section className="intake-page intake-paste">
          <div className="intake-paste-heading"><span className="eyebrow">PASTE ROUGH NOTES</span><h1 tabIndex={-1} id={`${rootId}-title`}>Tell us anything about yourself</h1><p>It can be a sentence, a list, or a few unfinished thoughts. Don’t worry about formatting. You can organize or edit it in your profile whenever you’re ready.</p></div>
          <form className="intake-paste-card" onSubmit={handlePasteSubmit} aria-busy={aiProcessing}>
            <label htmlFor={`${rootId}-paste-notes`}>Your notes</label>
            <textarea ref={pasteTextarea} id={`${rootId}-paste-notes`} maxLength={3000} value={pasteNotes} disabled={aiProcessing} onChange={(event) => updatePasteNotes(event.target.value)} placeholder="I’m a first-year CSE student learning Python and web development. I made a weather app and participated in a college hackathon." />
            <div className="intake-paste-meta"><span>Your notes stay as written unless you choose to send them for AI suggestions.</span><span>{pasteNotes.length} / 3,000</span></div>
            {error && <p className="intake-error" role="alert">{error}</p>}
            {aiProcessing && <p ref={processingStatus} tabIndex={-1} className="ai-processing-status" role="status" aria-live="polite"><span className="ai-loading-dot" aria-hidden="true" />Reading your notes and organizing what you shared…</p>}
            {aiFailure && !aiProcessing && <div className="ai-fallback-box">
              <p role="alert">{aiFailure}</p>
              <div className="ai-fallback-actions">
                {aiFailureRetryable && <button type="button" className="button secondary small" onClick={() => { setAIFailure(''); setAIConsentOpen(true); }}>Try again</button>}
                <button ref={fallbackManualButton} type="button" className="button small" onClick={continueManuallyFromPaste}>Continue manually</button>
              </div>
            </div>}
            {aiEmptyState && !aiProcessing && <div className="ai-empty-box">
              <p role="status" aria-live="polite"><strong>We couldn’t find much to organize yet.</strong> Add a little more detail, or continue manually. Your notes are still here.</p>
              {aiEmptyQuestion && <p className="ai-empty-question">One thing to consider: {aiEmptyQuestion}</p>}
              <div className="ai-fallback-actions"><button ref={emptyAddDetailsButton} type="button" className="button secondary small" onClick={() => { setAIEmptyState(false); pasteTextarea.current?.focus(); }}>Add more details</button><button type="button" className="button small" onClick={continueManuallyFromPaste}>Continue manually</button></div>
            </div>}
            {aiConsentOpen && <section className="ai-consent-panel" role="group" aria-labelledby={`${rootId}-ai-consent-title`}>
              <h2 id={`${rootId}-ai-consent-title`}>Before we send your notes</h2>
              <p>If you choose AI suggestions, the only information from your draft sent to the configured AI provider is the text in this notes box. Fixed extraction instructions are also included. Your existing profile and design settings are not sent, and suggestions are not added until you review them.</p>
              <p className="ai-consent-caveat">Provider processing is governed by its own terms. Avoid pasting sensitive details; this app does not make a separate promise about provider retention or training.</p>
              <div className="ai-consent-actions"><button ref={consentSendButton} type="button" className="button small" onClick={() => { void sendPasteNotesToAI(); }}>Send notes for suggestions</button><button type="button" className="button secondary small" onClick={continueManuallyFromPaste}>Continue without AI</button><button type="button" className="button subtle small" onClick={() => { setAIConsentOpen(false); pasteTextarea.current?.focus(); }}>Not now</button></div>
            </section>}
            {!aiProcessing && !aiConsentOpen && !aiFailure && !aiEmptyState && <div className="intake-example-note"><span className="eyebrow">ROUGH NOTES ARE WELCOME</span><p>“Python, C++, HTML, CSS. JSSATE. First year. Interested in AI.”</p></div>}
            {!aiProcessing && !aiConsentOpen && !aiFailure && !aiEmptyState && <div className="intake-question-actions">
              <button type="button" className="button secondary small" onClick={() => { setError(''); setRoute('choice'); }}><Icon name="arrowLeft" size={12} /> Back</button>
              <div className="intake-question-actions-end"><button type="button" className="button subtle small" onClick={() => { setMethod('paste'); proceedToReview(); }}>Skip for now</button><button type="submit" className="button small">Continue <Icon name="arrow" size={12} /></button></div>
            </div>}
          </form>
        </section>}


      </main>
    </div>
  );
}
