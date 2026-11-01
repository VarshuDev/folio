import crypto from 'node:crypto';

export interface VercelApiError {
  code: string;
  message: string;
  status?: number;
}

export interface VercelProjectApiResponse {
  id: string;
  name: string;
  framework?: string | null;
  accountId?: string;
}

export interface VercelFileRef {
  file: string;
  sha: string;
  size: number;
}

export interface VercelDeploymentApiResponse {
  id: string;
  url: string;
  name: string;
  readyState: 'QUEUED' | 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  alias?: string[];
  errorMessage?: string | null;
}

// In-memory mock store for unit testing & mock development mode
interface MockVercelState {
  projects: Map<string, VercelProjectApiResponse>;
  files: Set<string>;
  deployments: Map<string, VercelDeploymentApiResponse>;
}

const mockState: MockVercelState = {
  projects: new Map(),
  files: new Set(),
  deployments: new Map(),
};

export function resetMockVercelState(): void {
  mockState.projects.clear();
  mockState.files.clear();
  mockState.deployments.clear();
}

/**
 * Server-only Vercel REST API Client.
 * Communicates with official Vercel REST API endpoints:
 * - GET  /v9/projects/:idOrName
 * - POST /v10/projects
 * - POST /v2/files
 * - POST /v13/deployments
 * - GET  /v13/deployments/:id
 */
export class VercelApiClient {
  private baseUrl = 'https://api.vercel.com';

  private isMockToken(token: string): boolean {
    return (
      token.startsWith('mock_') ||
      token.startsWith('sec_mock_') ||
      token.startsWith('sec_') ||
      token.startsWith('mock-') ||
      process.env.NODE_ENV === 'test' ||
      process.env.VERCEL_MOCK_API === '1'
    );
  }

  private mapError(status: number, data: Record<string, unknown> | null, defaultMsg: string): Error {
    const errorObj = data?.error as Record<string, unknown> | undefined;
    const msg = (errorObj?.message as string) || (data?.message as string) || defaultMsg;
    const code = (errorObj?.code as string) || (data?.code as string) || `status_${status}`;

    if (status === 401 || status === 403) {
      const err = new Error('Vercel authorization is invalid or expired. Reconnect Vercel and try again.');
      (err as unknown as { code: string; status: number }).code = 'unauthorized';
      (err as unknown as { status: number }).status = status;
      return err;
    }

    if (status === 429) {
      const err = new Error('Vercel API rate limit exceeded. Please wait a moment and try again.');
      (err as unknown as { code: string; status: number }).code = 'rate_limited';
      (err as unknown as { status: number }).status = 429;
      return err;
    }

    const err = new Error(msg);
    (err as unknown as { code: string; status: number }).code = code;
    (err as unknown as { status: number }).status = status;
    return err;
  }

  /**
   * Look up an existing project by name or ID.
   */
  async findProject(params: {
    token: string;
    projectNameOrId: string;
    teamId?: string | null;
  }): Promise<VercelProjectApiResponse | null> {
    const { token, projectNameOrId, teamId } = params;

    if (this.isMockToken(token)) {
      const existing = mockState.projects.get(projectNameOrId);
      return existing || null;
    }

    const url = new URL(`${this.baseUrl}/v9/projects/${encodeURIComponent(projectNameOrId)}`);
    if (teamId) url.searchParams.set('teamId', teamId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      throw this.mapError(res.status, errData, 'Failed to retrieve Vercel project.');
    }

    const data = (await res.json()) as VercelProjectApiResponse;
    return data;
  }

  /**
   * Create a new project in the authorized Vercel scope (personal or team).
   */
  async createProject(params: {
    token: string;
    projectName: string;
    teamId?: string | null;
  }): Promise<VercelProjectApiResponse> {
    const { token, projectName, teamId } = params;

    if (this.isMockToken(token)) {
      const mockProject: VercelProjectApiResponse = {
        id: `prj_mock_${crypto.randomBytes(8).toString('hex')}`,
        name: projectName,
        framework: 'nextjs',
        accountId: teamId || 'user_personal_mock',
      };
      mockState.projects.set(projectName, mockProject);
      mockState.projects.set(mockProject.id, mockProject);
      return mockProject;
    }

    const url = new URL(`${this.baseUrl}/v10/projects`);
    if (teamId) url.searchParams.set('teamId', teamId);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        framework: 'nextjs',
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      throw this.mapError(res.status, errData, `Failed to create Vercel project ${projectName}.`);
    }

