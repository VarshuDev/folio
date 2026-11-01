import type { AdvancedPageType, AdvancedThemeId, AdvancedPortfolioConfig } from '@/lib/portfolio-mode';
import type { ProfileDocument } from '@/lib/profile-schema';

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedRouteMeta {
  pageType: AdvancedPageType;
  route: string;
  title: string;
  navLabel: string;
}

export interface GenerationManifest {
  generatorVersion: string;
  framework: 'nextjs';
  themeId: AdvancedThemeId;
  themeVersion: number;
  siteTitle: string;
  enabledPages: AdvancedPageType[];
  routes: GeneratedRouteMeta[];
  generatedFileCount: number;
  filePaths: string[];
}

export interface GeneratedProject {
  framework: 'nextjs';
  files: GeneratedFile[];
  manifest: GenerationManifest;
}

export interface GeneratorInput {
  profile: ProfileDocument;
  config: AdvancedPortfolioConfig;
}

export interface CleanPortfolioData {
  basics: {
    name: string;
    role: string;
    about: string;
    location: string;
  };
  education: {
    college: string;
    degree: string;
    branch: string;
    gradYear: string;
    note: string;
  };
  skills: string[];
  interests: string[];
  projects: Array<{
    id: string;
    title: string;
    description: string;
    tools: string;
    link: string;
  }>;
  highlights: string[];
  activities: string[];
  learning: string;
  links: {
    email: string;
    github: string;
    linkedin: string;
    other: Array<{
      label: string;
      url: string;
    }>;
  };
  siteTitle: string;
}

export type GeneratorValidationResult =
  | {
      ok: true;
      cleanData: CleanPortfolioData;
      cleanConfig: AdvancedPortfolioConfig;
    }
  | {
      ok: false;
      error: string;
      code: string;
    };
