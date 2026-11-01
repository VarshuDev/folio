import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdvancedPortfolioConfigSchema,
  ALLOWED_PAGE_SECTIONS,
  createDefaultAdvancedConfig,
  createDefaultPortfolioConfig,
  getDefaultPageSections,
} from '../../lib/portfolio-mode';
import { createEmptyProfile, createDefaultDesign } from '../../lib/profile-schema';
import { GET as getAccountRoute, PUT as putAccountRoute } from '../../app/api/portfolio/account/route';
import { getInMemoryStoreForTests } from '../../lib/publishing/repository';

test('Advanced Editor: Section allowlists and default sections', async (t) => {
  await t.test('all 5 canonical page types return their default sections', () => {
    const homeSections = getDefaultPageSections('home');
    assert.deepEqual(
      homeSections.map((s) => s.key),
      ['hero', 'summary', 'highlights', 'projects', 'links'],
    );
    assert.ok(homeSections.every((s) => s.visible === true));

    const aboutSections = getDefaultPageSections('about');
    assert.deepEqual(
      aboutSections.map((s) => s.key),
      ['summary', 'education', 'skills', 'activities', 'learning'],
    );

    const projectsSections = getDefaultPageSections('projects');
    assert.deepEqual(
      projectsSections.map((s) => s.key),
      ['projects', 'links'],
    );

    const expSections = getDefaultPageSections('experience');
    assert.deepEqual(
      expSections.map((s) => s.key),
      ['activities', 'highlights', 'education', 'learning'],
    );

    const contactSections = getDefaultPageSections('contact');
    assert.deepEqual(
      contactSections.map((s) => s.key),
      ['contact', 'location'],
    );
  });

  await t.test('default sections strictly respect ALLOWED_PAGE_SECTIONS allowlists', () => {
    for (const pageType of ['home', 'about', 'projects', 'experience', 'contact'] as const) {
      const allowed = new Set(ALLOWED_PAGE_SECTIONS[pageType]);
      const defaults = getDefaultPageSections(pageType);
      for (const section of defaults) {
        assert.ok(allowed.has(section.key), `Section ${section.key} must be allowed on ${pageType}`);
      }
    }
  });

  await t.test('rejects disallowed sections on a page', () => {
    const baseConfig = createDefaultAdvancedConfig();
    // Try to attach 'projects' section to 'contact' page
    const invalidConfig = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => {
        if (p.type === 'contact') {
          return {
            ...p,
            sections: [
              ...(p.sections || []),
              { key: 'projects' as const, visible: true },
            ],
          };
        }
        return p;
      }),
    };

    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalidConfig);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('is not allowed on')));
  });

  await t.test('rejects duplicate sections on the same page', () => {
    const baseConfig = createDefaultAdvancedConfig();
    // Duplicate 'projects' on home page
    const invalidConfig = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => {
        if (p.type === 'home') {
          return {
            ...p,
            sections: [
              ...(p.sections || []),
              { key: 'projects' as const, visible: false },
            ],
          };
        }
        return p;
      }),
    };

    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalidConfig);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Duplicate section "projects"')));
  });

  await t.test('accepts reordered and toggled sections when compliant with allowlist', () => {
    const baseConfig = createDefaultAdvancedConfig();
    const validConfig = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => {
        if (p.type === 'home') {
          return {
            ...p,
            sections: [
              { key: 'links' as const, visible: false },
              { key: 'projects' as const, visible: true },
              { key: 'highlights' as const, visible: true },
              { key: 'summary' as const, visible: true },
              { key: 'hero' as const, visible: true },
            ],
          };
        }
        return p;
      }),
    };

    const parsed = AdvancedPortfolioConfigSchema.safeParse(validConfig);
    assert.equal(parsed.success, true);
  });
});

test('Advanced Editor: Page management and site title', async (t) => {
  const baseConfig = createDefaultAdvancedConfig();

  await t.test('disabling optional pages is valid', () => {
    const validConfig = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => {
        if (p.type === 'experience' || p.type === 'contact') {
          return { ...p, visible: false };
        }
        return p;
      }),
    };

    const parsed = AdvancedPortfolioConfigSchema.safeParse(validConfig);
    assert.equal(parsed.success, true);
  });

  await t.test('validates siteTitle correctly', () => {
    const withTitle = {
      ...baseConfig,
      siteTitle: 'Jane Doe — Principal Design Architect',
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(withTitle);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.siteTitle, 'Jane Doe — Principal Design Architect');
    }

    const overlongTitle = {
      ...baseConfig,
      siteTitle: 'A'.repeat(121),
    };
    const overlongParsed = AdvancedPortfolioConfigSchema.safeParse(overlongTitle);
    assert.equal(overlongParsed.success, false);
  });
});

test('Advanced Editor: Account API page counts', async (t) => {
  getInMemoryStoreForTests().clear();
  const userId = 'user-adv-counts-test';
  const profile = createEmptyProfile();
  profile.basics.name = 'Adv Counts User';
  const design = createDefaultDesign();

  const advConfig = createDefaultPortfolioConfig('advanced');
  // Disable 2 optional pages (e.g. experience and contact)
  if (advConfig.advanced) {
    advConfig.advanced.pages = advConfig.advanced.pages.map((p) => {
      if (p.type === 'experience' || p.type === 'contact') {
        return { ...p, visible: false };
      }
      return p;
    });
  }

  const putReq = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
    body: JSON.stringify({
      profile,
      design,
      portfolioConfig: advConfig,
      updatedAt: new Date().toISOString(),
    }),
  });

  const putRes = await putAccountRoute(putReq);
  assert.equal(putRes.status, 200);

  const getReq = new Request('http://localhost:3000/api/portfolio/account', {
    method: 'GET',
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
  });

  const getRes = await getAccountRoute(getReq);
  assert.equal(getRes.status, 200);
  const data = await getRes.json();
  assert.equal(data.ok, true);
  assert.equal(data.portfolio.mode, 'advanced');
  assert.equal(data.portfolio.totalPagesCount, 5);
  assert.equal(data.portfolio.activePagesCount, 3);
});
