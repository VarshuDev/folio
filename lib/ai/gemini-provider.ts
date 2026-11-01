import { AIProviderError } from './service';
import type { AIProvider, ProviderInput, ProviderReply } from './provider-contract';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const MAX_GEMINI_RESPONSE_BYTES = 128 * 1024;
const GEMINI_MODEL_PATTERN = /^gemini-[a-zA-Z0-9._-]{1,100}$/;

/** Provider-side output constraint only; the existing Zod contract remains authoritative. */
export const GEMINI_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            enum: [
              'basics.name', 'basics.role', 'basics.about', 'basics.location',
              'education.college', 'education.degree', 'education.branch', 'education.gradYear', 'education.note',
              'skills', 'interests', 'projects', 'highlights', 'activities', 'learning',
              'links.email', 'links.github', 'links.linkedin', 'links.other',
            ],
          },
          proposedValue: {
            anyOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  tools: { type: 'string' },
                  link: { type: 'string' },
                },
                required: ['title', 'description', 'tools', 'link'],
              },
              {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  url: { type: 'string' },
                },
                required: ['label', 'url'],
              },
            ],
          },
          provenance: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['exact', 'unavailable'] },
              text: { type: 'string' },
            },
            required: ['status'],
          },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          needsReview: { type: 'boolean' },
        },
        required: ['path', 'proposedValue', 'provenance', 'reason', 'confidence', 'needsReview'],
      },
    },
    clarifyingQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          reason: { type: 'string' },
          provenance: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['exact', 'unavailable'] },
              text: { type: 'string' },
            },
            required: ['status'],
          },
        },
        required: ['question', 'reason', 'provenance'],
      },
    },
  },
  required: ['suggestions', 'clarifyingQuestions'],
} as const;

/** Narrow response schema for one selected copy field. */
export const GEMINI_COPY_IMPROVEMENT_SCHEMA = {
  type: 'object',
  properties: {
    alternatives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          proposedText: { type: 'string' },
          sourceExcerpt: { type: 'string' },
        },
        required: ['proposedText', 'sourceExcerpt'],
      },
    },
  },
  required: ['alternatives'],
} as const;

type GeminiProviderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

type GeminiPart = { text?: unknown };
type GeminiApiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
};

function validModel(model: string) {
  return GEMINI_MODEL_PATTERN.test(model);
}

function getTextFromGeminiResponse(raw: unknown): string {
  if (!raw || typeof raw !== 'object') throw new AIProviderError('provider_failure');
  const body = raw as GeminiApiResponse;
  const parts = body.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('');
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_GEMINI_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AIProviderError('provider_failure');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    try { await reader.cancel(); } catch { /* response is already closed */ }
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError('provider_failure');
  }
}

/**
 * Server-side REST adapter. The API key is sent only in the provider header;
 * extraction notes or one selected copy field are sent as user content, never a
 * whole profile, design, local id, or unrelated application data.
 */
export function createGeminiProvider({ apiKey, model = DEFAULT_GEMINI_MODEL, fetchImpl = fetch }: GeminiProviderOptions): AIProvider {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey || !validModel(model)) throw new AIProviderError('unavailable');

  return {
    kind: 'external',
    async complete(input: ProviderInput, { signal }): Promise<ProviderReply> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          cache: 'no-store',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': normalizedKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                { text: input.systemInstructions },
                ...(input.operation === 'improve_copy' ? [{ text: `Trusted requested action: ${input.trustedTask.action}.` }] : []),
              ],
            },
            contents: [{
              role: 'user',
              parts: [{ text: input.operation === 'extract_profile'
                ? input.untrustedUserContent.sourceText
                : input.untrustedUserContent.text }],
            }],
            generationConfig: {
              temperature: input.operation === 'improve_copy' ? 0.2 : 0.1,
              maxOutputTokens: 4096,
              responseFormat: {
                text: {
                  mimeType: 'application/json',
                  schema: input.operation === 'extract_profile' ? GEMINI_EXTRACTION_SCHEMA : GEMINI_COPY_IMPROVEMENT_SCHEMA,
                },
              },
            },
          }),
          signal,
        });
      } catch {
        if (signal.aborted) throw new AIProviderError('timeout');
        throw new AIProviderError('provider_failure');
      }

      if (response.status === 429) throw new AIProviderError('rate_limited');
      if (response.status === 408 || response.status === 504) throw new AIProviderError('timeout');
      if (!response.ok) throw new AIProviderError('provider_failure');

      let decoded: unknown;
      try {
        const responseText = await readResponseText(response);
        decoded = JSON.parse(responseText);
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        throw new AIProviderError('provider_failure');
      }

      return { raw: getTextFromGeminiResponse(decoded) };
    },
  };
}

/** Explicit opt-in configuration. Unset/missing credentials keep manual intake available. */
export function createConfiguredGeminiProvider(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl?: typeof fetch,
): AIProvider | null {
  if (environment.FOLIO_AI_PROVIDER !== 'gemini') return null;
  const apiKey = environment.FOLIO_AI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = environment.FOLIO_AI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!validModel(model)) return null;
  try {
    return createGeminiProvider({ apiKey, model, ...(fetchImpl ? { fetchImpl } : {}) });
  } catch {
    return null;
  }
}
