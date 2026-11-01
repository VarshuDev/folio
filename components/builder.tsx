'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AIImproveCopy } from '@/components/ai-copy-improvement';
import { Icon } from '@/components/icon';
import { PortfolioPreview } from '@/components/portfolio-preview';
import { AdvancedWorkspace } from '@/components/advanced/advanced-workspace';
import { CaseStudyDrawer } from '@/components/case-study-drawer';
import { GitHubStatsBadge } from '@/components/github-stats-badge';
import type { User } from '@supabase/supabase-js';
import {
  SECTION_LABELS,
  type DesignConfig,
  type ProfileDocument,
  type Recommendation,
  type SectionKey,
  type TemplateId,
  type PortfolioConfig,
  type PortfolioMode,
  type Project,
  type ProjectCaseStudy,
} from '@/lib/profile-schema';
import { ADDITIONAL_TEMPLATE_IDS, TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, getTemplateMeta } from '@/lib/template-catalog';

const STEP_LABELS = ['About you', 'Education', 'Skills', 'Projects', 'Highlights & links', 'Design'];
const STEP_SUMMARIES = [
  'A few details to make the page feel like you.',
  'Your learning, so far.',
  'Tools and topics you’re exploring.',
  'Small builds and real practice.',
  'The other things you do.',
  'Choose a starting style.',
];

type BuilderProps = {
  profile: ProfileDocument;
  design: DesignConfig;
  setProfile: Dispatch<SetStateAction<ProfileDocument>>;
  setDesign: Dispatch<SetStateAction<DesignConfig>>;
  saveStatus: string;
  onSaveExit: () => void;
  onPublish: () => void;
  onDeploy?: () => void;
  onToast: (message: string) => void;
  onReview?: () => void;
  initialStep?: number;
  isPublished?: boolean;
  publishedSlug?: string | null;
  hasUnpublishedChanges?: boolean;
  user?: User | null;
  onSignIn?: () => void;
  portfolioConfig?: PortfolioConfig;
  onModeChange?: (mode: PortfolioMode) => void;
  onPortfolioConfigChange?: (config: PortfolioConfig) => void;
};

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  optional?: boolean;
  help?: string;
  multiline?: boolean;
  tall?: boolean;
  type?: string;
  onChange: (value: string) => void;
};

function Field({ label, value, placeholder, optional, help, multiline, tall, type = 'text', onChange }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="optional">optional</span>}</label>
      {multiline ? <textarea id={id} className={tall ? 'tall' : ''} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
      {help && <div className="field-help">{help}</div>}
    </div>
  );
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function DesignStageProgress() {
  return <ol className="intake-stage-list profile-review-progress" aria-label="Portfolio creation progress">
    <li className="complete"><span>1</span><b>Tell us</b></li>
    <li className="complete"><span>2</span><b>Review</b></li>
    <li className="current" aria-current="step"><span>3</span><b>Design</b></li>
    <li><span>4</span><b>Edit</b></li>
  </ol>;
}

function TemplateThumbnail({ id }: { id: TemplateId }) {
  const meta = getTemplateMeta(id);
  return <div className={`template-thumbnail template-thumbnail--${id} template-layout--${meta.layout}`} aria-hidden="true">
    <div className="template-thumbnail-nav"><i/><i/><i/></div>
    <div className="template-thumbnail-title"><b/><b/></div>
    <div className="template-thumbnail-content"><i/><i/><i/></div>
  </div>;
}

