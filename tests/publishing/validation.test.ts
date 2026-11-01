import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublishableDraft } from '../../lib/publishing/validation';
import { createDefaultDesign, createEmptyProfile, TEMPLATE_IDS } from '../../lib/profile-schema';

test('enforces mandatory creator name', () => {
  const profile = createEmptyProfile();
  const design = createDefaultDesign();

  // Empty name fails
  profile.basics.name = '';
  const resultEmpty = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(resultEmpty.ok, false);
  if (!resultEmpty.ok) {
    assert.equal(resultEmpty.code, 'missing_name');
  }

  // Whitespace-only name fails
  profile.basics.name = '    ';
  const resultWhitespace = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(resultWhitespace.ok, false);
  if (!resultWhitespace.ok) {
    assert.equal(resultWhitespace.code, 'missing_name');
  }

  // Non-empty name succeeds
  profile.basics.name = 'Alex Chen';
  const resultValid = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(resultValid.ok, true);
});

test('accepts all 22 valid templateIds and rejects unknown templateId', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';

  assert.equal(TEMPLATE_IDS.length, 22);

  for (const templateId of TEMPLATE_IDS) {
    const design = createDefaultDesign();
    design.templateId = templateId;
    const result = validatePublishableDraft(profile, design, 'alex-chen');
    assert.equal(result.ok, true, `Expected templateId "${templateId}" to be valid`);
  }

  // Unknown template ID
  const invalidDesign = createDefaultDesign();
  // @ts-expect-error test invalid id
  invalidDesign.templateId = 'nonexistent-theme';
  const resultInvalid = validatePublishableDraft(profile, invalidDesign, 'alex-chen');
  assert.equal(resultInvalid.ok, false);
  if (!resultInvalid.ok) {
    assert.equal(resultInvalid.code, 'invalid_design');
  }
});

test('enforces URL safety: allows http/https and rejects dangerous protocols', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';
  const design = createDefaultDesign();

  // Valid links
  profile.links.github = 'https://github.com/alexchen';
  profile.links.linkedin = 'https://linkedin.com/in/alexchen';
  profile.links.other = [{ label: 'Personal Site', url: 'https://alex.dev' }];
  profile.projects = [
    { id: 'p1', title: 'Test Project', description: 'desc', tools: 'react', link: 'https://alex.dev/project' },
  ];

  const validResult = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(validResult.ok, true);

  // Malicious javascript: link in github
  const badGithub = structuredClone(profile);
  badGithub.links.github = 'javascript:alert("pwned")';
  const badGithubResult = validatePublishableDraft(badGithub, design, 'alex-chen');
  assert.equal(badGithubResult.ok, false);
  if (!badGithubResult.ok) assert.equal(badGithubResult.code, 'invalid_links');

  // Malicious data: link in project
  const badProject = structuredClone(profile);
  badProject.projects[0].link = 'data:text/html,<script>alert(1)</script>';
  const badProjectResult = validatePublishableDraft(badProject, design, 'alex-chen');
  assert.equal(badProjectResult.ok, false);
  if (!badProjectResult.ok) assert.equal(badProjectResult.code, 'invalid_links');

  // Malicious vbscript: in other links
  const badOther = structuredClone(profile);
  badOther.links.other = [{ label: 'Evil', url: 'vbscript:msgbox(1)' }];
  const badOtherResult = validatePublishableDraft(badOther, design, 'alex-chen');
  assert.equal(badOtherResult.ok, false);
  if (!badOtherResult.ok) assert.equal(badOtherResult.code, 'invalid_links');
});

test('validates email format in links', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';
  const design = createDefaultDesign();

  // Valid email
  profile.links.email = 'alex@example.com';
  assert.equal(validatePublishableDraft(profile, design, 'alex-chen').ok, true);

  // Invalid email
  profile.links.email = 'not-a-valid-email';
  const badEmailResult = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(badEmailResult.ok, false);
  if (!badEmailResult.ok) assert.equal(badEmailResult.code, 'invalid_links');
});

test('strips private originalNotes from public published projection', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';
  profile.basics.originalNotes = 'Secret draft notes that must NEVER be public!';
  const design = createDefaultDesign();

  const result = validatePublishableDraft(profile, design, 'alex-chen');
  assert.equal(result.ok, true);
  if (result.ok) {
    // The cleanProfile must have originalNotes scrubbed
    assert.equal(result.cleanProfile.basics.originalNotes, '');
    assert.ok(!JSON.stringify(result.cleanProfile).includes('Secret draft notes'));
  }
});

test('validates slug parameter through publishing validator', () => {
  const profile = createEmptyProfile();
  profile.basics.name = 'Alex Chen';
  const design = createDefaultDesign();

  // Invalid slug
  const result = validatePublishableDraft(profile, design, 'admin');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_slug');
  }
});
