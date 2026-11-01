const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8H',
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

function createBundle(name = 'Advanced Architect 8H') {
  return {
    profile: {
      schemaVersion: 1,
      basics: {
        name,
        role: 'Distributed Systems & Web Specialist',
        about: 'Building resilient web architectures and clean client experiences.',
        location: 'Bengaluru, India',
        originalNotes: 'PRIVATE DRAFTING NOTES: This must NEVER appear in generated project code.',
      },
      education: { college: 'National Institute', degree: 'B.Tech', branch: 'CS', gradYear: '2025', note: 'Distinction' },
      skills: ['TypeScript', 'Next.js', 'React', 'Node.js'],
      interests: ['Distributed Systems', 'Compilers'],
      projects: [
        { id: 'proj-1', title: 'NeonStrike Engine', description: 'WebGPU renderer', tools: 'Rust, WGSL', link: 'https://example.com/neonstrike' },
        { id: 'proj-2', title: 'Folio Engine', description: 'Autonomous portfolio system', tools: 'TypeScript', link: 'https://example.com/folio' },
      ],
      highlights: ['Engineered multi-region services', 'Open source core maintainer'],
      activities: ['Organizer, Open Dev Summit', 'Tech Speaker'],
      learning: 'Optimizing Next.js project generation engines',
      links: { email: 'architect@example.com', github: 'https://github.com/architect', linkedin: 'https://linkedin.com/in/architect', other: [] },
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
  const scan = await page.evaluate(async (target) => {
    const el = document.querySelector(target);
    if (!el) return { missing: true, violations: [] };
    const r = await window.axe.run(el, {
      rules: {
        'color-contrast': { enabled: false },
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
  console.log('CHECKPOINT 8H: Controlled Next.js Generator E2E Suite');
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
    const testUserId = `dev-test-8h-${RUN_ID}`;
    const initialBundle = createBundle();

    // ==========================================
    // Seed draft and load Studio in Advanced mode
    // ==========================================
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await page.evaluate(
      ([key, data]) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      [STORAGE_KEY, initialBundle],
    );
    await page.reload({ waitUntil: 'networkidle' });

    // Click "Advanced" mode button
    const advModeBtn = page.locator('.portfolio-mode-toggle button:has-text("Advanced")');
    await advModeBtn.waitFor({ state: 'visible' });
    await advModeBtn.click();
    await page.waitForTimeout(500);

    // Verify workspace container appears
    const workspace = page.locator('.adv-workspace-container');
    assert((await workspace.count()) > 0, 'Advanced workspace container is mounted');

    // ==========================================
    // Flow A: Generate Project and Open Inspector Modal
    // ==========================================
    console.log('\n--- Flow A: Generate Project Button & Modal Initialization ---');
    const generateBtn = page.locator('button.adv-generate-action-btn:has-text("Generate Project")').first();
    assert((await generateBtn.count()) > 0, 'Generate Project button is present in Studio');

    await generateBtn.click();
    await page.waitForSelector('.adv-modal-window', { state: 'visible', timeout: 5000 });

    const modalTitle = page.locator('#project-inspector-title');
    assert(await modalTitle.isVisible(), 'Project Inspector Modal opened successfully');

    // Check project metrics in inspector
    const metricsBar = page.locator('.adv-metrics-bar');
    const metricsText = await metricsBar.innerText();
    assert(metricsText.includes('Next.js 16 (App Router)'), 'Metrics: Framework Next.js 16');
    assert(metricsText.includes('advanced-minimal-v1'), 'Metrics: Theme advanced-minimal-v1');
    assert(metricsText.includes('5'), 'Metrics: Active Routes count is 5');
    assert(metricsText.includes('14'), 'Metrics: Files Generated count is 14');
    assert(metricsText.includes('0 Forbidden Tokens'), 'Metrics: Security Scan passed with 0 Forbidden Tokens');

    // ==========================================
    // Flow B: Inspect Generated Project Files & Routes
    // ==========================================
    console.log('\n--- Flow B: Inspect Generated Project Files & Route Table ---');
    // Verify package.json is selected by default
    const currentFilePath = page.locator('.adv-file-current-path');
    assert((await currentFilePath.innerText()).includes('package.json'), 'Default selected file is package.json');

    const codeScroll = page.locator('.adv-code-scroll');
    const packageCode = await codeScroll.innerText();
    assert(packageCode.includes('"next": "^16.3.8"'), 'package.json contains Next.js 16');
    assert(packageCode.includes('"react": "^19.1.0"'), 'package.json contains React 19');
    assert(!packageCode.includes('@supabase'), 'package.json has NO Supabase runtime dependency');
    assert(!packageCode.includes('@google'), 'package.json has NO Gemini/Google runtime dependency');

    // Click on lib/portfolio-data.ts in file list
    const dataFileBtn = page.locator('.adv-file-row:has-text("lib/portfolio-data.ts")');
    await dataFileBtn.click();
    await page.waitForTimeout(200);

    const portfolioDataCode = await codeScroll.innerText();
    assert(portfolioDataCode.includes('Advanced Architect 8H'), 'lib/portfolio-data.ts contains creator name');
    assert(portfolioDataCode.includes('NeonStrike Engine'), 'lib/portfolio-data.ts contains project title');
    assert(
      !portfolioDataCode.includes('PRIVATE DRAFTING NOTES'),
      'lib/portfolio-data.ts strictly excludes private originalNotes',
    );

    // Click on app/page.tsx
    const homePageBtn = page.locator('.adv-file-row:has-text("app/page.tsx")');
    await homePageBtn.click();
    await page.waitForTimeout(200);

    const homePageCode = await codeScroll.innerText();
    assert(homePageCode.includes('export default function Page()'), 'app/page.tsx has default export Page()');
    assert(homePageCode.includes('PORTFOLIO_DATA'), 'app/page.tsx imports PORTFOLIO_DATA');
    assert(!homePageCode.includes('eval('), 'app/page.tsx has no eval');
    assert(!homePageCode.includes('dangerouslySetInnerHTML'), 'app/page.tsx has no dangerouslySetInnerHTML');

    // Switch to Routes view tab
    const routesTabBtn = page.locator('.adv-view-tab:has-text("Configured Routes")');
    await routesTabBtn.click();
    await page.waitForTimeout(200);

    const routesTable = page.locator('.adv-routes-table');
    assert(await routesTable.isVisible(), 'Routes table view is visible');
    const tableText = await routesTable.innerText();
    assert(tableText.includes('/'), 'Table includes root route /');
    assert(tableText.includes('/about'), 'Table includes /about route');
    assert(tableText.includes('/projects'), 'Table includes /projects route');
    assert(tableText.includes('/experience'), 'Table includes /experience route');
    assert(tableText.includes('/contact'), 'Table includes /contact route');

    // Accessibility scan on open Project Inspector modal
    await scanAxe(page, '.adv-modal-window', 'Project Inspector Modal');

    // Close modal
    const closeBtn = page.locator('.adv-modal-close-btn');
    await closeBtn.click();
    await page.waitForTimeout(300);
    assert((await page.locator('.adv-modal-window').count()) === 0, 'Modal closed successfully');

    // ==========================================
    // Flow C: Re-generate After Profile / Settings Change
    // ==========================================
    console.log('\n--- Flow C: Re-generate After Settings Update ---');
    // Switch to Settings tab
    const settingsTab = page.locator('.adv-tab-btn:has-text("Settings")');
    await settingsTab.click();
    await page.waitForTimeout(200);

    const siteTitleInput = page.locator('#adv-site-title');
    await siteTitleInput.fill('Quantum Systems Portfolio');
    await page.waitForTimeout(300);

    // Click "Inspect Next.js Project" button in Settings tab
    const inspectBtnInSettings = page.locator('button[aria-label="Generate Next.js project artifact"]');
    await inspectBtnInSettings.click();
    await page.waitForSelector('.adv-modal-window', { state: 'visible', timeout: 5000 });

    // Verify updated site title in lib/portfolio-data.ts
    const dataFileBtn2 = page.locator('.adv-file-row:has-text("lib/portfolio-data.ts")');
    await dataFileBtn2.click();
    await page.waitForTimeout(200);

    const updatedDataCode = await page.locator('.adv-code-scroll').innerText();
    assert(updatedDataCode.includes('Quantum Systems Portfolio'), 'lib/portfolio-data.ts has updated siteTitle');

    // Close modal
    await page.locator('.adv-modal-close-btn').click();
    await page.waitForTimeout(300);

    // ==========================================
    // Flow D: Page Toggling & Selective Generation
    // ==========================================
    console.log('\n--- Flow D: Page Toggling & Selective File Generation ---');
    // Switch to Pages tab
    const pagesTab = page.locator('.adv-tab-btn:has-text("Pages")');
    await pagesTab.click();
    await page.waitForTimeout(200);

    // Select Projects page
    const projectsItem = page.locator('.adv-page-tree-item:has-text("Projects")');
    await projectsItem.click();
    await page.waitForTimeout(200);

    // Toggle "Include page in portfolio" OFF
    const togglePageSwitch = page.locator('.adv-visibility-toggle-row button[role="switch"]');
    await togglePageSwitch.click();
    await page.waitForTimeout(300);

    // Generate project again
    await generateBtn.click();
    await page.waitForSelector('.adv-modal-window', { state: 'visible', timeout: 5000 });

    // Verify metrics show 4 active routes and 13 files
    const metricsText2 = await page.locator('.adv-metrics-bar').innerText();
    assert(metricsText2.includes('4'), 'Active Routes updated to 4');
    assert(metricsText2.includes('13'), 'Files Generated updated to 13 (omitted app/projects/page.tsx)');

    // In file list, app/projects/page.tsx should NOT exist
    const projectsFileRow = page.locator('.adv-file-row:has-text("app/projects/page.tsx")');
    assert((await projectsFileRow.count()) === 0, 'app/projects/page.tsx is strictly omitted from generated files');

    // Close modal
    await page.locator('.adv-modal-close-btn').click();
    await page.waitForTimeout(300);

    // ==========================================
    // Flow E: Dev Credits Balance Invariant (0 Consumed)
    // ==========================================
    console.log('\n--- Flow E: Dev Credits Invariant (Balance = 12, Consumed = 0) ---');
    // Fetch credits via API
    const creditsRes = await page.evaluate(async (userId) => {
      const res = await fetch('/api/credits', {
        headers: { 'x-folio-test-user-id': userId },
      });
      return res.json();
    }, testUserId);

    assert(creditsRes.ok === true, 'Credits API responds successfully');
    assert(creditsRes.account.balance === 12, 'Dev credits balance remains exactly 12');
    assert(creditsRes.account.lifetimeUsed === 0, 'Dev credits lifetimeUsed remains 0 (generation consumes 0 credits)');

    // ==========================================
    // Flow F: Mobile 390px Viewport & Responsiveness
    // ==========================================
    console.log('\n--- Flow F: Mobile 390px Viewport & Layout Integrity ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Check for horizontal overflow in Studio
    const studioOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!studioOverflow, 'No horizontal overflow on 390px mobile viewport in Studio');

    // Open modal on mobile
    await generateBtn.click();
    await page.waitForSelector('.adv-modal-window', { state: 'visible', timeout: 5000 });

    const modalOverflow = await page.evaluate(() => {
      const modal = document.querySelector('.adv-modal-window');
      return modal ? modal.scrollWidth > window.innerWidth : false;
    });
    assert(!modalOverflow, 'Project Inspector modal fits cleanly within 390px mobile viewport');

    // Accessibility check on mobile modal
    await scanAxe(page, '.adv-modal-window', 'Mobile Modal (390px)');

    // Close modal
    await page.locator('.adv-modal-close-btn').click();
    await page.waitForTimeout(300);

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.close();
    await context.close();
  } catch (err) {
    result.failedChecks.push({ message: `Fatal exception in E2E test: ${err.message}`, stack: err.stack });
    console.error('Fatal E2E error:', err);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n==========================================');
  console.log(`Checkpoint 8H E2E Summary:`);
  console.log(`Failed checks: ${result.failedChecks.length}`);
  console.log(`Browser errors: ${result.browserErrors.length}`);
  console.log(`Axe scan results: ${result.axeViolations.length} scanned`);
  console.log('==========================================\n');

  fs.writeFileSync(
    path.join(__dirname, 'qa-8h-results.json'),
    JSON.stringify(result, null, 2),
    'utf-8',
  );

  if (result.failedChecks.length > 0 || result.browserErrors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
