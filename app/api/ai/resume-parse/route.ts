import { MAX_REQUEST_BODY_BYTES } from '@/lib/ai/contract';
import { parseResumeText, convertResumeFactsToSuggestions } from '@/lib/ai/resume-parser';

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
    try { await reader.cancel(); } catch { /* ignore */ }
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

export async function POST(request: Request): Promise<Response> {
  const body = await readBoundedBody(request);
  if (!body.ok) {
    return Response.json(
      { ok: false, error: body.tooLarge ? 'Resume text is too large. Please keep under 48KB.' : 'Invalid request payload.' },
      { status: body.tooLarge ? 413 : 400, headers: responseHeaders },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch {
    return Response.json({ ok: false, error: 'Malformed JSON' }, { status: 400, headers: responseHeaders });
  }

  if (typeof payload !== 'object' || payload === null || !('resumeText' in payload)) {
    return Response.json({ ok: false, error: 'Missing resumeText in request body.' }, { status: 400, headers: responseHeaders });
  }

  const resumeText = String((payload as { resumeText: unknown }).resumeText || '').trim();
  if (!resumeText) {
    return Response.json({ ok: false, error: 'Resume text cannot be blank.' }, { status: 400, headers: responseHeaders });
  }

  try {
    const facts = parseResumeText(resumeText);
    const suggestions = convertResumeFactsToSuggestions(facts);

    return Response.json({
      ok: true,
      suggestions,
      facts,
      count: suggestions.length,
    }, { status: 200, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    return Response.json({ ok: false, error: message }, { status: 500, headers: responseHeaders });
  }
}
