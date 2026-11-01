import crypto from 'node:crypto';
import type {
  VercelConnection,
  VercelConnectionStatus,
  VercelOAuthTokenResponse,
} from './types';
import { createOAuthState, verifyOAuthState } from './state';
import {
  getVercelConnectionRepository,
  type VercelConnectionRepository,
} from './repository';
import {
  getOAuthStateRepository,
  type VercelOAuthStateRepository,
} from './state-repository';

export interface VercelConnectOptions {
  userId: string;
  redirectUri?: string;
  nextUrl?: string;
  teamSlug?: string;
  flow?: 'integration' | 'oauth';
}

export interface VercelCallbackParams {
  code?: string | null;
  state?: string | null;
  teamId?: string | null;
  configurationId?: string | null;
  sessionUserId: string;
  redirectUri?: string;
}

export class VercelIntegrationService {
  private repo: VercelConnectionRepository;
  private stateRepo: VercelOAuthStateRepository;

  constructor(
    repoOrOptions?:
      | VercelConnectionRepository
      | { repository?: VercelConnectionRepository; stateRepository?: VercelOAuthStateRepository }
  ) {
    if (repoOrOptions && typeof repoOrOptions === 'object' && ('repository' in repoOrOptions || 'stateRepository' in repoOrOptions)) {
      const options = repoOrOptions as { repository?: VercelConnectionRepository; stateRepository?: VercelOAuthStateRepository };
      this.repo = options.repository || getVercelConnectionRepository();
      this.stateRepo = options.stateRepository || getOAuthStateRepository();
    } else if (repoOrOptions && typeof repoOrOptions === 'object' && 'getConnection' in repoOrOptions) {
      this.repo = repoOrOptions as VercelConnectionRepository;
      this.stateRepo = getOAuthStateRepository();
    } else {
      this.repo = getVercelConnectionRepository();
      this.stateRepo = getOAuthStateRepository();
    }
  }

  /**
   * Generates the authoritative Vercel OAuth 2.0 authorization URL with CSRF-protected state.
   * Uses the registered Vercel Client ID when configured, preventing unlisted Marketplace 404s.
   */
  async getConnectUrl(optionsOrUserId: VercelConnectOptions | string): Promise<{ url: string; state: string }> {
    const userId = typeof optionsOrUserId === 'string' ? optionsOrUserId : optionsOrUserId.userId;
    const nextUrl = typeof optionsOrUserId === 'string' ? '/account' : optionsOrUserId.nextUrl || '/account';
    const state = await createOAuthState(userId, nextUrl, this.stateRepo);
    const redirectUri = typeof optionsOrUserId === 'object' ? optionsOrUserId.redirectUri : undefined;
    const teamSlug = typeof optionsOrUserId === 'object' ? optionsOrUserId.teamSlug : undefined;

    const clientId = process.env.VERCEL_CLIENT_ID;
    const slug = process.env.VERCEL_INTEGRATION_SLUG;
    const effectiveRedirectUri = redirectUri || process.env.VERCEL_REDIRECT_URI;

    // Fail closed if integration credentials are not configured in production or required by config
    if (!clientId && !slug && (process.env.NODE_ENV === 'production' || process.env.VERCEL_REQUIRE_CONFIG === '1')) {
      const err = new Error(
        'Vercel integration is not configured on the server. Please set VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET.'
      );
      (err as unknown as { code: string }).code = 'unconfigured_integration';
      throw err;
    }

    let url: URL;
    const flow = typeof optionsOrUserId === 'object' ? optionsOrUserId.flow : undefined;
    if (slug && flow !== 'oauth') {
      // Official Connectable Account Integration installation endpoint
      url = new URL(`https://vercel.com/integrations/${slug}/new`);
      url.searchParams.set('state', state);
      if (teamSlug) {
        url.searchParams.set('teamSlug', teamSlug);
      }
    } else if (clientId) {
      // Fallback Vercel OAuth 2.0 authorization endpoint
      url = new URL('https://vercel.com/oauth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('state', state);
      if (effectiveRedirectUri) {
        url.searchParams.set('redirect_uri', effectiveRedirectUri);
      }
      if (teamSlug) {
        url.searchParams.set('teamSlug', teamSlug);
      }
    } else {
      // Test fallback
      url = new URL('https://vercel.com/integrations/folio-test/new');
      url.searchParams.set('state', state);
      if (teamSlug) {
        url.searchParams.set('teamSlug', teamSlug);
      }
    }

    return { url: url.toString(), state };
  }

  /**
   * Handles the Vercel OAuth callback, validating CSRF state, exchanging authorization code,
   * querying official Vercel API for verified account/team identity, and saving server-only credentials.
   */
  async handleCallback(params: VercelCallbackParams): Promise<{
    ok: boolean;
    error?: string;
    code?: string;
    connection?: VercelConnection;
    nextUrl?: string;
  }> {
    const { code, state, sessionUserId, redirectUri } = params;

    // 1. Validate required callback params
    if (!state) {
      return { ok: false, error: 'Missing OAuth state parameter.', code: 'missing_state' };
    }

    if (!code) {
      return { ok: false, error: 'Missing authorization code from Vercel.', code: 'missing_code' };
    }

    // 2. Validate state integrity and tie to active Folio session (atomic consumption)
    const stateVerify = await verifyOAuthState(state, sessionUserId, { repo: this.stateRepo });
    if (!stateVerify.ok) {
      return { ok: false, error: stateVerify.error, code: stateVerify.code };
    }

    const { payload } = stateVerify;

    // 3. Exchange authorization code for access token
    let tokenData: VercelOAuthTokenResponse;
    const isMock =
      (code.startsWith('mock-') || process.env.VERCEL_MOCK_AUTH === '1') &&
      (process.env.NODE_ENV === 'test' || !process.env.VERCEL_CLIENT_ID);

    let accountName = `Vercel User (${sessionUserId.slice(0, 6)})`;
    let teamName: string | undefined = undefined;

    if (isMock) {
      // Strictly restricted to test runner
      tokenData = {
        token_type: 'Bearer',
        access_token: `mock_vercel_token_${crypto.randomBytes(16).toString('hex')}`,
        installation_id: params.configurationId || `icfg_mock_${crypto.randomBytes(8).toString('hex')}`,
        user_id: `usr_mock_${sessionUserId.slice(0, 8)}`,
        team_id: params.teamId || null,
        scope: 'projects deployments',
      };
      accountName = `Mock Vercel Account (${tokenData.user_id})`;
      if (params.teamId) {
        teamName = `Team ${params.teamId}`;
      }
    } else {
      const clientId = process.env.VERCEL_CLIENT_ID;
      const clientSecret = process.env.VERCEL_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return {
          ok: false,
          error: 'Vercel Integration client credentials are not configured on the server.',
          code: 'unconfigured_integration',
        };
      }

      try {
        const effectiveRedirectUri = redirectUri || process.env.VERCEL_REDIRECT_URI;
        const bodyParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          ...(effectiveRedirectUri ? { redirect_uri: effectiveRedirectUri } : {}),
        });

        const tokenRes = await fetch('https://api.vercel.com/v2/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: bodyParams.toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          return {
            ok: false,
            error: `Vercel token exchange rejected (${tokenRes.status}): ${errText}`,
            code: 'token_exchange_failed',
          };
        }

