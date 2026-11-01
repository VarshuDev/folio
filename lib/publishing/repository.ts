import { DraftBundleSchema, type DesignConfig, type DraftBundle, type ProfileDocument } from '@/lib/profile-schema';
import type { PublishedPortfolio } from './types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeHasUnpublishedChanges } from './status';

export interface IPublishingRepository {
  getPublicationBySlug(slug: string): Promise<PublishedPortfolio | null>;
  getPublicationByOwnerId(ownerId: string): Promise<PublishedPortfolio | null>;
  publishPortfolio(
    ownerId: string,
    slug: string,
    profile: ProfileDocument,
    design: DesignConfig,
  ): Promise<
    | { ok: true; publication: PublishedPortfolio; previousSlug?: string }
    | { ok: false; error: string; code: 'slug_taken' | 'server_error' }
  >;
  unpublishPortfolio(ownerId: string): Promise<{ ok: boolean; unpublishedSlug?: string; message?: string }>;
  getPublicationStatus(
    ownerId: string,
    currentProfile?: ProfileDocument,
    currentDesign?: DesignConfig,
  ): Promise<{
    isPublished: boolean;
    slug: string | null;
    publishedAt: string | null;
    url: string | null;
    hasUnpublishedChanges: boolean;
  }>;
  getDraft(ownerId: string): Promise<DraftBundle | null>;
  saveDraft(ownerId: string, bundle: DraftBundle): Promise<{ ok: boolean; message?: string }>;
}

/**
 * In-memory repository used for automated tests and local development when
 * live Supabase server credentials are not configured or when explicitly selected.
 */
class InMemoryPublishingRepository implements IPublishingRepository {
  private publications = new Map<string, PublishedPortfolio>(); // keyed by id
  private ownerToId = new Map<string, string>(); // ownerId -> publicationId
  private slugToId = new Map<string, string>(); // slug -> publicationId (only if isPublic)
  private drafts = new Map<string, DraftBundle>(); // ownerId -> DraftBundle

  clear(): void {
    this.publications.clear();
    this.ownerToId.clear();
    this.slugToId.clear();
    this.drafts.clear();
  }

  async getPublicationBySlug(slug: string): Promise<PublishedPortfolio | null> {
    const pubId = this.slugToId.get(slug.toLowerCase());
    if (!pubId) return null;
    const pub = this.publications.get(pubId);
    return pub && pub.isPublic ? pub : null;
  }

  async getPublicationByOwnerId(ownerId: string): Promise<PublishedPortfolio | null> {
    const pubId = this.ownerToId.get(ownerId);
    if (!pubId) return null;
    return this.publications.get(pubId) ?? null;
  }

  async publishPortfolio(
    ownerId: string,
    rawSlug: string,
    profile: ProfileDocument,
    design: DesignConfig,
  ): Promise<
    | { ok: true; publication: PublishedPortfolio; previousSlug?: string }
    | { ok: false; error: string; code: 'slug_taken' | 'server_error' }
  > {
    const slug = rawSlug.toLowerCase();
    const existingForSlugId = this.slugToId.get(slug);

    if (existingForSlugId) {
      const existingPub = this.publications.get(existingForSlugId);
      if (existingPub && existingPub.ownerId !== ownerId && existingPub.isPublic) {
        return {
          ok: false,
          error: `The address “${slug}” is already taken by another user.`,
          code: 'slug_taken',
        };
      }
    }

    const now = new Date().toISOString();
    const existingPub = await this.getPublicationByOwnerId(ownerId);
    const previousSlug = (existingPub && existingPub.isPublic && existingPub.slug !== slug) ? existingPub.slug : undefined;
    const version = existingPub ? existingPub.version + 1 : 1;
    const id = existingPub ? existingPub.id : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Remove old slug index if changed
    if (existingPub && existingPub.slug !== slug) {
      this.slugToId.delete(existingPub.slug);
    }

    const publication: PublishedPortfolio = {
      id,
      profileId: `profile-${ownerId}`,
      ownerId,
      slug,
      profile,
      design,
      version,
      status: 'published',
      isPublic: true,
      publishedAt: now,
      updatedAt: now,
    };

    this.publications.set(id, publication);
    this.ownerToId.set(ownerId, id);
    this.slugToId.set(slug, id);
    this.drafts.set(ownerId, { profile, design, updatedAt: now });

    return { ok: true, publication, previousSlug };
  }

