import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIRequestSchema,
  AIServiceResultSchema,
  MAX_SOURCE_TEXT_CHARS,
  ProviderEnvelopeSchema,
  validateProposalValue,
  type ProviderEnvelope,
} from '../../lib/ai/contract';
import { AI_FIXTURE_CASE_IDS, AI_FIXTURE_NOTES, createFixtureProvider } from '../../lib/ai/fixtures';
import { applyApprovedSuggestion, resolveSuggestion, type ResolveSuggestionResult } from '../../lib/ai/proposal-lifecycle';
import { AIProviderError, runAIRequest } from '../../lib/ai/service';
import { POST as postAIRequest } from '../../app/api/ai/route';
import { type AIProvider, type ProviderInput, type ProviderReply } from '../../lib/ai/provider-contract';
import { createDefaultDesign, createEmptyProfile, DraftBundleSchema, ProfileDocumentSchema } from '../../lib/profile-schema';

const simpleRequest = { operation: 'extract_profile', sourceText: AI_FIXTURE_NOTES.simple } as const;

function rawProvider(raw: unknown, kind: 'fixture' | 'external' = 'external'): AIProvider {
  return { kind, async complete() { return { raw }; } };
}

function makeEnvelope(suggestions: unknown[] = [], clarifyingQuestions: unknown[] = []): ProviderEnvelope {
  return { suggestions, clarifyingQuestions } as ProviderEnvelope;
}

function suggestion(path: string, proposedValue: unknown, overrides: Record<string, unknown> = {}) {
  return {
    path,
    proposedValue,
    provenance: { status: 'exact', text: 'Mira Rao' },
    reason: 'The note explicitly contains this value.',
    confidence: 'high',
    needsReview: true,
    ...overrides,
  };
}

function envelopeText(envelope: unknown) {
  return JSON.stringify(envelope);
}

test('operation-specific request schemas enforce required fields, path selection, and strict keys', () => {
  const operations = [
    { operation: 'extract_profile', sourceText: 'raw notes' },
    { operation: 'suggest_project', sourceText: 'project notes' },
    { operation: 'improve_copy', path: 'basics.about', text: 'bio', action: 'clearer' },
    { operation: 'suggest_sections', sourceText: 'notes' },
    { operation: 'adapt_copy_to_style', selectedPath: 'basics.about', styleId: 'minimal', sourceText: 'bio' },
    { operation: 'ask_clarifying_question', selectedPath: 'skills', sourceText: 'notes' },
  ];
  for (const request of operations) assert.equal(AIRequestSchema.safeParse(request).success, true);
  assert.equal(AIRequestSchema.safeParse({ operation: 'extract_profile' }).success, false);
  assert.equal(AIRequestSchema.safeParse({ operation: 'improve_copy', path: 'links.email', text: 'bio', action: 'clearer' }).success, false);
  assert.equal(AIRequestSchema.safeParse({ operation: 'improve_copy', path: 'projects[0].description', text: 'project copy', action: 'shorten' }).success, true);
  assert.equal(AIRequestSchema.safeParse({ operation: 'adapt_copy_to_style', selectedPath: 'basics.about', styleId: 'not-a-style', sourceText: 'bio' }).success, false);
  assert.equal(AIRequestSchema.safeParse({ ...simpleRequest, profile: createEmptyProfile() }).success, false, 'whole drafts are not accepted by the minimal request contract');
  assert.equal(AIRequestSchema.safeParse({ operation: 'extract_profile', sourceText: '   ' }).success, false);
  assert.equal(AIRequestSchema.safeParse({ operation: 'extract_profile', sourceText: 'x'.repeat(MAX_SOURCE_TEXT_CHARS + 1) }).success, false);
});

