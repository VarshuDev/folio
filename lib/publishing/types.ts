import type { DesignConfig, ProfileDocument } from '@/lib/profile-schema';

export type PublicationStatus = 'published' | 'unpublished';

export type PublishedPortfolio = {
  id: string;
  profileId: string;
  ownerId: string;
  slug: string;
  profile: ProfileDocument;
  design: DesignConfig;
  version: number;
  status: PublicationStatus;
  isPublic: boolean;
  publishedAt: string;
  updatedAt: string;
};

export type PublishRequest = {
  slug: string;
  profile: ProfileDocument;
  design: DesignConfig;
};

export type PublishSuccessResult = {
  ok: true;
  slug: string;
  url: string;
  publishedAt: string;
  version: number;
};

export type PublishErrorResult = {
  ok: false;
  error: string;
  code:
    | 'unauthenticated'
    | 'unauthorized'
    | 'invalid_slug'
    | 'slug_taken'
    | 'invalid_profile'
    | 'invalid_design'
    | 'missing_name'
    | 'invalid_links'
    | 'unsupported_mode'
    | 'server_error';
};

export type PublishResult = PublishSuccessResult | PublishErrorResult;

export type PublishStatusResult = {
  ok: true;
  isPublished: boolean;
  slug: string | null;
  url: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};
