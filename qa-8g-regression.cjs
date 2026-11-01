const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const STORAGE_KEY = 'folio-studio-draft-v1';
const RUN_ID = Date.now().toString(36);

const result = {
  checkpoint: '8G',
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

function createBundle(name = 'Advanced Creator 8G') {
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
  console.log(`Starting Checkpoint 8G E2E Regression on ${BASE_URL} (run: ${RUN_ID})...\n`);
  browser = await chromium.launch({ headless: true, channel: 'chrome' });

  const testUserId = `user-8g-${RUN_ID}`;

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
          result.browserErrors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      result.browserErrors.push(err.message);
    });

    // ==========================================
    // Flow A: Studio Advanced Mode Selection
    // ==========================================
    console.log('\n--- Flow A: Studio Advanced Mode Workspace Initialization ---');
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });

    // Seed local draft
    const bundle = createBundle(`Creator 8G ${RUN_ID}`);
    await page.evaluate(
      ([key, data]) => {
        localStorage.setItem(key, JSON.stringify(data));
      },
      [STORAGE_KEY, bundle],
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

    // Verify sub-rail navigation tabs
    const tabPages = page.locator('.adv-tab-btn:has-text("Pages")');
    const tabNav = page.locator('.adv-tab-btn:has-text("Nav")');
    const tabSettings = page.locator('.adv-tab-btn:has-text("Settings")');
    assert((await tabPages.count()) > 0, 'Subrail tab "Pages" is present');
    assert((await tabNav.count()) > 0, 'Subrail tab "Nav" is present');
    assert((await tabSettings.count()) > 0, 'Subrail tab "Settings" is present');

    // Verify all 5 canonical pages are listed
    const pageItems = page.locator('.adv-page-tree-item');
    assert((await pageItems.count()) === 5, 'All 5 canonical pages listed in Pages sub-rail');

    // Verify preview column rendered
    const previewContainer = page.locator('.adv-site-container');
    assert((await previewContainer.count()) > 0, 'Advanced preview container is rendered');
    const addressBar = page.locator('.adv-address-bar');
    assert((await addressBar.innerText()).includes('portfolio.local'), 'Address bar shows portfolio.local host');

    // ==========================================
    // Flow B: Page Management (Selection, Toggling, Title Editing)
    // ==========================================
    console.log('\n--- Flow B: Page Management ---');
    // Select About page
    const aboutPageItem = page.locator('.adv-page-tree-item:has-text("About")');
    await aboutPageItem.click();
    await page.waitForTimeout(200);

    // Check locked route
    const routeBadge = page.locator('.adv-code-route');
    assert((await routeBadge.innerText()).includes('/about'), 'Route badge shows /about');

    // Edit page title
    const titleInput = page.locator('input#page-title-input');
    await titleInput.fill('About Me & Craft');
    await page.waitForTimeout(200);

    // Edit nav label
    const navLabelInput = page.locator('input#nav-label-input');
    await navLabelInput.fill('Craft');
    await page.waitForTimeout(200);

    // Verify nav label updated in live preview
    const craftNavLink = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Craft")');
    assert((await craftNavLink.count()) > 0, 'Header nav link updated to "Craft"');

    // Toggle page visibility off
    const visibilityToggle = page.locator('.adv-visibility-toggle-row button[role="switch"]');
    await visibilityToggle.click();
    await page.waitForTimeout(300);

    // Verify preview navigation no longer has Craft link
    const craftLinkAfterHidden = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Craft")');
    assert((await craftLinkAfterHidden.count()) === 0, 'Hidden page removed from header navigation links');

    // Verify hidden page notice appears when viewing hidden page
    const hiddenNotice = page.locator('.adv-page-disabled-notice');
    assert((await hiddenNotice.count()) > 0, 'Hidden page notice displayed in preview');

    // Toggle page visibility back on
    await visibilityToggle.click();
    await page.waitForTimeout(300);
    const craftLinkRestored = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Craft")');
    assert((await craftLinkRestored.count()) > 0, 'Page restored and appears in header nav');

    // Check Home page cannot be disabled
    const homePageItem = page.locator('.adv-page-tree-item:has-text("Home")');
    await homePageItem.click();
    await page.waitForTimeout(200);
    const homeLocked = page.locator('.adv-locked-notice');
    assert((await homeLocked.count()) > 0, 'Home page displays locked notice and cannot be toggled');

    // ==========================================
    // Flow C: Section Management
    // ==========================================
    console.log('\n--- Flow C: Section Management ---');
    // On Home page, check sections list
    const sectionRows = page.locator('.adv-section-item');
    const initialSectionCount = await sectionRows.count();
    assert(initialSectionCount >= 3, `Home page has ${initialSectionCount} sections`);

    // Toggle off a section (e.g. summary)
    const summarySectionToggle = page.locator('.adv-section-item:has-text("Bio & Summary") button[role="switch"]');
    await summarySectionToggle.click();
    await page.waitForTimeout(300);

    // Verify summary is hidden from preview
    const previewSummary = page.locator('.adv-section-summary');
    assert((await previewSummary.count()) === 0, 'Bio & Summary section hidden from live preview');

    // Toggle summary back on
    await summarySectionToggle.click();
    await page.waitForTimeout(300);
    const previewSummaryRestored = page.locator('.adv-section-summary');
    assert((await previewSummaryRestored.count()) > 0, 'Bio & Summary section restored in live preview');

    // ==========================================
    // Flow D: Live Preview Multi-Page Navigation
    // ==========================================
    console.log('\n--- Flow D: Live Preview Navigation ---');
    // Click "Projects" nav link inside the live preview frame
    const projectsNavLink = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Projects")');
    await projectsNavLink.click();
    await page.waitForTimeout(300);

    // Verify simulated address bar changed to /projects
    const currentAddress = await page.locator('.adv-address-path').innerText();
    assert(currentAddress === '/projects', 'Address bar path updated to /projects');

    // Verify projects section rendered
    const projectsSection = page.locator('.adv-section-projects');
    assert((await projectsSection.count()) > 0, 'Projects page content active in preview');

    // Viewport switcher
    const mobileVpBtn = page.locator('.viewport-switch button[aria-label="Mobile preview"]');
    await mobileVpBtn.click();
    await page.waitForTimeout(300);
    const mobileFrame = page.locator('.adv-viewport-frame.viewport-mobile');
    assert((await mobileFrame.count()) > 0, 'Viewport switched to mobile frame');

    // In mobile frame, check mobile menu hamburger
    const mobileMenuBtn = page.locator('.adv-mobile-nav-toggle');
    assert((await mobileMenuBtn.count()) > 0, 'Mobile drawer button visible on mobile viewport');
    await mobileMenuBtn.click();
    await page.waitForTimeout(200);
    const mobileDrawer = page.locator('.adv-mobile-drawer');
    assert((await mobileDrawer.count()) > 0, 'Mobile drawer navigation opened');

    // Switch back to desktop viewport
    const desktopVpBtn = page.locator('.viewport-switch button[aria-label="Desktop preview"]');
    await desktopVpBtn.click();
    await page.waitForTimeout(300);

    // ==========================================
    // Flow E: Content Honesty & Zero Hallucinated Data
    // ==========================================
    console.log('\n--- Flow E: Content Honesty & Zero Hallucinated Data ---');
    // Navigate to Experience page (profile fixture has 0 highlights / 0 activities)
    const expNavLink = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Experience")');
    await expNavLink.click();
    await page.waitForTimeout(300);

    // Check empty state
    const emptyNotice = page.locator('.adv-section-empty');
    assert((await emptyNotice.count()) > 0, 'Honest empty state displayed for unpopulated experience/activities');
    const emptyNoticeText = await emptyNotice.first().innerText();
    assert(emptyNoticeText.includes('appear here'), 'Empty state honestly states content will appear once added without fabricating data');

    // ==========================================
    // Flow F: Persistence Across Reload
    // ==========================================
    console.log('\n--- Flow F: Persistence Across Reload ---');
    // Wait 600ms for debounced local draft autosave
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'networkidle' });

    // Check mode remains Advanced
    const activeModeBtn = page.locator('.portfolio-mode-toggle button.active');
    assert((await activeModeBtn.innerText()).includes('Advanced'), 'Advanced mode persisted across page reload');

    // Check edited nav label persists
    const persistedCraftLink = page.locator('.adv-site-header .adv-site-nav button.adv-nav-link:has-text("Craft")');
    assert((await persistedCraftLink.count()) > 0, 'Persisted edited nav label "Craft" survived page reload');

    // ==========================================
    // Flow G: Mode Switching Stability (Round-trip)
    // ==========================================
    console.log('\n--- Flow G: Mode Switching Stability ---');
    // Switch to Simple mode
    const simpleModeBtn = page.locator('.portfolio-mode-toggle button:has-text("Simple")');
    await simpleModeBtn.click();
    await page.waitForTimeout(300);

    // Verify Simple workspace (steps rail) returned
    const stepsRail = page.locator('.steps-rail');
    assert((await stepsRail.count()) > 0, 'Reverted to Simple steps rail');

    // Verify Profile document intact
    const simpleDraft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    assert(simpleDraft.profile.basics.name.includes('Creator 8G'), 'Profile document name intact after mode switch');
    assert(simpleDraft.profile.skills.length === 3, 'Profile skills intact after mode switch');

    // Switch back to Advanced mode
    const advModeBtnAgain = page.locator('.portfolio-mode-toggle button:has-text("Advanced")');
    await advModeBtnAgain.click();
    await page.waitForTimeout(500);

    // Verify Advanced config preserved
    const advWorkspaceAgain = page.locator('.adv-workspace-container');
    assert((await advWorkspaceAgain.count()) > 0, 'Advanced workspace restored on return');

    // Capture active advanced draft
    const advancedDraft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);

    // ==========================================
    // Flow H: Account Page Representation & Accessibility
    // ==========================================
    console.log('\n--- Flow H: Account Page & Accessibility Scan ---');
    // Setup authenticated session on account page
    const accountPage = await context.newPage();
    await accountPage.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });

    // Set test user in sessionStorage and seed draft
    await accountPage.evaluate(
      ([userId, key, data]) => {
        sessionStorage.setItem('folio_dev_user', userId);
        localStorage.setItem(key, JSON.stringify(data));
      },
      [testUserId, STORAGE_KEY, advancedDraft],
    );
    await accountPage.reload({ waitUntil: 'networkidle' });

    // Check Portfolio format displays Advanced and page counts
    const formatField = accountPage.locator('.account-field:has-text("Portfolio format")');
    const formatText = await formatField.innerText();
    assert(formatText.includes('Advanced'), 'Account page displays Advanced format');
    assert(formatText.includes('5 pages · 5 active'), 'Account page displays "5 pages · 5 active"');
    assert(formatText.includes('Multi-page publishing to your own Vercel will be available in a later step'), 'Explains Vercel multi-page deployment coming next');

    // Check Vercel button is disabled
    const vercelBtn = accountPage.locator('button:has-text("Vercel publish coming next")');
    assert((await vercelBtn.count()) > 0, '"Vercel publish coming next" button rendered');
    assert((await vercelBtn.getAttribute('disabled')) !== null, 'Vercel publish button is strictly disabled');

    // Accessibility scan on Account page
    await scanAxe(accountPage, '.account-container', 'Account Page (Advanced mode)');

    // Accessibility scan on Studio Advanced Workspace
    await page.bringToFront();
    await scanAxe(page, '.adv-workspace-container', 'Studio Advanced Workspace');

    await accountPage.close();
    await page.close();
    await context.close();
  } catch (err) {
    result.failedChecks.push({ message: `Fatal exception in E2E test: ${err.message}`, stack: err.stack });
    console.error('Fatal E2E error:', err);
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n==========================================');
  console.log(`Checkpoint 8G E2E Summary:`);
  console.log(`Failed checks: ${result.failedChecks.length}`);
  console.log(`Browser errors: ${result.browserErrors.length}`);
  console.log(`Axe scan results: ${result.axeViolations.length} scanned`);
  console.log('==========================================\n');

  fs.writeFileSync(
    path.join(__dirname, 'qa-8g-results.json'),
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