    const data = (await res.json()) as VercelProjectApiResponse;
    return data;
  }

  /**
   * Upload an individual project file to Vercel's File API using SHA1 digest.
   * Endpoint: POST /v2/files
   */
  async uploadFile(params: {
    token: string;
    content: Buffer | Uint8Array | string;
    sha: string;
    teamId?: string | null;
  }): Promise<void> {
    const { token, content, sha, teamId } = params;

    if (this.isMockToken(token)) {
      mockState.files.add(sha);
      return;
    }

    const buffer = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content as string, typeof content === 'string' ? 'utf8' : undefined);

    const url = new URL(`${this.baseUrl}/v2/files`);
    if (teamId) url.searchParams.set('teamId', teamId);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': sha,
        'Content-Length': buffer.length.toString(),
      },
      body: buffer as unknown as BodyInit,
    });

    // 200 OK or 409 Conflict (already uploaded and deduplicated) both mean success
    if (res.status === 200 || res.status === 409) {
      return;
    }

    const errData = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    throw this.mapError(res.status, errData, 'Failed to upload project file to Vercel.');
  }

  /**
   * Create a production deployment referencing uploaded files.
   * Endpoint: POST /v13/deployments
   */
  async createDeployment(params: {
    token: string;
    projectId: string;
    projectName: string;
    files: VercelFileRef[];
    teamId?: string | null;
  }): Promise<VercelDeploymentApiResponse> {
    const { token, projectId, projectName, files, teamId } = params;

    if (this.isMockToken(token)) {
      const depId = `dpl_mock_${crypto.randomBytes(8).toString('hex')}`;
      const mockDep: VercelDeploymentApiResponse = {
        id: depId,
        url: `${projectName}-${depId.slice(9, 15)}.vercel.app`,
        name: projectName,
        readyState: 'BUILDING',
        alias: [`${projectName}.vercel.app`],
      };
      mockState.deployments.set(depId, mockDep);
      return mockDep;
    }

    const url = new URL(`${this.baseUrl}/v13/deployments`);
    if (teamId) url.searchParams.set('teamId', teamId);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        project: projectId,
        target: 'production',
        files: files.map((f) => ({
          file: f.file,
          sha: f.sha,
          size: f.size,
        })),
        projectSettings: {
          framework: 'nextjs',
        },
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      throw this.mapError(res.status, errData, 'Failed to create Vercel deployment.');
    }

    const data = (await res.json()) as VercelDeploymentApiResponse;
    return data;
  }

  /**
   * Retrieve deployment status by deployment ID.
   * Endpoint: GET /v13/deployments/:id
   */
  async getDeployment(params: {
    token: string;
    deploymentId: string;
    teamId?: string | null;
  }): Promise<VercelDeploymentApiResponse> {
    const { token, deploymentId, teamId } = params;

    if (this.isMockToken(token)) {
      const existing = mockState.deployments.get(deploymentId);
      if (existing) {
        // Auto-advance mock state from BUILDING to READY on subsequent poll
        existing.readyState = 'READY';
        return { ...existing };
      }
      return {
        id: deploymentId,
        url: `mock-app-${deploymentId.slice(0, 8)}.vercel.app`,
        name: 'mock-portfolio',
        readyState: 'READY',
        alias: [`mock-portfolio.vercel.app`],
      };
    }

    const url = new URL(`${this.baseUrl}/v13/deployments/${encodeURIComponent(deploymentId)}`);
    if (teamId) url.searchParams.set('teamId', teamId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      throw this.mapError(res.status, errData, 'Failed to check deployment status.');
    }

    const data = (await res.json()) as VercelDeploymentApiResponse;
    return data;
  }
}

let globalVercelApiClient: VercelApiClient | null = null;

export function getVercelApiClient(): VercelApiClient {
  if (!globalVercelApiClient) {
    globalVercelApiClient = new VercelApiClient();
  }
  return globalVercelApiClient;
}

export function setVercelApiClient(client: VercelApiClient | null): void {
  globalVercelApiClient = client;
}
