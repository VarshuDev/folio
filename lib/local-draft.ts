import {
  createDefaultDesign,
  createEmptyProfile,
  DraftBundleSchema,
  type DraftBundle,
} from '@/lib/profile-schema';

const STORAGE_KEY = 'folio-studio-draft-v1';

export function loadLocalDraft(): DraftBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = DraftBundleSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveLocalDraft(bundle: DraftBundle): boolean {
  if (typeof window === 'undefined') return false;
  const result = DraftBundleSchema.safeParse(bundle);
  if (!result.success) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

export function createEmptyDraft(): DraftBundle {
  return {
    profile: createEmptyProfile(),
    design: createDefaultDesign(),
    portfolioConfig: { mode: 'simple' },
    updatedAt: new Date().toISOString(),
  };
}
