import crypto from 'node:crypto';

/**
 * Generates a deterministic, Vercel-compliant project name for an Advanced portfolio.
 *
 * Vercel project name rules:
 * - lowercase
 * - alphanumeric and hyphens only
 * - length between 3 and 32 characters
 * - must not start or end with a hyphen
 * - must not contain private notes or secrets
 */
export function generateDeterministicProjectName(params: {
  creatorName?: string;
  userId: string;
  slug?: string;
}): string {
  const { creatorName, userId, slug } = params;

  let raw = (slug || creatorName || 'portfolio')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!raw || raw.length < 3) {
    raw = 'folio-project';
  }

  // Ensure deterministic, collision-safe postfix from userId (first 6 chars of sha256)
  const hash = crypto.createHash('sha256').update(userId).digest('hex').slice(0, 6);
  
  // Truncate base name so that base + '-' + hash <= 32 chars
  const maxBaseLen = 32 - 1 - hash.length; // 25
  const base = raw.slice(0, maxBaseLen).replace(/-+$/, '');

  const finalName = `${base}-${hash}`;
  return finalName.toLowerCase();
}
