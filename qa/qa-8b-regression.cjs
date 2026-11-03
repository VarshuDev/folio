const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8B',
  checks: {},
  browserErrors: [],
  axeViolations: [],
  failedChecks: [],
};

let browser;

function assert(condition, message, details) {
  if (!condition) {
    result.failedChecks.push({ message, details });
    console.error(`  FAIL: ${message}`, details || '');
  } else {
    console.log(`  PASS: ${message}`);
  }
}

function createBundle(name = 'Mira Rao QA', notes = 'Super private note that must never be public.') {
  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Full-stack Engineer',
        about: 'Building resilient web services and publishing architectures.',
        location: 'Bengaluru',
        originalNotes: notes,
      },
      education: { college: 'National Institute', degree: 'B.Tech', branch: 'Computer Science', gradYear: '2026', note: '' },
      skills: ['TypeScript', 'Next.js', 'PostgreSQL'],
      interests: ['Distributed Systems', 'Accessibility'],
      projects: [
        { id: 'proj-1', title: 'Edge Cache Gateway', description: 'Low latency edge cache for dynamic content.', tools: 'TypeScript, Redis', link: 'https://example.com/edge' }
      ],
      highlights: ['Lead maintainer for campus open source club'],
      activities: [],
      learning: 'Exploring formal verification',
      links: { email: 'mira@example.com', github: 'github.com/mirarao', linkedin: '', other: [] },
    },
    design: {
      templateId: 'swiss',
      templateVersion: 1,
      visibleSections: { about: true, education: true, skills: true, projects: true, highlights: true, contact: true },
      sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
    },
    updatedAt: new Date().toISOString(),
  };
}

async function installAxe(page) {
  const present = await page.evaluate(() => typeof window.axe !== 'undefined').catch(() => false);
  if (!present) {
    await page.addScriptTag({ path: require.resolve('axe-core') });
  }
}

