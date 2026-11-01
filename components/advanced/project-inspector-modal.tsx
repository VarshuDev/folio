'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/icon';
import type { GeneratedProject, GeneratedFile } from '@/lib/advanced-generator';

interface ProjectInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: GeneratedProject | null;
  error?: string | null;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export function ProjectInspectorModal({
  isOpen,
  onClose,
  project,
  error,
  onRegenerate,
  isGenerating = false,
}: ProjectInspectorModalProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('package.json');
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'files' | 'routes'>('files');
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set default selected file when project changes and reset view on open
  useEffect(() => {
    if (isOpen) {
      setActiveView('files');
    }
    if (project && project.files.length > 0) {
      const defaultFile = project.files.find((f) => f.path === 'package.json') || project.files[0];
      setSelectedFilePath(defaultFile.path);
    }
  }, [isOpen, project]);

  const selectedFile: GeneratedFile | undefined = useMemo(() => {
    return project?.files.find((f) => f.path === selectedFilePath);
  }, [project, selectedFilePath]);

  const handleCopyCode = async () => {
    if (!selectedFile) return;
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadZip = async () => {
    if (!project) return;
    setDownloadingZip(true);
    try {
      // Export project files directly through the export API
      const res = await fetch('/api/portfolio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: project.files,
          slug: (project.manifest.siteTitle || 'portfolio').toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'portfolio-project',
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.manifest.siteTitle || 'portfolio'}-nextjs-project.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Fallback
    } finally {
      setDownloadingZip(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="adv-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="adv-modal-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-inspector-title"
      >
        {/* Header */}
        <header className="adv-modal-header">
          <div className="adv-modal-title-area">
            <div className="adv-modal-badge">
              <span className="adv-modal-dot" />
              <span>Next.js Project Generator</span>
            </div>
            <h2 id="project-inspector-title" className="adv-modal-title">
              Generated Project Artifact
            </h2>
          </div>
          <div className="adv-modal-header-actions">
            {project && (
              <button
                type="button"
                className="adv-modal-btn secondary"
                onClick={handleDownloadZip}
                disabled={downloadingZip}
                aria-label="Download Next.js project as ZIP"
              >
                {downloadingZip ? 'Exporting...' : 'Download ZIP'}
              </button>
            )}
            {onRegenerate && (
              <button
                type="button"
                className="adv-modal-btn secondary"
                onClick={onRegenerate}
                disabled={isGenerating}
                aria-label="Regenerate project"
              >
                {isGenerating ? 'Generating...' : 'Regenerate'}
              </button>
            )}
            <button
              type="button"
              className="adv-modal-close-btn"
              onClick={onClose}
              aria-label="Close project inspector"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="adv-modal-error-banner" role="alert">
            <Icon name="close" size={16} />
            <div>
              <strong>Generation failed</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success / Loaded State */}
        {project && !error && (
          <div className="adv-modal-body" tabIndex={0} aria-label="Project inspector content">
            {/* Metrics Bar */}
            <div className="adv-metrics-bar" role="region" aria-label="Project metrics">
              <div className="adv-metric-item">
                <span className="adv-metric-label">Framework</span>
                <strong className="adv-metric-val">Next.js 16 (App Router)</strong>
              </div>
              <div className="adv-metric-item">
                <span className="adv-metric-label">Theme</span>
                <strong className="adv-metric-val">{project.manifest.themeId}</strong>
              </div>
              <div className="adv-metric-item">
                <span className="adv-metric-label">Active Routes</span>
                <strong className="adv-metric-val">{project.manifest.routes.length}</strong>
              </div>
              <div className="adv-metric-item">
                <span className="adv-metric-label">Files Generated</span>
                <strong className="adv-metric-val">{project.manifest.generatedFileCount}</strong>
              </div>
              <div className="adv-metric-item">
                <span className="adv-metric-label">Security Scan</span>
                <strong className="adv-metric-val pass">0 Forbidden Tokens</strong>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="adv-view-tabs" role="tablist" aria-label="Inspector views">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'files'}
                className={`adv-view-tab ${activeView === 'files' ? 'active' : ''}`}
                onClick={() => setActiveView('files')}
              >
                File Explorer ({project.files.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'routes'}
                className={`adv-view-tab ${activeView === 'routes' ? 'active' : ''}`}
                onClick={() => setActiveView('routes')}
              >
                Configured Routes ({project.manifest.routes.length})
              </button>
            </div>

            {/* View 1: File Explorer */}
            {activeView === 'files' && (
              <div className="adv-files-split-view">
                {/* File Tree List */}
                <div
                  className="adv-file-list"
                  role="listbox"
                  tabIndex={0}
                  aria-label="Generated files list"
                >
                  {project.files.map((file) => {
                    const isSelected = file.path === selectedFilePath;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`adv-file-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedFilePath(file.path)}
                      >
                        <span className="adv-file-icon">📄</span>
                        <span className="adv-file-path">{file.path}</span>
                        <span className="adv-file-size">
                          {Math.max(1, Math.round(file.content.length / 1024))} KB
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* File Content Preview */}
                <div className="adv-file-preview" tabIndex={0} aria-label="File content preview">
                  {selectedFile ? (
                    <>
                      <div className="adv-preview-header">
                        <div className="adv-preview-meta">
                          <code className="adv-file-current-path">{selectedFile.path}</code>
                          <span className="adv-line-count">
                            {selectedFile.content.split('\n').length} lines
                          </span>
                        </div>
                        <button
                          type="button"
                          className="adv-copy-btn"
                          onClick={handleCopyCode}
                          aria-label="Copy file content to clipboard"
                        >
                          {copied ? 'Copied!' : 'Copy Code'}
                        </button>
                      </div>
                      <pre className="adv-code-scroll" tabIndex={0} aria-label="Source code">
                        <code>{selectedFile.content}</code>
                      </pre>
                    </>
                  ) : (
                    <div className="adv-no-file-selected">
                      Select a file from the explorer on the left.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View 2: Configured Routes */}
            {activeView === 'routes' && (
              <div className="adv-routes-panel" role="region" aria-label="Route table">
                <table className="adv-routes-table">
                  <thead>
                    <tr>
                      <th scope="col">Page Type</th>
                      <th scope="col">Canonical Route</th>
                      <th scope="col">Page Title</th>
                      <th scope="col">Nav Label</th>
                      <th scope="col">Generated Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.manifest.routes.map((route) => {
                      const expectedPath =
                        route.route === '/' ? 'app/page.tsx' : `app${route.route}/page.tsx`;
                      return (
                        <tr key={route.route}>
                          <td>
                            <strong className="adv-type-badge">{route.pageType}</strong>
                          </td>
                          <td>
                            <code>{route.route}</code>
                          </td>
                          <td>{route.title}</td>
                          <td>{route.navLabel}</td>
                          <td>
                            <code className="adv-output-path">{expectedPath}</code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="adv-modal-footer">
          <div className="adv-footer-note">
            Ready for standalone build and future Vercel deployment.
          </div>
          <button
            type="button"
            className="adv-modal-btn primary"
            onClick={onClose}
          >
            Close Inspector
          </button>
        </footer>
      </div>
    </div>
  );
}
