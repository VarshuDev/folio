export type DeploymentState =
  | 'idle'
  | 'queued'
  | 'creating_project'
  | 'uploading'
  | 'deploying'
  | 'building'
  | 'ready'
  | 'error'
  | 'canceled';

export interface VercelProjectRecord {
  id: string;
  ownerId: string;
  vercelProjectId: string;
  projectName: string;
  teamId?: string | null;
  configurationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VercelDeploymentRecord {
  id: string;
  ownerId: string;
  vercelProjectId: string;
  vercelDeploymentId: string;
  deploymentUrl?: string | null;
  productionUrl?: string | null;
  state: DeploymentState;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDeploymentStatus {
  status: DeploymentState;
  deploymentId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  deploymentUrl?: string | null;
  productionUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  error?: string | null;
}
