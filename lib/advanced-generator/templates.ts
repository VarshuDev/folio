import type { AdvancedPageType, PageDefinition } from '@/lib/portfolio-mode';
import type { CleanPortfolioData, GeneratedFile } from './types';

/**
 * Escapes a string safely for inclusion inside JSON or code.
 */
function escapeForJson(str: string): string {
  return JSON.stringify(str);
}

/**
 * Generates the package.json file with minimal, controlled dependencies.
 */
export function generatePackageJson(): string {
  return `{
  "name": "portfolio",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.3.8",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.8.0"
  }
}
`;
}

/**
 * Generates tsconfig.json.
 */
export function generateTsConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;
}

/**
 * Generates next.config.ts without secret exposure.
 */
export function generateNextConfig(): string {
  return `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;
}

/**
 * Generates README.md.
 */
export function generateReadme(siteTitle: string): string {
  return `# ${siteTitle}

This is a standalone multi-page portfolio generated with Folio Advanced.

## Getting Started

First, install dependencies:

\`\`\`bash
npm install
\`\`\`

Then, run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see your portfolio.

## Production Build

To test a production build:

\`\`\`bash
npm run build
npm run start
\`\`\`

## Deployment

This standalone project structure is ready for deployment to Vercel.
`;
}

/**
 * Generates lib/portfolio-data.ts as the single source of truth for portfolio content.
 */
export function generatePortfolioData(
  cleanData: CleanPortfolioData,
  navigation: Array<{ pageType: string; route: string; label: string }>,
): string {
  const dataPayload = {
    ...cleanData,
    navigation,
  };

  return `export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  tools: string;
  link: string;
}

export interface NavigationItem {
  pageType: string;
  route: string;
  label: string;
}

export interface PortfolioData {
  basics: {
    name: string;
    role: string;
    about: string;
    location: string;
  };
  education: {
    college: string;
    degree: string;
    branch: string;
    gradYear: string;
    note: string;
  };
  skills: string[];
  interests: string[];
  projects: ProjectItem[];
  highlights: string[];
  activities: string[];
  learning: string;
  links: {
    email: string;
    github: string;
    linkedin: string;
    other: Array<{
      label: string;
      url: string;
    }>;
  };
  siteTitle: string;
  navigation: NavigationItem[];
}

export const PORTFOLIO_DATA: PortfolioData = ${JSON.stringify(dataPayload, null, 2)};
`;
}

/**
 * Generates app/globals.css for the advanced-minimal-v1 theme.
 */
export function generateGlobalsCss(): string {
  return `:root {
  --bg-color: #fafbfc;
  --surface-color: #ffffff;
  --text-main: #1a261e;
  --text-muted: #4a5c50;
  --border-color: #e2e8e0;
  --accent-color: #1a4332;
  --accent-hover: #236846;
  --card-bg: #f8fbf7;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-color);
  color: var(--text-main);
  line-height: 1.6;
  min-height: 100vh;
}

.site-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header */
.site-header {
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  padding: 6px 4px;
  position: relative;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--text-main);
}

.nav-link.active {
  color: var(--accent-color);
  font-weight: 700;
}

.nav-link.active::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-color);
  border-radius: 2px;
}

.mobile-nav-toggle {
  display: none;
  background: transparent;
  border: none;
  font-size: 22px;
  color: var(--text-main);
  cursor: pointer;
}

.mobile-drawer {
  display: flex;
  flex-direction: column;
  padding: 12px 24px 18px;
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
}

.mobile-nav-link {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  padding: 6px 0;
}

.mobile-nav-link.active {
  color: var(--accent-color);
  font-weight: 700;
}

@media (max-width: 640px) {
  .desktop-nav {
    display: none;
  }
  .mobile-nav-toggle {
    display: block;
  }
}

/* Main Content Container */
.site-content {
  flex: 1;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px 64px;
}

/* Page Header */
.page-header {
  margin-bottom: 36px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-main);
}

.page-route {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--accent-color);
  background: #eaf2eb;
  padding: 3px 8px;
  border-radius: 4px;
  margin-top: 6px;
}

/* Sections */
.section-block {
  margin-bottom: 44px;
}

.section-heading {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-main);
  margin-bottom: 16px;
}

/* Hero Section */
.hero-section {
  padding: 24px 0 32px;
}

.hero-kicker {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-color);
  margin-bottom: 8px;
  display: block;
}

.hero-title {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin-bottom: 12px;
  color: var(--text-main);
}

.hero-role {
  font-size: 20px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.hero-location {
  font-size: 14px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 24px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-color);
  color: #ffffff;
  border: 1px solid var(--accent-color);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--surface-color);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--card-bg);
}

/* Prose */
.prose-text {
  font-size: 16px;
  color: var(--text-main);
  line-height: 1.7;
}

/* Chips / Tags */
.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #eef3ec;
  color: var(--text-main);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

/* Cards & Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 20px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
}

.card-link {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.card-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 14px;
  line-height: 1.5;
}

.tools-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-tag {
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 8px;
  background: #f0f4ee;
  border-radius: 4px;
  color: var(--accent-color);
}

/* Bullet list */
.bullet-list {
  list-style: disc;
  padding-left: 20px;
}

.bullet-list li {
  margin-bottom: 8px;
  font-size: 15px;
  color: var(--text-main);
}

/* Contact Grid */
.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.contact-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.contact-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 4px;
  display: block;
}

.contact-val {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent-color);
  text-decoration: none;
  word-break: break-all;
}

/* Empty Note */
.empty-note {
  font-size: 14px;
  color: var(--text-muted);
  font-style: italic;
  padding: 16px;
  background: #f7faf6;
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

/* Footer */
.site-footer {
  border-top: 1px solid var(--border-color);
  background: var(--surface-color);
  padding: 24px;
  margin-top: auto;
}

.footer-container {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-muted);
}

.footer-tag {
  font-weight: 500;
}
`;
}

