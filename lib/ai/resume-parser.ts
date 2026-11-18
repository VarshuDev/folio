import type { AllowedProfilePath, ProfileSuggestion } from './contract';

export interface ExtractedField {
  value: string;
  quote: string;
}

export interface ExtractedProject {
  title: string;
  description: string;
  tools: string;
  link: string;
  quote: string;
}

export interface ParsedResumeFacts {
  name?: ExtractedField;
  role?: ExtractedField;
  about?: ExtractedField;
  location?: ExtractedField;
  education?: {
    college?: ExtractedField;
    degree?: ExtractedField;
    branch?: ExtractedField;
    gradYear?: ExtractedField;
    note?: ExtractedField;
  };
  skills: ExtractedField[];
  projects: ExtractedProject[];
  highlights: ExtractedField[];
  activities: ExtractedField[];
  email?: ExtractedField;
  github?: ExtractedField;
  linkedin?: ExtractedField;
}

function cleanQuote(line: string): string {
  return line.trim().slice(0, 300);
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseResumeText(rawText: string): ParsedResumeFacts {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const facts: ParsedResumeFacts = {
    skills: [],
    projects: [],
    highlights: [],
    activities: [],
  };

  // Section splitting
  type SectionType = 'header' | 'summary' | 'education' | 'skills' | 'experience' | 'projects' | 'awards' | 'activities' | 'other';
  let currentSection: SectionType = 'header';
  const sectionLines: Record<SectionType, string[]> = {
    header: [],
    summary: [],
    education: [],
    skills: [],
    experience: [],
    projects: [],
    awards: [],
    activities: [],
    other: [],
  };

  const isHeading = (line: string): SectionType | null => {
    const clean = line.replace(/^[#*\-—_=\s]+|[#*\-—_=\s:]+$/g, '').trim().toUpperCase();
    if (!clean || clean.length > 40) return null;

    if (/^(ABOUT\s*ME|SUMMARY|PROFESSIONAL\s*SUMMARY|PROFILE|OBJECTIVE|BIOGRAPHY)$/.test(clean)) return 'summary';
    if (/^(EDUCATION|ACADEMIC\s*BACKGROUND|ACADEMICS|STUDIES)$/.test(clean)) return 'education';
    if (/^(SKILLS|TECHNICAL\s*SKILLS|TECHNOLOGIES|CORE\s*COMPETENCIES|TECH\s*STACK)$/.test(clean)) return 'skills';
    if (/^(PROJECTS|PERSONAL\s*PROJECTS|NOTABLE\s*PROJECTS|KEY\s*PROJECTS|PRACTICE)$/.test(clean)) return 'projects';
    if (/^(EXPERIENCE|WORK\s*EXPERIENCE|EMPLOYMENT|INTERNSHIPS)$/.test(clean)) return 'experience';
    if (/(HONORS|AWARDS|ACHIEVEMENTS|CERTIFICATIONS|HIGHLIGHTS)/.test(clean) && !/(PROJECT|EXPERIENCE|EDUCATION|SKILL)/.test(clean)) return 'awards';
    if (/(ACTIVITIES|LEADERSHIP|EXTRACURRICULAR|VOLUNTEERING|CLUBS)/.test(clean) && !/(PROJECT|EXPERIENCE|EDUCATION|SKILL)/.test(clean)) return 'activities';
    return null;
  };

  for (const line of lines) {
    if (!line) continue;
    const detected = isHeading(line);
    if (detected) {
      currentSection = detected;
    } else {
      sectionLines[currentSection].push(line);
    }
  }

  // 1. Email extraction (anywhere in document, prioritizing header)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  for (const line of lines) {
    const emailMatch = line.match(emailRegex);
    if (emailMatch && !facts.email) {
      facts.email = { value: emailMatch[0], quote: cleanQuote(line) };
      break;
    }
  }

  // 2. GitHub & LinkedIn
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)/i;
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_.-]+)/i;

  for (const line of lines) {
    if (!facts.github) {
      const ghMatch = line.match(githubRegex);
      if (ghMatch) {
        facts.github = { value: normalizeUrl(ghMatch[0]), quote: cleanQuote(line) };
      }
    }
    if (!facts.linkedin) {
      const liMatch = line.match(linkedinRegex);
      if (liMatch) {
        facts.linkedin = { value: normalizeUrl(liMatch[0]), quote: cleanQuote(line) };
      }
    }
  }

  // 3. Name & Role from header
  const headerLines = sectionLines.header.filter((l) => !isHeading(l));
  if (headerLines.length > 0) {
    // First non-contact, non-empty line is usually the person's name
    for (let i = 0; i < Math.min(3, headerLines.length); i++) {
      const line = headerLines[i];
      if (emailRegex.test(line) || githubRegex.test(line) || linkedinRegex.test(line)) continue;
      if (/^(resume|curriculum vitae|cv)$/i.test(line)) continue;

      if (!facts.name && line.length < 60 && !/[0-9]/.test(line)) {
        facts.name = { value: line, quote: cleanQuote(line) };
        // Check next line for role/headline
        if (headerLines[i + 1] && !emailRegex.test(headerLines[i + 1]) && headerLines[i + 1].length < 80) {
          facts.role = { value: headerLines[i + 1], quote: cleanQuote(headerLines[i + 1]) };
        }
        break;
      }
    }
  }

  // Location detection (e.g. City, State or City, Country)
  const locationRegex = /\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b|[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z]+)/;
  for (const line of [...sectionLines.header, ...sectionLines.summary].slice(0, 5)) {
    if (emailRegex.test(line) || githubRegex.test(line)) {
      // might be pipe-separated: "user@mail.com | San Francisco, CA | github.com/..."
      const parts = line.split(/[|•·;]/).map((p) => p.trim());
      for (const part of parts) {
        const locMatch = part.match(locationRegex);
        if (locMatch && !emailRegex.test(part) && !/github|linkedin/i.test(part)) {
          facts.location = { value: locMatch[0].trim(), quote: cleanQuote(line) };
          break;
        }
      }
    } else {
      const locMatch = line.match(locationRegex);
      if (locMatch && line.length < 80) {
        facts.location = { value: locMatch[0].trim(), quote: cleanQuote(line) };
        break;
      }
    }
  }

  // 4. Summary / About
  if (sectionLines.summary.length > 0) {
    const summaryText = sectionLines.summary.join(' ').replace(/\s+/g, ' ').trim();
    if (summaryText.length > 10) {
      facts.about = { value: summaryText.slice(0, 1500), quote: cleanQuote(summaryText.slice(0, 120)) };
    }
  }

  // 5. Education
  if (sectionLines.education.length > 0) {
    facts.education = {};
    const eduLines = sectionLines.education;

    // Detect graduation year
    const yearMatch = eduLines.join(' ').match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      facts.education.gradYear = { value: yearMatch[1], quote: yearMatch[0] };
    }

    // Detect college name (University, College, Institute, School)
    for (const line of eduLines) {
      if (/(University|College|Institute|Polytechnic|Academy|School\s+of)/i.test(line)) {
        const cleanCollege = line.replace(/^(Bachelor|Master|B\.?S\.?|B\.?Tech|B\.?E\.?|M\.?S\.?|M\.?Tech|Ph\.?D\.?)\s+/i, '').trim();
        facts.education.college = { value: cleanCollege.slice(0, 120), quote: cleanQuote(line) };
        break;
      }
    }

    // Detect degree and branch
    for (const line of eduLines) {
      const degMatch = line.match(/\b(Bachelor(?:\s+of\s+[A-Za-z]+)?|Master(?:\s+of\s+[A-Za-z]+)?|B\.?S\.?|B\.?Tech|B\.?E\.?|M\.?S\.?|M\.?Tech|Ph\.?D\.?|Associate(?:\s+of\s+[A-Za-z]+)?)\b/i);
      if (degMatch) {
        facts.education.degree = { value: degMatch[0].trim(), quote: cleanQuote(line) };

        // Branch detection in the remaining text after the degree
        const afterDegree = line.slice((degMatch.index ?? 0) + degMatch[0].length);
        const branchMatch = afterDegree.match(/(?:in|major in|majoring in)\s+([A-Za-z\s&]+?)(?:,|-|\||\(|$)/i);
        if (branchMatch && branchMatch[1].trim().length > 2) {
          facts.education.branch = { value: branchMatch[1].trim().slice(0, 100), quote: cleanQuote(line) };
        }
        break;
      }
    }
  }

  // 6. Skills
  if (sectionLines.skills.length > 0) {
    const rawSkillsText = sectionLines.skills.join('\n');
    // Split by commas, bullet points, pipes, or semicolons
    const tokens = rawSkillsText
      .split(/[,;•|·\n]+/)
      .map((t) => t.replace(/^(Languages|Frameworks|Tools|Databases|Cloud|Libraries|Frontend|Backend|DevOps|Other):\s*/i, '').trim())
      .filter((t) => t.length > 1 && t.length <= 40 && !/^(Languages|Frameworks|Tools|Databases|Cloud)$/i.test(t));

    const seen = new Set<string>();
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (!seen.has(lower) && facts.skills.length < 25) {
        seen.add(lower);
        facts.skills.push({ value: token, quote: token });
      }
    }
  }

  // 7. Projects
  if (sectionLines.projects.length > 0) {
    const projectLines = sectionLines.projects;
    let currentProject: Partial<ExtractedProject> | null = null;
    const projectQuotes: string[] = [];

    const flushProject = () => {
      if (currentProject && (currentProject.title || currentProject.description)) {
        facts.projects.push({
          title: currentProject.title || 'Personal Project',
          description: currentProject.description || '',
          tools: currentProject.tools || '',
          link: currentProject.link || '',
          quote: cleanQuote(projectQuotes.join(' ')),
        });
      }
      currentProject = null;
      projectQuotes.length = 0;
    };

    for (const line of projectLines) {
      // Check if line looks like a project header (e.g. bolded, has tools in parentheses/brackets, or followed by link)
      const hasToolsParen = line.match(/^(.*?)[([|]\s*([^\])|]+)[)\]|]/);
      const isBullet = /^[-*•·]\s+/.test(line);

      if (!isBullet && line.length > 3 && line.length < 90 && !line.startsWith('http')) {
        // Potential new project title
        flushProject();
        if (hasToolsParen) {
          currentProject = {
            title: hasToolsParen[1].replace(/^[#*]+|[#*]+$/g, '').trim(),
            tools: hasToolsParen[2].trim(),
            description: '',
          };
        } else {
          currentProject = {
            title: line.replace(/^[#*]+|[#*]+$/g, '').trim(),
            description: '',
          };
        }
        projectQuotes.push(line);
      } else if (currentProject) {
        // Check for link in project
        const linkMatch = line.match(/https?:\/\/[^\s)]+/);
        if (linkMatch && !currentProject.link) {
          currentProject.link = linkMatch[0];
        }

        const cleanBullet = line.replace(/^[-*•·]\s+/, '').trim();
        if (cleanBullet) {
          currentProject.description = currentProject.description
            ? `${currentProject.description}\n${cleanBullet}`
            : cleanBullet;
          projectQuotes.push(line);
        }
      }
    }
    flushProject();
  }

  // 8. Highlights / Awards / Achievements
  if (sectionLines.awards.length > 0) {
    for (const line of sectionLines.awards) {
      const clean = line.replace(/^[-*•·]\s+/, '').trim();
      if (clean && clean.length > 5 && facts.highlights.length < 8) {
        facts.highlights.push({ value: clean.slice(0, 200), quote: cleanQuote(line) });
      }
    }
  }

  // 9. Activities / Leadership
  if (sectionLines.activities.length > 0) {
    for (const line of sectionLines.activities) {
      const clean = line.replace(/^[-*•·]\s+/, '').trim();
      if (clean && clean.length > 5 && facts.activities.length < 8) {
        facts.activities.push({ value: clean.slice(0, 200), quote: cleanQuote(line) });
      }
    }
  }

  return facts;
}

