const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const result = { checkpoint: '7A', flows: {}, browserErrors: [], axeViolations: [], failedChecks: [] };

function assert(condition, message, details) {
  if (!condition) result.failedChecks.push({ message, details });
}

async function freshPastePage(browser, notes) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => result.browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') result.browserErrors.push(message.text()); });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Create my portfolio/ }).first().click();
  await page.getByRole('button', { name: /Paste rough notes/ }).click();
  if (notes) await page.getByRole('textbox', { name: 'Your notes' }).fill(notes);
  return { context, page };
}

function successResponse(suggestions, clarifyingQuestions = []) {
  return {
    ok: true,
    operation: 'extract_profile',
    mode: 'provider',
    suggestions,
    clarifyingQuestions,
  };
}

function mockSuggestion(id, pathName, proposedValue, excerpt, confidence = 'medium') {
  return {
    id,
    path: pathName,
    proposedValue,
    provenance: { status: 'exact', text: excerpt },
    reason: 'Compare this with the quoted note and check that it means what you intended.',
    confidence,
    needsReview: true,
    status: 'suggested',
  };
}

async function sendConsent(page) {
  await page.locator('form.intake-paste-card button[type="submit"]').click();
  await page.getByRole('heading', { name: 'Before we send your notes' }).waitFor();
  await page.getByRole('button', { name: 'Send notes for suggestions' }).click();
}

