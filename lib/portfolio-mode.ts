import { z } from 'zod';

export const PORTFOLIO_MODES = ['simple', 'advanced'] as const;
export type PortfolioMode = (typeof PORTFOLIO_MODES)[number];
export const PortfolioModeSchema = z.enum(PORTFOLIO_MODES);

export const ADVANCED_PAGE_TYPES = [
  'home',
  'about',
  'projects',
  'experience',
  'contact',
] as const;
export type AdvancedPageType = (typeof ADVANCED_PAGE_TYPES)[number];
export const AdvancedPageTypeSchema = z.enum(ADVANCED_PAGE_TYPES);

export const ADVANCED_THEME_IDS = [
  'advanced-minimal-v1',
  'advanced-editorial-v1',
  'advanced-studio-v1',
] as const;
export type AdvancedThemeId = (typeof ADVANCED_THEME_IDS)[number];
export const AdvancedThemeIdSchema = z.enum(ADVANCED_THEME_IDS);

export const RESERVED_ADVANCED_ROUTES = [
  'api',
  'account',
  'studio',
  'template-demos',
  'p',
  'admin',
  'auth',
  'login',
  'logout',
  'settings',
  '_next',
] as const;

const SafeTextRegex = /^[^<>]*$/;

export const ADVANCED_SECTION_KEYS = [
  'hero',
  'summary',
  'skills',
  'education',
  'projects',
  'highlights',
  'activities',
  'learning',
  'links',
  'contact',
  'location',
] as const;
export type AdvancedSectionKey = (typeof ADVANCED_SECTION_KEYS)[number];
export const AdvancedSectionKeySchema = z.enum(ADVANCED_SECTION_KEYS);

export const ALLOWED_PAGE_SECTIONS: Record<AdvancedPageType, readonly AdvancedSectionKey[]> = {
  home: ['hero', 'summary', 'highlights', 'projects', 'links'],
  about: ['summary', 'education', 'skills', 'activities', 'learning'],
  projects: ['projects', 'links'],
  experience: ['activities', 'highlights', 'education', 'learning'],
  contact: ['contact', 'location'],
};

export const SECTION_METADATA: Record<AdvancedSectionKey, { label: string; description: string }> = {
  hero: { label: 'Hero Introduction', description: 'Name, role title, and location headline from profile' },
  summary: { label: 'Bio & Summary', description: 'Personal narrative and background note from profile' },
  skills: { label: 'Skills & Curiosities', description: 'Competencies, tools, and topics you are learning' },
  education: { label: 'Education & Learning', description: 'College, degree, academic focus, and graduation year' },
  projects: { label: 'Projects Showcase', description: 'Featured projects, descriptions, tools, and links' },
  highlights: { label: 'Key Highlights', description: 'Milestones, key responsibilities, and achievements' },
  activities: { label: 'Activities & Community', description: 'Clubs, teams, leadership, and volunteering initiatives' },
  learning: { label: 'Current Learning Focus', description: 'Technologies and subjects you are currently exploring' },
  links: { label: 'Web & Social Links', description: 'GitHub, portfolio links, and other external profiles' },
  contact: { label: 'Contact Details', description: 'Email address, GitHub, LinkedIn, and direct contact options' },
  location: { label: 'Location & Region', description: 'City or region where you are based' },
};

export const PageSectionConfigSchema = z.object({
  key: AdvancedSectionKeySchema,
  visible: z.boolean().default(true),
});
export type PageSectionConfig = z.infer<typeof PageSectionConfigSchema>;

export const PageDefinitionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i, 'Page ID must contain only alphanumeric characters, dashes, or underscores'),
  type: AdvancedPageTypeSchema,
  slug: z.string().max(80).regex(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric with hyphens, or empty for home'),
  title: z.string().min(1).max(120).regex(SafeTextRegex, 'Title cannot contain HTML characters'),
  navLabel: z.string().min(1).max(60).regex(SafeTextRegex, 'Navigation label cannot contain HTML characters'),
  visible: z.boolean(),
  order: z.number().int().min(0).max(10),
  sections: z.array(PageSectionConfigSchema).optional(),
});

export type PageDefinition = z.infer<typeof PageDefinitionSchema>;

export const NavigationItemSchema = z.object({
  pageId: z.string().min(1).max(64),
  label: z.string().min(1).max(60).regex(SafeTextRegex, 'Label cannot contain HTML characters'),
  visible: z.boolean(),
});

export type NavigationItem = z.infer<typeof NavigationItemSchema>;

export const NavigationConfigSchema = z.object({
  items: z.array(NavigationItemSchema).max(10),
});

export type NavigationConfig = z.infer<typeof NavigationConfigSchema>;

