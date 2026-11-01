import {
  ProfileDocumentSchema,
  ProjectSchema,
  type ProfileDocument,
} from '../profile-schema';
import {
  CopyImprovementProposalSchema,
  ProfileSuggestionSchema,
  ProjectProposalValueSchema,
  projectIndexFromCopyPath,
  validateProposalValue,
  type CopyImprovementProposal,
  type ProfileSuggestion,
  type SuggestionStatus,
} from './contract';

export type SuggestionDecision =
  | { action: 'accept' }
  | { action: 'edit'; proposedValue: unknown }
  | { action: 'reject' }
  | { action: 'defer' };

export type ResolveSuggestionResult =
  | { ok: true; suggestion: ProfileSuggestion }
  | { ok: false; reason: 'invalid_suggestion' | 'invalid_value' | 'already_resolved' };
export type ResolveCopySuggestionResult =
  | { ok: true; suggestion: CopyImprovementProposal }
  | { ok: false; reason: 'invalid_suggestion' | 'invalid_value' | 'already_resolved' };

type ResolveAnySuggestionResult = ResolveSuggestionResult | ResolveCopySuggestionResult;

export function resolveSuggestion(rawSuggestion: ProfileSuggestion, decision: SuggestionDecision): ResolveSuggestionResult;
export function resolveSuggestion(rawSuggestion: CopyImprovementProposal, decision: SuggestionDecision): ResolveCopySuggestionResult;
export function resolveSuggestion(rawSuggestion: ProfileSuggestion | CopyImprovementProposal, decision: SuggestionDecision): ResolveAnySuggestionResult;
export function resolveSuggestion(rawSuggestion: unknown, decision: SuggestionDecision): ResolveAnySuggestionResult;
export function resolveSuggestion(rawSuggestion: unknown, decision: SuggestionDecision): ResolveAnySuggestionResult {
  const copy = CopyImprovementProposalSchema.safeParse(rawSuggestion);
  if (copy.success) {
    const suggestion = copy.data;
    if (decision.action === 'edit') {
      if (suggestion.status === 'rejected' || suggestion.status === 'deferred') return { ok: false, reason: 'already_resolved' };
      if (typeof decision.proposedValue !== 'string') return { ok: false, reason: 'invalid_value' };
      const edited = CopyImprovementProposalSchema.safeParse({ ...suggestion, proposedText: decision.proposedValue, status: 'edited' });
      return edited.success ? { ok: true, suggestion: edited.data } : { ok: false, reason: 'invalid_value' };
    }
    if (suggestion.status !== 'suggested') return { ok: false, reason: 'already_resolved' };
    const status: SuggestionStatus = decision.action === 'accept' ? 'accepted' : decision.action === 'reject' ? 'rejected' : 'deferred';
    const updated = CopyImprovementProposalSchema.safeParse({ ...suggestion, status });
    return updated.success ? { ok: true, suggestion: updated.data } : { ok: false, reason: 'invalid_suggestion' };
  }

  const parsed = ProfileSuggestionSchema.safeParse(rawSuggestion);
  if (!parsed.success) return { ok: false, reason: 'invalid_suggestion' };
  const suggestion = parsed.data;
  if (decision.action === 'edit') {
    if (suggestion.status === 'rejected' || suggestion.status === 'deferred') return { ok: false, reason: 'already_resolved' };
    const parsedValue = validateProposalValue(suggestion.path, decision.proposedValue);
    if (!parsedValue.success) return { ok: false, reason: 'invalid_value' };
    const edited = ProfileSuggestionSchema.safeParse({ ...suggestion, proposedValue: parsedValue.data, status: 'edited' });
    return edited.success ? { ok: true, suggestion: edited.data } : { ok: false, reason: 'invalid_suggestion' };
  }
  if (suggestion.status !== 'suggested') return { ok: false, reason: 'already_resolved' };
  const status: SuggestionStatus = decision.action === 'accept' ? 'accepted' : decision.action === 'reject' ? 'rejected' : 'deferred';
  const updated = ProfileSuggestionSchema.safeParse({ ...suggestion, status });
  return updated.success ? { ok: true, suggestion: updated.data } : { ok: false, reason: 'invalid_suggestion' };
}

