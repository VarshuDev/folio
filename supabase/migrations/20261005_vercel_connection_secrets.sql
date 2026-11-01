-- Checkpoint 8I.1 — Dedicated Vercel Connection Secrets Storage & RLS Hardening
-- Moves access_token and token_type out of public.vercel_connections into a dedicated,
-- strictly server-only secret table: public.vercel_connection_secrets.

-- 1. Create dedicated secrets table with foreign key cascading from vercel_connections
create table if not exists public.vercel_connection_secrets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.vercel_connections(id) on delete cascade,
  access_token text not null,
  token_type text not null default 'Bearer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security on the secret table
alter table public.vercel_connection_secrets enable row level security;

-- 3. Explicitly DENY all direct access to client roles (anon, authenticated)
-- No SELECT, INSERT, UPDATE, or DELETE policies exist for client roles.
-- Access is strictly restricted to service-role (server-only).
revoke all on public.vercel_connection_secrets from anon, authenticated;

-- 4. Migrate existing plaintext access tokens from vercel_connections (if columns exist)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vercel_connections'
      and column_name = 'access_token'
  ) then
    insert into public.vercel_connection_secrets (connection_id, access_token, token_type, created_at, updated_at)
    select id, access_token, coalesce(token_type, 'Bearer'), created_at, updated_at
    from public.vercel_connections
    where access_token is not null
    on conflict (connection_id) do update set
      access_token = excluded.access_token,
      token_type = excluded.token_type,
      updated_at = excluded.updated_at;

    -- 5. Drop sensitive secret columns from vercel_connections
    alter table public.vercel_connections drop column access_token;
    alter table public.vercel_connections drop column token_type;
  end if;
end $$;

-- 6. Drop obsolete RLS policy from vercel_connections that previously exposed secrets
drop policy if exists "Owners can read their own vercel connection" on public.vercel_connections;

-- 7. Ensure vercel_connections table is also denied to anon and authenticated direct access
-- All client reads must go through the authenticated server route: /api/integrations/vercel/status
revoke all on public.vercel_connections from anon, authenticated;
