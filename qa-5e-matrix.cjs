const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const STYLE_IDS = ['zine', 'documentary', 'community', 'case-study'];
const PROJECT_SELECTORS = '.zine-project,.documentary-project,.community-project,.case-study-project';
const FIXTURES = [
  { id: 'A', name: 'Mira Sen', h1: 'Mira Sen', sections: ['about', 'education', 'skills', 'projects'], projects: 0, emptyProjects: true },
  { id: 'B', name: 'Rohan Das', h1: 'Study-room finder', projectTitles: ['Study-room finder'], sections: ['about', 'education', 'skills', 'projects'], projects: 1 },
  { id: 'C', name: 'Varshan Gowda', h1: 'Library-hours map', projectTitles: ['Library-hours map', 'Plain-language form study'], sections: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'], projects: 2 },
  { id: 'D', name: 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer', h1: 'An intentionally extended project title for testing wrapping, hierarchy, and reading order on narrow portfolio screens', projectTitles: ['An intentionally extended project title for testing wrapping, hierarchy, and reading order on narrow portfolio screens'], sections: ['about', 'projects'], projects: 1, long: true },
  { id: 'D-no-project', name: 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer', h1: 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer', sections: ['about', 'projects'], projects: 0, long: true, noProjects: true, emptyProjects: true },
];
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, button: 0 },
  { id: 'mobile', width: 390, height: 844, button: 1 },
];
const EXPECTED_CLOSEST = {
  zine: 'Pinboard / visual',
  documentary: 'White-cube / gallery',
  community: 'Project-focused',
  'case-study': 'Project-focused',
};
const OUT = process.cwd();
let activeBrowser;
const results = {
  checkpoint: '5E',
  testedStyles: STYLE_IDS,
  fixtures: FIXTURES.map(({ id }) => id),
  viewports: VIEWPORTS.map(({ id, width, height }) => ({ id, width, height })),
  renderCases: [],
  behaviorChecks: {},
  audits: {},
  browserErrors: [],
  failedChecks: [],
};

function assert(condition, message, details) {
  if (!condition) results.failedChecks.push({ message, details });
}

function countPassingChecks(value) {
  return Object.values(value).filter((item) => {
    if (typeof item === 'boolean') return item;
    return Boolean(item && typeof item === 'object' && item.passed === true);
  }).length;
}

async function setFixture(page, fixtureId, noProjects = false) {
  const selectedFixture = fixtureId === 'D-no-project' ? 'D' : fixtureId;
  await page.locator('#qa-fixture').selectOption(selectedFixture);
  if (selectedFixture === 'D') {
    const toggle = page.locator('label.qa-edge-toggle').filter({ hasText: 'D subcase: no projects' }).locator('input');
    if (noProjects && !(await toggle.isChecked())) await toggle.check();
    if (!noProjects && (await toggle.isChecked())) await toggle.uncheck();
  }
  await page.waitForTimeout(50);
}

async function setViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.locator('.qa-viewport-field .qa-segmented button').nth(viewport.button).click();
  await page.waitForTimeout(45);
}

async function focusStyle(page, templateId) {
  await page.locator('#qa-focus-style').selectOption(templateId);
  await page.waitForTimeout(25);
  return page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
}