/**
 * Generates app/layout.tsx.
 */
export function generateRootLayout(siteTitle: string): string {
  return `import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PORTFOLIO_DATA } from '@/lib/portfolio-data';

export const metadata: Metadata = {
  title: \`${siteTitle} — Portfolio\`,
  description: PORTFOLIO_DATA.basics.about || \`Portfolio of \${PORTFOLIO_DATA.basics.name}\`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="site-wrapper">
          <SiteHeader />
          <main className="site-content">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
`;
}

/**
 * Generates components/site-header.tsx.
 */
export function generateSiteHeader(): string {
  return `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PORTFOLIO_DATA } from '@/lib/portfolio-data';

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-container">
        <Link href="/" className="header-brand">
          {PORTFOLIO_DATA.siteTitle}
        </Link>
        <nav className="header-nav desktop-nav" aria-label="Main navigation">
          {PORTFOLIO_DATA.navigation.map((item) => {
            const isActive = pathname === item.route;
            return (
              <Link
                key={item.route}
                href={item.route}
                className={\`nav-link \${isActive ? 'active' : ''}\`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span aria-hidden="true">{mobileOpen ? '✕' : '☰'}</span>
        </button>
      </div>
      {mobileOpen && (
        <nav className="mobile-drawer" aria-label="Mobile navigation">
          {PORTFOLIO_DATA.navigation.map((item) => {
            const isActive = pathname === item.route;
            return (
              <Link
                key={item.route}
                href={item.route}
                className={\`mobile-nav-link \${isActive ? 'active' : ''}\`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
`;
}

/**
 * Generates components/site-footer.tsx.
 */
export function generateSiteFooter(): string {
  return `import { PORTFOLIO_DATA } from '@/lib/portfolio-data';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <span>&copy; {new Date().getFullYear()} {PORTFOLIO_DATA.basics.name || PORTFOLIO_DATA.siteTitle}</span>
        <span className="footer-tag">Portfolio</span>
      </div>
    </footer>
  );
}
`;
}

// -------------------------------------------------------------
// Individual Section Component Generators
// -------------------------------------------------------------

function renderHeroSection(): string {
  return `        {/* Hero Section */}
        <section className="section-block hero-section" aria-label="Introduction">
          <span className="hero-kicker">Hello, I’m</span>
          <h1 className="hero-title">{PORTFOLIO_DATA.basics.name}</h1>
          {PORTFOLIO_DATA.basics.role && (
            <p className="hero-role">{PORTFOLIO_DATA.basics.role}</p>
          )}
          {PORTFOLIO_DATA.basics.location && (
            <div className="hero-location">
              Based in {PORTFOLIO_DATA.basics.location}
            </div>
          )}
          <div className="hero-actions">
            {PORTFOLIO_DATA.links.email && (
              <a href={\`mailto:\${PORTFOLIO_DATA.links.email}\`} className="btn btn-primary">
                Get in touch
              </a>
            )}
            {PORTFOLIO_DATA.navigation.some((n) => n.pageType === 'projects') && (
              <Link href="/projects" className="btn btn-secondary">
                View projects ↗
              </Link>
            )}
          </div>
        </section>`;
}

function renderSummarySection(): string {
  return `        {/* Bio & Summary Section */}
        <section className="section-block" aria-labelledby="sec-about">
          <h2 id="sec-about" className="section-heading">About</h2>
          {PORTFOLIO_DATA.basics.about ? (
            <p className="prose-text">{PORTFOLIO_DATA.basics.about}</p>
          ) : (
            <p className="empty-note">A short narrative bio will appear here once added.</p>
          )}
        </section>`;
}

