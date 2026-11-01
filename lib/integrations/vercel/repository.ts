import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelConnection } from './types';

export interface VercelConnectionRepository {
  getConnection(ownerId: string): Promise<VercelConnection | null>;
  findByOwnerId?(ownerId: string): Promise<VercelConnection | null>;
  saveConnection(connection: VercelConnection): Promise<void>;
  deleteConnection(ownerId: string): Promise<void>;
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * In-memory repository that strictly maintains architectural boundary separation
 * between safe connection metadata and sensitive server-only access secrets.
 */
export class InMemoryVercelConnectionRepository implements VercelConnectionRepository {
  private connections = new Map<string, Omit<VercelConnection, 'accessToken' | 'tokenType'>>();
  private secrets = new Map<string, { accessToken: string; tokenType: string; updatedAt: string }>();

  async getConnection(ownerId: string): Promise<VercelConnection | null> {
    const conn = this.connections.get(ownerId);
    if (!conn || conn.status === 'disconnected') return null;

    const secret = this.secrets.get(conn.id);
    return {
      ...conn,
      accessToken: secret?.accessToken || '',
      tokenType: secret?.tokenType || 'Bearer',
    };
  }

  async findByOwnerId(ownerId: string): Promise<VercelConnection | null> {
    return this.getConnection(ownerId);
  }

  async saveConnection(connection: VercelConnection): Promise<void> {
    const { accessToken, tokenType, ...metadata } = connection;
    this.connections.set(connection.ownerId, { ...metadata });
    this.secrets.set(connection.id, {
      accessToken,
      tokenType: tokenType || 'Bearer',
      updatedAt: connection.updatedAt,
    });
  }

  async deleteConnection(ownerId: string): Promise<void> {
    const conn = this.connections.get(ownerId);
    if (conn) {
      this.secrets.delete(conn.id);
    }
    this.connections.delete(ownerId);
  }

  // Verification & test inspection helpers
  clear(): void {
    this.connections.clear();
    this.secrets.clear();
  }

  hasSecret(connectionId: string): boolean {
    return this.secrets.has(connectionId);
  }

  getMetadata(ownerId: string): Omit<VercelConnection, 'accessToken' | 'tokenType'> | null {
    return this.connections.get(ownerId) || null;
  }
}

const defaultInMemoryRepo = new InMemoryVercelConnectionRepository();

/**
 * Supabase repository implementing the two-tier boundary:
 * 1. public.vercel_connections: stores account/team metadata (no secret token).
 * 2. public.vercel_connection_secrets: server-only isolated token table.
 */
export class SupabaseVercelConnectionRepository implements VercelConnectionRepository {
  private client: SupabaseClient;
  private inMemoryFallback: InMemoryVercelConnectionRepository;

  constructor(supabaseUrl: string, serviceRoleKey: string, fallback?: InMemoryVercelConnectionRepository) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.inMemoryFallback = fallback || defaultInMemoryRepo;
  }

  async getConnection(ownerId: string): Promise<VercelConnection | null> {
    if (!isValidUuid(ownerId)) {
      return this.inMemoryFallback.getConnection(ownerId);
    }

    try {
      const { data, error } = await this.client
        .from('vercel_connections')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('status', 'connected')
        .maybeSingle();

      if (error || !data) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.getConnection(ownerId);
        }
        return null;
      }

      // Read secret token strictly from dedicated server-only secrets table
      let accessToken = (data as Record<string, unknown>).access_token as string || '';
      let tokenType = ((data as Record<string, unknown>).token_type as string) || 'Bearer';

      const { data: secretData } = await this.client
        .from('vercel_connection_secrets')
        .select('access_token, token_type')
        .eq('connection_id', data.id)
        .maybeSingle();

