import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface OAuthStateRecord {
  nonce: string;
  ownerId: string;
  expiresAt: string;
  consumedAt?: string | null;
  createdAt: string;
}

export type ConsumeOAuthStateResult =
  | { ok: true; record: OAuthStateRecord }
  | {
      ok: false;
      code: 'not_found' | 'expired' | 'replayed' | 'user_mismatch';
      error: string;
    };

export interface VercelOAuthStateRepository {
  createState(params: { nonce: string; ownerId: string; expiresAt: Date }): Promise<void>;
  getState(nonce: string): Promise<OAuthStateRecord | null>;
  consumeState(params: { nonce: string; ownerId: string }): Promise<ConsumeOAuthStateResult>;
  cleanupExpiredStates(): Promise<number>;
  clear?(): void;
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * In-memory OAuth state repository.
 * Provides thread-safe, atomic single-use nonce consumption for testing and development.
 */
export class InMemoryOAuthStateRepository implements VercelOAuthStateRepository {
  private states = new Map<string, OAuthStateRecord>();

  async createState(params: { nonce: string; ownerId: string; expiresAt: Date }): Promise<void> {
    const record: OAuthStateRecord = {
      nonce: params.nonce,
      ownerId: params.ownerId,
      expiresAt: params.expiresAt.toISOString(),
      consumedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.states.set(params.nonce, record);
  }

  async getState(nonce: string): Promise<OAuthStateRecord | null> {
    const record = this.states.get(nonce);
    return record ? { ...record } : null;
  }

  async consumeState(params: { nonce: string; ownerId: string }): Promise<ConsumeOAuthStateResult> {
    const record = this.states.get(params.nonce);
    if (!record) {
      return {
        ok: false,
        code: 'not_found',
        error: 'OAuth state was not found or was never issued.',
      };
    }

    if (record.ownerId !== params.ownerId) {
      return {
        ok: false,
        code: 'user_mismatch',
        error: 'OAuth state user does not match the active session.',
      };
    }

    if (record.consumedAt) {
      return {
        ok: false,
        code: 'replayed',
        error: 'OAuth state has already been consumed (replay detected).',
      };
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      return {
        ok: false,
        code: 'expired',
        error: 'OAuth state has expired. Please initiate connection again.',
      };
    }

    record.consumedAt = new Date().toISOString();
    return {
      ok: true,
      record: { ...record },
    };
  }

  async cleanupExpiredStates(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [nonce, record] of this.states.entries()) {
      if (new Date(record.expiresAt).getTime() <= now) {
        this.states.delete(nonce);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.states.clear();
  }
}

/**
 * Supabase-backed durable OAuth state repository.
 * Persists OAuth states to public.vercel_oauth_states and enforces single-use replay
 * protection via atomic PostgreSQL row updates using the service-role key.
 */
export class SupabaseOAuthStateRepository implements VercelOAuthStateRepository {
  private client: SupabaseClient;
  private inMemoryFallback = new InMemoryOAuthStateRepository();

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createState(params: { nonce: string; ownerId: string; expiresAt: Date }): Promise<void> {
    if (!isValidUuid(params.ownerId)) {
      return this.inMemoryFallback.createState(params);
    }

    try {
      const { error } = await this.client
        .from('vercel_oauth_states')
        .insert({
          nonce: params.nonce,
          owner_id: params.ownerId,
          expires_at: params.expiresAt.toISOString(),
          consumed_at: null,
          created_at: new Date().toISOString(),
        });

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.createState(params);
        }
        throw new Error(`Failed to persist OAuth state: ${error.message}`);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        return this.inMemoryFallback.createState(params);
      }
      throw err;
    }
  }

