'use client';

import React from 'react';
import { SECTION_LABELS, type DesignConfig, type ProfileDocument, type SectionKey, type TemplateId } from '@/lib/profile-schema';
import { CorePortfolio } from './core-portfolio';
import { GitHubStatsBadge } from './github-stats-badge';
import { CaseStudyProvider, useCaseStudy } from './case-study-provider';

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
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function ExternalProjectLink({ project, className }: { project: ProfileDocument['projects'][number]; className: string }) {
  const href = safeExternalUrl(project.link);
  const { openCaseStudy } = useCaseStudy();

  return (
    <div className="portfolio-project-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.35rem' }}>
      <GitHubStatsBadge project={project} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => openCaseStudy(project)}
          className="project-case-study-trigger"
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
        {href && (
          <a
            className={className}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={project.title ? `View ${project.title} project` : 'View project'}
          >
            View project <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}

function BlueprintDiagram({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 360 220" aria-hidden="true" focusable="false">
    <path d="M43 139 125 92l82 47-82 47-82-47Zm82-47V45l82-47 82 47v94l-82 47v-94m-82-47 82 47 82-47m-82-47v94"/>
    <path d="m78 159 82-47 82 47m-117-79 82 47m-82-94v94m117-47-82 47m-98 12 49 28m115-54 49 28M31 53h44M53 31v44m218 83h53m-27-27v53"/>
    <circle cx="301" cy="49" r="23"/><circle cx="301" cy="49" r="8"/>
  </svg>;
}

function sectionAnchorId(templateId: TemplateId, section: SectionKey) {
  return `portfolio-${templateId}-section-${section}`;
}

function learningIsCoveredByTopics(profile: ProfileDocument) {
  const learning = profile.learning.trim();
  const topics = new Set([...profile.skills, ...profile.interests].map((item) => item.trim().toLocaleLowerCase()).filter(Boolean));
  if (!learning || topics.size === 0) return false;
  if (topics.has(learning.toLocaleLowerCase())) return true;
  const parts = learning.split(/[,;\n]+|\s+and\s+|\s*&\s*/i).map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 && !/[.!?]/.test(learning) && parts.every((item) => topics.has(item.toLocaleLowerCase()));
}

function sectionHasContent(key: SectionKey, profile: ProfileDocument) {
  if (key === 'about') return Boolean(profile.basics.about || (profile.basics.role && profile.basics.role !== profile.learning) || profile.basics.location);
  if (key === 'education') return Boolean(profile.education.college || profile.education.degree || profile.education.branch || profile.education.gradYear || profile.education.note);
  if (key === 'skills') return profile.skills.length > 0 || profile.interests.length > 0 || Boolean(profile.learning);
  if (key === 'projects') return profile.projects.some((project) => project.title || project.description);
  if (key === 'highlights') return profile.highlights.length > 0 || profile.activities.length > 0 || Boolean(profile.recommendations && profile.recommendations.some((r) => r.text || r.author));
  return Boolean(profile.links.email || safeExternalUrl(profile.links.github) || safeExternalUrl(profile.links.linkedin) || profile.links.other.some((link) => safeExternalUrl(link.url)));
}

function has5eProjectFacts(project: ProfileDocument['projects'][number]) {
  return Boolean(project.title.trim() || project.description.trim() || project.tools.trim() || safeExternalUrl(project.link));
}

function ProjectEmptyState({ className }: { className: string }) {
  return <div className={`${className}-projects-empty`}>
    <h3>No projects added yet.</h3>
    <p>You can add projects later.</p>
  </div>;
}

function SectionBody({ section, profile, templateId }: { section: SectionKey; profile: ProfileDocument; templateId: TemplateId }) {
  if (section === 'about') {
    return <div className="main-copy">
      {(profile.basics.about || (profile.basics.role && profile.basics.role !== profile.learning)) && <p>{profile.basics.about || profile.basics.role}</p>}
      {profile.basics.location && <span className="main-location">Based in {profile.basics.location}</span>}
    </div>;
  }

  if (section === 'education') {
    const title = [profile.education.degree, profile.education.branch].filter(Boolean).join(' · ') || profile.education.college;
    const details = [
      profile.education.college && title !== profile.education.college ? profile.education.college : '',
      profile.education.gradYear ? `Expected ${profile.education.gradYear}` : '',
      profile.education.note,
    ].filter(Boolean).join(' · ');
    return <div className="main-education">
      {title && <h3>{title}</h3>}
      {details && <p>{details}</p>}
    </div>;
  }

  if (section === 'skills') {
    return <div className="main-skills">
      {[...profile.skills, ...profile.interests].map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}
      {profile.learning && !learningIsCoveredByTopics(profile) && <p>{profile.learning}</p>}
    </div>;
  }

  if (section === 'projects') {
    const is5eStyle = templateId === 'zine' || templateId === 'documentary' || templateId === 'community' || templateId === 'case-study';
    const projects = profile.projects.filter((project) => is5eStyle ? has5eProjectFacts(project) : Boolean(project.title || project.description));

    if (templateId === 'zine') {
      if (projects.length === 0) return <ProjectEmptyState className="zine"/>;
      return <div className="zine-project-list">
        {projects.map((project, index) => <article className="zine-project" key={project.id}>
          <div className={`zine-project-art zine-project-art--${index % 3}`} aria-hidden="true"><i/><b/><span>ABSTRACT CUT-PAPER</span></div>
          <div className="zine-project-copy">
            <span className="zine-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {project.title && <h3>{project.title}</h3>}
            {project.description && <p>{project.description}</p>}
            {project.tools && <p className="zine-project-tools"><strong>Tools</strong> {project.tools}</p>}
            <ExternalProjectLink project={project} className="zine-project-link"/>
          </div>
        </article>)}
      </div>;
    }

    if (templateId === 'documentary') {
      if (projects.length === 0) return <ProjectEmptyState className="documentary"/>;
      return <div className="documentary-project-sequence">
        {projects.map((project, index) => <article className="documentary-project" key={project.id}>
          <div className={`documentary-project-art documentary-project-art--${index % 3}`} aria-hidden="true"><i/><b/><span>ABSTRACT DECORATION</span></div>
          <div className="documentary-project-caption">
            <span className="documentary-project-number" aria-hidden="true">PROJECT {String(index + 1).padStart(2, '0')}</span>
            {project.title && <h3>{project.title}</h3>}
            {project.description && <p>{project.description}</p>}
            {project.tools && <p className="documentary-project-tools"><strong>Tools</strong> {project.tools}</p>}
            <ExternalProjectLink project={project} className="documentary-project-link"/>
          </div>
        </article>)}
      </div>;
    }

    if (templateId === 'community') {
      if (projects.length === 0) return <ProjectEmptyState className="community"/>;
      return <div className="community-project-list">
        {projects.map((project, index) => <article className="community-project" key={project.id}>
          <span className="community-project-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div className="community-project-copy">
            {project.title && <h3>{project.title}</h3>}
            {project.description && <p>{project.description}</p>}
            {project.tools && <p className="community-project-tools"><strong>Tools</strong> {project.tools}</p>}
            <ExternalProjectLink project={project} className="community-project-link"/>
          </div>
        </article>)}
      </div>;
    }

    if (templateId === 'case-study') {
      if (projects.length === 0) return <ProjectEmptyState className="case-study"/>;
      return <div className="case-study-project-list">
        {projects.map((project, index) => <article className={`case-study-project ${index === 0 ? 'is-featured' : 'is-supporting'}`} key={project.id}>
          <div className="case-study-project-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
          <div className="case-study-project-copy">
            <span className="case-study-project-label">{index === 0 ? 'FEATURED PROJECT' : 'SUPPORTING PROJECT'}</span>
            {project.title && <h3>{project.title}</h3>}
            {project.description && <p>{project.description}</p>}
            {project.tools && <p className="case-study-project-tools"><strong>Tools</strong> {project.tools}</p>}
            <ExternalProjectLink project={project} className="case-study-project-link"/>
          </div>
        </article>)}
      </div>;
    }

    if (templateId === 'newsprint') return <div className="newsprint-project-list">
      {projects.map((project) => <article className="newsprint-project" key={project.id}>
        <div className="newsprint-project-art" aria-hidden="true"><i/><b/><span/></div>
        <div className="newsprint-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="newsprint-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="newsprint-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'brutalist') return <div className="brutalist-project-list">
      {projects.map((project) => <article className="brutalist-project" key={project.id}>
        <div className="brutalist-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="brutalist-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="brutalist-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'botanical') return <div className="botanical-project-list">
      {projects.map((project, index) => <article className="botanical-project" key={project.id}>
        <span className="botanical-project-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div className="botanical-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="botanical-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="botanical-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'gallery') return <div className="gallery-project-list">
      {projects.map((project, index) => <article className={`gallery-project ${index === 0 ? 'is-featured' : ''} ${index % 2 ? 'is-offset' : ''}`} key={project.id}>
        <div className="gallery-project-art" aria-hidden="true"><i/><b/><span/></div>
        <div className="gallery-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="gallery-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="gallery-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'terminal') return <div className="notebook-project-list">
      {projects.map((project, index) => <article className="notebook-project" key={project.id}>
        <div className="notebook-project-mark"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><small>PROJECT</small></div>
        <div className="notebook-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="notebook-project-tools"><strong>Built with</strong> {project.tools}</p>}
          <ExternalProjectLink project={project} className="notebook-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'blueprint') return <div className="blueprint-project-list">
      {projects.map((project, index) => <article className="blueprint-project" key={project.id}>
        <span className="blueprint-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div className="blueprint-project-diagram"><BlueprintDiagram className="blueprint-drawing blueprint-drawing--project"/></div>
        <div className="blueprint-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="blueprint-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="blueprint-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'bauhaus') return <div className="bauhaus-project-list">
      {projects.map((project, index) => <article className="bauhaus-project" key={project.id}>
        <div className={`bauhaus-project-composition bauhaus-project-composition--${index % 3}`} aria-hidden="true"><i/><b/><span/></div>
        <div className="bauhaus-project-copy">
          <span className="bauhaus-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="bauhaus-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="bauhaus-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'y2k') return <div className="y2k-project-list">
      {projects.map((project, index) => <article className="y2k-project" key={project.id}>
        <div className="y2k-project-mark" aria-hidden="true"><span>✦</span><i/><b/></div>
        <div className="y2k-project-copy">
          <span className="y2k-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="y2k-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="y2k-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'pastel') return <div className="pastel-project-list">
      {projects.map((project, index) => <article className={`pastel-project pastel-project--${index % 3}`} key={project.id}>
        <div className="pastel-project-mark" aria-hidden="true"><i/></div>
        <div className="pastel-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="pastel-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="pastel-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'academic') return <div className="academic-project-list">
      {projects.map((project, index) => <article className="academic-project" key={project.id}>
        <div className="academic-project-index"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><small>PROJECT</small></div>
        <div className="academic-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="academic-project-tools"><strong>Tools</strong> {project.tools}</p>}
          <ExternalProjectLink project={project} className="academic-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'retro') return <div className="retro-project-list">
      {projects.map((project, index) => <article className="retro-project" key={project.id}>
        <div className="retro-project-art" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><i/><b/></div>
        <div className="retro-project-copy">
          <span className="retro-project-label">PROJECT {String(index + 1).padStart(2, '0')}</span>
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="retro-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="retro-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'pinboard') return <div className={`pinboard-projects ${projects.length === 1 ? 'is-single' : ''}`}>
      {projects.map((project, index) => <article className="pinboard-project" key={project.id}>
        <div className="pinboard-project-art" aria-hidden="true"><i/><b/><span/></div>
        <div className="pinboard-project-copy">
          <span className="pinboard-project-label">PROJECT {String(index + 1).padStart(2, '0')}</span>
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="pinboard-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="pinboard-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'arcade') return <div className="arcade-project-list">
      {projects.map((project, index) => <article className="arcade-project" key={project.id}>
        <div className="arcade-project-art" aria-hidden="true"><i/><b/><span/></div>
        <div className="arcade-project-copy">
          <span className="arcade-project-label">BUILD {String(index + 1).padStart(2, '0')}</span>
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="arcade-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="arcade-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'after-hours') return <div className="afterhours-project-list">
      {projects.map((project, index) => <article className={`afterhours-project ${index % 2 ? 'is-reversed' : ''}`} key={project.id}>
        <div className="afterhours-project-art" aria-hidden="true"><i/><b/><span/></div>
        <div className="afterhours-project-copy">
          {project.title && <h3>{project.title}</h3>}
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="afterhours-project-tools">{project.tools}</p>}
          <ExternalProjectLink project={project} className="afterhours-project-link"/>
        </div>
      </article>)}
    </div>;

    if (templateId === 'swiss') return <div className="swiss-project-list">
      {projects.map((project, index) => <article className="swiss-project-row" key={project.id}>
        <span className="swiss-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div className="swiss-project-title">{project.title && <h3>{project.title}</h3>}</div>
        <div className="swiss-project-detail">
          {project.description && <p>{project.description}</p>}
          {project.tools && <p className="swiss-project-tools">{project.tools}</p>}
        </div>
        <div className="swiss-project-action"><ExternalProjectLink project={project} className="swiss-project-link"/></div>
      </article>)}
    </div>;

    return <div className={`main-project-grid theme-project-grid--${templateId}`}>
      {projects.map((project, index) => {
        const href = safeExternalUrl(project.link);
        return <article className="main-project-card" key={project.id}>
          <div className="main-project-art" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><i /></div>
          <div className="main-project-copy">
            {project.tools && <small>{project.tools}</small>}
            {project.title && <h3>{project.title}</h3>}
            {project.description && <p>{project.description}</p>}
            <ExternalProjectLink project={project} className="main-project-link"/>
          </div>
        </article>;
      })}
    </div>;
  }

  if (section === 'highlights' && templateId === 'community') {
    const items = [
      ...profile.highlights.map((text) => ({ text, kind: 'HIGHLIGHT' })),
      ...profile.activities.map((text) => ({ text, kind: 'ACTIVITY' })),
    ];
    return <ol className="community-contribution-list">
      {items.map((item, index) => <li className="community-contribution" key={`${item.kind}-${item.text}-${index}`}>
        <div className="community-contribution-meta"><span>{item.kind}</span><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div>
        <p>{item.text}</p>
      </li>)}
    </ol>;
  }

  if (section === 'highlights') {
    const validRecs = (profile.recommendations || []).filter((r) => r.text?.trim() || r.author?.trim());
    return <>
      {(profile.highlights.length > 0 || profile.activities.length > 0) && (
        <ul className="main-highlight-list">
          {[...profile.highlights, ...profile.activities].map((highlight, index) => <li key={`${highlight}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{highlight}</li>)}
        </ul>
      )}
      {validRecs.length > 0 && (
        <div className="main-recommendations">
          {validRecs.map((rec) => (
            <blockquote className="main-recommendation-card" key={rec.id}>
              <p className="main-recommendation-quote">“{rec.text}”</p>
              <footer className="main-recommendation-author">
                <strong>{rec.author}</strong>
                {(rec.role || rec.company) && (
                  <span>{[rec.role, rec.company].filter(Boolean).join(' · ')}</span>
                )}
                {rec.link && safeExternalUrl(rec.link) && (
                  <a href={safeExternalUrl(rec.link)!} target="_blank" rel="noopener noreferrer" className="main-recommendation-link">
                    Reference <span aria-hidden="true">↗</span>
                  </a>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      )}
    </>;
  }

  return <div className="main-contact-links">
    {profile.links.email && <a href={`mailto:${profile.links.email}`}>Email ↗</a>}
    {safeExternalUrl(profile.links.github) && <a href={safeExternalUrl(profile.links.github)!} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
    {safeExternalUrl(profile.links.linkedin) && <a href={safeExternalUrl(profile.links.linkedin)!} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
    {profile.links.other.map((link, index) => {
      const href = safeExternalUrl(link.url);
      return href ? <a href={href} key={`${link.label}-${index}`} target="_blank" rel="noopener noreferrer">{link.label || 'Website'} ↗</a> : null;
    })}
  </div>;
}

function SectionLabel({ section, index }: { section: SectionKey; index: number }) {
  const label = SECTION_LABELS.find((item) => item.key === section)?.label ?? section;
  return <div className="main-section-label"><span>{String(index + 1).padStart(2, '0')}</span>{label}</div>;
}

function templateSectionLabel(templateId: TemplateId, section: SectionKey) {
  if (section === 'about' && templateId === 'retro') return 'Introduction';
  if (section === 'projects') {
    if (templateId === 'documentary') return 'Project sequence';
    if (templateId === 'retro') return 'Selected work';
    if (templateId === 'arcade' || templateId === 'terminal') return 'Builds';
    if (templateId === 'after-hours' || templateId === 'brutalist' || templateId === 'gallery' || templateId === 'newsprint') return 'Work';
    if (templateId === 'botanical') return 'Field notes';
    if (templateId === 'blueprint') return 'Project notes';
    if (templateId === 'academic') return 'Selected projects';
  }
  if (section === 'highlights' && templateId === 'community') return 'Highlights & activities';
  if (section === 'contact') return 'Links';
  return SECTION_LABELS.find((item) => item.key === section)?.label ?? section;
}

function PortfolioSectionNav({ sections, templateId, className, indexed = false, label = 'Portfolio sections' }: { sections: SectionKey[]; templateId: TemplateId; className: string; indexed?: boolean; label?: string }) {
  if (sections.length === 0) return null;
  return <nav className={className} aria-label={label}>
    {sections.map((section, index) => <a href={`#${sectionAnchorId(templateId, section)}`} key={section}>
      {indexed && <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}
      {templateSectionLabel(templateId, section)}
    </a>)}
  </nav>;
}

function StructuredSections({ sections, profile, templateId, prefix, numbered = false }: { sections: SectionKey[]; profile: ProfileDocument; templateId: TemplateId; prefix: string; numbered?: boolean }) {
  return <>
    {sections.map((section, index) => {
      const id = sectionAnchorId(templateId, section);
      const titleId = `${id}-title`;
      return <section className={`${prefix}-section ${prefix}-section--${section}`} data-section={section} id={id} key={section} aria-labelledby={titleId}>
        <div className={`${prefix}-section-heading`}>
          {numbered && <span className={`${prefix}-section-number`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}
          <h2 id={titleId}>{templateSectionLabel(templateId, section)}</h2>
        </div>
        <div className={`${prefix}-section-body`}><SectionBody section={section} profile={profile} templateId={templateId}/></div>
      </section>;
    })}
  </>;
}

function SwissSections({ sections, profile }: { sections: SectionKey[]; profile: ProfileDocument }) {
  return <>
    {sections.map((section, index) => {
      const id = sectionAnchorId('swiss', section);
      const titleId = `${id}-title`;
      return <section className={`swiss-section swiss-section--${section}`} data-section={section} id={id} key={section} aria-labelledby={titleId}>
        <span className="swiss-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <h2 id={titleId}>{templateSectionLabel('swiss', section)}</h2>
        <div className="swiss-section-body"><SectionBody section={section} profile={profile} templateId="swiss"/></div>
      </section>;
    })}
  </>;
}

function TemplateEmpty({ className }: { className: string }) {
  return <section className={`${className}-empty`}>
    <h2>Your story starts here.</h2>
    <p>Add a few details and this page will take shape.</p>
  </section>;
}

function RetroPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-retro layout-retro retro-portfolio" data-template="retro">
    <div className="retro-sheet">
      <header className="retro-masthead" id="portfolio-retro-top">
        <div className="retro-masthead-rule"><span>PORTFOLIO</span><span>PERSONAL PROFILE</span></div>
        <div className="retro-masthead-title"><h1>{name}</h1>{introduction && <p>{introduction}</p>}</div>
        <PortfolioSectionNav sections={sections} templateId="retro" className="retro-index" indexed label="Portfolio index"/>
      </header>
      <main className="retro-main">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="retro" prefix="retro" numbered/>
          : <TemplateEmpty className="retro"/>}
      </main>
      <footer className="retro-footer">folio</footer>
    </div>
  </div>;
}

function PinboardPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  return <div className="portfolio-site portfolio-main theme-pinboard layout-pinboard pinboard-portfolio" data-template="pinboard">
    <div className="pinboard-sheet">
      <header className="pinboard-identity" id="portfolio-pinboard-top">
        <div className="pinboard-identity-copy"><span>PROFILE BOARD</span><h1>{name}</h1>{role && <p>{role}</p>}</div>
        <PortfolioSectionNav sections={sections} templateId="pinboard" className="pinboard-nav" label="Profile board sections"/>
      </header>
      <main className="pinboard-board" aria-label="Profile board">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="pinboard" prefix="pinboard"/>
          : <TemplateEmpty className="pinboard"/>}
      </main>
      <footer className="pinboard-footer">folio</footer>
    </div>
  </div>;
}

function ArcadePortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  return <div className="portfolio-site portfolio-main theme-arcade layout-arcade arcade-portfolio" data-template="arcade">
    <div className="arcade-shell">
      <header className="arcade-header" id="portfolio-arcade-top">
        <div className="arcade-frame-label"><span>PORTFOLIO</span><span>PROFILE</span></div>
        <h1>{name}</h1>
        {role && <p>{role}</p>}
        <PortfolioSectionNav sections={sections} templateId="arcade" className="arcade-index" indexed label="Portfolio section index"/>
      </header>
      <main className="arcade-screen">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="arcade" prefix="arcade" numbered/>
          : <TemplateEmpty className="arcade"/>}
      </main>
      <footer className="arcade-footer">folio</footer>
    </div>
  </div>;
}

function AfterHoursPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  return <div className="portfolio-site portfolio-main theme-after-hours layout-after-hours afterhours-portfolio" data-template="after-hours">
    <div className="afterhours-sheet">
      <header className="afterhours-top" id="portfolio-after-hours-top">
        <a href="#portfolio-after-hours-top" className="afterhours-wordmark">PORTFOLIO</a>
        <PortfolioSectionNav sections={sections} templateId="after-hours" className="afterhours-nav" label="Portfolio sections"/>
      </header>
      <section className="afterhours-hero" aria-labelledby="afterhours-title">
        <span className="afterhours-kicker">PROFILE</span>
        <h1 id="afterhours-title">{name}</h1>
        {role && <p>{role}</p>}
      </section>
      <main className="afterhours-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="after-hours" prefix="afterhours"/>
          : <TemplateEmpty className="afterhours"/>}
      </main>
      <footer className="afterhours-footer">folio</footer>
    </div>
  </div>;
}

function SwissPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  return <div className="portfolio-site portfolio-main theme-swiss layout-swiss swiss-portfolio" data-template="swiss">
    <div className="swiss-sheet">
      <header className="swiss-identity" id="portfolio-swiss-top">
        <span className="swiss-kicker">PORTFOLIO / PROFILE</span>
        <h1>{name}</h1>
        {role && <p>{role}</p>}
      </header>
      <PortfolioSectionNav sections={sections} templateId="swiss" className="swiss-index" indexed label="Portfolio section index"/>
      <main className="swiss-sections">
        {sections.length ? <SwissSections sections={sections} profile={profile}/>
          : <TemplateEmpty className="swiss"/>}
      </main>
      <footer className="swiss-footer">folio</footer>
    </div>
  </div>;
}

function NewsprintPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-newsprint layout-newsprint newsprint-portfolio" data-template="newsprint">
    <div className="newsprint-sheet">
      <header className="newsprint-masthead" id="portfolio-newsprint-top">
        <div className="newsprint-masthead-rule"><span>PORTFOLIO</span><span>FIELD NOTES</span></div>
        <h1>{name}</h1>
        <div className="newsprint-deck">
          {introduction && <p>{introduction}</p>}
          {profile.basics.location && <span>{profile.basics.location}</span>}
        </div>
        <PortfolioSectionNav sections={sections} templateId="newsprint" className="newsprint-index" label="Contents"/>
      </header>
      <main className="newsprint-layout">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="newsprint" prefix="newsprint"/>
          : <TemplateEmpty className="newsprint"/>}
      </main>
      <footer className="newsprint-footer">folio</footer>
    </div>
  </div>;
}

function BrutalistPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-brutalist layout-brutalist brutalist-portfolio" data-template="brutalist">
    <div className="brutalist-sheet">
      <header className="brutalist-hero" id="portfolio-brutalist-top">
        <span className="brutalist-kicker">PORTFOLIO / PROFILE</span>
        <h1>{name}</h1>
        {introduction && <p>{introduction}</p>}
      </header>
      <PortfolioSectionNav sections={sections} templateId="brutalist" className="brutalist-nav" label="Portfolio sections"/>
      <main className="brutalist-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="brutalist" prefix="brutalist"/>
          : <TemplateEmpty className="brutalist"/>}
      </main>
      <footer className="brutalist-footer">folio</footer>
    </div>
  </div>;
}

function BotanicalPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-botanical layout-botanical botanical-portfolio" data-template="botanical">
    <div className="botanical-sheet">
      <header className="botanical-header" id="portfolio-botanical-top">
        <div className="botanical-identity">
          <span className="botanical-kicker">FIELD JOURNAL</span>
          <h1>{name}</h1>
          {introduction && <p>{introduction}</p>}
          {profile.basics.location && <span className="botanical-location">{profile.basics.location}</span>}
        </div>
        <svg className="botanical-illustration" viewBox="0 0 180 160" aria-hidden="true" focusable="false">
          <path d="M24 148C55 121 72 91 83 15M54 116C34 112 20 98 16 78c21 1 36 12 38 38ZM69 84c-2-20 7-38 24-49 7 20 0 39-24 49ZM37 133c-16-2-28-11-34-26 19-2 34 6 40 20Z"/>
          <path d="M83 15c13 22 31 31 55 27-7-20-25-31-55-27ZM53 102c14-17 31-23 51-17-11 17-28 24-51 17ZM30 126c7-16 20-25 38-26-4 18-17 28-38 26Z"/>
        </svg>
      </header>
      <PortfolioSectionNav sections={sections} templateId="botanical" className="botanical-nav" label="Field journal sections"/>
      <main className="botanical-flow">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="botanical" prefix="botanical"/>
          : <TemplateEmpty className="botanical"/>}
      </main>
      <footer className="botanical-footer">folio</footer>
    </div>
  </div>;
}

function GalleryPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-gallery layout-gallery gallery-portfolio" data-template="gallery">
    <div className="gallery-sheet">
      <header className="gallery-header" id="portfolio-gallery-top">
        <div className="gallery-identity">
          <span className="gallery-kicker">PORTFOLIO</span>
          <h1>{name}</h1>
        </div>
        {introduction && <p className="gallery-introduction">{introduction}</p>}
        <PortfolioSectionNav sections={sections} templateId="gallery" className="gallery-index" indexed label="Portfolio section index"/>
      </header>
      <main className="gallery-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="gallery" prefix="gallery"/>
          : <TemplateEmpty className="gallery"/>}
      </main>
      <footer className="gallery-footer">folio</footer>
    </div>
  </div>;
}

function NotebookPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-terminal layout-terminal notebook-portfolio" data-template="terminal">
    <div className="notebook-sheet">
      <header className="notebook-header" id="portfolio-terminal-top">
        <span className="notebook-kicker">NOTEBOOK / LEARNING LOG</span>
        <h1>{name}</h1>
        {introduction && <p>{introduction}</p>}
      </header>
      <PortfolioSectionNav sections={sections} templateId="terminal" className="notebook-index" indexed label="Notebook section index"/>
      <main className="notebook-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="terminal" prefix="notebook" numbered/>
          : <TemplateEmpty className="notebook"/>}
      </main>
      <footer className="notebook-footer">folio</footer>
    </div>
  </div>;
}

function BlueprintPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-blueprint layout-blueprint blueprint-portfolio" data-template="blueprint">
    <div className="blueprint-sheet">
      <header className="blueprint-header" id="portfolio-blueprint-top">
        <div className="blueprint-header-label"><span>PORTFOLIO / WORKSHOP</span><span>PERSONAL PROFILE</span></div>
        <h1>{name}</h1>
      </header>
      <div className="blueprint-hero">
        <div className="blueprint-hero-copy">
          {introduction && <><span className="blueprint-kicker">CURRENT FOCUS</span><p>{introduction}</p></>}
        </div>
        <div className="blueprint-hero-drawing" aria-hidden="true"><BlueprintDiagram className="blueprint-drawing"/></div>
      </div>
      <PortfolioSectionNav sections={sections} templateId="blueprint" className="blueprint-index" indexed label="Workshop index"/>
      <main className="blueprint-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="blueprint" prefix="blueprint" numbered/>
          : <TemplateEmpty className="blueprint"/>}
      </main>
      <footer className="blueprint-footer">folio</footer>
    </div>
  </div>;
}

function BauhausPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-bauhaus layout-bauhaus bauhaus-portfolio" data-template="bauhaus">
    <div className="bauhaus-sheet">
      <header className="bauhaus-hero" id="portfolio-bauhaus-top">
        <div className="bauhaus-identity">
          <span className="bauhaus-kicker">PERSONAL PORTFOLIO</span>
          <h1>{name}</h1>
          {introduction && <p>{introduction}</p>}
        </div>
        <div className="bauhaus-composition" aria-hidden="true"><i/><b/><span/><em/></div>
      </header>
      <PortfolioSectionNav sections={sections} templateId="bauhaus" className="bauhaus-nav" indexed label="Portfolio sections"/>
      <main className="bauhaus-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="bauhaus" prefix="bauhaus" numbered/>
          : <TemplateEmpty className="bauhaus"/>}
      </main>
      <footer className="bauhaus-footer">folio</footer>
    </div>
  </div>;
}

function Y2KPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-y2k layout-y2k y2k-portfolio" data-template="y2k">
    <div className="y2k-page">
      <header className="y2k-window" id="portfolio-y2k-top">
        <div className="y2k-window-bar"><span><i aria-hidden="true">✦</i> PERSONAL WEB / PORTFOLIO</span><span className="y2k-window-accent" aria-hidden="true">✳</span></div>
        <div className="y2k-identity">
          <span className="y2k-kicker">A LITTLE CORNER OF THE WEB</span>
          <h1>Hi, I’m {name}</h1>
          {introduction && <p>{introduction}</p>}
        </div>
      </header>
      <PortfolioSectionNav sections={sections} templateId="y2k" className="y2k-tabs" label="Personal page sections"/>
      <main className="y2k-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="y2k" prefix="y2k"/>
          : <TemplateEmpty className="y2k"/>}
      </main>
      <footer className="y2k-footer">folio</footer>
    </div>
  </div>;
}

function PastelPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-pastel layout-pastel pastel-portfolio" data-template="pastel">
    <div className="pastel-sheet">
      <header className="pastel-header" id="portfolio-pastel-top">
        <a className="pastel-wordmark" href="#portfolio-pastel-top">PERSONAL PORTFOLIO</a>
        <PortfolioSectionNav sections={sections} templateId="pastel" className="pastel-nav" label="Portfolio sections"/>
      </header>
      <section className="pastel-hero" aria-labelledby="pastel-title">
        <div className="pastel-hero-copy">
          <span className="pastel-kicker">HELLO</span>
          <h1 id="pastel-title">I’m {name}</h1>
          {introduction && <p>{introduction}</p>}
        </div>
        <div className="pastel-composition" aria-hidden="true"><i/><b/><span/></div>
      </section>
      <main className="pastel-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="pastel" prefix="pastel"/>
          : <TemplateEmpty className="pastel"/>}
      </main>
      <footer className="pastel-footer">folio</footer>
    </div>
  </div>;
}

function AcademicPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-academic layout-academic academic-portfolio" data-template="academic">
    <div className="academic-sheet">
      <header className="academic-header" id="portfolio-academic-top">
        <span className="academic-kicker">PORTFOLIO</span>
        <h1>{name}</h1>
        {introduction && <p>{introduction}</p>}
        {profile.basics.location && <span className="academic-location">{profile.basics.location}</span>}
      </header>
      <aside className="academic-contents">
        <h2>Contents</h2>
        <PortfolioSectionNav sections={sections} templateId="academic" className="academic-nav" indexed label="Contents"/>
      </aside>
      <main className="academic-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="academic" prefix="academic" numbered/>
          : <TemplateEmpty className="academic"/>}
      </main>
      <footer className="academic-footer">folio</footer>
    </div>
  </div>;
}

function ZinePortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-zine layout-zine zine-portfolio" data-template="zine">
    <div className="zine-sheet">
      <header className="zine-masthead" id="portfolio-zine-top">
        <div className="zine-masthead-rule"><span>PORTFOLIO / CUTTINGS</span><span>PERSONAL INDEX</span></div>
        <div className="zine-title-row"><span className="zine-stamp" aria-hidden="true">✳</span><div><h1>{name}</h1>{introduction && <p>{introduction}</p>}</div></div>
        {profile.basics.location && <span className="zine-location">Based in {profile.basics.location}</span>}
        <PortfolioSectionNav sections={sections} templateId="zine" className="zine-nav" label="Portfolio sections"/>
      </header>
      <main className="zine-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="zine" prefix="zine"/>
          : <TemplateEmpty className="zine"/>}
      </main>
      <footer className="zine-footer"><span>{name}</span><span>END / PORTFOLIO</span></footer>
    </div>
  </div>;
}

function DocumentaryPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-documentary layout-documentary documentary-portfolio" data-template="documentary">
    <div className="documentary-sheet">
      <header className="documentary-opener" id="portfolio-documentary-top">
        <div className="documentary-opener-copy">
          <span className="documentary-kicker">DOCUMENTARY / PORTFOLIO</span>
          <h1>{name}</h1>
          {introduction && <p>{introduction}</p>}
          {profile.basics.location && <span className="documentary-location">Based in {profile.basics.location}</span>}
        </div>
        {sections.length > 0 && <div className="documentary-contents-wrap"><span>CONTENTS</span><PortfolioSectionNav sections={sections} templateId="documentary" className="documentary-contents" indexed label="Contents"/></div>}
      </header>
      <main className="documentary-sequence">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="documentary" prefix="documentary" numbered/>
          : <TemplateEmpty className="documentary"/>}
      </main>
      <footer className="documentary-footer"><span>{name}</span><span>END OF PORTFOLIO</span></footer>
    </div>
  </div>;
}

function CommunityPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const introduction = role || profile.learning;
  return <div className="portfolio-site portfolio-main theme-community layout-community community-portfolio" data-template="community">
    <div className="community-sheet">
      <header className="community-header" id="portfolio-community-top">
        <div className="community-identity">
          <span className="community-kicker">PERSONAL PROFILE</span>
          <h1>{name}</h1>
          {introduction && <p>{introduction}</p>}
          {profile.basics.location && <span className="community-location">Based in {profile.basics.location}</span>}
        </div>
        <PortfolioSectionNav sections={sections} templateId="community" className="community-nav" label="Profile sections"/>
      </header>
      <main className="community-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="community" prefix="community"/>
          : <TemplateEmpty className="community"/>}
      </main>
      <footer className="community-footer"><span>{name}</span><span>PORTFOLIO</span></footer>
    </div>
  </div>;
}

function CaseStudyPortfolio({ profile, sections, name, role }: { profile: ProfileDocument; sections: SectionKey[]; name: string; role: string }) {
  const hasVisibleProjects = sections.includes('projects');
  const featuredProject = hasVisibleProjects
    ? profile.projects.find(has5eProjectFacts)
    : undefined;
  const hasFeaturedTitle = Boolean(featuredProject?.title);
  const profileContext = role
    ? { label: 'PROFILE ROLE', value: role }
    : profile.learning
      ? { label: 'LEARNING', value: profile.learning }
      : undefined;
  return <div className="portfolio-site portfolio-main theme-case-study layout-case-study case-study-portfolio" data-template="case-study">
    <div className="case-study-sheet">
      <header className={`case-study-header ${featuredProject ? 'has-featured-project' : 'has-no-featured-project'}`} id="portfolio-case-study-top">
        <div className="case-study-topline"><span>{featuredProject ? 'PROJECT-LED PORTFOLIO' : 'PORTFOLIO / PROFILE'}</span><a href="#portfolio-case-study-top" className="case-study-wordmark">{name}</a></div>
        {featuredProject ? <div className={`case-study-feature ${profileContext ? 'has-profile-context' : ''}`}>
          <div className="case-study-feature-copy">
            <span className="case-study-feature-label">FEATURED PROJECT</span>
            <h1>{hasFeaturedTitle ? featuredProject.title : name}</h1>
          </div>
          {profileContext && <div className="case-study-feature-facts">
            <p className="case-study-profile-role"><span>{profileContext.label}</span>{profileContext.value}</p>
          </div>}
        </div> : <div className="case-study-profile-lead">
          <span className="case-study-feature-label">PROFILE</span>
          <h1>{name}</h1>
          {profileContext && <p><span>{profileContext.label} · </span>{profileContext.value}</p>}
        </div>}
      </header>
      {sections.length > 0 && <div className="case-study-contents-wrap"><span>CONTENTS</span><PortfolioSectionNav sections={sections} templateId="case-study" className="case-study-contents" indexed label="Contents"/></div>}
      <main className="case-study-sections">
        {sections.length ? <StructuredSections sections={sections} profile={profile} templateId="case-study" prefix="case-study" numbered/>
          : <TemplateEmpty className="case-study"/>}
      </main>
      <footer className="case-study-footer"><span>{name}</span><span>END OF PORTFOLIO</span></footer>
    </div>
  </div>;
}

