'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Project } from '@/lib/profile-schema';
import { CaseStudyDrawer } from './case-study-drawer';

interface CaseStudyContextType {
  openCaseStudy: (project: Project) => void;
  closeCaseStudy: () => void;
  activeProject: Project | null;
}

const CaseStudyContext = createContext<CaseStudyContextType>({
  openCaseStudy: () => {},
  closeCaseStudy: () => {},
  activeProject: null,
});

export function useCaseStudy() {
  return useContext(CaseStudyContext);
}

interface CaseStudyProviderProps {
  children: React.ReactNode;
  projects?: Project[];
}

export function CaseStudyProvider({ children, projects = [] }: CaseStudyProviderProps) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const openCaseStudy = useCallback((project: Project) => {
    setActiveProject(project);
    if (typeof window !== 'undefined' && project.id) {
      window.history.replaceState(null, '', `#study-${project.id}`);
    }
  }, []);

  const closeCaseStudy = useCallback(() => {
    setActiveProject(null);
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#study-')) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  // Deep-linking: check URL hash or query param on initial load & popstate
  useEffect(() => {
    if (typeof window === 'undefined' || !projects.length) return;

    const checkDeepLink = () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const studyParam = params.get('case-study') || params.get('project');

      let targetId: string | null = null;
      if (hash.startsWith('#study-')) {
        targetId = hash.replace('#study-', '');
      } else if (hash.startsWith('#project-')) {
        targetId = hash.replace('#project-', '');
      } else if (studyParam) {
        targetId = studyParam;
      }

      if (targetId) {
        const matched = projects.find((p) => p.id === targetId || p.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') === targetId);
        if (matched) {
          setActiveProject(matched);
        }
      }
    };

    checkDeepLink();
    window.addEventListener('popstate', checkDeepLink);
    return () => window.removeEventListener('popstate', checkDeepLink);
  }, [projects]);

  // Find index of active project for next/prev navigation
  const currentIndex = activeProject ? projects.findIndex((p) => p.id === activeProject.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < projects.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      openCaseStudy(projects[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, projects, openCaseStudy]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      openCaseStudy(projects[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, projects, openCaseStudy]);

  return (
    <CaseStudyContext.Provider value={{ openCaseStudy, closeCaseStudy, activeProject }}>
      {children}
      <CaseStudyDrawer
        project={activeProject}
        isOpen={Boolean(activeProject)}
        onClose={closeCaseStudy}
        onPrevProject={hasPrev ? handlePrev : undefined}
        onNextProject={hasNext ? handleNext : undefined}
        hasPrevProject={hasPrev}
        hasNextProject={hasNext}
      />
    </CaseStudyContext.Provider>
  );
}
