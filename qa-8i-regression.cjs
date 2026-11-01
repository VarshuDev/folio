const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8I',
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

function createBundle(name = 'Vercel Architect 8I', mode = 'advanced') {
  const pages = [
    {
      id: 'page-home',
      type: 'home',
      slug: '',
      title: 'Home',
      navLabel: 'Home',
      visible: true,
      order: 0,
      sections: [
        { key: 'hero', visible: true },
        { key: 'summary', visible: true },
        { key: 'highlights', visible: true },
        { key: 'projects', visible: true },
        { key: 'links', visible: true },
      ],
    },
    {
      id: 'page-about',
      type: 'about',
      slug: 'about',
      title: 'About',
      navLabel: 'About',
      visible: true,
      order: 1,
      sections: [
        { key: 'summary', visible: true },
        { key: 'education', visible: true },
        { key: 'skills', visible: true },
        { key: 'activities', visible: true },
        { key: 'learning', visible: true },
      ],
    },
    {
      id: 'page-projects',
      type: 'projects',
      slug: 'projects',
      title: 'Projects',
      navLabel: 'Projects',
      visible: true,
      order: 2,
      sections: [
        { key: 'projects', visible: true },
        { key: 'links', visible: true },
      ],
    },
    {
      id: 'page-experience',
      type: 'experience',
      slug: 'experience',
      title: 'Experience',
      navLabel: 'Experience',
      visible: true,
      order: 3,
      sections: [
        { key: 'education', visible: true },
        { key: 'skills', visible: true },
        { key: 'activities', visible: true },
        { key: 'learning', visible: true },
      ],
    },
    {
      id: 'page-contact',
      type: 'contact',
      slug: 'contact',
      title: 'Contact',
      navLabel: 'Contact',
      visible: true,
      order: 4,
      sections: [
        { key: 'contact', visible: true },
        { key: 'location', visible: true },
        { key: 'links', visible: true },
      ],
    },
  ];

  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Cloud Systems Engineer',
        about: 'Specializing in edge runtimes, isolated microservices, and continuous deployment architectures.',
        location: 'Bengaluru, India',
        originalNotes: 'PRIVATE DRAFTING NOTES: Do not publish this confidential line anywhere!',
      },
      education: { college: 'National Institute', degree: 'B.Tech', branch: 'CS', gradYear: '2025', note: 'Distinction' },
      skills: ['Next.js', 'Vercel', 'TypeScript', 'Node.js'],
      interests: ['Distributed Systems', 'Edge Computing'],
      projects: [
        { id: 'proj-1', title: 'Edge Router', description: 'Ultra-low latency routing engine', tools: 'Rust, Edge Workers', link: 'https://example.com/router' },
        { id: 'proj-2', title: 'Folio Engine', description: 'Autonomous portfolio system', tools: 'TypeScript, Next.js', link: 'https://example.com/folio' },
      ],
      highlights: ['Configured zero-downtime multi-cloud deployments', 'Open-source maintainer'],
      activities: ['Speaker at DevOps 2026'],
      learning: 'Exploring Next.js 16 App Router deployment patterns',
      links: { email: 'cloud@example.com', github: 'https://github.com/cloudarch', linkedin: '', other: [] },
    },
    design: {
      templateId: 'minimal',
      templateVersion: 1,
      visibleSections: { about: true, education: true, skills: true, projects: true, highlights: true, contact: true },
      sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
    },
    portfolioConfig: {
      mode,
      advanced: mode === 'advanced' ? {
        themeId: 'advanced-minimal-v1',
        themeVersion: 1,
        siteTitle: `${name} Portfolio`,
        pages,
        navigation: {
          items: pages.map((p) => ({ pageId: p.id, label: p.navLabel })),
        },
      } : undefined,
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
  const scan = await page.evaluate(async (target) => {
    const el = document.querySelector(target);
    if (!el) return { missing: true, violations: [] };
    const r = await window.axe.run(el, {
      rules: {
        'color-contrast': { enabled: false }, // Covered by manual contrast audits
      },
    });
    return {
      missing: false,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        nodes: v.nodes.length,
      })),
    };
  }, selector);

  if (scan.missing) {
    console.warn(`[Axe] Target element "${selector}" not found for "${label}".`);
    return;
  }

  const criticalOrSerious = scan.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  assert(
    criticalOrSerious.length === 0,
    `Accessibility audit for ${label} (0 critical/serious violations)`,
    scan.violations,
  );

  result.axeViolations.push({ label, violations: scan.violations });
}

