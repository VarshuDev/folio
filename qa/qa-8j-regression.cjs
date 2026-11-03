const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8J',
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

function createBundle(name = 'Vercel Deployment 8J', mode = 'advanced') {
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
        { key: 'activities', visible: true },
        { key: 'highlights', visible: true },
        { key: 'education', visible: true },
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
      ],
    },
  ];

  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Full-Stack Systems Engineer',
        about: 'Building multi-page high-performance web applications and deployments.',
        location: 'Bengaluru, India',
        originalNotes: 'Confidential private deployment notes that must never be uploaded or leaked.',
      },
      education: {
        college: 'National Institute of Technology',
        degree: 'Bachelor of Technology',
        branch: 'Computer Science',
        gradYear: '2026',
        note: 'Systems and Cloud Architecture Focus',
      },
      skills: ['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Vercel API'],
      interests: ['Distributed Systems', 'Cloud Compilers', 'Edge Computing'],
      projects: [
        {
          id: 'proj-1',
          title: 'Vercel Deployment Engine',
          description: 'Automated multi-page Next.js project generation, SHA1 file uploads, and Vercel REST deployments.',
          tools: 'TypeScript, Next.js, Vercel REST API',
          link: 'https://github.com/folio/deployment-engine',
        },
      ],
      highlights: ['Architected in-memory AST Next.js compilation engine', 'Zero security leaks in Vercel OAuth secrets'],
      activities: ['Open Source Contributor'],
      learning: 'WebAssembly runtimes and edge caching',
      links: {
        email: 'engineer@example.com',
        github: 'https://github.com/folio-engineer',
        linkedin: 'https://linkedin.com/in/folio-engineer',
        other: [],
      },
    },
    design: {
      templateId: 'minimal',
      templateVersion: 1,
      visibleSections: {
        about: true,
        education: true,
        skills: true,
        projects: true,
        highlights: true,
        contact: true,
      },
      sectionOrder: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'],
    },
    portfolioConfig: {
      mode,
      advanced: {
        siteTitle: `${name} Portfolio`,
        themeId: 'advanced-minimal-v1',
        themeVersion: 1,
        pages,
        navigation: {
          items: pages.map((p) => ({ pageId: p.id, label: p.navLabel, visible: p.visible })),
        },
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

async function runAxe(page, contextName) {
  try {
    const axePath = require.resolve('axe-core/axe.min.js');
    await page.addScriptTag({ path: axePath });
    const axeResults = await page.evaluate(async () => {
      // @ts-ignore
      return await window.axe.run({
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
      });
    });
    const severeViolations = axeResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (severeViolations.length > 0) {
      result.axeViolations.push({ context: contextName, violations: severeViolations });
      console.warn(`  [AXE] ${severeViolations.length} critical/serious violations in ${contextName}:`, JSON.stringify(severeViolations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.html) })), null, 2));
    } else {
      console.log(`  [AXE] Clean accessibility pass for ${contextName}`);
    }
  } catch (err) {
    console.warn(`  [AXE] Skipped in ${contextName}: ${err.message}`);
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(` Starting Checkpoint 8J Regression Suite (Vercel Engine)`);
  console.log(` Target Base URL: ${BASE_URL}`);
  console.log(` Run ID: ${RUN_ID}`);
  console.log(`======================================================\n`);

  const devUserId = `dev-user-8j-${RUN_ID}`;

  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addInitScript(({ userId }) => {
    window.sessionStorage.setItem('folio_dev_user', userId);
  }, { userId: devUserId });

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
    const initialBundle = createBundle('Vercel Architect 8J', 'advanced');

    // Pre-seed server draft for test user
    const seedRes = await fetch(`${BASE_URL}/api/portfolio/account`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${devUserId}`,
        'x-folio-test-user-id': devUserId,
      },
      body: JSON.stringify(initialBundle),
    });
    assert(seedRes.status === 200, 'Pre-seeded server draft for test user');

    // ==========================================
    // Seed draft and activate Advanced mode via Studio
    // ==========================================
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ([key, data, uid]) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem(key, JSON.stringify(data));
        window.sessionStorage.setItem('folio_dev_user', uid);
      },
      [STORAGE_KEY, initialBundle, devUserId],
    );
    await page.reload({ waitUntil: 'domcontentloaded' });

    const advModeBtn = page.locator('.portfolio-mode-toggle button:has-text("Advanced")');
    if (await advModeBtn.isVisible()) {
      await advModeBtn.click();
      await page.waitForTimeout(600);
    }

    // ==========================================
    // Dev Account Session on Account Page
    // ==========================================
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.account-card[aria-label="My portfolio"]', { timeout: 8000 });

    const authSession = {
      authHeader: `Bearer test-${devUserId}`,
      userId: devUserId,
      isSupabase: false,
    };
    console.log(`  [Auth Session] Resolved User ID: ${authSession.userId}`);

    // ==========================================
    // Flow A: Account in Advanced mode shows Vercel "Not connected"
    // ==========================================
    console.log('\n--- Flow A: Account in Advanced Mode Shows Vercel "Not connected" ---');
    const vercelCard = page.locator('[data-testid="vercel-integration-card"]');
    await vercelCard.waitFor({ state: 'visible', timeout: 5000 });
    assert(await vercelCard.isVisible(), 'Vercel Integration card is visible in Advanced mode');

    const disconnectedBadge = page.locator('[data-testid="vercel-status-disconnected"]');
    assert(await disconnectedBadge.isVisible(), 'Status badge displays "Not connected"');

    const connectBtn = page.locator('[data-testid="connect-vercel-btn"]');
    assert(await connectBtn.isVisible(), '"Connect Vercel" button is present and visible');

    // ==========================================
    // Flow B: Connect Vercel via Simulated Dev Connection
    // ==========================================
    console.log('\n--- Flow B: Connect Vercel via Simulated Dev Connection ---');
    const simulateDevBtn = page.locator('[data-testid="simulate-dev-connect-btn"]');
    assert(await simulateDevBtn.isVisible(), 'Simulate Dev Connection button is available in local test environment');
    await simulateDevBtn.click();

    const connectedBadge = page.locator('[data-testid="vercel-status-connected"]');
    await connectedBadge.waitFor({ state: 'visible', timeout: 8000 });
    assert(await connectedBadge.isVisible(), 'Status badge transitioned to "Connected"');

    const accountNameText = await page.locator('[data-testid="vercel-account-name"]').innerText();
    assert(accountNameText.length > 0, `Authorized Vercel account / team name displayed: ${accountNameText}`);

    // ==========================================
    // Flow C: Studio Deploy Modal Initiation
    // ==========================================
    console.log('\n--- Flow C: Studio Deploy Modal Initiation ---');
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'domcontentloaded' });

    const studioDeployBtn = page.locator('[data-testid="studio-deploy-btn"]');
    await studioDeployBtn.waitFor({ state: 'visible', timeout: 8000 });
    assert(await studioDeployBtn.isVisible(), 'Studio header presents active "Deploy to Vercel" button');

    await studioDeployBtn.click();

    const deployModal = page.locator('[data-testid="advanced-deploy-modal"]');
    await deployModal.waitFor({ state: 'visible', timeout: 5000 });
    assert(await deployModal.isVisible(), 'Advanced Deploy Modal opens');

    const triggerDeployBtn = page.locator('[data-testid="trigger-deploy-btn"]');
    await triggerDeployBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert(await triggerDeployBtn.isVisible(), 'Modal contains "Deploy to Vercel" trigger button');

    // ==========================================
    // Flow D: Deployment Pipeline Execution & Live URL
    // ==========================================
    console.log('\n--- Flow D: Deployment Pipeline Execution & Live URL ---');
    page.on('request', (req) => {
      if (req.url().includes('/api/portfolio/advanced/deploy')) {
        console.log(`  [Deploy Request Body]`, req.postData());
      }
    });
    page.on('response', async (res) => {
      if (res.url().includes('/api/portfolio/advanced')) {
        try {
          const body = await res.text();
          console.log(`  [API Response] ${res.status()} ${res.url()}: ${body}`);
        } catch {}
      }
    });
    await triggerDeployBtn.click();

    const successCard = page.locator('[data-testid="deploy-success-card"]');
    await successCard.waitFor({ state: 'visible', timeout: 15000 });
    assert(await successCard.isVisible(), 'Deployment finishes and renders success card');

    const liveUrlEl = page.locator('[data-testid="live-vercel-url"]');
    const liveUrl = await liveUrlEl.innerText();
    assert(liveUrl.includes('vercel.app'), `Live production URL is displayed: ${liveUrl}`);

    const deployProjectEl = page.locator('[data-testid="deploy-project-name"]');
    const deployedProjectName = await deployProjectEl.innerText();
    assert(deployedProjectName.length >= 3, `Vercel project name displayed: ${deployedProjectName}`);

    // ==========================================
    // Flow E: Account View Displays Live Deployment & Project Name
    // ==========================================
    console.log('\n--- Flow E: Account View Displays Live Deployment ---');
    await page.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });

    const accountProjectEl = page.locator('[data-testid="vercel-project-name"]');
    await accountProjectEl.waitFor({ state: 'visible', timeout: 5000 });
    const accountProjectName = await accountProjectEl.innerText();
    assert(accountProjectName.trim() === deployedProjectName.trim(), `Account displays linked project: ${accountProjectName}`);

    const accountDeployState = page.locator('[data-testid="vercel-deployment-state"]');
    const deployStateText = await accountDeployState.innerText();
    assert(deployStateText.includes('Live'), `Account displays Live deployment state: ${deployStateText}`);

    const accountLiveUrlEl = page.locator('[data-testid="advanced-live-url"]');
    assert(await accountLiveUrlEl.isVisible(), 'Account displays live production URL link');

    const accountViewLiveBtn = page.locator('[data-testid="account-view-live-btn"]');
    assert(await accountViewLiveBtn.isVisible(), 'Account displays "View live portfolio ↗" action');

    // ==========================================
    // Flow F: Redeployment & Project Reuse
    // ==========================================
    console.log('\n--- Flow F: Redeployment Flow & Project Reuse ---');
    const accountRedeployBtn = page.locator('[data-testid="account-vercel-deploy-btn"]');
    assert(await accountRedeployBtn.isVisible(), 'Account displays "Redeploy to Vercel" button');

    await accountRedeployBtn.click();
    const redeployModal = page.locator('[data-testid="advanced-deploy-modal"]');
    await redeployModal.waitFor({ state: 'visible', timeout: 5000 });

    const modalTriggerBtn = page.locator('[data-testid="trigger-deploy-btn"]');
    await modalTriggerBtn.click();

    await page.locator('[data-testid="deploy-success-card"]').waitFor({ state: 'visible', timeout: 15000 });
    const redeployedProjectName = await page.locator('[data-testid="deploy-project-name"]').innerText();
    assert(redeployedProjectName.trim() === deployedProjectName.trim(), 'Redeployment reuses the existing deterministic Vercel project');

    // ==========================================
    // Flow G: API Security & Cross-User Defense
    // ==========================================
    console.log('\n--- Flow G: API Security & Cross-User Defense ---');
    // 1. Unauthenticated request to /api/portfolio/advanced/deploy -> 401
    const unauthDeployRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(unauthDeployRes.status === 401, 'Unauthenticated deploy request rejected with 401');

    // 2. Unauthenticated request to /api/portfolio/advanced/deployment -> 401
    const unauthStatusRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deployment`, {
      method: 'GET',
    });
    assert(unauthStatusRes.status === 401, 'Unauthenticated deployment status request rejected with 401');

    const authHeaders = {
      Authorization: authSession.authHeader,
      ...(!authSession.isSupabase ? { 'x-folio-test-user-id': authSession.userId } : {}),
    };

    // 3. Forged owner in query param -> 403
    const crossUserDeployRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deploy?ownerId=victim-user`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert(crossUserDeployRes.status === 403, 'Cross-user deployment query parameter rejected with 403 Forbidden');

    // 4. Forged owner in body -> 403
    const forgedBodyDeployRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deploy`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ownerId: 'victim-user' }),
    });
    assert(forgedBodyDeployRes.status === 403, 'Cross-user deployment body payload rejected with 403 Forbidden');

    // ==========================================
    // Flow H: Zero Secret Leakage Verification
    // ==========================================
    console.log('\n--- Flow H: Zero Secret Leakage Verification ---');
    const statusApiRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deployment`, {
      headers: {
        ...authHeaders,
      },
    });
    const statusApiJson = await statusApiRes.text();
    assert(!statusApiJson.includes('accessToken'), 'Deployment status endpoint never leaks accessToken');
    assert(!statusApiJson.includes('client_secret'), 'Deployment status endpoint never leaks client_secret');
    assert(!statusApiJson.includes('token_type'), 'Deployment status endpoint never leaks token_type');

    const domContent = await page.content();
    assert(!domContent.includes('mock_vercel_token'), 'Client DOM never contains Vercel access token');

    // ==========================================
    // Flow I: Simple Mode Non-Regression & Dev Credits Isolation
    // ==========================================
    console.log('\n--- Flow I: Simple Mode Non-Regression & Credits Frozen ---');
    // Attempting to deploy a simple mode portfolio returns 422
    const simpleDeployRes = await fetch(`${BASE_URL}/api/portfolio/advanced/deploy`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profile: createBundle('Simple Candidate', 'simple').profile,
        config: { mode: 'simple' },
      }),
    });
    assert(simpleDeployRes.status === 422, 'Deploying simple mode portfolio rejected with 422 unsupported_mode');

    // Verify Dev Credits remain untouched (balance: 12, lifetimeUsed: 0)
    const creditsRes = await fetch(`${BASE_URL}/api/credits`, {
      headers: {
        ...authHeaders,
      },
    });
    const creditsData = await creditsRes.json();
    const balance = creditsData.account ? creditsData.account.balance : creditsData.balance;
    const lifetimeUsed = creditsData.account ? creditsData.account.lifetimeUsed : creditsData.lifetimeUsed;
    assert(balance === 12, 'Dev credits balance remains exactly 12 after deployments', balance);
    assert(lifetimeUsed === 0, 'Dev credits lifetimeUsed remains exactly 0 (deployments consume 0 credits)', lifetimeUsed);

    // ==========================================
    // Flow J: Mobile Viewport (390px) Layout & No Horizontal Overflow
    // ==========================================
    console.log('\n--- Flow J: Mobile Viewport (390px) Layout ---');
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    await ctxMobile.addInitScript(({ userId }) => {
      window.sessionStorage.setItem('folio_dev_user', userId);
    }, { userId: authSession.userId });
    const pageMobile = await ctxMobile.newPage();
    pageMobile.on('pageerror', (err) => result.browserErrors.push(err.message));

    await pageMobile.goto(`${BASE_URL}/account`, { waitUntil: 'domcontentloaded' });
    await pageMobile.evaluate(({ storageKey, bundle, userId }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(bundle));
      window.sessionStorage.setItem('folio_dev_user', userId);
    }, { storageKey: STORAGE_KEY, bundle: initialBundle, userId: authSession.userId });

    await pageMobile.reload({ waitUntil: 'domcontentloaded' });
    await pageMobile.waitForSelector('.account-card');

    const scrollWidth = await pageMobile.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await pageMobile.evaluate(() => document.documentElement.clientWidth);
    assert(scrollWidth <= clientWidth + 2, 'Mobile layout (390px) has zero horizontal overflow', { scrollWidth, clientWidth });

    // ==========================================
    // Flow K: Automated Accessibility (Axe-Core)
    // ==========================================
    console.log('\n--- Flow K: Automated Accessibility Pass ---');
    await runAxe(page, 'Account Page (Connected Vercel & Live Deployment)');

    assert(result.axeViolations.length === 0, 'Zero critical or serious Axe accessibility violations', result.axeViolations);

    console.log(`\n======================================================`);
    console.log(` Checkpoint 8J Regression Complete`);
    console.log(` Failed Checks: ${result.failedChecks.length}`);
    console.log(` Browser Errors: ${result.browserErrors.length}`);
    console.log(` Axe Violations: ${result.axeViolations.length}`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error(`FATAL Regression Runner Error:`, err);
    result.failedChecks.push({ message: 'Fatal suite execution crash', details: err.stack });
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const success = result.failedChecks.length === 0 && result.browserErrors.length === 0;
  if (!success) {
    console.error('FAILED QA-8J REGRESSION');
    process.exit(1);
  } else {
    console.log('ALL QA-8J REGRESSION CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

main();