  async unpublishPortfolio(ownerId: string): Promise<{ ok: boolean; unpublishedSlug?: string; message?: string }> {
    const pub = await this.getPublicationByOwnerId(ownerId);
    if (!pub || !pub.isPublic) return { ok: true, message: 'No active portfolio found to unpublish.' };

    const unpublishedSlug = pub.slug;
    pub.isPublic = false;
    pub.status = 'unpublished';
    pub.updatedAt = new Date().toISOString();

    this.slugToId.delete(pub.slug);
    this.publications.set(pub.id, pub);

    return { ok: true, unpublishedSlug };
  }

  async getPublicationStatus(
    ownerId: string,
    currentProfile?: ProfileDocument,
    currentDesign?: DesignConfig,
  ): Promise<{
    isPublished: boolean;
    slug: string | null;
    publishedAt: string | null;
    url: string | null;
    hasUnpublishedChanges: boolean;
  }> {
    const pub = await this.getPublicationByOwnerId(ownerId);
    if (!pub || !pub.isPublic) {
      return {
        isPublished: false,
        slug: null,
        publishedAt: null,
        url: null,
        hasUnpublishedChanges: false,
      };
    }

    let hasUnpublishedChanges = false;
    const activeProfile = currentProfile ?? this.drafts.get(ownerId)?.profile;
    const activeDesign = currentDesign ?? this.drafts.get(ownerId)?.design;

    if (activeProfile && activeDesign) {
      hasUnpublishedChanges = computeHasUnpublishedChanges(activeProfile, activeDesign, pub.profile, pub.design);
    }

    return {
      isPublished: true,
      slug: pub.slug,
      publishedAt: pub.publishedAt,
      url: `/p/${pub.slug}`,
      hasUnpublishedChanges,
    };
  }

  async getDraft(ownerId: string): Promise<DraftBundle | null> {
    return this.drafts.get(ownerId) ?? null;
  }

  async saveDraft(ownerId: string, bundle: DraftBundle): Promise<{ ok: boolean; message?: string }> {
    this.drafts.set(ownerId, bundle);
    return { ok: true };
  }
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Production Supabase-backed publishing repository.
 * Uses server-only service-role key to write snapshots to profile_publications.
 */
class SupabasePublishingRepository implements IPublishingRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getPublicationBySlug(slug: string): Promise<PublishedPortfolio | null> {
    const { data, error } = await this.client
      .from('profile_publications')
      .select('id, profile_id, version, slug, public_document, public_design, is_public, published_at, created_at, profiles!inner(owner_id)')
      .eq('slug', slug.toLowerCase())
      .eq('is_public', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (process.env.NODE_ENV !== 'production') {
        return inMemoryStore.getPublicationBySlug(slug);
      }
      return null;
    }

    const ownerId = (data.profiles as unknown as { owner_id: string })?.owner_id ?? '';

    return {
      id: data.id,
      profileId: data.profile_id,
      ownerId,
      slug: data.slug,
      profile: data.public_document as ProfileDocument,
      design: data.public_design as DesignConfig,
      version: data.version,
      status: data.is_public ? 'published' : 'unpublished',
      isPublic: Boolean(data.is_public),
      publishedAt: data.published_at,
      updatedAt: data.created_at,
    };
  }

  async getPublicationByOwnerId(ownerId: string): Promise<PublishedPortfolio | null> {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.getPublicationByOwnerId(ownerId);
    }

