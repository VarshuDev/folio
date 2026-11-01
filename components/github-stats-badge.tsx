'use client';

import React, { useEffect, useState } from 'react';
import type { Project, ProjectGithubStats } from '@/lib/profile-schema';
import { normalizeGitHubRepo, formatRelativeTime, getLanguageColor } from '@/lib/github/cache';

interface GitHubStatsBadgeProps {
  project: Project;
  className?: string;
}

export function GitHubStatsBadge({ project, className = '' }: GitHubStatsBadgeProps) {
  const repoInfo = normalizeGitHubRepo(project.githubUrl || project.link);
  const [stats, setStats] = useState<ProjectGithubStats | null>(project.githubStats || null);
  const [loading, setLoading] = useState<boolean>(!project.githubStats && Boolean(repoInfo));

  useEffect(() => {
    if (!repoInfo) {
      setStats(null);
      setLoading(false);
      return;
    }

    // If stats are already provided on the project object, use them
    if (project.githubStats && (project.githubStats.stars > 0 || project.githubStats.language)) {
      setStats(project.githubStats);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function loadStats() {
      try {
        setLoading(true);
        const res = await fetch(`/api/portfolio/github-stats?repo=${encodeURIComponent(repoInfo!.slug)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (isMounted) setLoading(false);
          return;
        }
        const data = await res.json();
        if (isMounted && data.ok && data.stats) {
          setStats({
            stars: data.stats.stars,
            forks: data.stats.forks,
            language: data.stats.language,
            updatedAt: data.stats.updatedAt,
            openIssues: data.stats.openIssues,
          });
        }
      } catch {
        // Graceful silent fallback on network abort or error
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStats();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [repoInfo?.slug, project.githubStats]);

  if (!repoInfo) return null;

  const repoUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;

  if (loading && !stats) {
    return (
      <div
        className={`github-stats-badge github-stats-badge--loading ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.78rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          border: '1px solid rgba(120, 120, 120, 0.2)',
          background: 'rgba(0, 0, 0, 0.03)',
          color: '#666',
          marginTop: '0.4rem',
        }}
        aria-label="Loading repository stats"
      >
        <GitHubOctocatIcon size={13} />
        <span>github.com/{repoInfo.slug}</span>
      </div>
    );
  }

  if (!stats) {
    // If stats failed or repo is private, still render subtle repo chip
    return (
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`github-stats-badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.78rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          border: '1px solid rgba(120, 120, 120, 0.22)',
          background: 'rgba(0, 0, 0, 0.03)',
          color: 'inherit',
          textDecoration: 'none',
          marginTop: '0.4rem',
          transition: 'all 0.15s ease',
        }}
        title={`View ${repoInfo.slug} on GitHub`}
      >
        <GitHubOctocatIcon size={13} />
        <span>{repoInfo.slug}</span>
      </a>
    );
  }

  const langColor = getLanguageColor(stats.language);
  const freshness = formatRelativeTime(stats.updatedAt);

  return (
    <a
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`github-stats-badge ${className}`}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.55rem',
        fontSize: '0.76rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '9999px',
        border: '1px solid rgba(120, 120, 120, 0.22)',
        background: 'rgba(0, 0, 0, 0.025)',
        color: 'inherit',
        textDecoration: 'none',
        marginTop: '0.45rem',
        marginBottom: '0.25rem',
        width: 'fit-content',
        lineHeight: 1.2,
      }}
      title={`GitHub repository: ${repoInfo.slug}`}
      aria-label={`GitHub repo ${repoInfo.slug}: ${stats.stars} stars, ${stats.forks} forks, ${stats.language || 'Code'}`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
        <GitHubOctocatIcon size={13} />
        <span>{repoInfo.repo}</span>
      </span>

      {stats.language && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: 0.9 }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: langColor,
              display: 'inline-block',
            }}
            aria-hidden="true"
          />
          <span>{stats.language}</span>
        </span>
      )}

      {stats.stars > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: 0.85 }}>
          <StarIcon size={12} />
          <span>{stats.stars.toLocaleString()}</span>
        </span>
      )}

      {stats.forks > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', opacity: 0.85 }}>
          <ForkIcon size={12} />
          <span>{stats.forks.toLocaleString()}</span>
        </span>
      )}

      {freshness && (
        <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>
          {freshness}
        </span>
      )}
    </a>
  );
}

function GitHubOctocatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: 'middle', flexShrink: 0, color: '#eab308' }}
    >
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
    </svg>
  );
}

function ForkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h4.5A2.25 2.25 0 0 0 12.5 6.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zM12.5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zM8 11.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm-1.5.878v-1.628a2.25 2.25 0 1 1 1.5 0v1.628a2.25 2.25 0 1 1-1.5 0z" />
    </svg>
  );
}
