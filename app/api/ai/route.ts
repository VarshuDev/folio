import { AIServiceResultSchema, MAX_REQUEST_BODY_BYTES } from '@/lib/ai/contract';
import { createFixtureProvider } from '@/lib/ai/fixtures';
import { createConfiguredGeminiProvider } from '@/lib/ai/gemini-provider';
import { httpStatusForAIResult, runAIRequest } from '@/lib/ai/service';

export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

type BoundedBodyResult = { ok: true; text: string } | { ok: false; tooLarge: boolean };

async function readBoundedBody(request: Request): Promise<BoundedBodyResult> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number.isFinite(Number(declaredLength)) && Number(declaredLength) > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* the disconnect is already handled safely */ }
    return { ok: false, tooLarge: false };
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

function providerForThisEnvironment() {
  // Fixture replies remain strictly local/dev test infrastructure and must never
  // be exposed as real AI output in the product UI.
  if (process.env.NODE_ENV !== 'production' && process.env.FOLIO_AI_PROVIDER === 'fixture') {
    return createFixtureProvider();
  }
  // A configured server-side Gemini provider is opt-in. Missing/invalid env
  // configuration returns null so callers retain the manual flow.
  return createConfiguredGeminiProvider();
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBoundedBody(request);
  if (!body.ok) {
    const error = body.tooLarge
      ? { code: 'request_too_large', message: 'This request is too long. Your original notes are unchanged; shorten them or continue manually.', retryable: false }
      : { code: 'invalid_request', message: 'The request could not be validated. Please check the input and try again.', retryable: false };
    const result = AIServiceResultSchema.parse({ ok: false, error });
    return Response.json(result, { status: body.tooLarge ? 413 : 400, headers: responseHeaders });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    const result = AIServiceResultSchema.parse({
      ok: false,
      error: { code: 'invalid_request', message: 'The request could not be validated. Please check the input and try again.', retryable: false },
    });
    return Response.json(result, { status: 400, headers: responseHeaders });
  }

  try {
    const result = await runAIRequest(payload, providerForThisEnvironment());
    return Response.json(result, { status: httpStatusForAIResult(result), headers: responseHeaders });
  } catch {
    const result = AIServiceResultSchema.parse({
      ok: false,
      error: { code: 'provider_failure', message: 'AI assistance is temporarily unavailable. Your information is unchanged; continue manually.', retryable: true },
    });
    return Response.json(result, { status: 502, headers: responseHeaders });
  }
}