    const { data: profileRow } = await this.client
      .from('profiles')
      .select('id')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!profileRow) return null;

    const { data, error } = await this.client
      .from('profile_publications')
      .select('id, profile_id, version, slug, public_document, public_design, is_public, published_at, created_at')
      .eq('profile_id', profileRow.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      profileId: data.profile_id,
      ownerId,
      slug: data.slug,
      profile: data.public_document as ProfileDocument,
      design: data.public_design as DesignConfig,
      version: data.version,
      status: data.is_public ? 'published' : 'unpublished',
      isPublic: Boolean(data.is_public),
      publishedAt: data.published_at,
      updatedAt: data.created_at,
    };
  }

  async publishPortfolio(
    ownerId: string,
    rawSlug: string,
    profile: ProfileDocument,
    design: DesignConfig,
  ): Promise<
    | { ok: true; publication: PublishedPortfolio; previousSlug?: string }
    | { ok: false; error: string; code: 'slug_taken' | 'server_error' }
  > {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.publishPortfolio(ownerId, rawSlug, profile, design);
    }

    const slug = rawSlug.toLowerCase();

    // 1. Ensure a profile row exists for this owner
    let { data: profileRow } = await this.client
      .from('profiles')
      .select('id, slug')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!profileRow) {
      const { data: newProfile, error: insertError } = await this.client
        .from('profiles')
        .insert({
          owner_id: ownerId,
          slug,
          draft_document: profile,
          draft_design: design,
        })
        .select('id, slug')
        .single();

      if (insertError || !newProfile) {
        return { ok: false, error: 'Could not create profile record.', code: 'server_error' };
      }
      profileRow = newProfile;
    }

    // 2. Check if slug is used by someone else
    const { data: conflicting } = await this.client
      .from('profile_publications')
      .select('id, profile_id')
      .eq('slug', slug)
      .eq('is_public', true)
      .neq('profile_id', profileRow.id)
      .limit(1)
      .maybeSingle();

    if (conflicting) {
      return {
        ok: false,
        error: `The address “${slug}” is already taken by another user.`,
        code: 'slug_taken',
      };
    }

    // 3. Determine next version number and check for previous slug
    const { data: latestPub } = await this.client
      .from('profile_publications')
      .select('version, slug, is_public')
      .eq('profile_id', profileRow.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousSlug = (latestPub && latestPub.is_public && latestPub.slug !== slug) ? latestPub.slug : undefined;
    const nextVersion = (latestPub?.version ?? 0) + 1;
    const now = new Date().toISOString();

    // 4. Mark all previous publications for this profile as not public
    await this.client
      .from('profile_publications')
      .update({ is_public: false })
      .eq('profile_id', profileRow.id);

    // 5. Insert new publication snapshot
    const { data: newPub, error: pubError } = await this.client
      .from('profile_publications')
      .insert({
        profile_id: profileRow.id,
        version: nextVersion,
        slug,
        public_document: profile,
        public_design: design,
        is_public: true,
        published_at: now,
      })
      .select('id, profile_id, version, slug, public_document, public_design, is_public, published_at, created_at')
      .single();

    if (pubError || !newPub) {
      return {
        ok: false,
        error: pubError?.message ?? 'Could not create publication snapshot.',
        code: 'server_error',
      };
    }

    // Update profile slug
    await this.client.from('profiles').update({ slug, updated_at: now }).eq('id', profileRow.id);

    return {
      ok: true,
      publication: {
        id: newPub.id,
        profileId: newPub.profile_id,
        ownerId,
        slug: newPub.slug,
        profile: newPub.public_document as ProfileDocument,
        design: newPub.public_design as DesignConfig,
        version: newPub.version,
        status: 'published',
        isPublic: true,
        publishedAt: newPub.published_at,
        updatedAt: newPub.created_at,
      },
      previousSlug,
    };
  }

  async unpublishPortfolio(ownerId: string): Promise<{ ok: boolean; unpublishedSlug?: string; message?: string }> {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.unpublishPortfolio(ownerId);
    }

    const { data: profileRow } = await this.client
      .from('profiles')
      .select('id, slug')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!profileRow) return { ok: true };

    const { data: currentPub } = await this.client
      .from('profile_publications')
      .select('slug')
      .eq('profile_id', profileRow.id)
      .eq('is_public', true)
      .maybeSingle();

    const unpublishedSlug = currentPub?.slug || profileRow.slug || undefined;

    const { error } = await this.client
      .from('profile_publications')
      .update({ is_public: false })
      .eq('profile_id', profileRow.id);

    return error ? { ok: false, message: error.message } : { ok: true, unpublishedSlug };
  }

  async getPublicationStatus(
    ownerId: string,
    currentProfile?: ProfileDocument,
    currentDesign?: DesignConfig,
  ): Promise<{
    isPublished: boolean;
    slug: string | null;
    publishedAt: string | null;
    url: string | null;
    hasUnpublishedChanges: boolean;
  }> {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.getPublicationStatus(ownerId, currentProfile, currentDesign);
    }

    const pub = await this.getPublicationByOwnerId(ownerId);
    if (!pub || !pub.isPublic) {
      return {
        isPublished: false,
        slug: null,
        publishedAt: null,
        url: null,
        hasUnpublishedChanges: false,
      };
    }

    let hasUnpublishedChanges = false;
    let activeProfile = currentProfile;
    let activeDesign = currentDesign;

    if (!activeProfile || !activeDesign) {
      const draft = await this.getDraft(ownerId);
      if (draft) {
        activeProfile = draft.profile;
        activeDesign = draft.design;
      }
    }

    if (activeProfile && activeDesign) {
      hasUnpublishedChanges = computeHasUnpublishedChanges(activeProfile, activeDesign, pub.profile, pub.design);
    }

    return {
      isPublished: true,
      slug: pub.slug,
      publishedAt: pub.publishedAt,
      url: `/p/${pub.slug}`,
      hasUnpublishedChanges,
    };
  }

  async getDraft(ownerId: string): Promise<DraftBundle | null> {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.getDraft(ownerId);
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('draft_document, draft_design, updated_at')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error || !data) return null;
    const portfolioConfig =
      (data.draft_design as Record<string, unknown> | null)?._portfolioConfig ??
      (data as Record<string, unknown> | null)?.portfolio_config ??
      { mode: 'simple' };

    const result = DraftBundleSchema.safeParse({
      profile: data.draft_document,
      design: data.draft_design,
      portfolioConfig,
      updatedAt: data.updated_at,
    });
    return result.success ? result.data : null;
  }

  async saveDraft(ownerId: string, bundle: DraftBundle): Promise<{ ok: boolean; message?: string }> {
    if (!isValidUuid(ownerId)) {
      return inMemoryStore.saveDraft(ownerId, bundle);
    }

    const designWithConfig = {
      ...bundle.design,
      _portfolioConfig: bundle.portfolioConfig ?? { mode: 'simple' },
    };
    const { error } = await this.client.from('profiles').upsert({
      owner_id: ownerId,
      draft_document: bundle.profile,
      draft_design: designWithConfig,
      schema_version: bundle.profile.schemaVersion,
      updated_at: bundle.updatedAt,
    }, { onConflict: 'owner_id' });

    return error ? { ok: false, message: error.message } : { ok: true };
  }
}