export function Builder({
  profile,
  design,
  setProfile,
  setDesign,
  saveStatus,
  onSaveExit,
  onPublish,
  onDeploy,
  onToast,
  onReview,
  initialStep = 0,
  isPublished = false,
  publishedSlug = null,
  hasUnpublishedChanges = false,
  user = null,
  onSignIn,
  portfolioConfig = { mode: 'simple' },
  onModeChange = () => {},
  onPortfolioConfigChange = () => {},
}: BuilderProps) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(STEP_LABELS.length - 1, initialStep)));
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const mobileEditScrollY = useRef(0);
  const pendingMobilePaneScroll = useRef<number | null>(null);
  const saveState = saveStatus.toLowerCase().includes('attention') || saveStatus === 'Changes not saved' || saveStatus.toLowerCase().includes('failed')
    ? 'attention'
    : saveStatus.toLowerCase().includes('unpublished')
      ? 'attention'
      : saveStatus.startsWith('Saving')
        ? 'saving'
        : saveStatus.startsWith('Saved') || saveStatus.startsWith('Published') || saveStatus.startsWith('Offline')
          ? 'saved'
          : 'idle';
  const [skillDraft, setSkillDraft] = useState('');
  const [interestDraft, setInterestDraft] = useState('');
  const [highlightDraft, setHighlightDraft] = useState('');
  const [activityDraft, setActivityDraft] = useState('');
  const [otherLinkLabelDraft, setOtherLinkLabelDraft] = useState('');
  const [otherLinkUrlDraft, setOtherLinkUrlDraft] = useState('');
  const [showAdditionalStyles, setShowAdditionalStyles] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('All styles');
  const [templateSearch, setTemplateSearch] = useState('');
  const [expandedCaseStudyId, setExpandedCaseStudyId] = useState<string | null>(null);
  const [previewCaseStudyProject, setPreviewCaseStudyProject] = useState<Project | null>(null);
  const [takeawayDrafts, setTakeawayDrafts] = useState<Record<string, string>>({});
  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  useLayoutEffect(() => {
    const top = pendingMobilePaneScroll.current;
    if (top === null) return;
    pendingMobilePaneScroll.current = null;
    window.scrollTo({ top, behavior: 'instant' });
  }, [mobilePane]);

  useEffect(() => {
    if (step === 5 && ADDITIONAL_TEMPLATE_IDS.includes(design.templateId)) setShowAdditionalStyles(true);
  }, [step, design.templateId]);

  const setBasics = (key: keyof ProfileDocument['basics'], value: string) => setProfile((current) => ({ ...current, basics: { ...current.basics, [key]: value } }));
  const setEducation = (key: keyof ProfileDocument['education'], value: string) => setProfile((current) => ({ ...current, education: { ...current.education, [key]: value } }));
  const setLink = (key: 'email' | 'github' | 'linkedin', value: string) => setProfile((current) => ({ ...current, links: { ...current.links, [key]: value } }));
  const updateOtherLink = (index: number, key: 'label' | 'url', value: string) => setProfile((current) => ({ ...current, links: { ...current.links, other: current.links.other.map((link, linkIndex) => linkIndex === index ? { ...link, [key]: value } : link) } }));
  const addOtherLink = () => {
    const url = otherLinkUrlDraft.trim();
    if (!url) { onToast('Add a website or social link first.'); return; }
    if (profile.links.other.length >= 12) { onToast('You can add up to 12 extra links.'); return; }
    setProfile((current) => ({ ...current, links: { ...current.links, other: [...current.links.other, { label: otherLinkLabelDraft.trim() || 'Portfolio or social link', url }] } }));
    setOtherLinkLabelDraft('');
    setOtherLinkUrlDraft('');
  };
  const removeOtherLink = (index: number) => setProfile((current) => ({ ...current, links: { ...current.links, other: current.links.other.filter((_, linkIndex) => linkIndex !== index) } }));
  const updateProject = (id: string, key: 'title' | 'description' | 'tools' | 'link' | 'githubUrl', value: string) => setProfile((current) => ({ ...current, projects: current.projects.map((project) => project.id === id ? { ...project, [key]: value } : project) }));

  const updateCaseStudy = (id: string, key: keyof ProjectCaseStudy, value: unknown) => {
    setProfile((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== id) return project;
        const cs = project.caseStudy || { problem: '', solution: '', architecture: '', takeaways: [], metrics: '', liveDemoUrl: '' };
        return {
          ...project,
          caseStudy: {
            ...cs,
            [key]: value,
          },
        };
      }),
    }));
  };

  const addTakeaway = (projectId: string) => {
    const text = (takeawayDrafts[projectId] || '').trim();
    if (!text) return;
    setProfile((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== projectId) return project;
        const cs = project.caseStudy || { problem: '', solution: '', architecture: '', takeaways: [], metrics: '', liveDemoUrl: '' };
        if (cs.takeaways.length >= 10) {
          onToast('You can add up to 10 takeaways per project.');
          return project;
        }
        return {
          ...project,
          caseStudy: {
            ...cs,
            takeaways: [...cs.takeaways, text],
          },
        };
      }),
    }));
    setTakeawayDrafts((prev) => ({ ...prev, [projectId]: '' }));
  };

  const removeTakeaway = (projectId: string, index: number) => {
    setProfile((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== projectId) return project;
        const cs = project.caseStudy || { problem: '', solution: '', architecture: '', takeaways: [], metrics: '', liveDemoUrl: '' };
        return {
          ...project,
          caseStudy: {
            ...cs,
            takeaways: cs.takeaways.filter((_, i) => i !== index),
          },
        };
      }),
    }));
  };

  const addListItem = (key: 'skills' | 'interests' | 'highlights' | 'activities', raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setProfile((current) => {
      const currentList = current[key];
      if (currentList.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return current;
      return { ...current, [key]: [...currentList, value] };
    });
  };

  const addProject = () => setProfile((current) => ({
    ...current,
    projects: [...current.projects, { id: makeId(), title: '', description: '', tools: '', link: '' }],
  }));

  const addRecommendation = () => {
    if ((profile.recommendations || []).length >= 20) {
      onToast('You can add up to 20 recommendations.');
      return;
    }
    setProfile((current) => ({
      ...current,
      recommendations: [
        ...(current.recommendations || []),
        { id: makeId(), author: '', role: '', company: '', text: '', link: '' },
      ],
    }));
  };

  const updateRecommendation = (id: string, key: keyof Recommendation, value: string) => {
    setProfile((current) => ({
      ...current,
      recommendations: (current.recommendations || []).map((rec) =>
        rec.id === id ? { ...rec, [key]: value } : rec
      ),
    }));
  };

  const removeRecommendation = (id: string) => {
    setProfile((current) => ({
      ...current,
      recommendations: (current.recommendations || []).filter((rec) => rec.id !== id),
    }));
  };


  const moveStep = (next: number) => {
    setStep(Math.max(0, Math.min(STEP_LABELS.length - 1, next)));
    setMobilePane('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchMobilePane = (next: 'edit' | 'preview') => {
    if (next === mobilePane) return;
    if (!window.matchMedia('(max-width: 700px)').matches) {
      setMobilePane(next);
      return;
    }
    if (next === 'preview') {
      mobileEditScrollY.current = window.scrollY;
      pendingMobilePaneScroll.current = 0;
    } else {
      pendingMobilePaneScroll.current = mobileEditScrollY.current;
    }
    setMobilePane(next);
  };

  const addChipFromKeyboard = (event: React.KeyboardEvent<HTMLInputElement>, key: 'skills' | 'interests' | 'highlights' | 'activities', value: string, clear: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addListItem(key, value);
      clear();
    }
  };

  const removeListItem = (key: 'skills' | 'interests' | 'highlights' | 'activities', index: number) => setProfile((current) => ({ ...current, [key]: current[key].filter((_, itemIndex) => itemIndex !== index) }));

  const renderChips = (key: 'skills' | 'interests' | 'highlights' | 'activities', list: string[]) => (
    <div className="chips">
      {list.length === 0 ? <span className="field-help">{key === 'highlights' ? 'Small responsibilities and contributions count too.' : key === 'activities' ? 'Clubs, events, volunteering, and teams all count.' : 'Add one item at a time. No skill scores or percentages.'}</span> : list.map((item, index) => (
        <span className="chip" key={`${key}-${item}-${index}`}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => removeListItem(key, index)}>×</button></span>
      ))}
    </div>
  );

  const renderStep = () => {
    if (step === 0) return <>
      <div className="step-overline"><span className="tiny-dot" /> Step 1 · About you</div>
      <h1>Let’s start with you.</h1>
      <p className="step-intro">A few honest details are enough. You can skip anything that doesn’t feel right.</p>
      {onReview && <button type="button" className="text-button review-profile-link" onClick={onReview}><Icon name="spark" size={13} /> Review my information before choosing a look</button>}
      <div className="form-stack">
        <Field label="What should we call you?" value={profile.basics.name} placeholder="Your name" onChange={(value) => setBasics('name', value)} />
        <Field label="What are you learning or curious about?" value={profile.basics.role} placeholder="e.g. First-year engineering student" onChange={(value) => setBasics('role', value)} />
        <div className="field">
          <div className="field-title-row"><label htmlFor="profile-about">A little about you<span className="optional">optional</span></label><button className="hint-button" type="button" onClick={() => onToast('Try: “I’m learning ___ and I’m curious about ___.”')}>Need a starting point?</button></div>
          <textarea id="profile-about" className="tall" value={profile.basics.about} placeholder="What are you exploring, building, or hoping to do next? A rough note is fine." onChange={(event) => setBasics('about', event.target.value)} />
          <div className="field-help">Write it the way you’d say it. You can polish it later.</div>
          <AIImproveCopy profile={profile} path="basics.about" text={profile.basics.about} label="About text" onProfileChange={setProfile} />
        </div>
        <Field label="Where are you based?" optional value={profile.basics.location} placeholder="City or region" onChange={(value) => setBasics('location', value)} />
        <div className="helper-box"><span className="helper-mark"><Icon name="light" size={12} /></span><span><strong>You don’t need a polished bio.</strong> A sentence about what you’re learning or interested in is a great start.</span></div>
      </div>
    </>;

    if (step === 1) return <>
      <div className="step-overline"><span className="tiny-dot" /> Step 2 · Education</div>
      <h1>Your learning, so far.</h1>
      <p className="step-intro">Add your college or course if it helps people understand where you’re coming from. You can leave anything blank.</p>
      <div className="form-stack">
        <Field label="College or university" optional value={profile.education.college} placeholder="Name of your college" onChange={(value) => setEducation('college', value)} />
        <div className="field-row">
          <Field label="Degree or course" optional value={profile.education.degree} placeholder="e.g. B.E." onChange={(value) => setEducation('degree', value)} />
          <Field label="Branch or subject" optional value={profile.education.branch} placeholder="e.g. Computer Science" onChange={(value) => setEducation('branch', value)} />
        </div>
        <Field label="Expected graduation year" optional value={profile.education.gradYear} placeholder="e.g. 2029" onChange={(value) => setEducation('gradYear', value)} />
        <Field label="Anything else about your studies?" optional multiline value={profile.education.note} placeholder="A class, topic, or activity you’ve enjoyed so far." onChange={(value) => setEducation('note', value)} />
        <div className="helper-box"><span className="helper-mark"><Icon name="book" size={12} /></span><span><strong>Still in your first year?</strong> That’s completely fine. You can add more as you go.</span></div>
      </div>
    </>;

    if (step === 2) return <>
      <div className="step-overline"><span className="tiny-dot" /> Step 3 · Skills &amp; interests</div>
      <h1>What are you exploring?</h1>
      <p className="step-intro">List skills you’re learning or using. You don’t need to rate yourself or be an expert.</p>
      <div className="form-stack">
        <div className="field"><label htmlFor="skill-entry">Skills and tools</label><div className="chip-entry"><input id="skill-entry" value={skillDraft} onChange={(event) => setSkillDraft(event.target.value)} onKeyDown={(event) => addChipFromKeyboard(event, 'skills', skillDraft, () => setSkillDraft(''))} placeholder="Type one skill, then press Enter" /><button type="button" aria-label="Add skill" onClick={() => { addListItem('skills', skillDraft); setSkillDraft(''); }}>+</button></div>{renderChips('skills', profile.skills)}</div>
        <div className="section-divider" />
        <div className="field"><label htmlFor="interest-entry">Things you’re curious about<span className="optional">optional</span></label><div className="chip-entry"><input id="interest-entry" value={interestDraft} onChange={(event) => setInterestDraft(event.target.value)} onKeyDown={(event) => addChipFromKeyboard(event, 'interests', interestDraft, () => setInterestDraft(''))} placeholder="e.g. Accessible design" /><button type="button" aria-label="Add interest" onClick={() => { addListItem('interests', interestDraft); setInterestDraft(''); }}>+</button></div>{renderChips('interests', profile.interests)}</div>
        <div className="helper-box"><span className="helper-mark"><Icon name="spark" size={12} /></span><span><strong>No skill scores or percentages.</strong> Just name the tools and topics you’ve actually spent time with.</span></div>
      </div>
    </>;

    if (step === 3) return <>
      <div className="step-overline"><span className="tiny-dot" /> Step 4 · Projects &amp; practice</div>
      <h1>Show what you’ve tried.</h1>
      <p className="step-intro">Small builds, class assignments, prototypes, and learning experiments all belong here.</p>
      <div className="form-stack">
        <div className="helper-box"><span className="helper-mark"><Icon name="light" size={12} /></span><span><strong>Don’t have a “professional” project?</strong> A Python program, college assignment, Figma idea, hackathon prototype, or a small thing you made while learning can count.</span></div>
        {profile.projects.length === 0 ? (
          <div className="empty-note">
            <span className="empty-illustration"><Icon name="layers" size={16} /></span>
            <strong>No projects yet</strong>
            <p>Add something you’ve built, even if it’s a small practice project, class assignment, or idea you explored.</p>
          </div>
        ) : profile.projects.map((project, index) => <article className="project-card" key={project.id}>
          <div className="project-card-head"><span>Project {index + 1}</span><button type="button" className="remove-button" aria-label={`Remove project ${index + 1}`} onClick={() => setProfile((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== project.id) }))}>Remove</button></div>
          <div className="project-fields">
            <Field label="What did you call it?" value={project.title} placeholder="e.g. A tiny weather app" onChange={(value) => updateProject(project.id, 'title', value)} />
            <div className="field"><label htmlFor={`project-description-${project.id}`}>What does it do, or what did you learn?</label><textarea id={`project-description-${project.id}`} value={project.description} maxLength={3000} placeholder="A rough explanation is perfect. You can clarify it in your profile editor whenever you’re ready." onChange={(event) => updateProject(project.id, 'description', event.target.value)} /><AIImproveCopy profile={profile} path={`projects[${index}].description`} localProjectId={project.id} text={project.description} label={`project ${index + 1} description`} onProfileChange={setProfile} /></div>
            <div className="field-row"><Field label="Tools you used" optional value={project.tools} placeholder="e.g. Python, Figma" onChange={(value) => updateProject(project.id, 'tools', value)} /><Field label="Link" optional value={project.link} placeholder="GitHub or demo" onChange={(value) => updateProject(project.id, 'link', value)} /></div>

            {/* Live GitHub Stats Badge if detected */}
            {(project.githubUrl || (project.link && project.link.includes('github.com'))) && (
              <div style={{ marginTop: '0.25rem' }}>
                <GitHubStatsBadge project={project} />
              </div>
            )}

            {/* Expandable Technical Case Study & GitHub Sync Panel */}
            <div
              style={{
                marginTop: '0.75rem',
                border: '1px solid #e2ded4',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: expandedCaseStudyId === project.id ? '#faf8f2' : '#fcfbfa',
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedCaseStudyId(expandedCaseStudyId === project.id ? null : project.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.9rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: '#29342d',
                  textAlign: 'left',
                }}
                aria-expanded={expandedCaseStudyId === project.id}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>📖</span>
                  <span>Technical Case Study &amp; GitHub Sync</span>
                  {project.caseStudy?.problem || project.caseStudy?.architecture || project.caseStudy?.metrics ? (
                    <span style={{ fontSize: '0.7rem', background: '#e1ede6', color: '#2b5c40', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>Active</span>
                  ) : null}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#68776e' }}>
                  {expandedCaseStudyId === project.id ? '▲ Hide details' : '▼ Expand details'}
                </span>
              </button>

              {expandedCaseStudyId === project.id && (
                <div style={{ padding: '0.75rem 0.9rem 1.1rem', borderTop: '1px solid #e7e5dc', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div className="field-row">
                    <Field
                      label="Direct GitHub Repository URL"
                      optional
                      value={project.githubUrl || ''}
                      placeholder="https://github.com/owner/repo"
                      onChange={(value) => updateProject(project.id, 'githubUrl', value)}
                    />
                    <Field
                      label="Measurable Impact / Key Metric"
                      optional
                      value={project.caseStudy?.metrics || ''}
                      placeholder="e.g. 40% query latency reduction, 5k users"
                      onChange={(value) => updateCaseStudy(project.id, 'metrics', value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={`case-study-problem-${project.id}`}>
                      The Problem &amp; Engineering Challenge <span className="optional">optional</span>
                    </label>
                    <textarea
                      id={`case-study-problem-${project.id}`}
                      value={project.caseStudy?.problem || ''}
                      maxLength={3000}
                      rows={3}
                      placeholder="What specific user problem, scalability bottleneck, or technical challenge did this solve?"
                      onChange={(e) => updateCaseStudy(project.id, 'problem', e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={`case-study-solution-${project.id}`}>
                      Architecture &amp; Technical Solution <span className="optional">optional</span>
                    </label>
                    <textarea
                      id={`case-study-solution-${project.id}`}
                      value={project.caseStudy?.solution || ''}
                      maxLength={3000}
                      rows={3}
                      placeholder="Explain the architectural choices, tradeoffs, caching, or database patterns you implemented."
                      onChange={(e) => updateCaseStudy(project.id, 'solution', e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={`case-study-arch-snippet-${project.id}`}>
                      Architecture Flow / Diagram Notes <span className="optional">optional</span>
                    </label>
                    <textarea
                      id={`case-study-arch-snippet-${project.id}`}
                      value={project.caseStudy?.architecture || ''}
                      maxLength={3000}
                      rows={2}
                      style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                      placeholder="e.g. Client -> Cloudflare Worker -> Next.js SSR -> Redis Cache -> PostgreSQL"
                      onChange={(e) => updateCaseStudy(project.id, 'architecture', e.target.value)}
                    />
                  </div>

                  {/* Takeaways & Lessons Learned */}
                  <div className="field">
                    <span className="field-label">Key Takeaways &amp; Engineering Lessons <span className="optional">optional</span></span>
                    <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.25rem' }}>
                      <input
                        value={takeawayDrafts[project.id] || ''}
                        onChange={(e) => setTakeawayDrafts((prev) => ({ ...prev, [project.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTakeaway(project.id);
                          }
                        }}
                        placeholder="e.g. Learned how to manage connection pooling in serverless"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => addTakeaway(project.id)}
                        className="button secondary"
                        style={{ padding: '0.35rem 0.8rem', whiteSpace: 'nowrap' }}
                      >
                        + Add takeaway
                      </button>
                    </div>
                    {project.caseStudy?.takeaways && project.caseStudy.takeaways.length > 0 && (
                      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {project.caseStudy.takeaways.map((takeaway, tIndex) => (
                          <li key={tIndex} style={{ fontSize: '0.85rem', color: '#3d4841' }}>
                            <span>{takeaway}</span>
                            <button
                              type="button"
                              onClick={() => removeTakeaway(project.id, tIndex)}
                              style={{ background: 'transparent', border: 'none', color: '#c0392b', cursor: 'pointer', marginLeft: '0.5rem', fontSize: '0.75rem' }}
                              aria-label={`Remove takeaway ${tIndex + 1}`}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Instant Drawer Preview Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewCaseStudyProject(project)}
                      className="button secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.82rem',
                        padding: '0.35rem 0.75rem',
                      }}
                    >
                      <span>Preview Case Study Drawer</span>
                      <span>📖</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </article>)}
        <button type="button" className="add-row" onClick={addProject}><span>+</span> Add a project or class assignment</button>
        <Field label="What are you learning right now?" optional value={profile.learning} placeholder="e.g. I’m practicing Python basics and exploring web design." onChange={(value) => setProfile((current) => ({ ...current, learning: value }))} />
      </div>
    </>;

    if (step === 4) return <>
      <div className="step-overline"><span className="tiny-dot" /> Step 5 · Highlights &amp; links</div>
      <h1>The other things you do.</h1>
      <p className="step-intro">A club role, event, course, certificate, or a way for people to reach you. All optional.</p>
      <div className="form-stack">
        <div className="field"><label htmlFor="highlight-entry">Things you’re proud of<span className="optional">optional</span></label><div className="chip-entry"><input id="highlight-entry" value={highlightDraft} onChange={(event) => setHighlightDraft(event.target.value)} onKeyDown={(event) => addChipFromKeyboard(event, 'highlights', highlightDraft, () => setHighlightDraft(''))} placeholder="e.g. Finished a course I started" /><button type="button" aria-label="Add highlight" onClick={() => { addListItem('highlights', highlightDraft); setHighlightDraft(''); }}>+</button></div>{renderChips('highlights', profile.highlights)}</div>
        <div className="field"><label htmlFor="activity-entry">Things you participated in or helped with<span className="optional">optional</span></label><div className="chip-entry"><input id="activity-entry" value={activityDraft} onChange={(event) => setActivityDraft(event.target.value)} onKeyDown={(event) => addChipFromKeyboard(event, 'activities', activityDraft, () => setActivityDraft(''))} placeholder="e.g. Helped organize a college event" /><button type="button" aria-label="Add activity" onClick={() => { addListItem('activities', activityDraft); setActivityDraft(''); }}>+</button></div>{renderChips('activities', profile.activities)}</div>
        <div className="section-divider" />
        <Field label="Email" optional type="email" value={profile.links.email} placeholder="you@example.com" onChange={(value) => setLink('email', value)} />
        <div className="field-row"><Field label="GitHub" optional value={profile.links.github} placeholder="github.com/you" onChange={(value) => setLink('github', value)} /><Field label="LinkedIn" optional value={profile.links.linkedin} placeholder="linkedin.com/in/you" onChange={(value) => setLink('linkedin', value)} /></div>
        <div className="field other-link-editor"><span className="field-label">Portfolio or social links <span className="optional">optional</span></span><p className="field-help">A personal site, Instagram, or another place you’d like to share.</p>
          {profile.links.other.length === 0 ? (
            <div className="empty-note" style={{ margin: '8px 0 12px' }}>
              <strong>No extra links yet</strong>
              <p>Add a personal website, writing profile, or social link if you’d like to share one.</p>
            </div>
          ) : (
            profile.links.other.map((link, index) => <div className="other-link-edit-row" key={`${link.label}-${link.url}-${index}`}><Field label={`Link name ${index + 1}`} value={link.label} placeholder="e.g. Personal website" onChange={(value) => updateOtherLink(index, 'label', value)} /><div className="other-link-url-row"><Field label={`Link address ${index + 1}`} value={link.url} placeholder="example.com/you" onChange={(value) => updateOtherLink(index, 'url', value)} /><button type="button" className="remove-button" aria-label={`Remove link ${index + 1}: ${link.label || link.url}`} onClick={() => removeOtherLink(index)}>Remove</button></div></div>)
          )}
          {profile.links.other.length < 12 && <div className="other-link-add"><div className="field-row"><Field label="Link name" value={otherLinkLabelDraft} placeholder="e.g. Portfolio or Instagram" onChange={setOtherLinkLabelDraft} /><Field label="Link address" value={otherLinkUrlDraft} placeholder="example.com/you" onChange={setOtherLinkUrlDraft} /></div><button type="button" className="add-row" onClick={addOtherLink}><span>+</span> Add link</button></div>}
        </div>
        <div className="section-divider" />
        <div className="field recommendations-editor">
          <span className="field-label">Recommendations &amp; endorsements <span className="optional">optional</span></span>
          <p className="field-help">Quotes and testimonials from mentors, professors, teammates, or collaborators.</p>
          {(profile.recommendations || []).length === 0 ? (
            <div className="empty-note" style={{ margin: '8px 0 12px' }}>
              <strong>No recommendations yet</strong>
              <p>Add a quote or endorsement from someone who knows your work.</p>
            </div>
          ) : (
            (profile.recommendations || []).map((rec, index) => (
              <article className="project-card" key={rec.id} style={{ marginBottom: '14px' }}>
                <div className="project-card-head">
                  <span>Recommendation {index + 1}</span>
                  <button
                    type="button"
                    className="remove-button"
                    aria-label={`Remove recommendation ${index + 1}`}
                    onClick={() => removeRecommendation(rec.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className="project-fields">
                  <div className="field">
                    <label htmlFor={`rec-text-${rec.id}`}>What did they say?</label>
                    <textarea
                      id={`rec-text-${rec.id}`}
                      value={rec.text}
                      maxLength={3000}
                      placeholder="e.g. 'Alex led our frontend development with exceptional quality...'"
                      onChange={(e) => updateRecommendation(rec.id, 'text', e.target.value)}
                    />
                  </div>
                  <div className="field-row">
                    <Field
                      label="Person's name"
                      value={rec.author}
                      placeholder="e.g. Dr. Sarah Jenkins"
                      onChange={(value) => updateRecommendation(rec.id, 'author', value)}
                    />
                    <Field
                      label="Their role or title"
                      optional
                      value={rec.role}
                      placeholder="e.g. Lead Engineer / Professor"
                      onChange={(value) => updateRecommendation(rec.id, 'role', value)}
                    />
                  </div>
                  <div className="field-row">
                    <Field
                      label="Company or university"
                      optional
                      value={rec.company}
                      placeholder="e.g. Stanford University"
                      onChange={(value) => updateRecommendation(rec.id, 'company', value)}
                    />
                    <Field
                      label="Link or reference"
                      optional
                      value={rec.link}
                      placeholder="e.g. linkedin.com/in/author"
                      onChange={(value) => updateRecommendation(rec.id, 'link', value)}
                    />
                  </div>
                </div>
              </article>
            ))
          )}
          {(profile.recommendations || []).length < 20 && (
            <button type="button" className="add-row" onClick={addRecommendation}>
              <span>+</span> Add recommendation or quote
            </button>
          )}
        </div>
        <div className="helper-box"><span className="helper-mark"><Icon name="lock" size={12} /></span><span><strong>You decide what’s public.</strong> Only the links you add here can appear on your portfolio.</span></div>
      </div>
    </>;

    const toggleSection = (key: SectionKey) => setDesign((current) => ({ ...current, visibleSections: { ...current.visibleSections, [key]: !current.visibleSections[key] } }));
    const moveSection = (key: SectionKey, direction: -1 | 1) => setDesign((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(key);
      const target = index + direction;
      if (target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, sectionOrder: order };
    });
    const featuredTemplates = TEMPLATE_CATALOG.filter((template) => template.featured);
    const additionalTemplates = TEMPLATE_CATALOG.filter((template) => ADDITIONAL_TEMPLATE_IDS.includes(template.id));
    const filteredTemplates = additionalTemplates.filter((template) => {
      const categoryMatches = templateFilter === 'All styles' || template.category === templateFilter;
      const searchMatches = `${template.name} ${template.description} ${template.category}`.toLowerCase().includes(templateSearch.toLowerCase());
      return categoryMatches && searchMatches;
    });
    return <>
      <DesignStageProgress />
      <div className="step-overline"><span className="tiny-dot" /> Step 6 · Make it yours</div>
      <h1>Choose a starting style.</h1>
      <p className="step-intro">These layouts have different rhythms—not just different colors. You can change your choice later.</p>
      <div className="form-stack">
        <div className="picker-heading"><div><span className="eyebrow">START HERE</span><strong>Recommended</strong></div><span>3 clear starting points</span></div>
        <div className="style-choice-grid" role="group" aria-label="Recommended portfolio styles">
          {featuredTemplates.map((option) => {
            const selected = design.templateId === option.id;
            return <button type="button" key={option.id} className={`style-choice ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setDesign((current) => ({ ...current, templateId: option.id }))}>
              <TemplateThumbnail id={option.id}/>
              <strong>{option.name}</strong>
              <small>{option.description}</small>
              {selected && <span className="style-selected-label"><Icon name="check" size={14}/> Selected</span>}
            </button>;
          })}
        </div>
        <button type="button" className={`browse-styles-button ${showAdditionalStyles ? 'open' : ''}`} aria-expanded={showAdditionalStyles} aria-controls="additional-style-browser" onClick={() => setShowAdditionalStyles((open) => !open)}><span><strong>Explore all 19 additional styles</strong><small>Editorial, visual, technical, playful, and more</small></span><span className="browse-styles-count">{showAdditionalStyles ? 'Hide' : 'Browse'} <b aria-hidden="true">{showAdditionalStyles ? '−' : '+'}</b></span></button>
        {showAdditionalStyles && <div className="additional-template-browser" id="additional-style-browser">
          <div className="template-browser-top"><div><span className="eyebrow">THE FULL COLLECTION</span><strong>Choose a different visual direction</strong></div><label className="template-search"><span aria-hidden="true">⌕</span><input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search styles" aria-label="Search portfolio styles" /></label></div>
          <div className="template-filter-row" role="group" aria-label="Filter portfolio styles">{['All styles', ...TEMPLATE_CATEGORIES].map((category) => <button type="button" key={category} className={`template-filter ${templateFilter === category ? 'active' : ''}`} aria-pressed={templateFilter === category} onClick={() => setTemplateFilter(category)}>{category}{category === 'All styles' && <> <span>19</span></>}</button>)}</div>
          <div className="additional-style-grid">{filteredTemplates.map((option) => {
            const selected = design.templateId === option.id;
            return <button type="button" key={option.id} className={`additional-style-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setDesign((current) => ({ ...current, templateId: option.id }))}><TemplateThumbnail id={option.id}/><span className="additional-style-meta"><strong>{option.name}</strong><small>{option.category}</small></span><span className="additional-style-desc">{option.description}</span>{selected && <span className="selected-check"><Icon name="check" size={13}/> Selected</span>}</button>;
          })}</div>
          {filteredTemplates.length === 0 && <p className="no-template-results">No styles match that search. Try another term.</p>}
        </div>}
        <div className="section-divider" />
        <div className="field"><span className="field-label" id="visibility-options-label">Choose what to show</span><div className="visibility-list" role="group" aria-labelledby="visibility-options-label" aria-describedby="visibility-order-help">{design.sectionOrder.map((key) => {
          const item = SECTION_LABELS.find((section) => section.key === key)!;
          const index = design.sectionOrder.indexOf(key);
          return <div className="visibility-row" key={key}><span>{item.label}</span><div className="visibility-actions"><button type="button" className="order-button" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => moveSection(key, -1)}>↑</button><button type="button" className="order-button" aria-label={`Move ${item.label} down`} disabled={index === design.sectionOrder.length - 1} onClick={() => moveSection(key, 1)}>↓</button><button type="button" className={`toggle ${design.visibleSections[key] ? 'on' : ''}`} role="switch" aria-checked={design.visibleSections[key]} aria-label={`Show ${item.label}`} onClick={() => toggleSection(key)} /></div></div>;
        })}</div><div className="field-help" id="visibility-order-help">Empty sections stay hidden automatically. Use the arrows to change their order.</div></div>
        <div className="helper-box"><span className="helper-mark"><Icon name="eye" size={12} /></span><span><strong>Look at the preview as you choose.</strong> Your page updates here with your details.</span></div>
      </div>
    </>;
  };

  return (
    <div className="studio screen-fade">
      <header className="studio-bar">
        <div className="studio-brand"><a className="logo" href="#" onClick={(event) => { event.preventDefault(); onSaveExit(); }}><span className="logo-mark"><Icon name="leaf" size={14} /></span><span>folio</span></a><span className="bar-separator" /><span className="draft-label">{isPublished && publishedSlug ? `/p/${publishedSlug}` : 'New portfolio'}</span></div>
        <div className="studio-center" data-state={saveState} role="status" aria-live="polite" aria-atomic="true"><span className="save-dot" aria-hidden="true" /><span>{saveStatus}</span></div>
        <div className="studio-actions">
          <div className="portfolio-mode-toggle" role="radiogroup" aria-label="Portfolio mode">
            <button
              type="button"
              className={`mode-btn ${portfolioConfig.mode === 'simple' ? 'active' : ''}`}
              role="radio"
              aria-checked={portfolioConfig.mode === 'simple'}
              onClick={() => onModeChange('simple')}
              aria-label="Simple portfolio mode"
            >
              Simple
            </button>
            <button
              type="button"
              className={`mode-btn ${portfolioConfig.mode === 'advanced' ? 'active' : ''}`}
              role="radio"
              aria-checked={portfolioConfig.mode === 'advanced'}
              onClick={() => onModeChange('advanced')}
              aria-label="Advanced portfolio mode"
            >
              Advanced
            </button>
          </div>
          <div className="mobile-switch" role="group" aria-label="Choose what to view">
            <button type="button" className={mobilePane === 'edit' ? 'active' : ''} aria-pressed={mobilePane === 'edit'} onClick={() => switchMobilePane('edit')}>Edit</button>
            <button type="button" className={mobilePane === 'preview' ? 'active' : ''} aria-pressed={mobilePane === 'preview'} onClick={() => switchMobilePane('preview')}>Preview</button>
          </div>
          {user ? (
            <a href="/account" className="button subtle small" aria-label="Account">Account</a>
          ) : (
            <button className="button subtle small" type="button" onClick={onSignIn} aria-label="Sign in">Sign in</button>
          )}
          <button
            className="button subtle small"
            type="button"
            title="Export an ATS-friendly printable PDF resume"
            onClick={async () => {
              try {
                if (isPublished && publishedSlug) {
                  window.open(`/api/portfolio/export?slug=${encodeURIComponent(publishedSlug)}&format=resume`, '_blank');
                } else {
                  const res = await fetch('/api/portfolio/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      profile,
                      slug: profile.basics.name?.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'resume',
                      format: 'resume',
                    }),
                  });
                  if (!res.ok) throw new Error('Export failed');
                  const html = await res.text();
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                  }
                }
              } catch {
                onToast('Could not generate resume. Please try again.');
              }
            }}
          >
            Resume (PDF)
          </button>
          <button className="button subtle small" type="button" onClick={onSaveExit}>Save &amp; exit</button>
          {portfolioConfig.mode === 'advanced' ? (
            <button
              className="button small"
              type="button"
              onClick={onDeploy}
              data-testid="studio-deploy-btn"
            >
              Deploy to Vercel <Icon name="arrow" size={12} />
            </button>
          ) : (
            <button className="button small" type="button" onClick={onPublish}>
              {isPublished ? (hasUnpublishedChanges ? 'Publish updates' : 'Published') : 'Publish'} <Icon name="arrow" size={12} />
            </button>
          )}
        </div>
      </header>
      <main className={`studio-layout ${mobilePane === 'preview' ? 'mobile-preview' : ''} ${portfolioConfig.mode === 'advanced' ? 'advanced-mode' : ''}`}>
        {portfolioConfig.mode === 'advanced' ? (
          <AdvancedWorkspace
            profile={profile}
            portfolioConfig={portfolioConfig}
            onChangeConfig={onPortfolioConfigChange}
            onReview={onReview}
            viewport={viewport}
            onViewportChange={setViewport}
            mobilePane={mobilePane}
          />
        ) : (
          <>
            <aside className="steps-rail">
              <div className="rail-title">Your portfolio · Step {step + 1} of {STEP_LABELS.length}</div>
              <div className="rail-progress" role="progressbar" aria-label="Portfolio setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <nav className="step-list" aria-label="Portfolio setup steps">
                {STEP_LABELS.map((label, index) => (
                  <button type="button" key={label} className={`rail-step ${step === index ? 'active' : ''} ${index < step ? 'done' : ''}`} aria-current={step === index ? 'step' : undefined} onClick={() => moveStep(index)}>
                    <span className="step-mini-number" aria-hidden="true">{index < step ? '✓' : index + 1}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
              <div className="rail-tip">
                <Icon name="light" size={14} />
                <p>You can skip a step and come back later. A first version is allowed to be a work in progress.</p>
              </div>
            </aside>
            <section className="form-panel" aria-label="Portfolio details">
              {renderStep()}
              <div className="form-footer">
                <button className="button secondary small" type="button" onClick={() => moveStep(step - 1)} disabled={step === 0}>
                  <Icon name="arrowLeft" size={12} /> Back
                </button>
                <span className="skip-note">{STEP_SUMMARIES[step]}</span>
                <button className="button small" type="button" onClick={() => { if (step < STEP_LABELS.length - 1) moveStep(step + 1); else { switchMobilePane('preview'); onToast('Your design is ready to review.'); } }}>
                  {step === STEP_LABELS.length - 1 ? 'Done' : 'Continue'} <Icon name="arrow" size={12} />
                </button>
              </div>
            </section>
            <PortfolioPreview profile={profile} design={design} viewport={viewport} onViewportChange={setViewport} />
          </>
        )}
      </main>
      <CaseStudyDrawer
        project={previewCaseStudyProject}
        isOpen={Boolean(previewCaseStudyProject)}
        onClose={() => setPreviewCaseStudyProject(null)}
      />
    </div>
  );
}
