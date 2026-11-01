import type { DesignConfig, ProfileDocument } from '@/lib/profile-schema';

/**
 * Normalizes a ProfileDocument into a canonical structure for content comparison.
 * Excludes private drafting material (originalNotes) and normalizes whitespace.
 */
export function normalizeProfileForComparison(profile: ProfileDocument) {
  return {
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
    skills: [...profile.skills].map((s) => s.trim()).filter(Boolean),
    interests: [...profile.interests].map((i) => i.trim()).filter(Boolean),
    projects: profile.projects.map((p) => ({
      title: p.title.trim(),
      description: p.description.trim(),
      tools: p.tools.trim(),
      link: p.link.trim(),
    })),
    highlights: [...profile.highlights].map((h) => h.trim()).filter(Boolean),
    activities: [...(profile.activities || [])].map((a) => a.trim()).filter(Boolean),
    learning: profile.learning.trim(),
    links: {
      email: profile.links.email.trim(),
      github: profile.links.github.trim(),
      linkedin: profile.links.linkedin.trim(),
      other: (profile.links.other || []).map((o) => ({
        label: o.label.trim(),
        url: o.url.trim(),
      })),
    },
  };
}

/**
 * Normalizes a DesignConfig into a canonical structure for comparison.
 */
export function normalizeDesignForComparison(design: DesignConfig) {
  return {
    templateId: design.templateId,
    templateVersion: design.templateVersion,
    visibleSections: design.visibleSections,
    sectionOrder: design.sectionOrder,
  };
}

/**
 * Determines whether a working draft differs from the active public snapshot.
 * Compares content semantically, ignoring private notes and insignificant whitespace.
 */
export function computeHasUnpublishedChanges(
  currentProfile: ProfileDocument,
  currentDesign: DesignConfig,
  publishedProfile: ProfileDocument,
  publishedDesign: DesignConfig,
): boolean {
  const draftProfileKey = JSON.stringify(normalizeProfileForComparison(currentProfile));
  const draftDesignKey = JSON.stringify(normalizeDesignForComparison(currentDesign));
  const pubProfileKey = JSON.stringify(normalizeProfileForComparison(publishedProfile));
  const pubDesignKey = JSON.stringify(normalizeDesignForComparison(publishedDesign));

  return draftProfileKey !== pubProfileKey || draftDesignKey !== pubDesignKey;
}
