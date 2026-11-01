# Checkpoint 5B validation

**Status:** ready for review. Scope stayed on Retro, Pinboard, Gaming/Arcade, Gen Z Dark/After Hours, and Swiss grid/studio. Minimal, Editorial, Project-focused, the other 14 styles, and the landing page were not redesigned.

## Build and browser matrix

- `npm run build` — passed (Next.js production build, TypeScript, static generation).
- Playwright production-preview matrix — **50/50 passed** across the five styles, fixtures A, B, C, D, and D no-projects, at **1440×900** and **390×844**.
- **10/10 hidden-Projects checks** — the section and its navigation shortcut are both absent.
- **10/10 reversed-order checks** — rendered sections and navigation follow the reversed `DesignConfig.sectionOrder` exactly.
- **20 same-page navigation clicks** passed, including mobile.
- Project-link counts matched the fixtures (C has one supplied project URL; A, B, D, and D no-projects have none). Any `_blank` links had safe `noopener noreferrer` attributes; no malformed protocols were found.
- All fixtures kept the expected section visibility and order; empty/no-projects fixtures did not invent a project section or filler. D’s long name, role, paragraph, title, and description were checked without horizontal overflow.
- No horizontal overflow was detected in the rendered portfolio, preview frame, or document. Decorative CSS art contains no `<img>` elements.
- One semantic `h1`, labelled section headings, and 44px+ portfolio links passed the browser assertions. Keyboard-visible focus and reduced-motion behavior passed for all five styles; no browser console/page errors were recorded.

The hidden-Projects and reversed-order checkboxes on `/template-demos` are QA-only controls. They pass `visibleSections` and `sectionOrder` through the existing `DesignConfig`; they do not add content or alter saved profile data.

## Review evidence

Focused C-fixture screenshots at the requested sizes:

- `qa-5b-retro-desktop.png`, `qa-5b-retro-mobile.png`
- `qa-5b-pinboard-desktop.png`, `qa-5b-pinboard-mobile.png`
- `qa-5b-arcade-desktop.png`, `qa-5b-arcade-mobile.png`
- `qa-5b-after-hours-desktop.png`, `qa-5b-after-hours-mobile.png`
- `qa-5b-swiss-desktop.png`, `qa-5b-swiss-mobile.png`
- `qa-5b-comparison-grayscale-desktop.png` — shared-fixture five-style comparison with grayscale enabled

Machine-readable matrix: `qa-5b-browser-matrix.json`.

Live review: `/template-demos` → **Compare the 5 Checkpoint 5B styles** or **Focus one style**. Fixtures A/B/C/D and D no-projects remain available.
