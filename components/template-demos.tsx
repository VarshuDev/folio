'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { PortfolioPreview } from '@/components/portfolio-preview';
import { getStructuralAuditCounts, TEMPLATE_CATALOG, type TemplateMeta } from '@/lib/template-catalog';
import { createDefaultDesign, type TemplateId } from '@/lib/profile-schema';
import { getStyleAuditFixture, STYLE_AUDIT_FIXTURES, type StyleAuditFixtureId } from '@/lib/style-audit-fixtures';
import { loadLocalDraft, saveLocalDraft, createEmptyDraft } from '@/lib/local-draft';

type AuditViewport = 'desktop' | 'mobile';
type GalleryCategory = 'all' | 'editorial' | 'minimal' | 'expressive' | 'technical';

const CURATED_CATEGORIES: Record<GalleryCategory, TemplateId[]> = {
  all: TEMPLATE_CATALOG.map((t) => t.id),
  editorial: ['editorial', 'newsprint', 'documentary', 'academic', 'case-study'],
  minimal: ['minimal', 'swiss', 'gallery', 'botanical'],
  expressive: ['retro', 'pinboard', 'arcade', 'y2k', 'bauhaus', 'zine', 'after-hours', 'community', 'brutalist'],
  technical: ['terminal', 'blueprint', 'project', 'pastel'],
};

const ART_DIRECTION_FIELDS = [
  ['positioning', 'Positioning'],
  ['composition', 'Composition / grid'],
  ['navigation', 'Navigation'],
  ['hero', 'Hero'],
  ['projects', 'Projects'],
  ['sectionRhythm', 'Section rhythm'],
  ['typography', 'Typography'],
  ['imageTreatment', 'Image treatment'],
  ['spacing', 'Spacing'],
  ['decoration', 'Decoration'],
  ['mobileTransformation', 'Mobile transformation'],
  ['interaction', 'Interaction'],
] as const;

function ArtDirectionDetails({ template }: { template: TemplateMeta }) {
  const counts = getStructuralAuditCounts(template);
  const closest = TEMPLATE_CATALOG.find((item) => item.id === template.structuralAudit.closestId);
  return (
    <details className="qa-spec-details">
      <summary>Art direction &amp; layout specifications</summary>
      <dl className="qa-spec-list">
        {ART_DIRECTION_FIELDS.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{template.artDirection[key]}</dd>
          </div>
        ))}
      </dl>
      <div className={`qa-audit-result ${counts.passes ? 'is-pass' : 'is-below'}`}>
        <div className="qa-audit-score">
          <strong>{counts.passes ? 'Meets distinctness threshold' : 'Alternative styling'}</strong>
          <span>{counts.structural}/6 structural · {counts.visible}/4 visible</span>
        </div>
        <p><b>Closest aesthetic relative:</b> {closest?.name ?? template.structuralAudit.closestId}.</p>
        <p>{template.structuralAudit.evidence}</p>
        <div className="qa-audit-chips" aria-label="Counted differences">
          {template.structuralAudit.changedDimensions.map((item) => (
            <span key={`s-${item}`}>Structure: {item}</span>
          ))}
          {template.structuralAudit.visibleDifferences.map((item) => (
            <span key={`v-${item}`}>Visible: {item}</span>
          ))}
        </div>
      </div>
    </details>
  );
}

function designForTemplate(
  baseDesign: ReturnType<typeof createDefaultDesign>,
  templateId: TemplateId,
  projectsHidden = false,
  reverseSections = false
) {
  return {
    ...baseDesign,
    templateId,
    sectionOrder: reverseSections ? [...baseDesign.sectionOrder].reverse() : baseDesign.sectionOrder,
    visibleSections: { ...baseDesign.visibleSections, projects: !projectsHidden && baseDesign.visibleSections.projects },
  };
}

