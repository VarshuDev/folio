# 🧪 Folio Quality Assurance (QA) &amp; Browser Regression Suite

This directory consolidates all standalone browser automation harnesses, Playwright matrix runners, accessibility audit suites, and historical checkpoint validation reports for Folio.

---

## 📁 Manifest &amp; Architecture

### 1. Test Matrix Runners (`*.cjs`)
Standalone CommonJS harnesses powered by Playwright and axe-core:
- `qa-5c-matrix.cjs` &mdash; Style matrix harness for Checkpoint 5C (newsprint, brutalist, botanical, gallery, terminal).
- `qa-5d-matrix.cjs` &mdash; Style matrix harness for Checkpoint 5D (blueprint, bauhaus, y2k, pastel, academic).
- `qa-5e-matrix.cjs` &mdash; Style matrix harness for Checkpoint 5E (zine, documentary, community, case-study).
- `qa-6-regression.cjs` &mdash; Cross-browser regression runner across all 22 art directions.
- `qa-7a-all-style-accessibility.cjs` &mdash; Automated WCAG AA/AAA compliance audit using `axe-core`.
- `qa-7a-regression.cjs` &amp; `qa-7b-regression.cjs` &mdash; Layout shifts, sticky rail synchronization, and reduced-motion validations.
- `qa-8b-regression.cjs` to `qa-8j-regression.cjs` &mdash; Telemetry salt lifecycle, export bundler CRC-32 integrity, and Vercel REST payload verifications.

### 2. Browser Verification Matrix Reports (`*.json`)
Machine-readable audit results with per-viewport metrics (desktop 1440 × 900 and mobile 390 × 844):
- `qa-5b-browser-matrix.json` to `qa-5e-browser-matrix.json`
- `qa-6-browser-regression.json`
- `qa-7a-browser-regression.json` &amp; `qa-7a-style-accessibility.json`
- `qa-7b-browser-regression.json`
- `qa-8b-browser-regression.json`, `qa-8d-browser-regression.json`, `qa-8g-results.json`, `qa-8h-results.json`

### 3. Checkpoint Validation Specifications (`*.md`)
Architectural sign-off and milestone verification reports:
- `qa-5b-validation.md` &mdash; Visual fidelity and contrast validation for themes 5–8.
- `qa-5c-validation.md` &mdash; Validation report for themes 9–13.
- `qa-5d-validation.md` &mdash; CAD and constructivist validation report for themes 14–18.
- `qa-5e-validation.md` &mdash; Narrative and editorial validation report for themes 19–22.
- `qa-6-validation.md` &mdash; Comprehensive 22-theme browser regression matrix sign-off.
- `qa-7a-validation.md` &mdash; WCAG AA/AAA contrast and keyboard accessibility sign-off.
- `qa-7b-validation.md` &mdash; Mobile responsive layout, sticky rails, and touch targets sign-off.

### 4. Interactive Reference Prototypes (`prototypes/`)
- `prototypes/prototype-v0.html` &mdash; Zero-dependency standalone HTML single-file compilation reference.
- `prototypes/template-demos-preview.html` &mdash; Interactive offline theme showcase and demo switcher.
