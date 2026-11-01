'use client';

import React from 'react';
import { SECTION_LABELS, type DesignConfig, type ProfileDocument, type SectionKey, type TemplateId, type Project } from '@/lib/profile-schema';
import { GitHubStatsBadge } from './github-stats-badge';
import { CaseStudyProvider, useCaseStudy } from './case-study-provider';

export const CORE_TEMPLATE_IDS: TemplateId[] = ['minimal', 'editorial', 'project'];
export type CoreTemplateId = 'minimal' | 'editorial' | 'project';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Y';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function safeExternalUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function learningIsCoveredByTopics(profile: ProfileDocument) {
  const learning = profile.learning.trim();
  const topics = new Set([...profile.skills, ...profile.interests].map((item) => item.trim().toLocaleLowerCase()).filter(Boolean));
  if (!learning || topics.size === 0) return false;
  if (topics.has(learning.toLocaleLowerCase())) return true;
  const parts = learning.split(/[,;\n]+|\s+and\s+|\s*&\s*/i).map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 && !/[.!?]/.test(learning) && parts.every((item) => topics.has(item.toLocaleLowerCase()));
}

function sectionAnchorId(templateId: TemplateId, section: SectionKey) {
  return `portfolio-${templateId}-section-${section}`;
}

function topAnchorId(templateId: TemplateId) {
  return `portfolio-${templateId}-top`;
}

function hasContent(key: SectionKey, profile: ProfileDocument) {
  if (key === 'about') return Boolean(profile.basics.about || (profile.basics.role && profile.basics.role !== profile.learning) || profile.basics.location);
  if (key === 'education') return Boolean(profile.education.college || profile.education.degree || profile.education.branch || profile.education.gradYear || profile.education.note);
  if (key === 'skills') return profile.skills.length > 0 || profile.interests.length > 0 || Boolean(profile.learning);
  if (key === 'projects') return profile.projects.some((project) => project.title || project.description);
  if (key === 'highlights') return profile.highlights.length > 0 || profile.activities.length > 0 || Boolean(profile.recommendations && profile.recommendations.some((r) => r.text || r.author));
  return Boolean(profile.links.email || safeExternalUrl(profile.links.github) || safeExternalUrl(profile.links.linkedin) || profile.links.other.some((link) => safeExternalUrl(link.url)));
}

function sectionLabel(section: SectionKey, templateId: CoreTemplateId) {
  if (section === 'projects') return templateId === 'editorial' ? 'Projects' : 'Work';
  if (section === 'contact') return 'Links';
  return SECTION_LABELS.find((item) => item.key === section)?.label ?? section;
}

function sectionTitleId(templateId: TemplateId, section: SectionKey) {
  return `${sectionAnchorId(templateId, section)}-title`;
}

function projectItems(profile: ProfileDocument) {
  return profile.projects.filter((project) => project.title || project.description);
}

function ProjectTools({ tools, className }: { tools: string; className: string }) {
  const items = tools.split(/[,·]/).map((tool) => tool.trim()).filter(Boolean);
  if (!items.length) return null;
  return <ul className={className} aria-label="Project tools">
    {items.map((tool, index) => <li key={`${tool}-${index}`}>{tool}</li>)}
  </ul>;
}

function ProjectLink({ title, rawUrl, className }: { title: string; rawUrl: string; className: string }) {
  const href = safeExternalUrl(rawUrl);
  if (!href) return null;
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={title ? `View ${title}` : 'View project'}>View project <span aria-hidden="true">↗</span></a>;
}

