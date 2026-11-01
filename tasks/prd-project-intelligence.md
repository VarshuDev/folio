# PRD: Project Intelligence — Live GitHub Sync & Case-Study Drawer

## 1. Introduction

Folio creators showcase their best technical work through projects. Currently, project cards in both Simple and Advanced templates display only a static title, description, tools list, and outbound link. Technical recruiters, collaborators, and engineering hiring managers evaluate projects on two critical dimensions:
1. **Active Proof-of-Work**: Is this repository active, starred, maintained, and written in a real codebase?
2. **Engineering Depth**: What specific problem did the creator solve, what was the technical architecture, what engineering trade-offs were made, and what were the outcomes/takeaways?

This feature introduces **Project Intelligence**:
- **GitHub Live Sync**: Automatic fetching and in-memory TTL-cached repository metadata (stars, forks, primary language, commit/update freshness) displayed as elegant, organic badges on project cards.
- **Case-Study Drawer**: An accessible, interactive slide-over drawer modal allowing creators to document the Problem Statement, Solution & Architecture, Key Takeaways, and Quantitative Impact Metrics for each project.

---

## 2. Goals

- **Automated Repository Intelligence**: Instantly parse GitHub repository URLs from project links or dedicated repo fields, fetch live stats with zero-config in-memory caching and rate-limit fallbacks.
- **Interactive Technical Depth**: Give viewers a high-fidelity slide-over drawer that surfaces architectural decisions, problems solved, and measurable impact without navigating away from the portfolio.
- **Creator Customization**: Allow creators to toggle GitHub live sync per project and author rich case-study notes directly inside Step 4 ("Projects & practice") of the Folio Builder.
- **Universal Template Harmony**: Seamlessly render across both Simple portfolio mode and Advanced portfolio mode across all 22 theme styles without visual breakage.
- **Backward Compatibility & Resilience**: Ensure 100% backward compatibility for all existing drafts, zero external database requirement, and complete immunity to GitHub rate limits.

---

## 3. User Stories

### US-001: Project Schema Extensions for GitHub Stats and Case Studies
**Description:** As a developer, I need `ProjectSchema` in `lib/profile-schema.ts` extended with backwards-compatible optional fields for GitHub metadata and case-study details so that all existing profiles continue to parse safely.

**Acceptance Criteria:**
- [ ] Extend `ProjectSchema` with optional `githubUrl`, `githubStats` (`stars`, `forks`, `language`, `updatedAt`, `openIssues`), and `caseStudy` (`problem`, `solution`, `architecture`, `takeaways`, `metrics`, `liveDemoUrl`) with safe defaults.
- [ ] Export `ProjectCaseStudy` and `ProjectGithubStats` TypeScript types.
- [ ] `createEmptyProfile` and all existing profile fixture tests continue to parse without errors.
- [ ] Typecheck passes.
- [ ] Tests pass.

---

### US-002: In-Memory GitHub Repository Stats Service & API Route
**Description:** As a user or viewer, I want the portfolio to fetch repository metrics from GitHub via a server-side cached endpoint so that rate limits are respected and GitHub tokens are not exposed to the client.

**Acceptance Criteria:**
- [ ] Create `lib/github/cache.ts` providing an in-memory TTL cache (e.g. 30-minute expiration) with URL normalization for `github.com/:owner/:repo`.
- [ ] Create API route `GET /api/portfolio/github-stats?repo=owner/repo` returning `{ stars, forks, language, updatedAt, openIssues }` or cached snapshot.
- [ ] Provide graceful fallback when GitHub API is rate-limited, offline, or returns 404 (return fallback object without throwing 500).
- [ ] Typecheck passes.
- [ ] Tests pass.

---

### US-003: GitHub Live Metrics Badges on Project Cards
**Description:** As a portfolio visitor, I want to see GitHub stars, primary language, and update freshness on project cards so that I can quickly gauge project activity.

**Acceptance Criteria:**
- [ ] Render a compact GitHub badge bar on project cards in both `core-portfolio.tsx` and `portfolio-renderer.tsx` when repository info is available.
- [ ] Badges display star count (with star icon), forks count, primary language with color dot, and freshness label (e.g., "Updated 2w ago").
- [ ] Badges match the calm, organic Folio design system and adapt to active theme palette.
- [ ] Clicking the GitHub badge links directly to the repository in a new secure tab (`rel="noopener noreferrer"`).
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Verify in browser using dev-browser skill.

---

### US-004: Interactive Case-Study Slide-Over Drawer Component
**Description:** As a recruiter or hiring manager, I want to click "View Case Study" or the project card to open an interactive slide-over drawer detailing problem, architecture, takeaways, and metrics.