/**
 * Guarded repository returned when server service-role key is missing.
 * Allows safe public read queries with anon key if configured, but fails all mutations explicitly.
 * Never leaks environment variable names or stack traces to clients.
 */
class MissingServiceRolePublishingRepository implements IPublishingRepository {
  private readOnlyClient: SupabaseClient | null;

  constructor(readOnlyClient: SupabaseClient | null) {
    this.readOnlyClient = readOnlyClient;
  }

  async getPublicationBySlug(slug: string): Promise<PublishedPortfolio | null> {
    if (!this.readOnlyClient) return null;
    try {
      const { data, error } = await this.readOnlyClient
        .from('profile_publications')
        .select('id, profile_id, version, slug, public_document, public_design, is_public, published_at, created_at, profiles!inner(owner_id)')
        .eq('slug', slug.toLowerCase())
        .eq('is_public', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const ownerId = (data.profiles as unknown as { owner_id: string })?.owner_id ?? '';

      return {
        id: data.id,
        profileId: data.profile_id,
        ownerId,
        slug: data.slug,
        profile: data.public_document as ProfileDocument,
        design: data.public_design as DesignConfig,
        version: data.version,
        status: data.is_public ? 'published' : 'unpublished',
        isPublic: Boolean(data.is_public),
        publishedAt: data.published_at,
        updatedAt: data.created_at,
      };
    } catch {
      return null;
    }
  }

  async getPublicationByOwnerId(_ownerId: string): Promise<PublishedPortfolio | null> {
    return null;
  }

  async publishPortfolio(
    _ownerId: string,
    _slug: string,
    _profile: ProfileDocument,
    _design: DesignConfig,
  ): Promise<
    | { ok: true; publication: PublishedPortfolio; previousSlug?: string }
    | { ok: false; error: string; code: 'slug_taken' | 'server_error' }
  > {
    return {
      ok: false,
      error: 'Publishing service is not properly configured.',
      code: 'server_error',
    };
  }

  async unpublishPortfolio(_ownerId: string): Promise<{ ok: boolean; unpublishedSlug?: string; message?: string }> {
    return {
      ok: false,
      message: 'Publishing service is not properly configured.',
    };
  }

  async getPublicationStatus(
    _ownerId: string,
    _currentProfile?: ProfileDocument,
    _currentDesign?: DesignConfig,
  ): Promise<{
    isPublished: boolean;
    slug: string | null;
    publishedAt: string | null;
    url: string | null;
    hasUnpublishedChanges: boolean;
  }> {
    return {
      isPublished: false,
      slug: null,
      publishedAt: null,
      url: null,
      hasUnpublishedChanges: false,
    };
  }

  async getDraft(_ownerId: string): Promise<DraftBundle | null> {
    return null;
  }

  async saveDraft(_ownerId: string, _bundle: DraftBundle): Promise<{ ok: boolean; message?: string }> {
    return {
      ok: false,
      message: 'Publishing repository service-role is not configured.',
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __folioInMemoryStore: InMemoryPublishingRepository | undefined;
}

// Global in-memory singleton for test/dev (persisted on globalThis to bridge across Next.js worker/chunk boundaries)
const inMemoryStore = (globalThis.__folioInMemoryStore && typeof globalThis.__folioInMemoryStore.getDraft === 'function')
  ? globalThis.__folioInMemoryStore
  : new InMemoryPublishingRepository();
globalThis.__folioInMemoryStore = inMemoryStore;

export function getInMemoryStoreForTests(): InMemoryPublishingRepository {
  return inMemoryStore;
}

let testRepoOverride: IPublishingRepository | null = null;

export function setPublishingRepositoryForTests(repo: IPublishingRepository | null): void {
  testRepoOverride = repo;
}

/**
 * Factory for obtaining the server-side publishing repository.
 * - Respects explicit test overrides.
 * - Respects FOLIO_PERSISTENCE='memory'.
 * - Requires SUPABASE_SERVICE_ROLE_KEY for real server mutations.
 * - NEVER uses NEXT_PUBLIC_SUPABASE_ANON_KEY as a service-role key substitute.
 */
export function getPublishingRepository(): IPublishingRepository {
  if (testRepoOverride) {
    return testRepoOverride;
  }

  if (process.env.FOLIO_PERSISTENCE === 'memory') {
    return inMemoryStore;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabasePublishingRepository(client);
  }

  if (url && !serviceRoleKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const readOnlyClient = anonKey
      ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
    return new MissingServiceRolePublishingRepository(readOnlyClient);
  }

  if (process.env.NODE_ENV !== 'production') {
    return inMemoryStore;
  }

  return new MissingServiceRolePublishingRepository(null);
}
