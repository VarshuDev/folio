import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  VercelProjectRecord,
  VercelDeploymentRecord,
} from './deployment-types';

export interface VercelDeploymentRepository {
  getProject(ownerId: string): Promise<VercelProjectRecord | null>;
  saveProject(
    project: Omit<VercelProjectRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelProjectRecord>;
  getLatestDeployment(ownerId: string): Promise<VercelDeploymentRecord | null>;
  getDeploymentById(deploymentId: string): Promise<VercelDeploymentRecord | null>;
  saveDeployment(
    deployment: Omit<VercelDeploymentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelDeploymentRecord>;
  updateDeployment(
    deploymentId: string,
    updates: Partial<Pick<VercelDeploymentRecord, 'state' | 'deploymentUrl' | 'productionUrl' | 'errorMessage'>>
  ): Promise<VercelDeploymentRecord | null>;
  clear?(): void;
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class InMemoryDeploymentRepository implements VercelDeploymentRepository {
  private projects = new Map<string, VercelProjectRecord>(); // ownerId -> project
  private deployments = new Map<string, VercelDeploymentRecord>(); // deploymentId -> deployment

  async getProject(ownerId: string): Promise<VercelProjectRecord | null> {
    const proj = this.projects.get(ownerId);
    return proj ? { ...proj } : null;
  }

  async saveProject(
    project: Omit<VercelProjectRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelProjectRecord> {
    const existing = this.projects.get(project.ownerId);
    const now = new Date().toISOString();
    const record: VercelProjectRecord = {
      id: existing?.id || `proj_${Math.random().toString(36).slice(2, 10)}`,
      ownerId: project.ownerId,
      vercelProjectId: project.vercelProjectId,
      projectName: project.projectName,
      teamId: project.teamId || null,
      configurationId: project.configurationId || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.projects.set(project.ownerId, record);
    return { ...record };
  }

  async getLatestDeployment(ownerId: string): Promise<VercelDeploymentRecord | null> {
    const list = Array.from(this.deployments.values())
      .filter((d) => d.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list[0] ? { ...list[0] } : null;
  }

  async getDeploymentById(deploymentId: string): Promise<VercelDeploymentRecord | null> {
    const dep = this.deployments.get(deploymentId);
    return dep ? { ...dep } : null;
  }

  async saveDeployment(
    deployment: Omit<VercelDeploymentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelDeploymentRecord> {
    const now = new Date().toISOString();
    const record: VercelDeploymentRecord = {
      id: `dep_rec_${Math.random().toString(36).slice(2, 10)}`,
      ownerId: deployment.ownerId,
      vercelProjectId: deployment.vercelProjectId,
      vercelDeploymentId: deployment.vercelDeploymentId,
      deploymentUrl: deployment.deploymentUrl || null,
      productionUrl: deployment.productionUrl || null,
      state: deployment.state,
      errorMessage: deployment.errorMessage || null,
      createdAt: now,
      updatedAt: now,
    };
    this.deployments.set(deployment.vercelDeploymentId, record);
    return { ...record };
  }

  async updateDeployment(
    deploymentId: string,
    updates: Partial<Pick<VercelDeploymentRecord, 'state' | 'deploymentUrl' | 'productionUrl' | 'errorMessage'>>
  ): Promise<VercelDeploymentRecord | null> {
    const existing = this.deployments.get(deploymentId);
    if (!existing) return null;
    const updated: VercelDeploymentRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.deployments.set(deploymentId, updated);
    return { ...updated };
  }

  clear(): void {
    this.projects.clear();
    this.deployments.clear();
  }
}

const defaultInMemoryDeploymentRepo = new InMemoryDeploymentRepository();

export class SupabaseDeploymentRepository implements VercelDeploymentRepository {
  private client: SupabaseClient;
  private inMemoryFallback: InMemoryDeploymentRepository;

  constructor(supabaseUrl: string, serviceRoleKey: string, fallback?: InMemoryDeploymentRepository) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.inMemoryFallback = fallback || defaultInMemoryDeploymentRepo;
  }

  async getProject(ownerId: string): Promise<VercelProjectRecord | null> {
    if (!isValidUuid(ownerId)) {
      return this.inMemoryFallback.getProject(ownerId);
    }

    try {
      const { data, error } = await this.client
        .from('vercel_projects')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (error || !data) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.getProject(ownerId);
        }
        return null;
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        projectName: data.project_name,
        teamId: data.team_id,
        configurationId: data.configuration_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.getProject(ownerId);
    }
  }

  async saveProject(
    project: Omit<VercelProjectRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelProjectRecord> {
    if (!isValidUuid(project.ownerId)) {
      return this.inMemoryFallback.saveProject(project);
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('vercel_projects')
        .upsert(
          {
            owner_id: project.ownerId,
            vercel_project_id: project.vercelProjectId,
            project_name: project.projectName,
            team_id: project.teamId || null,
            configuration_id: project.configurationId || null,
            updated_at: now,
          },
          { onConflict: 'owner_id' }
        )
        .select()
        .single();

      if (error || !data) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.saveProject(project);
        }
        throw new Error(`Failed to save Vercel project record: ${error?.message}`);
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        projectName: data.project_name,
        teamId: data.team_id,
        configurationId: data.configuration_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.saveProject(project);
    }
  }

  async getLatestDeployment(ownerId: string): Promise<VercelDeploymentRecord | null> {
    if (!isValidUuid(ownerId)) {
      return this.inMemoryFallback.getLatestDeployment(ownerId);
    }

    try {
      const { data, error } = await this.client
        .from('vercel_deployments')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.getLatestDeployment(ownerId);
        }
        return null;
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        vercelDeploymentId: data.vercel_deployment_id,
        deploymentUrl: data.deployment_url,
        productionUrl: data.production_url,
        state: data.state,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.getLatestDeployment(ownerId);
    }
  }

  async getDeploymentById(deploymentId: string): Promise<VercelDeploymentRecord | null> {
    try {
      const { data, error } = await this.client
        .from('vercel_deployments')
        .select('*')
        .eq('vercel_deployment_id', deploymentId)
        .maybeSingle();

      if (error || !data) {
        return this.inMemoryFallback.getDeploymentById(deploymentId);
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        vercelDeploymentId: data.vercel_deployment_id,
        deploymentUrl: data.deployment_url,
        productionUrl: data.production_url,
        state: data.state,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.getDeploymentById(deploymentId);
    }
  }

  async saveDeployment(
    deployment: Omit<VercelDeploymentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VercelDeploymentRecord> {
    if (!isValidUuid(deployment.ownerId)) {
      return this.inMemoryFallback.saveDeployment(deployment);
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('vercel_deployments')
        .insert({
          owner_id: deployment.ownerId,
          vercel_project_id: deployment.vercelProjectId,
          vercel_deployment_id: deployment.vercelDeploymentId,
          deployment_url: deployment.deploymentUrl || null,
          production_url: deployment.productionUrl || null,
          state: deployment.state,
          error_message: deployment.errorMessage || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error || !data) {
        if (process.env.NODE_ENV !== 'production') {
          return this.inMemoryFallback.saveDeployment(deployment);
        }
        throw new Error(`Failed to save Vercel deployment record: ${error?.message}`);
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        vercelDeploymentId: data.vercel_deployment_id,
        deploymentUrl: data.deployment_url,
        productionUrl: data.production_url,
        state: data.state,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.saveDeployment(deployment);
    }
  }

  async updateDeployment(
    deploymentId: string,
    updates: Partial<Pick<VercelDeploymentRecord, 'state' | 'deploymentUrl' | 'productionUrl' | 'errorMessage'>>
  ): Promise<VercelDeploymentRecord | null> {
    try {
      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = { updated_at: now };
      if (updates.state) updatePayload.state = updates.state;
      if (updates.deploymentUrl !== undefined) updatePayload.deployment_url = updates.deploymentUrl;
      if (updates.productionUrl !== undefined) updatePayload.production_url = updates.productionUrl;
      if (updates.errorMessage !== undefined) updatePayload.error_message = updates.errorMessage;

      const { data, error } = await this.client
        .from('vercel_deployments')
        .update(updatePayload)
        .eq('vercel_deployment_id', deploymentId)
        .select()
        .maybeSingle();

      if (error || !data) {
        return this.inMemoryFallback.updateDeployment(deploymentId, updates);
      }

      return {
        id: data.id,
        ownerId: data.owner_id,
        vercelProjectId: data.vercel_project_id,
        vercelDeploymentId: data.vercel_deployment_id,
        deploymentUrl: data.deployment_url,
        productionUrl: data.production_url,
        state: data.state,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return this.inMemoryFallback.updateDeployment(deploymentId, updates);
    }
  }

  clear(): void {
    this.inMemoryFallback.clear();
  }
}

let globalDeploymentRepo: VercelDeploymentRepository | null = null;

export function getDeploymentRepository(): VercelDeploymentRepository {
  if (globalDeploymentRepo) return globalDeploymentRepo;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    globalDeploymentRepo = new SupabaseDeploymentRepository(supabaseUrl, serviceRoleKey, defaultInMemoryDeploymentRepo);
  } else {
    globalDeploymentRepo = defaultInMemoryDeploymentRepo;
  }

  return globalDeploymentRepo;
}

export function setDeploymentRepository(repo: VercelDeploymentRepository | null): void {
  globalDeploymentRepo = repo;
}
