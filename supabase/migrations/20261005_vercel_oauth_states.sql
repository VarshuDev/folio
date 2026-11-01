-- Checkpoint 8I.3 — Durable OAuth State / Replay Protection Schema
-- Stores server-authoritative OAuth state nonces for single-use replay protection.
-- Accessible strictly via server service-role key; client roles denied.

create table if not exists public.vercel_oauth_states (
  nonce text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index to optimize lookup and bounded expiration cleanup
create index if not exists idx_vercel_oauth_states_expires_at
  on public.vercel_oauth_states (expires_at);

create index if not exists idx_vercel_oauth_states_owner_consumed
  on public.vercel_oauth_states (owner_id, consumed_at);

-- Enable Row Level Security
alter table public.vercel_oauth_states enable row level security;

-- Strictly deny all client access (anon and authenticated roles)
revoke all on public.vercel_oauth_states from anon, authenticated;
