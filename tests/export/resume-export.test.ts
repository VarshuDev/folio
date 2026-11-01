import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsResumeHtml } from '../../lib/export/resume-export';
import { exportResume } from '../../lib/export/service';
import {
  createEmptyProfile,
  ProfileDocumentSchema,
  RecommendationSchema,
} from '../../lib/profile-schema';

test('generateAtsResumeHtml produces semantic, single-column ATS structure', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Rivera';
  profile.basics.role = 'Product Architect';
  profile.basics.about = 'Building next-gen digital experiences & zero lock-in portfolios.';
  profile.basics.location = 'San Francisco, CA';
  profile.links.email = 'alex@example.com';
  profile.links.github = 'https://github.com/alexrivera';
  profile.links.linkedin = 'https://linkedin.com/in/alexrivera';

  profile.education = {
    college: 'Stanford University',
    degree: 'B.S.',
    branch: 'Computer Science',
    gradYear: '2022',
    note: 'Specialized in systems and human-computer interaction.',
  };

  profile.skills = ['TypeScript', 'Rust', 'Next.js', 'React'];
  profile.interests = ['Distributed Systems', 'Accessibility'];
  profile.learning = 'WebAssembly and WebGPU';

  profile.projects = [
    {
      id: 'proj-1',
      title: 'HyperGrid Engine',
      description: 'Distributed compute grid processing parallel workloads with sub-millisecond dispatch.',
      tools: 'TypeScript, WebGPU',
      link: 'https://github.com/alexrivera/hypergrid',
    },
  ];

  profile.highlights = ['Published research on high-throughput browser runtimes'];
  profile.activities = ['Mentored 15 hackathon teams'];

  profile.recommendations = [
    {
      id: 'rec-1',
      author: 'Dr. Sarah Jenkins',
      role: 'Principal Research Scientist',
      company: 'Tech Lab',
      text: 'Alex demonstrates exceptional technical foresight, architecting scalable solutions under tight timelines.',
      link: 'https://linkedin.com/in/sarahjenkins',
    },
  ];

  const html = generateAtsResumeHtml(profile, 'alex-rivera');

  // Verify core document & metadata
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>Alex Rivera — Resume (ATS-Friendly)</title>'));
  assert.ok(html.includes('Alex Rivera</h1>'));
  assert.ok(html.includes('Product Architect'));
  assert.ok(html.includes('San Francisco, CA'));
  assert.ok(html.includes('mailto:alex@example.com'));
  assert.ok(html.includes('linkedin.com/in/alexrivera'));
  assert.ok(html.includes('github.com/alexrivera'));

  // Verify standard ATS section headings
  assert.ok(html.includes('PROFESSIONAL SUMMARY</h2>'));
  assert.ok(html.includes('EDUCATION</h2>'));
  assert.ok(html.includes('TECHNICAL SKILLS &amp; AREAS OF EXPERTISE</h2>'));
  assert.ok(html.includes('KEY PROJECTS &amp; TECHNICAL EXPERIENCE</h2>'));
  assert.ok(html.includes('ACHIEVEMENTS, ACTIVITIES &amp; LEADERSHIP</h2>'));
  assert.ok(html.includes('ENDORSEMENTS &amp; RECOMMENDATIONS</h2>'));

  // Verify section content
  assert.ok(html.includes('Stanford University'));
  assert.ok(html.includes('B.S. in Computer Science'));
  assert.ok(html.includes('TypeScript · Rust · Next.js · React'));
  assert.ok(html.includes('HyperGrid Engine'));
  assert.ok(html.includes('Published research on high-throughput browser runtimes'));
  assert.ok(html.includes('Dr. Sarah Jenkins'));
  assert.ok(html.includes('Alex demonstrates exceptional technical foresight'));

  // Verify print media stylesheet
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('page-break-inside: avoid'));
  assert.ok(html.includes('.no-print'));
});

test('generateAtsResumeHtml strictly preserves privacy and never leaks originalNotes', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Jordan Smith';
  profile.basics.originalNotes = 'PRIVATE_INTERNAL_NOTES_DO_NOT_EXPOSE';

  const html = generateAtsResumeHtml(profile, 'jordan');

  assert.equal(html.includes('PRIVATE_INTERNAL_NOTES_DO_NOT_EXPOSE'), false);
  assert.equal(html.includes('originalNotes'), false);
});

test('generateAtsResumeHtml safely escapes HTML special characters', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Malicious <script>alert(1)</script>';
  profile.basics.role = 'Dev & Hacker';
  profile.projects = [
    {
      id: 'p1',
      title: 'Project with <img src=x onerror=alert(1)>',
      description: 'Contains "quotes" and <tags>',
      tools: 'C++ & Assembly',
      link: '',
    },
  ];
  profile.recommendations = [
    {
      id: 'r1',
      author: 'Author with <b>Bold</b>',
      role: 'Reviewer',
      company: 'Co',
      text: 'Great work & clean "code"',
      link: '',
    },
  ];

  const html = generateAtsResumeHtml(profile, 'test');

  // Verify that dangerous tags are escaped
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&amp;'));
});

test('exportResume returns valid ExportResult with text/html mimeType and buffer', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Taylor Swift';

  const result = exportResume(profile, 'taylor-swift');
  assert.equal(result.filename, 'taylor-swift-resume.html');
  assert.equal(result.mimeType, 'text/html; charset=utf-8');
  assert.ok(result.buffer.length > 0);
  assert.ok(result.buffer.toString('utf8').includes('Taylor Swift'));
});

test('ProfileDocumentSchema backward compatibility: parses existing drafts without recommendations', () => {
  const legacyDraftJson = {
    schemaVersion: 1,
    basics: {
      name: 'Legacy User',
      role: 'Engineer',
      about: 'Legacy about',
      location: 'NY',
      originalNotes: '',
    },
    education: {
      college: 'MIT',
      degree: 'B.S.',
      branch: 'EECS',
      gradYear: '2020',
      note: '',
    },
    skills: ['JavaScript'],
    interests: [],
    projects: [],
    highlights: [],
    activities: [],
    learning: '',
    links: { email: 'legacy@example.com', github: '', linkedin: '', other: [] },
  };

  const parsed = ProfileDocumentSchema.parse(legacyDraftJson);
  assert.ok(Array.isArray(parsed.recommendations));
  assert.equal(parsed.recommendations.length, 0);
});

test('RecommendationSchema validates valid endorsements and rejects oversized fields', () => {
  const validRec = {
    id: 'rec-test-1',
    author: 'Sam Altman',
    role: 'CEO',
    company: 'OpenAI',
    text: 'A brilliant builder who delivers incredible impact.',
    link: 'https://openai.com',
  };

  const parsed = RecommendationSchema.parse(validRec);
  assert.equal(parsed.author, 'Sam Altman');

  // Author over 120 chars should fail
  assert.throws(() => {
    RecommendationSchema.parse({
      ...validRec,
      author: 'a'.repeat(125),
    });
  });

  // Text over 3000 chars should fail
  assert.throws(() => {
    RecommendationSchema.parse({
      ...validRec,
      text: 'a'.repeat(3050),
    });
  });
});
