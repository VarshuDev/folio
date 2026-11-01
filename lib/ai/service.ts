import {
  AIRequestSchema,
  AIServiceResultSchema,
  CopyProviderEnvelopeSchema,
  MAX_CLARIFYING_QUESTIONS,
  MAX_COPY_TEXT_CHARS,
  MAX_PROVIDER_RESPONSE_BYTES,
  MAX_SOURCE_TEXT_CHARS,
  MAX_SUGGESTIONS_PER_PATH,
  ProviderEnvelopeSchema,
  type AIErrorCode,
  type AIRequest,
  type AIServiceError,
  type AIServiceResult,
  type AIServiceSuccess,
  type AllowedProfilePath,
  type CopyImprovementProposal,
  type ProviderSuggestion,
} from './contract';
import { makeProviderInput, type AIProvider, type ProviderReply } from './provider-contract';
import { copyImprovementReason, isGroundedCopyRewrite } from './copy-grounding';
import { validateProposalValue } from './contract';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;
export const MIN_PROVIDER_TIMEOUT_MS = 25;
export const MAX_PROVIDER_TIMEOUT_MS = 30_000;

export class AIProviderError extends Error {
  readonly code: 'unavailable' | 'timeout' | 'rate_limited' | 'provider_failure';

  constructor(code: AIProviderError['code']) {
    super(code);
    this.name = 'AIProviderError';
    this.code = code;
  }
}

const SAFE_MESSAGES: Readonly<Record<AIErrorCode, { message: string; retryable: boolean }>> = {
  invalid_request: {
    message: 'The request could not be validated. Please check the input and try again.',
    retryable: false,
  },
  request_too_large: {
    message: 'This request is too long. Your original notes are unchanged; shorten them or continue manually.',
    retryable: false,
  },
  unsupported_operation: {
    message: 'That assistance is not available yet. Your information is unchanged; continue manually.',
    retryable: false,
  },
  unavailable: {
    message: 'AI assistance is not available right now. Your notes are unchanged; continue manually.',
    retryable: false,
  },
  timeout: {
    message: 'AI assistance took too long. Your information is unchanged; try again later or continue manually.',
    retryable: true,
  },
  rate_limited: {
    message: 'AI assistance is temporarily rate-limited. Try again later or continue manually.',
    retryable: true,
  },
  provider_failure: {
    message: 'AI assistance is temporarily unavailable. Your information is unchanged; continue manually.',
    retryable: true,
  },
  empty_response: {
    message: 'No usable suggestions were returned. Your information is unchanged; continue manually.',
    retryable: true,
  },
  invalid_response: {
    message: 'The service returned information we could not safely use. Your information is unchanged; continue manually.',
    retryable: false,
  },
};

function failure(code: AIErrorCode): AIServiceError {
  return AIServiceResultSchema.parse({ ok: false, error: { code, ...SAFE_MESSAGES[code] } }) as AIServiceError;
}

function timeoutMsWithinBounds(timeoutMs: number | undefined): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_PROVIDER_TIMEOUT_MS;
  return Math.min(MAX_PROVIDER_TIMEOUT_MS, Math.max(MIN_PROVIDER_TIMEOUT_MS, timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS));
}

function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Settle the timeout first so an abort-triggered provider rejection cannot
      // mask the stable timeout code returned to the caller.
      reject(new AIProviderError('timeout'));
      controller.abort();
    }, timeoutMs);
  });
  return Promise.race([task(controller.signal), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function safeByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function verifyProvenance(sourceText: string, provenance: { status: 'exact'; text: string } | { status: 'unavailable' }): boolean {
  return provenance.status === 'unavailable' || sourceText.includes(provenance.text);
}

const GROUNDING_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'did', 'do', 'does',
  'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'hers', 'him', 'his', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'ours', 'she', 'that', 'the',
  'their', 'them', 'they', 'this', 'those', 'through', 'to', 'us', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'who', 'with', 'you', 'your', 'yours', 'than', 'then', 'also',
]);