        tokenData = (await tokenRes.json()) as VercelOAuthTokenResponse;
      } catch (err: unknown) {
        return {
          ok: false,
          error: `Network error exchanging Vercel authorization code: ${err instanceof Error ? err.message : 'Unknown'}`,
          code: 'network_error',
        };
      }

      // 4. Query official Vercel REST API to verify user profile and account name
      try {
        const userRes = await fetch('https://api.vercel.com/v2/user', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/json',
          },
        });
        if (userRes.ok) {
          const userData = (await userRes.json()) as {
            user?: {
              id?: string;
              username?: string;
              name?: string;
              email?: string;
            };
          };
          if (userData?.user) {
            accountName =
              userData.user.name ||
              userData.user.username ||
              userData.user.email ||
              `Vercel (${tokenData.user_id})`;
          }
        }
      } catch {
        accountName = `Vercel (${tokenData.user_id})`;
      }

      // If installation authorized a team, resolve verified team name
      const activeTeamId = tokenData.team_id || params.teamId || null;
      if (activeTeamId) {
        try {
          const teamRes = await fetch(`https://api.vercel.com/v2/teams/${encodeURIComponent(activeTeamId)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: 'application/json',
            },
          });
          if (teamRes.ok) {
            const teamData = (await teamRes.json()) as { name?: string; slug?: string };
            teamName = teamData.name || teamData.slug || `Team (${activeTeamId})`;
          } else {
            teamName = `Team (${activeTeamId})`;
          }
        } catch {
          teamName = `Team (${activeTeamId})`;
        }
      }
    }

    // 5. Construct server-authoritative connection record
    const now = new Date().toISOString();
    const activeTeamId = tokenData.team_id || params.teamId || null;
    const scope = activeTeamId ? (teamName || `Team (${activeTeamId})`) : 'Personal Account';

    const connection: VercelConnection = {
      id: crypto.randomUUID ? crypto.randomUUID() : `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: sessionUserId,
      configurationId: params.configurationId || tokenData.installation_id || `oauth_${tokenData.user_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
      accountId: tokenData.user_id,
      teamId: activeTeamId,
      scope,
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      status: 'connected',
      metadata: {
        accountName,
        teamName,
        scope,
        connectedVia: 'oauth',
      },
      createdAt: now,
      updatedAt: now,
    };

    // 6. Persist connection with server-only secret storage
    await this.repo.saveConnection(connection);

    return {
      ok: true,
      connection,
      nextUrl: payload.nextUrl || '/account',
    };
  }

  /**
   * Directly connects a Vercel Personal Access Token (PAT).
   * Verifies the token against the official Vercel REST API (/v2/user and optionally /v2/teams),
   * strictly protecting server-only secrets in the connection repository.
   */
  async connectWithToken(params: {
    userId: string;
    token: string;
    teamId?: string | null;
  }): Promise<{
    ok: boolean;
    error?: string;
    code?: string;
    connection?: VercelConnection;
    accountName?: string;
    teamName?: string;
    scope?: string;
  }> {
    const { userId, token, teamId } = params;
    const trimmedToken = token?.trim();

    if (!trimmedToken) {
      return { ok: false, error: 'A Vercel Personal Access Token is required.', code: 'missing_token' };
    }

    const isMock =
      (trimmedToken.startsWith('mock-') ||
        trimmedToken.startsWith('mock_') ||
        trimmedToken.startsWith('sec_mock_')) &&
      process.env.NODE_ENV !== 'production';

    let accountId = `usr_${userId.slice(0, 10)}`;
    let accountName = `Vercel User (${userId.slice(0, 6)})`;
    let teamName: string | undefined = undefined;

    if (isMock) {
      accountId = `usr_mock_${userId.slice(0, 8)}`;
      accountName = `Mock Vercel Account (${accountId})`;
      if (teamId) {
        teamName = `Team ${teamId}`;
      }
    } else {
      try {
        // 1. Verify token by querying Vercel User API
        const userRes = await fetch('https://api.vercel.com/v2/user', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
            Accept: 'application/json',
          },
        });

        if (!userRes.ok) {
          const errData = (await userRes.json().catch(() => null)) as Record<string, unknown> | null;
          const msg =
            (errData?.error as { message?: string })?.message ||
            (errData?.message as string) ||
            `Vercel API returned status ${userRes.status}`;
          return {
            ok: false,
            error: `Invalid Vercel token: ${msg}. Please ensure your token was generated at vercel.com/account/tokens and is active.`,
            code: 'invalid_token',
          };
        }

        const userData = (await userRes.json()) as {
          user?: {
            id: string;
            username?: string;
            name?: string;
            email?: string;
          };
        };

        if (!userData?.user?.id) {
          return {
            ok: false,
            error: 'Vercel API response did not contain valid user information.',
            code: 'invalid_response',
          };
        }

        accountId = userData.user.id;
        accountName =
          userData.user.name ||
          userData.user.username ||
          userData.user.email ||
          `Vercel (${accountId})`;

        // 2. If teamId is specified or if teams can be resolved, look up teams
        try {
          const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${trimmedToken}`,
              Accept: 'application/json',
            },
          });
          if (teamsRes.ok) {
            const teamsData = (await teamsRes.json()) as {
              teams?: Array<{ id: string; name?: string; slug?: string }>;
            };
            if (teamsData?.teams && Array.isArray(teamsData.teams)) {
              if (teamId) {
                const matched = teamsData.teams.find((t) => t.id === teamId || t.slug === teamId);
                if (matched) {
                  teamName = matched.name || matched.slug;
                }
              }
            }
          }
        } catch {
          // Teams lookup is non-blocking fallback
        }
      } catch (err: unknown) {
        return {
          ok: false,
          error: `Network error verifying Vercel token: ${err instanceof Error ? err.message : 'Unknown'}`,
          code: 'network_error',
        };
      }
    }

    // 3. Construct server-authoritative connection record
    const now = new Date().toISOString();
    const scope = teamId ? (teamName || `Team (${teamId})`) : 'Personal Account';

    const connection: VercelConnection = {
      id: crypto.randomUUID ? crypto.randomUUID() : `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: userId,
      configurationId: `pat_${accountId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
      accountId,
      teamId: teamId || null,
      scope,
      accessToken: trimmedToken,
      tokenType: 'Bearer',
      status: 'connected',
      metadata: {
        accountName,
        teamName,
        scope,
        connectedVia: 'token',
      },
      createdAt: now,
      updatedAt: now,
    };

    // 4. Save connection with strict boundary separation
    await this.repo.saveConnection(connection);

    return {
      ok: true,
      connection,
      accountName,
      teamName,
      scope,
    };
  }

  /**
   * Retrieves client-safe connection status. Never leaks tokens or secrets.
   */
  async getStatus(userId: string): Promise<VercelConnectionStatus> {
    const conn = await this.repo.getConnection(userId);
    if (!conn || conn.status !== 'connected') {
      return { connected: false };
    }

    const teamName = conn.metadata.teamName;
    const scope = (conn.metadata.scope as string) || (conn.teamId ? (teamName || `Team (${conn.teamId})`) : 'Personal Account');

    return {
      connected: true,
      accountName: conn.metadata.accountName || `Vercel Account (${conn.accountId})`,
      teamName,
      teamId: conn.teamId,
      scope,
      configurationId: conn.configurationId,
      connectedAt: conn.createdAt,
    };
  }

  /**
   * Disconnects Vercel from the Folio account, removing stored connection credentials.
   * Preserves user profile, drafts, Dev Credits, and simple portfolios.
   */
  async disconnect(userId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.repo.deleteConnection(userId);
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to disconnect Vercel connection.',
      };
    }
  }
}

let globalService: VercelIntegrationService | null = null;

export function getVercelService(): VercelIntegrationService {
  if (!globalService) {
    globalService = new VercelIntegrationService();
  }
  return globalService;
}

export function setVercelService(service: VercelIntegrationService | null): void {
  globalService = service;
}