export function convertResumeFactsToSuggestions(facts: ParsedResumeFacts): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];
  let counter = 0;

  const makeId = (path: AllowedProfilePath) => `resume-${path.replace(/\./g, '-')}-${++counter}`;

  if (facts.name) {
    suggestions.push({
      id: makeId('basics.name'),
      path: 'basics.name',
      proposedValue: facts.name.value,
      provenance: { status: 'exact', text: facts.name.quote },
      reason: 'Name identified from resume header',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.role) {
    suggestions.push({
      id: makeId('basics.role'),
      path: 'basics.role',
      proposedValue: facts.role.value,
      provenance: { status: 'exact', text: facts.role.quote },
      reason: 'Professional title or headline from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.location) {
    suggestions.push({
      id: makeId('basics.location'),
      path: 'basics.location',
      proposedValue: facts.location.value,
      provenance: { status: 'exact', text: facts.location.quote },
      reason: 'Location identified from resume header',
      confidence: 'medium',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.about) {
    suggestions.push({
      id: makeId('basics.about'),
      path: 'basics.about',
      proposedValue: facts.about.value,
      provenance: { status: 'exact', text: facts.about.quote },
      reason: 'Summary or biography section from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.education?.college) {
    suggestions.push({
      id: makeId('education.college'),
      path: 'education.college',
      proposedValue: facts.education.college.value,
      provenance: { status: 'exact', text: facts.education.college.quote },
      reason: 'University or college from education section',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.education?.degree) {
    suggestions.push({
      id: makeId('education.degree'),
      path: 'education.degree',
      proposedValue: facts.education.degree.value,
      provenance: { status: 'exact', text: facts.education.degree.quote },
      reason: 'Degree program from education section',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.education?.branch) {
    suggestions.push({
      id: makeId('education.branch'),
      path: 'education.branch',
      proposedValue: facts.education.branch.value,
      provenance: { status: 'exact', text: facts.education.branch.quote },
      reason: 'Major or branch of study from education section',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.education?.gradYear) {
    suggestions.push({
      id: makeId('education.gradYear'),
      path: 'education.gradYear',
      proposedValue: facts.education.gradYear.value,
      provenance: { status: 'exact', text: facts.education.gradYear.quote },
      reason: 'Graduation year from education section',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  for (const skill of facts.skills) {
    suggestions.push({
      id: makeId('skills'),
      path: 'skills',
      proposedValue: skill.value,
      provenance: { status: 'exact', text: skill.quote },
      reason: 'Technical skill from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  for (const project of facts.projects) {
    suggestions.push({
      id: makeId('projects'),
      path: 'projects',
      proposedValue: {
        title: project.title,
        description: project.description,
        tools: project.tools,
        link: project.link,
      },
      provenance: { status: 'exact', text: project.quote },
      reason: 'Project extracted from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  for (const highlight of facts.highlights) {
    suggestions.push({
      id: makeId('highlights'),
      path: 'highlights',
      proposedValue: highlight.value,
      provenance: { status: 'exact', text: highlight.quote },
      reason: 'Achievement or honor from resume',
      confidence: 'medium',
      status: 'suggested',
      needsReview: true,
    });
  }

  for (const activity of facts.activities) {
    suggestions.push({
      id: makeId('activities'),
      path: 'activities',
      proposedValue: activity.value,
      provenance: { status: 'exact', text: activity.quote },
      reason: 'Extracurricular activity or club role from resume',
      confidence: 'medium',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.email) {
    suggestions.push({
      id: makeId('links.email'),
      path: 'links.email',
      proposedValue: facts.email.value,
      provenance: { status: 'exact', text: facts.email.quote },
      reason: 'Email address from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.github) {
    suggestions.push({
      id: makeId('links.github'),
      path: 'links.github',
      proposedValue: facts.github.value,
      provenance: { status: 'exact', text: facts.github.quote },
      reason: 'GitHub profile link from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  if (facts.linkedin) {
    suggestions.push({
      id: makeId('links.linkedin'),
      path: 'links.linkedin',
      proposedValue: facts.linkedin.value,
      provenance: { status: 'exact', text: facts.linkedin.quote },
      reason: 'LinkedIn profile link from resume',
      confidence: 'high',
      status: 'suggested',
      needsReview: true,
    });
  }

  return suggestions;
}
