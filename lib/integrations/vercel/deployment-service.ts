import crypto from 'node:crypto';
import type { ProfileDocument } from '@/lib/profile-schema';
import { ProfileDocumentSchema } from '@/lib/profile-schema';
import type { AdvancedPortfolioConfig, PortfolioConfig } from '@/lib/portfolio-mode';
import { AdvancedPortfolioConfigSchema } from '@/lib/portfolio-mode';
import { generateAdvancedProject } from '@/lib/advanced-generator';
import {
  getVercelConnectionRepository,
  type VercelConnectionRepository,
} from './repository';
import {
  getDeploymentRepository,
  type VercelDeploymentRepository,
} from './deployment-repository';
import {
  getVercelApiClient,
  type VercelApiClient,
  type VercelFileRef,
} from './api';
import {
  getPublishingRepository,
  type IPublishingRepository,
} from '@/lib/publishing/repository';
import { generateDeterministicProjectName } from './project-name';
import type {
  ClientDeploymentStatus,
  DeploymentState,
  VercelDeploymentRecord,
  VercelProjectRecord,
} from './deployment-types';

export interface DeployAdvancedOptions {
  userId: string;
  profile?: ProfileDocument;
  config?: AdvancedPortfolioConfig | PortfolioConfig;
}

export interface DeployAdvancedResult {
  ok: boolean;
  status?: DeploymentState;
  deploymentId?: string;
  projectId?: string;
  projectName?: string;
  deploymentUrl?: string;
  productionUrl?: string;
  error?: string;
  code?: string;
}

function mapVercelReadyState(state: string): DeploymentState {
  switch (state.toUpperCase()) {
    case 'QUEUED':
      return 'queued';
    case 'INITIALIZING':
    case 'BUILDING':
      return 'building';
    case 'READY':
      return 'ready';
    case 'ERROR':
      return 'error';
    case 'CANCELED':
      return 'canceled';
    default:
      return 'building';
  }
}

export class VercelDeploymentService {
  private connectionRepo: VercelConnectionRepository;
  private deploymentRepo: VercelDeploymentRepository;
  private apiClient: VercelApiClient;
  private publishingRepo: IPublishingRepository;

  constructor(options?: {
    connectionRepo?: VercelConnectionRepository;
    deploymentRepo?: VercelDeploymentRepository;
    apiClient?: VercelApiClient;
    publishingRepo?: IPublishingRepository;
  }) {
    this.connectionRepo = options?.connectionRepo || getVercelConnectionRepository();
    this.deploymentRepo = options?.deploymentRepo || getDeploymentRepository();
    this.apiClient = options?.apiClient || getVercelApiClient();
    this.publishingRepo = options?.publishingRepo || getPublishingRepository();
  }

  /**
   * Deploys an Advanced portfolio to Vercel.
   * Enforces server session authentication, user-owned Vercel authorization,
   * in-flight guards, standalone project generation, file upload digests,
   * and production deployment creation.
   */
  async deploy(options: DeployAdvancedOptions): Promise<DeployAdvancedResult> {
    const { userId } = options;

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return {
        ok: false,
        error: 'User authentication is required to deploy.',
        code: 'unauthenticated',
      };
    }

    // 1. Verify user's Vercel connection
    const connection = await this.connectionRepo.getConnection(userId);
    if (!connection || !connection.accessToken || connection.status !== 'connected') {
      return {
        ok: false,
        error: 'Vercel account is not connected. Connect your Vercel account in Account settings to deploy.',
        code: 'missing_connection',
      };
    }

    const { accessToken, teamId, configurationId } = connection;

    // 2. Resolve Profile & Advanced Configuration
    let profile: ProfileDocument;
    let config: AdvancedPortfolioConfig;

    if (options.profile && options.config) {
      const profileCheck = ProfileDocumentSchema.safeParse(options.profile);
      if (!profileCheck.success) {
        return {
          ok: false,
          error: 'Invalid profile document provided.',
          code: 'invalid_profile',
        };
      }
      profile = profileCheck.data;

      // Handle either PortfolioConfig ({ mode: 'advanced', advanced: ... }) or direct AdvancedPortfolioConfig
      const rawCfg = options.config as { mode?: string; advanced?: unknown };
      let advancedCandidate: unknown = options.config;
      if (rawCfg && typeof rawCfg === 'object' && 'mode' in rawCfg) {
        if (rawCfg.mode !== 'advanced') {
          return {
            ok: false,
            error: 'Only Advanced mode portfolios can be deployed to Vercel.',
            code: 'unsupported_mode',
          };
        }
        advancedCandidate = rawCfg.advanced;
      }

      const configCheck = AdvancedPortfolioConfigSchema.safeParse(advancedCandidate);
      if (!configCheck.success) {
        return {
          ok: false,
          error: `Invalid advanced configuration: ${configCheck.error.issues[0]?.message || 'Schema mismatch'}`,
          code: 'invalid_config',
        };
      }
      config = configCheck.data;
    } else {
      // Fallback to persisted draft
      const draft = await this.publishingRepo.getDraft(userId);
      if (!draft) {
        return {
          ok: false,
          error: 'No portfolio draft found to deploy.',
          code: 'missing_draft',
        };
      }

      profile = draft.profile;
      if (!draft.portfolioConfig || draft.portfolioConfig.mode !== 'advanced' || !draft.portfolioConfig.advanced) {
        return {
          ok: false,
          error: 'Only Advanced mode portfolios can be deployed to Vercel. Simple mode portfolios use /p/[slug] publishing.',
          code: 'unsupported_mode',
        };
      }
      config = draft.portfolioConfig.advanced;
    }

