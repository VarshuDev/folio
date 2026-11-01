import type { ProfileDocument } from '../profile-schema';
import { validateProposalValue, type AllowedProfilePath, type ProfileSuggestion } from './contract';

export type ProposalReviewAnalysis = {
  kind: 'new' | 'duplicate' | 'possible_duplicate' | 'conflict';
  label: string;
  message?: string;
  existingValue?: string;
};

export type PreparedProposalReview = {
  suggestions: ProfileSuggestion[];
  alreadyPresent: string[];
  repeatedSuggestions: string[];
};

const PATH_LABELS: Record<AllowedProfilePath, string> = {
  'basics.name': 'Name',
  'basics.role': 'Short introduction',
  'basics.about': 'About',
  'basics.location': 'Location',
  'education.college': 'College or university',
  'education.degree': 'Course or degree',
  'education.branch': 'Branch or subject',
  'education.gradYear': 'Expected graduation year',
  'education.note': 'Study note',
  skills: 'Skill',
  interests: 'Interest',
  projects: 'Project',
  highlights: 'Highlight',
  activities: 'Activity',
  learning: 'Learning note',
  'links.email': 'Email',
  'links.github': 'GitHub',
  'links.linkedin': 'LinkedIn',
  'links.other': 'Other link',
};

function textKey(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function canonicalUrl(raw: string): string | null {
  const value = raw.trim().replace(/[),.!?;:'"]+$/g, '');
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || url.username || url.password) return null;
    return `${url.hostname.toLocaleLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return null;
  }
}

type ProjectProposal = { title: string; description: string; tools: string; link: string };

function projectValue(value: unknown): ProjectProposal | null {
  if (!value || typeof value !== 'object') return null;
  const project = value as { title?: unknown; description?: unknown; tools?: unknown; link?: unknown };
  if (typeof project.title !== 'string' || typeof project.description !== 'string'
    || typeof project.tools !== 'string' || typeof project.link !== 'string') return null;
  return { title: project.title, description: project.description, tools: project.tools, link: project.link };
}

function proposalText(path: AllowedProfilePath, value: unknown): string {
  if (path === 'projects') return projectValue(value)?.title ?? 'Project';
  if (path === 'links.other' && value && typeof value === 'object') {
    const link = value as { label?: unknown; url?: unknown };
    return `${typeof link.label === 'string' ? link.label : 'Link'}${typeof link.url === 'string' ? ` — ${link.url}` : ''}`;
  }
  return typeof value === 'string' ? value : PATH_LABELS[path];
}

function currentScalar(profile: ProfileDocument, path: AllowedProfilePath): string | null {
  switch (path) {
    case 'basics.name': return profile.basics.name;
    case 'basics.role': return profile.basics.role;
    case 'basics.about': return profile.basics.about;
    case 'basics.location': return profile.basics.location;
    case 'education.college': return profile.education.college;
    case 'education.degree': return profile.education.degree;
    case 'education.branch': return profile.education.branch;
    case 'education.gradYear': return profile.education.gradYear;
    case 'education.note': return profile.education.note;
    case 'learning': return profile.learning;
    case 'links.email': return profile.links.email;
    case 'links.github': return profile.links.github;
    case 'links.linkedin': return profile.links.linkedin;
    default: return null;
  }
}

function allProfileUrls(profile: ProfileDocument) {
  return [
    ...(profile.links.github ? [{ label: 'GitHub', url: profile.links.github }] : []),
    ...(profile.links.linkedin ? [{ label: 'LinkedIn', url: profile.links.linkedin }] : []),
    ...profile.links.other,
  ];
}

function titleSimilarity(left: string, right: string) {
  const a = new Set(textKey(left).split(' ').filter((token) => token.length > 1));
  const b = new Set(textKey(right).split(' ').filter((token) => token.length > 1));
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / new Set([...a, ...b]).size;
}

export function inspectProposal(profile: ProfileDocument, suggestion: ProfileSuggestion): ProposalReviewAnalysis {
  const label = PATH_LABELS[suggestion.path];
  const parsed = validateProposalValue(suggestion.path, suggestion.proposedValue);
  if (!parsed.success) {
    return { kind: 'conflict', label, message: 'This suggestion could not be checked safely. Remove it or review the original note.' };
  }
  const value = parsed.data;

  if (suggestion.path === 'projects') {
    const proposed = projectValue(value);
    if (!proposed) return { kind: 'conflict', label, message: 'This project suggestion needs a closer look.' };
    const exactDuplicate = profile.projects.find((project) =>
      textKey(project.title) === textKey(proposed.title)
      && textKey(project.description) === textKey(proposed.description)
      && textKey(project.tools) === textKey(proposed.tools)
      && (canonicalUrl(project.link) ?? '') === (canonicalUrl(proposed.link) ?? ''),
    );
    if (exactDuplicate) return { kind: 'duplicate', label, message: 'This project already appears in your profile.', existingValue: exactDuplicate.title };
    const similar = profile.projects.find((project) =>
      textKey(project.title) === textKey(proposed.title) || titleSimilarity(project.title, proposed.title) >= 0.75,
    );
    if (similar) return {
      kind: 'possible_duplicate',
      label,
      message: 'This may be a project you already have. Compare the details before keeping it.',
      existingValue: [similar.title, similar.description].filter(Boolean).join(' — '),
    };
    return { kind: 'new', label };
  }

  if (suggestion.path === 'links.github' || suggestion.path === 'links.linkedin') {
    const proposedUrl = canonicalUrl(String(value));
    const existingUrl = currentScalar(profile, suggestion.path) ?? '';
    const matching = allProfileUrls(profile).find((item) => canonicalUrl(item.url) === proposedUrl);
    if (matching) return { kind: 'duplicate', label, message: 'This address is already saved in your profile.', existingValue: matching.url };
    if (existingUrl.trim()) return {
      kind: 'conflict',
      label,
      message: `You already have a different ${label} address. Keeping this will replace it.`,
      existingValue: existingUrl,
    };
    return { kind: 'new', label };
  }

  if (suggestion.path === 'links.other') {
    const proposed = value as { label: string; url: string };
    const proposedUrl = canonicalUrl(proposed.url);
    const matchingUrl = allProfileUrls(profile).find((item) => canonicalUrl(item.url) === proposedUrl);
    if (matchingUrl) return { kind: 'duplicate', label, message: 'This address is already saved in your profile.', existingValue: matchingUrl.url };
    const sameLabel = profile.links.other.find((item) => textKey(item.label) === textKey(proposed.label));
    if (sameLabel) return {
      kind: 'possible_duplicate',
      label,
      message: 'A link with this name already exists. Check whether it is the same destination.',
      existingValue: `${sameLabel.label} — ${sameLabel.url}`,
    };
    return { kind: 'new', label };
  }

  if (suggestion.path === 'skills' || suggestion.path === 'interests'
    || suggestion.path === 'highlights' || suggestion.path === 'activities') {
    const list = profile[suggestion.path];
    const duplicate = list.find((item) => textKey(item) === textKey(String(value)));
    return duplicate
      ? { kind: 'duplicate', label, message: 'This value is already in your profile.', existingValue: duplicate }
      : { kind: 'new', label };
  }

  const current = currentScalar(profile, suggestion.path);
  if (!current?.trim()) return { kind: 'new', label };
  if (textKey(current) === textKey(String(value))) {
    return { kind: 'duplicate', label, message: 'This value is already in your profile.', existingValue: current };
  }
  return {
    kind: 'conflict',
    label,
    message: `You already have a different ${label.toLocaleLowerCase()} in your profile. Keeping this suggestion will replace it.`,
    existingValue: current,
  };
}

/** Suppress only exact duplicates; all possible matches remain visible for a human decision. */
export function prepareProposalReview(profile: ProfileDocument, suggestions: ProfileSuggestion[]): PreparedProposalReview {
  const visible: ProfileSuggestion[] = [];
  const alreadyPresent: string[] = [];
  const repeatedSuggestions: string[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const analysis = inspectProposal(profile, suggestion);
    const value = proposalText(suggestion.path, suggestion.proposedValue);
    const key = `${suggestion.path}:${textKey(value)}`;
    if (analysis.kind === 'duplicate') {
      if (!alreadyPresent.some((item) => textKey(item) === textKey(value))) alreadyPresent.push(value);
      continue;
    }
    if (seen.has(key)) {
      if (!repeatedSuggestions.some((item) => textKey(item) === textKey(value))) repeatedSuggestions.push(value);
      continue;
    }
    seen.add(key);
    visible.push(suggestion);
  }
  return { suggestions: visible, alreadyPresent, repeatedSuggestions };
}