async function collectMetrics(root) {
  return root.evaluate((site) => {
    const sections = [...site.querySelectorAll('[data-section]')].map((section) => section.getAttribute('data-section'));
    const navLinks = [...site.querySelectorAll('nav a')].map((link) => {
      const href = link.getAttribute('href') || '';
      return {
        href,
        label: link.textContent.trim().replace(/\s+/g, ' '),
        height: link.getBoundingClientRect().height,
        targetExists: href.startsWith('#') && Boolean(site.querySelector(href)),
      };
    });
    const anchors = [...site.querySelectorAll('a')].map((link) => ({
      href: link.getAttribute('href') || '',
      target: link.getAttribute('target') || '',
      rel: link.getAttribute('rel') || '',
      height: link.getBoundingClientRect().height,
      text: link.innerText.trim().replace(/\s+/g, ' '),
      label: link.getAttribute('aria-label') || '',
    }));
    const projectNodes = [...site.querySelectorAll('.zine-project,.documentary-project,.community-project,.case-study-project')];
    const main = site.querySelector('main');
    const clipping = [...site.querySelectorAll('h1,h2,h3,p,a,li')].filter((element) => {
      const style = getComputedStyle(element);
      const clips = ['hidden', 'clip'].includes(style.overflowX) || style.textOverflow === 'ellipsis' || (style.webkitLineClamp && style.webkitLineClamp !== 'none');
      return clips && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    }).map((element) => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 100), overflow: getComputedStyle(element).overflowX }));
    const decorativeSelectors = {
      zine: '.zine-stamp,.zine-project-art',
      documentary: '.documentary-project-art',
      community: '',
      'case-study': '',
    };
    const decorations = decorativeSelectors[site.getAttribute('data-template')]
      ? [...site.querySelectorAll(decorativeSelectors[site.getAttribute('data-template')])]
      : [];
    const decorationA11y = decorations.every((element) => element.getAttribute('aria-hidden') === 'true' || Boolean(element.closest('[aria-hidden="true"]')));
    const projectEmpty = site.querySelector('[class$="-projects-empty"]');
    const h1 = site.querySelector('h1');
    return {
      template: site.getAttribute('data-template'),
      h1Count: site.querySelectorAll('h1').length,
      h1Text: h1?.textContent.trim().replace(/\s+/g, ' ') || '',
      mainCount: site.querySelectorAll('main').length,
      sectionOrder: sections,
      navLinks,
      anchors,
      rootWidth: site.clientWidth,
      rootScrollWidth: site.scrollWidth,
      mainWidth: main?.clientWidth ?? null,
      mainScrollWidth: main?.scrollWidth ?? null,
      hasProjectsSection: Boolean(site.querySelector('[data-section="projects"]')),
      projectCount: projectNodes.length,
      projectTitles: projectNodes.map((article) => article.querySelector('h3')?.textContent.trim().replace(/\s+/g, ' ') || ''),
      emptyProjectState: projectEmpty ? projectEmpty.innerText.trim().replace(/\s+/g, ' ') : '',
      hasEducation: Boolean(site.querySelector('[data-section="education"]')),
      hasContact: Boolean(site.querySelector('[data-section="contact"]')),
      imageCount: site.querySelectorAll('img,iframe,video').length,
      fakeControlCount: site.querySelectorAll('button,input,select,textarea,[role="button"]').length,
      localAnchorsResolve: [...site.querySelectorAll('a[href^="#"]')].every((link) => Boolean(site.querySelector(link.getAttribute('href')))),
      clipping,
      decorationCount: decorations.length,
      decorationA11y,
      text: site.innerText,
    };
  });
}

