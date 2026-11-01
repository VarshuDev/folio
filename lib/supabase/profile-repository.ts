import { DraftBundleSchema, type DraftBundle } from '@/lib/profile-schema';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Fetches the signed-in user's private draft. RLS still enforces ownership. */
export async function loadRemoteDraft(client: SupabaseClient, userId: string): Promise<DraftBundle | null> {
  const { data, error } = await client
    .from('profiles')
    .select('draft_document, draft_design, updated_at')
    .eq('owner_id', userId)
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

/** Upserts only the caller's draft. The owner_id predicate is also checked by RLS. */
export async function saveRemoteDraft(client: SupabaseClient, userId: string, bundle: DraftBundle): Promise<{ ok: boolean; message?: string }> {
  const designWithConfig = {
    ...bundle.design,
    _portfolioConfig: bundle.portfolioConfig ?? { mode: 'simple' },
  };
  const { error } = await client.from('profiles').upsert({
    owner_id: userId,
    draft_document: bundle.profile,
    draft_design: designWithConfig,
    schema_version: bundle.profile.schemaVersion,
    updated_at: bundle.updatedAt,
  }, { onConflict: 'owner_id' });

  return error ? { ok: false, message: error.message } : { ok: true };
}
