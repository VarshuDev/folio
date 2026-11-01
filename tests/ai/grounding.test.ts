import assert from 'node:assert/strict';
import test from 'node:test';
import { runAIRequest } from '../../lib/ai/service';
import type { AIProvider, ProviderReply } from '../../lib/ai/provider-contract';

function providerWith(suggestion: Record<string, unknown>): AIProvider {
  return {
    kind: 'external',
    async complete(): Promise<ProviderReply> {
      return { raw: JSON.stringify({ suggestions: [suggestion], clarifyingQuestions: [] }) };
    },
  };
}

function proposal(path: string, proposedValue: unknown, sourceExcerpt: string) {
  return {
    path,
    proposedValue,
    provenance: { status: 'exact', text: sourceExcerpt },
    reason: 'Ignored by the server; user-facing explanations are fixed and safe.',
    confidence: 'high',
    needsReview: true,
  };
}

test('server grounding rejects unsupported project claims even when the quote exists', async () => {
  const sourceText = 'I made a small Android file sharing app with Kotlin.';
  const result = await runAIRequest({ operation: 'extract_profile', sourceText }, providerWith(proposal('projects', {
    title: 'Android file sharing app',
    description: 'A production-ready Android app used by thousands.',
    tools: 'Kotlin',
    link: '',
  }, sourceText)));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'invalid_response');
});

test('server accepts conservative paraphrase when its factual tokens are supported', async () => {
  const sourceText = 'I made a small Android file sharing app with Kotlin.';
  const result = await runAIRequest({ operation: 'extract_profile', sourceText }, providerWith(proposal('projects', {
    title: 'Small Android file-sharing app',
    description: 'I made a small Android file sharing app with Kotlin.',
    tools: 'Kotlin',
    link: '',
  }, sourceText)));
  assert.equal(result.ok, true);
});

test('URL normalization accepts a scheme and trailing slash while requiring a URL in the exact excerpt', async () => {
  const sourceText = 'GitHub: github.com/rahul.';
  const result = await runAIRequest({ operation: 'extract_profile', sourceText }, providerWith(proposal('links.github', 'https://github.com/rahul/', 'github.com/rahul')));
  assert.equal(result.ok, true);

  const fabricated = await runAIRequest({ operation: 'extract_profile', sourceText }, providerWith(proposal('links.github', 'https://github.com/someone-else', 'github.com/rahul')));
  assert.equal(fabricated.ok, false);
});

test('service replaces model-written reasons and downgrades unavailable provenance to low confidence', async () => {
  const sourceText = 'Name: Rahul.';
  const result = await runAIRequest({ operation: 'extract_profile', sourceText }, providerWith({
    path: 'basics.name',
    proposedValue: 'Rahul',
    provenance: { status: 'unavailable' },
    reason: 'He won a national award.',
    confidence: 'high',
    needsReview: true,
  }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.suggestions[0]?.confidence, 'low');
    assert.doesNotMatch(result.suggestions[0]?.reason ?? '', /national award/i);
  }
});
