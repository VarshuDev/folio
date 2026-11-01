import type { ProfileDocument } from '@/lib/profile-schema';

export type StyleAuditFixtureId = 'A' | 'B' | 'C' | 'D';

export type StyleAuditFixture = {
  id: StyleAuditFixtureId;
  label: string;
  summary: string;
  profile: ProfileDocument;
};

const emptyLinks: ProfileDocument['links'] = {
  email: '',
  github: '',
  linkedin: '',
  other: [],
};

const edgeName = 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer';
const edgeRole = 'Early-career interaction design and community technology learner researching accessible public-service interfaces through small collaborative prototypes and careful observation';
const edgeAbout = Array.from({ length: 7 }, (_, index) =>
  `Paragraph stress sample ${index + 1}: Avery is exploring how clear language, patient iteration, and accessible interaction patterns can make everyday digital tools easier to understand. This fictional note intentionally repeats a realistic sentence length so each style can be checked for line wrapping, readable measure, and overflow without inventing new content in the renderer.`,
).join(' ');
const edgeProjectTitle = 'An intentionally extended project title for testing wrapping, hierarchy, and reading order on narrow portfolio screens';
const edgeProjectDescription = Array.from({ length: 7 }, (_, index) =>
  `Description segment ${index + 1}: this synthetic project note is intentionally verbose so desktop and mobile layouts can be reviewed for truncation, overflow, and reading order. It contains no image, screenshot, claim of impact, or hidden project detail.`,
).join(' ');

/** Synthetic QA-only data. These people, schools, projects, and links are fictional. */
export const STYLE_AUDIT_FIXTURES: readonly StyleAuditFixture[] = [
  {
    id: 'A',
    label: 'A · Early-stage',
    summary: 'Sparse but credible profile; no projects, optional activity list, or contact links.',
    profile: {
      schemaVersion: 1,
      basics: {
        name: 'Mira Sen',
        role: 'First-year computing student',
        about: 'I am learning how small web details affect whether a page feels clear and welcoming.',
        location: 'Bengaluru, India',
        originalNotes: '',
      },
      education: {
        college: 'Northstar Learning Collective (fictional)',
        degree: 'Undergraduate',
        branch: 'Computing',
        gradYear: '2029',
        note: '',
      },
      skills: ['HTML basics', 'Python basics'],
      interests: [],
      projects: [],
      highlights: [],
      activities: [],
      recommendations: [],
      learning: 'Accessible web design',
      links: { ...emptyLinks },
    },
  },
  {
    id: 'B',
    label: 'B · One-project student',
    summary: 'One honest project with a short description and tools; no screenshot or extra project filler.',
    profile: {
      schemaVersion: 1,
      basics: {
        name: 'Rohan Das',
        role: 'Design and computing student',
        about: 'I like turning small observations into simple things people can try.',
        location: 'Mysuru, India',
        originalNotes: '',
      },
      education: {
        college: 'Northstar Learning Collective (fictional)',
        degree: 'Bachelor of Design',
        branch: 'Interaction Design',
        gradYear: '2027',
        note: 'Coursework includes prototyping and interface writing.',
      },
      skills: ['Figma', 'HTML', 'User interviews'],
      interests: ['Maps', 'Public spaces'],
      projects: [
        {
          id: 'fixture-b-project-01',
          title: 'Study-room finder',
          description: 'A class prototype that helps students compare quiet study spaces by opening hours and seating notes.',
          tools: 'Figma, HTML, CSS',
          link: '',
        },
      ],
      highlights: [],
      activities: [],
      recommendations: [],
      learning: 'I am practicing clearer interface writing.',
      links: { ...emptyLinks },
    },
  },
  {
    id: 'C',
    label: 'C · Rich profile',
    summary: 'Several real-looking sections, two projects, skills, activities, and safe example links for hierarchy checks.',
    profile: {
      schemaVersion: 1,
      basics: {
        name: 'Varshan Gowda',
        role: 'Computer science student exploring civic technology',
        about: 'I enjoy working across research, interface design, and small web builds. My current focus is making useful information easier to find and understand.',
        location: 'Bengaluru, India',
        originalNotes: '',
      },
      education: {
        college: 'Northstar Learning Collective (fictional)',
        degree: 'Bachelor of Science',
        branch: 'Computer Science',
        gradYear: '2027',
        note: 'Coursework in human-computer interaction, data structures, and web development.',
      },
      skills: ['TypeScript', 'React', 'Figma', 'Accessibility reviews'],
      interests: ['Civic data', 'Public libraries', 'Clear writing'],
      projects: [
        {
          id: 'fixture-c-project-01',
          title: 'Library-hours map',
          description: 'A student project that organizes opening-hour information from a small set of fictional community libraries. The prototype focuses on clear labels and a useful mobile reading order.',
          tools: 'TypeScript, React, CSS',
          link: 'https://library-map.example.test',
        },
        {
          id: 'fixture-c-project-02',
          title: 'Plain-language form study',
          description: 'A coursework study comparing two fictional signup-form drafts and documenting where participants hesitated.',
          tools: 'Figma, moderated study, notes',
          link: '',
        },
      ],
      highlights: ['Peer mentor for an introductory web workshop', 'Shortlisted class project in a fictional campus showcase'],
      activities: ['Helped review keyboard navigation for a student club page'],
      recommendations: [
        {
          id: 'fixture-c-rec-01',
          author: 'Prof. Ananya Rao',
          role: 'Faculty Advisor',
          company: 'Northstar Learning Collective',
          text: 'Varshan approaches both research and interface design with remarkable clarity, consistency, and dedication.',
          link: '',
        },
      ],
      learning: 'I am practicing accessible component patterns and concise project writing.',
      links: {
        email: 'varshan@example.test',
        github: 'https://code.example.test/varshan',
        linkedin: '',
        other: [{ label: 'Notes', url: 'https://notes.example.test/varshan' }],
      },
    },
  },
  {
    id: 'D',
    label: 'D · Edge-case text',
    summary: 'Long name, role, paragraph, and project title/description; no image field and all optional sections empty. Toggle the no-projects subcase below.',
    profile: {
      schemaVersion: 1,
      basics: {
        name: edgeName,
        role: edgeRole,
        about: edgeAbout,
        location: '',
        originalNotes: '',
      },
      education: { college: '', degree: '', branch: '', gradYear: '', note: '' },
      skills: [],
      interests: [],
      projects: [
        {
          id: 'fixture-d-project-01',
          title: edgeProjectTitle,
          description: edgeProjectDescription,
          tools: '',
          link: '',
        },
      ],
      highlights: [],
      activities: [],
      recommendations: [],
      learning: '',
      links: { ...emptyLinks },
    },
  },
];

export const STYLE_AUDIT_IMAGE_NOTE = 'ProfileDocument has no image field. All project art visible in the current renderer is neutral CSS decoration, not a screenshot or user-provided image.';

export function getStyleAuditFixture(id: StyleAuditFixtureId, noProjects = false): ProfileDocument {
  const fixture = STYLE_AUDIT_FIXTURES.find((item) => item.id === id) ?? STYLE_AUDIT_FIXTURES[0];
  if (id === 'D' && noProjects) {
    return { ...fixture.profile, projects: [] };
  }
  return fixture.profile;
}
