const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8F',
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

function createBundle(name = 'Mode Creator 8F') {
  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Systems Architect',
        about: 'Crafting thoughtful multi-page structures and calm creative systems.',
        location: 'Bengaluru',
        originalNotes: 'Private notes that must never be exposed publicly.',
      },
      education: { college: 'Design Institute', degree: 'B.Des', branch: 'Product', gradYear: '2026', note: '' },
      skills: ['TypeScript', 'Design Systems', 'Multi-Page Architecture'],
      interests: ['Architecture', 'Typography'],
      projects: [
        { id: 'proj-1', title: 'Solar Engine', description: 'Next-gen energy system', tools: 'Rust', link: 'https://example.com' },
      ],
      highlights: [],
      activities: [],
      learning: 'Exploring simple vs advanced portfolio modes',
      links: { email: 'creator@example.com', github: 'github.com/creator', linkedin: '', other: [] },
    },
    design: {
      templateId: 'minimal',
      templateVersion: 1,
      visibleSections: { about: true, education: true, skills: true, projects: true, highlights: true, contact: true },
      sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
    },
    portfolioConfig: {
      mode: 'simple',
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
  console.log(`Starting Checkpoint 8F E2E Regression on ${BASE_URL} (run: ${RUN_ID})...\n`);
  browser = await chromium.launch({ headless: true, channel: 'chrome' });

  const testUserId = `user-8f-${RUN_ID}`;
  const slugF = `mode-creator-${RUN_ID}`;

  try {
    // ==========================================
    // 0. Server API Protection & Persistence
    // ==========================================
    console.log('\n--- 0. Testing API Mode Contracts & Protection ---');

    // PUT advanced draft
    const advancedBundle = createBundle();
    advancedBundle.portfolioConfig = {
      mode: 'advanced',
      advanced: {
        themeId: 'advanced-minimal-v1',
        themeVersion: 1,
        pages: [
          { id: 'page-home', type: 'home', slug: '', title: 'Home', navLabel: 'Home', visible: true, order: 0 },
          { id: 'page-about', type: 'about', slug: 'about', title: 'About', navLabel: 'About', visible: true, order: 1 },
          { id: 'page-projects', type: 'projects', slug: 'projects', title: 'Projects', navLabel: 'Projects', visible: true, order: 2 },
          { id: 'page-experience', type: 'experience', slug: 'experience', title: 'Experience', navLabel: 'Experience', visible: true, order: 3 },
          { id: 'page-contact', type: 'contact', slug: 'contact', title: 'Contact', navLabel: 'Contact', visible: true, order: 4 },
        ],
        navigation: {
          items: [
            { pageId: 'page-home', label: 'Home', visible: true },
            { pageId: 'page-about', label: 'About', visible: true },
            { pageId: 'page-projects', label: 'Projects', visible: true },
            { pageId: 'page-experience', label: 'Experience', visible: true },
            { pageId: 'page-contact', label: 'Contact', visible: true },
          ],
        },
      },
    };

    const putRes = await fetch(`${BASE_URL}/api/portfolio/account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify(advancedBundle),
    });
    assert(putRes.status === 200, 'PUT /api/portfolio/account persists draft bundle');

    // GET account info to verify mode
    const getRes = await fetch(`${BASE_URL}/api/portfolio/account`, {
      headers: {
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
    });
    assert(getRes.status === 200, 'GET /api/portfolio/account succeeds');
    const accountData = await getRes.json();
    assert(accountData.portfolio.mode === 'advanced', 'GET reports portfolio.mode === "advanced"');
    assert(accountData.draft.portfolioConfig.mode === 'advanced', 'GET reports draft.portfolioConfig.mode === "advanced"');

    // Try to publish while in advanced mode
    const pubAdvRes = await fetch(`${BASE_URL}/api/portfolio/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        slug: slugF,
        profile: advancedBundle.profile,
        design: advancedBundle.design,
        mode: 'advanced',
      }),
    });
    assert(pubAdvRes.status === 422, 'POST /api/portfolio/publish in advanced mode is rejected with 422');
    const pubAdvData = await pubAdvRes.json();
    assert(pubAdvData.code === 'unsupported_mode', 'error code is unsupported_mode');

    // Revert draft to simple mode
    const simpleBundle = createBundle();
    const putSimpleRes = await fetch(`${BASE_URL}/api/portfolio/account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify(simpleBundle),
    });
    assert(putSimpleRes.status === 200, 'PUT /api/portfolio/account successfully reverts to simple');

    // Publish simple portfolio
    const pubSimpleRes = await fetch(`${BASE_URL}/api/portfolio/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        slug: slugF,
        profile: simpleBundle.profile,
        design: simpleBundle.design,
        mode: 'simple',
      }),
    });
    assert(pubSimpleRes.status === 200, 'POST /api/portfolio/publish succeeds for simple mode');

    // Verify public route renders
    const liveRes = await fetch(`${BASE_URL}/p/${slugF}`);
    assert(liveRes.status === 200, `Live public route /p/${slugF} renders 200`);
    const liveHtml = await liveRes.text();
    assert(liveHtml.includes('Mode Creator 8F'), 'Public page includes creator name');
    assert(!liveHtml.includes('Private notes'), 'Public page does not leak private draft notes');

    // ==========================================
    // 1. Studio UI Mode Switching & Verification
    // ==========================================
    console.log('\n--- 1. Testing Studio Mode Switching UI ---');
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        result.browserErrors.push({ url: page.url(), text: msg.text() });
      }
    });

    // Seed local storage with simple bundle
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ([key, data, uid]) => {
        window.localStorage.setItem(key, JSON.stringify(data));
        window.sessionStorage.setItem('folio_dev_user', uid);
      },
      [STORAGE_KEY, simpleBundle, testUserId]
    );

    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.portfolio-mode-toggle');

    // Verify mode toggle exists
    const modeToggle = page.locator('.portfolio-mode-toggle');
    assert(await modeToggle.isVisible(), 'Portfolio mode toggle is visible in Studio header');

    const simpleBtn = page.locator('.portfolio-mode-toggle button:has-text("Simple")');
    const advancedBtn = page.locator('.portfolio-mode-toggle button:has-text("Advanced")');
    assert(await simpleBtn.getAttribute('aria-checked') === 'true', 'Simple mode is initially active');

    // Verify preview canvas is visible in simple mode
    const previewCanvas = page.locator('.preview-column');
    assert(await previewCanvas.isVisible(), 'Live preview canvas is visible in Simple mode');

    // Switch to Advanced Mode
    console.log('Switching to Advanced Mode in Studio...');
    await advancedBtn.click();
    await page.waitForTimeout(300);

    assert(await advancedBtn.getAttribute('aria-checked') === 'true', 'Advanced mode is now active');

    // Verify Advanced Mode view renders (8F foundation or 8G workspace)
    const advWorkspace = page.locator('.advanced-foundation-container, .adv-workspace-container');
    assert(await advWorkspace.isVisible(), 'Advanced mode workspace container is visible');

    const is8G = (await page.locator('.adv-workspace-container').count()) > 0;
    if (is8G) {
      // 8G workspace: pages listed and deploy button disabled
      const pagesCount = await page.locator('.adv-page-tree-item').count();
      assert(pagesCount === 5, '5 canonical pages are listed in Pages tree');
      const deployBtn = page.locator('button:has-text("Deploy (coming next)")');
      assert(await deployBtn.isVisible(), 'Deploy (coming next) button is visible');
      assert(await deployBtn.isDisabled(), 'Deploy button is disabled');
      await scanAxe(page, '.adv-workspace-container', 'Advanced Workspace');
    } else {
      // 8F placeholder checks
      const advStatus = page.locator('.advanced-status-box');
      assert(await advStatus.isVisible(), 'Advanced status explanation is displayed');
      const statusText = await advStatus.textContent();
      assert(statusText.includes('Multi-page editing and Vercel deployment will be available in the next step'), 'Status explicitly notes next step for multi-page editing and Vercel');

      const preservedContentCard = page.locator('.advanced-summary-card:has-text("Preserved Profile Content")');
      assert(await preservedContentCard.isVisible(), 'Preserved Profile Content card is visible');

      const pagesMatrix = page.locator('.advanced-pages-matrix');
      assert(await pagesMatrix.isVisible(), 'Canonical pages matrix is visible');
      const rows = await page.locator('.advanced-pages-matrix .advanced-page-row').count();
      assert(rows === 5, '5 canonical pages are listed in pages matrix');

      const deployBtn = page.locator('button:has-text("Deploy (coming next)")');
      assert(await deployBtn.isVisible(), 'Deploy (coming next) button is visible');
      assert(await deployBtn.isDisabled(), 'Deploy button is disabled');
      await scanAxe(page, '.advanced-foundation-container', 'Advanced Foundation Container');
    }

    // Switch back to Simple Mode
    console.log('Switching back to Simple Mode in Studio...');
    await simpleBtn.click();
    await page.waitForTimeout(300);

    assert(await simpleBtn.getAttribute('aria-checked') === 'true', 'Simple mode is active again');
    assert(await previewCanvas.isVisible(), 'Live preview canvas is visible again');
    const publishBtn = page.locator('button:has-text("Publish")');
    assert(await publishBtn.isVisible(), 'Publish button is restored in Simple mode');

    // Verify form fields kept intact
    const nameInput = page.locator('input[value="Mode Creator 8F"]');
    assert(await nameInput.isVisible(), 'Profile name input is completely preserved');

    // ==========================================
    // 2. Mobile Responsive Studio Test (390x844)
    // ==========================================
    console.log('\n--- 2. Testing Mobile Viewport (390x844) ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);

    assert(await modeToggle.isVisible(), 'Mode toggle is visible on mobile');
    await advancedBtn.click();
    await page.waitForTimeout(300);
    const advWorkspaceMobile = page.locator('.advanced-foundation-container, .adv-workspace-container');
    assert(await advWorkspaceMobile.isVisible(), 'Advanced container renders cleanly on mobile');
    await scanAxe(page, '.studio-bar', 'Mobile Studio Bar');

    // Switch back to simple
    await simpleBtn.click();
    await page.waitForTimeout(200);

    // ==========================================
    // 3. Account Page Format & Action Display
    // ==========================================
    console.log('\n--- 3. Testing /account View Display ---');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Put draft in advanced mode locally and remotely
    const nowIso = new Date().toISOString();
    await page.evaluate(([key, now]) => {
      const draft = JSON.parse(window.localStorage.getItem(key));
      draft.portfolioConfig = { mode: 'advanced' };
      draft.updatedAt = now;
      window.localStorage.setItem(key, JSON.stringify(draft));
    }, [STORAGE_KEY, nowIso]);

    await fetch(`${BASE_URL}/api/portfolio/account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${testUserId}`,
        'x-folio-test-user-id': testUserId,
      },
      body: JSON.stringify({
        ...advancedBundle,
        portfolioConfig: { mode: 'advanced' },
        updatedAt: nowIso,
      }),
    });

    await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('section[aria-label="My portfolio"]');

    const formatField = page.locator('.account-field:has-text("Portfolio format")');
    assert(await formatField.isVisible(), 'Portfolio format field is visible on /account');
    const formatText = await formatField.textContent();
    assert(formatText.includes('Advanced'), 'Format field indicates Advanced');
    assert(formatText.includes('Multi-page (Vercel deployment)'), 'Format field explains Vercel deployment');

    const vercelComingBtn = page.locator('button:has-text("Vercel publish coming next")');
    assert(await vercelComingBtn.isVisible(), '"Vercel publish coming next" button is displayed');
    assert(await vercelComingBtn.isDisabled(), 'Button is disabled');

    // Run Axe on portfolio card
    await scanAxe(page, 'section[aria-label="My portfolio"]', 'Account Portfolio Card in Advanced Mode');

    await context.close();

    console.log('\n==========================================');
    console.log(`E2E Regression Finished. Total Failed Checks: ${result.failedChecks.length}`);
    console.log('==========================================');

    if (result.failedChecks.length > 0) {
      console.error('FAILED CHECKS DETAILS:');
      console.error(JSON.stringify(result.failedChecks, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error in regression suite:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