export const AdvancedPortfolioConfigSchema = z.object({
  siteTitle: z.string().max(120).regex(SafeTextRegex, 'Site title cannot contain HTML characters').optional(),
  themeId: AdvancedThemeIdSchema,
  themeVersion: z.literal(1),
  pages: z.array(PageDefinitionSchema).min(1).max(5),
  navigation: NavigationConfigSchema,
}).superRefine((data, ctx) => {
  // 1. Home page must exist and be visible
  const homePage = data.pages.find((p) => p.type === 'home');
  if (!homePage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Advanced portfolio requires a home page.',
      path: ['pages'],
    });
  } else {
    if (homePage.slug !== '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Home page slug must be empty (canonical route /).',
        path: ['pages'],
      });
    }
    if (!homePage.visible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Home page must remain visible.',
        path: ['pages'],
      });
    }
  }

  // 2. Unique page IDs
  const pageIds = new Set<string>();
  for (const page of data.pages) {
    if (pageIds.has(page.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate page ID: "${page.id}".`,
        path: ['pages'],
      });
    }
    pageIds.add(page.id);
  }

  // 3. Unique page types
  const pageTypes = new Set<string>();
  for (const page of data.pages) {
    if (pageTypes.has(page.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate page type: "${page.type}". Only one page of each type is allowed.`,
        path: ['pages'],
      });
    }
    pageTypes.add(page.type);
  }

  // 4. Unique routes and reserved route checks
  const slugs = new Set<string>();
  for (const page of data.pages) {
    const slugLower = page.slug.toLowerCase();
    if (slugs.has(slugLower)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate route/slug: "${page.slug}".`,
        path: ['pages'],
      });
    }
    slugs.add(slugLower);

    if (RESERVED_ADVANCED_ROUTES.includes(slugLower as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Route "${page.slug}" is reserved by the application.`,
        path: ['pages'],
      });
    }
  }

  // 5. Deterministic ordering
  const orders = new Set<number>();
  for (const page of data.pages) {
    if (orders.has(page.order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate page order: "${page.order}". Page orders must be unique.`,
        path: ['pages'],
      });
    }
    orders.add(page.order);
  }

  // 6. Navigation items reference existing valid pages
  for (const item of data.navigation.items) {
    if (!pageIds.has(item.pageId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Navigation references unknown pageId: "${item.pageId}".`,
        path: ['navigation', 'items'],
      });
    }
  }

  // 7. Validate page-specific sections if provided
  for (const page of data.pages) {
    if (page.sections) {
      const allowed = ALLOWED_PAGE_SECTIONS[page.type];
      const seen = new Set<string>();
      for (const section of page.sections) {
        if (!allowed.includes(section.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Section "${section.key}" is not allowed on "${page.type}" page.`,
            path: ['pages'],
          });
        }
        if (seen.has(section.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate section "${section.key}" on "${page.type}" page.`,
            path: ['pages'],
          });
        }
        seen.add(section.key);
      }
    }
  }
});

export type AdvancedPortfolioConfig = z.infer<typeof AdvancedPortfolioConfigSchema>;

export const PortfolioConfigSchema = z.object({
  mode: PortfolioModeSchema.default('simple'),
  advanced: AdvancedPortfolioConfigSchema.optional(),
});

export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;

export function getDefaultPageSections(type: AdvancedPageType): PageSectionConfig[] {
  return ALLOWED_PAGE_SECTIONS[type].map((key) => ({
    key,
    visible: true,
  }));
}

export function createDefaultAdvancedConfig(): AdvancedPortfolioConfig {
  const pages: PageDefinition[] = [
    {
      id: 'page-home',
      type: 'home',
      slug: '',
      title: 'Home',
      navLabel: 'Home',
      visible: true,
      order: 0,
      sections: getDefaultPageSections('home'),
    },
    {
      id: 'page-about',
      type: 'about',
      slug: 'about',
      title: 'About',
      navLabel: 'About',
      visible: true,
      order: 1,
      sections: getDefaultPageSections('about'),
    },
    {
      id: 'page-projects',
      type: 'projects',
      slug: 'projects',
      title: 'Projects',
      navLabel: 'Projects',
      visible: true,
      order: 2,
      sections: getDefaultPageSections('projects'),
    },
    {
      id: 'page-experience',
      type: 'experience',
      slug: 'experience',
      title: 'Experience',
      navLabel: 'Experience',
      visible: true,
      order: 3,
      sections: getDefaultPageSections('experience'),
    },
    {
      id: 'page-contact',
      type: 'contact',
      slug: 'contact',
      title: 'Contact',
      navLabel: 'Contact',
      visible: true,
      order: 4,
      sections: getDefaultPageSections('contact'),
    },
  ];

  return {
    siteTitle: '',
    themeId: 'advanced-minimal-v1',
    themeVersion: 1,
    pages,
    navigation: {
      items: pages.map((p) => ({
        pageId: p.id,
        label: p.navLabel,
        visible: p.visible,
      })),
    },
  };
}

export function createDefaultPortfolioConfig(mode: PortfolioMode = 'simple'): PortfolioConfig {
  return {
    mode,
    advanced: mode === 'advanced' ? createDefaultAdvancedConfig() : undefined,
  };
}
