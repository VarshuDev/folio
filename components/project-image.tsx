'use client';

import React, { useState, useEffect } from 'react';
import type { Project } from '@/lib/profile-schema';
import { safeExternalUrl } from '@/lib/profile-schema';

interface ProjectImageProps {
  project: Project;
  className?: string;
  fallbackArt?: React.ReactNode;
  aspectRatio?: string;
  style?: React.CSSProperties;
}

export function ProjectImage({
  project,
  className = '',
  fallbackArt,
  aspectRatio = '16 / 10',
  style,
}: ProjectImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const imageUrl = safeExternalUrl(project.imageUrl);

  // Close on Escape key
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  if (!imageUrl || imageError) {
    return fallbackArt ? <>{fallbackArt}</> : null;
  }

  const altText = project.imageAlt || project.title ? `${project.title} screenshot` : 'Project screenshot';

  return (
    <>
      <div
        className={`project-image-wrapper ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          overflow: 'hidden',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          cursor: 'zoom-in',
          ...style,
        }}
        onClick={() => setIsLightboxOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Enlarge screenshot for ${project.title || 'project'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsLightboxOpen(true);
          }
        }}
      >
        <img
          src={imageUrl}
          alt={altText}
          loading="lazy"
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            transition: 'transform 0.25s ease',
            display: 'block',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.025)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />
        <div
          className="project-image-zoom-hint"
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: 'rgba(20, 24, 22, 0.72)',
            color: '#fff',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '0.7rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
            backdropFilter: 'blur(2px)',
          }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span>Zoom</span>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${project.title || 'Project'} screenshot enlarged`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(15, 20, 18, 0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLightboxOpen(false);
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close screenshot preview"
            style={{
              position: 'absolute',
              top: '1.25rem',
              right: '1.25rem',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            ✕
          </button>

          {/* Lightbox Image Container */}
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <img
              src={imageUrl}
              alt={altText}
              style={{
                maxWidth: '100%',
                maxHeight: '76vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              }}
            />
            {project.title && (
              <div
                style={{
                  marginTop: '0.85rem',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  maxWidth: '600px',
                }}
              >
                <span>{project.title}</span>
                {project.tools && (
                  <span style={{ opacity: 0.65, fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    ({project.tools})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