export function TemplateDemos() {
  const [fixtureId, setFixtureId] = useState<StyleAuditFixtureId>('C');
  const [dNoProjects, setDNoProjects] = useState(false);
  const [projectsHidden, setProjectsHidden] = useState(false);
  const [reverseSections, setReverseSections] = useState(false);
  const [viewport, setViewport] = useState<AuditViewport>('desktop');
  const [category, setCategory] = useState<GalleryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<TemplateId | null>(null);

  const baseDesign = useMemo(() => createDefaultDesign(), []);
  const profile = useMemo(() => getStyleAuditFixture(fixtureId, dNoProjects), [fixtureId, dNoProjects]);
  const fixture = STYLE_AUDIT_FIXTURES.find((item) => item.id === fixtureId) ?? STYLE_AUDIT_FIXTURES[0];

  const selectedTemplate = useMemo(() => {
    return TEMPLATE_CATALOG.find((item) => item.id === selectedStyle) ?? TEMPLATE_CATALOG[0];
  }, [selectedStyle]);

  const selectedIndex = TEMPLATE_CATALOG.findIndex((item) => item.id === selectedTemplate.id);

  function inspect(templateId: TemplateId) {
    setSelectedStyle(templateId);
  }

  function stepSelection(delta: number) {
    const next = (selectedIndex + delta + TEMPLATE_CATALOG.length) % TEMPLATE_CATALOG.length;
    setSelectedStyle(TEMPLATE_CATALOG[next].id);
  }

  function handleUseStyle(templateId: TemplateId) {
    const existing = loadLocalDraft() || createEmptyDraft();
    saveLocalDraft({
      ...existing,
      design: { ...existing.design, templateId },
      updatedAt: new Date().toISOString(),
    });
    window.location.href = '/studio';
  }

  const displayedTemplates = useMemo(() => {
    let list = TEMPLATE_CATALOG;
    if (category !== 'all') {
      const allowedIds = CURATED_CATEGORIES[category];
      list = list.filter((t) => allowedIds.includes(t.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [category, searchQuery]);

  return (
    <main className={`template-audit ${selectedStyle ? 'template-audit--focus' : ''}`}>
      {/* 1. Header */}
      <header className="qa-header">
        <Link className="logo" href="/" aria-label="folio home">
          <span className="logo-mark"><Icon name="leaf" size={15}/></span>
          <span>folio</span>
        </Link>
        <div className="qa-header-label">
          <span aria-hidden="true" /> STYLE SHOWCASE · 22 HANDCRAFTED DESIGNS
        </div>
        <Link className="button secondary small" href="/studio">
          Open Studio <Icon name="arrow" size={12}/>
        </Link>
      </header>

      {/* 2. Intro Hero */}
      <section className="qa-intro" aria-labelledby="qa-title">
        <span className="eyebrow">Template Gallery</span>
        <h1 id="qa-title">22 Handcrafted Portfolio Styles</h1>
        <p>
          Discover diverse, typographically expressive portfolio aesthetics crafted for developers, designers, writers, and students.
          Every design adapts dynamically to your real story without templates feeling cookie-cutter.
        </p>
      </section>

      {/* 3. Filter & Search Controls */}
      <section className="qa-controls" aria-label="Template filtering and controls">
        {/* Search Bar */}
        <div className="qa-control-field" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search styles by name, mood, or font (e.g., editorial, terminal, clean)…"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line-dark)',
                  background: '#ffffff',
                  fontSize: '14px',
                  color: 'var(--ink)',
                }}
                aria-label="Search portfolio styles"
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                className="button subtle small"
                onClick={() => setSearchQuery('')}
                style={{ fontSize: '12px' }}
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        {/* Category Segmented Pills */}
        <div className="qa-mode-field" style={{ gridColumn: '1 / -1' }}>
          <span className="qa-control-label" id="qa-mode-label">Browse by aesthetic</span>
          <div className="qa-segmented" role="group" aria-labelledby="qa-mode-label">
            <button
              type="button"
              aria-pressed={category === 'all' && !selectedStyle}
              className={category === 'all' && !selectedStyle ? 'is-active' : ''}
              onClick={() => { setCategory('all'); setSelectedStyle(null); }}
            >
              All 22 Styles
            </button>
            <button
              type="button"
              aria-pressed={category === 'editorial' && !selectedStyle}
              className={category === 'editorial' && !selectedStyle ? 'is-active' : ''}
              onClick={() => { setCategory('editorial'); setSelectedStyle(null); }}
            >
              Editorial &amp; Serif <small>({CURATED_CATEGORIES.editorial.length})</small>
            </button>
            <button
              type="button"
              aria-pressed={category === 'minimal' && !selectedStyle}
              className={category === 'minimal' && !selectedStyle ? 'is-active' : ''}
              onClick={() => { setCategory('minimal'); setSelectedStyle(null); }}
            >
              Clean &amp; Minimal <small>({CURATED_CATEGORIES.minimal.length})</small>
            </button>
            <button
              type="button"
              aria-pressed={category === 'expressive' && !selectedStyle}
              className={category === 'expressive' && !selectedStyle ? 'is-active' : ''}
              onClick={() => { setCategory('expressive'); setSelectedStyle(null); }}
            >
              Expressive &amp; Bold <small>({CURATED_CATEGORIES.expressive.length})</small>
            </button>
            <button
              type="button"
              aria-pressed={category === 'technical' && !selectedStyle}
              className={category === 'technical' && !selectedStyle ? 'is-active' : ''}
              onClick={() => { setCategory('technical'); setSelectedStyle(null); }}
            >
              Technical &amp; Docs <small>({CURATED_CATEGORIES.technical.length})</small>
            </button>
          </div>
        </div>

        {/* Viewport & Collapsible Advanced Options */}
        <div className="qa-control-field qa-viewport-field">
          <span className="qa-control-label" id="qa-viewport-label">Preview viewport</span>
          <div className="qa-segmented" role="group" aria-labelledby="qa-viewport-label">
            <button
              type="button"
              aria-pressed={viewport === 'desktop'}
              className={viewport === 'desktop' ? 'is-active' : ''}
              onClick={() => setViewport('desktop')}
            >
              Desktop <small>1440 × 900</small>
            </button>
            <button
              type="button"
              aria-pressed={viewport === 'mobile'}
              className={viewport === 'mobile' ? 'is-active' : ''}
              onClick={() => setViewport('mobile')}
            >
              Mobile <small>390 × 844</small>
            </button>
          </div>
        </div>

        {/* Sample Profile Selector */}
        <div className="qa-control-field">
          <label htmlFor="qa-fixture">Sample profile data</label>
          <select
            id="qa-fixture"
            value={fixtureId}
            onChange={(event) => setFixtureId(event.target.value as StyleAuditFixtureId)}
          >
            {STYLE_AUDIT_FIXTURES.map((item) => (
              <option value={item.id} key={item.id}>{item.label}</option>
            ))}
          </select>
          <span>{fixture.summary}</span>
        </div>

        {/* Collapsible Subcases for Testing / QA */}
        <details style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'var(--paper)', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
            Advanced Testing Subcases &amp; Layout Variations
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {fixtureId === 'D' && (
              <label className="qa-edge-toggle">
                <input
                  type="checkbox"
                  checked={dNoProjects}
                  onChange={(event) => setDNoProjects(event.target.checked)}
                />
                <span>
                  <b>D subcase: no projects</b>
                  <small>Leaves optional sections empty to verify natural omission.</small>
                </span>
              </label>
            )}
            <label className="qa-edge-toggle">
              <input
                id="qa-hide-projects"
                type="checkbox"
                checked={projectsHidden}
                onChange={(event) => setProjectsHidden(event.target.checked)}
              />
              <span>
                <b>Subcase: hide Projects section</b>
                <small>Hides projects to verify nav links dynamically update.</small>
              </span>
            </label>
            <label className="qa-edge-toggle">
              <input
                id="qa-reverse-sections"
                type="checkbox"
                checked={reverseSections}
                onChange={(event) => setReverseSections(event.target.checked)}
              />
              <span>
                <b>Subcase: reverse section order</b>
                <small>Reverses order to verify headings, content, and anchor scroll align.</small>
              </span>
            </label>
          </div>
        </details>

        <p className="qa-fixture-status" role="status" aria-live="polite">
          Showing <b>{displayedTemplates.length}</b> style{displayedTemplates.length === 1 ? '' : 's'} with sample data: <b>{fixture.label}</b>.
        </p>
      </section>

      {/* 4. Main Gallery Grid or Focus View */}
      {!selectedStyle ? (
        <section className="qa-grid" aria-label="Styles rendered from sample fixture">
          {displayedTemplates.map((template, index) => {
            const counts = getStructuralAuditCounts(template);
            const closest = TEMPLATE_CATALOG.find((item) => item.id === template.structuralAudit.closestId);
            return (
              <article className="qa-card" key={template.id} aria-labelledby={`qa-style-${template.id}`}>
                <header className="qa-card-heading">
                  <div className="qa-card-title">
                    <span className="qa-number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h2 id={`qa-style-${template.id}`}>{template.name}</h2>
                      <span>{template.category} · {template.description}</span>
                    </div>
                  </div>
                  <span
                    className={`qa-status ${counts.passes ? 'is-pass' : 'is-below'}`}
                    title={`${counts.structural} structural differences, ${counts.visible} visible differences`}
                  >
                    {counts.passes ? 'Distinct' : 'Alternative'}
                  </span>
                </header>

                <div className="qa-preview-label">
                  {template.name} · {viewport === 'desktop' ? 'desktop' : 'mobile'} preview
                </div>

                <div className="qa-preview-shell">
                  <PortfolioPreview
                    profile={profile}
                    design={designForTemplate(baseDesign, template.id, projectsHidden, reverseSections)}
                    viewport={viewport}
                    onViewportChange={setViewport}
                  />
                </div>

                <div className="qa-quick-audit">
                  <b>Design DNA: {closest?.name ?? template.structuralAudit.closestId}</b>
                  <span>{counts.structural}/6 structural · {counts.visible}/4 visible</span>
                </div>

                <div className="qa-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="button small qa-use-style-btn"
                    onClick={() => handleUseStyle(template.id)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Use in Studio <Icon name="arrow" size={12}/>
                  </button>
                  <button
                    type="button"
                    className="button secondary small qa-inspect-button"
                    onClick={() => inspect(template.id)}
                  >
                    Inspect Full Size
                  </button>
                </div>

                <ArtDirectionDetails template={template} />
              </article>
            );
          })}
        </section>
      ) : (
        /* Focus Single Style Inspector */
        <section className="qa-focus" aria-labelledby="qa-focus-title">
          <div className="qa-focus-controls">
            <label htmlFor="qa-focus-style">Focused style</label>
            <select
              id="qa-focus-style"
              value={selectedStyle}
              onChange={(event) => setSelectedStyle(event.target.value as TemplateId)}
            >
              {TEMPLATE_CATALOG.map((template) => (
                <option value={template.id} key={template.id}>{template.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => stepSelection(-1)} aria-label="Previous style">
              ← Previous
            </button>
            <button type="button" onClick={() => stepSelection(1)} aria-label="Next style">
              Next →
            </button>
            <button type="button" className="qa-back-to-grid" onClick={() => setSelectedStyle(null)}>
              Back to Gallery
            </button>
            <button
              type="button"
              className="button small"
              onClick={() => handleUseStyle(selectedTemplate.id)}
            >
              Use in Studio <Icon name="arrow" size={12}/>
            </button>
          </div>

          <div className="qa-focus-heading">
            <span>{String(selectedIndex + 1).padStart(2, '0')} / 22 · {selectedTemplate.category}</span>
            <h2 id="qa-focus-title">{selectedTemplate.name}</h2>
            <p>{selectedTemplate.description}</p>
          </div>

          <div className="qa-focus-preview">
            <PortfolioPreview
              profile={profile}
              design={designForTemplate(baseDesign, selectedTemplate.id, projectsHidden, reverseSections)}
              viewport={viewport}
              onViewportChange={setViewport}
            />
          </div>

          <ArtDirectionDetails template={selectedTemplate} />

          <nav className="qa-style-index" aria-label="Choose a style to inspect">
            {TEMPLATE_CATALOG.map((template, index) => (
              <button
                type="button"
                key={template.id}
                aria-pressed={template.id === selectedTemplate.id}
                onClick={() => setSelectedStyle(template.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {template.name}
              </button>
            ))}
          </nav>
        </section>
      )}

      {/* 5. Footer */}
      <footer className="qa-footer">
        <span>folio · 22 handcrafted portfolio designs</span>
        <Link href="/studio">Open Studio <Icon name="arrow" size={12}/></Link>
      </footer>
    </main>
  );
}