test('development fixtures cover all required input shapes and are never labeled as AI success', async () => {
  const provider = createFixtureProvider();
  const cases = [
    ['simple student notes', AI_FIXTURE_NOTES.simple, 4, 0, 'simple-student-notes'],
    ['messy notes', AI_FIXTURE_NOTES.messy, 1, 1, 'messy-single-project'],
    ['multiple projects', AI_FIXTURE_NOTES.multipleProjects, 2, 0, 'multiple-projects'],
    ['mixed activity and project', AI_FIXTURE_NOTES.mixedActivityProject, 2, 0, 'mixed-project-activity'],
    ['missing information', AI_FIXTURE_NOTES.missingInformation, 0, 1, 'missing-information'],
    ['ambiguous information', AI_FIXTURE_NOTES.ambiguous, 0, 1, 'ambiguous-information'],
    ['long input', AI_FIXTURE_NOTES.longInput, 1, 0, 'long-input'],
    ['instruction-like input', AI_FIXTURE_NOTES.malicious, 1, 0, 'instruction-like-content'],
  ] as const;
  assert.equal(AI_FIXTURE_CASE_IDS.length, 8);
  for (const [label, sourceText, expectedSuggestions, expectedQuestions, expectedFixture] of cases) {
    const result = await runAIRequest({ operation: 'extract_profile', sourceText }, provider);
    assert.equal(result.ok, true, label);
    if (!result.ok) continue;
    assert.equal(result.mode, 'fixture', label);
    assert.match(result.notice ?? '', /fixture only.*not AI output/i, label);
    assert.equal(result.fixtureCase, expectedFixture, label);
    assert.equal(result.suggestions.length, expectedSuggestions, label);
    assert.equal(result.clarifyingQuestions.length, expectedQuestions, label);
    assert.ok(result.suggestions.every((item) => item.status === 'suggested' && item.needsReview), label);
  }
});

test('unknown fixture input is an explicit empty response, not guessed success', async () => {
  const result = await runAIRequest({ operation: 'extract_profile', sourceText: 'ordinary unmatched user notes' }, createFixtureProvider());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'empty_response');
});

test('provider boundary keeps instruction-like notes in the untrusted data field', async () => {
  let captured: ProviderInput | undefined;
  const fixture = createFixtureProvider();
  const wrapped: AIProvider = {
    kind: 'fixture',
    async complete(input, options) {
      captured = input;
      return fixture.complete(input, options);
    },
  };
  const result = await runAIRequest({ operation: 'extract_profile', sourceText: AI_FIXTURE_NOTES.malicious }, wrapped);
  assert.equal(result.ok, true);
  assert.equal(captured?.operation === 'extract_profile' ? captured.untrustedUserContent.sourceText : undefined, AI_FIXTURE_NOTES.malicious);
  assert.match(captured?.systemInstructions ?? '', /untrusted user-provided content/i);
  assert.doesNotMatch(captured?.systemInstructions ?? '', /settings\.internalAdmin/i);
  if (result.ok) {
    assert.deepEqual(result.suggestions.map((item) => item.path), ['projects']);
    assert.ok(result.suggestions.every((item) => item.provenance.status !== 'exact' || AI_FIXTURE_NOTES.malicious.includes(item.provenance.text)));
  }
});

test('no configured provider returns a safe manual fallback without mutating or echoing notes', async () => {
  const before = structuredClone(createEmptyProfile());
  const result = await runAIRequest(simpleRequest, null);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'unavailable');
    assert.match(result.error.message, /continue manually/i);
    assert.equal(JSON.stringify(result).includes(AI_FIXTURE_NOTES.simple), false);
  }
  assert.deepEqual(createEmptyProfile(), before);
});

