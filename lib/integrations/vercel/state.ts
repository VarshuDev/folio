import crypto from 'node:crypto';
import type { VercelOAuthStatePayload } from './types';
import {
  getOAuthStateRepository,
  type VercelOAuthStateRepository,
} from './state-repository';

export * from './state-repository';

const STATE_SECRET =
  process.env.VERCEL_OAUTH_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  'folio-state-signing-key-default-2026';

export const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates an unpredictable, tamper-evident CSRF state parameter tied to the authenticated user
 * and persists the nonce into durable state storage.
 */
export async function createOAuthState(
  userId: string,
  nextUrl = '/account',
  repo?: VercelOAuthStateRepository,
): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const payload: VercelOAuthStatePayload = {
    userId,
    nonce,
    timestamp: now,
    nextUrl,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');

  const signature = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const repository = repo || getOAuthStateRepository();
  const expiresAt = new Date(now + STATE_TTL_MS);

  await repository.createState({
    nonce,
    ownerId: userId,
    expiresAt,
  });

  return `${payloadB64}.${signature}`;
}

export type VerifyStateResult =
  | { ok: true; payload: VercelOAuthStatePayload }
  | {
      ok: false;
      error: string;
      code: 'invalid_format' | 'invalid_signature' | 'expired' | 'replayed' | 'user_mismatch' | 'not_found';
    };

/**
 * Validates a returned OAuth state parameter, ensuring HMAC signature integrity,
 * validity period, and durable single-use nonce consumption.
 */
export async function verifyOAuthState(
  stateString: string,
  expectedUserId?: string,
  options?: { consume?: boolean; repo?: VercelOAuthStateRepository },
): Promise<VerifyStateResult> {
  if (!stateString || typeof stateString !== 'string' || !stateString.includes('.')) {
    return { ok: false, error: 'Malformed OAuth state parameter.', code: 'invalid_format' };
  }

  const [payloadB64, signature] = stateString.split('.');
  if (!payloadB64 || !signature) {
    return { ok: false, error: 'Malformed OAuth state parameter.', code: 'invalid_format' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return { ok: false, error: 'OAuth state signature verification failed.', code: 'invalid_signature' };
  }

  let payload: VercelOAuthStatePayload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr) as VercelOAuthStatePayload;
  } catch {
    return { ok: false, error: 'Invalid OAuth state JSON payload.', code: 'invalid_format' };
  }

  // Check expected user if provided
  if (expectedUserId && payload.userId !== expectedUserId) {
    return { ok: false, error: 'OAuth state user does not match the active session.', code: 'user_mismatch' };
  }

  // Check payload timestamp expiration
  if (Date.now() - payload.timestamp > STATE_TTL_MS) {
    return { ok: false, error: 'OAuth state has expired. Please initiate connection again.', code: 'expired' };
  }

  const repository = options?.repo || getOAuthStateRepository();

  if (options?.consume === false) {
    const existing = await repository.getState(payload.nonce);
    if (!existing) {
      return { ok: false, error: 'OAuth state was not found or was never issued.', code: 'not_found' };
    }
    if (existing.consumedAt) {
      return { ok: false, error: 'OAuth state has already been consumed (replay detected).', code: 'replayed' };
    }
    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      return { ok: false, error: 'OAuth state has expired. Please initiate connection again.', code: 'expired' };
    }
    if (expectedUserId && existing.ownerId !== expectedUserId) {
      return { ok: false, error: 'OAuth state user does not match the active session.', code: 'user_mismatch' };
    }
    return { ok: true, payload };
  }

  // Atomic single-use consumption from repository
  const consumeResult = await repository.consumeState({
    nonce: payload.nonce,
    ownerId: expectedUserId || payload.userId,
  });

  if (!consumeResult.ok) {
    return {
      ok: false,
      error: consumeResult.error,
      code: consumeResult.code,
    };
  }

  return { ok: true, payload };
}

export function resetNonceStoreForTesting(): void {
  const repo = getOAuthStateRepository();
  if (repo.clear) {
    repo.clear();
  }
}
