import {
  DesignConfigSchema,
  ProfileDocumentSchema,
  TEMPLATE_IDS,
  type DesignConfig,
  type ProfileDocument,
} from '@/lib/profile-schema';
import { validateSlug } from './slug';

function isSafeHttpUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true; // empty is allowed as optional
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isValidEmail(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type ValidatePublishResult =
  | {
      ok: true;
      cleanProfile: ProfileDocument;
      cleanDesign: DesignConfig;
      cleanSlug: string;
    }
  | {
      ok: false;
      error: string;
      code:
        | 'missing_name'
        | 'invalid_profile'
        | 'invalid_design'
        | 'invalid_slug'
        | 'invalid_links';
    };

/**
 * Validates that a draft document and design configuration are safe and complete
 * enough for public publication. Produces a sanitized projection for public storage.
 */
export function validatePublishableDraft(
  rawProfile: unknown,
  rawDesign: unknown,
  rawSlug: string,
): ValidatePublishResult {
  // 1. Slug validation
  const slugValidation = validateSlug(rawSlug);
  if (!slugValidation.ok) {
    return { ok: false, error: slugValidation.error, code: 'invalid_slug' };
  }

  // 2. Profile schema validation
  const profileResult = ProfileDocumentSchema.safeParse(rawProfile);
  if (!profileResult.success) {
    return {
      ok: false,
      error: 'Profile data is invalid or malformed.',
      code: 'invalid_profile',
    };
  }
  const profile = profileResult.data;

  // 3. Name check (must not be empty)
  if (!profile.basics.name.trim()) {
    return {
      ok: false,
      error: 'A name is required before publishing your portfolio.',
      code: 'missing_name',
    };
  }

  // 4. Design schema validation
  const designResult = DesignConfigSchema.safeParse(rawDesign);
  if (!designResult.success) {
    return {
      ok: false,
      error: 'Design configuration is invalid.',
      code: 'invalid_design',
    };
  }
  const design = designResult.data;

  // 5. Template ID check
  if (!TEMPLATE_IDS.includes(design.templateId)) {
    return {
      ok: false,
      error: `Unknown style ID: “${design.templateId}”.`,
      code: 'invalid_design',
    };
  }

  // 6. Link safety verification
  if (!isValidEmail(profile.links.email)) {
    return {
      ok: false,
      error: 'The email address in your profile (Step 5 · Highlights & links) is not in a valid format (e.g. name@example.com). You can also leave it blank.',
      code: 'invalid_links',
    };
  }

  if (profile.links.github && !isSafeHttpUrl(profile.links.github)) {
    return {
      ok: false,
      error: 'GitHub address must be a valid HTTP or HTTPS link.',
      code: 'invalid_links',
    };
  }

  if (profile.links.linkedin && !isSafeHttpUrl(profile.links.linkedin)) {
    return {
      ok: false,
      error: 'LinkedIn address must be a valid HTTP or HTTPS link.',
      code: 'invalid_links',
    };
  }

  for (const otherLink of profile.links.other) {
    if (!isSafeHttpUrl(otherLink.url)) {
      return {
        ok: false,
        error: `Link “${otherLink.label || 'Website'}” has an unsafe or invalid URL.`,
        code: 'invalid_links',
      };
    }
  }

  for (const project of profile.projects) {
    if (project.link && !isSafeHttpUrl(project.link)) {
      return {
        ok: false,
        error: `Project “${project.title || 'Untitled'}” has an unsafe or invalid link.`,
        code: 'invalid_links',
      };
    }
  }

  // 7. Sanitize public projection:
  // Strip private raw drafting notes from the published snapshot.
  const cleanProfile: ProfileDocument = {
    ...profile,
    basics: {
      ...profile.basics,
      name: profile.basics.name.trim(),
      role: profile.basics.role.trim(),
      about: profile.basics.about.trim(),
      location: profile.basics.location.trim(),
      originalNotes: '', // private working material is omitted from the public snapshot
    },
  };

  return {
    ok: true,
    cleanProfile,
    cleanDesign: design,
    cleanSlug: slugValidation.slug,
  };
}
