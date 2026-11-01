const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, button: 0 },
  { id: 'mobile', width: 390, height: 844, button: 1 },
];
const results = { checkpoint: '7A all-style accessibility', styles: [], cases: [], browserErrors: [], failedChecks: [] };

function assert(condition, message, details) {
  if (!condition) results.failedChecks.push({ message, details });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => results.browserErrors.push({ type: 'pageerror', message: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') results.browserErrors.push({ type: 'console', message: message.text() }); });
  page.on('requestfailed', (request) => results.browserErrors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));

  await page.goto(`${BASE_URL}/template-demos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Focus one style' }).click();
  await page.locator('#qa-focus-style').waitFor();
  const styles = await page.locator('#qa-focus-style option').evaluateAll((items) => items.map((item) => ({ id: item.value, name: item.textContent.trim() })));
  results.styles = styles;
  assert(styles.length === 22, 'all 22 catalog styles are available in the focused renderer', styles);
  await page.locator('#qa-fixture').selectOption('C');
  await page.addScriptTag({ path: require.resolve('axe-core') });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.locator('.qa-viewport-field .qa-segmented button').nth(viewport.button).click();
    for (const style of styles) {
      await page.locator('#qa-focus-style').selectOption(style.id);
      const site = page.locator(`.qa-focus-preview .portfolio-site[data-template="${style.id}"]`);
      await site.waitFor();
      await page.waitForTimeout(30);
      const metrics = await site.evaluate((root) => ({
        template: root.getAttribute('data-template'),
        h1Count: root.querySelectorAll('h1').length,
        mainCount: root.querySelectorAll('main').length,
        width: root.clientWidth,
        scrollWidth: root.scrollWidth,
        sectionCount: root.querySelectorAll('[data-section]').length,
      }));
      const violations = await site.evaluate(async (root) => {
        const result = await window.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
        return result.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
      });
      const passed = metrics.template === style.id && metrics.h1Count === 1 && metrics.width > 0
        && metrics.scrollWidth <= metrics.width + 1 && violations.length === 0;
      const entry = { style: style.id, name: style.name, viewport: viewport.id, metrics, axeViolations: violations, passed };
      results.cases.push(entry);
      assert(passed, `${style.id} ${viewport.id} single h1/main, no horizontal overflow, and zero WCAG 2.1 A/AA Axe violations`, entry);
    }
  }

  results.browserErrors = [...new Map(results.browserErrors.map((item) => [JSON.stringify(item), item])).values()];
  results.summary = {
    styles: styles.length,
    casesPassed: results.cases.filter((item) => item.passed).length,
    casesTotal: results.cases.length,
    axeViolations: results.cases.reduce((count, item) => count + item.axeViolations.length, 0),
    browserErrors: results.browserErrors.length,
    failedChecks: results.failedChecks.length,
  };
  fs.writeFileSync(path.join(process.cwd(), 'qa-7a-style-accessibility.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results.summary, null, 2));
  if (results.failedChecks.length || results.browserErrors.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