  async getState(nonce: string): Promise<OAuthStateRecord | null> {
    try {
      const { data, error } = await this.client
        .from('vercel_oauth_states')
        .select('nonce, owner_id, expires_at, consumed_at, created_at')
        .eq('nonce', nonce)
        .maybeSingle();

      if (error || !data) {
        return this.inMemoryFallback.getState(nonce);
      }

      return {
        nonce: data.nonce,
        ownerId: data.owner_id,
        expiresAt: data.expires_at,
        consumedAt: data.consumed_at,
        createdAt: data.created_at,
      };
    } catch {
      return this.inMemoryFallback.getState(nonce);
    }
  }

  async consumeState(params: { nonce: string; ownerId: string }): Promise<ConsumeOAuthStateResult> {
    if (!isValidUuid(params.ownerId)) {
      return this.inMemoryFallback.consumeState(params);
    }

    try {
      const nowIso = new Date().toISOString();

      // Atomic single-use update: only succeeds if unconsumed, unexpired, and owner matches
      const { data, error } = await this.client
        .from('vercel_oauth_states')
        .update({ consumed_at: nowIso })
        .eq('nonce', params.nonce)
        .eq('owner_id', params.ownerId)
        .is('consumed_at', null)
        .gt('expires_at', nowIso)
        .select('nonce, owner_id, expires_at, consumed_at, created_at')
        .maybeSingle();

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.consumeState(params);
        }
        return {
          ok: false,
          code: 'not_found',
          error: `Database error consuming OAuth state: ${error.message}`,
        };
      }

      if (data) {
        return {
          ok: true,
          record: {
            nonce: data.nonce,
            ownerId: data.owner_id,
            expiresAt: data.expires_at,
            consumedAt: data.consumed_at,
            createdAt: data.created_at,
          },
        };
      }

      // If update matched 0 rows, query the record to diagnose the exact failure reason
      const { data: existing, error: queryErr } = await this.client
        .from('vercel_oauth_states')
        .select('nonce, owner_id, expires_at, consumed_at, created_at')
        .eq('nonce', params.nonce)
        .maybeSingle();

      if (queryErr || !existing) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.consumeState(params);
        }
        return {
          ok: false,
          code: 'not_found',
          error: 'OAuth state was not found or was never issued.',
        };
      }

      if (existing.owner_id !== params.ownerId) {
        return {
          ok: false,
          code: 'user_mismatch',
          error: 'OAuth state user does not match the active session.',
        };
      }

      if (existing.consumed_at) {
        return {
          ok: false,
          code: 'replayed',
          error: 'OAuth state has already been consumed (replay detected).',
        };
      }

      if (new Date(existing.expires_at).getTime() <= Date.now()) {
        return {
          ok: false,
          code: 'expired',
          error: 'OAuth state has expired. Please initiate connection again.',
        };
      }

      return {
        ok: false,
        code: 'replayed',
        error: 'OAuth state could not be consumed.',
      };
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        return this.inMemoryFallback.consumeState(params);
      }
      return {
        ok: false,
        code: 'not_found',
        error: err instanceof Error ? err.message : 'Failed to consume OAuth state',
      };
    }
  }

  async cleanupExpiredStates(): Promise<number> {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await this.client
        .from('vercel_oauth_states')
        .delete()
        .lt('expires_at', nowIso)
        .select('nonce');

      if (error || !data) return 0;
      return data.length;
    } catch {
      return 0;
    }
  }

  clear(): void {
    this.inMemoryFallback.clear();
  }
}

let globalOAuthStateRepo: VercelOAuthStateRepository | null = null;

export function getOAuthStateRepository(): VercelOAuthStateRepository {
  if (globalOAuthStateRepo) {
    return globalOAuthStateRepo;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    globalOAuthStateRepo = new SupabaseOAuthStateRepository(supabaseUrl, serviceRoleKey);
  } else {
    globalOAuthStateRepo = new InMemoryOAuthStateRepository();
  }

  return globalOAuthStateRepo;
}

export function setOAuthStateRepository(repo: VercelOAuthStateRepository | null): void {
  globalOAuthStateRepo = repo;
}