    // 3. In-flight deployment concurrency guard
    const latestDeployment = await this.deploymentRepo.getLatestDeployment(userId);
    if (latestDeployment) {
      const inFlightStates: DeploymentState[] = ['queued', 'creating_project', 'uploading', 'deploying', 'building'];
      if (inFlightStates.includes(latestDeployment.state)) {
        // Check if it's still running on Vercel or timed out
        try {
          const check = await this.apiClient.getDeployment({
            token: accessToken,
            deploymentId: latestDeployment.vercelDeploymentId,
            teamId,
          });
          const mapped = mapVercelReadyState(check.readyState);
          if (inFlightStates.includes(mapped)) {
            return {
              ok: false,
              error: 'A deployment is already in progress. Please wait for it to complete.',
              code: 'deployment_in_progress',
            };
          }
          // State changed on Vercel, record it
          await this.deploymentRepo.updateDeployment(latestDeployment.vercelDeploymentId, {
            state: mapped,
            productionUrl: check.alias?.[0] ? `https://${check.alias[0]}` : `https://${check.url}`,
          });
        } catch {
          // If check fails, check how old it is (older than 10 mins = allow new)
          const ageMs = Date.now() - new Date(latestDeployment.updatedAt || latestDeployment.createdAt).getTime();
          if (ageMs < 10 * 60 * 1000) {
            return {
              ok: false,
              error: 'A deployment is already in progress. Please wait for it to complete.',
              code: 'deployment_in_progress',
            };
          }
        }
      }
    }

    // 4. Retrieve or Create Vercel Project
    let projectRecord: VercelProjectRecord | null = await this.deploymentRepo.getProject(userId);
    let vercelProjectId: string;
    let projectName: string;

    if (projectRecord) {
      // Validate project exists on Vercel
      try {
        const remote = await this.apiClient.findProject({
          token: accessToken,
          projectNameOrId: projectRecord.vercelProjectId,
          teamId,
        });

        if (remote) {
          vercelProjectId = remote.id;
          projectName = remote.name;
        } else {
          projectRecord = null; // Re-create if deleted on Vercel
        }
      } catch (err: unknown) {
        const error = err as { code?: string; status?: number; message?: string };
        if (error.status === 401 || error.code === 'unauthorized') {
          return {
            ok: false,
            error: 'Vercel authorization is invalid or expired. Reconnect Vercel in Account settings.',
            code: 'unauthorized',
          };
        }
        projectRecord = null;
      }
    }

    if (!projectRecord) {
      // Generate deterministic name
      projectName = generateDeterministicProjectName({
        creatorName: profile.basics.name,
        userId,
      });

      // Check if project exists by name on Vercel
      let vercelProject = await this.apiClient.findProject({
        token: accessToken,
        projectNameOrId: projectName,
        teamId,
      });

      if (!vercelProject) {
        try {
          vercelProject = await this.apiClient.createProject({
            token: accessToken,
            projectName,
            teamId,
          });
        } catch (err: unknown) {
          const error = err as { code?: string; message?: string };
          return {
            ok: false,
            error: `Failed to create Vercel project: ${error.message || 'Unknown error'}`,
            code: error.code || 'project_creation_failed',
          };
        }
      }

      vercelProjectId = vercelProject.id;
      projectName = vercelProject.name;

      projectRecord = await this.deploymentRepo.saveProject({
        ownerId: userId,
        vercelProjectId,
        projectName,
        teamId: teamId || null,
        configurationId: configurationId || null,
      });
    } else {
      vercelProjectId = projectRecord.vercelProjectId;
      projectName = projectRecord.projectName;
    }

    // 5. Generate Standalone Next.js Project (Checkpoint 8H Engine)
    const genResult = generateAdvancedProject({
      profile,
      config,
    });

    if (!genResult.ok) {
      return {
        ok: false,
        error: `Project generation failed: ${genResult.error}`,
        code: genResult.code,
      };
    }

    // 6. Upload Project Files (Vercel Files API with SHA1 digests)
    const fileRefs: VercelFileRef[] = [];

