import type { CSSProperties } from 'react';
import type { DesignConfig, ColorMode, AccentTone, FontPairing } from '@/lib/profile-schema';

export interface ThemeCustomizerVariables {
  className: string;
  style: CSSProperties;
}

export const ACCENT_PRESETS: Record<AccentTone, { label: string; primary: string; light: string; hover: string }> = {
  default: { label: 'Default Theme', primary: '#355d48', light: '#edf4f0', hover: '#294838' },
  evergreen: { label: 'Deep Forest', primary: '#1e4632', light: '#e8f3ed', hover: '#153324' },
  terracotta: { label: 'Warm Terracotta', primary: '#c05621', light: '#feebc8', hover: '#9c4221' },
  ocean: { label: 'Ocean Pacific', primary: '#2b6cb0', light: '#ebf8ff', hover: '#2c5282' },
  lavender: { label: 'Soft Lavender', primary: '#6b46c1', light: '#faf5ff', hover: '#553c9a' },
  slate: { label: 'Cool Slate', primary: '#4a5568', light: '#edf2f7', hover: '#2d3748' },
  amber: { label: 'Warm Amber', primary: '#b7791f', light: '#fefcbf', hover: '#975a16' },
};

export const FONT_PRESETS: Record<FontPairing, { label: string; description: string }> = {
  default: { label: 'Style Default', description: 'Curated font pairing for this theme' },
  'editorial-serif': { label: 'Editorial Serif', description: 'Classic literary display with clean body' },
  'modern-sans': { label: 'Modern Sans', description: 'Crisp, contemporary geometric sans-serif' },
  'technical-mono': { label: 'Technical Mono', description: 'Code-inspired monospaced precision' },
};

export function getCustomizerTheme(design: DesignConfig): ThemeCustomizerVariables {
  const customStyles: Record<string, string> = {};
  const classNames: string[] = [];

  const colorMode = design.colorMode || 'light';
  const accent = design.accentTone && design.accentTone !== 'default' ? ACCENT_PRESETS[design.accentTone] : null;
  const font = design.fontPairing || 'default';

  if (colorMode === 'dark') {
    classNames.push('theme-mode--dark');
    customStyles['--theme-bg'] = '#141715';
    customStyles['--theme-surface'] = '#1c211e';
    customStyles['--theme-card'] = '#212723';
    customStyles['--theme-text'] = '#f4f6f4';
    customStyles['--theme-text-muted'] = '#a2ada6';
    customStyles['--theme-border'] = '#2d3530';
  } else if (colorMode === 'light') {
    classNames.push('theme-mode--light');
  }

  if (accent) {
    customStyles['--theme-accent'] = accent.primary;
    customStyles['--theme-accent-light'] = accent.light;
    customStyles['--theme-accent-hover'] = accent.hover;
  }

  if (font === 'editorial-serif') {
    customStyles['--theme-font-heading'] = 'Georgia, Cambria, "Times New Roman", serif';
  } else if (font === 'modern-sans') {
    customStyles['--theme-font-heading'] = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  } else if (font === 'technical-mono') {
    customStyles['--theme-font-heading'] = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    customStyles['--theme-font-body'] = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  }

  return {
    className: classNames.join(' '),
    style: customStyles as CSSProperties,
  };
}