async function axeScan(page, label) {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const scan = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, description: violation.description, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
  });
  result.axeViolations.push({ label, violations: scan });
  return scan;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    // Flow A: explicit consent, sourceText-only request, three review decisions, and profile merge warnings.
    const contextA = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const pageA = await contextA.newPage();
    pageA.on('pageerror', (error) => result.browserErrors.push(error.message));
    pageA.on('console', (message) => { if (message.type() === 'error') result.browserErrors.push(message.text()); });
    await pageA.goto(BASE_URL, { waitUntil: 'networkidle' });
    await pageA.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await pageA.reload({ waitUntil: 'networkidle' });
    await pageA.getByRole('button', { name: /Create my portfolio/ }).first().click();
    await pageA.getByRole('button', { name: /Quick questions/ }).click();
    const quickSubmit = pageA.locator('form.intake-question-card button[type="submit"]');
    await pageA.getByRole('textbox', { name: 'Your name', exact: true }).fill('Mira Existing');
    await quickSubmit.click();
    await pageA.getByLabel('What are you exploring right now?').fill('Python and web development');
    await quickSubmit.click();
    await pageA.getByLabel('Tell us about something you made or tried').fill('Weather app. Built with Python.');
    await quickSubmit.click();
    await quickSubmit.click(); // Skip the optional proud-of item.
    await quickSubmit.click(); // Skip the optional participation item.
    await pageA.getByRole('textbox', { name: 'GitHub profile' }).fill('github.com/varshan');
    await quickSubmit.click();
    await pageA.getByRole('heading', { name: 'Here’s what you told us' }).waitFor();
    await pageA.getByRole('button', { name: 'Back to my answers' }).click();
    for (let index = 0; index < 6; index += 1) await pageA.getByRole('button', { name: /^Back$/ }).click();
    await pageA.getByRole('button', { name: /Paste rough notes/ }).click();

    const notesA = [
      'Name: Mira New',
      'Learning: Python, web development, Rust.',
      'Project: Weather app | Built with Python | Kotlin',
      'GitHub: https://github.com/varshan/',
    ].join('\n');
    await pageA.getByRole('textbox', { name: 'Your notes' }).fill(notesA);
    let requestCountA = 0;
    let requestBodyA = null;
    await pageA.route('**/api/ai', async (route) => {
      requestCountA += 1;
      requestBodyA = route.request().postDataJSON();
      const response = successResponse([
        mockSuggestion('name-1', 'basics.name', 'Mira New', 'Name: Mira New', 'high'),
        mockSuggestion('skill-1', 'skills', 'Rust', 'Rust.', 'medium'),
        mockSuggestion('project-1', 'projects', { title: 'Weather app', description: 'Built with Python', tools: 'Kotlin', link: '' }, 'Project: Weather app | Built with Python | Kotlin', 'medium'),
        mockSuggestion('interest-duplicate', 'interests', 'Python', 'Python', 'high'),
        mockSuggestion('github-duplicate', 'links.github', 'https://github.com/varshan/', 'https://github.com/varshan/', 'high'),
      ]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await pageA.locator('form.intake-paste-card button[type="submit"]').click();
    const beforeConsentCount = requestCountA;
    await pageA.getByRole('heading', { name: 'Before we send your notes' }).waitFor();
    await pageA.getByRole('button', { name: 'Send notes for suggestions' }).click();
    await pageA.getByRole('heading', { name: 'Here’s what I understood' }).waitFor();
    const aiCardsA = pageA.locator('.ai-suggestion-card');
    const cardCountA = await aiCardsA.count();
    const aiPanelTextA = await pageA.locator('.ai-suggestions-panel').innerText();
    const beforeDecision = await pageA.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
    const draftBeforeApproval = beforeDecision?.profile;

    // A new name conflicts with the existing one; the card must warn before explicit Keep.
    const nameCard = aiCardsA.filter({ hasText: 'Mira New' }).first();
    const nameWarnsBeforeReplace = await nameCard.getByText(/replace it/i).count() > 0;
    const nameBeforeKeep = draftBeforeApproval?.basics?.name;
    await nameCard.getByRole('button', { name: 'Keep', exact: true }).click();

    // Edit must save and keep a human-adjusted value inside the same review surface.
    const skillCard = pageA.locator('.ai-suggestion-card').filter({ hasText: 'Rust' }).first();
    await skillCard.getByRole('button', { name: 'Edit', exact: true }).click();
    await skillCard.locator('input').first().fill('Rust and C++');
    await skillCard.getByRole('button', { name: 'Save and keep' }).click();
    await pageA.waitForFunction((key) => {
      try { return JSON.parse(localStorage.getItem(key) || 'null')?.profile?.skills?.includes('Rust and C++'); }
      catch { return false; }
    }, STORAGE_KEY);

    // Remove dismisses the possible project duplicate without deleting the old project.
    const projectCard = pageA.locator('.ai-suggestion-card').filter({ hasText: 'Weather app' }).first();
    const projectWarning = await projectCard.getByText(/may be a project you already have/i).count() > 0;
    await projectCard.getByRole('button', { name: /Remove suggestion/ }).click();
    await pageA.getByRole('status').filter({ hasText: /Removed/ }).waitFor();

    const profileAfterDecisions = await pageA.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
    const finalProfileA = profileAfterDecisions?.profile;
    const sourceDetails = pageA.locator('[data-review-key="basics.name"] details.review-source');
    if (await sourceDetails.count()) await sourceDetails.locator('summary').click();
    const acceptedSource = await sourceDetails.count() ? await sourceDetails.innerText() : '';
    const axeA = await axeScan(pageA, 'flow A review at 1365px');

    // Also run the review layout at the required 390px mobile viewport.
    await pageA.setViewportSize({ width: 390, height: 844 });
    const mobileWidthA = await pageA.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    const axeMobileA = await axeScan(pageA, 'flow A review at 390px');
    result.flows.A = {
      passed: beforeConsentCount === 0 && requestCountA === 1 && Object.keys(requestBodyA || {}).sort().join(',') === 'operation,sourceText'
        && requestBodyA?.sourceText === notesA && cardCountA === 3 && /Already in your profile/.test(aiPanelTextA)
        && nameWarnsBeforeReplace && nameBeforeKeep === 'Mira Existing'
        && finalProfileA?.basics?.name === 'Mira New'
        && finalProfileA?.skills?.includes('Rust and C++')
        && finalProfileA?.projects?.length === 1
        && finalProfileA?.projects?.[0]?.title === 'Weather app.'
        && finalProfileA?.links?.github === 'github.com/varshan'
        && finalProfileA?.basics?.originalNotes === notesA && projectWarning
        && /Name: Mira New/.test(acceptedSource)
        && mobileWidthA.scrollWidth <= mobileWidthA.width && axeA.length === 0 && axeMobileA.length === 0,
      details: { requestCount: requestCountA, requestKeys: Object.keys(requestBodyA || {}), sourceMatches: requestBodyA?.sourceText === notesA, cardCount: cardCountA, alreadyPresent: /Already in your profile/.test(aiPanelTextA), nameWarnsBeforeReplace, nameBeforeKeep, projectWarning, finalName: finalProfileA?.basics?.name, finalSkills: finalProfileA?.skills, finalProject: finalProfileA?.projects?.[0], finalGitHub: finalProfileA?.links?.github, originalNotesMatch: finalProfileA?.basics?.originalNotes === notesA, acceptedSource, mobileWidth: mobileWidthA, axeDesktop: axeA.length, axeMobile: axeMobileA.length },
    };
    assert(result.flows.A.passed, 'A: consent-gated source-only request, conflict warning, Keep/Edit/Remove, and preserved original profile', result.flows.A.details);
    await contextA.close();

    // Flow B: explicit no-AI choice uses the existing deterministic/manual intake.
    const { context: contextB, page: pageB } = await freshPastePage(browser, 'Name: Manual Fallback\nLearning: HTML and CSS');
    let requestsB = 0;
    await pageB.route('**/api/ai', async (route) => { requestsB += 1; await route.fulfill({ status: 500, body: 'unexpected provider call' }); });
    await pageB.locator('form.intake-paste-card button[type="submit"]').click();
    await pageB.getByRole('button', { name: 'Continue without AI' }).click();
    await pageB.getByRole('heading', { name: 'Here’s what you told us' }).waitFor();
    const textB = await pageB.locator('.profile-review-screen').innerText();
    await pageB.locator('.review-original-notes summary').click();
    const originalB = await pageB.locator('.review-original-notes pre').innerText();
    result.flows.B = { passed: requestsB === 0 && /Manual Fallback/.test(textB) && originalB === 'Name: Manual Fallback\nLearning: HTML and CSS', details: { requests: requestsB, hasName: /Manual Fallback/.test(textB), originalPreserved: originalB } };
    assert(result.flows.B.passed, 'B: manual option sends no provider request and preserves pasted notes', result.flows.B.details);
    await contextB.close();

    // Flow C: provider-unavailable response preserves notes and offers manual fallback.
    const { context: contextC, page: pageC } = await freshPastePage(browser, 'Name: Failure Fallback\nLearning: Python');
    let requestsC = 0;
    await pageC.route('**/api/ai', async (route) => {
      requestsC += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'provider_failure', message: 'AI assistance is temporarily unavailable. Your notes are unchanged; continue manually.', retryable: true } }) });
    });
    await sendConsent(pageC);
    await pageC.getByRole('button', { name: 'Try again' }).click();
    await pageC.getByRole('heading', { name: 'Before we send your notes' }).waitFor();
    await pageC.getByRole('button', { name: 'Send notes for suggestions' }).click();
    const failureText = await pageC.locator('.ai-fallback-box [role="alert"]').innerText();
    await pageC.getByRole('button', { name: 'Continue manually' }).click();
    await pageC.getByRole('heading', { name: 'Here’s what you told us' }).waitFor();
    await pageC.locator('.review-original-notes summary').click();
    const originalC = await pageC.locator('.review-original-notes pre').innerText();
    result.flows.C = { passed: requestsC === 2 && /temporarily unavailable/i.test(failureText) && /continue manually/i.test(failureText) && originalC === 'Name: Failure Fallback\nLearning: Python', details: { requests: requestsC, failureText, originalPreserved: originalC } };
    assert(result.flows.C.passed, 'C: provider-unavailable failure retains notes and reaches manual review', result.flows.C.details);
    await contextC.close();

    // Flow D: an empty/poor-note response invites more detail or manual continuation.
    const { context: contextD, page: pageD } = await freshPastePage(browser, 'I like AI.');
    await pageD.route('**/api/ai', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(successResponse([], [{ question: 'What topic would you like to explore?', reason: 'The note is brief.', provenance: { status: 'exact', text: 'I like AI.' } }])) }));
    await sendConsent(pageD);
    const emptyText = await pageD.locator('.ai-empty-box').innerText();
    await pageD.getByRole('button', { name: 'Add more details' }).click();
    const notesBeforeEditD = await pageD.getByRole('textbox', { name: 'Your notes' }).inputValue();
    await pageD.getByRole('textbox', { name: 'Your notes' }).fill('I like AI. Learning Python.');
    await pageD.getByRole('button', { name: 'Skip for now' }).click();
    await pageD.getByRole('heading', { name: 'Here’s what you told us' }).waitFor();
    await pageD.locator('.review-original-notes summary').click();
    const originalD = await pageD.locator('.review-original-notes pre').innerText();
    result.flows.D = { passed: /couldn’t find much/i.test(emptyText) && /What topic would you like to explore/i.test(emptyText) && notesBeforeEditD === 'I like AI.' && originalD === 'I like AI. Learning Python.', details: { emptyText, notesBeforeEdit: notesBeforeEditD, originalAfterManual: originalD } };
    assert(result.flows.D.passed, 'D: poor-note response offers add-detail/manual path without losing notes', result.flows.D.details);
    await contextD.close();

    // Flow E: deterministic fixture results cannot appear as product AI output.
    const fixtureNotes = 'Name: Fixture Output Must Stay Hidden';
    const { context: contextE, page: pageE } = await freshPastePage(browser, fixtureNotes);
    await pageE.route('**/api/ai', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...successResponse([mockSuggestion('fixture-suggestion', 'basics.name', 'Fixture Output Must Stay Hidden', fixtureNotes)]),
      mode: 'fixture',
      notice: 'Development test fixture only — deterministic data, not AI output.',
      fixtureCase: 'test-only',
    }) }));
    await sendConsent(pageE);
    const fixtureVisible = await pageE.locator('.ai-suggestion-card').count();
    const fixtureMessage = await pageE.locator('.ai-fallback-box [role="alert"]').innerText();
    await pageE.getByRole('button', { name: 'Continue manually' }).click();
    result.flows.E = { passed: fixtureVisible === 0 && !/Fixture Output Must Stay Hidden/.test(fixtureMessage), details: { fixtureSuggestionCards: fixtureVisible, userMessage: fixtureMessage } };
    assert(result.flows.E.passed, 'E: fixture-mode payload is refused by the user-facing workflow', result.flows.E.details);
    await contextE.close();

    // Flow F: route remains disabled without server credentials and unsafe provider output is rejected server-side.
    const contextF = await browser.newContext();
    const responseF = await contextF.request.post(`${BASE_URL}/api/ai`, { data: { operation: 'extract_profile', sourceText: 'Name: Safety Check' } });
    const bodyF = await responseF.json();
    result.flows.F = { passed: responseF.status() === 503 && bodyF?.ok === false && bodyF?.error?.code === 'unavailable', details: { status: responseF.status(), code: bodyF?.error?.code } };
    assert(result.flows.F.passed, 'F: provider remains unavailable by default without an API key', result.flows.F.details);
    await contextF.close();

    // Flow G: unsupported model facts and duplicate/merge cases have automated unit coverage.
    const mergeTest = require('node:child_process').spawnSync('npm', ['run', 'test:ai'], { cwd: process.cwd(), encoding: 'utf8' });
    const mergeTestsPassed = mergeTest.status === 0 && /# pass \d+/.test(mergeTest.stdout) && /# fail 0/.test(mergeTest.stdout);
    result.flows.G = { passed: mergeTestsPassed && result.browserErrors.length === 0, details: { testExit: mergeTest.status, testSummary: mergeTest.stdout.match(/# tests .*\n# suites .*\n# pass .*\n# fail .*/)?.[0] || '', browserErrors: result.browserErrors } };
    assert(result.flows.G.passed, 'G: unit/regression suite and browser runtime have no failures', result.flows.G.details);

    result.summary = {
      passedFlows: Object.values(result.flows).filter((flow) => flow.passed).length,
      totalFlows: Object.keys(result.flows).length,
      axeViolations: result.axeViolations.reduce((count, item) => count + item.violations.length, 0),
      browserErrors: result.browserErrors.length,
      failedChecks: result.failedChecks.length,
    };
    fs.writeFileSync(path.join(process.cwd(), 'qa-7a-browser-regression.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.failedChecks.length || result.browserErrors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