    for (const file of genResult.project.files) {
      const cleanPath = file.path.replace(/^\/+/, '');
      const sha = crypto.createHash('sha1').update(file.content, 'utf8').digest('hex');
      const size = Buffer.byteLength(file.content, 'utf8');

      try {
        await this.apiClient.uploadFile({
          token: accessToken,
          content: file.content,
          sha,
          teamId,
        });
      } catch (err: unknown) {
        const error = err as { message?: string; code?: string };
        return {
          ok: false,
          error: `Failed to upload project file '${cleanPath}': ${error.message || 'Upload error'}`,
          code: error.code || 'file_upload_failed',
        };
      }

      fileRefs.push({
        file: cleanPath,
        sha,
        size,
      });
    }

    // 7. Create Vercel Deployment (Vercel v13/deployments)
    let vercelDeployment;
    try {
      vercelDeployment = await this.apiClient.createDeployment({
        token: accessToken,
        projectId: vercelProjectId,
        projectName,
        files: fileRefs,
        teamId,
      });
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      return {
        ok: false,
        error: `Failed to create Vercel deployment: ${error.message || 'Deployment error'}`,
        code: error.code || 'deployment_creation_failed',
      };
    }

    const state = mapVercelReadyState(vercelDeployment.readyState);
    const deploymentUrl = vercelDeployment.url ? `https://${vercelDeployment.url}` : undefined;
    const productionUrl =
      vercelDeployment.alias && vercelDeployment.alias.length > 0
        ? `https://${vercelDeployment.alias[0]}`
        : deploymentUrl;

    // 8. Persist Deployment Record
    await this.deploymentRepo.saveDeployment({
      ownerId: userId,
      vercelProjectId,
      vercelDeploymentId: vercelDeployment.id,
      deploymentUrl: deploymentUrl || null,
      productionUrl: productionUrl || null,
      state,
      errorMessage: null,
    });

    // 9. Return safe client deployment status (Zero secrets)
    return {
      ok: true,
      status: state,
      deploymentId: vercelDeployment.id,
      projectId: vercelProjectId,
      projectName,
      deploymentUrl,
      productionUrl,
    };
  }

  /**
   * Retrieves client-safe deployment status for the active user.
   * If in-flight, polls Vercel API with the user's stored token to refresh status.
   */
  async getStatus(userId: string): Promise<ClientDeploymentStatus> {
    if (!userId) {
      return { status: 'idle' };
    }

    const latest = await this.deploymentRepo.getLatestDeployment(userId);
    const project = await this.deploymentRepo.getProject(userId);

    if (!latest) {
      return {
        status: 'idle',
        projectId: project?.vercelProjectId || null,
        projectName: project?.projectName || null,
      };
    }

    // If currently building or queued, poll Vercel to check if ready
    const inFlightStates: DeploymentState[] = ['queued', 'creating_project', 'uploading', 'deploying', 'building'];
    if (inFlightStates.includes(latest.state)) {
      const connection = await this.connectionRepo.getConnection(userId);
      if (connection?.accessToken) {
        try {
          const remote = await this.apiClient.getDeployment({
            token: connection.accessToken,
            deploymentId: latest.vercelDeploymentId,
            teamId: connection.teamId,
          });

          const mapped = mapVercelReadyState(remote.readyState);
          const deploymentUrl = remote.url ? `https://${remote.url}` : latest.deploymentUrl;
          const productionUrl =
            remote.alias && remote.alias.length > 0
              ? `https://${remote.alias[0]}`
              : deploymentUrl || latest.productionUrl;

          const updated = await this.deploymentRepo.updateDeployment(latest.vercelDeploymentId, {
            state: mapped,
            deploymentUrl: deploymentUrl || null,
            productionUrl: productionUrl || null,
            errorMessage: remote.errorMessage || null,
          });

          if (updated) {
            return {
              status: updated.state,
              deploymentId: updated.vercelDeploymentId,
              projectId: updated.vercelProjectId,
              projectName: project?.projectName || null,
              deploymentUrl: updated.deploymentUrl,
              productionUrl: updated.productionUrl,
              createdAt: updated.createdAt,
              updatedAt: updated.updatedAt,
              error: updated.errorMessage,
            };
          }
        } catch {
          // If remote check fails, return current cached state
        }
      }
    }

    return {
      status: latest.state,
      deploymentId: latest.vercelDeploymentId,
      projectId: latest.vercelProjectId,
      projectName: project?.projectName || null,
      deploymentUrl: latest.deploymentUrl,
      productionUrl: latest.productionUrl,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
      error: latest.errorMessage,
    };
  }
}

let globalDeploymentService: VercelDeploymentService | null = null;

export function getVercelDeploymentService(): VercelDeploymentService {
  if (!globalDeploymentService) {
    globalDeploymentService = new VercelDeploymentService();
  }
  return globalDeploymentService;
}

export function setVercelDeploymentService(service: VercelDeploymentService | null): void {
  globalDeploymentService = service;
}
