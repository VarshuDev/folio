import assert from 'node:assert/strict';
import test from 'node:test';
import { applyApprovedSuggestion, resolveSuggestion } from '../../lib/ai/proposal-lifecycle';
import { inspectProposal, prepareProposalReview } from '../../lib/ai/review-merge';
import type { ProfileSuggestion } from '../../lib/ai/contract';
import { createEmptyProfile } from '../../lib/profile-schema';

function suggestion(path: ProfileSuggestion['path'], proposedValue: unknown, id = 'review-1'): ProfileSuggestion {
  return {
    id,
    path,
    proposedValue,
    provenance: { status: 'exact', text: 'A verbatim source note.' },
    reason: 'Compare this with the note.',
    confidence: 'medium',
    needsReview: true,
    status: 'suggested',
  };
}

test('review merge suppresses exact list and normalized URL duplicates without mutating the draft', () => {
  const profile = createEmptyProfile();
  profile.skills = ['Python'];
  profile.links.github = 'github.com/varshan';
  const candidates = [
    suggestion('skills', ' python ', 'duplicate-skill'),
    suggestion('skills', 'Rust', 'new-skill'),
    suggestion('links.other', { label: 'GitHub', url: 'https://www.github.com/varshan/' }, 'duplicate-link'),
  ];
  const before = structuredClone(profile);
  const prepared = prepareProposalReview(profile, candidates);
  assert.deepEqual(prepared.suggestions.map((item) => item.id), ['new-skill']);
  assert.equal(prepared.alreadyPresent.length, 2);
  assert.deepEqual(profile, before, 'review checks are pure and do not mutate a draft');
});

test('different values for an existing scalar warn before an explicit replacement', () => {
  const profile = createEmptyProfile();
  profile.basics.about = 'I am a first-year student.';
  const proposal = suggestion('basics.about', 'I study computer science.');
  const analysis = inspectProposal(profile, proposal);
  assert.equal(analysis.kind, 'conflict');
  assert.match(analysis.message ?? '', /replace/i);
  assert.equal(analysis.existingValue, 'I am a first-year student.');

  const untouched = applyApprovedSuggestion(profile, proposal);
  assert.deepEqual(untouched, { ok: false, reason: 'not_approved' });
  const approval = resolveSuggestion(proposal, { action: 'accept' });
  assert.equal(approval.ok, true);
  if (!approval.ok) return;
  const applied = applyApprovedSuggestion(profile, approval.suggestion);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.profile.basics.about, 'I study computer science.');
    assert.equal(applied.profile.basics.originalNotes, profile.basics.originalNotes);
  }
});

test('possible project duplicates stay reviewable and are not silently discarded', () => {
  const profile = createEmptyProfile();
  profile.projects = [{ id: 'existing-project', title: 'Android file sharing app', description: 'A Kotlin app.', tools: 'Kotlin', link: '' }];
  const proposal = suggestion('projects', {
    title: 'Android file-sharing app',
    description: 'I made a small Android file sharing app.',
    tools: 'Kotlin',
    link: '',
  });
  const analysis = inspectProposal(profile, proposal);
  assert.equal(analysis.kind, 'possible_duplicate');
  const prepared = prepareProposalReview(profile, [proposal]);
  assert.equal(prepared.suggestions.length, 1);
  assert.equal(prepared.alreadyPresent.length, 0);
});

test('approval-time URL normalization prevents a duplicate link across profile link fields', () => {
  const profile = createEmptyProfile();
  profile.links.github = 'github.com/varshan';
  const proposal = suggestion('links.other', { label: 'GitHub profile', url: 'https://github.com/varshan/' });
  const accepted = resolveSuggestion(proposal, { action: 'accept' });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const applied = applyApprovedSuggestion(profile, accepted.suggestion);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.changed, false);
    assert.equal(applied.profile.links.other.length, 0);
    assert.equal(applied.profile.links.github, 'github.com/varshan');
  }
});

test('editing a proposal validates its type and keeps all other profile values intact', () => {
  const profile = createEmptyProfile();
  profile.basics.location = 'Bengaluru';
  profile.links.linkedin = 'linkedin.com/in/varshan';
  const proposal = suggestion('skills', 'C++');
  const edited = resolveSuggestion(proposal, { action: 'edit', proposedValue: 'C plus plus' });
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  const applied = applyApprovedSuggestion(profile, edited.suggestion);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.deepEqual(applied.profile.skills, ['C plus plus']);
    assert.equal(applied.profile.basics.location, 'Bengaluru');
    assert.equal(applied.profile.links.linkedin, 'linkedin.com/in/varshan');
  }
});
