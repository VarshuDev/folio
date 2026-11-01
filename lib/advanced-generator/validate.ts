import {
  ProfileDocumentSchema,
  type ProfileDocument,
} from '@/lib/profile-schema';
import {
  AdvancedPortfolioConfigSchema,
  type AdvancedPortfolioConfig,
} from '@/lib/portfolio-mode';
import type {
  CleanPortfolioData,
  GeneratedFile,
  GeneratorInput,
  GeneratorValidationResult,
} from './types';

/**
 * Validates that a URL is safe HTTP or HTTPS, rejecting javascript:, data:, etc.
 */
export function isSafeHttpUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true; // empty is allowed as optional
  if (/^(javascript|data|vbscript|file):/i.test(value)) {
    return false;
  }
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

/**
 * Normalizes a safe URL to have an explicit https:// scheme if none was provided.
 */
export function normalizeSafeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isValidEmail(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Validates a generated file path to ensure it is strictly relative and safe.
 */
export function validateFilePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/');

  // No absolute paths
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return false;

  // No directory traversal
  if (normalized.includes('..') || normalized.split('/').some((part) => part === '..')) {
    return false;
  }

  // No null bytes
  if (normalized.includes('\0')) return false;

  // Safe path characters: alphanumeric, dashes, underscores, dots, slashes
  if (!/^[a-zA-Z0-9_\-./]+$/.test(normalized)) return false;

  return true;
}

export const FORBIDDEN_TOKENS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'FOLIO_AI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'VERCEL_TOKEN',
  'VERCEL_OAUTH',
  'originalNotes',
  'Authorization: Bearer',
  'eval(',
  'new Function(',
  'dangerouslySetInnerHTML',
  'child_process',
  'exec(',
  'spawn(',
  'javascript:',
  'vbscript:',
] as const;

const FORBIDDEN_PATTERNS = [
  /(['"`]|\bhref\s*=\s*['"`]|\bsrc\s*=\s*['"`])\s*data:/i,
  /\bdata:text\/html/i,
];

/**
 * Scans generated source files for prohibited patterns, secrets, or executable injection.
 */
export function scanGeneratedFilesForForbiddenTokens(files: GeneratedFile[]): {
  safe: boolean;
  violations: Array<{ path: string; token: string }>;
} {
  const violations: Array<{ path: string; token: string }> = [];

  for (const file of files) {
    for (const token of FORBIDDEN_TOKENS) {
      if (file.content.includes(token)) {
        violations.push({ path: file.path, token });
      }
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(file.content)) {
        violations.push({ path: file.path, token: pattern.toString() });
      }
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Validates generator input, ensuring profile and configuration conform to contracts,
 * links are safe, and private drafting notes are completely stripped.
 */
export function validateGeneratorInput(input: GeneratorInput): GeneratorValidationResult {
  // 1. Validate Profile Document
  const profileParsed = ProfileDocumentSchema.safeParse(input.profile);
  if (!profileParsed.success) {
    return {
      ok: false,
      error: 'Profile document failed validation.',
      code: 'invalid_profile',
    };
  }
  const profile = profileParsed.data;

  // Creator name is mandatory for project generation
  if (!profile.basics.name.trim()) {
    return {
      ok: false,
      error: 'Creator name is required to generate a portfolio project.',
      code: 'missing_name',
    };
  }

  // 2. Validate Advanced Portfolio Config
  const configParsed = AdvancedPortfolioConfigSchema.safeParse(input.config);
  if (!configParsed.success) {
    return {
      ok: false,
      error: `Advanced configuration failed validation: ${configParsed.error.issues[0]?.message || 'Invalid config'}`,
      code: 'invalid_config',
    };
  }
  const config = configParsed.data;

  // 3. Link Safety Checks
  if (profile.links.email && !isValidEmail(profile.links.email)) {
    return {
      ok: false,
      error: 'Email address has an invalid format.',
      code: 'invalid_email',
    };
  }

  if (profile.links.github && !isSafeHttpUrl(profile.links.github)) {
    return {
      ok: false,
      error: 'GitHub URL is invalid or unsafe.',
      code: 'invalid_links',
    };
  }

  if (profile.links.linkedin && !isSafeHttpUrl(profile.links.linkedin)) {
    return {
      ok: false,
      error: 'LinkedIn URL is invalid or unsafe.',
      code: 'invalid_links',
    };
  }

  for (const other of profile.links.other) {
    if (other.url && !isSafeHttpUrl(other.url)) {
      return {
        ok: false,
        error: `Link "${other.label || 'Other'}" has an unsafe or invalid URL.`,
        code: 'invalid_links',
      };
    }
  }

  for (const project of profile.projects) {
    if (project.link && !isSafeHttpUrl(project.link)) {
      return {
        ok: false,
        error: `Project "${project.title || 'Untitled'}" has an unsafe or invalid link.`,
        code: 'invalid_links',
      };
    }
  }

  // 4. Sanitize Profile Data for Standalone Next.js Project (Single Source of Truth)
  const cleanData: CleanPortfolioData = {
    basics: {
      name: profile.basics.name.trim(),
      role: profile.basics.role.trim(),
      about: profile.basics.about.trim(),
      location: profile.basics.location.trim(),
    },
    education: {
      college: profile.education.college.trim(),
      degree: profile.education.degree.trim(),
      branch: profile.education.branch.trim(),
      gradYear: profile.education.gradYear.trim(),
      note: profile.education.note.trim(),
    },
    skills: profile.skills.map((s) => s.trim()).filter(Boolean),
    interests: profile.interests.map((i) => i.trim()).filter(Boolean),
    projects: profile.projects.map((p) => ({
      id: p.id,
      title: p.title.trim(),
      description: p.description.trim(),
      tools: p.tools.trim(),
      link: p.link ? normalizeSafeUrl(p.link) : '',
    })),
    highlights: profile.highlights.map((h) => h.trim()).filter(Boolean),
    activities: profile.activities.map((a) => a.trim()).filter(Boolean),
    learning: profile.learning.trim(),
    links: {
      email: profile.links.email.trim(),
      github: profile.links.github ? normalizeSafeUrl(profile.links.github) : '',
      linkedin: profile.links.linkedin ? normalizeSafeUrl(profile.links.linkedin) : '',
      other: profile.links.other.map((o) => ({
        label: o.label.trim(),
        url: normalizeSafeUrl(o.url),
      })),
    },
    siteTitle: config.siteTitle?.trim() || profile.basics.name.trim() || 'Portfolio',
  };

  return {
    ok: true,
    cleanData,
    cleanConfig: config,
  };
}