function renderSkillsSection(): string {
  return `        {/* Skills Section */}
        <section className="section-block" aria-labelledby="sec-skills">
          <h2 id="sec-skills" className="section-heading">Skills & Focus</h2>
          {PORTFOLIO_DATA.skills.length > 0 ? (
            <div className="chips-row">
              {PORTFOLIO_DATA.skills.map((skill, i) => (
                <span key={i} className="chip">{skill}</span>
              ))}
            </div>
          ) : (
            <p className="empty-note">No skills listed yet.</p>
          )}
          {PORTFOLIO_DATA.interests.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-muted)' }}>Interests & Curiosities</h3>
              <div className="chips-row">
                {PORTFOLIO_DATA.interests.map((item, i) => (
                  <span key={i} className="chip" style={{ background: '#f5f5f3' }}>{item}</span>
                ))}
              </div>
            </div>
          )}
        </section>`;
}

function renderEducationSection(): string {
  return `        {/* Education Section */}
        <section className="section-block" aria-labelledby="sec-edu">
          <h2 id="sec-edu" className="section-heading">Education</h2>
          {PORTFOLIO_DATA.education.college || PORTFOLIO_DATA.education.degree ? (
            <div className="card">
              <div className="card-title-row">
                <strong className="card-title">
                  {PORTFOLIO_DATA.education.degree || 'Degree'} {PORTFOLIO_DATA.education.branch ? \`in \${PORTFOLIO_DATA.education.branch}\` : ''}
                </strong>
                {PORTFOLIO_DATA.education.gradYear && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{PORTFOLIO_DATA.education.gradYear}</span>
                )}
              </div>
              {PORTFOLIO_DATA.education.college && (
                <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{PORTFOLIO_DATA.education.college}</p>
              )}
              {PORTFOLIO_DATA.education.note && (
                <p className="card-desc">{PORTFOLIO_DATA.education.note}</p>
              )}
            </div>
          ) : (
            <p className="empty-note">Education details will appear here once added.</p>
          )}
        </section>`;
}

function renderProjectsSection(): string {
  return `        {/* Projects Section */}
        <section className="section-block" aria-labelledby="sec-projects">
          <h2 id="sec-projects" className="section-heading">Projects</h2>
          {PORTFOLIO_DATA.projects.length > 0 ? (
            <div className="projects-grid">
              {PORTFOLIO_DATA.projects.map((proj) => (
                <div key={proj.id} className="card">
                  <div className="card-title-row">
                    <strong className="card-title">{proj.title || 'Untitled Project'}</strong>
                    {proj.link && (
                      <a href={proj.link} target="_blank" rel="noopener noreferrer" className="card-link">
                        Visit ↗
                      </a>
                    )}
                  </div>
                  {proj.description && <p className="card-desc">{proj.description}</p>}
                  {proj.tools && (
                    <div className="tools-row">
                      {proj.tools.split(',').map((t, idx) => (
                        <span key={idx} className="tool-tag">{t.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-note">No projects added yet.</p>
          )}
        </section>`;
}

function renderHighlightsSection(): string {
  return `        {/* Key Highlights Section */}
        <section className="section-block" aria-labelledby="sec-highlights">
          <h2 id="sec-highlights" className="section-heading">Key Highlights</h2>
          {PORTFOLIO_DATA.highlights.length > 0 ? (
            <ul className="bullet-list">
              {PORTFOLIO_DATA.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Key achievements and milestones will appear here.</p>
          )}
        </section>`;
}

function renderActivitiesSection(): string {
  return `        {/* Activities Section */}
        <section className="section-block" aria-labelledby="sec-activities">
          <h2 id="sec-activities" className="section-heading">Activities & Leadership</h2>
          {PORTFOLIO_DATA.activities.length > 0 ? (
            <ul className="bullet-list">
              {PORTFOLIO_DATA.activities.map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">No experience or activities added yet.</p>
          )}
        </section>`;
}

function renderLearningSection(): string {
  return `        {/* Learning Focus Section */}
        <section className="section-block" aria-labelledby="sec-learning">
          <h2 id="sec-learning" className="section-heading">Current Learning Focus</h2>
          {PORTFOLIO_DATA.learning ? (
            <div className="card">
              <p className="prose-text">{PORTFOLIO_DATA.learning}</p>
            </div>
          ) : (
            <p className="empty-note">Currently exploring new technologies and subjects.</p>
          )}
        </section>`;
}

