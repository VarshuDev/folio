import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResumeText, convertResumeFactsToSuggestions } from '@/lib/ai/resume-parser';
import { ProfileSuggestionSchema } from '@/lib/ai/contract';

const SAMPLE_RESUME = `
Sarah Chen
Full Stack Systems Engineer
sarah.chen@example.com | Seattle, WA
github.com/sarahchen | linkedin.com/in/sarahchen

SUMMARY
Passionate systems and software engineer focused on distributed computing, type-safe API design, and accessible interfaces.

EDUCATION
State University of Washington
Bachelor of Science in Computer Science, 2024

SKILLS
TypeScript, React, Python, Go, Node.js, PostgreSQL, Docker, Git

PROJECTS
Folio Portfolio Studio (React, Next.js, TypeScript)
https://github.com/sarahchen/folio
- Built an accessible, zero-config portfolio platform.
- Implemented client-side deterministic parsing with 100% test coverage.

LogStream Ingestor (Go, gRPC)
- Scalable telemetry ingest pipeline handling 50k events per second.
- Reduced database storage footprint by 40% using delta compression.

AWARDS & HIGHLIGHTS
- First Place Winner at HackPNW 2023
- Dean's List Honor Roll (2020 - 2024)

LEADERSHIP & ACTIVITIES
- President of Open Source Club at State University
`;

test('parseResumeText: extracts structured facts from sample resume text', () => {
  const facts = parseResumeText(SAMPLE_RESUME);

  // 1. Basic Info
  assert.equal(facts.name?.value, 'Sarah Chen');
  assert.equal(facts.role?.value, 'Full Stack Systems Engineer');
  assert.equal(facts.email?.value, 'sarah.chen@example.com');
  assert.equal(facts.location?.value, 'Seattle, WA');
  assert.equal(facts.github?.value, 'https://github.com/sarahchen');
  assert.equal(facts.linkedin?.value, 'https://linkedin.com/in/sarahchen');

  // 2. Summary
  assert.equal(facts.about?.value.includes('Passionate systems'), true);

  // 3. Education
  assert.equal(facts.education?.college?.value, 'State University of Washington');
  assert.equal(facts.education?.degree?.value, 'Bachelor of Science');
  assert.equal(facts.education?.branch?.value, 'Computer Science');
  assert.equal(facts.education?.gradYear?.value, '2024');

  // 4. Skills
  const skillValues = facts.skills.map((s) => s.value);
  assert.equal(skillValues.includes('TypeScript'), true);
  assert.equal(skillValues.includes('Python'), true);
  assert.equal(skillValues.includes('Go'), true);

  // 5. Projects
  assert.equal(facts.projects.length >= 2, true);
  const folioProj = facts.projects.find((p) => p.title.includes('Folio'));
  assert.notEqual(folioProj, undefined);
  assert.equal(folioProj?.tools.includes('React'), true);
  assert.equal(folioProj?.link, 'https://github.com/sarahchen/folio');

  // 6. Highlights & Activities
  assert.equal(facts.highlights.length >= 1, true);
  assert.equal(facts.activities.length >= 1, true);
});

test('convertResumeFactsToSuggestions: converts parsed facts into validated ProfileSuggestion items', () => {
  const facts = parseResumeText(SAMPLE_RESUME);
  const suggestions = convertResumeFactsToSuggestions(facts);

  assert.equal(suggestions.length > 5, true);

  // Every suggestion must satisfy the strict ProfileSuggestionSchema
  for (const suggestion of suggestions) {
    const parseResult = ProfileSuggestionSchema.safeParse(suggestion);
    assert.equal(parseResult.success, true, `Suggestion failed validation: ${JSON.stringify(suggestion)}`);
    assert.equal(suggestion.needsReview, true);
    assert.equal(suggestion.status, 'suggested');
    assert.equal(suggestion.provenance.status, 'exact');
  }

  // Check specific paths
  const nameSug = suggestions.find((s) => s.path === 'basics.name');
  assert.equal(nameSug?.proposedValue, 'Sarah Chen');

  const emailSug = suggestions.find((s) => s.path === 'links.email');
  assert.equal(emailSug?.proposedValue, 'sarah.chen@example.com');
});