test('API route is disabled by default, exposes only labeled local fixtures, and bounds bodies', async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const priorNodeEnv = mutableEnv.NODE_ENV;
  const priorFixture = mutableEnv.FOLIO_AI_PROVIDER;
  const send = (body: string) => postAIRequest(new Request('http://localhost/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }));
  try {
    delete mutableEnv.FOLIO_AI_PROVIDER;
    mutableEnv.NODE_ENV = 'production';
    const disabled = await send(JSON.stringify(simpleRequest));
    assert.equal(disabled.status, 503);
    const disabledBody = await disabled.json() as { ok: boolean; error?: { code: string; message: string } };
    assert.equal(disabledBody.ok, false);
    assert.equal(disabledBody.error?.code, 'unavailable');
    assert.match(disabledBody.error?.message ?? '', /continue manually/i);
    assert.equal(disabled.headers.get('cache-control'), 'no-store, max-age=0');

    mutableEnv.FOLIO_AI_PROVIDER = 'fixture';
    const productionFixture = await send(JSON.stringify(simpleRequest));
    assert.equal(productionFixture.status, 503, 'the fixture provider is not available in production');

    mutableEnv.NODE_ENV = 'development';
    const fixtureResponse = await send(JSON.stringify(simpleRequest));
    assert.equal(fixtureResponse.status, 200);
    const fixtureBody = await fixtureResponse.json() as { ok: boolean; mode?: string; notice?: string; fixtureCase?: string };
    assert.equal(fixtureBody.ok, true);
    assert.equal(fixtureBody.mode, 'fixture');
    assert.match(fixtureBody.notice ?? '', /not AI output/i);
    assert.equal(fixtureBody.fixtureCase, 'simple-student-notes');

    const malformed = await send('{bad json');
    assert.equal(malformed.status, 400);
    const oversized = await send(JSON.stringify({ operation: 'extract_profile', sourceText: 'x'.repeat(50_000) }));
    assert.equal(oversized.status, 413);
  } finally {
    if (priorNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = priorNodeEnv;
    if (priorFixture === undefined) delete mutableEnv.FOLIO_AI_PROVIDER;
    else mutableEnv.FOLIO_AI_PROVIDER = priorFixture;
  }
});

test('unsupported operations are rejected before calling any provider', async () => {
  let called = false;
  const provider: AIProvider = { kind: 'external', async complete() { called = true; return { raw: '{}' }; } };
  const result = await runAIRequest({ operation: 'adapt_copy_to_style', selectedPath: 'basics.about', styleId: 'minimal', sourceText: 'A short bio.' }, provider);
  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'unsupported_operation');
});

test('oversized source and oversized/malformed provider output fail closed with safe errors', async () => {
  const tooLong = await runAIRequest({ operation: 'extract_profile', sourceText: 'x'.repeat(MAX_SOURCE_TEXT_CHARS + 1) }, createFixtureProvider());
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.error.code, 'request_too_large');

  const oversizedOutput = await runAIRequest(simpleRequest, rawProvider('x'.repeat(70_000)));
  assert.equal(oversizedOutput.ok, false);
  if (!oversizedOutput.ok) assert.equal(oversizedOutput.error.code, 'invalid_response');

  const malformedJson = await runAIRequest(simpleRequest, rawProvider('{ nope'));
  assert.equal(malformedJson.ok, false);
  if (!malformedJson.ok) assert.equal(malformedJson.error.code, 'invalid_response');

  const emptyText = await runAIRequest(simpleRequest, rawProvider('   '));
  assert.equal(emptyText.ok, false);
  if (!emptyText.ok) assert.equal(emptyText.error.code, 'empty_response');

  const validButEmpty = await runAIRequest(simpleRequest, rawProvider(envelopeText(makeEnvelope())));
  assert.equal(validButEmpty.ok, false);
  if (!validButEmpty.ok) assert.equal(validButEmpty.error.code, 'empty_response');
});

test('provider Zod output rejects missing fields, wrong types, unsafe values, and approval shortcuts', async () => {
  const cases: Array<{ label: string; envelope: unknown }> = [
    { label: 'missing required envelope array', envelope: { suggestions: [] } },
    { label: 'missing provenance', envelope: makeEnvelope([{ path: 'basics.name', proposedValue: 'Mira', reason: 'present', confidence: 'high', needsReview: true }]) },
    { label: 'wrong path value type', envelope: makeEnvelope([suggestion('skills', ['Python'])]) },
    { label: 'too-long value', envelope: makeEnvelope([suggestion('basics.name', 'x'.repeat(121))]) },
    { label: 'unsafe project URL', envelope: makeEnvelope([suggestion('projects', { title: 'Demo', description: 'A demo', tools: '', link: 'javascript:alert(1)' })]) },
    { label: 'missing project id is fine but model-supplied id is not', envelope: makeEnvelope([suggestion('projects', { id: 'provider-id', title: 'Demo', description: 'A demo', tools: '', link: '' })]) },
    { label: 'provider cannot bypass review', envelope: makeEnvelope([suggestion('basics.name', 'Mira Rao', { needsReview: false })]) },
    { label: 'provider cannot send approval status', envelope: makeEnvelope([suggestion('basics.name', 'Mira Rao', { status: 'accepted' })]) },
    { label: 'unknown output key', envelope: { suggestions: [], clarifyingQuestions: [], profile: { settings: {} } } },
    { label: 'too many questions', envelope: makeEnvelope([], Array.from({ length: 6 }, () => ({ question: 'What?', reason: 'Need detail', provenance: { status: 'unavailable' } }))) },
  ];
  for (const item of cases) {
    const result = await runAIRequest(simpleRequest, rawProvider(envelopeText(item.envelope)));
    assert.equal(result.ok, false, item.label);
    if (!result.ok) assert.equal(result.error.code, 'invalid_response', item.label);
  }
});