function TemplateHero({ id, profile, name, role }: { id: TemplateId; profile: ProfileDocument; name: string; role: string }) {
  const avatar = initials(profile.basics.name);
  return <header className={`site-hero main-hero hero-${id}`}><div className="site-hero-grid"><div><div className="site-kicker">PROFILE</div><h1>{name}</h1>{role && <p className="site-headline">{role}</p>}</div><div className="site-avatar" aria-hidden="true">{avatar}</div></div>{profile.basics.location && <div className="site-meta"><span>{profile.basics.location}</span></div>}</header>;
}

export function PortfolioRenderer({ profile, design }: { profile: ProfileDocument; design: DesignConfig }) {
  const id = design.templateId;
  if (id === 'minimal' || id === 'editorial' || id === 'project') {
    return <CorePortfolio profile={profile} design={design} />;
  }

  const name = profile.basics.name || 'Your name';
  const role = profile.basics.role && profile.basics.role !== profile.learning ? profile.basics.role : '';
  const hasHonestProjectEmptyState = id === 'zine' || id === 'documentary' || id === 'community' || id === 'case-study';
  const sections = design.sectionOrder.filter((section) => design.visibleSections[section] && (sectionHasContent(section, profile) || (section === 'projects' && hasHonestProjectEmptyState)));

  const content = (() => {
    if (id === 'zine') return <ZinePortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'documentary') return <DocumentaryPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'community') return <CommunityPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'case-study') return <CaseStudyPortfolio profile={profile} sections={sections} name={name} role={role}/>;

    if (id === 'blueprint') return <BlueprintPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'bauhaus') return <BauhausPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'y2k') return <Y2KPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'pastel') return <PastelPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'academic') return <AcademicPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'newsprint') return <NewsprintPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'brutalist') return <BrutalistPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'botanical') return <BotanicalPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'gallery') return <GalleryPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'terminal') return <NotebookPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'retro') return <RetroPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'pinboard') return <PinboardPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'arcade') return <ArcadePortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'after-hours') return <AfterHoursPortfolio profile={profile} sections={sections} name={name} role={role}/>;
    if (id === 'swiss') return <SwissPortfolio profile={profile} sections={sections} name={name} role={role}/>;

    return <div className={`portfolio-site portfolio-main theme-${id} layout-${id}`} data-template={id}>
      <div className="main-template-nav">
        <strong>PORTFOLIO</strong>
        <span>{profile.basics.name ? profile.basics.name.split(' ')[0] : 'YOUR NAME'}</span>
        {sections.length > 0 && <nav className="main-nav-links" aria-label="Portfolio sections">
          {sections.map((section) => {
            const label = SECTION_LABELS.find((item) => item.key === section)?.label ?? section;
            return <a href={`#${sectionAnchorId(id, section)}`} key={section}>{label}</a>;
          })}
        </nav>}
      </div>
      <TemplateHero id={id} profile={profile} name={name} role={role}/>
      <div className={`main-sections main-sections--${id}`}>
        {sections.length === 0 ? <div className="main-empty"><h2>Your story starts here.</h2><p>Add a few details and this page will take shape.</p></div> : sections.map((section, index) => {
          const label = SECTION_LABELS.find((item) => item.key === section)?.label ?? section;
          const sectionTitle = section === 'about'
            ? 'A little about me.'
            : section === 'projects'
              ? 'Selected work.'
              : label;
          return <section className={`main-section main-section--${section}`} data-section={section} id={sectionAnchorId(id, section)} key={section}>
            <SectionLabel section={section} index={index}/>
            <div className="main-section-content">
              <h2>{sectionTitle}</h2>
              <SectionBody section={section} profile={profile} templateId={id}/>
            </div>
          </section>;
        })}
      </div>
      <div className="main-template-credit">Made with care · folio</div>
    </div>;
  })();

  return <CaseStudyProvider>{content}</CaseStudyProvider>;
}
