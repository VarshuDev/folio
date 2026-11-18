import test from 'node:test';
import assert from 'node:assert/strict';
import { DesignConfigSchema, createDefaultDesign } from '@/lib/profile-schema';
import { getCustomizerTheme, ACCENT_PRESETS, FONT_PRESETS } from '@/lib/theme-customizer';

test('DesignConfigSchema: validates customizer fields with full backward compatibility', () => {
  // 1. Default legacy design config parses cleanly
  const defaultDesign = { ...createDefaultDesign(), templateId: 'editorial' as const };
  const parsedDefault = DesignConfigSchema.safeParse(defaultDesign);
  assert.equal(parsedDefault.success, true);
  if (parsedDefault.success) {
    assert.equal(parsedDefault.data.colorMode, undefined);
    assert.equal(parsedDefault.data.accentTone, undefined);
    assert.equal(parsedDefault.data.fontPairing, undefined);
  }

  // 2. Customized design config
  const customConfig = DesignConfigSchema.safeParse({
    ...defaultDesign,
    colorMode: 'dark',
    accentTone: 'terracotta',
    fontPairing: 'modern-sans',
  });
  assert.equal(customConfig.success, true);
  if (customConfig.success) {
    assert.equal(customConfig.data.colorMode, 'dark');
    assert.equal(customConfig.data.accentTone, 'terracotta');
    assert.equal(customConfig.data.fontPairing, 'modern-sans');
  }

  // 3. Invalid accent tone fails validation
  const invalidTone = DesignConfigSchema.safeParse({
    ...defaultDesign,
    accentTone: 'neon-pink-invalid',
  });
  assert.equal(invalidTone.success, false);
});

test('getCustomizerTheme: maps design options to CSS classes and CSS custom variables', () => {
  const baseDesign = { ...createDefaultDesign(), templateId: 'minimal' as const };

  // 1. Default settings produce clean theme
  const defaultTheme = getCustomizerTheme(baseDesign);
  assert.equal(defaultTheme.className.includes('theme-mode--dark'), false);

  // 2. Dark mode sets dark class and color variables
  const darkTheme = getCustomizerTheme({
    ...baseDesign,
    colorMode: 'dark',
  });
  assert.equal(darkTheme.className.includes('theme-mode--dark'), true);
  assert.equal((darkTheme.style as Record<string, string>)['--theme-bg'], '#141715');
  assert.equal((darkTheme.style as Record<string, string>)['--theme-text'], '#f4f6f4');

  // 3. Accent tone injection
  const accentTheme = getCustomizerTheme({
    ...baseDesign,
    accentTone: 'ocean',
  });
  assert.equal((accentTheme.style as Record<string, string>)['--theme-accent'], ACCENT_PRESETS.ocean.primary);

  // 4. Typography pairing injection
  const typographyTheme = getCustomizerTheme({
    ...baseDesign,
    fontPairing: 'technical-mono',
  });
  assert.equal((typographyTheme.style as Record<string, string>)['--theme-font-heading'].includes('monospace'), true);
});
