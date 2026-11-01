export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'dashboard',
  'favicon',
  'help',
  'login',
  'p',
  'portfolio',
  'privacy',
  'settings',
  'signup',
  'static',
  'studio',
  'template-demos',
  'terms',
  '_next',
]);

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 48;

/**
 * Normalizes a raw string into a clean candidate slug.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Suggests a default slug from a user's name or fallback.
 */
export function suggestSlug(name: string): string {
  const normalized = normalizeSlug(name);
  if (normalized.length >= MIN_SLUG_LENGTH && !RESERVED_SLUGS.has(normalized)) {
    return normalized;
  }
  if (normalized.length > 0 && normalized.length < MIN_SLUG_LENGTH) {
    const padded = `${normalized}-portfolio`;
    if (!RESERVED_SLUGS.has(padded)) return padded;
  }
  return 'my-portfolio';
}

/**
 * Deterministically validates whether a slug meets all format and reservation rules.
 */
export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'A portfolio web address is required.' };
  }

  const slug = trimmed.toLowerCase();

  if (RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      error: `“${slug}” is a reserved system address. Please choose a different address.`,
    };
  }

  if (slug.length < MIN_SLUG_LENGTH) {
    return { ok: false, error: `Address must be at least ${MIN_SLUG_LENGTH} characters.` };
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    return { ok: false, error: `Address must be at most ${MAX_SLUG_LENGTH} characters.` };
  }

  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error: 'Address can only use lowercase letters, numbers, and single hyphens (no spaces or special characters).',
    };
  }

  return { ok: true, slug };
}
