'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/icon';
import type { ProfileDocument } from '@/lib/profile-schema';
import {
  type PortfolioConfig,
  type AdvancedPortfolioConfig,
  type PageDefinition,
  type PageSectionConfig,
  type AdvancedSectionKey,
  ALLOWED_PAGE_SECTIONS,
  SECTION_METADATA,
  getDefaultPageSections,
} from '@/lib/portfolio-mode';
import { generateAdvancedProject, type GeneratedProject } from '@/lib/advanced-generator';
import { AdvancedPreview } from './advanced-preview';
import { ProjectInspectorModal } from './project-inspector-modal';

interface AdvancedWorkspaceProps {
  profile: ProfileDocument;
  portfolioConfig: PortfolioConfig;
  onChangeConfig: (config: PortfolioConfig) => void;
  onReview?: () => void;
  viewport: 'desktop' | 'mobile';
  onViewportChange: (viewport: 'desktop' | 'mobile') => void;
  mobilePane: 'edit' | 'preview';
}

export function AdvancedWorkspace({
  profile,
  portfolioConfig,
  onChangeConfig,
  onReview,
  viewport,
  onViewportChange,
  mobilePane,
}: AdvancedWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'navigation' | 'settings'>('pages');
  const [activePageId, setActivePageId] = useState<string>('page-home');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const advanced: AdvancedPortfolioConfig = portfolioConfig.advanced ?? {
    siteTitle: '',
    themeId: 'advanced-minimal-v1',
    themeVersion: 1,
    pages: [],
    navigation: { items: [] },
  };

  const activePage =
    advanced.pages.find((p) => p.id === activePageId) ||
    advanced.pages[0];

  const handleGenerateProject = () => {
    setIsGenerating(true);
    try {
      const result = generateAdvancedProject({
        profile,
        config: advanced,
      });
      if (result.ok) {
        setGeneratedProject(result.project);
        setGenerationError(null);
      } else {
        setGeneratedProject(null);
        setGenerationError(result.error);
      }
    } catch (err: unknown) {
      setGeneratedProject(null);
      setGenerationError(err instanceof Error ? err.message : 'Project generation failed.');
    } finally {
      setIsGenerating(false);
      setIsInspectorOpen(true);
    }
  };

  // Helper to update advanced configuration safely and propagate to parent
  const updateAdvanced = (updater: (prev: AdvancedPortfolioConfig) => AdvancedPortfolioConfig) => {
    const nextAdvanced = updater(advanced);
    onChangeConfig({
      ...portfolioConfig,
      mode: 'advanced',
      advanced: nextAdvanced,
    });
  };

  // 1. Page Details Updates (Title, Nav Label, Visibility)
  const updatePage = (pageId: string, patch: Partial<PageDefinition>) => {
    updateAdvanced((prev) => {
      const nextPages = prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        return { ...p, ...patch };
      });

      // Synchronize navigation labels/visibility if navLabel or visibility changed
      const nextNavItems = prev.navigation.items.map((item) => {
        if (item.pageId !== pageId) return item;
        const page = nextPages.find((p) => p.id === pageId);
        return {
          ...item,
          label: patch.navLabel !== undefined ? patch.navLabel : item.label,
          visible: patch.visible !== undefined ? patch.visible : (page ? page.visible : item.visible),
        };
      });

      return {
        ...prev,
        pages: nextPages,
        navigation: { items: nextNavItems },
      };
    });
  };

  // 2. Page Reordering (Deterministic Move Up / Down, Home stays 0)
  const movePage = (pageId: string, direction: -1 | 1) => {
    const sorted = [...advanced.pages].sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex((p) => p.id === pageId);
    if (currentIndex <= 0 && direction === -1) return; // Cannot move Home or move first further up
    const targetIndex = currentIndex + direction;
    if (targetIndex <= 0 || targetIndex >= sorted.length) return; // Keep Home locked at index 0

    // Swap elements in sorted array
    const temp = sorted[currentIndex];
    sorted[currentIndex] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    // Re-assign deterministic orders 0..N
    const nextPages = sorted.map((p, idx) => ({ ...p, order: idx }));

    // Re-assign navigation items order to match pages order
    const nextNavItems = nextPages.map((p) => {
      const existing = advanced.navigation.items.find((item) => item.pageId === p.id);
      return (
        existing ?? {
          pageId: p.id,
          label: p.navLabel,
          visible: p.visible,
        }
      );
    });

    updateAdvanced((prev) => ({
      ...prev,
      pages: nextPages,
      navigation: { items: nextNavItems },
    }));
  };

  // 3. Page Section Toggling and Reordering
  const getPageSections = (page: PageDefinition): PageSectionConfig[] => {
    if (page.sections && page.sections.length > 0) return page.sections;
    return getDefaultPageSections(page.type);
  };

  const toggleSection = (pageId: string, sectionKey: AdvancedSectionKey) => {
    updateAdvanced((prev) => {
      const nextPages = prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const currentSections = getPageSections(p);
        const nextSections = currentSections.map((sec) =>
          sec.key === sectionKey ? { ...sec, visible: !sec.visible } : sec
        );
        return { ...p, sections: nextSections };
      });
      return { ...prev, pages: nextPages };
    });
  };

  const moveSection = (pageId: string, sectionIndex: number, direction: -1 | 1) => {
    const targetIndex = sectionIndex + direction;
    updateAdvanced((prev) => {
      const nextPages = prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const currentSections = [...getPageSections(p)];
        if (targetIndex < 0 || targetIndex >= currentSections.length) return p;
        const temp = currentSections[sectionIndex];
        currentSections[sectionIndex] = currentSections[targetIndex];
        currentSections[targetIndex] = temp;
        return { ...p, sections: currentSections };
      });
      return { ...prev, pages: nextPages };
    });
  };

  // Derived content details per page type
  const getContentMappingSummary = (pageType: string) => {
    switch (pageType) {
      case 'home':
        return [
          { label: 'Name & Role', value: profile.basics.name ? `${profile.basics.name} · ${profile.basics.role || 'No role'}` : 'Not set yet' },
          { label: 'Highlights', value: `${profile.highlights.length} item(s)` },
          { label: 'Featured Projects', value: `${profile.projects.length} project(s)` },
          { label: 'Contact Links', value: `${profile.links.other.length + (profile.links.email ? 1 : 0) + (profile.links.github ? 1 : 0)} link(s)` },
        ];
      case 'about':
        return [
          { label: 'Bio / Summary', value: profile.basics.about ? 'Filled in' : 'Empty' },
          { label: 'Education', value: profile.education.college || profile.education.degree ? 'Filled in' : 'Empty' },
          { label: 'Skills & Curiosities', value: `${profile.skills.length} skill(s), ${profile.interests.length} interest(s)` },
          { label: 'Current Learning', value: profile.learning ? 'Filled in' : 'Empty' },
        ];
      case 'projects':
        return [
          { label: 'Projects Catalog', value: `${profile.projects.length} project(s) ready` },
          { label: 'Tool Tags', value: profile.projects.filter((p) => p.tools).length > 0 ? 'Configured' : 'None' },
        ];
      case 'experience':
        return [
          { label: 'Activities & Roles', value: `${profile.activities.length} activity item(s)` },
          { label: 'Highlights', value: `${profile.highlights.length} highlight(s)` },
          { label: 'Education', value: profile.education.college || 'None' },
        ];
      case 'contact':
        return [
          { label: 'Email', value: profile.links.email || 'Not set' },
          { label: 'GitHub', value: profile.links.github || 'Not set' },
          { label: 'LinkedIn', value: profile.links.linkedin || 'Not set' },
          { label: 'Location', value: profile.basics.location || 'Not set' },
        ];
      default:
        return [];
    }
  };

  const sortedPages = [...advanced.pages].sort((a, b) => a.order - b.order);

  return (
    <div className={`adv-workspace-container ${mobilePane === 'preview' ? 'mobile-show-preview' : 'mobile-show-edit'}`}>
      {/* LEFT SUB-RAIL: Tabs and Page Tree */}
      <aside className="adv-left-rail" aria-label="Multi-page structure">
        <div className="adv-rail-header">
          <div className="adv-rail-badge">
            <span className="adv-rail-dot" /> Advanced Multi-Page
          </div>
          <div className="adv-sub-tabs" role="tablist" aria-label="Advanced editor tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pages'}
              className={`adv-tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
            >
              Pages
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'navigation'}
              className={`adv-tab-btn ${activeTab === 'navigation' ? 'active' : ''}`}
              onClick={() => setActiveTab('navigation')}
            >
              Nav
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              className={`adv-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>

          <div className="adv-generate-btn-group">
            <button
              type="button"
              className="adv-generate-action-btn"
              onClick={handleGenerateProject}
              disabled={isGenerating}
              aria-label="Generate Next.js project"
            >
              <Icon name="spark" size={14} />
              <span>{isGenerating ? 'Generating...' : 'Generate Project'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Pages Tree */}
        {activeTab === 'pages' && (
          <div className="adv-pages-list" role="tabpanel" aria-label="Configured pages">
            <div className="adv-section-title-row">
              <span className="adv-section-kicker">SITE PAGES</span>
              <span className="adv-pages-count">{advanced.pages.filter((p) => p.visible).length} of {advanced.pages.length} active</span>
            </div>

            <nav className="adv-page-items-tree" aria-label="Page navigation list">
              {sortedPages.map((page, index) => {
                const isSelected = page.id === activePage.id;
                const isHome = page.type === 'home';
                return (
                  <div
                    key={page.id}
                    className={`adv-page-tree-item ${isSelected ? 'selected' : ''} ${!page.visible ? 'disabled' : ''}`}
                  >
                    <button
                      type="button"
                      className="adv-page-select-btn"
                      onClick={() => setActivePageId(page.id)}
                      aria-current={isSelected ? 'page' : undefined}
                    >
                      <span className="adv-page-route">{page.slug === '' ? '/' : `/${page.slug}`}</span>
                      <strong className="adv-page-label">{page.title}</strong>
                      {!page.visible && <span className="adv-disabled-badge">Off</span>}
                      {isHome && <span className="adv-home-badge">Home</span>}
                    </button>

                    {!isHome && (
                      <div className="adv-page-order-btns" aria-label={`Reorder ${page.title}`}>
                        <button
                          type="button"
                          className="adv-micro-order"
                          disabled={index <= 1}
                          onClick={() => movePage(page.id, -1)}
                          aria-label={`Move ${page.title} up`}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="adv-micro-order"
                          disabled={index >= sortedPages.length - 1}
                          onClick={() => movePage(page.id, 1)}
                          aria-label={`Move ${page.title} down`}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="adv-rail-tip">
              <Icon name="light" size={13} />
              <p>Home is required and remains first. Other canonical pages can be reordered or toggled on/off.</p>
            </div>
          </div>
        )}

        {/* Tab 2: Navigation Structure */}
        {activeTab === 'navigation' && (
          <div className="adv-pages-list" role="tabpanel" aria-label="Navigation configuration">
            <div className="adv-section-title-row">
              <span className="adv-section-kicker">HEADER NAVIGATION</span>
            </div>
            <p className="adv-tab-help">
              Controls the links that appear in your global header. Items update automatically when you toggle page visibility.
            </p>

            <div className="adv-nav-items-stack">
              {advanced.navigation.items.map((item) => {
                const page = advanced.pages.find((p) => p.id === item.pageId);
                const pageVisible = page ? page.visible : false;
                return (
                  <div key={item.pageId} className={`adv-nav-stack-item ${!pageVisible ? 'disabled' : ''}`}>
                    <span className="adv-nav-stack-route">{page?.slug === '' ? '/' : `/${page?.slug}`}</span>
                    <strong className="adv-nav-stack-label">{item.label}</strong>
                    <span className="adv-nav-stack-status">{pageVisible ? 'Visible' : 'Hidden'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Settings */}
        {activeTab === 'settings' && (
          <div className="adv-pages-list" role="tabpanel" aria-label="Portfolio settings">
            <div className="adv-section-title-row">
              <span className="adv-section-kicker">SETTINGS</span>
            </div>

            <div className="adv-settings-group">
              <label htmlFor="adv-site-title" className="adv-setting-label">Site Title</label>
              <input
                id="adv-site-title"
                className="adv-setting-input"
                value={advanced.siteTitle || ''}
                placeholder={profile.basics.name || 'My Portfolio'}
                onChange={(e) => updateAdvanced((prev) => ({ ...prev, siteTitle: e.target.value }))}
              />
              <span className="adv-setting-help">Displayed in the header logo / title bar.</span>
            </div>

            <div className="adv-settings-group">
              <label className="adv-setting-label">Active Theme</label>
              <div className="adv-theme-info-card">
                <strong>{advanced.themeId}</strong>
                <p>Clean modern multi-page architecture with accessible navigation.</p>
              </div>
            </div>

            <div className="adv-settings-group">
              <label className="adv-setting-label">Project Export & Artifact</label>
              <button
                type="button"
                className="adv-generate-action-btn"
                onClick={handleGenerateProject}
                disabled={isGenerating}
                aria-label="Generate Next.js project artifact"
              >
                <Icon name="spark" size={14} />
                <span>{isGenerating ? 'Generating...' : 'Inspect Next.js Project'}</span>
              </button>
              <span className="adv-setting-help">
                Builds a standalone Next.js 16 project tree in-memory ready for future deployment.
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* MIDDLE EDITOR PANEL: Active Page Configuration */}
      <section className="adv-editor-panel" aria-label="Page details and sections">
        <div className="adv-editor-header">
          <div className="adv-editor-breadcrumb">
            <span>Pages</span> / <strong>{activePage.title}</strong>
          </div>
          <h2 className="adv-page-heading">{activePage.title}</h2>
          <p className="adv-page-sub">
            Canonical route: <code className="adv-code-route">{activePage.slug === '' ? '/' : `/${activePage.slug}`}</code>
          </p>
        </div>

        <div className="adv-editor-body">
          {/* Page Details Form */}
          <div className="adv-card-block">
            <h3 className="adv-block-title">Page Details</h3>

            <div className="adv-form-row">
              <div className="adv-field-col">
                <label htmlFor="page-title-input" className="adv-field-label">Page Title</label>
                <input
                  id="page-title-input"
                  className="adv-input"
                  value={activePage.title}
                  onChange={(e) => updatePage(activePage.id, { title: e.target.value })}
                  placeholder="Page title"
                />
              </div>

              <div className="adv-field-col">
                <label htmlFor="nav-label-input" className="adv-field-label">Navigation Label</label>
                <input
                  id="nav-label-input"
                  className="adv-input"
                  value={activePage.navLabel}
                  onChange={(e) => updatePage(activePage.id, { navLabel: e.target.value })}
                  placeholder="Nav label"
                />
              </div>
            </div>

            {/* Visibility Toggle for Non-Home Pages */}
            {activePage.type !== 'home' ? (
              <div className="adv-visibility-toggle-row">
                <div>
                  <strong>Include page in portfolio</strong>
                  <p className="adv-toggle-sub">
                    When turned off, this page and its navigation link stay disabled without deleting your content.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={activePage.visible}
                  aria-label={`Toggle ${activePage.title} visibility`}
                  className={`toggle ${activePage.visible ? 'on' : ''}`}
                  onClick={() => updatePage(activePage.id, { visible: !activePage.visible })}
                />
              </div>
            ) : (
              <div className="adv-locked-notice">
                <Icon name="check" size={13} />
                <span>The Home page is required and always visible at root <code>/</code>.</span>
              </div>
            )}
          </div>

          {/* Section Configuration */}
          <div className="adv-card-block">
            <div className="adv-block-title-row">
              <h3 className="adv-block-title">Sections on this page</h3>
              <span className="adv-sections-badge">{ALLOWED_PAGE_SECTIONS[activePage.type].length} allowed</span>
            </div>
            <p className="adv-block-desc">
              Choose which sections to display and adjust their vertical ordering.
            </p>

            <div className="adv-sections-list" role="group" aria-label="Page sections">
              {getPageSections(activePage).map((section, idx, arr) => {
                const meta = SECTION_METADATA[section.key];
                return (
                  <div key={section.key} className={`adv-section-item ${!section.visible ? 'off' : ''}`}>
                    <div className="adv-section-meta">
                      <strong>{meta.label}</strong>
                      <small>{meta.description}</small>
                    </div>

                    <div className="adv-section-actions">
                      <button
                        type="button"
                        className="adv-micro-order"
                        disabled={idx === 0}
                        onClick={() => moveSection(activePage.id, idx, -1)}
                        aria-label={`Move ${meta.label} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="adv-micro-order"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveSection(activePage.id, idx, 1)}
                        aria-label={`Move ${meta.label} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={section.visible}
                        aria-label={`Show ${meta.label}`}
                        className={`toggle ${section.visible ? 'on' : ''}`}
                        onClick={() => toggleSection(activePage.id, section.key)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Derived Profile Content Preview Card */}
          <div className="adv-card-block">
            <div className="adv-block-title-row">
              <h3 className="adv-block-title">Authoritative Profile Data</h3>
              {onReview && (
                <button type="button" className="adv-link-btn" onClick={onReview}>
                  Edit profile intake ↗
                </button>
              )}
            </div>
            <p className="adv-block-desc">
              This page derives its content directly from your profile document without duplication:
            </p>

            <div className="adv-data-mapping-grid">
              {getContentMappingSummary(activePage.type).map((item, i) => (
                <div key={i} className="adv-data-item">
                  <span className="adv-data-label">{item.label}</span>
                  <strong className="adv-data-val">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT PREVIEW PANEL: Live Local Multi-Page Preview */}
      <AdvancedPreview
        profile={profile}
        advancedConfig={advanced}
        activePageId={activePageId}
        onSelectPage={(pageId) => setActivePageId(pageId)}
        viewport={viewport}
        onViewportChange={onViewportChange}
      />

      {/* Checkpoint 8H: In-Memory Project Inspector Modal */}
      <ProjectInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        project={generatedProject}
        error={generationError}
        onRegenerate={handleGenerateProject}
        isGenerating={isGenerating}
      />
    </div>
  );
}