async function main() {
  activeBrowser = await chromium.launch({ headless: true });
  const browser = activeBrowser;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => results.browserErrors.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') results.browserErrors.push({ type: 'console', message: message.text() });
  });
  page.on('requestfailed', (request) => results.browserErrors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));

  await page.goto('http://localhost:3000/template-demos', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Focus one style' }).click();
  await page.locator('#qa-focus-style').waitFor();

  // Four 5E renderers × A/B/C/D/D-no-project × 1440×900 and 390×844.
  for (const fixture of FIXTURES) {
    await setFixture(page, fixture.id, Boolean(fixture.noProjects));
    for (const viewport of VIEWPORTS) {
      await setViewport(page, viewport);
      for (const templateId of STYLE_IDS) {
        const root = await focusStyle(page, templateId);
        const state = await collectMetrics(root);
        const expectedSectionOrder = fixture.sections;
        const navTargets = state.navLinks.every((link) => link.targetExists);
        const orderedNav = JSON.stringify(state.navLinks.map((link) => link.href)) === JSON.stringify(state.sectionOrder.map((section) => `#portfolio-${templateId}-section-${section}`));
        const targetCheck = state.anchors.length > 0 && state.anchors.every((link) => link.height >= 43.5);
        const noHorizontalOverflow = state.rootScrollWidth <= state.rootWidth + 1 && state.mainScrollWidth <= state.mainWidth + 1;
        const expectedH1 = templateId === 'case-study' ? fixture.h1 : fixture.name;
        const correctHeading = state.h1Text === expectedH1;
        const emptyStateCheck = fixture.emptyProjects
          ? state.emptyProjectState.includes('No projects added yet.') && state.emptyProjectState.includes('You can add projects later.')
          : state.emptyProjectState === '';
        const expectedMissingData = fixture.id === 'D' || fixture.id === 'D-no-project'
          ? !state.hasEducation && !state.hasContact && !state.sectionOrder.includes('skills') && !state.sectionOrder.includes('highlights')
          : state.hasEducation;
        const longTextRetained = !fixture.long || (state.text.includes('Paragraph stress sample 7') && (fixture.noProjects ? !state.text.includes('Description segment 7') : state.text.includes('Description segment 7')));
        const expectedProjectCount = state.projectCount === fixture.projects;
        const expectedProjectTitles = fixture.projectTitles || [];
        const projectOrderRetained = JSON.stringify(state.projectTitles) === JSON.stringify(expectedProjectTitles);
        const noInventedProcessClaims = templateId !== 'case-study' || !/(context|approach|decisions|results)/i.test(state.text);
        const noFakeImageryOrControls = state.imageCount === 0 && state.fakeControlCount === 0;
        const passes = state.template === templateId
          && state.h1Count === 1
          && state.mainCount === 1
          && JSON.stringify(state.sectionOrder) === JSON.stringify(expectedSectionOrder)
          && state.hasProjectsSection
          && expectedProjectCount
          && projectOrderRetained
          && noInventedProcessClaims
          && emptyStateCheck
          && navTargets
          && orderedNav
          && targetCheck
          && noHorizontalOverflow
          && state.clipping.length === 0
          && correctHeading
          && longTextRetained
          && expectedMissingData
          && noFakeImageryOrControls
          && state.localAnchorsResolve
          && state.decorationA11y;
        assert(passes, `${templateId} ${fixture.id} ${viewport.id} render, empty-state, overflow, order, and target check`, {
          sectionOrder: state.sectionOrder, expectedSections: expectedSectionOrder,
          projectCount: state.projectCount, expectedProjects: fixture.projects,
          projectTitles: state.projectTitles, expectedProjectTitles, projectOrderRetained, noInventedProcessClaims,
          emptyProjectState: state.emptyProjectState, emptyStateCheck,
          navTargets, orderedNav, targetCheck, noHorizontalOverflow,
          clipping: state.clipping, correctHeading, expectedH1: fixture.h1,
          longTextRetained, expectedMissingData, noFakeImageryOrControls,
          decorationA11y: state.decorationA11y,
          dimensions: { root: [state.rootWidth, state.rootScrollWidth], main: [state.mainWidth, state.mainScrollWidth] },
        });
        results.renderCases.push({
          templateId, fixture: fixture.id,
          viewport: { id: viewport.id, width: viewport.width, height: viewport.height },
          passed: passes,
          sections: state.sectionOrder,
          projectCount: state.projectCount,
          navigationLinks: state.navLinks.length,
          anchors: state.anchors.length,
          horizontalOverflow: !noHorizontalOverflow,
          clippedTextNodes: state.clipping.length,
          imageAndVideoElements: state.imageCount,
          emptyProjectState: Boolean(state.emptyProjectState),
        });
      }
    }
  }

  // Real supplied project/contact URLs remain intact and open safely.
  await setFixture(page, 'C');
  await setViewport(page, VIEWPORTS[0]);
  const linkBehavior = {};
  for (const templateId of STYLE_IDS) {
    const root = await focusStyle(page, templateId);
    const links = await root.locator('a').evaluateAll((items) => items.map((link) => ({
      href: link.getAttribute('href') || '', target: link.getAttribute('target') || '', rel: link.getAttribute('rel') || '',
      label: (link.getAttribute('aria-label') || link.textContent || '').trim(),
    })));
    const safeNewTabs = links.filter((link) => link.target === '_blank').every((link) => link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    const projectUrl = links.some((link) => link.href === 'https://library-map.example.test/');
    const contactLinks = links.some((link) => link.href === 'mailto:varshan@example.test')
      && links.some((link) => link.href === 'https://code.example.test/varshan')
      && links.some((link) => link.href === 'https://notes.example.test/varshan');
    const projectEntryCount = await root.locator(PROJECT_SELECTORS).count();
    const localLinksWork = await root.evaluate((element) => [...element.querySelectorAll('a[href^="#"]')].every((link) => Boolean(element.querySelector(link.getAttribute('href')))));
    const passes = safeNewTabs && projectUrl && contactLinks && projectEntryCount === 2 && localLinksWork;
    linkBehavior[templateId] = { linkCount: links.length, safeNewTabs, projectUrl, contactLinks, projectEntryCount, localLinksWork, links, passed: passes };
    assert(passes, `${templateId} project/contact URLs and in-page navigation`, linkBehavior[templateId]);
  }
  results.behaviorChecks.links = linkBehavior;

  // Hidden Projects removes its section, nav item, feature lead, and project-specific links.
  await page.locator('#qa-hide-projects').check();
  const hiddenProjects = {};
  for (const templateId of STYLE_IDS) {
    const root = await focusStyle(page, templateId);
    const state = await collectMetrics(root);
    const hasProjectAnchor = state.navLinks.some((link) => link.href === `#portfolio-${templateId}-section-projects`);
    const hasProjectShortcut = state.text.includes('FEATURED PROJECT') || state.text.includes('Study-room finder') || state.text.includes('Library-hours map');
    const passes = !state.hasProjectsSection && state.projectCount === 0 && !hasProjectAnchor && !hasProjectShortcut && state.navLinks.every((link) => link.targetExists);
    hiddenProjects[templateId] = { section: state.hasProjectsSection, projectCount: state.projectCount, hasProjectAnchor, hasProjectShortcut, navTargetsResolve: state.navLinks.every((link) => link.targetExists), passed: passes };
    assert(passes, `${templateId} hidden Projects removes section, nav and project shortcuts`, hiddenProjects[templateId]);
  }
  await page.locator('#qa-hide-projects').uncheck();
  results.behaviorChecks.hiddenProjects = hiddenProjects;

  // Reverse DesignConfig.sectionOrder; rendered sections and Contents/nav anchors must stay aligned.
  await page.locator('#qa-reverse-sections').check();
  const reversedOrder = {};
  for (const templateId of STYLE_IDS) {
    const root = await focusStyle(page, templateId);
    const state = await collectMetrics(root);
    const expected = ['contact', 'highlights', 'projects', 'skills', 'education', 'about'];
    const navMatchesSections = JSON.stringify(state.navLinks.map((link) => link.href)) === JSON.stringify(expected.map((section) => `#portfolio-${templateId}-section-${section}`));
    const passes = JSON.stringify(state.sectionOrder) === JSON.stringify(expected) && navMatchesSections && state.navLinks.every((link) => link.targetExists);
    reversedOrder[templateId] = { sections: state.sectionOrder, navMatchesSections, passed: passes };
    assert(passes, `${templateId} reversed section order and navigation`, reversedOrder[templateId]);
  }
  await page.locator('#qa-reverse-sections').uncheck();
  results.behaviorChecks.reorderedSections = reversedOrder;

  // Keyboard focus, reduced-motion preference, and 44px tap targets on all visible links.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const accessibility = {};
  for (const templateId of STYLE_IDS) {
    const root = await focusStyle(page, templateId);
    const firstNavLink = root.locator('nav a').first();
    await firstNavLink.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focus = await firstNavLink.evaluate((link) => ({
      focused: document.activeElement === link,
      visible: link.matches(':focus-visible'),
      outlineWidth: getComputedStyle(link).outlineWidth,
      outlineStyle: getComputedStyle(link).outlineStyle,
    }));
    const reducedMotion = await root.evaluate((element) => ({
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transitionDuration: getComputedStyle(element.querySelector('nav a')).transitionDuration,
      animationDuration: getComputedStyle(element.querySelector('nav a')).animationDuration,
    }));
    const targetHeights = await root.locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    const targetCheck = targetHeights.length > 0 && targetHeights.every((height) => height >= 43.5);
    const focusCheck = focus.focused && focus.visible && parseFloat(focus.outlineWidth) >= 2 && focus.outlineStyle !== 'none';
    const nearZeroDuration = (value) => value.split(',').every((item) => parseFloat(item) <= 0.01);
    const reducedMotionCheck = reducedMotion.matches && nearZeroDuration(reducedMotion.transitionDuration) && nearZeroDuration(reducedMotion.animationDuration);
    const passes = targetCheck && focusCheck && reducedMotionCheck;
    accessibility[templateId] = { focus, reducedMotion, reducedMotionCheck, minTargetHeight: Math.min(...targetHeights), maxTargetHeight: Math.max(...targetHeights), targetCheck, focusCheck, passed: passes };
    assert(passes, `${templateId} keyboard focus, reduced motion, and 44px targets`, accessibility[templateId]);
  }
  results.behaviorChecks.accessibility = accessibility;
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Missing data/empty state: A retains visible empty Projects; D-no-project has no education or links.
  const omissions = {};
  for (const fixture of [FIXTURES[0], FIXTURES[4]]) {
    await setFixture(page, fixture.id, Boolean(fixture.noProjects));
    for (const templateId of STYLE_IDS) {
      const root = await focusStyle(page, templateId);
      const state = await collectMetrics(root);
      const expectedEducation = fixture.id === 'A';
      const passes = state.hasProjectsSection && state.projectCount === 0 && state.emptyProjectState.includes('No projects added yet.')
        && !state.hasContact && state.hasEducation === expectedEducation && state.imageCount === 0;
      omissions[`${fixture.id}-${templateId}`] = { hasProjectsSection: state.hasProjectsSection, projectCount: state.projectCount, emptyProjectState: state.emptyProjectState, hasContact: state.hasContact, hasEducation: state.hasEducation, expectedEducation, imageCount: state.imageCount, passed: passes };
      assert(passes, `${templateId} ${fixture.id} honest empty Projects and missing fields`, omissions[`${fixture.id}-${templateId}`]);
    }
  }
  results.behaviorChecks.emptyAndMissingData = omissions;

  // Axe WCAG 2.1 A/AA checks on rich fixture C for each 5E style.
  await setFixture(page, 'C');
  await setViewport(page, VIEWPORTS[0]);
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const axeResults = {};
  for (const templateId of STYLE_IDS) {
    const root = await focusStyle(page, templateId);
    const violations = await root.evaluate(async (element) => {
      const result = await window.axe.run(element, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return result.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
    });
    axeResults[templateId] = violations;
    assert(violations.length === 0, `${templateId} Axe WCAG 2.1 A/AA audit`, violations);
  }
  results.audits.axeWcag = axeResults;

  // Full-page rich-profile screenshots at both target viewports.
  await setFixture(page, 'C');
  const screenshotSummaries = {};
  for (const viewport of VIEWPORTS) {
    await setViewport(page, viewport);
    for (const templateId of STYLE_IDS) {
      const root = await focusStyle(page, templateId);
      const frame = page.locator('.qa-focus-preview .preview-frame');
      await frame.evaluate((element) => { element.style.height = ''; element.style.minHeight = ''; element.style.overflow = ''; });
      const height = await root.evaluate((site) => site.scrollHeight);
      await frame.evaluate((element, value) => { element.style.height = `${value}px`; element.style.minHeight = `${value}px`; element.style.overflow = 'visible'; }, height);
      const outPath = path.join(OUT, `qa-5e-${templateId}-${viewport.id}.png`);
      await root.screenshot({ path: outPath, animations: 'disabled' });
      screenshotSummaries[`${templateId}-${viewport.id}`] = { screenshot: path.basename(outPath), contentHeight: height };
    }
  }
  results.audits.screenshots = screenshotSummaries;

  // Verify the dedicated four-style compare mode, responsive viewport switch and grayscale toggle.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Compare the 4 Checkpoint 5E styles' }).click();
  await page.locator('.qa-five-e-compare').waitFor();
  const compareCards = await page.locator('.qa-five-e-compare .qa-core-compare-card').count();
  const compareIds = await page.locator('.qa-five-e-compare .portfolio-site').evaluateAll((roots) => roots.map((root) => root.getAttribute('data-template')));
  const compareOrder = JSON.stringify(compareIds) === JSON.stringify(STYLE_IDS);
  const desktopToggle = page.locator('.qa-viewport-field .qa-segmented button').nth(0);
  const mobileToggle = page.locator('.qa-viewport-field .qa-segmented button').nth(1);
  await desktopToggle.click();
  const desktopFrames = await page.locator('.qa-five-e-compare .preview-frame.is-mobile').count();
  await mobileToggle.click();
  const mobileFrames = await page.locator('.qa-five-e-compare .preview-frame.is-mobile').count();
  const compareViewport = { cards: compareCards, compareIds, compareOrder, desktopFrames, mobileFrames };
  const comparePasses = compareCards === 4 && compareOrder && desktopFrames === 0 && mobileFrames === 4;
  compareViewport.passed = comparePasses;
  results.behaviorChecks.focusedComparison = compareViewport;
  assert(comparePasses, '5E comparison mode shows four styles and toggles desktop/mobile previews', compareViewport);

  await page.locator('#qa-five-e-grayscale-compare').check();
  const filters = await page.locator('.qa-five-e-compare .portfolio-site').evaluateAll((roots) => roots.map((root) => getComputedStyle(root).filter));
  const grayscalePasses = filters.length === 4 && filters.every((filter) => filter.includes('grayscale(1)'));
  results.behaviorChecks.grayscaleComparison = { filters, passed: grayscalePasses };
  assert(grayscalePasses, '5E grayscale comparison toggle affects all four previews', results.behaviorChecks.grayscaleComparison);
  await page.waitForTimeout(100);
  const compareDesktopPath = path.join(OUT, 'qa-5e-grayscale-compare-panel-mobile.png');
  await page.locator('.qa-five-e-compare').screenshot({ path: compareDesktopPath, animations: 'disabled' });
  results.audits.grayscaleComparisonPanel = path.basename(compareDesktopPath);

  await desktopToggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(100);
  const compareDesktopPath2 = path.join(OUT, 'qa-5e-grayscale-compare-panel-desktop.png');
  await page.locator('.qa-five-e-compare').screenshot({ path: compareDesktopPath2, animations: 'disabled' });
  results.audits.grayscaleComparisonPanelDesktop = path.basename(compareDesktopPath2);

  const names = {
    zine: 'Cut-and-paste / zine',
    documentary: 'Documentary / photo essay',
    community: 'Community / local impact',
    'case-study': 'Product case study',
  };
  const contactSheetCards = STYLE_IDS.map((templateId) => {
    const imagePath = path.join(OUT, `qa-5e-${templateId}-desktop.png`);
    const imageData = fs.readFileSync(imagePath).toString('base64');
    return `<figure><figcaption>${names[templateId]}</figcaption><img src="data:image/png;base64,${imageData}" alt="${names[templateId]} full-page desktop screenshot, grayscale"/></figure>`;
  }).join('');
  const contactSheet = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await contactSheet.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Checkpoint 5E grayscale comparison</title><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;background:#f5f5f2;color:#282a27;font:15px/1.45 Arial,sans-serif}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:25px}
    figure{min-width:0;margin:0;padding:12px;border:1px solid #c8c9c5;background:#fff}
    figcaption{padding:0 0 9px;font-size:16px;font-weight:700}
    img{display:block;width:100%;height:auto;filter:grayscale(1)}
  </style></head><body><main>${contactSheetCards}</main></body></html>`, { waitUntil: 'load' });
  await contactSheet.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  const grayscaleContactSheetPath = path.join(OUT, 'qa-5e-grayscale-comparison-desktop.png');
  await contactSheet.screenshot({ path: grayscaleContactSheetPath, fullPage: true, animations: 'disabled' });
  results.audits.grayscaleComparison = path.basename(grayscaleContactSheetPath);
  await contactSheet.close();

  // Check each 5E template's declared closest-style collision and distinctness status.
  await page.getByRole('button', { name: 'Compare all 22' }).click();
  const collisionChecks = {};
  for (const templateId of STYLE_IDS) {
    const card = page.locator(`.qa-card[aria-labelledby="qa-style-${templateId}"]`);
    const status = (await card.locator('.qa-status').innerText()).trim();
    const quickAudit = (await card.locator('.qa-quick-audit').innerText()).replace(/\s+/g, ' ').trim();
    const closestOk = quickAudit.includes(EXPECTED_CLOSEST[templateId]);
    const passed = status === 'Distinct' && closestOk;
    collisionChecks[templateId] = { status, expectedClosest: EXPECTED_CLOSEST[templateId], quickAudit, passed };
    assert(passed, `${templateId} structural collision audit against ${EXPECTED_CLOSEST[templateId]}`, collisionChecks[templateId]);
  }
  results.behaviorChecks.structuralCollisionPairs = collisionChecks;

  results.browserErrors = [...new Map(results.browserErrors.map((error) => [JSON.stringify(error), error])).values()];
  results.summary = {
    renderCasesPassed: results.renderCases.filter((item) => item.passed).length,
    renderCasesTotal: results.renderCases.length,
    failedChecks: results.failedChecks.length,
    browserErrors: results.browserErrors.length,
    axeViolations: Object.values(axeResults).reduce((total, items) => total + items.length, 0),
    extraChecks: Object.fromEntries(Object.entries(results.behaviorChecks).map(([key, value]) => [key, countPassingChecks(value)])),
  };
  fs.writeFileSync(path.join(OUT, 'qa-5e-browser-matrix.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results.summary, null, 2));
  if (results.failedChecks.length || results.browserErrors.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  process.exitCode = 1;
});
