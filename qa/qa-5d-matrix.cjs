const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const STYLE_IDS = ['blueprint', 'bauhaus', 'y2k', 'pastel', 'academic'];
const FIXTURES = [
  { id: 'A', name: 'Mira Sen', sections: ['about', 'education', 'skills'], projects: 0 },
  { id: 'B', name: 'Rohan Das', sections: ['about', 'education', 'skills', 'projects'], projects: 1 },
  { id: 'C', name: 'Varshan Gowda', sections: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'], projects: 2 },
  { id: 'D', name: 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer', sections: ['about', 'projects'], projects: 1, long: true },
  { id: 'D-no-project', name: 'Avery Morgan-River Northwood Ellison Quill Marlowe-Campbell Delacroix Watanabe-Fernández van der Meer', sections: ['about'], projects: 0, long: true, noProjects: true },
];
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, button: 0 },
  { id: 'mobile', width: 390, height: 844, button: 1 },
];
const PROJECT_SELECTORS = '.blueprint-project,.bauhaus-project,.y2k-project,.pastel-project,.academic-project';
const OUT = process.cwd();
let activeBrowser;
const results = {
  checkpoint: '5D',
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

async function setFixture(page, fixtureId, noProjects = false) {
  const selectedFixture = fixtureId === 'D-no-project' ? 'D' : fixtureId;
  await page.locator('#qa-fixture').selectOption(selectedFixture);
  if (selectedFixture === 'D') {
    const toggle = page.locator('label.qa-edge-toggle').filter({ hasText: 'D subcase: no projects' }).locator('input');
    if (noProjects && !(await toggle.isChecked())) await toggle.check();
    if (!noProjects && (await toggle.isChecked())) await toggle.uncheck();
  }
  await page.waitForTimeout(80);
}

async function setViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.locator('.qa-viewport-field .qa-segmented button').nth(viewport.button).click();
  await page.waitForTimeout(60);
}