test('arbitrary, prototype, and application paths are rejected', async () => {
  const paths = ['settings.internalAdmin', 'schemaVersion', 'basics.originalNotes', 'constructor', '__proto__', 'prototype', 'links.__proto__'];
  for (const path of paths) {
    assert.equal(validateProposalValue(path as never, 'x').success, false, path);
    const raw = `{"suggestions":[{"path":${JSON.stringify(path)},"proposedValue":"x","provenance":{"status":"unavailable"},"reason":"unsupported path","confidence":"low","needsReview":true}],"clarifyingQuestions":[]}`;
    const result = await runAIRequest(simpleRequest, rawProvider(raw));
    assert.equal(result.ok, false, path);
    if (!result.ok) assert.equal(result.error.code, 'invalid_response', path);
  }
});

test('exact provenance must be a verbatim source excerpt; unavailable is explicit', async () => {
  const fabricated = makeEnvelope([suggestion('basics.name', 'Mira Rao', { provenance: { status: 'exact', text: 'Invented source quote.' } })]);
  const result = await runAIRequest(simpleRequest, rawProvider(envelopeText(fabricated)));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'invalid_response');

  const withoutQuote = makeEnvelope([suggestion('basics.name', 'Mira Rao', { provenance: { status: 'unavailable' } })]);
  const accepted = await runAIRequest(simpleRequest, rawProvider(envelopeText(withoutQuote)));
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.deepEqual(accepted.suggestions[0]?.provenance, { status: 'unavailable' });
});

test('provider exceptions, rate limits, unavailable state, and timeout are sanitized', async () => {
  for (const [code, expected] of [
    ['rate_limited', 'rate_limited'],
    ['timeout', 'timeout'],
    ['unavailable', 'unavailable'],
    ['provider_failure', 'provider_failure'],
  ] as const) {
    const provider: AIProvider = { kind: 'external', async complete() { throw new AIProviderError(code); } };
    const result = await runAIRequest(simpleRequest, provider);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, expected);
      assert.doesNotMatch(result.error.message, /secret|token|api key/i);
    }
  }
  const secretFailure: AIProvider = { kind: 'external', async complete() { throw new Error('SECRET_API_KEY=do-not-leak'); } };
  const sanitized = await runAIRequest(simpleRequest, secretFailure);
  assert.equal(sanitized.ok, false);
  assert.equal(JSON.stringify(sanitized).includes('SECRET_API_KEY'), false);

  let gotAbort = false;
  const hangingProvider: AIProvider = {
    kind: 'external',
    complete(_input, { signal }) {
      return new Promise<ProviderReply>((_resolve, reject) => {
        signal.addEventListener('abort', () => { gotAbort = true; reject(new Error('aborted')); }, { once: true });
      });
    },
  };
  const timeout = await runAIRequest(simpleRequest, hangingProvider, { timeoutMs: 25 });
  assert.equal(timeout.ok, false);
  if (!timeout.ok) assert.equal(timeout.error.code, 'timeout');
  assert.equal(gotAbort, true);
});

test('suggestions remain suggested until explicit decisions; only accepted or edited values can be applied', async () => {
  const response = await runAIRequest(simpleRequest, createFixtureProvider());
  assert.equal(response.ok, true);
  if (!response.ok || response.operation !== 'extract_profile') return;
  const nameSuggestion = response.suggestions.find((item) => item.path === 'basics.name');
  assert.ok(nameSuggestion);
  const original = createEmptyProfile();
  const untouched = applyApprovedSuggestion(original, nameSuggestion);
  assert.deepEqual(untouched, { ok: false, reason: 'not_approved' });
  assert.equal(original.basics.name, '');

  const accepted = resolveSuggestion(nameSuggestion, { action: 'accept' });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const applied = applyApprovedSuggestion(original, accepted.suggestion);
  assert.equal(applied.ok, true);
  assert.equal(original.basics.name, '', 'application returns a new profile rather than mutating the source');
  if (applied.ok) {
    assert.equal(applied.profile.basics.name, 'Mira Rao');
    assert.equal(applied.changed, true);
  }

  const edited = resolveSuggestion(nameSuggestion, { action: 'edit', proposedValue: 'Mira R.' });
  assert.equal(edited.ok, true);
  if (edited.ok) {
    assert.equal(edited.suggestion.status, 'edited');
    const editedProfile = applyApprovedSuggestion(original, edited.suggestion);
    assert.equal(editedProfile.ok, true);
    if (editedProfile.ok) assert.equal(editedProfile.profile.basics.name, 'Mira R.');
  }

  for (const action of [{ action: 'reject' }, { action: 'defer' }] as const) {
    const resolved: ResolveSuggestionResult = resolveSuggestion(nameSuggestion, action);
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(applyApprovedSuggestion(original, resolved.suggestion).ok, false);
  }
  assert.equal(resolveSuggestion(nameSuggestion, { action: 'edit', proposedValue: 'x'.repeat(121) }).ok, false);
  assert.equal(resolveSuggestion(nameSuggestion, { action: 'edit', proposedValue: 'bad' }).ok, true);
  assert.equal(resolveSuggestion(nameSuggestion, { action: 'edit', proposedValue: 'Mira' }).ok, true);
  assert.equal(resolveSuggestion(nameSuggestion, { action: 'edit', proposedValue: { unexpected: true } }).ok, false);
});

