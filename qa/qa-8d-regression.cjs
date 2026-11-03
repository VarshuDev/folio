const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8D',
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

function createBundle(name = 'Dev Creator 8D') {
  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Interface Architect',
        about: 'Crafting thoughtful user workflows and calm creative interfaces.',
        location: 'Bengaluru',
        originalNotes: 'Private notes that must never be exposed publicly.',
      },
      education: { college: 'Design Institute', degree: 'B.Des', branch: 'Product', gradYear: '2026', note: '' },
      skills: ['TypeScript', 'Design Systems', 'Accessibility'],
      interests: ['Architecture', 'Typography'],
      projects: [],
      highlights: [],
      activities: [],
      learning: 'Exploring server-authoritative credit architecture',
      links: { email: 'creator@example.com', github: 'github.com/creator', linkedin: '', other: [] },
    },
    design: {
      templateId: 'editorial',
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
  console.log(`Starting Checkpoint 8D E2E Regression on ${BASE_URL} (run: ${RUN_ID})...\n`);
  browser = await chromium.launch({ headless: true, channel: 'chrome' });

  const testUserId = `user-8d-${RUN_ID}`;
  const slugD = `dev-creator-${RUN_ID}`;

  try {
    // ==========================================
    // 0. Dev Credits Server Authority & Isolation
    // ==========================================
    console.log('\n--- 0. Checking Dev Credits API & Boundaries ---');

    // Anonymous request to /api/credits
    const unauthCreditsRes = await fetch(`${BASE_URL}/api/credits`);
    assert(unauthCreditsRes.status === 401, 'unauthenticated credits access returns 401');

    // Authenticated request to /api/credits
    const authCreditsRes = await fetch(`${BASE_URL}/api/credits`, {
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(authCreditsRes.status === 200, 'authenticated credits access returns 200');
    const authCreditsJson = await authCreditsRes.json();
    assert(authCreditsJson.ok === true, 'credits response ok === true');
    assert(authCreditsJson.account.balance === 12, 'initial balance equals 12 credits default');
    assert(Array.isArray(authCreditsJson.transactions) && authCreditsJson.transactions.length >= 1, 'contains ledger transactions');
    assert(authCreditsJson.transactions[0].reason.includes('Initial dev credits grant'), 'first transaction is initial grant');

    // Cross-user access attempt
    const crossCreditsRes = await fetch(`${BASE_URL}/api/credits?userId=another-user-999`, {
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(crossCreditsRes.status === 403, 'cross-user query parameter on credits returns 403 forbidden');

    // Direct mutation rejection
    const postCreditsRes = await fetch(`${BASE_URL}/api/credits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(postCreditsRes.status === 405, 'POST to credits endpoint is rejected with 405 Method Not Allowed');

    const putCreditsRes = await fetch(`${BASE_URL}/api/credits`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(putCreditsRes.status === 405, 'PUT to credits endpoint is rejected with 405 Method Not Allowed');

    // ==========================================
    // 1. Flow A: Anonymous User on /account & /studio
    // ==========================================
    console.log('\n--- 1. Flow A: Anonymous User Experience ---');

    const anonContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const anonPage = await anonContext.newPage();
    anonPage.on('pageerror', (err) => result.browserErrors.push({ flow: 'Flow A', error: err.message }));

    await anonPage.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    const anonSignInTitle = await anonPage.locator('.account-card-title').first().textContent();
    assert(anonSignInTitle.includes('Sign in to manage your portfolio'), 'anonymous /account prompts sign in');

    // Verify Dev Credits card is NOT displayed when signed out
    const creditsCardCount = await anonPage.locator('section[aria-label="Dev Credits"]').count();
    assert(creditsCardCount === 0, 'Dev Credits card is hidden for unauthenticated visitors');

    await scanAxe(anonPage, '.account-screen', 'Anonymous /account');

    // Anonymous in Studio
    await anonPage.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await anonPage.waitForSelector('.studio-center');
    const studioStatus = await anonPage.locator('.studio-center').textContent();
    assert(studioStatus.includes('Saved on this device'), 'anonymous studio displays "Saved on this device"');

    // Verify empty state for projects (step 4, index 3)
    await anonPage.locator('.rail-step').nth(3).click();
    await anonPage.waitForTimeout(200);
    const emptyProjectText = await anonPage.locator('.empty-note').first().textContent();
    assert(emptyProjectText.includes('No projects yet'), 'projects section shows calm "No projects yet" empty state');

    // Verify empty state for links (step 5, index 4)
    await anonPage.locator('.rail-step').nth(4).click();
    await anonPage.waitForTimeout(200);
    const emptyLinksText = await anonPage.locator('.other-link-editor .empty-note').textContent();
    assert(emptyLinksText.includes('No extra links yet'), 'links section shows calm empty state');

    await scanAxe(anonPage, '.studio', 'Studio Shell');
    await anonContext.close();

    // ==========================================
    // 2. Flow B: Authenticated User & Dev Credits UI
    // ==========================================
    console.log('\n--- 2. Flow B: Authenticated User & Dev Credits UI ---');

    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const authPage = await authContext.newPage();
    authPage.on('pageerror', (err) => result.browserErrors.push({ flow: 'Flow B', error: err.message }));

    // Inject dev session and initial draft bundle
    await authPage.addInitScript(({ key, bundle, userId }) => {
      window.sessionStorage.setItem('folio_dev_user', userId);
      window.localStorage.setItem(key, JSON.stringify(bundle));
    }, { key: STORAGE_KEY, bundle: createBundle(), userId: testUserId });

    await authPage.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    await authPage.waitForSelector('section[aria-label="Dev Credits"]');

    // Verify Dev Credits Card presentation
    const devCreditsCard = authPage.locator('section[aria-label="Dev Credits"]');
    const creditsBalanceText = await devCreditsCard.locator('.credits-balance-row').textContent();
    assert(creditsBalanceText.includes('12') && creditsBalanceText.includes('credits'), 'displays 12 credits balance');

    const creditsExplText = await devCreditsCard.locator('.account-credits-display p').textContent();
    assert(creditsExplText.includes('no monetary value'), 'displays clear non-monetary explanation');

    const recentActivity = await devCreditsCard.locator('.credits-activity').textContent();
    assert(recentActivity.includes('Initial dev credits grant') && recentActivity.includes('+12'), 'displays initial grant activity entry');

    // Check strict absence of billing / pricing / monetary elements
    const pageText = await authPage.locator('.account-screen').textContent();
    assert(!pageText.includes('$') && !pageText.includes('₹') && !pageText.includes('€'), 'strictly zero currency symbols on account page');
    assert(!pageText.toLowerCase().includes('buy credits'), 'strictly no "Buy credits" option');
    assert(!pageText.toLowerCase().includes('upgrade'), 'strictly no "Upgrade" plan marketing');
    assert(!pageText.toLowerCase().includes('checkout'), 'strictly no checkout terminology');

    await scanAxe(authPage, '.account-screen', 'Authenticated /account with Dev Credits');

    // ==========================================
    // 3. Flow C: Landing Page Refinements
    // ==========================================
    console.log('\n--- 3. Flow C: Landing Page Refinements ---');

    const landingPage = await authContext.newPage();
    landingPage.on('pageerror', (err) => result.browserErrors.push({ flow: 'Flow C', error: err.message }));

    await landingPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const heroH1 = await landingPage.locator('.hero-copy h1').textContent();
    assert(heroH1.includes('Tell us about yourself. We’ll turn it into a professional portfolio.'), 'landing hero prominently states core promise');

    const primaryCTA = await landingPage.locator('.hero-actions .button').first().textContent();
    assert(primaryCTA.includes('Create my portfolio'), 'primary CTA is clearly visible');

    await scanAxe(landingPage, '.landing', 'Landing Page');

    // ==========================================
    // 4. Flow D: Mobile Viewport Checks (390px x 844px)
    // ==========================================
    console.log('\n--- 4. Flow D: Mobile Viewport (390px x 844px) Checks ---');

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('pageerror', (err) => result.browserErrors.push({ flow: 'Flow D', error: err.message }));

    // Mobile Landing
    await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const landingOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert(!landingOverflow, 'Landing page has 0 horizontal overflow at 390px width');

    // Mobile Account (Authenticated)
    await mobilePage.addInitScript(({ userId }) => {
      window.sessionStorage.setItem('folio_dev_user', userId);
    }, { userId: testUserId });

    await mobilePage.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
    await mobilePage.waitForSelector('section[aria-label="Dev Credits"]');

    const accountOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert(!accountOverflow, 'Account page has 0 horizontal overflow at 390px width');

    // Verify touch targets on Account
    const buttonHeights = await mobilePage.evaluate(() => {
      const buttons = [...document.querySelectorAll('.account-screen button, .account-screen a.button')];
      return buttons.map((b) => ({
        tag: b.tagName,
        text: b.textContent.trim(),
        height: b.getBoundingClientRect().height,
      }));
    });
    const subStandardButtons = buttonHeights.filter((b) => b.height < 40);
    assert(subStandardButtons.length === 0, 'Account action buttons meet touch target min-height >= 40-44px', subStandardButtons);

    // Mobile Studio
    await mobilePage.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await mobilePage.waitForSelector('.studio-bar');
    const studioOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert(!studioOverflow, 'Studio page has 0 horizontal overflow at 390px width');

    await mobileContext.close();

    // ==========================================
    // 5. Flow E: Publishing Lifecycle & Privacy Snapshot
    // ==========================================
    console.log('\n--- 5. Flow E: Publishing & Public Isolation ---');

    // Publish portfolio
    const publishRes = await fetch(`${BASE_URL}/api/portfolio/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        slug: slugD,
        profile: createBundle().profile,
        design: createBundle().design,
      }),
    });
    assert(publishRes.status === 200, 'portfolio published successfully');

    // Visit public route /p/[slug]
    const pubPage = await authContext.newPage();
    pubPage.on('pageerror', (err) => result.browserErrors.push({ flow: 'Flow E', error: err.message }));

    const pubRes = await pubPage.goto(`${BASE_URL}/p/${slugD}`, { waitUntil: 'networkidle' });
    assert(pubRes.status() === 200, 'public portfolio returns HTTP 200');

    const pubContent = await pubPage.content();
    assert(!pubContent.includes('Private notes that must never be exposed publicly'), 'public snapshot sanitizes originalNotes');
    assert(!pubContent.includes('Dev Credits'), 'public snapshot strictly isolates Dev Credits from public visitors');

    await scanAxe(pubPage, 'body', 'Public Portfolio /p/[slug]');
    await authContext.close();

    console.log('\n--- All Checkpoint 8D Regression Flows Completed Successfully! ---');
  } catch (err) {
    console.error('Fatal error during 8D regression:', err);
    result.failedChecks.push({ message: 'Fatal suite error', details: err.message });
  } finally {
    if (browser) await browser.close();
  }

  // Save results report
  fs.writeFileSync('qa-8d-browser-regression.json', JSON.stringify(result, null, 2));

  if (result.failedChecks.length > 0 || result.browserErrors.length > 0) {
    console.error(`\nFAILED: ${result.failedChecks.length} failed checks, ${result.browserErrors.length} browser errors.`);
    process.exit(1);
  } else {
    console.log('\nSUCCESS: 0 failed checks, 0 browser errors, 0 Axe violations.');
  }
}

main().catch((err) => {
  console.error('Unhandled script error:', err);
  process.exit(1);
});