function groundingTokens(value: string): string[] {
  const normalized = value.normalize('NFKC').toLocaleLowerCase();
  const tokens = normalized.match(/[\p{L}\p{N}]+(?:[+#][\p{L}\p{N}+#]*)*/gu) ?? [];
  return tokens.filter((token) => !GROUNDING_STOP_WORDS.has(token));
}

function canonicalUrl(raw: string): string | null {
  const value = raw.trim().replace(/[),.!?;:'"]+$/g, '');
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || url.username || url.password) return null;
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '') || '';
    return `${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

function excerptContainsUrl(excerpt: string, rawUrl: string): boolean {
  const expected = canonicalUrl(rawUrl);
  if (!expected) return false;
  const candidates = excerpt.match(/(?:https?:\/\/)?(?:www\.)?[\p{L}\p{N}][\p{L}\p{N}.-]*\.[\p{L}]{2,}(?:\/[^\s<>"']*)?/giu) ?? [];
  return candidates.some((candidate) => canonicalUrl(candidate) === expected);
}
function textValueGrounded(value: string, excerpt: string): boolean {
  const excerptTokens = groundingTokens(excerpt);
  const proposalTokens = groundingTokens(value);
  if (proposalTokens.length === 0) return false;
  let searchFrom = 0;
  for (const token of proposalTokens) {
    const foundAt = excerptTokens.indexOf(token, searchFrom);
    if (foundAt < 0) return false;
    searchFrom = foundAt + 1;
  }
  return true;
}

/** A conservative token/URL grounding check complements exact quote validation. */
function proposalGrounded(path: AllowedProfilePath, value: unknown, excerpt: string): boolean {
  if (path === 'links.github' || path === 'links.linkedin') {
    return typeof value === 'string' && excerptContainsUrl(excerpt, value);
  }
  if (path === 'links.email') {
    return typeof value === 'string' && excerpt.toLocaleLowerCase().includes(value.toLocaleLowerCase());
  }
  if (path === 'links.other') {
    if (!value || typeof value !== 'object') return false;
    const link = value as { label?: unknown; url?: unknown };
    return typeof link.label === 'string' && typeof link.url === 'string'
      && textValueGrounded(link.label, excerpt)
      && excerptContainsUrl(excerpt, link.url);
  }
  if (path === 'projects') {
    if (!value || typeof value !== 'object') return false;
    const project = value as { title?: unknown; description?: unknown; tools?: unknown; link?: unknown };
    const titleOkay = typeof project.title === 'string' && (!project.title.trim() || textValueGrounded(project.title, excerpt));
    const descriptionOkay = typeof project.description === 'string' && (!project.description.trim() || textValueGrounded(project.description, excerpt));
    const toolsOkay = typeof project.tools === 'string' && (!project.tools.trim() || textValueGrounded(project.tools, excerpt));
    const linkOkay = typeof project.link === 'string' && (!project.link.trim() || excerptContainsUrl(excerpt, project.link));
    return (Boolean(typeof project.title === 'string' && project.title.trim())
      || Boolean(typeof project.description === 'string' && project.description.trim()))
      && titleOkay && descriptionOkay && toolsOkay && linkOkay;
  }
  return typeof value === 'string' && textValueGrounded(value, excerpt);
}

function validateEnvelopePaths(
  sourceText: string,
  suggestions: ProviderSuggestion[],
  clarifyingQuestions: Array<{ provenance: ProviderSuggestion['provenance'] }>,
): boolean {
  const pathCounts = new Map<AllowedProfilePath, number>();
  for (const suggestion of suggestions) {
    const value = validateProposalValue(suggestion.path, suggestion.proposedValue);
    if (!value.success) return false;
    if (!verifyProvenance(sourceText, suggestion.provenance)) return false;
    if (suggestion.provenance.status === 'exact' && !proposalGrounded(suggestion.path, value.data, suggestion.provenance.text)) return false;

    const count = (pathCounts.get(suggestion.path) ?? 0) + 1;
    if (count > MAX_SUGGESTIONS_PER_PATH[suggestion.path]) return false;
    pathCounts.set(suggestion.path, count);
  }
  return clarifyingQuestions.every((question) => verifyProvenance(sourceText, question.provenance));
}

function safelyParseProviderReply(reply: ProviderReply): { rawText: string; fixtureCase?: string } | null {
  if (!reply || typeof reply !== 'object' || typeof reply.raw !== 'string') return null;
  if (safeByteLength(reply.raw) > MAX_PROVIDER_RESPONSE_BYTES) return null;
  const fixtureCase = typeof reply.fixtureCase === 'string' && reply.fixtureCase.length <= 80
    ? reply.fixtureCase
    : undefined;
  return { rawText: reply.raw, fixtureCase };
}

function providerErrorCode(error: unknown): AIErrorCode {
  if (error instanceof AIProviderError) return error.code;
  return 'provider_failure';
}

function normalizedCopyText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

async function runCopyImprovement(
  request: Extract<AIRequest, { operation: 'improve_copy' }>,
  provider: AIProvider | null,
  timeoutMs: number,
): Promise<AIServiceResult> {
  if (!provider || provider.kind !== 'external') return failure('unavailable');

  let rawReply: ProviderReply;
  try {
    rawReply = await withTimeout(
      (signal) => provider.complete(makeProviderInput(request), { signal }),
      timeoutMs,
    );
  } catch (error) {
    return failure(providerErrorCode(error));
  }

  const boundedReply = safelyParseProviderReply(rawReply);
  if (!boundedReply) return failure('invalid_response');
  if (!boundedReply.rawText.trim()) return failure('empty_response');

  let decoded: unknown;
  try {
    decoded = JSON.parse(boundedReply.rawText);
  } catch {
    return failure('invalid_response');
  }

  const envelopeResult = CopyProviderEnvelopeSchema.safeParse(decoded);
  if (!envelopeResult.success) return failure('invalid_response');

  const acceptedAlternatives: Array<{ proposedText: string; sourceExcerpt: string }> = [];
  const seen = new Set([normalizedCopyText(request.text)]);
  for (const alternative of envelopeResult.data.alternatives) {
    const textKey = normalizedCopyText(alternative.proposedText);
    if (!request.text.includes(alternative.sourceExcerpt) || seen.has(textKey)) continue;
    if (!isGroundedCopyRewrite(request.text, alternative.proposedText, request.action)) continue;
    seen.add(textKey);
    acceptedAlternatives.push(alternative);
  }
  if (acceptedAlternatives.length < 2) return failure('invalid_response');

  const suggestions: CopyImprovementProposal[] = acceptedAlternatives.slice(0, 3).map((alternative, index) => ({
    id: `copy-${index + 1}`,
    path: request.path,
    originalText: request.text,
    proposedText: alternative.proposedText.trim(),
    action: request.action,
    provenance: { status: 'exact', text: alternative.sourceExcerpt },
    reason: copyImprovementReason(request.action),
    confidence: 'medium',
    needsReview: true,
    status: 'suggested',
  }));

  const success = {
    ok: true as const,
    operation: 'improve_copy' as const,
    mode: 'provider' as const,
    suggestions,
  };
  const checked = AIServiceResultSchema.safeParse(success);
  return checked.success ? checked.data : failure('invalid_response');
}

/**
 * Validates the client request, invokes one injected server-side provider, then
 * validates every byte of returned JSON before returning review-only proposals.
 * It does not write to drafts or mutate ProfileDocument.
 */
export async function runAIRequest(
  rawRequest: unknown,
  provider: AIProvider | null,
  options: { timeoutMs?: number } = {},
): Promise<AIServiceResult> {
  if (rawRequest && typeof rawRequest === 'object'
    && (rawRequest as { operation?: unknown }).operation === 'adapt_copy_to_style') {
    return failure('unsupported_operation');
  }

  const requestResult = AIRequestSchema.safeParse(rawRequest);
  if (!requestResult.success) {
    if (rawRequest && typeof rawRequest === 'object') {
      const candidate = rawRequest as { sourceText?: unknown; text?: unknown };
      if (typeof candidate.sourceText === 'string' && candidate.sourceText.length > MAX_SOURCE_TEXT_CHARS) return failure('request_too_large');
      if (typeof candidate.text === 'string' && candidate.text.length > MAX_COPY_TEXT_CHARS) return failure('request_too_large');
    }
    return failure('invalid_request');
  }

  const request = requestResult.data;
  if (request.operation === 'improve_copy') {
    return runCopyImprovement(request, provider, timeoutMsWithinBounds(options.timeoutMs));
  }
  if (request.operation !== 'extract_profile') return failure('unsupported_operation');
  if (!provider) return failure('unavailable');

  let rawReply: ProviderReply;
  try {
    rawReply = await withTimeout(
      (signal) => provider.complete(makeProviderInput(request), { signal }),
      timeoutMsWithinBounds(options.timeoutMs),
    );
  } catch (error) {
    return failure(providerErrorCode(error));
  }

  const boundedReply = safelyParseProviderReply(rawReply);
  if (!boundedReply) return failure('invalid_response');
  if (!boundedReply.rawText.trim()) return failure('empty_response');

  let decoded: unknown;
  try {
    decoded = JSON.parse(boundedReply.rawText);
  } catch {
    return failure('invalid_response');
  }

  const envelopeResult = ProviderEnvelopeSchema.safeParse(decoded);
  if (!envelopeResult.success) return failure('invalid_response');
  const envelope = envelopeResult.data;
  if (envelope.suggestions.length === 0 && envelope.clarifyingQuestions.length === 0) {
    return failure('empty_response');
  }
  if (envelope.clarifyingQuestions.length > MAX_CLARIFYING_QUESTIONS) return failure('invalid_response');
  if (!validateEnvelopePaths(request.sourceText, envelope.suggestions, envelope.clarifyingQuestions)) {
    return failure('invalid_response');
  }

  const suggestions = envelope.suggestions.map((suggestion, index) => ({
    id: `suggestion-${index + 1}`,
    ...suggestion,
    // Do not forward free-form model explanations as facts. The fixed wording is
    // accurate for both quoted and unavailable provenance.
    reason: suggestion.provenance.status === 'exact'
      ? 'Compare this with the quoted note and check that it means what you intended.'
      : 'No exact source excerpt was available, so please verify this carefully.',
    ...(suggestion.provenance.status === 'unavailable' ? { confidence: 'low' as const } : {}),
    needsReview: true as const,
    status: 'suggested' as const,
  }));

  const success: AIServiceSuccess = {
    ok: true,
    operation: 'extract_profile',
    mode: provider.kind === 'fixture' ? 'fixture' : 'provider',
    ...(provider.kind === 'fixture'
      ? {
          notice: 'Development test fixture only — deterministic data, not AI output.',
          ...(boundedReply.fixtureCase ? { fixtureCase: boundedReply.fixtureCase } : {}),
        }
      : {}),
    suggestions,
    clarifyingQuestions: envelope.clarifyingQuestions,
  };
  const checked = AIServiceResultSchema.safeParse(success);
  return checked.success ? checked.data : failure('invalid_response');
}

export function httpStatusForAIResult(result: AIServiceResult): number {
  if (result.ok) return 200;
  switch (result.error.code) {
    case 'invalid_request': return 400;
    case 'request_too_large': return 413;
    case 'unsupported_operation': return 422;
    case 'unavailable': return 503;
    case 'timeout': return 504;
    case 'rate_limited': return 429;
    case 'provider_failure':
    case 'empty_response':
    case 'invalid_response': return 502;
  }
}
