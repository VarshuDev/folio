-- Initial multi-tenant profile schema for folio.
-- Draft profile data is private. Public pages read only explicit publication snapshots.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text unique,
  draft_document jsonb not null default '{}'::jsonb,
  draft_design jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.profiles enable row level security;

create policy "Owners can read their own profile draft"
  on public.profiles for select to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can create their own profile draft"
  on public.profiles for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update their own profile draft"
  on public.profiles for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create table if not exists public.profile_publications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null,
  slug text not null,
  public_document jsonb not null,
  public_design jsonb not null,
  is_public boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, version),
  constraint publications_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists profile_publications_live_slug_unique
  on public.profile_publications (slug)
  where is_public = true;

alter table public.profile_publications enable row level security;

-- Public visitors read published snapshots only. No draft profile row is exposed by this policy.
create policy "Anyone can read published snapshots"
  on public.profile_publications for select to anon, authenticated
  using (is_public = true);

-- Owners can also inspect their own previous publications, including unpublished snapshots.
create policy "Owners can read their own publication history"
  on public.profile_publications for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.owner_id = auth.uid()
    )
  );

-- Intentionally no client insert/update/delete policies on profile_publications.
-- A future trusted server route should construct an allowlisted public projection,
-- then write snapshots using a server-only service role key. Never put that key in the browser.
