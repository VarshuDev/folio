const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const STYLE_IDS = ['newsprint', 'brutalist', 'botanical', 'gallery', 'terminal'];
const FIXTURES = [
  { id: 'A', sections: ['about', 'education', 'skills'] },
  { id: 'B', sections: ['about', 'education', 'skills', 'projects'] },
  { id: 'C', sections: ['about', 'education', 'skills', 'projects', 'highlights', 'contact'] },
  { id: 'D', sections: ['about', 'projects'] },
  { id: 'D-no-project', sections: ['about'] },
];
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, button: 0 },
  { id: 'mobile', width: 390, height: 844, button: 1 },
];
const OUT = process.cwd();
const results = {
  checkpoint: '5C',
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

async function styleMetrics(page, templateId) {
  return page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`).evaluate((root) => {
    const sections = [...root.querySelectorAll('[data-section]')].map((section) => section.getAttribute('data-section'));
    const navLinks = [...root.querySelectorAll('nav a')].map((link) => ({
      href: link.getAttribute('href'),
      label: link.textContent.trim().replace(/\s+/g, ' '),
      minHeight: parseFloat(getComputedStyle(link).minHeight) || 0,
      height: link.getBoundingClientRect().height,
      targetExists: Boolean(link.getAttribute('href')?.startsWith('#') && root.querySelector(link.getAttribute('href'))),
    }));
    const anchors = [...root.querySelectorAll('a')].map((link) => ({
      href: link.getAttribute('href'),
      target: link.getAttribute('target'),
      rel: link.getAttribute('rel') || '',
      height: link.getBoundingClientRect().height,
      minHeight: parseFloat(getComputedStyle(link).minHeight) || 0,
      display: getComputedStyle(link).display,
    }));
    const aboutBody = root.querySelector('[data-section="about"] .newsprint-section-body');
    const galleryProject = root.querySelector('.gallery-project');
    const notebookBody = root.querySelector('.notebook-section-body p, .notebook-project-copy p');
    const notebookSheet = root.querySelector('.notebook-sheet');
    const highlightItem = root.querySelector('[data-section="highlights"] .main-highlight-list li');
    const main = root.querySelector('main');
    return {
      template: root.getAttribute('data-template'),
      h1Count: root.querySelectorAll('h1').length,
      mainCount: root.querySelectorAll('main').length,
      sectionOrder: sections,
      navLinks,
      anchors,
      imgCount: root.querySelectorAll('img').length,
      rootWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      mainWidth: main?.clientWidth ?? null,
      mainScrollWidth: main?.scrollWidth ?? null,
      hasProjectsSection: Boolean(root.querySelector('[data-section="projects"]')),
      projectCount: root.querySelectorAll('[class*="project"] article, .newsprint-project, .brutalist-project, .botanical-project, .gallery-project, .notebook-project').length,
      aboutColumnCount: aboutBody ? getComputedStyle(aboutBody).columnCount : null,
      galleryArtFirst: galleryProject ? galleryProject.firstElementChild?.classList.contains('gallery-project-art') : null,
      galleryArtHeight: root.querySelector('.gallery-project-art')?.getBoundingClientRect().height ?? null,
      notebookBackground: notebookSheet ? getComputedStyle(notebookSheet).backgroundColor : null,
      notebookRootFont: notebookSheet ? getComputedStyle(root).fontFamily : null,
      notebookBodyFont: notebookBody ? getComputedStyle(notebookBody).fontFamily : null,
      notebookHasPre: Boolean(root.querySelector('pre, code, .terminal-output, .console-output')),
      highlightItemDisplay: highlightItem ? getComputedStyle(highlightItem).display : null,
      highlightItemGridColumns: highlightItem ? getComputedStyle(highlightItem).gridTemplateColumns : null,
      text: root.innerText,
    };
  });
}

async function setFixture(page, fixtureId, noProjects = false) {
  await page.locator('#qa-fixture').selectOption(fixtureId);
  if (fixtureId === 'D') {
    const noProjectInput = page.locator('label.qa-edge-toggle').filter({ hasText: 'D subcase: no projects' }).locator('input');
    if (noProjects && !(await noProjectInput.isChecked())) await noProjectInput.check();
    if (!noProjects && (await noProjectInput.isChecked())) await noProjectInput.uncheck();
  }
  await page.waitForTimeout(80);
}

async function setViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.locator('.qa-viewport-field .qa-segmented button').nth(viewport.button).click();
  await page.waitForTimeout(60);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => results.browserErrors.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') results.browserErrors.push({ type: 'console', message: message.text() });
  });
  page.on('requestfailed', (request) => results.browserErrors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));

  await page.goto('http://127.0.0.1:3000/template-demos', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Focus one style' }).click();
  await page.locator('#qa-focus-style').waitFor();

  // Full matrix: five 5C renderers × five shared fixture states × exact desktop/mobile viewports.
  for (const fixture of FIXTURES) {
    const fixtureId = fixture.id === 'D-no-project' ? 'D' : fixture.id;
    await setFixture(page, fixtureId, fixture.id === 'D-no-project');
    for (const viewport of VIEWPORTS) {
      await setViewport(page, viewport);
      for (const templateId of STYLE_IDS) {
        await page.locator('#qa-focus-style').selectOption(templateId);
        await page.waitForTimeout(25);
        const metrics = await styleMetrics(page, templateId);
        const expectedSections = fixture.sections;
        const navTargetOk = metrics.navLinks.every((link) => link.targetExists);
        const allTargetsLarge = metrics.anchors.every((anchor) => anchor.height >= 43.5);
        const noOverflow = metrics.rootScrollWidth <= metrics.rootWidth + 1 && metrics.mainScrollWidth <= metrics.mainWidth + 1;
        const mobileColumnsOk = templateId !== 'newsprint' || viewport.id !== 'mobile' || metrics.aboutColumnCount === '1';
        const desktopColumnsOk = templateId !== 'newsprint' || viewport.id !== 'desktop' || metrics.aboutColumnCount === '2';
        const noProjectFixtureOk = fixture.id !== 'D-no-project' || !metrics.hasProjectsSection;
        const notebookFontOk = templateId !== 'terminal' || (!/mono/i.test(metrics.notebookRootFont) && !/mono/i.test(metrics.notebookBodyFont) && metrics.notebookBackground !== 'rgb(17, 23, 19)' && !metrics.notebookHasPre);
        const galleryOrderOk = templateId !== 'gallery' || !metrics.hasProjectsSection || metrics.galleryArtFirst === true;
        const highlightLayoutOk = !metrics.sectionOrder.includes('highlights') || metrics.highlightItemDisplay !== 'grid';
        const passed = metrics.template === templateId
          && metrics.h1Count === 1
          && metrics.mainCount === 1
          && JSON.stringify(metrics.sectionOrder) === JSON.stringify(expectedSections)
          && navTargetOk
          && allTargetsLarge
          && noOverflow
          && mobileColumnsOk
          && desktopColumnsOk
          && noProjectFixtureOk
          && notebookFontOk
          && galleryOrderOk
          && highlightLayoutOk
          && metrics.imgCount === 0;
        assert(passed, `${templateId} ${fixture.id} ${viewport.id} render/accessibility layout check`, {
          template: metrics.template,
          sectionOrder: metrics.sectionOrder,
          expectedSections,
          navTargetOk,
          allTargetsLarge,
          noOverflow,
          mobileColumnsOk,
          desktopColumnsOk,
          noProjectFixtureOk,
          notebookFontOk,
          galleryOrderOk,
          highlightLayoutOk,
          highlightItemDisplay: metrics.highlightItemDisplay,
          imgCount: metrics.imgCount,
          dimensions: { root: [metrics.rootWidth, metrics.rootScrollWidth], main: [metrics.mainWidth, metrics.mainScrollWidth] },
          aboutColumnCount: metrics.aboutColumnCount,
          notebookRootFont: metrics.notebookRootFont,
          notebookBodyFont: metrics.notebookBodyFont,
          notebookBackground: metrics.notebookBackground,
        });
        results.renderCases.push({
          templateId,
          fixture: fixture.id,
          viewport: { id: viewport.id, width: viewport.width, height: viewport.height },
          passed,
          sections: metrics.sectionOrder,
          navigationLinks: metrics.navLinks.length,
          anchors: metrics.anchors.length,
          horizontalOverflow: !noOverflow,
          imageElements: metrics.imgCount,
          aboutColumnCount: metrics.aboutColumnCount,
        });
      }
    }
  }

  // Direct behavior checks using fixture C (full profile, project URL, section nav).
  await setFixture(page, 'C');
  await setViewport(page, VIEWPORTS[0]);
  const behavior = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const checkLinks = await root.locator('a').evaluateAll((links) => links.map((link) => ({
      href: link.getAttribute('href') || '',
      target: link.getAttribute('target') || '',
      rel: link.getAttribute('rel') || '',
      label: (link.getAttribute('aria-label') || link.textContent || '').trim(),
    })));
    const validTargets = checkLinks.filter((link) => link.target === '_blank').every((link) => link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    const localAnchorsResolve = await root.evaluate((element) => [...element.querySelectorAll('a[href^="#"]')].every((link) => Boolean(element.querySelector(link.getAttribute('href')))));
    const includesProjectUrl = checkLinks.some((link) => link.href === 'https://library-map.example.test/');
    behavior[templateId] = { linkCount: checkLinks.length, validTargets, localAnchorsResolve, includesProjectUrl, links: checkLinks };
    assert(validTargets && localAnchorsResolve && includesProjectUrl, `${templateId} project/contact/section links`, behavior[templateId]);
  }
  results.behaviorChecks.links = behavior;

  // Projects visibility must remove both the section and all navigation shortcuts.
  await page.locator('#qa-hide-projects').check();
  const hiddenProjects = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const state = await root.evaluate((element) => ({
      section: Boolean(element.querySelector('[data-section="projects"]')),
      projectNav: [...element.querySelectorAll('nav a')].some((link) => /^(work|builds|field notes|projects)$/i.test(link.textContent.trim())),
      navTargetsResolve: [...element.querySelectorAll('nav a')].every((link) => Boolean(element.querySelector(link.getAttribute('href')))),
    }));
    hiddenProjects[templateId] = state;
    assert(!state.section && !state.projectNav && state.navTargetsResolve, `${templateId} hidden Projects removes section and shortcut`, state);
  }
  await page.locator('#qa-hide-projects').uncheck();
  results.behaviorChecks.hiddenProjects = hiddenProjects;

  // Reverse the design order and verify both semantic section order and nav targets follow it.
  await page.locator('#qa-reverse-sections').check();
  const reversed = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const state = await root.evaluate((element) => ({
      sections: [...element.querySelectorAll('[data-section]')].map((section) => section.getAttribute('data-section')),
      navTargets: [...element.querySelectorAll('nav a')].map((link) => ({ href: link.getAttribute('href'), exists: Boolean(element.querySelector(link.getAttribute('href'))) })),
    }));
    const expected = ['contact', 'highlights', 'projects', 'skills', 'education', 'about'];
    const passed = JSON.stringify(state.sections) === JSON.stringify(expected) && state.navTargets.every((item) => item.exists);
    reversed[templateId] = { ...state, passed };
    assert(passed, `${templateId} reversed order and navigation`, reversed[templateId]);
  }
  await page.locator('#qa-reverse-sections').uncheck();
  results.behaviorChecks.reversedOrder = reversed;

  // Keyboard focus visibility, reduced motion, and genuine 44px links.
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
    const motion = await root.evaluate((element) => ({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transitionDuration: getComputedStyle(element.querySelector('a')).transitionDuration,
    }));
    const targetHeights = await root.locator('a').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    const targetsOk = targetHeights.every((height) => height >= 43.5);
    const focusOk = focus.focused && focus.visible && parseFloat(focus.outlineWidth) >= 2 && focus.outlineStyle !== 'none';
    const motionOk = motion.reduced;
    accessibility[templateId] = { focus, motion, minTargetHeight: Math.min(...targetHeights), maxTargetHeight: Math.max(...targetHeights), targetsOk, focusOk, motionOk };
    assert(focusOk && motionOk && targetsOk, `${templateId} keyboard focus, reduced motion, and touch target check`, accessibility[templateId]);
  }
  results.behaviorChecks.accessibility = accessibility;
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Long-copy retention and no-project/missing-image behavior.
  await setFixture(page, 'D');
  const longCopy = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const text = await root.innerText();
    const project = root.locator('[data-section="projects"]');
    const projectText = await project.innerText();
    const passed = text.includes('Paragraph stress sample 7') && projectText.includes('Description segment 7') && !(await root.locator('img').count());
    longCopy[templateId] = { longAbout: text.includes('Paragraph stress sample 7'), longProject: projectText.includes('Description segment 7'), imageCount: await root.locator('img').count() };
    assert(passed, `${templateId} retains long text and uses no profile image`, longCopy[templateId]);
  }
  await setFixture(page, 'D', true);
  const noProject = {};
  for (const templateId of STYLE_IDS) {
    await page.locator('#qa-focus-style').selectOption(templateId);
    const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
    const state = await root.evaluate((element) => ({
      sectionOrder: [...element.querySelectorAll('[data-section]')].map((section) => section.getAttribute('data-section')),
      projects: Boolean(element.querySelector('[data-section="projects"]')),
      navLabels: [...element.querySelectorAll('nav a')].map((link) => link.textContent.trim()),
      images: element.querySelectorAll('img').length,
    }));
    const passed = !state.projects && !state.navLabels.some((label) => /^(work|builds|field notes|projects)$/i.test(label)) && state.images === 0;
    noProject[templateId] = { ...state, passed };
    assert(passed, `${templateId} no-project state omits Projects and image filler`, noProject[templateId]);
  }
  results.behaviorChecks.longCopy = longCopy;
  results.behaviorChecks.noProjectAndMissingImage = noProject;

  // Capture five standalone exact-size examples on fixture C, then the 5C grayscale comparison.
  await setFixture(page, 'C');
  for (const viewport of VIEWPORTS) {
    await setViewport(page, viewport);
    for (const templateId of STYLE_IDS) {
      const frame = page.locator('.qa-focus-preview .preview-frame');
      await frame.evaluate((element) => { element.style.height = ''; element.style.minHeight = ''; element.style.overflow = ''; });
      await page.locator('#qa-focus-style').selectOption(templateId);
      const root = page.locator(`.qa-focus-preview .portfolio-site[data-template="${templateId}"]`);
      await page.waitForTimeout(40);
      await frame.evaluate((element) => {
        const site = element.querySelector('.portfolio-site');
        const height = site.scrollHeight;
        element.style.height = `${height}px`;
        element.style.minHeight = `${height}px`;
        element.style.overflow = 'visible';
      });
      const outPath = path.join(OUT, `qa-5c-${templateId}-${viewport.id}.png`);
      await root.screenshot({ path: outPath, animations: 'disabled' });
      results.audits[`${templateId}-${viewport.id}`] = { screenshot: path.basename(outPath), metrics: await styleMetrics(page, templateId) };
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.qa-viewport-field .qa-segmented button').nth(0).click();
  await page.locator('#qa-mode-label').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Compare the 5 Checkpoint 5C styles' }).click();
  await page.locator('#qa-five-c-grayscale-compare').check();
  await page.waitForTimeout(180);
  const comparisonPath = path.join(OUT, 'qa-5c-grayscale-comparison-desktop.png');
  await page.locator('.qa-five-c-compare').screenshot({ path: comparisonPath, animations: 'disabled' });
  results.audits.grayscaleComparison = path.basename(comparisonPath);

  // Verify the published structural-audit collision pairs in the all-style comparison.
  await page.getByRole('button', { name: 'Compare all 22' }).click();
  const closestStyles = {
    newsprint: 'Retro / print-inspired',
    brutalist: 'Swiss grid / studio',
    botanical: 'Editorial',
    gallery: 'Editorial',
    terminal: 'Gaming / arcade',
  };
  const collisionChecks = {};
  for (const templateId of STYLE_IDS) {
    const card = page.locator(`.qa-card[aria-labelledby="qa-style-${templateId}"]`);
    const status = (await card.locator('.qa-status').innerText()).trim();
    const quickAudit = (await card.locator('.qa-quick-audit').innerText()).replace(/\\s+/g, ' ').trim();
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
    extraChecks: Object.fromEntries(Object.entries(results.behaviorChecks).map(([key, value]) => [key, key === 'links' || key === 'hiddenProjects' || key === 'reversedOrder' || key === 'accessibility' || key === 'noProjectAndMissingImage' || key === 'longCopy' ? Object.values(value).filter((item) => item.passed !== false && item.focusOk !== false && item.targetsOk !== false && item.motionOk !== false).length : Object.keys(value).length])),
  };
  fs.writeFileSync(path.join(OUT, 'qa-5c-browser-matrix.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results.summary, null, 2));
  if (results.failedChecks.length || results.browserErrors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
