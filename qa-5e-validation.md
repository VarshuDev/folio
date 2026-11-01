# Checkpoint 5E — validation report

**Scope:** Zine / Cut-and-paste, Documentary / Photo essay, Community / Local impact, and Product Case Study only. The existing `ProfileDocument`, `DesignConfig`, renderer contract, route structure, and single-page model remain in place. The A/B/C/D/D-no-project fixtures are unchanged. No new routes, publishing, authentication, AI, analytics, or unrelated redesign work was added.

## Implementation summary

- Added four isolated renderer compositions in `components/portfolio-renderer.tsx`. They consume only existing profile/project fields, follow `sectionOrder`, omit hidden sections, retain Projects when visible but empty, and keep real project/contact links safe and explicit.
- Added scoped 5E CSS in `app/template-integration.css`; no 5A–5D style rules were changed. Zine and Documentary use labeled abstract CSS ornament, not photos or screenshots. Community stays text-led. Case Study features the first supplied project and renders the full project record at the configured Projects position; no case-study stages or metrics are fabricated.
- Added a focused four-style comparison mode to `/template-demos`, with the existing desktop/mobile viewport selector and grayscale toggle. The all-style gallery and earlier comparison modes remain available.
- Updated the four 5E catalogue descriptions and closest-style audit metadata.
- Added pinned, development-only `playwright` and `axe-core` dependencies so the separate 5E browser/Axe harness can be rerun after `npm ci`.

## Structural distinction and closest-style audit

| 5E style | Closest existing style | Structural differences | Visible differences | Result |
|---|---|---:|---:|---|
| Zine | Pinboard / visual | 5/6 | 4/4 | Distinct |
| Documentary | White-cube / gallery | 5/6 | 4/4 | Distinct |
| Community | Project-focused | 6/6 | 4/4 | Distinct |
| Product Case Study | Project-focused | 6/6 | 4/4 | Distinct |

- **Zine vs Pinboard:** Zine is a sequential ruled page with one-column project entries; art and copy sit in separate, stable slots. Pinboard keeps its board/grid and pinned tiles. The 5E collage marks are restrained, isolated from copy and links, and rotations are removed on mobile.
- **Documentary vs Gallery:** Documentary uses an indexed contents rail, numbered linear sections, and desktop side-by-side frame/caption story pairs that stack on mobile. Gallery retains its open exhibition treatment, horizontal index, full-width art panels, and offset artwork. The documentary panels are labeled **ABSTRACT DECORATION**.
- **Community vs Project-focused:** Community is name-first and routes the supplied highlights/activities into explicitly labeled contribution rows. Projects are text-only and linear; there are no impact numbers, testimonials, assumed roles, or people. Project-focused retains its project-led work treatment and decorative project art.
- **Product Case Study vs Project-focused:** The first supplied project title leads the page; the configured Projects section remains in its saved position as a single-column project record/supporting-work list. It does not use Project-focused’s featured-art-plus-archive composition. The available title, description, tools, and link are the only project details shown.

These are renderer/catalog audit counts, not a claim of a user study. The grayscale comparison contact sheet is included below to make the structural differences reviewable without relying on palette.

## Validation results

- `npm ci` — **passed**; 0 reported vulnerabilities.
- `npm run typecheck` — **passed**.
- `npm run build` — **passed**; only `/` and the existing `/template-demos` route were generated.
- `node qa-5e-matrix.cjs` — **40/40 base render cases passed**: four styles × A/B/C/D/D-no-project × 1440×900 and 390×844.
- Browser errors — **0**.
- Horizontal overflow — **0/40**; clipped text nodes — **0/40**.
- Axe WCAG 2.1 A/AA on rich fixture C — **0 violations for all four styles**.
- Additional passing checks: real project/contact links and safe new-tab attributes (4 styles); hidden Projects removes its section, navigation, featured lead, and project shortcut (4); reversed section order stays aligned with navigation (4); keyboard focus, reduced motion, and minimum 44px links (4); empty/missing-data cases including honest visible-empty Projects (8); 5E comparison ordering and desktop/mobile toggles; grayscale comparison; and closest-style collision metadata (4).
- Long fixture D content remains present and wraps without horizontal overflow; D-no-project omits absent education/contact/highlights/skills. No project `<img>`, `<iframe>`, or `<video>` is emitted by these 5E renderers.

## QA artifacts

- `qa-5e-matrix.cjs` — standalone Playwright/Axe matrix harness.
- `qa-5e-browser-matrix.json` — full case-by-case metrics, link/visibility/order/focus checks, collision results, and Axe output.
- `qa-5e-zine-desktop.png`, `qa-5e-zine-mobile.png`
- `qa-5e-documentary-desktop.png`, `qa-5e-documentary-mobile.png`
- `qa-5e-community-desktop.png`, `qa-5e-community-mobile.png`
- `qa-5e-case-study-desktop.png`, `qa-5e-case-study-mobile.png`
- `qa-5e-grayscale-comparison-desktop.png` — four-style grayscale contact sheet.
- `qa-5e-grayscale-compare-panel-desktop.png`, `qa-5e-grayscale-compare-panel-mobile.png` — focused comparison-mode captures.

## Remaining subjective review

1. Zine and Pinboard intentionally share paper as a material cue. Their section/project structure differs substantially, but the paper vocabulary remains the closest visual association.
2. Documentary’s labeled abstract geometry is not photography, but some shapes may still read as architectural or landscape-like at a glance. If that ambiguity is undesirable, the safest next review choice is to reduce or remove those decorative panels rather than imply missing photos.
3. The Case Study lead repeats the featured project title at the configured Projects record. The record keeps its description/tools/link at the saved section position; the repeated title reinforces the feature but is a small redundancy.
4. With no process fields in the schema, Product Case Study necessarily reads as a project-first brief rather than a multi-stage process case study. This is intentional content restraint, not missing fabricated sections.

**Preservation note:** Existing 5A–5D renderers, styles, fixtures, archived QA captures/reports, and 5D matrix files were left untouched. The preview server is running for review on port 3000.
