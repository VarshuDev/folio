-- Vercel Connections Schema for Folio (Checkpoint 8I)
-- Stores server-authoritative Vercel integration and account installation metadata.
-- Tokens and credentials remain strictly server-side.

create table if not exists public.vercel_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  configuration_id text not null,
  account_id text not null,
  team_id text,
  scope text not null default '',
  access_token text not null,
  token_type text not null default 'Bearer',
  status text not null default 'connected' check (status in ('connected', 'disconnected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vercel_connections enable row level security;

-- Authenticated users can view only their own Vercel connection metadata.
create policy "Owners can read their own vercel connection"
  on public.vercel_connections for select to authenticated
  using (auth.uid() = owner_id);

-- Mutations are strictly server-authoritative and executed via service-role key.
