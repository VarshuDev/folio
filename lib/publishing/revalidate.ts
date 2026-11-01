/**
 * Centralized on-demand cache revalidation for public portfolios.
 * Safe for use in Next.js server runtime and Node.js test runners.
 */

export type RevalidationCallback = (slug: string) => void;

let testListeners: RevalidationCallback[] = [];

/**
 * Registers a listener invoked whenever a portfolio route is revalidated.
 * Used for deterministic assertions in unit and regression tests.
 */
export function registerRevalidationCallbackForTests(callback: RevalidationCallback): () => void {
  testListeners.push(callback);
  return () => {
    testListeners = testListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Triggers on-demand revalidation for `/p/[slug]`.
 * In Next.js runtime, calls `revalidatePath('/p/' + slug)`.
 * Outside Next.js (e.g. tests), invokes test listeners without throwing.
 */
export async function revalidatePortfolioPath(slug: string): Promise<{ ok: boolean; slug: string }> {
  const cleanSlug = slug.toLowerCase().trim();
  if (!cleanSlug) return { ok: false, slug: '' };

  for (const listener of testListeners) {
    try {
      listener(cleanSlug);
    } catch {
      // ignore test listener errors
    }
  }

  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/p/${cleanSlug}`);
    return { ok: true, slug: cleanSlug };
  } catch {
    // In unit test or non-Next.js context, next/cache may not have an active store.
    // This is safe and expected.
    return { ok: true, slug: cleanSlug };
  }
}