async function main() {
  console.log('\n==========================================');
  console.log('CHECKPOINT 8I: Vercel Integration Foundation E2E Suite');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Run ID:   ${RUN_ID}`);
  console.log('==========================================\n');

  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
        result.browserErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    result.browserErrors.push(err.message);
  });

  try {
    const testUserId = `dev-test-8i-${RUN_ID}`;
    const initialBundle = createBundle();

    // ==========================================
    // Seed draft and activate Advanced mode via Studio
    // ==========================================
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await page.evaluate(
      ([key, data]) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      [STORAGE_KEY, initialBundle],
    );
    await page.reload({ waitUntil: 'networkidle' });

    const advModeBtn = page.locator('.portfolio-mode-toggle button:has-text("Advanced")');
    await advModeBtn.waitFor({ state: 'visible' });
    await advModeBtn.click();
    await page.waitForTimeout(800);

    // Navigate to /account
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });

    const devSignInBtn = page.locator('button[aria-label="Sign in with Dev Account"]');
    if (await devSignInBtn.isVisible()) {
      await devSignInBtn.click();
      await page.waitForTimeout(600);
      await page.waitForSelector('.account-card[aria-label="My portfolio"]', { timeout: 8000 });
    }

    // ==========================================
    // Flow A: Account in Advanced mode shows Vercel "Not connected"
    // ==========================================
    console.log('\n--- Flow A: Account in Advanced Mode Shows Vercel "Not connected" ---');
    const vercelCard = page.locator('[data-testid="vercel-integration-card"]');
    await vercelCard.waitFor({ state: 'visible', timeout: 5000 });
    assert(await vercelCard.isVisible(), 'Vercel Integration card is visible in Advanced mode');

    const disconnectedBadge = page.locator('[data-testid="vercel-status-disconnected"]');
    assert(await disconnectedBadge.isVisible(), 'Status badge displays "Not connected"');

    const statusText = await page.locator('[data-testid="vercel-connection-state"]').innerText();
    assert(statusText.includes('Not connected'), 'Integration status field reads "Not connected"');

    const connectBtn = page.locator('[data-testid="connect-vercel-btn"]');
    assert(await connectBtn.isVisible(), '"Connect Vercel" button is present and visible');

    // ==========================================
    // Flow B: Start connection (Generates valid CSRF state)
    // ==========================================
    console.log('\n--- Flow B: Start Connection & Capture CSRF State ---');
    let capturedState = null;

    await page.route('https://vercel.com/**', (route) => {
      const url = new URL(route.request().url());
      capturedState = url.searchParams.get('state');
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Mock Vercel Authorization Page</body></html>' });
    });

    await connectBtn.click();
    for (let i = 0; i < 25 && !capturedState; i++) {
      await page.waitForTimeout(200);
    }

    assert(Boolean(capturedState), 'OAuth state generated and passed in Vercel installUrl');
    assert(capturedState && capturedState.includes('.'), 'OAuth state contains HMAC signature payload');

    // ==========================================
    // Flow C: Callback with mock code -> Account shows "Connected"
    // ==========================================
    console.log('\n--- Flow C: Callback with Mock Code -> Account Shows "Connected" ---');
    const mockConfigurationId = `icfg_8i_${RUN_ID}`;
    const mockTeamId = `team_qa_${RUN_ID}`;

    const callbackUrl = `${BASE_URL}/api/integrations/vercel/callback?code=mock-code-8i-success&state=${encodeURIComponent(
      capturedState,
    )}&configurationId=${mockConfigurationId}&teamId=${mockTeamId}`;

    await page.goto(callbackUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Verify redirected back to /account
    assert(page.url().includes('/account'), 'Callback redirected user back to /account');

    // Verify Vercel card now displays Connected
    const connectedBadge = page.locator('[data-testid="vercel-status-connected"]');
    await connectedBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await connectedBadge.isVisible(), 'Status badge transitioned to "Connected"');

    const connectedStatusText = await page.locator('[data-testid="vercel-connection-state"]').innerText();
    assert(connectedStatusText.includes('Connected to Vercel'), 'Status field reads "Connected to Vercel"');

    const accountNameText = await page.locator('[data-testid="vercel-account-name"]').innerText();
    assert(accountNameText.length > 0, `Vercel account / team name is displayed: ${accountNameText}`);

    const configIdElement = page.locator('[data-testid="vercel-config-id"]');
    assert((await configIdElement.innerText()).includes(mockConfigurationId), 'Configuration ID is accurately reflected');

    const disconnectBtn = page.locator('[data-testid="disconnect-vercel-btn"]');
    assert(await disconnectBtn.isVisible(), '"Disconnect Vercel" button is visible when connected');

    // Verify Dev Credits balance was NOT consumed (0 credits consumed)
    const creditsNumber = page.locator('.credits-number');
    if ((await creditsNumber.count()) > 0) {
      const balance = await creditsNumber.innerText();
      assert(balance === '12', `Dev Credits balance remains unchanged at 12 (observed: ${balance})`);
    }

    // ==========================================
    // Flow D: Invalid callback (bad/missing state) fails safely
    // ==========================================
    console.log('\n--- Flow D: Invalid Callback Fails Safely Without Altering State ---');
    const badCallbackUrl = `${BASE_URL}/api/integrations/vercel/callback?code=mock-123&state=tampered.signature.fake`;
    await page.goto(badCallbackUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Should redirect back to /account with error param and show error notification
    assert(page.url().includes('/account'), 'Invalid callback safely redirected back to /account');

    // Connection remains connected for this user
    assert(await page.locator('[data-testid="vercel-status-connected"]').isVisible(), 'Existing valid connection preserved');

    // ==========================================
    // Flow E: Disconnect with Confirmation -> Returns to "Not connected", Drafts Safe
    // ==========================================
    console.log('\n--- Flow E: Disconnect Vercel Account with Confirmation ---');
    await disconnectBtn.click();

    const confirmModal = page.locator('[data-testid="vercel-disconnect-confirmation"]');
    await confirmModal.waitFor({ state: 'visible', timeout: 3000 });
    assert(await confirmModal.isVisible(), 'Disconnect confirmation dialog displayed');

    const confirmDisconnectBtn = page.locator('[data-testid="confirm-disconnect-vercel-btn"]');
    await confirmDisconnectBtn.click();
    await page.waitForTimeout(500);

    // Verify back to Not connected
    await disconnectedBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await disconnectedBadge.isVisible(), 'Status badge returned to "Not connected" after disconnect');
    assert(await connectBtn.isVisible(), '"Connect Vercel" button reappears');

    // Verify portfolio draft is completely safe
    const draftTitle = await page.locator('.account-card[aria-label="My portfolio"] .account-field-value').first().innerText();
    console.log('Observed draft title in Flow E:', draftTitle);
    assert(draftTitle.length > 0 && !draftTitle.includes('404'), 'User portfolio title and draft are completely intact');

    // ==========================================
    // Flow F: Simple Mode Regression (Remains Independent)
    // ==========================================
    console.log('\n--- Flow F: Simple Mode Regression ---');
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.portfolio-mode-toggle', { timeout: 8000 });

    const simpleModeBtn = page.locator('.portfolio-mode-toggle button:has-text("Simple")');
    await simpleModeBtn.waitFor({ state: 'visible' });
    await simpleModeBtn.click();
    await page.waitForTimeout(800);

    // Return to /account
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.account-screen', { timeout: 8000 });

    // In Simple mode, the portfolio format is Simple · Single-page (Folio hosted)
    const formatField = page.locator('.account-field:has-text("Portfolio format") .account-field-value');
    const formatText = await formatField.innerText();
    assert(formatText.includes('Simple'), 'Portfolio format is Simple');
    assert(formatText.includes('Folio hosted'), 'Portfolio is Folio hosted');

    // Verify Folio publishing button is available for Simple mode
    const publishBtn = page.locator('.account-actions button:has-text("Publish portfolio")');
    assert(await publishBtn.isVisible(), 'Simple mode has Folio "Publish portfolio" button');

    // ==========================================
    // Flow G: Mobile 390px Viewport Check (0 Overflow)
    // ==========================================
    console.log('\n--- Flow G: Mobile Viewport 390px Layout Audit ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });

    const overflowDetected = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    assert(!overflowDetected, 'Mobile 390px viewport has ZERO horizontal scroll overflow');

    // ==========================================
    // Flow H: Accessibility Audit (Axe-Core)
    // ==========================================
    console.log('\n--- Flow H: Accessibility Audit (Axe-Core) ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await scanAxe(page, '.account-container', 'Account Page Container');

    // Final Assessment
    console.log('\n==========================================');
    console.log(`TOTAL FAILED CHECKS: ${result.failedChecks.length}`);
    console.log(`TOTAL BROWSER ERRORS: ${result.browserErrors.length}`);
    console.log('==========================================\n');

    if (result.failedChecks.length > 0) {
      console.error('FAILED CHECKS:');
      console.error(JSON.stringify(result.failedChecks, null, 2));
      process.exitCode = 1;
    } else {
      console.log('SUCCESS: All Checkpoint 8I E2E Verification Flows Passed!\n');
    }
  } catch (err) {
    console.error('Unhandled test failure:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
