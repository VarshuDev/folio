const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const SOURCE = 'I built a small website using React to learn frontend development.';
const ALTERNATIVES = [
  'I built a small React website to learn frontend development.',
  'To learn frontend development, I built a small website using React.',
  'I built a small website with React to learn frontend development.',
];
const result = { checkpoint: '7B', checks: {}, browserErrors: [], axeViolations: [], failedChecks: [] };
let browser;

function assert(condition, message, details) {
  if (!condition) result.failedChecks.push({ message, details });
}

function createBundle() {
  return {
    profile: {
      schemaVersion: 1,
      basics: { name: 'QA Copy', role: 'First-year student', about: SOURCE, location: 'Bengaluru', originalNotes: 'Private note that must never be sent.' },
      education: { college: '', degree: '', branch: '', gradYear: '', note: '' },
      skills: ['React'], interests: [],
      projects: [{ id: 'qa-project-1', title: 'Small portfolio site', description: SOURCE, tools: 'React', link: 'example.com/demo' }],
      highlights: [], activities: [], learning: '',
      links: { email: '', github: '', linkedin: '', other: [] },
    },
    design: {
      templateId: 'minimal', templateVersion: 1,
      visibleSections: { about: true, education: true, skills: true, projects: true, highlights: true, contact: true },
      sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
    },
    updatedAt: new Date().toISOString(),
  };
}

async function seededPage(viewport = { width: 1365, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', (error) => result.browserErrors.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') result.browserErrors.push({ type: 'console', message: message.text() }); });
  page.on('requestfailed', (request) => result.browserErrors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));
  await page.addInitScript(({ key, bundle }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(bundle));
  }, { key: STORAGE_KEY, bundle: createBundle() });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Continue draft/ }).click();
  await page.getByLabel('What should we call you?').waitFor();
  return { context, page };
}

function successEnvelope(requestBody) {
  const suggestions = ALTERNATIVES.map((proposedText, index) => ({
    id: `copy-${index + 1}`,
    path: requestBody.path,
    originalText: requestBody.text,
    proposedText,
    action: requestBody.action,
    provenance: { status: 'exact', text: requestBody.text },
    reason: requestBody.action === 'shorten'
      ? 'This version aims to say the same thing in fewer words.'
      : requestBody.action === 'professional'
        ? 'This version aims for a more professional tone without adding details.'
        : 'This version aims to make the same details easier to follow.',
    confidence: 'medium',
    needsReview: true,
    status: 'suggested',
  }));
  return { ok: true, operation: 'improve_copy', mode: 'provider', suggestions };
}

async function installAxe(page) {
  const present = await page.evaluate(() => typeof window.axe !== 'undefined').catch(() => false);
  if (!present) await page.addScriptTag({ path: require.resolve('axe-core') });
}

async function scanAxe(page, selector, label) {
  await installAxe(page);
  const violations = await page.locator(selector).evaluate(async (root) => {
    const scan = await window.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return scan.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
  });
  result.axeViolations.push({ label, violations });
  assert(violations.length === 0, `${label} has zero WCAG 2.1 A/AA Axe violations`, violations);
}

async function clickConsent(page) {
  await page.locator('.ai-copy-panel .ai-copy-actions button').last().click();
  await page.getByRole('heading', { name: 'Before sending this text' }).waitFor();
}

async function sendWithMock(page, onRequest, responseFactory = successEnvelope) {
  await page.route('**/api/ai', async (route) => {
    const body = route.request().postDataJSON();
    onRequest(body);
    const responseBody = responseFactory(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseBody) });
  });
}

