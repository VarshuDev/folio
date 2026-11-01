'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/icon';
import type { ProfileDocument } from '@/lib/profile-schema';
import {
  type AdvancedPortfolioConfig,
  type PageDefinition,
  type AdvancedSectionKey,
  ALLOWED_PAGE_SECTIONS,
  SECTION_METADATA,
} from '@/lib/portfolio-mode';

interface AdvancedPreviewProps {
  profile: ProfileDocument;
  advancedConfig: AdvancedPortfolioConfig;
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  viewport: 'desktop' | 'mobile';
  onViewportChange: (viewport: 'desktop' | 'mobile') => void;
}

export function AdvancedPreview({
  profile,
  advancedConfig,
  activePageId,
  onSelectPage,
  viewport,
  onViewportChange,
}: AdvancedPreviewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine active page
  const activePage =
    advancedConfig.pages.find((p) => p.id === activePageId) ||
    advancedConfig.pages.find((p) => p.type === 'home') ||
    advancedConfig.pages[0];

  const siteTitle =
    advancedConfig.siteTitle?.trim() ||
    profile.basics.name?.trim() ||
    'Portfolio';

  const visiblePages = advancedConfig.pages
    .filter((p) => p.visible)
    .sort((a, b) => a.order - b.order);

  // Filter navigation items to only visible pages
  const navItems = advancedConfig.navigation.items.filter((item) => {
    const page = advancedConfig.pages.find((p) => p.id === item.pageId);
    return item.visible && page && page.visible;
  });

  const simulatedUrl = `https://portfolio.local${activePage.slug ? `/${activePage.slug}` : '/'}`;

  // Get configured sections in order
  const allowedSections = ALLOWED_PAGE_SECTIONS[activePage.type];
  const configuredSections = (activePage.sections || [])
    .filter((s) => allowedSections.includes(s.key))
    .sort((a, b) => {
      const idxA = (activePage.sections || []).indexOf(a);
      const idxB = (activePage.sections || []).indexOf(b);
      return idxA - idxB;
    });

  const effectiveSections: { key: AdvancedSectionKey; visible: boolean }[] =
    configuredSections.length > 0
      ? configuredSections
      : allowedSections.map((key) => ({ key, visible: true }));

  // Render individual sections safely with real profile data
  const renderSection = (key: AdvancedSectionKey) => {
    switch (key) {
      case 'hero':
        return (
          <section className="adv-preview-hero adv-section-hero" key={key} aria-label="Introduction">
            <span className="adv-hero-kicker">Hello, I’m</span>
            <h1 className="adv-hero-title">{profile.basics.name || 'Your Name'}</h1>
            {profile.basics.role && <p className="adv-hero-role">{profile.basics.role}</p>}
            {profile.basics.location && (
              <div className="adv-hero-location">
                <span className="adv-dot" /> Based in {profile.basics.location}
              </div>
            )}
            <div className="adv-hero-actions">
              {profile.links.email && (
                <a
                  href={`mailto:${profile.links.email}`}
                  className="adv-button primary"
                  onClick={(e) => e.preventDefault()}
                >
                  Get in touch
                </a>
              )}
              {advancedConfig.pages.some((p) => p.type === 'projects' && p.visible) && (
                <button
                  type="button"
                  className="adv-button secondary"
                  onClick={() => {
                    const p = advancedConfig.pages.find((item) => item.type === 'projects');
                    if (p) onSelectPage(p.id);
                  }}
                >
                  View projects ↗
                </button>
              )}
            </div>
          </section>
        );

      case 'summary':
        return (
          <section className="adv-preview-section adv-section-summary" key={key} aria-labelledby="sec-summary">
            <h2 id="sec-summary" className="adv-section-heading">About</h2>
            {profile.basics.about?.trim() ? (
              <div className="adv-prose">
                <p>{profile.basics.about}</p>
              </div>
            ) : (
              <p className="adv-empty-note adv-section-empty">A short narrative bio will appear here once added in profile intake.</p>
            )}
          </section>
        );

      case 'skills':
        return (
          <section className="adv-preview-section adv-section-skills" key={key} aria-labelledby="sec-skills">
            <h2 id="sec-skills" className="adv-section-heading">Skills &amp; Focus</h2>
            {profile.skills.length > 0 ? (
              <div className="adv-chips-group">
                {profile.skills.map((s, idx) => (
                  <span className="adv-chip" key={`skill-${idx}`}>{s}</span>
                ))}
              </div>
            ) : (
              <p className="adv-empty-note adv-section-empty">No skills listed yet.</p>
            )}
            {profile.interests.length > 0 && (
              <div className="adv-sub-section">
                <h3 className="adv-sub-heading">Curiosities &amp; Interests</h3>
                <div className="adv-chips-group">
                  {profile.interests.map((item, idx) => (
                    <span className="adv-chip muted" key={`int-${idx}`}>{item}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        );

      case 'education':
        return (
          <section className="adv-preview-section adv-section-education" key={key} aria-labelledby="sec-edu">
            <h2 id="sec-edu" className="adv-section-heading">Education</h2>
            {profile.education.college || profile.education.degree ? (
              <div className="adv-card">
                <div className="adv-card-header">
                  <strong>{profile.education.degree || 'Degree'} {profile.education.branch ? `in ${profile.education.branch}` : ''}</strong>
                  {profile.education.gradYear && <span className="adv-year">{profile.education.gradYear}</span>}
                </div>
                {profile.education.college && <div className="adv-card-sub">{profile.education.college}</div>}
                {profile.education.note && <p className="adv-card-desc">{profile.education.note}</p>}
              </div>
            ) : (
              <p className="adv-empty-note adv-section-empty">Education details will appear here once added in your profile intake.</p>
            )}
          </section>
        );

      case 'projects':
        return (
          <section className="adv-preview-section adv-section-projects" key={key} aria-labelledby="sec-projects">
            <h2 id="sec-projects" className="adv-section-heading">Projects</h2>
            {profile.projects.length > 0 ? (
              <div className="adv-projects-grid">
                {profile.projects.map((proj) => (
                  <div className="adv-project-card" key={proj.id}>
                    <div className="adv-project-title-row">
                      <strong>{proj.title || 'Untitled Project'}</strong>
                      {proj.link && (
                        <span className="adv-link-icon" title="External link">↗</span>
                      )}
                    </div>
                    {proj.description && <p className="adv-project-desc">{proj.description}</p>}
                    {proj.tools && (
                      <div className="adv-tools-row">
                        {proj.tools.split(',').map((t, i) => (
                          <span key={i} className="adv-tool-tag">{t.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="adv-empty-card adv-section-empty">
                <p>No projects added yet.</p>
                <small>Add projects in your profile intake to showcase them here.</small>
              </div>
            )}
          </section>
        );

      case 'highlights':
        return (
          <section className="adv-preview-section adv-section-highlights" key={key} aria-labelledby="sec-highlights">
            <h2 id="sec-highlights" className="adv-section-heading">Highlights &amp; Milestones</h2>
            {profile.highlights.length > 0 ? (
              <ul className="adv-bullet-list">
                {profile.highlights.map((h, idx) => (
                  <li key={idx}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="adv-empty-note adv-section-empty">Key achievements and milestones will appear here.</p>
            )}
          </section>
        );

      case 'activities':
        return (
          <section className="adv-preview-section adv-section-activities" key={key} aria-labelledby="sec-activities">
            <h2 id="sec-activities" className="adv-section-heading">Activities &amp; Leadership</h2>
            {profile.activities.length > 0 ? (
              <ul className="adv-bullet-list">
                {profile.activities.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            ) : (
              <p className="adv-empty-note adv-section-empty">Clubs, team roles, and volunteering activities will appear here.</p>
            )}
          </section>
        );

      case 'learning':
        return (
          <section className="adv-preview-section adv-section-learning" key={key} aria-labelledby="sec-learning">
            <h2 id="sec-learning" className="adv-section-heading">Currently Learning</h2>
            {profile.learning?.trim() ? (
              <div className="adv-callout-card">
                <p>{profile.learning}</p>
              </div>
            ) : (
              <p className="adv-empty-note adv-section-empty">Topics and technologies currently being explored.</p>
            )}
          </section>
        );

      case 'contact':
        return (
          <section className="adv-preview-section adv-section-contact" key={key} aria-labelledby="sec-contact">
            <h2 id="sec-contact" className="adv-section-heading">Get In Touch</h2>
            <div className="adv-contact-grid">
              {profile.links.email && (
                <div className="adv-contact-item">
                  <span className="adv-contact-label">Email</span>
                  <a href={`mailto:${profile.links.email}`} className="adv-contact-val" onClick={(e) => e.preventDefault()}>
                    {profile.links.email}
                  </a>
                </div>
              )}
              {profile.links.github && (
                <div className="adv-contact-item">
                  <span className="adv-contact-label">GitHub</span>
                  <span className="adv-contact-val">{profile.links.github}</span>
                </div>
              )}
              {profile.links.linkedin && (
                <div className="adv-contact-item">
                  <span className="adv-contact-label">LinkedIn</span>
                  <span className="adv-contact-val">{profile.links.linkedin}</span>
                </div>
              )}
              {profile.links.other.map((link, idx) => (
                <div className="adv-contact-item" key={`other-${idx}`}>
                  <span className="adv-contact-label">{link.label || 'Link'}</span>
                  <span className="adv-contact-val">{link.url}</span>
                </div>
              ))}
            </div>
          </section>
        );

      case 'location':
        return (
          <section className="adv-preview-section adv-section-location" key={key} aria-labelledby="sec-location">
            <h2 id="sec-location" className="adv-section-heading">Location</h2>
            {profile.basics.location?.trim() ? (
              <div className="adv-card">
                <span>Based in <strong>{profile.basics.location}</strong></span>
              </div>
            ) : (
              <p className="adv-empty-note adv-section-empty">Location details.</p>
            )}
          </section>
        );

      case 'links':
        return (
          <section className="adv-preview-section adv-section-links" key={key} aria-labelledby="sec-links">
            <h2 id="sec-links" className="adv-section-heading">Web &amp; Social</h2>
            <div className="adv-links-row">
              {profile.links.github && <span className="adv-chip">GitHub: {profile.links.github}</span>}
              {profile.links.linkedin && <span className="adv-chip">LinkedIn: {profile.links.linkedin}</span>}
              {profile.links.other.map((l, i) => (
                <span className="adv-chip" key={i}>{l.label}: {l.url}</span>
              ))}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <aside className="preview-column adv-preview-column" aria-label="Advanced multi-page portfolio preview">
      {/* 1. Preview Browser Toolbar */}
      <div className="preview-toolbar adv-preview-toolbar">
        <div className="adv-browser-controls" aria-hidden="true">
          <span className="adv-dot-btn red" />
          <span className="adv-dot-btn yellow" />
          <span className="adv-dot-btn green" />
        </div>

        <div className="adv-address-bar" title={simulatedUrl} aria-label="Simulated page address">
          <Icon name="globe" size={11} />
          <span className="adv-address-host">portfolio.local</span>
          <span className="adv-address-path">{activePage.slug ? `/${activePage.slug}` : '/'}</span>
        </div>

        <div className="viewport-switch" role="group" aria-label="Preview viewport size">
          <button
            type="button"
            className={viewport === 'desktop' ? 'active' : ''}
            aria-pressed={viewport === 'desktop'}
            aria-label="Desktop preview"
            onClick={() => onViewportChange('desktop')}
          >
            <Icon name="monitor" size={14} />
          </button>
          <button
            type="button"
            className={viewport === 'mobile' ? 'active' : ''}
            aria-pressed={viewport === 'mobile'}
            aria-label="Mobile preview"
            onClick={() => onViewportChange('mobile')}
          >
            <Icon name="phone" size={14} />
          </button>
        </div>
      </div>

      {/* 2. Simulated Multi-Page Website Viewport */}
      <div className={`adv-viewport-frame ${viewport === 'mobile' ? 'viewport-mobile' : 'viewport-desktop'}`}>
        <div className="adv-site-container" data-theme={advancedConfig.themeId}>
          {/* Global Header */}
          <header className="adv-site-header">
            <div className="adv-site-brand">
              <button
                type="button"
                className="adv-brand-title"
                onClick={() => {
                  const home = advancedConfig.pages.find((p) => p.type === 'home');
                  if (home) onSelectPage(home.id);
                }}
              >
                {siteTitle}
              </button>
            </div>

            {/* Desktop Navigation */}
            <nav className="adv-site-nav desktop-only" aria-label="Simulated site navigation">
              {navItems.map((item) => {
                const isCurrent = item.pageId === activePage.id;
                return (
                  <button
                    key={item.pageId}
                    type="button"
                    className={`adv-nav-link ${isCurrent ? 'active' : ''}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => onSelectPage(item.pageId)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Navigation Toggle */}
            <button
              type="button"
              className="adv-mobile-nav-toggle mobile-only"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </header>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <nav className="adv-mobile-drawer mobile-only" aria-label="Mobile site navigation">
              {navItems.map((item) => {
                const isCurrent = item.pageId === activePage.id;
                return (
                  <button
                    key={item.pageId}
                    type="button"
                    className={`adv-mobile-nav-link ${isCurrent ? 'active' : ''}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => {
                      onSelectPage(item.pageId);
                      setMobileMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Main Simulated Page Area */}
          <main className="adv-page-body" id="preview-main">
            {!activePage.visible ? (
              <div className="adv-page-disabled-notice" role="alert">
                <Icon name="eye" size={16} />
                <div>
                  <strong>Page is disabled</strong>
                  <p>
                    <strong>{activePage.title}</strong> is currently turned off and excluded from navigation. You can re-enable it in the Page settings panel.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="adv-page-banner">
                  <div className="adv-page-header-row">
                    <h1 className="adv-page-title">{activePage.title}</h1>
                    <span className="adv-route-pill">{activePage.slug === '' ? '/' : `/${activePage.slug}`}</span>
                  </div>
                </div>

                <div className="adv-sections-stack">
                  {effectiveSections
                    .filter((s) => s.visible)
                    .map((s) => renderSection(s.key))}
                </div>
              </>
            )}
          </main>

          {/* Global Footer */}
          <footer className="adv-site-footer">
            <div className="adv-footer-content">
              <span>&copy; {new Date().getFullYear()} {profile.basics.name || siteTitle}</span>
              <span className="adv-footer-brand">Built with Folio Advanced</span>
            </div>
          </footer>
        </div>
      </div>
    </aside>
  );
}
