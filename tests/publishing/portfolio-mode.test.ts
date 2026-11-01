import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTFOLIO_MODES,
  PortfolioConfigSchema,
  AdvancedPortfolioConfigSchema,
  createDefaultAdvancedConfig,
  createDefaultPortfolioConfig,
  RESERVED_ADVANCED_ROUTES,
  type PortfolioConfig,
} from '../../lib/portfolio-mode';
import {
  DraftBundleSchema,
  createEmptyProfile,
  createDefaultDesign,
  type DraftBundle,
} from '../../lib/profile-schema';
import { POST as publishRoute } from '../../app/api/portfolio/publish/route';
import { GET as getAccountRoute, PUT as putAccountRoute } from '../../app/api/portfolio/account/route';
import { getPublishingRepository, getInMemoryStoreForTests } from '../../lib/publishing/repository';

test('Portfolio Mode: contract and defaults', async (t) => {
  await t.test('PORTFOLIO_MODES contains simple and advanced', () => {
    assert.deepEqual(PORTFOLIO_MODES, ['simple', 'advanced']);
  });

  await t.test('missing mode defaults to "simple"', () => {
    const parsed = PortfolioConfigSchema.parse({});
    assert.equal(parsed.mode, 'simple');
    assert.equal(parsed.advanced, undefined);
  });

  await t.test('createDefaultPortfolioConfig generates expected structure', () => {
    const simple = createDefaultPortfolioConfig('simple');
    assert.equal(simple.mode, 'simple');
    assert.equal(simple.advanced, undefined);

    const advanced = createDefaultPortfolioConfig('advanced');
    assert.equal(advanced.mode, 'advanced');
    assert.ok(advanced.advanced);
    assert.equal(advanced.advanced.themeId, 'advanced-minimal-v1');
    assert.equal(advanced.advanced.themeVersion, 1);
    assert.equal(advanced.advanced.pages.length, 5);
    assert.equal(advanced.advanced.navigation.items.length, 5);

    // Verify canonical 5 pages
    const pageTypes = advanced.advanced.pages.map((p) => p.type);
    assert.deepEqual(pageTypes, ['home', 'about', 'projects', 'experience', 'contact']);

    const home = advanced.advanced.pages.find((p) => p.type === 'home');
    assert.ok(home);
    assert.equal(home.slug, '');
    assert.equal(home.visible, true);
    assert.equal(home.order, 0);
  });
});

test('Portfolio Mode: Advanced config validation rules', async (t) => {
  const baseConfig = createDefaultAdvancedConfig();

  await t.test('valid default advanced config passes validation', () => {
    const parsed = AdvancedPortfolioConfigSchema.safeParse(baseConfig);
    assert.equal(parsed.success, true);
  });

  await t.test('rejects config without a home page', () => {
    const invalid = {
      ...baseConfig,
      pages: baseConfig.pages.filter((p) => p.type !== 'home'),
      navigation: {
        items: baseConfig.navigation.items.filter((item) => item.pageId !== 'page-home'),
      },
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('home page')));
  });

  await t.test('rejects home page with non-empty slug', () => {
    const invalid = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => (p.type === 'home' ? { ...p, slug: 'home' } : p)),
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Home page slug must be empty')));
  });

  await t.test('rejects hidden home page', () => {
    const invalid = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => (p.type === 'home' ? { ...p, visible: false } : p)),
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Home page must remain visible')));
  });

  await t.test('rejects duplicate page IDs', () => {
    const invalid = {
      ...baseConfig,
      pages: [
        ...baseConfig.pages.slice(0, 4),
        { ...baseConfig.pages[0], type: 'contact' as const, order: 4 },
      ],
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Duplicate page ID')));
  });

  await t.test('rejects duplicate page types', () => {
    const invalid = {
      ...baseConfig,
      pages: [
        baseConfig.pages[0],
        baseConfig.pages[1],
        { ...baseConfig.pages[1], id: 'page-about-2', order: 2, slug: 'about-2' },
      ],
      navigation: {
        items: [
          { pageId: baseConfig.pages[0].id, label: 'Home', visible: true },
          { pageId: baseConfig.pages[1].id, label: 'About', visible: true },
          { pageId: 'page-about-2', label: 'About 2', visible: true },
        ],
      },
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Duplicate page type')));
  });

  await t.test('rejects duplicate routes/slugs', () => {
    const invalid = {
      ...baseConfig,
      pages: [
        baseConfig.pages[0],
        baseConfig.pages[1],
        { ...baseConfig.pages[2], slug: 'about' }, // duplicate of about
      ],
      navigation: {
        items: [
          { pageId: baseConfig.pages[0].id, label: 'Home', visible: true },
          { pageId: baseConfig.pages[1].id, label: 'About', visible: true },
          { pageId: baseConfig.pages[2].id, label: 'Projects', visible: true },
        ],
      },
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Duplicate route/slug')));
  });

  await t.test('rejects reserved routes', () => {
    for (const reserved of RESERVED_ADVANCED_ROUTES.slice(0, 3)) {
      const invalid = {
        ...baseConfig,
        pages: baseConfig.pages.map((p) => (p.type === 'about' ? { ...p, slug: reserved } : p)),
      };
      const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
      assert.ok(parsed.error?.issues.some((i) => i.message.includes('reserved by the application')));
    }
  });

  await t.test('rejects duplicate page orders', () => {
    const invalid = {
      ...baseConfig,
      pages: baseConfig.pages.map((p) => (p.type === 'contact' ? { ...p, order: 1 } : p)),
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('Duplicate page order')));
  });

  await t.test('rejects navigation items pointing to non-existent page IDs', () => {
    const invalid = {
      ...baseConfig,
      navigation: {
        items: [
          ...baseConfig.navigation.items,
          { pageId: 'ghost-page-id', label: 'Ghost', visible: true },
        ],
      },
    };
    const parsed = AdvancedPortfolioConfigSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error?.issues.some((i) => i.message.includes('unknown pageId')));
  });
});