function ProjectCaseStudyTrigger({ project, className }: { project: Project; className?: string }) {
  const { openCaseStudy } = useCaseStudy();
  return (
    <button
      type="button"
      onClick={() => openCaseStudy(project)}
      className={`core-project-case-study-btn ${className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: 'rgba(53, 93, 72, 0.08)',
        color: '#355d48',
        border: '1px solid rgba(53, 93, 72, 0.22)',
        borderRadius: '6px',
        padding: '0.2rem 0.55rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
      aria-label={`Read case study for ${project.title || 'project'}`}
    >
      <span>Case Study</span>
      <span aria-hidden="true">📖</span>
    </button>
  );
}

function ContactLinks({ profile, className }: { profile: ProfileDocument; className: string }) {
  return <div className={className}>
    {profile.links.email && <a href={`mailto:${profile.links.email}`}>Email <span aria-hidden="true">↗</span></a>}
    {safeExternalUrl(profile.links.github) && <a href={safeExternalUrl(profile.links.github)!} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>}
    {safeExternalUrl(profile.links.linkedin) && <a href={safeExternalUrl(profile.links.linkedin)!} target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>}
    {profile.links.other.map((link, index) => {
      const href = safeExternalUrl(link.url);
      return href ? <a href={href} key={`${link.label}-${index}`} target="_blank" rel="noopener noreferrer">{link.label || 'Website'} <span aria-hidden="true">↗</span></a> : null;
    })}
  </div>;
}

function CoreSection({ section, profile, templateId }: { section: SectionKey; profile: ProfileDocument; templateId: CoreTemplateId }) {
  const id = sectionAnchorId(templateId, section);
  const titleId = sectionTitleId(templateId, section);
  const title = sectionLabel(section, templateId);
  const role = profile.basics.role && profile.basics.role !== profile.learning ? profile.basics.role : '';

  if (section === 'projects') {
    const projects = projectItems(profile);
    if (templateId === 'minimal') {
      return <section className="core-section core-section--minimal core-section--projects" data-section={section} id={id} aria-labelledby={titleId}>
        <h2 className="core-section-title" id={titleId}>{title}</h2>
        <div className="core-section-body">
          <div className="core-minimal-project-list">
            {projects.map((project) => <article className="core-minimal-project" key={project.id}>
              <div className="core-minimal-project-heading">
                {project.title && <h3>{project.title}</h3>}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <ProjectCaseStudyTrigger project={project} />
                  <ProjectLink title={project.title} rawUrl={project.link} className="core-minimal-project-link"/>
                </div>
              </div>
              {project.description && <p>{project.description}</p>}
              <GitHubStatsBadge project={project} />
              <ProjectTools tools={project.tools} className="core-minimal-tools"/>
            </article>)}
          </div>
        </div>
      </section>;
    }
    if (templateId === 'editorial') {
      return <section className="core-section core-section--editorial core-editorial-projects" data-section={section} id={id} aria-labelledby={titleId}>
        <div className="core-editorial-section-heading"><h2 id={titleId}>{title}</h2></div>
        <div className="core-editorial-section-content">
          <div className="core-editorial-project-list">
            {projects.map((project, index) => <article className={`core-editorial-project ${index === 0 ? 'is-featured' : index % 2 === 0 ? 'is-reversed' : ''}`} key={project.id}>
              <div className="core-editorial-project-art" aria-hidden="true"><i/><b/><span/></div>
              <div className="core-editorial-project-copy">
                <span className="core-editorial-project-index">{index === 0 ? 'FEATURED WORK' : `PROJECT ${String(index + 1).padStart(2, '0')}`}</span>
                {project.title && <h3>{project.title}</h3>}
                {project.description && <p>{project.description}</p>}
                <GitHubStatsBadge project={project} />
                <ProjectTools tools={project.tools} className="core-editorial-tools"/>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <ProjectCaseStudyTrigger project={project} />
                  <ProjectLink title={project.title} rawUrl={project.link} className="core-editorial-project-link"/>
                </div>
              </div>
            </article>)}
          </div>
        </div>
      </section>;
    }
    return <section className="core-section core-section--project core-project-work" data-section={section} id={id} aria-labelledby={titleId}>
      <div className="core-project-section-heading"><h2 id={titleId}>{title}</h2></div>
      <div className="core-project-section-content">
        {projects.length === 0 ? <div className="core-project-empty">
          <h3>No projects added yet.</h3>
          <p>You can add projects later.</p>
        </div> : <>
          <article className="core-project-feature">
            <div className="core-project-feature-art" aria-hidden="true"><i/><b/><span/></div>
            <div className="core-project-feature-copy">
              <span className="core-project-kicker">FEATURED PROJECT</span>
              {projects[0].title && <h3>{projects[0].title}</h3>}
              {projects[0].description && <p>{projects[0].description}</p>}
              <GitHubStatsBadge project={projects[0]} />
              <ProjectTools tools={projects[0].tools} className="core-project-tools"/>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <ProjectCaseStudyTrigger project={projects[0]} />
                <ProjectLink title={projects[0].title} rawUrl={projects[0].link} className="core-project-link"/>
              </div>
            </div>
          </article>
          {projects.length > 1 && <div className="core-project-archive">
            {projects.slice(1).map((project) => <article className="core-project-card" key={project.id}>
              <div className="core-project-card-art" aria-hidden="true"><i/><b/></div>
              <div className="core-project-card-copy">
                {project.title && <h3>{project.title}</h3>}
                {project.description && <p>{project.description}</p>}
                <GitHubStatsBadge project={project} />
                <ProjectTools tools={project.tools} className="core-project-tools"/>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <ProjectCaseStudyTrigger project={project} />
                  <ProjectLink title={project.title} rawUrl={project.link} className="core-project-link"/>
                </div>
              </div>
            </article>)}
          </div>}
        </>}
      </div>
    </section>;
  }

  let body;
  if (section === 'about') {
    body = <>
      {(profile.basics.about || (role && role !== profile.learning)) && <p>{profile.basics.about || role}</p>}
      {profile.basics.location && <p className="core-location">{profile.basics.location}</p>}
    </>;
  } else if (section === 'education') {
    const degree = [profile.education.degree, profile.education.branch].filter(Boolean).join(' · ');
    const detail = [profile.education.college, profile.education.gradYear, profile.education.note].filter(Boolean).join(' · ');
    body = <>
      {degree && <h3>{degree}</h3>}
      {!degree && profile.education.college && <h3>{profile.education.college}</h3>}
      {detail && <p>{detail}</p>}
    </>;
  } else if (section === 'skills') {
    const skills = [...profile.skills, ...profile.interests];
    body = <>
      {skills.length > 0 && <ul className={`core-skill-list core-skill-list--${templateId}`} aria-label="Skills and interests">
        {skills.map((skill, index) => <li key={`${skill}-${index}`}>{skill}</li>)}
      </ul>}
      {profile.learning && !learningIsCoveredByTopics(profile) && <p className="core-learning-note">{profile.learning}</p>}
    </>;
  } else if (section === 'highlights') {
    const validRecs = (profile.recommendations || []).filter((r) => r.text?.trim() || r.author?.trim());
    body = <>
      {(profile.highlights.length > 0 || profile.activities.length > 0) && (
        <ul className="core-highlight-list">
          {[...profile.highlights, ...profile.activities].map((highlight, index) => (
            <li key={`${highlight}-${index}`}>{highlight}</li>
          ))}
        </ul>
      )}
      {validRecs.length > 0 && (
        <div className="core-recommendations">
          {validRecs.map((rec) => (
            <blockquote className="core-recommendation-card" key={rec.id}>
              <p className="core-recommendation-quote">“{rec.text}”</p>
              <footer className="core-recommendation-author">
                <strong>{rec.author}</strong>
                {(rec.role || rec.company) && (
                  <span>{[rec.role, rec.company].filter(Boolean).join(' · ')}</span>
                )}
                {rec.link && safeExternalUrl(rec.link) && (
                  <a href={safeExternalUrl(rec.link)!} target="_blank" rel="noopener noreferrer" className="core-recommendation-link">
                    Reference <span aria-hidden="true">↗</span>
                  </a>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      )}
    </>;
  } else {
    body = <ContactLinks profile={profile} className="core-contact-links"/>;
  }

  return <section className={`core-section core-section--${templateId} core-section--${section}`} data-section={section} id={id} aria-labelledby={titleId}>
    <h2 className="core-section-title" id={titleId}>{title}</h2>
    <div className="core-section-body">{body}</div>
  </section>;
}

function ContentsLinks({ sections, templateId, className = '' }: { sections: SectionKey[]; templateId: CoreTemplateId; className?: string }) {
  return <nav className={className} aria-label={templateId === 'editorial' ? 'Contents' : 'Portfolio sections'}>
    {sections.map((section) => <a href={`#${sectionAnchorId(templateId, section)}`} key={section}>{sectionLabel(section, templateId)}</a>)}
  </nav>;
}

function EmptyPage() {
  return <section className="core-empty-page">
    <h2>Your story starts here.</h2>
    <p>Add a few details and this page will take shape.</p>
  </section>;
}

export function CorePortfolio({ profile, design }: { profile: ProfileDocument; design: DesignConfig }) {
  const templateId = design.templateId as CoreTemplateId;
  const name = profile.basics.name || 'Your name';
  const role = profile.basics.role && profile.basics.role !== profile.learning ? profile.basics.role : '';
  const intro = role || profile.learning;
  const sections = design.sectionOrder.filter((key) =>
    design.visibleSections[key] && (hasContent(key, profile) || (templateId === 'project' && key === 'projects')),
  );
  const navSections = sections;
  const educationTitle = [profile.education.degree, profile.education.branch].filter(Boolean).join(' · ');
  const meta = [
    profile.basics.location ? { label: 'Location', value: profile.basics.location } : null,
    educationTitle ? { label: 'Education', value: educationTitle } : null,
    profile.education.college ? { label: 'School', value: profile.education.college } : null,
    profile.education.gradYear ? { label: 'Year', value: profile.education.gradYear } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item?.value));
  const id = topAnchorId(templateId);

  if (templateId === 'minimal') {
    return <CaseStudyProvider>
      <div className="portfolio-site core-portfolio core-minimal theme-minimal" data-template={templateId}>
        <div className="core-minimal-shell">
          <header className="core-minimal-header" id={id}>
            <a className="core-minimal-wordmark" href={`#${id}`}>{name}</a>
            <ContentsLinks sections={navSections} templateId={templateId} className="core-minimal-nav"/>
          </header>
          <section className="core-minimal-hero" aria-labelledby="core-minimal-title">
            <h1 id="core-minimal-title">{name}</h1>
            {intro && <p>{intro}</p>}
          </section>
          <div className="core-minimal-sections">
            {sections.length > 0 ? sections.map((section) => <CoreSection section={section} profile={profile} templateId={templateId} key={section}/>) : <EmptyPage/>}
          </div>
          <footer className="core-minimal-footer">folio</footer>
        </div>
      </div>
    </CaseStudyProvider>;
  }

  if (templateId === 'editorial') {
    return <CaseStudyProvider>
      <div className="portfolio-site core-portfolio core-editorial theme-editorial" data-template={templateId}>
        <div className="core-editorial-shell">
          <div className="core-editorial-kicker">PORTFOLIO</div>
          <header className="core-editorial-hero" id={id}>
            <div className="core-editorial-intro">
              <h1>{name}</h1>
              {intro && <p>{intro}</p>}
            </div>
            {meta.length > 0 && <dl className="core-editorial-meta">
              {meta.map((item) => <div key={`${item.label}-${item.value}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
            </dl>}
          </header>
          <div className="core-editorial-layout">
            <aside className="core-editorial-aside">
              <nav className="core-editorial-contents" aria-label="Contents">
                <h2>Contents</h2>
                <ol>{navSections.map((section, index) => <li key={section}>
                  <a href={`#${sectionAnchorId(templateId, section)}`}><span>{String(index + 1).padStart(2, '0')}</span>{sectionLabel(section, templateId)}</a>
                </li>)}</ol>
              </nav>
            </aside>
            <div className="core-editorial-sections">
              {sections.length > 0 ? sections.map((section) => <CoreSection section={section} profile={profile} templateId={templateId} key={section}/>) : <EmptyPage/>}
            </div>
          </div>
          <footer className="core-editorial-footer">folio</footer>
        </div>
      </div>
    </CaseStudyProvider>;
  }

  return <CaseStudyProvider>
    <div className="portfolio-site core-portfolio core-project theme-project" data-template={templateId}>
      <div className="core-project-shell">
        <header className="core-project-header" id={id}>
          <div className="core-project-brand-group">
            <a className="core-project-wordmark" href={`#${id}`}>{name}</a>
            {navSections.includes('projects') && <a className="core-project-work-shortcut" href={`#${sectionAnchorId(templateId, 'projects')}`} aria-label="Jump to Work section">Jump to Work <span aria-hidden="true">↓</span></a>}
          </div>
          <ContentsLinks sections={navSections} templateId={templateId} className="core-project-nav"/>
        </header>
        <section className="core-project-hero" aria-labelledby="core-project-title">
          <h1 id="core-project-title">{name}</h1>
          {intro && <p>{intro}</p>}
        </section>
        <div className="core-project-sections">
          {sections.length > 0 ? sections.map((section) => <CoreSection section={section} profile={profile} templateId={templateId} key={section}/>) : <EmptyPage/>}
        </div>
        <footer className="core-project-footer">folio</footer>
      </div>
    </div>
  </CaseStudyProvider>;
}
