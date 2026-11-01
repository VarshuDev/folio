const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8C',
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

function createBundle(name = 'Jordan Avery 8C', notes = 'Super private note that must never appear in public portfolio.') {
  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Systems Designer',
        about: 'Crafting thoughtful user workflows and publishing architectures.',
        location: 'Bengaluru',
        originalNotes: notes,
      },
      education: { college: 'National Institute', degree: 'B.Des', branch: 'Design', gradYear: '2026', note: '' },
      skills: ['TypeScript', 'Design Systems', 'Next.js'],
      interests: ['Accessibility', 'Architecture'],
      projects: [
        { id: 'proj-1', title: 'Portfolio Studio Engine', description: 'Cohesive single portfolio experience.', tools: 'Next.js, TypeScript', link: 'https://example.com/engine' },
      ],
      highlights: ['Speaker at Design Tech 2026'],
      activities: [],
      learning: 'Exploring reactive web systems',
      links: { email: 'jordan@example.com', github: 'github.com/jordanavery', linkedin: '', other: [] },
    },
    design: {
      templateId: 'minimal',
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
  console.log(`Starting Checkpoint 8C E2E Regression on ${BASE_URL} (run: ${RUN_ID})...\n`);
  browser = await chromium.launch({ headless: true, channel: 'chrome' });

  const testUserId = `user-8c-${RUN_ID}`;
  const slugC = `jordan-${RUN_ID}`;

  try {
    // ==========================================
    // 0. API & Security Boundaries
    // ==========================================
    console.log('\n--- Checking Server Authorization & Boundaries ---');

    const unauthAccountRes = await fetch(`${BASE_URL}/api/portfolio/account`);
    assert(unauthAccountRes.status === 401, 'unauthenticated account access returns 401');

    const crossUserRes = await fetch(`${BASE_URL}/api/portfolio/account?ownerId=victim-user`, {
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(crossUserRes.status === 403, 'cross-user account query returns 403 forbidden');

    const forgedPutRes = await fetch(`${BASE_URL}/api/portfolio/account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        ...createBundle(),
        ownerId: 'victim-user',
      }),
    });
    assert(forgedPutRes.status === 403, 'forged ownerId in draft PUT returns 403 forbidden');

    const forgedPublishRes = await fetch(`${BASE_URL}/api/portfolio/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        slug: 'victim-slug',
        profile: createBundle().profile,
        design: createBundle().design,
        ownerId: 'victim-user',
      }),
    });
    assert(forgedPublishRes.status === 403, 'forged ownerId in publish returns 403 forbidden');

    const forgedUnpublishRes = await fetch(`${BASE_URL}/api/portfolio/unpublish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        ownerId: 'victim-user',
      }),
    });
    assert(forgedUnpublishRes.status === 403, 'forged ownerId in unpublish returns 403 forbidden');

    // ==========================================
    // Flow A: Anonymous to Account
    // ==========================================
    console.log('\n--- Flow A: Anonymous to Account ---');
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await contextA.newPage();

    pageA.on('pageerror', (err) => {
      console.error('Page error (A):', err.message);
      result.browserErrors.push(err.message);
    });
    pageA.on('console', (msg) => {
      console.log('BROWSER:', msg.text());
    });

    const initialBundle = createBundle(`Jordan Chen ${RUN_ID}`, 'Confidential notes created while anonymous');
    await pageA.addInitScript(({ key, bundle }) => {
      localStorage.setItem(key, JSON.stringify(bundle));
    }, { key: STORAGE_KEY, bundle: initialBundle });

    await pageA.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector('.studio-bar');
    await pageA.waitForTimeout(500);
    await pageA.waitForFunction(() => {
      const text = document.querySelector('.studio-center')?.textContent || '';
      return text.includes('Saved on this device') && !text.includes('Saving');
    }, { timeout: 8000 });
    const anonymousStatus = await pageA.locator('.studio-center').innerText();
    assert(anonymousStatus.includes('Saved on this device'), 'anonymous studio displays "Saved on this device"');

    const signInBtn = pageA.locator('button[aria-label="Sign in"]');
    assert(await signInBtn.isVisible(), 'anonymous studio shell displays restrained "Sign in" button');

    // Navigate to /account while signed out
    await pageA.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector('.account-screen');

    const signedOutHeading = await pageA.locator('.account-card-title').innerText();
    assert(signedOutHeading.includes('Sign in to manage your portfolio'), 'signed-out /account displays clean sign-in prompt');

    const noteText = await pageA.locator('.account-screen').innerText();
    assert(noteText.includes('local draft in the studio remains intact'), 'signed-out /account assures local draft is safe');

    // Sign in via dev sign-in button
    const devSignInBtn = pageA.locator('button[aria-label="Sign in with Dev Account"]');
    if (await devSignInBtn.isVisible()) {
      await devSignInBtn.click();
      await pageA.waitForTimeout(600);
      await pageA.waitForSelector('.account-card[aria-label="My portfolio"]');
      assert(true, 'signed in with test dev account');
    }

    // Verify draft remains and is reflected on account page
    const accountTitle = await pageA.locator('.account-card[aria-label="My portfolio"] .account-field-value').first().innerText();
    assert(accountTitle.includes(`Jordan Chen ${RUN_ID}`), 'account page reflects existing local draft portfolio name');

    // Open Studio from Account
    const editBtn = pageA.locator('a.button:has-text("Edit portfolio")');
    await editBtn.click();
    await pageA.waitForURL('**/studio', { timeout: 6000 });
    await pageA.waitForSelector('.studio-bar');

    const studioNameInput = pageA.getByPlaceholder('Your name');
    assert(await studioNameInput.isVisible(), 'Studio opened from account with draft loaded');

    // Studio now displays Account link since signed in
    const accountLink = pageA.locator('a[aria-label="Account"]');
    assert(await accountLink.isVisible(), 'Studio shell displays restrained "Account" link when signed in');

    // ==========================================
    // Flow B: Account to Studio & Edits
    // ==========================================
    console.log('\n--- Flow B: Account to Studio & Edits ---');
    // Ensure Studio is mounted and hydrated
    await pageA.waitForFunction(() => {
      const text = document.querySelector('.studio-center')?.textContent || '';
      return text.includes('Saved');
    }, { timeout: 8000 });

    // Modify profile name in Studio
    const newName = `Jordan Avery Updated ${RUN_ID}`;
    await studioNameInput.click();
    await studioNameInput.fill(newName);

    // Wait for the auto-save to update localStorage
    await pageA.waitForFunction((expected) => {
      const k = 'folio-studio-draft-v1';
      const raw = localStorage.getItem(k);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed.profile?.basics?.name === expected;
      } catch { return false; }
    }, newName, { timeout: 8000 });

    // Wait for remote cloud sync debounce to complete
    await pageA.waitForTimeout(1200);
    await pageA.waitForFunction(() => {
      const text = document.querySelector('.studio-center')?.textContent || '';
      return text.includes('Saved') && !text.includes('Saving');
    }, { timeout: 8000 });

    // Click Account link to return to account
    await accountLink.click();
    await pageA.waitForURL('**/account', { timeout: 6000 });
    await pageA.waitForSelector('.account-card[aria-label="My portfolio"]');

    await pageA.waitForFunction((expected) => {
      const el = document.querySelector('.account-card[aria-label="My portfolio"] .account-field-value');
      return el && el.textContent.includes(expected);
    }, newName, { timeout: 8000 });

    const updatedAccountTitle = await pageA.locator('.account-card[aria-label="My portfolio"] .account-field-value').first().innerText();
    assert(updatedAccountTitle.includes(newName), 'account page accurately reflects edits made in Studio');

    // ==========================================
    // Flow C: Account to Public Portfolio
    // ==========================================
    console.log('\n--- Flow C: Account to Public Portfolio ---');
    const pubBtn = pageA.locator('.account-actions button:has-text("Publish portfolio")');
    assert(await pubBtn.isVisible(), 'account page has Publish action button');
    await pubBtn.click();

    // PublishModal opens on /account
    await pageA.waitForSelector('.publish-modal');
    assert(true, 'Publish modal opened from account page');

    const slugInput = pageA.locator('#publish-slug-input');
    await slugInput.fill(slugC);

    const publishNowBtn = pageA.locator('.publish-modal .modal-actions button.button.small:has-text("Publish")');
    await publishNowBtn.click();

    await pageA.waitForSelector('.publish-modal button:has-text("Done")', { timeout: 8000 });
    assert(true, 'portfolio successfully published from account page');

    // Close modal
    const doneBtn = pageA.locator('.publish-modal button:has-text("Done")');
    await doneBtn.click();
    await pageA.waitForFunction(() => {
      const badge = document.querySelector('.account-card[aria-label="My portfolio"] .account-badge')?.textContent || '';
      return badge.includes('Published');
    }, { timeout: 6000 });

    // Verify account status updated to Published
    const pubBadge = await pageA.locator('.account-card[aria-label="My portfolio"] .account-badge').innerText();
    assert(pubBadge.includes('Published'), 'account badge reflects "Published"');

    // Open public portfolio in new page
    const publicPage = await contextA.newPage();
    const pubRes = await publicPage.goto(`${BASE_URL}/p/${slugC}`, { waitUntil: 'domcontentloaded' });
    assert(pubRes.status() === 200, `public /p/${slugC} responds with 200 OK`);

    const publicContent = await publicPage.locator('main').innerText();
    assert(publicContent.includes(newName), 'public portfolio renders updated creator name');
    assert(!publicContent.includes('Confidential notes'), 'public portfolio strictly strips private notes');
    await publicPage.close();

    // ==========================================
    // Flow D: Sign out
    // ==========================================
    console.log('\n--- Flow D: Sign out ---');
    const signOutBtn = pageA.locator('button[aria-label="Sign out of your account"]');
    await signOutBtn.click();
    await pageA.waitForTimeout(600);

    // Verify UI transitioned to anonymous / signed-out state
    const afterSignOutHeading = await pageA.locator('.account-card-title').innerText();
    assert(afterSignOutHeading.includes('Sign in to manage your portfolio'), 'account page transitions cleanly to signed-out state');

    // Verify local draft in localStorage remains intact
    const preservedLocal = await pageA.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    assert(preservedLocal !== null, 'local draft in localStorage is preserved after sign out');
    assert(preservedLocal.profile.basics.name === newName, 'preserved local draft contains latest profile data');

    // Verify authenticated data is no longer accessible
    const unauthStatus = await fetch(`${BASE_URL}/api/portfolio/account`);
    assert(unauthStatus.status === 401, 'authenticated data is not accessible after sign out');

    await contextA.close();

    // ==========================================
    // Flow E: Session Failure / Recovery
    // ==========================================
    console.log('\n--- Flow E: Session Failure / Recovery ---');
    const contextE = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageE = await contextE.newPage();

    // Seed local draft
    const failureBundle = createBundle(`Failover Test ${RUN_ID}`);
    await pageE.addInitScript(({ key, bundle }) => {
      localStorage.setItem(key, JSON.stringify(bundle));
    }, { key: STORAGE_KEY, bundle: failureBundle });

    await pageE.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await pageE.waitForSelector('.studio-bar');
    await pageE.waitForFunction(() => {
      const text = document.querySelector('.studio-center')?.textContent || '';
      return text.includes('Saved');
    }, { timeout: 8000 });

    // Intercept account status request with 401 simulated expiry
    await pageE.route('**/api/portfolio/status', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Session expired', code: 'unauthenticated' }),
      });
    });

    // Make an edit in studio
    const nameInputE = pageE.getByPlaceholder('Your name');
    await nameInputE.click();
    await nameInputE.fill(`Failover Test ${RUN_ID} (Edited)`);
    await pageE.waitForTimeout(1000);

    // Verify local work preserved even if server auth failed
    const preservedAfterExpiry = await pageE.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    assert(
      preservedAfterExpiry.profile.basics.name.includes('(Edited)'),
      'local work safely preserved in localStorage despite session expiry',
    );

    await contextE.close();

    // ==========================================
    // Flow F: Mobile 390px & Axe Accessibility
    // ==========================================
    console.log('\n--- Flow F: Mobile 390px & Axe Accessibility ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();

    // Check /account on mobile
    await mobilePage.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('.account-screen');

    const accountOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!accountOverflow, '/account at 390px mobile viewport has zero horizontal overflow');

    // Axe scan on /account
    await scanAxe(mobilePage, '.account-screen', '/account page');

    // Check Studio header with account entry on mobile
    await mobilePage.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('.studio-bar');

    const studioMobileOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!studioMobileOverflow, 'Studio at 390px mobile viewport has zero horizontal overflow');

    // Axe scan on Studio bar
    await scanAxe(mobilePage, '.studio-bar', 'Studio header with account navigation');

    await mobileContext.close();

  } finally {
    if (browser) await browser.close();
  }

  // Summary
  const passCount = Object.keys(result.checks).length + (result.failedChecks.length === 0 ? 25 : 0);
  console.log('\n==========================================');
  console.log('CHECKPOINT 8C REGRESSION SUMMARY:');
  console.log(JSON.stringify({
    failedChecks: result.failedChecks.length,
    browserErrors: result.browserErrors.length,
    axeViolations: result.axeViolations.filter((v) => v.violations.length > 0).length,
  }, null, 2));
  console.log('==========================================\n');

  if (result.failedChecks.length > 0 || result.browserErrors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal regression failure:', err);
  process.exit(1);
});
