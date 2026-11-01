'use client';

import React, { createContext, useContext, useState } from 'react';
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

export function CaseStudyProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const openCaseStudy = (project: Project) => {
    setActiveProject(project);
  };

  const closeCaseStudy = () => {
    setActiveProject(null);
  };

  return (
    <CaseStudyContext.Provider value={{ openCaseStudy, closeCaseStudy, activeProject }}>
      {children}
      <CaseStudyDrawer
        project={activeProject}
        isOpen={Boolean(activeProject)}
        onClose={closeCaseStudy}
      />
    </CaseStudyContext.Provider>
  );
}