async function metrics(page, templateId) {
  return page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`).evaluate((root) => {
    const sections = [...root.querySelectorAll('[data-section]')].map((section) => section.getAttribute('data-section'));
    const navLinks = [...root.querySelectorAll('nav a')].map((link) => {
      const href = link.getAttribute('href') || '';
      return {
        href,
        label: link.textContent.trim().replace(/\s+/g, ' '),
        height: link.getBoundingClientRect().height,
        targetExists: href.startsWith('#') && Boolean(root.querySelector(href)),
      };
    });
    const anchors = [...root.querySelectorAll('a')].map((link) => ({
      href: link.getAttribute('href') || '',
      target: link.getAttribute('target') || '',
      rel: link.getAttribute('rel') || '',
      height: link.getBoundingClientRect().height,
      text: link.innerText.trim().replace(/\s+/g, ' '),
    }));
    const projectNodes = [...root.querySelectorAll('.blueprint-project,.bauhaus-project,.y2k-project,.pastel-project,.academic-project')];
    const main = root.querySelector('main');
    const clipping = [...root.querySelectorAll('h1,h2,h3,p,a,li')].filter((element) => {
      const style = getComputedStyle(element);
      const clips = ['hidden', 'clip'].includes(style.overflowX) || style.textOverflow === 'ellipsis' || (style.webkitLineClamp && style.webkitLineClamp !== 'none');
      return clips && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    }).map((element) => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 90), overflow: getComputedStyle(element).overflowX }));
    const decorativeSelectors = {
      blueprint: '.blueprint-drawing',
      bauhaus: '.bauhaus-composition,.bauhaus-project-composition',
      y2k: '.y2k-window-accent,.y2k-project-mark',
      pastel: '.pastel-composition,.pastel-project-mark',
      academic: '',
    };
    const selector = decorativeSelectors[root.getAttribute('data-template')] || '';
    const decorations = selector ? [...root.querySelectorAll(selector)] : [];
    const decorationA11y = decorations.every((element) => element.getAttribute('aria-hidden') === 'true' || Boolean(element.closest('[aria-hidden="true"]')));
    const h1 = root.querySelector('h1');
    return {
      template: root.getAttribute('data-template'),
      h1Count: root.querySelectorAll('h1').length,
      h1Text: h1?.textContent.trim().replace(/\s+/g, ' ') || '',
      mainCount: root.querySelectorAll('main').length,
      sectionOrder: sections,
      navLinks,
      anchors,
      rootWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      mainWidth: main?.clientWidth ?? null,
      mainScrollWidth: main?.scrollWidth ?? null,
      hasProjectsSection: Boolean(root.querySelector('[data-section="projects"]')),
      projectCount: projectNodes.length,
      projectTitles: projectNodes.map((article) => article.querySelector('h3')?.textContent.trim() || ''),
      hasEducation: Boolean(root.querySelector('[data-section="education"]')),
      hasContact: Boolean(root.querySelector('[data-section="contact"]')),
      imageCount: root.querySelectorAll('img,iframe,video').length,
      fakeControlCount: root.querySelectorAll('button,input,select,textarea,[role="button"]').length,
      localAnchorsResolve: [...root.querySelectorAll('a[href^="#"]')].every((link) => Boolean(root.querySelector(link.getAttribute('href')))),
      clipping,
      decorationCount: decorations.length,
      decorationA11y,
      text: root.innerText,
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

  // Five 5D renderers × A/B/C/D/D-no-project × 1440×900 and 390×844.
  for (const fixture of FIXTURES) {
    await setFixture(page, fixture.id, Boolean(fixture.noProjects));
    for (const viewport of VIEWPORTS) {
      await setViewport(page, viewport);
      for (const templateId of STYLE_IDS) {
        await page.locator('#qa-focus-style').selectOption(templateId);
        await page.waitForTimeout(35);
        const state = await metrics(page, templateId);
        const expectedProjectsSection = fixture.projects > 0;
        const navTargets = state.navLinks.every((link) => link.targetExists);
        const orderedNav = JSON.stringify(state.navLinks.map((link) => link.href)) === JSON.stringify(state.sectionOrder.map((section) => `#portfolio-${templateId}-section-${section}`));
        const targets44px = state.anchors.every((link) => link.height >= 43.5);
        const noHorizontalOverflow = state.rootScrollWidth <= state.rootWidth + 1 && state.mainScrollWidth <= state.mainWidth + 1;
        const expectedMissingDataHidden = fixture.id === 'D' || fixture.id === 'D-no-project'
          ? !state.hasEducation && !state.hasContact && !state.sectionOrder.includes('skills') && !state.sectionOrder.includes('highlights')
          : fixture.id === 'C' || fixture.id === 'B' || fixture.id === 'A'
            ? state.hasEducation
            : false;
        const longTextRetained = !fixture.long || (state.text.includes('Paragraph stress sample 7') && (fixture.noProjects ? !state.text.includes('Description segment 7') : state.text.includes('Description segment 7')));
        const correctName = state.h1Text.includes(fixture.name);
        const expectedProjectCount = state.projectCount === fixture.projects;
        const noFillerOrFakeChrome = state.imageCount === 0 && state.fakeControlCount === 0;
        const passed = state.template === templateId
          && state.h1Count === 1
          && state.mainCount === 1
          && JSON.stringify(state.sectionOrder) === JSON.stringify(fixture.sections)
          && state.hasProjectsSection === expectedProjectsSection
          && expectedProjectCount
          && navTargets
          && orderedNav
          && targets44px
          && noHorizontalOverflow
          && state.clipping.length === 0
          && correctName
          && longTextRetained
          && expectedMissingDataHidden
          && noFillerOrFakeChrome
          && state.localAnchorsResolve
          && state.decorationA11y;
        assert(passed, `${templateId} ${fixture.id} ${viewport.id} render, overflow, omission, order, and target check`, {
          sectionOrder: state.sectionOrder,
          expectedSections: fixture.sections,
          projectCount: state.projectCount,
          expectedProjects: fixture.projects,
          hasProjectsSection: state.hasProjectsSection,
          navTargets,
          orderedNav,
          targets44px,
          noHorizontalOverflow,
          clipping: state.clipping,
          correctName,
          longTextRetained,
          expectedMissingDataHidden,
          noFillerOrFakeChrome,
          decorationA11y: state.decorationA11y,
          dimensions: { root: [state.rootWidth, state.rootScrollWidth], main: [state.mainWidth, state.mainScrollWidth] },
        });
        results.renderCases.push({
          templateId,
          fixture: fixture.id,
          viewport: { id: viewport.id, width: viewport.width, height: viewport.height },
          passed,
          sections: state.sectionOrder,
          projectCount: state.projectCount,
          navigationLinks: state.navLinks.length,
          anchors: state.anchors.length,
          horizontalOverflow: !noHorizontalOverflow,
          clippedTextNodes: state.clipping.length,
          imageAndVideoElements: state.imageCount,
        });
      }
    }
  }

  // Direct URL/link behavior on the rich fixture: project links are real and external links are safe.
  await setFixture(page, 'C');
  await setViewport(page, VIEWPORTS[0]);
  const linkBehavior = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const links = await root.locator('a').evaluateAll((items) => items.map((link) => ({
      href: link.getAttribute('href') || '', target: link.getAttribute('target') || '', rel: link.getAttribute('rel') || '',
      label: (link.getAttribute('aria-label') || link.textContent || '').trim(),
    })));
    const safeNewTabs = links.filter((link) => link.target === '_blank').every((link) => link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    const projectUrl = links.some((link) => link.href === 'https://library-map.example.test/');
    const projectEntryCount = await root.locator(PROJECT_SELECTORS).count();
    const localLinksWork = await root.evaluate((element) => [...element.querySelectorAll('a[href^="#"]')].every((link) => Boolean(element.querySelector(link.getAttribute('href')))));
    const passed = safeNewTabs && projectUrl && projectEntryCount === 2 && localLinksWork;
    linkBehavior[templateId] = { linkCount: links.length, safeNewTabs, projectUrl, projectEntryCount, localLinksWork, links };
    assert(passed, `${templateId} project URLs and in-page navigation`, linkBehavior[templateId]);
  }
  results.behaviorChecks.links = linkBehavior;

  // Hiding Projects removes both its section and every navigation shortcut.
  await page.locator('#qa-hide-projects').check();
  const hiddenProjects = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const state = await metrics(page, templateId);
    const hasProjectAnchor = state.navLinks.some((link) => link.href === `#portfolio-${templateId}-section-projects`);
    const passed = !state.hasProjectsSection && state.projectCount === 0 && !hasProjectAnchor && state.navLinks.every((link) => link.targetExists);
    hiddenProjects[templateId] = { section: state.hasProjectsSection, projectCount: state.projectCount, hasProjectAnchor, navTargetsResolve: state.navLinks.every((link) => link.targetExists), passed };
    assert(passed, `${templateId} hidden Projects removes section and nav link`, hiddenProjects[templateId]);
  }
  await page.locator('#qa-hide-projects').uncheck();
  results.behaviorChecks.hiddenProjects = hiddenProjects;

  // Reorder DesignConfig and confirm visual DOM sequence and nav remain aligned.
  await page.locator('#qa-reverse-sections').check();
  const reversedOrder = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const state = await metrics(page, templateId);
    const expected = ['contact', 'highlights', 'projects', 'skills', 'education', 'about'];
    const navMatchesSections = JSON.stringify(state.navLinks.map((link) => link.href)) === JSON.stringify(expected.map((section) => `#portfolio-${templateId}-section-${section}`));
    const passed = JSON.stringify(state.sectionOrder) === JSON.stringify(expected) && navMatchesSections && state.navLinks.every((link) => link.targetExists);
    reversedOrder[templateId] = { sections: state.sectionOrder, navMatchesSections, passed };
    assert(passed, `${templateId} reordered section sequence and navigation`, reversedOrder[templateId]);
  }
  await page.locator('#qa-reverse-sections').uncheck();
  results.behaviorChecks.reorderedSections = reversedOrder;

  // Keyboard focus, reduced-motion preference, readable targets, and visual focus indicator.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const accessibility = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
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
    }));
    const targetHeights = await root.locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    const targetCheck = targetHeights.length > 0 && targetHeights.every((height) => height >= 43.5);
    const focusCheck = focus.focused && focus.visible && parseFloat(focus.outlineWidth) >= 2 && focus.outlineStyle !== 'none';
    const passed = targetCheck && focusCheck && reducedMotion.matches;
    accessibility[templateId] = { focus, reducedMotion, minTargetHeight: Math.min(...targetHeights), maxTargetHeight: Math.max(...targetHeights), targetCheck, focusCheck, passed };
    assert(passed, `${templateId} keyboard focus, reduced motion, and 44px targets`, accessibility[templateId]);
  }
  results.behaviorChecks.accessibility = accessibility;
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Explicit omission checks for education/links and honest empty projects; no image field exists.
  const omissions = {};
  for (const fixture of [FIXTURES[0], FIXTURES[4]]) {
    await setFixture(page, fixture.id, Boolean(fixture.noProjects));
    for (const templateId of STYLE_IDS) {
      await page.locator('#qa-focus-style').selectOption(templateId);
      const state = await metrics(page, templateId);
      const educationExpectation = fixture.id === 'D-no-project' ? !state.hasEducation : state.hasEducation;
      const passed = !state.hasProjectsSection && state.projectCount === 0 && !state.hasContact && educationExpectation && state.imageCount === 0;
      omissions[`${fixture.id}-${templateId}`] = { hasProjectsSection: state.hasProjectsSection, projectCount: state.projectCount, hasContact: state.hasContact, hasEducation: state.hasEducation, educationExpectation, imageCount: state.imageCount, passed };
      assert(passed, `${templateId} ${fixture.id} omits empty projects/contact/education and invented imagery`, omissions[`${fixture.id}-${templateId}`]);
    }
  }
  results.behaviorChecks.emptyAndMissingData = omissions;

  // Axe WCAG checks on a rich fixture for each style (including color contrast and landmark names).
  await setFixture(page, 'C');
  await setViewport(page, VIEWPORTS[0]);
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const axeResults = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const violations = await page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`).evaluate(async (root) => {
      const result = await window.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return result.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
    });
    axeResults[templateId] = violations;
    assert(violations.length === 0, `${templateId} Axe WCAG 2.1 A/AA audit`, violations);
  }
  results.audits.axeWcag = axeResults;

  // Capture full-page 5D samples at both requested viewports and a grayscale comparison.
  await setFixture(page, 'C');
  for (const viewport of VIEWPORTS) {
    await setViewport(page, viewport);
    for (const templateId of STYLE_IDS) {
      const frame = page.locator('.qa-focus-preview .preview-frame');
      await frame.evaluate((element) => { element.style.height = ''; element.style.minHeight = ''; element.style.overflow = ''; });
      await page.locator('#qa-focus-style').selectOption(templateId);
      const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
      await page.waitForTimeout(60);
      const height = await root.evaluate((site) => site.scrollHeight);
      await frame.evaluate((element, value) => { element.style.height = `${value}px`; element.style.minHeight = `${value}px`; element.style.overflow = 'visible'; }, height);
      const outPath = path.join(OUT, `qa-5d-${templateId}-${viewport.id}.png`);
      await root.screenshot({ path: outPath, animations: 'disabled' });
      results.audits[`${templateId}-${viewport.id}`] = { screenshot: path.basename(outPath), contentHeight: height };
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.qa-viewport-field .qa-segmented button').nth(0).click();
  await page.getByRole('button', { name: 'Compare the 5 Checkpoint 5D styles' }).click();
  await page.locator('#qa-five-d-grayscale-compare').check();
  await page.waitForTimeout(200);
  const comparisonPanelPath = path.join(OUT, 'qa-5d-grayscale-compare-panel-desktop.png');
  await page.locator('.qa-five-d-compare').screenshot({ path: comparisonPanelPath, animations: 'disabled' });
  results.audits.grayscaleComparisonPanel = path.basename(comparisonPanelPath);

  const styleNames = {
    blueprint: 'Blueprint / workshop',
    bauhaus: 'Bauhaus / geometric',
    y2k: 'Y2K / internet diary',
    pastel: 'Soft pastel / friendly',
    academic: 'Academic / reading room',
  };
  const contactSheetCards = STYLE_IDS.map((templateId) => {
    const imagePath = path.join(OUT, `qa-5d-${templateId}-desktop.png`);
    const imageData = fs.readFileSync(imagePath).toString('base64');
    return `<figure><figcaption>${styleNames[templateId]}</figcaption><img src="data:image/png;base64,${imageData}" alt="${styleNames[templateId]} full-page desktop screenshot, grayscale"/></figure>`;
  }).join('');
  const contactSheet = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await contactSheet.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Checkpoint 5D grayscale comparison</title><style>
    *{box-sizing:border-box}body{margin:0;padding:28px;background:#f5f5f2;color:#282a27;font:15px/1.45 Arial,sans-serif}
    main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:25px}
    figure{min-width:0;margin:0;padding:12px;border:1px solid #c8c9c5;background:#fff}
    figcaption{padding:0 0 9px;font-size:16px;font-weight:700}
    img{display:block;width:100%;height:auto;filter:grayscale(1)}
  </style></head><body><main>${contactSheetCards}</main></body></html>`, { waitUntil: 'load' });
  await contactSheet.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  const grayscalePath = path.join(OUT, 'qa-5d-grayscale-comparison-desktop.png');
  await contactSheet.screenshot({ path: grayscalePath, fullPage: true, animations: 'disabled' });
  results.audits.grayscaleComparison = path.basename(grayscalePath);
  await contactSheet.close();

  // Confirm published collision-pair metadata clears the documented distinctness threshold.
  await page.getByRole('button', { name: 'Compare all 22' }).click();
  const closestStyles = {
    blueprint: 'Notebook / terminal',
    bauhaus: 'Neo-brutalist',
    y2k: 'Pinboard / visual',
    pastel: 'Botanical / organic',
    academic: 'Newsprint / field notes',
  };
  const collisionChecks = {};
  for (const templateId of STYLE_IDS) {
    const card = page.locator(`.qa-card[aria-labelledby="qa-style-${templateId}"]`);
    const status = (await card.locator('.qa-status').innerText()).trim();
    const quickAudit = (await card.locator('.qa-quick-audit').innerText()).replace(/\s+/g, ' ').trim();
    const closestOk = quickAudit.includes(closestStyles[templateId]);
    const passed = status === 'Distinct' && closestOk;
    collisionChecks[templateId] = { status, expectedClosest: closestStyles[templateId], quickAudit, passed };
    assert(passed, `${templateId} structural collision audit against ${closestStyles[templateId]}`, collisionChecks[templateId]);
  }
  results.behaviorChecks.structuralCollisionPairs = collisionChecks;
  results.browserErrors = [...new Map(results.browserErrors.map((error) => [JSON.stringify(error), error])).values()];
  results.summary = {
    renderCasesPassed: results.renderCases.filter((item) => item.passed).length,
    renderCasesTotal: results.renderCases.length,
    failedChecks: results.failedChecks.length,
    browserErrors: results.browserErrors.length,
    axeViolations: Object.values(axeResults).reduce((total, items) => total + items.length, 0),
    extraChecks: Object.fromEntries(Object.entries(results.behaviorChecks).map(([key, value]) => [key, Object.values(value).filter((item) => item.passed !== false).length])),
  };
  fs.writeFileSync(path.join(OUT, 'qa-5d-browser-matrix.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results.summary, null, 2));
  if (results.failedChecks.length || results.browserErrors.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  process.exitCode = 1;
});
