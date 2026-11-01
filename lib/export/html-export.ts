import { createDefaultDesign, type ProfileDocument, type DesignConfig } from '@/lib/profile-schema';
import { getTemplateMeta } from '@/lib/template-catalog';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Compiles a Simple mode portfolio into a clean, standalone, self-contained HTML page.
 * All core responsive CSS styles are inlined so it renders flawlessly offline or hosted on GitHub Pages/Netlify.
 */
export function generateStandalonePortfolioHtml(
  profile: ProfileDocument,
  design?: DesignConfig,
  slug = 'portfolio'
): string {
  const activeDesign = design || createDefaultDesign();
  const meta = getTemplateMeta(activeDesign.templateId || 'minimal-clean');
  const name = escapeHtml(profile.basics?.name || 'Portfolio');
  const role = escapeHtml(profile.basics?.role || '');
  const about = escapeHtml(profile.basics?.about || '');
  const location = escapeHtml(profile.basics?.location || '');
  const visible = activeDesign.visibleSections || createDefaultDesign().visibleSections;

  const links = profile.links;
  const projects = profile.projects;
  const education = profile.education;
  const skills = profile.skills;
  const interests = profile.interests;
  const highlights = profile.highlights;
  const activities = profile.activities;
  const recommendations = profile.recommendations || [];

  // Build Social/Outbound Links HTML
  const linkItems: string[] = [];
  if (links.email) {
    linkItems.push(
      `<a href="mailto:${escapeHtml(links.email)}" class="link-btn">✉ Email</a>`
    );
  }
  if (links.github) {
    const ghUrl = links.github.startsWith('http') ? links.github : `https://${links.github}`;
    linkItems.push(
      `<a href="${escapeHtml(ghUrl)}" target="_blank" rel="noopener noreferrer" class="link-btn">GitHub</a>`
    );
  }
  if (links.linkedin) {
    const liUrl = links.linkedin.startsWith('http') ? links.linkedin : `https://${links.linkedin}`;
    linkItems.push(
      `<a href="${escapeHtml(liUrl)}" target="_blank" rel="noopener noreferrer" class="link-btn">LinkedIn</a>`
    );
  }
  if (links.other && links.other.length > 0) {
    for (const other of links.other) {
      const oUrl = other.url.startsWith('http') ? other.url : `https://${other.url}`;
      linkItems.push(
        `<a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener noreferrer" class="link-btn">${escapeHtml(other.label || 'Link')}</a>`
      );
    }
  }

  // Build Projects HTML
  let projectsHtml = '';
  if (visible.projects && projects && projects.length > 0) {
    projectsHtml = `
      <section class="section">
        <h2 class="section-title">Projects &amp; Practice</h2>
        <div class="projects-grid">
          ${projects
            .map((p) => {
              const linkHtml = p.link
                ? `<a href="${escapeHtml(p.link.startsWith('http') ? p.link : `https://${p.link}`)}" target="_blank" rel="noopener noreferrer" class="project-link">View Project ↗</a>`
                : '';
              const toolsHtml = p.tools
                ? `<div class="project-tools">${escapeHtml(p.tools)}</div>`
                : '';
              return `
                <article class="project-card">
                  <h3 class="project-title">${escapeHtml(p.title || 'Untitled Project')}</h3>
                  ${p.description ? `<p class="project-desc">${escapeHtml(p.description)}</p>` : ''}
                  ${toolsHtml}
                  ${linkHtml}
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `;
  }

  // Build Skills HTML
  let skillsHtml = '';
  if (visible.skills && skills && skills.length > 0) {
    skillsHtml = `
      <section class="section">
        <h2 class="section-title">Skills &amp; Tools</h2>
        <div class="chips-wrap">
          ${skills.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}
        </div>
      </section>
    `;
  }

  // Build Education HTML
  let educationHtml = '';
  if (visible.education && (education.college || education.degree)) {
    educationHtml = `
      <section class="section">
        <h2 class="section-title">Education</h2>
        <div class="edu-card">
          <h3 class="edu-school">${escapeHtml(education.college || '')}</h3>
          <p class="edu-degree">${escapeHtml([education.degree, education.branch].filter(Boolean).join(' · '))}</p>
          ${education.gradYear ? `<span class="edu-year">Graduation ${escapeHtml(education.gradYear)}</span>` : ''}
          ${education.note ? `<p class="edu-note">${escapeHtml(education.note)}</p>` : ''}
        </div>
      </section>
    `;
  }

  // Build Highlights & Activities HTML
  let highlightsHtml = '';
  if (visible.highlights && (highlights?.length > 0 || activities?.length > 0)) {
    highlightsHtml = `
      <section class="section">
        <h2 class="section-title">Highlights &amp; Activities</h2>
        ${
          highlights && highlights.length > 0
            ? `<ul class="list-wrap">${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
            : ''
        }
        ${
          activities && activities.length > 0
            ? `<div class="chips-wrap" style="margin-top: 12px;">${activities.map((a) => `<span class="chip activity">${escapeHtml(a)}</span>`).join('')}</div>`
            : ''
        }
      </section>
    `;
  }

  // Build Recommendations & Social Proof HTML
  let recommendationsHtml = '';
  if (visible.highlights && recommendations && recommendations.length > 0) {
    const validRecs = recommendations.filter((r) => r.text?.trim() || r.author?.trim());
    if (validRecs.length > 0) {
      recommendationsHtml = `
      <section class="section">
        <h2 class="section-title">Endorsements &amp; Recommendations</h2>
        <div class="recommendations-grid">
          ${validRecs
            .map((r) => {
              const roleOrg = [r.role, r.company].filter(Boolean).join(' · ');
              const linkHtml = r.link
                ? `<a href="${escapeHtml(r.link.startsWith('http') ? r.link : `https://${r.link}`)}" target="_blank" rel="noopener noreferrer" class="rec-link">Reference ↗</a>`
                : '';
              return `
                <blockquote class="rec-card">
                  <p class="rec-quote">“${escapeHtml(r.text)}”</p>
                  <footer class="rec-footer">
                    <strong class="rec-author">${escapeHtml(r.author)}</strong>
                    ${roleOrg ? `<span class="rec-role">${escapeHtml(roleOrg)}</span>` : ''}
                    ${linkHtml}
                  </footer>
                </blockquote>
              `;
            })
            .join('')}
        </div>
      </section>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}${role ? ` — ${role}` : ' — Portfolio'}</title>
  <meta name="description" content="${role ? `${name} — ${role}` : `${name}'s portfolio`}">
  <style>
    :root {
      --bg: #f7f6f1;
      --surface: #ffffff;
      --ink: #252d29;
      --muted: #59655c;
      --line: #dfe5dc;
      --accent: #365d4a;
      --accent-soft: #e8efe9;
      --radius: 10px;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--ink);
      font-family: var(--font);
      line-height: 1.6;
      padding: 40px 20px 80px;
    }
    .container {
      max-width: 780px;
      margin: 0 auto;
    }
    header.profile-hero {
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 1px solid var(--line);
    }
    .badge-bar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
    }
    h1.name {
      font-size: clamp(32px, 5vw, 44px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: var(--ink);
      margin-bottom: 8px;
    }
    p.role {
      font-size: 18px;
      color: var(--muted);
      margin-bottom: 12px;
      font-weight: 500;
    }
    p.location {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 16px;
    }
    p.about {
      font-size: 16px;
      color: var(--ink);
      margin-top: 16px;
      max-width: 680px;
    }
    .links-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 20px;
    }
    .link-btn {
      display: inline-flex;
      align-items: center;
      padding: 7px 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--ink);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .link-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .section {
      margin-bottom: 44px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 750;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 18px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 6px;
    }
    .projects-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .project-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 20px;
    }
    .project-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .project-desc {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 12px;
    }
    .project-tools {
      font-size: 12px;
      font-family: monospace;
      color: var(--accent);
      margin-bottom: 10px;
    }
    .project-link {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
    }
    .project-link:hover {
      text-decoration: underline;
    }
    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      padding: 6px 12px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 99px;
      font-size: 13px;
      font-weight: 550;
      color: var(--ink);
    }
    .chip.activity {
      background: var(--accent-soft);
      border-color: transparent;
      color: var(--accent);
    }
    .edu-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px 20px;
    }
    .edu-school {
      font-size: 16px;
      font-weight: 700;
      color: var(--ink);
    }
    .edu-degree {
      font-size: 14px;
      color: var(--muted);
      margin-top: 2px;
    }
    .edu-year {
      display: inline-block;
      font-size: 12px;
      color: var(--accent);
      font-weight: 600;
      margin-top: 6px;
    }
    .edu-note {
      font-size: 13px;
      color: var(--muted);
      margin-top: 6px;
    }
    .list-wrap {
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 14px;
      color: var(--ink);
    }
    .recommendations-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .rec-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius);
      padding: 16px 20px;
    }
    .rec-quote {
      font-size: 14.5px;
      font-style: italic;
      color: var(--ink);
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .rec-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      font-size: 12.5px;
    }
    .rec-author {
      font-weight: 700;
      color: var(--ink);
    }
    .rec-role {
      color: var(--muted);
    }
    .rec-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 11.5px;
    }
    .rec-link:hover {
      text-decoration: underline;
    }
    footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--muted);
    }
    footer a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="profile-hero">
      <div class="badge-bar">Portfolio · ${escapeHtml(meta.name)}</div>
      <h1 class="name">${name}</h1>
      ${role ? `<p class="role">${role}</p>` : ''}
      ${location ? `<p class="location">📍 ${location}</p>` : ''}
      ${about ? `<p class="about">${about}</p>` : ''}
      ${linkItems.length > 0 ? `<div class="links-row">${linkItems.join('')}</div>` : ''}
    </header>

    <main>
      ${projectsHtml}
      ${skillsHtml}
      ${educationHtml}
      ${highlightsHtml}
      ${recommendationsHtml}
    </main>

    <footer>
      <span>Designed with <strong>${escapeHtml(meta.name)}</strong> style</span>
      <span>Built with <a href="https://nive.app" target="_blank" rel="noopener noreferrer">folio</a></span>
    </footer>
  </div>
</body>
</html>`;
}