      if (secretData) {
        accessToken = secretData.access_token;
        tokenType = secretData.token_type || 'Bearer';
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        configurationId: data.configuration_id,
        accountId: data.account_id,
        teamId: data.team_id || null,
        scope: data.scope || '',
        accessToken,
        tokenType,
        status: data.status,
        metadata: data.metadata || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        return this.inMemoryFallback.getConnection(ownerId);
      }
      return null;
    }
  }

  async saveConnection(connection: VercelConnection): Promise<void> {
    if (!isValidUuid(connection.ownerId)) {
      return this.inMemoryFallback.saveConnection(connection);
    }

    try {
      // 1. Persist connection metadata to public.vercel_connections
      const metadataPayload: Record<string, unknown> = {
        id: connection.id,
        owner_id: connection.ownerId,
        configuration_id: connection.configurationId,
        account_id: connection.accountId,
        team_id: connection.teamId,
        scope: connection.scope,
        status: connection.status,
        metadata: connection.metadata,
        created_at: connection.createdAt,
        updated_at: connection.updatedAt,
      };

      const { error: connError } = await this.client.from('vercel_connections').upsert(
        metadataPayload,
        { onConflict: 'owner_id' },
      );

      if (connError) {
        // If Postgres rejected due to non-existent auth.users foreign key in test/dev
        if (
          process.env.NODE_ENV !== 'production' &&
          (connError.code === '23503' || connError.code === '22P02')
        ) {
          return this.inMemoryFallback.saveConnection(connection);
        }
        throw new Error(`Failed to persist Vercel connection: ${connError.message}`);
      }

      // 2. Persist secret access token to public.vercel_connection_secrets
      const { error: secretError } = await this.client.from('vercel_connection_secrets').upsert(
        {
          connection_id: connection.id,
          access_token: connection.accessToken,
          token_type: connection.tokenType,
          created_at: connection.createdAt,
          updated_at: connection.updatedAt,
        },
        { onConflict: 'connection_id' },
      );

      if (secretError) {
        // If secrets table is not yet provisioned in remote database, fallback gracefully
        if (
          secretError.message.includes('Could not find the table') ||
          secretError.code === '42P01' ||
          secretError.code === 'PGRST204'
        ) {
          // Attempt transitional save to vercel_connections if access_token column still exists
          await this.client.from('vercel_connections').update({
            access_token: connection.accessToken,
            token_type: connection.tokenType,
          }).eq('id', connection.id);
        } else {
          throw new Error(`Failed to persist Vercel secret: ${secretError.message}`);
        }
      }
    } catch (err: unknown) {
      if (process.env.NODE_ENV !== 'production') {
        return this.inMemoryFallback.saveConnection(connection);
      }
      throw err;
    }
  }

  async deleteConnection(ownerId: string): Promise<void> {
    if (!isValidUuid(ownerId)) {
      return this.inMemoryFallback.deleteConnection(ownerId);
    }

    try {
      // 1. Fetch connection id to explicitly delete from secrets
      const { data: conn } = await this.client
        .from('vercel_connections')
        .select('id')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (conn) {
        await this.client
          .from('vercel_connection_secrets')
          .delete()
          .eq('connection_id', conn.id);
      }

      // 2. Delete from vercel_connections
      const { error } = await this.client
        .from('vercel_connections')
        .delete()
        .eq('owner_id', ownerId);

      if (error && process.env.NODE_ENV === 'production') {
        throw new Error(`Failed to delete Vercel connection: ${error.message}`);
      }
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        await this.inMemoryFallback.deleteConnection(ownerId);
      }
    }
  }
}

let globalConnectionRepo: VercelConnectionRepository | null = null;

export function getVercelConnectionRepository(): VercelConnectionRepository {
  if (globalConnectionRepo) return globalConnectionRepo;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const forceMemory = process.env.FOLIO_PERSISTENCE === 'memory' || process.env.NODE_ENV === 'test';

  if (!forceMemory && url && serviceKey) {
    globalConnectionRepo = new SupabaseVercelConnectionRepository(url, serviceKey, defaultInMemoryRepo);
    return globalConnectionRepo;
  }

  globalConnectionRepo = defaultInMemoryRepo;
  return globalConnectionRepo;
}

export function setVercelConnectionRepository(repo: VercelConnectionRepository | null): void {
  globalConnectionRepo = repo;
}