async function scanAxe(page, selector, label) {
  await installAxe(page);
  const violations = await page.locator(selector).evaluate(async (root) => {
    const scan = await window.axe.run(root, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return scan.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      description: item.description,
      nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
  });
  result.axeViolations.push({ label, violations });
  assert(violations.length === 0, `${label} has 0 Axe WCAG 2.1 A/AA violations`, violations);
}

async function main() {
  console.log(`Starting Checkpoint 8B E2E Regression on ${BASE_URL} (run: ${RUN_ID})...\n`);
  browser = await chromium.launch({ headless: true, channel: 'chrome' });

  const slugA = `mira-${RUN_ID}`;
  const slugF = `retry-${RUN_ID}`;

  // ==========================================
  // Security Verification (API boundaries)
  // ==========================================
  console.log('\n--- Checking Security Boundaries ---');
  const secContext = await browser.newContext();
  const secPage = await secContext.newPage();
  
  // Unauthenticated publish
  const unauthPub = await secPage.request.post(`${BASE_URL}/api/portfolio/publish`, {
    data: { slug: 'test-unauth', profile: createBundle().profile, design: createBundle().design },
  });
  const unauthPubBody = await unauthPub.json();
  const pubNoStore = (unauthPub.headers()['cache-control'] || '').includes('no-store');
  result.checks.securityUnauthPublishRejected = unauthPub.status() === 401 && unauthPubBody.ok === false;
  assert(result.checks.securityUnauthPublishRejected, 'unauthenticated publish mutation returns 401', { status: unauthPub.status(), body: unauthPubBody });
  assert(pubNoStore, 'publish API response includes Cache-Control: no-store', { cacheControl: unauthPub.headers()['cache-control'] });

  // Unauthenticated unpublish
  const unauthUnpub = await secPage.request.post(`${BASE_URL}/api/portfolio/unpublish`, {});
  const unauthUnpubBody = await unauthUnpub.json();
  const unpubNoStore = (unauthUnpub.headers()['cache-control'] || '').includes('no-store');
  result.checks.securityUnauthUnpublishRejected = unauthUnpub.status() === 401 && unauthUnpubBody.ok === false;
  assert(result.checks.securityUnauthUnpublishRejected, 'unauthenticated unpublish mutation returns 401', { status: unauthUnpub.status(), body: unauthUnpubBody });
  assert(unpubNoStore, 'unpublish API response includes Cache-Control: no-store');
  await secContext.close();

  // ==========================================
  // FLOW A: First publish
  // ==========================================
  console.log('\n--- Flow A: First Publish ---');
  const contextA = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const pageA = await contextA.newPage();
  pageA.on('pageerror', (err) => result.browserErrors.push({ type: 'pageerror', message: err.message }));
  pageA.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('404') || text.includes('net::ERR_FAILED')) return;
      result.browserErrors.push({ type: 'console', message: text });
    }
  });

  const initialBundle = createBundle('Mira Rao QA', 'Secret notes that must never be published');
  await pageA.addInitScript(({ key, bundle }) => {
    localStorage.setItem(key, JSON.stringify(bundle));
  }, { key: STORAGE_KEY, bundle: initialBundle });

  await pageA.goto(BASE_URL, { waitUntil: 'networkidle' });
  await pageA.getByRole('button', { name: /Continue draft/ }).click();
  await pageA.getByLabel('What should we call you?').waitFor();

  // Wait for initial auto-save debounce to stabilize status
  await pageA.waitForTimeout(600);
  const initialStatus = await pageA.locator('.studio-center span:not(.save-dot)').innerText();
  result.checks.flowA_initialStatusUnpublished = initialStatus.includes('Not published');
  assert(result.checks.flowA_initialStatusUnpublished, 'studio displays "Not published" for initial draft', { initialStatus });

  // Open Publish Modal
  const publishHeaderBtn = pageA.locator('.studio-actions button').filter({ hasText: /Publish/ }).first();
  await publishHeaderBtn.click();
  await pageA.locator('.publish-modal').waitFor();
  result.checks.flowA_modalOpened = true;
  assert(result.checks.flowA_modalOpened, 'publish modal opens from studio header');

  // Authenticate in local dev mode
  const devAuthBtn = pageA.getByRole('button', { name: /Continue in Local Dev Mode/ });
  await devAuthBtn.click();
  await pageA.locator('#publish-slug-input').waitFor();
  result.checks.flowA_devAuthSucceeded = true;
  assert(result.checks.flowA_devAuthSucceeded, 'local dev mode authentication enables publish form');

  // Enter unique slug
  await pageA.locator('#publish-slug-input').fill(slugA);
  
  // Click publish now
  const publishSubmitBtn = pageA.getByRole('button', { name: /Publish now/ });
  await publishSubmitBtn.click();

  // Wait for success screen
  await pageA.getByRole('heading', { name: 'Your portfolio is live!' }).waitFor();
  result.checks.flowA_liveSuccessModal = true;
  assert(result.checks.flowA_liveSuccessModal, 'success confirmation screen displays "Your portfolio is live!"');

  // Verify returned URL link
  const liveLinkText = await pageA.locator('.publish-modal a').filter({ hasText: `/p/${slugA}` }).innerText();
  result.checks.flowA_publicUrlVerified = liveLinkText.includes(slugA);
  assert(result.checks.flowA_publicUrlVerified, 'modal displays verified public url', { liveLinkText });

  // Dismiss modal
  await pageA.getByRole('button', { name: 'Done' }).click();
  await pageA.locator('.publish-modal').waitFor({ state: 'hidden' });

  // Verify Studio status updated
  const postPublishStatus = await pageA.locator('.studio-center span:not(.save-dot)').innerText();
  result.checks.flowA_studioStatusPublished = postPublishStatus.includes(`Published · /p/${slugA}`);
  assert(result.checks.flowA_studioStatusPublished, 'studio displays published slug status', { postPublishStatus });

  // Header publish button now says "Published"
  const headerBtnAfterPublish = await pageA.locator('.studio-actions button').filter({ hasText: /Published/ }).count();
  result.checks.flowA_headerButtonPublished = headerBtnAfterPublish > 0;
  assert(result.checks.flowA_headerButtonPublished, 'header publish button updates to "Published"');

  // Verify public portfolio page renders
  const pubContextA = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const pubPageA = await pubContextA.newPage();
  const pubResA = await pubPageA.goto(`${BASE_URL}/p/${slugA}`, { waitUntil: 'networkidle' });
  assert(pubResA?.ok() && pubResA.status() === 200, 'public /p/[slug] responds with 200 OK', { status: pubResA?.status() });

  const pubHtmlA = await pubPageA.content();
  result.checks.flowA_publicContentRenders = pubHtmlA.includes('Mira Rao QA') && pubHtmlA.includes('Edge Cache Gateway');
  assert(result.checks.flowA_publicContentRenders, 'public portfolio renders creator name and projects');

  // Verify private notes are strictly absent
  const leaksNotes = pubHtmlA.includes('Secret notes that must never be published');
  result.checks.flowA_notesSanitized = !leaksNotes;
  assert(result.checks.flowA_notesSanitized, 'public portfolio strictly strips private originalNotes');
  await pubContextA.close();

  // ==========================================
  // FLOW B: Draft isolation
  // ==========================================
  console.log('\n--- Flow B: Draft Isolation ---');
  // In Studio pageA, modify name
  const nameInput = pageA.getByLabel('What should we call you?');
  await nameInput.fill('Mira Rao QA Edited');
  // Wait for auto-save debounce
  await pageA.waitForTimeout(600);

  // Check Studio status reports unpublished changes
  const statusAfterEdit = await pageA.locator('.studio-center span:not(.save-dot)').innerText();
  result.checks.flowB_studioReportsUnpublishedChanges = statusAfterEdit.includes('Draft has unpublished changes');
  assert(result.checks.flowB_studioReportsUnpublishedChanges, 'studio reports "Draft has unpublished changes"', { statusAfterEdit });

  const headerBtnUnpublishedChanges = await pageA.locator('.studio-actions button').filter({ hasText: /Publish updates/ }).count();
  result.checks.flowB_headerButtonPublishUpdates = headerBtnUnpublishedChanges > 0;
  assert(result.checks.flowB_headerButtonPublishUpdates, 'header button updates to "Publish updates"');

  // Verify live public page STILL shows the previous published snapshot!
  const pubContextB = await browser.newContext();
  const pubPageB = await pubContextB.newPage();
  await pubPageB.goto(`${BASE_URL}/p/${slugA}`, { waitUntil: 'networkidle' });
  const pubHtmlB = await pubPageB.content();
  result.checks.flowB_publicPageRetainsOldSnapshot = pubHtmlB.includes('Mira Rao QA') && !pubHtmlB.includes('Mira Rao QA Edited');
  assert(result.checks.flowB_publicPageRetainsOldSnapshot, 'live public portfolio retains original snapshot despite local draft edits');
  await pubContextB.close();

  // ==========================================
  // FLOW C: Republish
  // ==========================================
  console.log('\n--- Flow C: Republish ---');
  // Open publish updates
  await pageA.locator('.studio-actions button').filter({ hasText: /Publish updates/ }).first().click();
  await pageA.locator('.publish-modal').waitFor();

  // Modal displays update info
  await pageA.getByRole('heading', { name: 'Update published portfolio' }).waitFor();
  const republishBtn = pageA.locator('.publish-modal').getByRole('button', { name: /Publish updates/ });
  await republishBtn.click();

  // Wait for success screen
  await pageA.getByRole('heading', { name: 'Your portfolio is live!' }).waitFor();
  await pageA.locator('.publish-modal').getByRole('button', { name: 'Done' }).click();
  await pageA.locator('.publish-modal').waitFor({ state: 'hidden' });

  // Public portfolio now reflects the new snapshot
  const pubContextC = await browser.newContext();
  const pubPageC = await pubContextC.newPage();
  await pubPageC.goto(`${BASE_URL}/p/${slugA}`, { waitUntil: 'networkidle' });
  const pubHtmlC = await pubPageC.content();
  result.checks.flowC_publicPageReflectsNewSnapshot = pubHtmlC.includes('Mira Rao QA Edited');
  assert(result.checks.flowC_publicPageReflectsNewSnapshot, 'public portfolio reflects new snapshot after republish');
  await pubContextC.close();

  // ==========================================
  // FLOW D: Slug conflict
  // ==========================================
  console.log('\n--- Flow D: Slug Conflict (409) ---');
  const contextD = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const pageD = await contextD.newPage();
  const bundleD = createBundle('Second Creator QA', 'Second creator notes');
  await pageD.addInitScript(({ key, bundle }) => {
    localStorage.setItem(key, JSON.stringify(bundle));
  }, { key: STORAGE_KEY, bundle: bundleD });

  await pageD.goto(BASE_URL, { waitUntil: 'networkidle' });
  await pageD.getByRole('button', { name: /Continue draft/ }).click();
  await pageD.getByLabel('What should we call you?').waitFor();

  // Open Publish Modal
  await pageD.locator('.studio-actions button').filter({ hasText: /Publish/ }).first().click();
  await pageD.getByRole('button', { name: /Continue in Local Dev Mode/ }).click();
  await pageD.locator('#publish-slug-input').waitFor();

  // Try to use user A's slug
  await pageD.locator('#publish-slug-input').fill(slugA);
  await pageD.locator('.publish-modal').getByRole('button', { name: /Publish now/ }).click();

  // Expect conflict error in modal
  const conflictError = pageD.locator('.publish-modal').filter({ hasText: /already taken by another user/i });
  await conflictError.waitFor();
  result.checks.flowD_slugConflictHandled = true;
  assert(result.checks.flowD_slugConflictHandled, 'slug conflict displays clean user explanation (409 handled)');

  // Verify draft remains intact
  const savedBundleD = await pageD.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
  result.checks.flowD_draftPreserved = savedBundleD?.profile?.basics?.name === 'Second Creator QA';
  assert(result.checks.flowD_draftPreserved, 'creator draft preserved intact after conflict rejection');
  await contextD.close();

  // ==========================================
  // FLOW E: Unpublish
  // ==========================================
  console.log('\n--- Flow E: Unpublish ---');
  // Back in pageA
  await pageA.locator('.studio-actions button').filter({ hasText: /Published|Publish updates/ }).first().click();
  await pageA.locator('.publish-modal').waitFor();

  // Click Unpublish
  const unpublishBtn = pageA.locator('.publish-modal button').filter({ hasText: /Unpublish/ }).first();
  await unpublishBtn.click();

  // Explicit confirmation dialog must appear
  await pageA.getByRole('heading', { name: 'Unpublish your portfolio?' }).waitFor();
  result.checks.flowE_confirmationPrompt = true;
  assert(result.checks.flowE_confirmationPrompt, 'unpublish requires explicit confirmation prompt');

  // Confirm unpublish
  await pageA.locator('.publish-modal').getByRole('button', { name: 'Yes, unpublish' }).click();
  await pageA.locator('.publish-modal').waitFor({ state: 'hidden' });

  // Studio displays unpublished state
  await pageA.waitForTimeout(400);
  const statusAfterUnpublish = await pageA.locator('.studio-center span:not(.save-dot)').innerText();
  result.checks.flowE_studioShowsUnpublished = statusAfterUnpublish.includes('Not published');
  assert(result.checks.flowE_studioShowsUnpublished, 'studio status reverts to "Not published"', { statusAfterUnpublish });

  // Public route returns 404
  const pubContextE = await browser.newContext();
  const pubPageE = await pubContextE.newPage();
  const resE = await pubPageE.goto(`${BASE_URL}/p/${slugA}`, { waitUntil: 'networkidle' });
  result.checks.flowE_publicRouteReturns404 = resE?.status() === 404;
  assert(result.checks.flowE_publicRouteReturns404, 'unpublished portfolio returns HTTP 404', { status: resE?.status() });
  await pubContextE.close();

  // Creator's draft remains available in Studio
  const currentNameInEditor = await pageA.getByLabel('What should we call you?').inputValue();
  result.checks.flowE_draftPreserved = currentNameInEditor === 'Mira Rao QA Edited';
  assert(result.checks.flowE_draftPreserved, 'owner draft remains intact and editable after unpublish');

  // ==========================================
  // FLOW F: Failure recovery
  // ==========================================
  console.log('\n--- Flow F: Failure Recovery ---');
  // Try to publish again with slugF but simulate network failure
  await pageA.locator('.studio-actions button').filter({ hasText: /Publish/ }).first().click();
  await pageA.locator('.publish-modal').waitFor();
  await pageA.locator('#publish-slug-input').fill(slugF);

  // Intercept and fail the request
  await pageA.route('**/api/portfolio/publish', (route) => route.abort('failed'));
  await pageA.locator('.publish-modal').getByRole('button', { name: /Publish now/ }).click();

  // Error message appears
  const networkError = pageA.locator('.publish-modal').filter({ hasText: /network error occurred while publishing/i });
  await networkError.waitFor();
  result.checks.flowF_networkErrorHandled = true;
  assert(result.checks.flowF_networkErrorHandled, 'network failure safely caught with user-friendly retry message');

  // Publish button becomes usable again (not stuck in submitting)
  const retryBtn = pageA.locator('.publish-modal').getByRole('button', { name: /Publish now/ });
  const isEnabled = await retryBtn.isEnabled();
  result.checks.flowF_buttonReenabled = isEnabled;
  assert(result.checks.flowF_buttonReenabled, 'publish button re-enabled for retry after network failure');

  // Remove interception and retry
  await pageA.unroute('**/api/portfolio/publish');
  await retryBtn.click();
  await pageA.getByRole('heading', { name: 'Your portfolio is live!' }).waitFor();
  result.checks.flowF_retrySucceeded = true;
  assert(result.checks.flowF_retrySucceeded, 'retry publication succeeds without duplicate error');
  await pageA.locator('.publish-modal').getByRole('button', { name: 'Done' }).click();

  // ==========================================
  // FLOW G: Accessibility & Mobile Viewport
  // ==========================================
  console.log('\n--- Flow G: Accessibility & Mobile ---');
  // Re-open publish modal for accessibility audit
  await pageA.locator('.studio-actions button').filter({ hasText: /Published|Publish/ }).first().click();
  await pageA.locator('.publish-modal').waitFor();

  // Axe WCAG 2.1 A/AA check
  await scanAxe(pageA, '.publish-modal', 'Publish modal');
  result.checks.flowG_axeZeroViolations = result.axeViolations.every((v) => v.violations.length === 0);

  // Test Escape key dismissal
  await pageA.keyboard.press('Escape');
  await pageA.locator('.publish-modal').waitFor({ state: 'hidden' });
  result.checks.flowG_escapeDismissal = true;
  assert(result.checks.flowG_escapeDismissal, 'Escape key cleanly dismisses the publish modal');

  // Mobile viewport check (390px width)
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript(({ key, bundle }) => {
    localStorage.setItem(key, JSON.stringify(bundle));
  }, { key: STORAGE_KEY, bundle: initialBundle });

  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobilePage.getByRole('button', { name: /Continue draft/ }).click();
  await mobilePage.getByLabel('What should we call you?').waitFor();

  // Check no horizontal overflow in Studio on mobile
  const studioOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  result.checks.flowG_studioMobileNoOverflow = !studioOverflow;
  assert(result.checks.flowG_studioMobileNoOverflow, 'studio at 390px mobile viewport has zero horizontal overflow');

  // Check public portfolio at 390px mobile viewport
  await mobilePage.goto(`${BASE_URL}/p/${slugF}`, { waitUntil: 'networkidle' });
  const pubOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  result.checks.flowG_publicMobileNoOverflow = !pubOverflow;
  assert(result.checks.flowG_publicMobileNoOverflow, 'public portfolio at 390px mobile viewport has zero horizontal overflow');

  await mobileContext.close();
  await contextA.close();

  // Summary and output
  result.browserErrors = [...new Map(result.browserErrors.map((i) => [JSON.stringify(i), i])).values()];
  result.summary = {
    checksPassed: Object.values(result.checks).filter(Boolean).length,
    checksTotal: Object.keys(result.checks).length,
    axeViolations: result.axeViolations.reduce((c, i) => c + i.violations.length, 0),
    browserErrors: result.browserErrors.length,
    failedChecks: result.failedChecks.length,
  };

  fs.writeFileSync(path.join(process.cwd(), 'qa-8b-browser-regression.json'), JSON.stringify(result, null, 2));
  await browser.close();

  console.log('\n==========================================');
  console.log('CHECKPOINT 8B REGRESSION SUMMARY:');
  console.log(JSON.stringify(result.summary, null, 2));
  console.log('==========================================');

  if (result.failedChecks.length > 0 || result.browserErrors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  console.error('Test Harness Uncaught Error:', err);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});
