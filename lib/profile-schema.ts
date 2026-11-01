import { z } from 'zod';

export const TEMPLATE_IDS = [
  'minimal', 'editorial', 'project',
  'retro', 'pinboard', 'arcade', 'after-hours',
  'swiss', 'newsprint', 'brutalist', 'botanical', 'gallery', 'terminal',
  'blueprint', 'bauhaus', 'y2k', 'pastel', 'academic', 'zine', 'documentary',
  'community', 'case-study',
] as const;

export const SectionKeySchema = z.enum([
  'about',
  'education',
  'skills',
  'projects',
  'highlights',
  'contact',
]);

export const ProjectGithubStatsSchema = z.object({
  stars: z.number().int().nonnegative().default(0),
  forks: z.number().int().nonnegative().default(0),
  language: z.string().max(60).default(''),
  updatedAt: z.string().max(80).default(''),
  openIssues: z.number().int().nonnegative().optional(),
});

export const ProjectCaseStudySchema = z.object({
  problem: z.string().max(3000).default(''),
  solution: z.string().max(3000).default(''),
  architecture: z.string().max(3000).default(''),
  takeaways: z.array(z.string().max(500)).max(10).default([]),
  metrics: z.string().max(500).default(''),
  liveDemoUrl: z.string().max(500).default(''),
});

export const ProjectSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  description: z.string().max(3000),
  tools: z.string().max(240),
  link: z.string().max(500),
  githubUrl: z.string().max(500).optional(),
  githubStats: ProjectGithubStatsSchema.optional(),
  caseStudy: ProjectCaseStudySchema.optional(),
});

export const RecommendationSchema = z.object({
  id: z.string().min(1).max(80),
  author: z.string().max(120),
  role: z.string().max(180),
  company: z.string().max(120).default(''),
  text: z.string().max(3000),
  link: z.string().max(500).default(''),
});

export const ProfileDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  basics: z.object({
    name: z.string().max(120),
    role: z.string().max(180),
    about: z.string().max(3000),
    location: z.string().max(120),
    originalNotes: z.string().max(3000).default(''),
  }),
  education: z.object({
    college: z.string().max(180),
    degree: z.string().max(120),
    branch: z.string().max(120),
    gradYear: z.string().max(12),
    note: z.string().max(1500),
  }),
  skills: z.array(z.string().min(1).max(80)).max(50),
  interests: z.array(z.string().min(1).max(100)).max(50),
  projects: z.array(ProjectSchema).max(30),
  highlights: z.array(z.string().min(1).max(2000)).max(40),
  activities: z.array(z.string().min(1).max(2000)).max(40).default([]),
  recommendations: z.array(RecommendationSchema).max(20).default([]),
  learning: z.string().max(2000),
  links: z.object({
    email: z.string().max(254),
    github: z.string().max(500),
    linkedin: z.string().max(500),
    other: z.array(z.object({
      label: z.string().max(60),
      url: z.string().max(500),
    })).max(12).default([]),
  }),
});

export const DesignConfigSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  templateVersion: z.literal(1),
  visibleSections: z.record(SectionKeySchema, z.boolean()),
  sectionOrder: z.array(SectionKeySchema).length(6),
});

import { PortfolioConfigSchema, type PortfolioConfig } from './portfolio-mode';
export * from './portfolio-mode';

export const DraftBundleSchema = z.object({
  profile: ProfileDocumentSchema,
  design: DesignConfigSchema,
  portfolioConfig: PortfolioConfigSchema.optional(),
  updatedAt: z.string().datetime({ offset: true }),
});

export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type SectionKey = z.infer<typeof SectionKeySchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectGithubStats = z.infer<typeof ProjectGithubStatsSchema>;
export type ProjectCaseStudy = z.infer<typeof ProjectCaseStudySchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ProfileDocument = z.infer<typeof ProfileDocumentSchema>;
export type DesignConfig = z.infer<typeof DesignConfigSchema>;
export type DraftBundle = z.infer<typeof DraftBundleSchema>;

export function safeExternalUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export const SECTION_LABELS: ReadonlyArray<{ key: SectionKey; label: string }> = [
  { key: 'about', label: 'About' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
  { key: 'projects', label: 'Projects' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'contact', label: 'Contact' },
];

export function createEmptyProfile(): ProfileDocument {
  return {
    schemaVersion: 1,
    basics: { name: '', role: '', about: '', location: '', originalNotes: '' },
    education: { college: '', degree: '', branch: '', gradYear: '', note: '' },
    skills: [],
    interests: [],
    projects: [],
    highlights: [],
    activities: [],
    recommendations: [],
    learning: '',
    links: { email: '', github: '', linkedin: '', other: [] },
  };
}

export function createDefaultDesign(): DesignConfig {
  return {
    templateId: 'minimal',
    templateVersion: 1,
    visibleSections: {
      about: true,
      education: true,
      skills: true,
      projects: true,
      highlights: true,
      contact: true,
    },
    sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
  };
}