test('collection caps and duplicate handling are bounded at application time', async () => {
  const source = createEmptyProfile();
  source.skills = Array.from({ length: 50 }, (_, index) => `Skill ${index + 1}`);
  const suggestionData = {
    id: 'suggestion-1', path: 'skills', proposedValue: 'New skill', provenance: { status: 'unavailable' },
    reason: 'A supported skill.', confidence: 'high', needsReview: true, status: 'accepted',
  };
  assert.deepEqual(applyApprovedSuggestion(source, suggestionData), { ok: false, reason: 'collection_limit' });
  const duplicate = applyApprovedSuggestion(source, { ...suggestionData, proposedValue: 'skill 1' });
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.changed, false);
});

test('legacy draft defaults and manual draft schema remain compatible with approval', () => {
  const current = createEmptyProfile();
  current.basics.name = 'Legacy student';
  const legacyProfile = structuredClone(current) as Record<string, unknown>;
  const legacyBasics = { ...(legacyProfile.basics as Record<string, unknown>) };
  delete legacyBasics.originalNotes;
  legacyProfile.basics = legacyBasics;
  delete legacyProfile.activities;
  const legacyLinks = { ...(legacyProfile.links as Record<string, unknown>) };
  delete legacyLinks.other;
  legacyProfile.links = legacyLinks;

  const parsedLegacy = ProfileDocumentSchema.safeParse(legacyProfile);
  assert.equal(parsedLegacy.success, true);
  if (!parsedLegacy.success) return;
  assert.equal(parsedLegacy.data.basics.originalNotes, '');
  assert.deepEqual(parsedLegacy.data.activities, []);
  assert.deepEqual(parsedLegacy.data.links.other, []);

  const bundle = DraftBundleSchema.safeParse({
    profile: legacyProfile,
    design: createDefaultDesign(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(bundle.success, true);
  if (!bundle.success) return;
  const candidate = {
    id: 'suggestion-location', path: 'basics.location', proposedValue: 'Bengaluru', provenance: { status: 'unavailable' },
    reason: 'Optional location proposal.', confidence: 'medium', needsReview: true, status: 'accepted',
  };
  const applied = applyApprovedSuggestion(bundle.data.profile, candidate);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.profile.basics.location, 'Bengaluru');
    assert.equal(applied.profile.basics.originalNotes, '');
    assert.deepEqual(applied.profile.activities, []);
    assert.equal(bundle.data.design.templateId, 'minimal');
  }
});

test('accepted proposals preserve original notes and cannot target the notes field', () => {
  const profile = createEmptyProfile();
  profile.basics.originalNotes = 'These are the user’s exact rough notes.';
  const accepted = {
    id: 'suggestion-about', path: 'basics.about', proposedValue: 'A short user-reviewed introduction.',
    provenance: { status: 'unavailable' }, reason: 'A supported proposal.', confidence: 'medium', needsReview: true, status: 'accepted',
  };
  const applied = applyApprovedSuggestion(profile, accepted);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.profile.basics.about, 'A short user-reviewed introduction.');
    assert.equal(applied.profile.basics.originalNotes, 'These are the user’s exact rough notes.');
  }
  assert.equal(resolveSuggestion({ ...accepted, path: 'basics.originalNotes' }, { action: 'accept' }).ok, false);
});

test('pure response schemas reject malformed envelopes before any profile can change', () => {
  assert.equal(ProviderEnvelopeSchema.safeParse({ suggestions: [], clarifyingQuestions: [] }).success, true);
  assert.equal(ProviderEnvelopeSchema.safeParse({ suggestions: 'not-an-array', clarifyingQuestions: [] }).success, false);
  assert.equal(AIServiceResultSchema.safeParse({ ok: false, error: { code: 'provider_failure', message: 'Safe.', retryable: true } }).success, true);
  assert.equal(AIServiceResultSchema.safeParse({ ok: false, error: { code: 'unknown', message: 'No.', retryable: false } }).success, false);
  assert.equal(validateProposalValue('links.github', 'javascript:alert(1)').success, false);
  assert.equal(validateProposalValue('links.email', 'not-an-email').success, false);
});