export type ApplySuggestionResult =
  | { ok: true; profile: ProfileDocument; changed: boolean }
  | { ok: false; reason: 'not_approved' | 'invalid_profile' | 'invalid_suggestion' | 'collection_limit' | 'stale_source' };

function freshProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `ai-${crypto.randomUUID()}`;
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function appendUnique(values: string[], value: string): { values: string[]; changed: boolean } {
  const key = (item: string) => item.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
  if (values.some((item) => key(item) === key(value))) return { values, changed: false };
  return { values: [...values, value], changed: true };
}

function comparableUrl(raw: string): string | null {
  const value = raw.trim().replace(/[),.!?;:'\"]+$/g, '');
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password) return null;
    return `${url.hostname.toLocaleLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return null;
  }
}

function urlAlreadyInProfile(profile: ProfileDocument, raw: string) {
  const proposed = comparableUrl(raw);
  if (!proposed) return false;
  return [profile.links.github, profile.links.linkedin, ...profile.links.other.map((item) => item.url)]
    .some((value) => comparableUrl(value) === proposed);
}

function comparableText(raw: string) {
  return raw.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/**
 * Applies only a separately accepted or edited proposal. The switch is
 * exhaustive over static paths; no property-path traversal or object merging
 * uses provider-supplied strings.
 */
export function applyApprovedSuggestion(
  rawProfile: unknown,
  rawSuggestion: unknown,
  options: { makeProjectId?: () => string } = {},
): ApplySuggestionResult {
  const profileResult = ProfileDocumentSchema.safeParse(rawProfile);
  if (!profileResult.success) return { ok: false, reason: 'invalid_profile' };

  const copySuggestionResult = CopyImprovementProposalSchema.safeParse(rawSuggestion);
  if (copySuggestionResult.success) {
    const suggestion = copySuggestionResult.data;
    if (suggestion.status !== 'accepted' && suggestion.status !== 'edited') return { ok: false, reason: 'not_approved' };
    const profile = profileResult.data;
    let next: ProfileDocument;
    if (suggestion.path === 'basics.about') {
      if (profile.basics.about !== suggestion.originalText) return { ok: false, reason: 'stale_source' };
      next = { ...profile, basics: { ...profile.basics, about: suggestion.proposedText } };
    } else {
      const index = projectIndexFromCopyPath(suggestion.path);
      const project = index === null ? undefined : profile.projects[index];
      if (!project || project.description !== suggestion.originalText) return { ok: false, reason: 'stale_source' };
      next = {
        ...profile,
        projects: profile.projects.map((item, currentIndex) => currentIndex === index
          ? { ...item, description: suggestion.proposedText }
          : item),
      };
    }
    const checkedCopy = ProfileDocumentSchema.safeParse(next);
    return checkedCopy.success
      ? { ok: true, profile: checkedCopy.data, changed: suggestion.proposedText !== suggestion.originalText }
      : { ok: false, reason: 'invalid_suggestion' };
  }

  const suggestionResult = ProfileSuggestionSchema.safeParse(rawSuggestion);
  if (!suggestionResult.success) return { ok: false, reason: 'invalid_suggestion' };
  const suggestion = suggestionResult.data;
  if (suggestion.status !== 'accepted' && suggestion.status !== 'edited') {
    return { ok: false, reason: 'not_approved' };
  }
  const valueResult = validateProposalValue(suggestion.path, suggestion.proposedValue);
  if (!valueResult.success) return { ok: false, reason: 'invalid_suggestion' };

  const profile = profileResult.data;
  let next: ProfileDocument = profile;
  let changed = true;
  const text = valueResult.data as string;

  switch (suggestion.path) {
    case 'basics.name':
      next = { ...profile, basics: { ...profile.basics, name: text } };
      break;
    case 'basics.role':
      next = { ...profile, basics: { ...profile.basics, role: text } };
      break;
    case 'basics.about':
      next = { ...profile, basics: { ...profile.basics, about: text } };
      break;
    case 'basics.location':
      next = { ...profile, basics: { ...profile.basics, location: text } };
      break;
    case 'education.college':
      next = { ...profile, education: { ...profile.education, college: text } };
      break;
    case 'education.degree':
      next = { ...profile, education: { ...profile.education, degree: text } };
      break;
    case 'education.branch':
      next = { ...profile, education: { ...profile.education, branch: text } };
      break;
    case 'education.gradYear':
      next = { ...profile, education: { ...profile.education, gradYear: text } };
      break;
    case 'education.note':
      next = { ...profile, education: { ...profile.education, note: text } };
      break;
    case 'learning':
      next = { ...profile, learning: text };
      break;
    case 'links.email':
      if (profile.links.email.trim().toLocaleLowerCase() === text.trim().toLocaleLowerCase()) changed = false;
      else next = { ...profile, links: { ...profile.links, email: text } };
      break;
    case 'links.github':
      if (urlAlreadyInProfile(profile, text)) changed = false;
      else next = { ...profile, links: { ...profile.links, github: text } };
      break;
    case 'links.linkedin':
      if (urlAlreadyInProfile(profile, text)) changed = false;
      else next = { ...profile, links: { ...profile.links, linkedin: text } };
      break;
    case 'skills': {
      if (profile.skills.length >= 50 && !profile.skills.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'collection_limit' };
      }
      const result = appendUnique(profile.skills, text);
      changed = result.changed;
      next = { ...profile, skills: result.values };
      break;
    }
    case 'interests': {
      if (profile.interests.length >= 50 && !profile.interests.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'collection_limit' };
      }
      const result = appendUnique(profile.interests, text);
      changed = result.changed;
      next = { ...profile, interests: result.values };
      break;
    }
    case 'highlights': {
      if (profile.highlights.length >= 40 && !profile.highlights.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'collection_limit' };
      }
      const result = appendUnique(profile.highlights, text);
      changed = result.changed;
      next = { ...profile, highlights: result.values };
      break;
    }
    case 'activities': {
      if (profile.activities.length >= 40 && !profile.activities.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'collection_limit' };
      }
      const result = appendUnique(profile.activities, text);
      changed = result.changed;
      next = { ...profile, activities: result.values };
      break;
    }
    case 'projects': {
      const proposal = ProjectProposalValueSchema.safeParse(suggestion.proposedValue);
      if (!proposal.success) return { ok: false, reason: 'invalid_suggestion' };
      const duplicate = profile.projects.some((project) =>
        comparableText(project.title) === comparableText(proposal.data.title)
        && comparableText(project.description) === comparableText(proposal.data.description)
        && comparableText(project.tools) === comparableText(proposal.data.tools)
        && (comparableUrl(project.link) ?? '') === (comparableUrl(proposal.data.link) ?? ''),
      );
      if (duplicate) {
        changed = false;
        break;
      }
      if (profile.projects.length >= 30) return { ok: false, reason: 'collection_limit' };
      const project = ProjectSchema.safeParse({
        id: (options.makeProjectId ?? freshProjectId)(),
        ...proposal.data,
      });
      if (!project.success) return { ok: false, reason: 'invalid_suggestion' };
      next = { ...profile, projects: [...profile.projects, project.data] };
      break;
    }
    case 'links.other': {
      const link = valueResult.data as { label: string; url: string };
      if (urlAlreadyInProfile(profile, link.url)) {
        changed = false;
        break;
      }
      if (profile.links.other.length >= 12) return { ok: false, reason: 'collection_limit' };
      next = { ...profile, links: { ...profile.links, other: [...profile.links.other, link] } };
      break;
    }
    default: {
      const exhaustive: never = suggestion.path;
      void exhaustive;
      return { ok: false, reason: 'invalid_suggestion' };
    }
  }

  const checked = ProfileDocumentSchema.safeParse(next);
  return checked.success
    ? { ok: true, profile: checked.data, changed }
    : { ok: false, reason: 'invalid_suggestion' };
}
