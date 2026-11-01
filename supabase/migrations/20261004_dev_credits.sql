-- Dev Credits Schema for Folio
-- Server-authoritative experimental credit ledger. Credits have no monetary value and cannot be purchased.

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_granted integer not null default 0 check (lifetime_granted >= 0),
  lifetime_used integer not null default 0 check (lifetime_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_accounts enable row level security;

-- Authenticated users can view only their own credit account.
create policy "Owners can read their own credit account"
  on public.credit_accounts for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('grant', 'consume', 'refund')),
  amount integer not null check (amount > 0),
  reason text not null,
  reference text,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

-- Authenticated users can view only their own credit transaction history.
create policy "Owners can read their own transactions"
  on public.credit_transactions for select to authenticated
  using (auth.uid() = user_id);

-- Intentionally no client insert/update/delete policies on credit_accounts or credit_transactions.
-- Balances and ledger entries are strictly server-authoritative and mutated exclusively via service-role key.
