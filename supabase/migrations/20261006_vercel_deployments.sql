-- Checkpoint 8J: Vercel Projects and Deployments Persistence Schema
-- Manages Vercel project linkage and deployment history per Folio owner.
-- Access is restricted to the server service-role; client roles denied.

-- 1. vercel_projects: Links a Folio owner to their dedicated Vercel project
create table if not exists public.vercel_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  vercel_project_id text not null,
  project_name text not null,
  team_id text,
  configuration_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vercel_projects_owner_id
  on public.vercel_projects (owner_id);

create index if not exists idx_vercel_projects_vercel_project_id
  on public.vercel_projects (vercel_project_id);

alter table public.vercel_projects enable row level security;
revoke all on public.vercel_projects from anon, authenticated;

-- 2. vercel_deployments: Tracks deployment history, status, and production URLs
create table if not exists public.vercel_deployments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  vercel_project_id text not null,
  vercel_deployment_id text not null unique,
  deployment_url text,
  production_url text,
  state text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vercel_deployments_owner_created
  on public.vercel_deployments (owner_id, created_at desc);

create index if not exists idx_vercel_deployments_project_id
  on public.vercel_deployments (vercel_project_id);

alter table public.vercel_deployments enable row level security;
revoke all on public.vercel_deployments from anon, authenticated;