test('DraftBundle & Backward Compatibility', async (t) => {
  await t.test('parses existing draft bundle without portfolioConfig and preserves defaults', () => {
    const legacyBundle = {
      profile: createEmptyProfile(),
      design: createDefaultDesign(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = DraftBundleSchema.safeParse(legacyBundle);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.portfolioConfig, undefined);
    }
  });

  await t.test('parses draft bundle with portfolioConfig', () => {
    const advancedBundle: DraftBundle = {
      profile: createEmptyProfile(),
      design: createDefaultDesign(),
      portfolioConfig: createDefaultPortfolioConfig('advanced'),
      updatedAt: new Date().toISOString(),
    };
    const parsed = DraftBundleSchema.safeParse(advancedBundle);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.portfolioConfig?.mode, 'advanced');
      assert.equal(parsed.data.portfolioConfig?.advanced?.themeId, 'advanced-minimal-v1');
    }
  });

  await t.test('switching mode leaves ProfileDocument completely intact', () => {
    const profile = createEmptyProfile();
    profile.basics.name = 'Ada Lovelace';
    profile.basics.role = 'Computing Pioneer';
    profile.skills = ['Algorithms', 'Mathematics'];
    profile.projects = [
      { id: 'p1', title: 'Analytical Engine', description: 'Computing system', tools: 'Brass', link: 'https://example.com' },
    ];

    const design = createDefaultDesign();

    // Mode: Simple
    const simpleBundle: DraftBundle = {
      profile,
      design,
      portfolioConfig: { mode: 'simple' },
      updatedAt: new Date().toISOString(),
    };

    // Mode: Advanced
    const advancedBundle: DraftBundle = {
      profile: simpleBundle.profile, // Profile stays identical
      design: simpleBundle.design,   // Design stays identical
      portfolioConfig: createDefaultPortfolioConfig('advanced'),
      updatedAt: new Date().toISOString(),
    };

    // Switch back to Simple
    const returnedBundle: DraftBundle = {
      profile: advancedBundle.profile,
      design: advancedBundle.design,
      portfolioConfig: { mode: 'simple', advanced: advancedBundle.portfolioConfig?.advanced },
      updatedAt: new Date().toISOString(),
    };

    assert.deepEqual(returnedBundle.profile, profile);
    assert.deepEqual(returnedBundle.design, design);
  });
});

test('Publishing Safety: Advanced mode rejection', async (t) => {
  getInMemoryStoreForTests().clear();
  const userId = 'user-mode-test-1';
  const profile = createEmptyProfile();
  profile.basics.name = 'Test User';
  const design = createDefaultDesign();

  await t.test('rejects publishing request with mode: "advanced" with 422 unsupported_mode', async () => {
    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
      body: JSON.stringify({
        slug: 'test-user-adv',
        profile,
        design,
        mode: 'advanced',
      }),
    });

    const res = await publishRoute(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'unsupported_mode');
    assert.ok(data.error.includes('Advanced portfolio publishing is not available yet'));
  });

  await t.test('rejects publishing request with portfolioConfig.mode: "advanced" with 422', async () => {
    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
      body: JSON.stringify({
        slug: 'test-user-adv-cfg',
        profile,
        design,
        portfolioConfig: { mode: 'advanced' },
      }),
    });

    const res = await publishRoute(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'unsupported_mode');
  });

  await t.test('rejects publishing request if existing user draft is in advanced mode', async () => {
    const repo = getPublishingRepository();
    // Save draft in advanced mode
    await repo.saveDraft(userId, {
      profile,
      design,
      portfolioConfig: createDefaultPortfolioConfig('advanced'),
      updatedAt: new Date().toISOString(),
    });

    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
      body: JSON.stringify({
        slug: 'test-user-adv-draft',
        profile,
        design,
      }),
    });

    const res = await publishRoute(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'unsupported_mode');
  });

  await t.test('allows publishing when mode is explicitly simple', async () => {
    const req = new Request('http://localhost:3000/api/portfolio/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
      body: JSON.stringify({
        slug: 'test-user-simple-mode',
        profile,
        design,
        mode: 'simple',
      }),
    });

    const res = await publishRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.slug, 'test-user-simple-mode');
  });
});

test('Account API: Mode exposure and persistence', async (t) => {
  getInMemoryStoreForTests().clear();
  const userId = 'user-account-mode-test';
  const profile = createEmptyProfile();
  profile.basics.name = 'Account Mode User';
  const design = createDefaultDesign();

  await t.test('PUT persists portfolioConfig and GET retrieves it', async () => {
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
        portfolioConfig: createDefaultPortfolioConfig('advanced'),
        updatedAt: new Date().toISOString(),
      }),
    });

    const putRes = await putAccountRoute(putReq);
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.ok, true);

    const getReq = new Request('http://localhost:3000/api/portfolio/account', {
      method: 'GET',
      headers: {
        Authorization: `Bearer test-${userId}`,
        'x-folio-test-user-id': userId,
      },
    });

    const getRes = await getAccountRoute(getReq);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.ok, true);
    assert.equal(getData.portfolio.mode, 'advanced');
    assert.equal(getData.draft.portfolioConfig.mode, 'advanced');
    assert.equal(getData.draft.portfolioConfig.advanced.themeId, 'advanced-minimal-v1');
  });
});