**Acceptance Criteria:**
- [ ] Implement `components/case-study-drawer.tsx` with slide-over animation, keyboard navigation (`Escape` to close), and backdrop blur.
- [ ] Drawer displays project title, tools badges, problem statement, solution & architecture overview, key takeaways bullet list, and metrics highlight.
- [ ] Include action buttons: "Visit Live Demo" and "View Source Code" (if URLs are present).
- [ ] Accessible ARIA attributes (`role="dialog"`, `aria-modal="true"`, focus trap or focus restoration).
- [ ] Seamless integration into `core-portfolio.tsx` and `portfolio-renderer.tsx`.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Verify in browser using dev-browser skill.

---

### US-005: Builder Project Intelligence Controls in Step 4
**Description:** As a creator using the Folio Builder, I want to edit case-study sections and toggle GitHub live sync for each project so that I can present rich technical stories.

**Acceptance Criteria:**
- [ ] In `components/builder.tsx` Step 4 ("Projects & practice"), add an expandable "Technical Case Study & GitHub Sync" panel for each project.
- [ ] Inputs for `githubUrl` (with auto-detect helper from project link), `problem`, `solution`, `architecture`, `metrics`, and multi-item `takeaways`.
- [ ] Instant preview button to open and review the Case-Study Drawer directly within the builder interface.
- [ ] Changes persist to the active draft and local storage immediately.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Verify in browser using dev-browser skill.

---

### US-006: Comprehensive Automated Test Suite
**Description:** As an engineer, I need automated tests verifying schema parsing, cache eviction/freshness, API error handling, and component rendering so that regressions are prevented.

**Acceptance Criteria:**
- [ ] Unit tests for `ProjectSchema` and `ProjectCaseStudySchema` parsing and backward compatibility in `tests/projects/case-study.test.ts`.
- [ ] Unit tests for GitHub cache normalization, rate-limit fallback, and API endpoint behavior in `tests/github/github-sync.test.ts`.
- [ ] All test suites (`npm test`) pass completely.
- [ ] TypeScript typecheck (`npm run typecheck`) passes with 0 errors.
- [ ] Production build (`npm run build`) passes cleanly.

---

## 4. Functional Requirements

- **FR-1**: The system must extend the project model to optionally capture GitHub repository URLs and rich case-study fields without breaking existing drafts.
- **FR-2**: When a project URL points to `https://github.com/:owner/:repo` or has `githubUrl` populated, the system must allow fetching real-time repository stats.
- **FR-3**: The server must cache GitHub API responses in-memory with a configurable TTL (default: 30 minutes) to prevent hitting GitHub's unauthenticated IP rate limit (60 requests/hr).
- **FR-4**: If GitHub returns HTTP 403 (rate limited), HTTP 404 (repo private/not found), or network timeout, the system must return a graceful fallback status without degrading the portfolio experience.
- **FR-5**: The client project cards must render star count, fork count, primary language, and relative freshness timestamp when data is present.
- **FR-6**: Each project with case-study information must render a "Read Case Study" button that triggers a responsive slide-over drawer modal.
- **FR-7**: The case-study drawer must support keyboard escape, accessible backdrop closing, and scroll-locking while opened.
- **FR-8**: The builder Step 4 must provide an intuitive accordion to populate problem, architecture, takeaways, and metrics, along with GitHub sync settings.

---

## 5. Non-Goals (Out of Scope)

- No GitHub OAuth personal access tokens required for viewers or anonymous visitors.
- No repository writeback, issue creation, or commit creation on behalf of creators.
- No mandatory external database or Redis infrastructure (strictly in-memory TTL caching with zero external setup).
- No alteration of the 22 core portfolio CSS themes or template color schemes.

---

## 6. Design & Accessibility Considerations

- Follow Folio's calm, organic paper aesthetic (`#f4f3ee` base, `#29342d` dark slate typography, `#355d48` sage accents).
- Drawer uses right-side slide-over on desktop (`max-w-xl md:max-w-2xl`) and bottom-sheet or full-screen slide on mobile devices (`w-full`).
- Badges must have sufficient color contrast against card backgrounds in all 22 themes.
- Escape key listener, click-outside dismissal, and focus trapping for accessibility.

---

## 7. Technical Considerations

- **GitHub API Rate Limits**: GitHub allows 60 requests per hour per IP for unauthenticated requests. The in-memory cache deduplicates requests for identical repositories across visitors and stores results for 30 minutes.
- **Cache Eviction**: Automatic sliding expiration to ensure stale data is re-fetched periodically without memory leaks.
- **Client Hydration**: Fetch repository stats client-side or during initial render with `SWR` or standard React `useEffect`/`fetch` hook with loading and error boundaries.

---

## 8. Success Metrics

- 100% of existing profile tests and exports continue to pass without regression.
- Project cards with GitHub links surface live star and language badges within <200ms when cached.
- Creators can compose and preview an architectural case study in under 3 minutes.
- Zero extra setup or API key requirement for creators.

---

## 9. Open Questions & Future Enhancements

- Future support for GitLab and Bitbucket repository URL parsing.
- Future support for embedding Mermaid architecture diagrams inside the case-study drawer.