function renderContactSection(): string {
  return `        {/* Contact Details Section */}
        <section className="section-block" aria-labelledby="sec-contact">
          <h2 id="sec-contact" className="section-heading">Get In Touch</h2>
          <div className="contact-grid">
            {PORTFOLIO_DATA.links.email && (
              <div className="contact-card">
                <span className="contact-label">Email</span>
                <a href={\`mailto:\${PORTFOLIO_DATA.links.email}\`} className="contact-val">
                  {PORTFOLIO_DATA.links.email}
                </a>
              </div>
            )}
            {PORTFOLIO_DATA.links.github && (
              <div className="contact-card">
                <span className="contact-label">GitHub</span>
                <a href={PORTFOLIO_DATA.links.github} target="_blank" rel="noopener noreferrer" className="contact-val">
                  {PORTFOLIO_DATA.links.github.replace(/^https?:\\/\\//, '')}
                </a>
              </div>
            )}
            {PORTFOLIO_DATA.links.linkedin && (
              <div className="contact-card">
                <span className="contact-label">LinkedIn</span>
                <a href={PORTFOLIO_DATA.links.linkedin} target="_blank" rel="noopener noreferrer" className="contact-val">
                  {PORTFOLIO_DATA.links.linkedin.replace(/^https?:\\/\\//, '')}
                </a>
              </div>
            )}
            {PORTFOLIO_DATA.links.other.map((link, i) => (
              <div key={i} className="contact-card">
                <span className="contact-label">{link.label || 'Link'}</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="contact-val">
                  {link.url.replace(/^https?:\\/\\//, '')}
                </a>
              </div>
            ))}
          </div>
        </section>`;
}

function renderLocationSection(): string {
  return `        {/* Location Section */}
        {PORTFOLIO_DATA.basics.location && (
          <section className="section-block" aria-labelledby="sec-location">
            <h2 id="sec-location" className="section-heading">Location</h2>
            <p className="prose-text">Based in {PORTFOLIO_DATA.basics.location}</p>
          </section>
        )}`;
}

function renderLinksSection(): string {
  return `        {/* Web & Social Links Section */}
        <section className="section-block" aria-labelledby="sec-links">
          <h2 id="sec-links" className="section-heading">Web & Social</h2>
          <div className="chips-row">
            {PORTFOLIO_DATA.links.github && (
              <a href={PORTFOLIO_DATA.links.github} target="_blank" rel="noopener noreferrer" className="chip">
                GitHub ↗
              </a>
            )}
            {PORTFOLIO_DATA.links.linkedin && (
              <a href={PORTFOLIO_DATA.links.linkedin} target="_blank" rel="noopener noreferrer" className="chip">
                LinkedIn ↗
              </a>
            )}
            {PORTFOLIO_DATA.links.other.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="chip">
                {link.label} ↗
              </a>
            ))}
          </div>
        </section>`;
}

/**
 * Returns section rendering code matching a section key.
 */
function getSectionRenderer(sectionKey: string): string | null {
  switch (sectionKey) {
    case 'hero': return renderHeroSection();
    case 'summary': return renderSummarySection();
    case 'skills': return renderSkillsSection();
    case 'education': return renderEducationSection();
    case 'projects': return renderProjectsSection();
    case 'highlights': return renderHighlightsSection();
    case 'activities': return renderActivitiesSection();
    case 'learning': return renderLearningSection();
    case 'contact': return renderContactSection();
    case 'location': return renderLocationSection();
    case 'links': return renderLinksSection();
    default: return null;
  }
}

/**
 * Generates code for a page based on its archetype and configured sections.
 */
export function generatePageSource(page: PageDefinition): string {
  const isHome = page.type === 'home';
  const visibleSections = (page.sections || [])
    .filter((s) => s.visible)
    .map((s) => s.key);

  const renderedSections: string[] = [];
  for (const key of visibleSections) {
    const code = getSectionRenderer(key);
    if (code) renderedSections.push(code);
  }

  // If no sections are visible, provide an honest fallback
  const contentBody =
    renderedSections.length > 0
      ? renderedSections.join('\n\n')
      : `        <div className="empty-note">
          <p>No content has been added to this page yet.</p>
        </div>`;

  return `import type { Metadata } from 'next';
import Link from 'next/link';
import { PORTFOLIO_DATA } from '@/lib/portfolio-data';

export const metadata: Metadata = {
  title: \`${page.title} — \${PORTFOLIO_DATA.siteTitle}\`,
  description: \`${page.title} page for \${PORTFOLIO_DATA.basics.name}\`,
};

export default function Page() {
  return (
    <div className="page-container">
      {!${isHome} && (
        <header className="page-header">
          <h1 className="page-title">${page.title}</h1>
          <span className="page-route">${page.slug === '' ? '/' : `/${page.slug}`}</span>
        </header>
      )}

${contentBody}
    </div>
  );
}
`;
}