async function main() {
  browser = await chromium.launch({ headless: true });

  // About: keyboard access, consent opt-out, source-only request, dismiss, and explicit use.
  const about = await seededPage();
  let aboutRequests = 0;
  let aboutRequest = null;
  await sendWithMock(about.page, (body) => { aboutRequests += 1; aboutRequest = body; });
  const aboutTrigger = about.page.getByRole('button', { name: 'Improve About text' });
  await aboutTrigger.focus();
  await about.page.keyboard.press('Enter');
  await about.page.getByRole('heading', { name: 'Improve this about text' }).waitFor();
  const focusedRadio = await about.page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    type: document.activeElement?.getAttribute('type'),
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
    focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
  }));
  await about.page.keyboard.press('Tab');
  const afterTab = await about.page.evaluate(() => ({
    text: document.activeElement?.textContent?.trim(),
    focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
  }));
  const keyboardPass = focusedRadio.tag === 'INPUT' && focusedRadio.type === 'radio'
    && (afterTab.text === 'Cancel' || afterTab.text === 'Continue') && afterTab.focusVisible && afterTab.outlineWidth !== '0px';
  result.checks.keyboardFocus = keyboardPass;
  assert(keyboardPass, 'Improve action exposes keyboard navigation and a visible focus ring', { focusedRadio, afterTab });

  // Cancel at the consent gate. The form remains available and there is no API call.
  if (afterTab.text === 'Cancel') await about.page.keyboard.press('Tab');
  await about.page.keyboard.press('Enter');
  await about.page.getByRole('heading', { name: 'Before sending this text' }).waitFor();
  const consentCopy = await about.page.locator('.ai-copy-panel').innerText();
  await about.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await about.page.getByRole('heading', { name: 'Improve this about text' }).waitFor();
  await about.page.keyboard.press('Escape');
  await about.page.locator('.ai-copy-panel').waitFor({ state: 'detached' });
  const escapeFocus = await about.page.evaluate(() => ({
    label: document.activeElement?.getAttribute('aria-label'),
    expanded: document.activeElement?.getAttribute('aria-expanded'),
    focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
  }));
  result.checks.escapeRestoresFocus = escapeFocus.label === 'Improve About text' && escapeFocus.expanded === 'false' && escapeFocus.focusVisible;
  assert(result.checks.escapeRestoresFocus, 'Escape closes the consent/action panel and restores focus to its trigger', escapeFocus);
  result.checks.declineSendsNoRequest = aboutRequests === 0 && consentCopy.includes(SOURCE)
    && /configured AI provider/i.test(consentCopy) && /other profile details and design are not sent/i.test(consentCopy);
  assert(result.checks.declineSendsNoRequest, 'declining consent makes no request and identifies the exact text/data boundary', { aboutRequests, consentCopy });

  // Run the same action after fresh consent; mock the server response only.
  await aboutTrigger.focus();
  await about.page.keyboard.press('Enter');
  await about.page.getByRole('heading', { name: 'Improve this about text' }).waitFor();
  await clickConsent(about.page);
  await about.page.getByRole('button', { name: 'Send this text and generate' }).click();
  await about.page.getByRole('heading', { name: 'Suggested versions' }).waitFor();
  await scanAxe(about.page, '.ai-copy-results', 'About alternatives on desktop');
  const aboutBeforeApproval = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  const requestKeys = Object.keys(aboutRequest || {}).sort();
  const sourceOnly = aboutRequests === 1 && requestKeys.join(',') === 'action,operation,path,text'
    && aboutRequest?.operation === 'improve_copy' && aboutRequest?.path === 'basics.about'
    && aboutRequest?.text === SOURCE && aboutRequest?.action === 'clearer'
    && !JSON.stringify(aboutRequest).includes('private note') && !/API_KEY|x-goog-api-key|profile|design|projectId/i.test(JSON.stringify(aboutRequest));
  result.checks.aboutRequestSourceOnly = sourceOnly;
  assert(sourceOnly, 'About request contains only the selected text, action, and allowlisted target', { aboutRequests, aboutRequest });
  result.checks.originalUnchangedBeforeApproval = aboutBeforeApproval?.profile?.basics?.about === SOURCE;
  assert(result.checks.originalUnchangedBeforeApproval, 'original About remains unchanged before a decision', aboutBeforeApproval?.profile?.basics?.about);

  const firstAbout = about.page.locator('.ai-copy-option').nth(0);
  await firstAbout.getByRole('button', { name: 'Dismiss' }).click();
  await firstAbout.getByText('Dismissed').waitFor();
  const afterDismiss = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.dismissPreservesAbout = afterDismiss?.profile?.basics?.about === SOURCE;
  assert(result.checks.dismissPreservesAbout, 'dismissing an alternative does not modify About', afterDismiss?.profile?.basics?.about);

  const acceptedAboutText = ALTERNATIVES[1];
  await about.page.locator('.ai-copy-option').nth(1).getByRole('button', { name: 'Use this' }).click();
  await about.page.waitForFunction((value) => document.querySelector('#profile-about')?.value === value, acceptedAboutText);
  await about.page.waitForFunction(({ key, value }) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null')?.profile?.basics?.about === value; }
    catch { return false; }
  }, { key: STORAGE_KEY, value: acceptedAboutText });
  result.checks.acceptedAboutUsesNormalEditor = await about.page.locator('#profile-about').inputValue() === acceptedAboutText;
  assert(result.checks.acceptedAboutUsesNormalEditor, 'accepted About copy appears in the normal existing editor', acceptedAboutText);
  const aboutSaved = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.aboutDraftReload = aboutSaved?.profile?.basics?.about === acceptedAboutText
    && aboutSaved?.profile?.projects?.[0]?.description === SOURCE;
  assert(result.checks.aboutDraftReload, 'accepted About text is saved in the existing local draft schema', aboutSaved?.profile);
  await about.page.reload({ waitUntil: 'networkidle' });
  await about.page.getByRole('button', { name: /Continue draft/ }).click();
  await about.page.getByLabel('What should we call you?').waitFor();
  result.checks.aboutReloaded = await about.page.locator('#profile-about').inputValue() === acceptedAboutText;
  assert(result.checks.aboutReloaded, 'reload resumes with the explicitly chosen About version', await about.page.locator('#profile-about').inputValue());

  // Project: mobile display, a different action/target, explicit decision, and no horizontal overflow.
  await about.page.setViewportSize({ width: 390, height: 844 });
  await about.page.locator('.step-list .rail-step').nth(3).click();
  await about.page.locator('#project-description-qa-project-1').waitFor();
  let projectRequest = null;
  let projectRequests = 0;
  await sendWithMock(about.page, (body) => { projectRequests += 1; projectRequest = body; });
  await about.page.getByRole('button', { name: 'Improve project 1 description' }).click();
  await about.page.getByRole('heading', { name: 'Improve this project 1 description' }).waitFor();
  await about.page.getByLabel('Make more professional').check();
  await clickConsent(about.page);
  await about.page.getByRole('button', { name: 'Send this text and generate' }).click();
  await about.page.getByRole('heading', { name: 'Suggested versions' }).waitFor();
  await scanAxe(about.page, '.ai-copy-results', 'Project alternatives at 390px');
  const mobileMetrics = await about.page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  result.checks.mobileCopyNoOverflow = mobileMetrics.scrollWidth <= mobileMetrics.width;
  assert(result.checks.mobileCopyNoOverflow, 'project improvement UI has no horizontal overflow at 390px', mobileMetrics);
  result.checks.projectRequestSourceOnly = projectRequests === 1
    && Object.keys(projectRequest || {}).sort().join(',') === 'action,operation,path,text'
    && projectRequest?.operation === 'improve_copy' && projectRequest?.path === 'projects[0].description'
    && projectRequest?.text === SOURCE && projectRequest?.action === 'professional'
    && !/qa-project-1|private note|API_KEY|profile|design/i.test(JSON.stringify(projectRequest));
  assert(result.checks.projectRequestSourceOnly, 'project request includes only description, action, and bounded path; local project id stays local', { projectRequests, projectRequest });
  const projectBeforeApproval = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.projectOriginalUnchangedBeforeApproval = projectBeforeApproval?.profile?.projects?.[0]?.description === SOURCE;
  assert(result.checks.projectOriginalUnchangedBeforeApproval, 'project description remains unchanged before approval', projectBeforeApproval?.profile?.projects?.[0]?.description);

  const projectFirst = about.page.locator('.ai-copy-option').nth(0);
  await projectFirst.getByRole('button', { name: 'Dismiss' }).click();
  const projectAfterDismiss = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.rejectedProjectPreserves = projectAfterDismiss?.profile?.projects?.[0]?.description === SOURCE;
  assert(result.checks.rejectedProjectPreserves, 'rejected project alternative does not modify the project', projectAfterDismiss?.profile?.projects?.[0]?.description);

  const acceptedProjectText = ALTERNATIVES[1];
  await about.page.locator('.ai-copy-option').nth(1).getByRole('button', { name: 'Use this' }).click();
  await about.page.waitForFunction((value) => document.querySelector('#project-description-qa-project-1')?.value === value, acceptedProjectText);
  await about.page.waitForFunction(({ key, value }) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null')?.profile?.projects?.[0]?.description === value; }
    catch { return false; }
  }, { key: STORAGE_KEY, value: acceptedProjectText });
  result.checks.acceptedProjectUsesNormalEditor = await about.page.locator('#project-description-qa-project-1').inputValue() === acceptedProjectText;
  const acceptedProjectBundle = await about.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.projectFieldsPreserved = acceptedProjectBundle?.profile?.projects?.[0]?.id === 'qa-project-1'
    && acceptedProjectBundle?.profile?.projects?.[0]?.title === 'Small portfolio site'
    && acceptedProjectBundle?.profile?.projects?.[0]?.tools === 'React'
    && acceptedProjectBundle?.profile?.projects?.[0]?.link === 'example.com/demo';
  assert(result.checks.acceptedProjectUsesNormalEditor && result.checks.projectFieldsPreserved, 'accepted project text changes only the selected description', acceptedProjectBundle?.profile?.projects?.[0]);
  await about.page.reload({ waitUntil: 'networkidle' });
  const resumeAfterProjectReload = about.page.getByRole('button', { name: /Continue draft/ });
  await resumeAfterProjectReload.waitFor({ state: 'visible', timeout: 10000 });
  result.checks.mobileDraftResume = await resumeAfterProjectReload.isVisible();
  assert(result.checks.mobileDraftResume, 'saved drafts remain resumable from the 390px landing layout');
  await resumeAfterProjectReload.click();
  await about.page.locator('.step-list .rail-step').nth(3).click();
  await about.page.locator('#project-description-qa-project-1').waitFor();
  result.checks.projectReloaded = await about.page.locator('#project-description-qa-project-1').inputValue() === acceptedProjectText;
  assert(result.checks.projectReloaded, 'accepted project improvement resumes after reload', await about.page.locator('#project-description-qa-project-1').inputValue());

  // Edit is also a proposal: opening its textarea does not change the profile until Use edited version.
  const edited = await seededPage();
  await sendWithMock(edited.page, () => {});
  await edited.page.getByRole('button', { name: 'Improve About text' }).click();
  await edited.page.getByRole('heading', { name: 'Improve this about text' }).waitFor();
  await clickConsent(edited.page);
  await edited.page.getByRole('button', { name: 'Send this text and generate' }).click();
  await edited.page.getByRole('heading', { name: 'Suggested versions' }).waitFor();
  const editedOption = edited.page.locator('.ai-copy-option').nth(2);
  await editedOption.getByRole('button', { name: 'Edit' }).click();
  const editField = editedOption.getByLabel('Edit this version before using it');
  await editField.fill(ALTERNATIVES[2]);
  const aboutBeforeEditApproval = await edited.page.locator('#profile-about').inputValue();
  result.checks.editProposalRequiresApproval = aboutBeforeEditApproval === SOURCE && await editedOption.getByRole('button', { name: 'Use edited version' }).isVisible();
  assert(result.checks.editProposalRequiresApproval, 'editing an alternative leaves the profile unchanged until explicit Use edited version', { aboutBeforeEditApproval });
  await scanAxe(edited.page, '.ai-copy-results', 'Edited alternative form');
  await editedOption.getByRole('button', { name: 'Use edited version' }).click();
  await edited.page.waitForFunction((value) => document.querySelector('#profile-about')?.value === value, ALTERNATIVES[2]);
  result.checks.editedAboutApplied = await edited.page.locator('#profile-about').inputValue() === ALTERNATIVES[2]
    && (await editedOption.innerText()).includes('Edited and used');
  assert(result.checks.editedAboutApplied, 'explicitly approved edit appears in the normal About editor', await editedOption.innerText());
  await edited.context.close();

  // Production fixtures and the existing 22-style demo catalog remain unchanged.
  await about.page.goto(`${BASE_URL}/template-demos`, { waitUntil: 'networkidle' });
  const galleryCards = await about.page.locator('.qa-grid .qa-card').count();
  result.checks.templateDemosUnaffected = galleryCards === 22;
  assert(result.checks.templateDemosUnaffected, '/template-demos still renders all 22 styles', { galleryCards });
  await about.context.close();

  // Provider-unavailable fallback: decline first, then opt in to a mocked failure and continue editing normally.
  const fallback = await seededPage();
  let fallbackRequests = 0;
  await fallback.page.route('**/api/ai', async (route) => {
    fallbackRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable', message: 'Unavailable.', retryable: false } }) });
  });
  await fallback.page.getByRole('button', { name: 'Improve About text' }).click();
  await clickConsent(fallback.page);
  await fallback.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await fallback.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert(fallbackRequests === 0, 'manual opt-out has no request');
  await fallback.page.getByRole('button', { name: 'Improve About text' }).click();
  await clickConsent(fallback.page);
  await fallback.page.getByRole('button', { name: 'Send this text and generate' }).click();
  await fallback.page.getByRole('alert').filter({ hasText: /not available right now/i }).waitFor();
  await fallback.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await fallback.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const manualText = 'I am editing this About text manually after the provider is unavailable.';
  await fallback.page.locator('#profile-about').fill(manualText);
  await fallback.page.waitForFunction(({ key, value }) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null')?.profile?.basics?.about === value; }
    catch { return false; }
  }, { key: STORAGE_KEY, value: manualText });
  result.checks.unavailableManualFallback = fallbackRequests === 1
    && await fallback.page.locator('#profile-about').inputValue() === manualText;
  assert(result.checks.unavailableManualFallback, 'API unavailable leaves the ordinary About editor usable and local-save compatible', { fallbackRequests, value: await fallback.page.locator('#profile-about').inputValue() });
  await fallback.context.close();

  result.browserErrors = [...new Map(result.browserErrors.map((item) => [JSON.stringify(item), item])).values()];
  result.summary = {
    checksPassed: Object.values(result.checks).filter(Boolean).length,
    checksTotal: Object.keys(result.checks).length,
    axeViolations: result.axeViolations.reduce((count, item) => count + item.violations.length, 0),
    browserErrors: result.browserErrors.length,
    failedChecks: result.failedChecks.length,
  };
  fs.writeFileSync(path.join(process.cwd(), 'qa-7b-browser-regression.json'), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.failedChecks.length || result.browserErrors.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  try { await browser?.close(); } catch { /* preserve the failing harness output */ }
  process.exitCode = 1;
});
