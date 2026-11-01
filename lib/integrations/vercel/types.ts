export interface VercelConnectionMetadata {
  accountName?: string;
  teamName?: string;
  email?: string;
  scope?: string;
  connectedVia?: 'oauth' | 'token';
  [key: string]: unknown;
}

export interface VercelConnection {
  id: string;
  ownerId: string;
  configurationId: string;
  accountId: string;
  teamId: string | null;
  scope: string;
  accessToken: string; // Server-only, strictly never exposed to client
  tokenType: string;
  status: 'connected' | 'disconnected';
  metadata: VercelConnectionMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public client-safe representation returned by status endpoints.
 * Never includes tokens, secrets, or internal keys.
 */
export interface VercelConnectionStatus {
  connected: boolean;
  accountName?: string;
  teamName?: string;
  teamId?: string | null;
  scope?: string;
  configurationId?: string;
  connectedAt?: string;
}

export interface VercelOAuthTokenResponse {
  token_type: string;
  access_token: string;
  installation_id?: string;
  user_id: string;
  team_id?: string | null;
  scope?: string;
}

export interface VercelOAuthStatePayload {
  userId: string;
  nonce: string;
  timestamp: number;
  nextUrl?: string;
}
