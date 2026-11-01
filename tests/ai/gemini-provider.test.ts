import assert from 'node:assert/strict';
import test from 'node:test';
import { AIProviderError, runAIRequest } from '../../lib/ai/service';
import {
  createConfiguredGeminiProvider,
  createGeminiProvider,
  DEFAULT_GEMINI_MODEL,
  GEMINI_COPY_IMPROVEMENT_SCHEMA,
  GEMINI_EXTRACTION_SCHEMA,
} from '../../lib/ai/gemini-provider';
import { type ProviderInput } from '../../lib/ai/provider-contract';

const sampleInput: ProviderInput = {
  operation: 'extract_profile',
  systemInstructions: 'Fixed extraction instructions.',
  untrustedUserContent: { sourceText: 'Name: Rahul. Learning Python.' },
};

function geminiBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

test('Gemini adapter is opt-in and defaults to the documented Flash model', () => {
  assert.equal(createConfiguredGeminiProvider({})?.kind, undefined);
  assert.equal(createConfiguredGeminiProvider({ FOLIO_AI_PROVIDER: 'gemini' }), null);
  const provider = createConfiguredGeminiProvider({ FOLIO_AI_PROVIDER: 'gemini', FOLIO_AI_API_KEY: 'server-key' });
  assert.ok(provider);
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(createConfiguredGeminiProvider({ FOLIO_AI_PROVIDER: 'gemini', FOLIO_AI_API_KEY: 'key', FOLIO_AI_MODEL: 'bad-model' }), null);
});

test('Gemini REST request keeps the key in a server header and sends only sourceText as user content', async () => {
  const raw = JSON.stringify({ suggestions: [], clarifyingQuestions: [{ question: 'What topic?', reason: 'Need one detail.', provenance: { status: 'unavailable' } }] });
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const provider = createGeminiProvider({
    apiKey: 'super-secret-server-key',
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json(geminiBody(raw));
    },
  });
  const reply = await provider.complete(sampleInput, { signal: new AbortController().signal });
  assert.equal(reply.raw, raw);
  assert.equal(capturedUrl, `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
  assert.equal(capturedInit?.method, 'POST');
  assert.equal((capturedInit?.headers as Record<string, string>)['x-goog-api-key'], 'super-secret-server-key');
  assert.equal(capturedUrl.includes('super-secret-server-key'), false);
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.systemInstruction.parts[0].text, sampleInput.systemInstructions);
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: sampleInput.untrustedUserContent.sourceText }] }]);
  assert.equal(JSON.stringify(body).includes('super-secret-server-key'), false);
  assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseFormat.text.schema, GEMINI_EXTRACTION_SCHEMA);
  assert.equal(capturedInit?.redirect, 'error');
});

test('configured Gemini adapter passes a grounded extraction through the existing proposal boundary', async () => {
  const sourceText = 'Name: Rahul. Learning Python.';
  const generatedJson = JSON.stringify({
    suggestions: [{
      path: 'basics.name',
      proposedValue: 'Rahul',
      provenance: { status: 'exact', text: 'Name: Rahul.' },
      reason: 'This model explanation is intentionally replaced by the server.',
      confidence: 'high',
      needsReview: true,
    }],
    clarifyingQuestions: [],
  });
  const provider = createGeminiProvider({
    apiKey: 'server-key',
    fetchImpl: async () => Response.json(geminiBody(generatedJson)),
  });
  const result = await runAIRequest({ operation: 'extract_profile', sourceText }, provider);
  assert.equal(result.ok, true);
  if (result.ok && result.operation === 'extract_profile') {
    assert.equal(result.mode, 'provider');
    assert.equal(result.suggestions[0]?.proposedValue, 'Rahul');
    assert.equal(result.suggestions[0]?.status, 'suggested');
    assert.equal(result.suggestions[0]?.reason, 'Compare this with the quoted note and check that it means what you intended.');
  }
});

test('Gemini copy adapter sends only selected text as untrusted user content and passes validated alternatives through the proposal boundary', async () => {
  const sourceText = 'I built a small website using React to learn frontend development.';
  const alternatives = [
    { proposedText: 'I built a small React website to learn frontend development.', sourceExcerpt: sourceText },
    { proposedText: 'To learn frontend development, I built a small website using React.', sourceExcerpt: sourceText },
  ];
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const provider = createGeminiProvider({
    apiKey: 'copy-server-secret',
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json(geminiBody(JSON.stringify({ alternatives })));
    },
  });
  const result = await runAIRequest({ operation: 'improve_copy', path: 'projects[0].description', text: sourceText, action: 'clearer' }, provider);
  assert.equal(result.ok, true);
  if (result.ok && result.operation === 'improve_copy') {
    assert.equal(result.suggestions.length, 2);
    assert.equal(result.suggestions[0]?.proposedText, alternatives[0]?.proposedText);
    assert.equal(result.suggestions[0]?.status, 'suggested');
  }
  assert.equal(capturedUrl, `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
  assert.equal((capturedInit?.headers as Record<string, string>)['x-goog-api-key'], 'copy-server-secret');
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.systemInstruction.parts[0].text.toLocaleLowerCase().includes('preserve its factual meaning'), true);
  assert.match(body.systemInstruction.parts[1].text, /Trusted requested action: clearer/);
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: sourceText }] }]);
  assert.deepEqual(body.generationConfig.responseFormat.text.schema, GEMINI_COPY_IMPROVEMENT_SCHEMA);
  assert.equal(JSON.stringify(body).includes('copy-server-secret'), false);
  assert.equal(JSON.stringify(body).includes('project-id'), false);
  assert.equal(capturedUrl.includes('copy-server-secret'), false);
});

test('Gemini REST provider maps upstream limits, timeouts, and failures to safe service codes', async () => {
  for (const [status, expected] of [[429, 'rate_limited'], [504, 'timeout'], [500, 'provider_failure']] as const) {
    const provider = createGeminiProvider({ apiKey: 'server-key', fetchImpl: async () => new Response('provider detail with secret', { status }) });
    await assert.rejects(provider.complete(sampleInput, { signal: new AbortController().signal }), (error: unknown) => {
      assert.ok(error instanceof AIProviderError);
      assert.equal(error.code, expected);
      assert.doesNotMatch(error.message, /secret|provider detail/i);
      return true;
    });
  }
});

test('malformed and empty Gemini envelopes fail closed through the existing validator', async () => {
  const malformed = createGeminiProvider({ apiKey: 'server-key', fetchImpl: async () => Response.json(geminiBody('not json')) });
  const malformedReply = await malformed.complete(sampleInput, { signal: new AbortController().signal });
  const malformedResult = await runAIRequest({ operation: 'extract_profile', sourceText: sampleInput.untrustedUserContent.sourceText }, {
    kind: 'external',
    async complete() { return malformedReply; },
  });
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) assert.equal(malformedResult.error.code, 'invalid_response');

  const empty = createGeminiProvider({ apiKey: 'server-key', fetchImpl: async () => Response.json({ candidates: [] }) });
  const reply = await empty.complete(sampleInput, { signal: new AbortController().signal });
  const result = await runAIRequest({ operation: 'extract_profile', sourceText: sampleInput.untrustedUserContent.sourceText }, {
    kind: 'external',
    async complete() { return reply; },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'empty_response');
});
