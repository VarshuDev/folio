'use client';

import React, { useEffect, useRef } from 'react';
import type { Project } from '@/lib/profile-schema';
import { safeExternalUrl } from '@/lib/profile-schema';
import { GitHubStatsBadge } from './github-stats-badge';

interface CaseStudyDrawerProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CaseStudyDrawer({ project, isOpen, onClose }: CaseStudyDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key and handle scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button on open
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const caseStudy = project.caseStudy;
  const liveDemoUrl = safeExternalUrl(caseStudy?.liveDemoUrl || project.link);
  const sourceCodeUrl = safeExternalUrl(project.githubUrl || (project.link.includes('github.com') ? project.link : ''));
  const toolsList = project.tools ? project.tools.split(/[,·]/).map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div
      className="case-study-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(20, 24, 22, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-study-title"
        className="case-study-drawer"
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100%',
          backgroundColor: '#fffefa',
          color: '#29342d',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '1.5rem 1.75rem',
            borderBottom: '1px solid #e7e5dc',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            background: '#faf8f2',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#355d48',
                marginBottom: '0.35rem',
              }}
            >
              TECHNICAL CASE STUDY
            </div>
            <h2
              id="case-study-title"
              style={{
                margin: 0,
                fontSize: '1.45rem',
                lineHeight: 1.25,
                fontWeight: 700,
                color: '#1c2420',
                fontFamily: 'inherit',
              }}
            >
              {project.title || 'Untitled Project'}
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close case study drawer"
            style={{
              background: 'transparent',
              border: '1px solid #dcdad2',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#4a554e',
              fontSize: '1.1rem',
              lineHeight: 1,
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#eae7df';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.75rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
            fontSize: '0.95rem',
            lineHeight: 1.6,
          }}
        >
          {/* GitHub Stats Badge if available */}
          <div>
            <GitHubStatsBadge project={project} />
          </div>

          {/* Tools Tags */}
          {toolsList.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5b6b61', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Technologies & Architecture
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {toolsList.map((tool, idx) => (
                  <span
                    key={`${tool}-${idx}`}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: '#eceae2',
                      color: '#29342d',
                      fontWeight: 500,
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Metrics Callout */}
          {caseStudy?.metrics && (
            <div
              style={{
                backgroundColor: '#edf4f0',
                borderLeft: '4px solid #355d48',
                borderRadius: '0 8px 8px 0',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#355d48', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                Measurable Impact & Outcomes
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#203b2e' }}>
                {caseStudy.metrics}
              </div>
            </div>
          )}

          {/* The Problem Section */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#203b2e', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🎯</span> The Problem & Context
            </h3>
            <p style={{ margin: 0, color: '#3d4841', whiteSpace: 'pre-line' }}>
              {caseStudy?.problem || project.description || 'No problem statement documented yet.'}
            </p>
          </div>

          {/* Solution & Architecture Section */}
          {(caseStudy?.solution || caseStudy?.architecture) && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#203b2e', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⚙️</span> Technical Architecture & Solution
              </h3>
              {caseStudy?.solution && (
                <p style={{ margin: '0 0 0.75rem 0', color: '#3d4841', whiteSpace: 'pre-line' }}>
                  {caseStudy.solution}
                </p>
              )}
              {caseStudy?.architecture && (
                <div
                  style={{
                    backgroundColor: '#f3f1e9',
                    borderRadius: '8px',
                    padding: '0.9rem 1.1rem',
                    fontSize: '0.88rem',
                    fontFamily: 'monospace, sans-serif',
                    color: '#29342d',
                    whiteSpace: 'pre-line',
                    border: '1px solid #e2ded4',
                  }}
                >
                  {caseStudy.architecture}
                </div>
              )}
            </div>
          )}

          {/* Key Takeaways Section */}
          {caseStudy?.takeaways && caseStudy.takeaways.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#203b2e', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>💡</span> Key Takeaways & Lessons Learned
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3d4841', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {caseStudy.takeaways.map((takeaway, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderTop: '1px solid #e7e5dc',
            background: '#faf8f2',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {liveDemoUrl && (
              <a
                href={liveDemoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#355d48',
                  color: '#fffefa',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>Live Demo</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}

            {sourceCodeUrl && (
              <a
                href={sourceCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#eceae2',
                  color: '#29342d',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  textDecoration: 'none',
                  border: '1px solid #d9d6cb',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>Source Code</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#5b6b61',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
