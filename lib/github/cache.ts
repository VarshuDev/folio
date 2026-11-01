export interface GitHubRepoIdentifier {
  owner: string;
  repo: string;
  slug: string;
}

export interface GitHubRepoStats {
  owner: string;
  repo: string;
  fullName: string;
  stars: number;
  forks: number;
  language: string;
  description: string;
  updatedAt: string;
  pushedAt: string;
  openIssues: number;
  htmlUrl: string;
  isCached?: boolean;
  fetchedAt: number;
}

export interface CacheEntry {
  stats: GitHubRepoStats;
  expiresAt: number;
}

export function normalizeGitHubRepo(input: string | undefined | null): GitHubRepoIdentifier | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern matches:
  // - https://github.com/owner/repo
  // - github.com/owner/repo
  // - owner/repo
  // - https://github.com/owner/repo/tree/main/...
  // - git@github.com:owner/repo.git
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/;
  const sshPattern = /git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/;
  const slugPattern = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

  let match = trimmed.match(urlPattern) || trimmed.match(sshPattern) || trimmed.match(slugPattern);
  if (!match) return null;

  let owner = match[1];
  let repo = match[2];

  if (!owner || !repo) return null;

  // Clean trailing .git and slashes
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }
  repo = repo.replace(/\/+$/, '');

  // Sanity check length and chars
  if (owner.length > 100 || repo.length > 100) return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) return null;

  return {
    owner,
    repo,
    slug: `${owner}/${repo}`.toLowerCase(),
  };
}

export class GitHubStatsCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 30 * 60 * 1000; // 30 minutes
    this.maxEntries = options?.maxEntries ?? 500;
  }

  get(slug: string): GitHubRepoStats | null {
    const key = slug.toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      ...entry.stats,
      isCached: true,
    };
  }

  getRaw(slug: string): CacheEntry | null {
    return this.cache.get(slug.toLowerCase()) || null;
  }

  set(slug: string, stats: GitHubRepoStats, ttlMs?: number): void {
    const key = slug.toLowerCase();
    const ttl = ttlMs ?? this.defaultTtlMs;

    // Prune if over max capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      stats,
      expiresAt: Date.now() + ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global in-memory cache singleton
let globalCache: GitHubStatsCache | null = null;

export function getGitHubStatsCache(): GitHubStatsCache {
  if (!globalCache) {
    globalCache = new GitHubStatsCache();
  }
  return globalCache;
}

export interface FetchGitHubRepoOptions {
  cache?: GitHubStatsCache;
  fetchFn?: typeof fetch;
  githubToken?: string;
  ttlMs?: number;
}

export async function fetchGitHubRepoStats(
  input: string,
  options?: FetchGitHubRepoOptions
): Promise<{ ok: true; stats: GitHubRepoStats } | { ok: false; error: string; status?: number; fallback?: Partial<GitHubRepoStats> }> {
  const parsed = normalizeGitHubRepo(input);
  if (!parsed) {
    return { ok: false, error: 'invalid_repository_url' };
  }

  const { owner, repo, slug } = parsed;
  const cache = options?.cache ?? getGitHubStatsCache();

  // 1. Check in-memory cache
  const cached = cache.get(slug);
  if (cached) {
    return { ok: true, stats: cached };
  }

  // 2. Fetch from GitHub API
  const fetcher = options?.fetchFn ?? fetch;
  const token = options?.githubToken ?? process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Folio-Portfolio-Studio',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetcher(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });

    if (response.status === 200) {
      const data = await response.json();
      const stats: GitHubRepoStats = {
        owner: data.owner?.login || owner,
        repo: data.name || repo,
        fullName: data.full_name || `${owner}/${repo}`,
        stars: Number(data.stargazers_count ?? 0),
        forks: Number(data.forks_count ?? 0),
        language: data.language || '',
        description: data.description || '',
        updatedAt: data.updated_at || '',
        pushedAt: data.pushed_at || '',
        openIssues: Number(data.open_issues_count ?? 0),
        htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
        isCached: false,
        fetchedAt: Date.now(),
      };

      cache.set(slug, stats, options?.ttlMs);
      return { ok: true, stats };
    }

    if (response.status === 404) {
      return {
        ok: false,
        error: 'repository_not_found',
        status: 404,
        fallback: { owner, repo, fullName: `${owner}/${repo}`, htmlUrl: `https://github.com/${owner}/${repo}` },
      };
    }

    if (response.status === 403) {
      // Check for rate limit
      const stale = cache.getRaw(slug);
      if (stale) {
        return {
          ok: true,
          stats: {
            ...stale.stats,
            isCached: true,
          },
        };
      }
      return {
        ok: false,
        error: 'rate_limit_exceeded',
        status: 403,
        fallback: { owner, repo, fullName: `${owner}/${repo}`, htmlUrl: `https://github.com/${owner}/${repo}` },
      };
    }

    return {
      ok: false,
      error: `github_api_error_${response.status}`,
      status: response.status,
      fallback: { owner, repo, fullName: `${owner}/${repo}` },
    };
  } catch (err: unknown) {
    // If network error, try serving stale cache if available
    const stale = cache.getRaw(slug);
    if (stale) {
      return {
        ok: true,
        stats: {
          ...stale.stats,
          isCached: true,
        },
      };
    }

    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
      fallback: { owner, repo, fullName: `${owner}/${repo}` },
    };
  }
}

export function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'recently';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Shell: '#89e051',
  Solidity: '#AA6746',
  Svelte: '#ff3e00',
};

export function getLanguageColor(language: string | undefined): string {
  if (!language) return '#94a3b8';
  return GITHUB_LANGUAGE_COLORS[language] || '#94a3b8';
}
