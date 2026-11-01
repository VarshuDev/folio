import type { ProfileDocument } from '@/lib/profile-schema';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Generates a clean, ATS-compliant printable HTML resume from the user's profile.
 * - Single-column semantic flow for optimal parsing by Workday, Lever, Greenhouse, Taleo.
 * - Standard section headers (Summary, Education, Skills, Projects, Highlights, Recommendations).
 * - Printable via browser with high-fidelity vector PDF output and selectable text.
 * - Strict zero-leakage of internal draft notes.
 */
export function generateAtsResumeHtml(profile: ProfileDocument, slug = 'portfolio'): string {
  const name = escapeHtml(profile.basics?.name?.trim() || 'Portfolio Resume');
  const role = escapeHtml(profile.basics?.role?.trim() || '');
  const about = escapeHtml(profile.basics?.about?.trim() || '');
  const location = escapeHtml(profile.basics?.location?.trim() || '');
  const education = profile.education;
  const skills = profile.skills || [];
  const interests = profile.interests || [];
  const projects = profile.projects || [];
  const highlights = profile.highlights || [];
  const activities = profile.activities || [];
  const recommendations = profile.recommendations || [];
  const links = profile.links;

  // Contact items for header
  const contactParts: string[] = [];
  if (location) {
    contactParts.push(`<span>${location}</span>`);
  }
  if (links?.email) {
    contactParts.push(`<a href="mailto:${escapeHtml(links.email)}">${escapeHtml(links.email)}</a>`);
  }
  if (links?.linkedin) {
    const liUrl = safeUrl(links.linkedin);
    const liDisplay = escapeHtml(links.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, 'linkedin.com/in/'));
    contactParts.push(`<a href="${escapeHtml(liUrl)}" target="_blank" rel="noopener noreferrer">${liDisplay}</a>`);
  }
  if (links?.github) {
    const ghUrl = safeUrl(links.github);
    const ghDisplay = escapeHtml(links.github.replace(/^https?:\/\/(www\.)?github\.com\//i, 'github.com/'));
    contactParts.push(`<a href="${escapeHtml(ghUrl)}" target="_blank" rel="noopener noreferrer">${ghDisplay}</a>`);
  }
  if (slug && slug !== 'portfolio') {
    contactParts.push(`<a href="/p/${escapeHtml(slug)}" target="_blank" rel="noopener noreferrer">Portfolio: /p/${escapeHtml(slug)}</a>`);
  }
  if (links?.other && links.other.length > 0) {
    for (const other of links.other.slice(0, 2)) {
      if (other.url) {
        contactParts.push(`<a href="${escapeHtml(safeUrl(other.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(other.label || 'Website')}</a>`);
      }
    }
  }

  // Summary section
  let summaryHtml = '';
  if (about) {
    summaryHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">PROFESSIONAL SUMMARY</h2>
        <p class="resume-text">${about}</p>
      </section>
    `;
  }

  // Education section
  let educationHtml = '';
  const eduTitle = [education?.degree, education?.branch].filter(Boolean).join(' in ');
  if (education?.college || eduTitle) {
    educationHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">EDUCATION</h2>
        <div class="resume-entry">
          <div class="entry-header">
            <span class="entry-title">${escapeHtml(education.college || 'University')}</span>
            ${education.gradYear ? `<span class="entry-date">${escapeHtml(education.gradYear)}</span>` : ''}
          </div>
          ${eduTitle ? `<div class="entry-subtitle">${escapeHtml(eduTitle)}</div>` : ''}
          ${education.note ? `<p class="entry-note">${escapeHtml(education.note)}</p>` : ''}
        </div>
      </section>
    `;
  }

  // Skills section
  let skillsHtml = '';
  if (skills.length > 0 || interests.length > 0 || profile.learning) {
    const skillList = skills.map((s) => escapeHtml(s)).join(' · ');
    const interestList = interests.map((i) => escapeHtml(i)).join(' · ');
    skillsHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">TECHNICAL SKILLS &amp; AREAS OF EXPERTISE</h2>
        <div class="skills-block">
          ${skills.length > 0 ? `<div class="skill-row"><span class="skill-label">Skills &amp; Tools:</span> <span class="skill-values">${skillList}</span></div>` : ''}
          ${interests.length > 0 ? `<div class="skill-row"><span class="skill-label">Interests &amp; Topics:</span> <span class="skill-values">${interestList}</span></div>` : ''}
          ${profile.learning ? `<div class="skill-row"><span class="skill-label">Currently Exploring:</span> <span class="skill-values">${escapeHtml(profile.learning)}</span></div>` : ''}
        </div>
      </section>
    `;
  }

  // Projects section
  let projectsHtml = '';
  const validProjects = projects.filter((p) => p.title?.trim() || p.description?.trim());
  if (validProjects.length > 0) {
    projectsHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">KEY PROJECTS &amp; TECHNICAL EXPERIENCE</h2>
        ${validProjects
          .map((p) => {
            const projectLink = p.link ? `<a href="${escapeHtml(safeUrl(p.link))}" target="_blank" rel="noopener noreferrer" class="entry-link">[Link]</a>` : '';
            return `
              <div class="resume-entry">
                <div class="entry-header">
                  <span class="entry-title">${escapeHtml(p.title || 'Project')} ${projectLink}</span>
                  ${p.tools ? `<span class="entry-tools">${escapeHtml(p.tools)}</span>` : ''}
                </div>
                ${p.description ? `<p class="entry-desc">${escapeHtml(p.description)}</p>` : ''}
              </div>
            `;
          })
          .join('')}
      </section>
    `;
  }

  // Highlights & Activities
  let highlightsHtml = '';
  if (highlights.length > 0 || activities.length > 0) {
    const allItems = [
      ...highlights.map((h) => ({ text: h, type: 'Highlight' })),
      ...activities.map((a) => ({ text: a, type: 'Activity' })),
    ];
    highlightsHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">ACHIEVEMENTS, ACTIVITIES &amp; LEADERSHIP</h2>
        <ul class="resume-bullets">
          ${allItems.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  // Recommendations / Endorsements
  let recommendationsHtml = '';
  const validRecommendations = recommendations.filter((r) => r.text?.trim() || r.author?.trim());
  if (validRecommendations.length > 0) {
    recommendationsHtml = `
      <section class="resume-section">
        <h2 class="resume-heading">ENDORSEMENTS &amp; RECOMMENDATIONS</h2>
        ${validRecommendations
          .map((r) => {
            const authorMeta = [r.author, r.role, r.company].filter(Boolean).map((s) => escapeHtml(s)).join(', ');
            const recLink = r.link ? `<a href="${escapeHtml(safeUrl(r.link))}" target="_blank" rel="noopener noreferrer" class="entry-link">[Reference]</a>` : '';
            return `
              <div class="resume-entry recommendation-entry">
                <blockquote class="recommendation-quote">“${escapeHtml(r.text)}”</blockquote>
                <div class="recommendation-author">— ${authorMeta} ${recLink}</div>
              </div>
            `;
          })
          .join('')}
      </section>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Resume (ATS-Friendly)</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    /* Reset & Base */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #f2f3ee;
      color: #1a1e1b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 24px 16px 64px;
    }

    /* Screen Action Header */
    .no-print-bar {
      max-width: 820px;
      margin: 0 auto 20px;
      background: #ffffff;
      border: 1px solid #d8dfd6;
      border-radius: 8px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 2px 8px rgba(35, 48, 38, 0.06);
    }
    .bar-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bar-title {
      font-size: 13px;
      font-weight: 700;
      color: #2e533f;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bar-tip {
      font-size: 11.5px;
      color: #5d6760;
    }
    .bar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .btn-print {
      background: #355d48;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print:hover {
      background: #274736;
    }
    .btn-secondary {
      background: #ffffff;
      color: #29342d;
      border: 1px solid #cbd4ca;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    .btn-secondary:hover {
      background: #f7f9f6;
    }

    /* Resume Document Container */
    .resume-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px 52px;
      border-radius: 4px;
      border: 1px solid #d4ded3;
      box-shadow: 0 4px 18px rgba(30, 42, 33, 0.05);
    }

    /* Header */
    .resume-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #233127;
      text-align: center;
    }
    .resume-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #121914;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .resume-role {
      font-size: 15px;
      font-weight: 600;
      color: #355d48;
      margin-bottom: 10px;
      letter-spacing: 0.02em;
    }
    .resume-contact {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px 14px;
      font-size: 12px;
      color: #49544c;
    }
    .resume-contact a {
      color: #23382c;
      text-decoration: none;
    }
    .resume-contact a:hover {
      text-decoration: underline;
    }

    /* Section Structure */
    .resume-section {
      margin-bottom: 20px;
    }
    .resume-heading {
      font-size: 12.5px;
      font-weight: 800;
      color: #1a221d;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding-bottom: 4px;
      border-bottom: 1px solid #27392d;
      margin-bottom: 10px;
    }

    .resume-text {
      font-size: 13px;
      line-height: 1.55;
      color: #222924;
    }

    /* Entries */
    .resume-entry {
      margin-bottom: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .entry-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #121814;
    }
    .entry-date {
      font-size: 12px;
      font-weight: 600;
      color: #4e5a52;
      flex-shrink: 0;
    }
    .entry-tools {
      font-size: 12px;
      font-weight: 600;
      color: #355d48;
      flex-shrink: 0;
    }
    .entry-subtitle {
      font-size: 12.5px;
      font-weight: 600;
      color: #445048;
      margin-top: 1px;
    }
    .entry-desc, .entry-note {
      font-size: 12.5px;
      color: #262e28;
      margin-top: 3px;
      line-height: 1.5;
    }
    .entry-link {
      font-size: 11px;
      font-weight: 600;
      color: #355d48;
      text-decoration: none;
      margin-left: 4px;
    }
    .entry-link:hover {
      text-decoration: underline;
    }

    /* Skills Block */
    .skills-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .skill-row {
      font-size: 12.5px;
      line-height: 1.5;
    }
    .skill-label {
      font-weight: 700;
      color: #1d2520;
    }
    .skill-values {
      color: #2c3630;
    }

    /* Bullets */
    .resume-bullets {
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .resume-bullets li {
      font-size: 12.5px;
      color: #262e28;
      line-height: 1.5;
    }

    /* Recommendations */
    .recommendation-entry {
      background: #fafbf9;
      border-left: 3px solid #355d48;
      padding: 8px 14px;
      margin-bottom: 10px;
    }
    .recommendation-quote {
      font-size: 12.5px;
      font-style: italic;
      color: #222924;
      line-height: 1.5;
      margin-bottom: 4px;
    }
    .recommendation-author {
      font-size: 11.5px;
      font-weight: 600;
      color: #424e46;
    }

    /* Print Stylesheet */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        font-size: 10pt !important;
      }
      .no-print, .no-print-bar {
        display: none !important;
      }
      .resume-container {
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .resume-header {
        border-bottom: 1.5pt solid #000000 !important;
        padding-bottom: 10pt !important;
        margin-bottom: 14pt !important;
      }
      .resume-name {
        font-size: 18pt !important;
        color: #000000 !important;
      }
      .resume-role {
        font-size: 11pt !important;
        color: #222222 !important;
      }
      .resume-heading {
        font-size: 10pt !important;
        color: #000000 !important;
        border-bottom: 1pt solid #000000 !important;
        margin-bottom: 6pt !important;
      }
      .resume-section {
        margin-bottom: 12pt !important;
      }
      .resume-entry {
        margin-bottom: 8pt !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .recommendation-entry {
        background: transparent !important;
        border-left: 2pt solid #444444 !important;
        padding: 4pt 8pt !important;
      }
      @page {
        size: letter;
        margin: 12mm 15mm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar no-print">
    <div class="bar-info">
      <span class="bar-title">✓ ATS-Optimized Recruiter Resume</span>
      <span class="bar-tip">Single-column layout formatted for Greenhouse, Lever, Workday, and Taleo.</span>
    </div>
    <div class="bar-actions">
      ${slug && slug !== 'portfolio' ? `<a href="/p/${escapeHtml(slug)}" class="btn-secondary">View Portfolio</a>` : ''}
      <button type="button" class="btn-print" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
    </div>
  </div>

  <main class="resume-container">
    <header class="resume-header">
      <h1 class="resume-name">${name}</h1>
      ${role ? `<div class="resume-role">${role}</div>` : ''}
      ${contactParts.length > 0 ? `<div class="resume-contact">${contactParts.join(' · ')}</div>` : ''}
    </header>

    ${summaryHtml}
    ${educationHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${highlightsHtml}
    ${recommendationsHtml}
  </main>
</body>
</html>`;
}
