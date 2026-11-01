# Checkpoint 5C — implementation and validation

## Scope delivered

Implemented only the five requested single-page styles in the existing renderer and data model: Newsprint / field notes, Neo-brutalist / direct, Botanical / organic, White-cube / gallery, and Notebook / terminal. `ProfileDocument`, `DesignConfig`, section visibility/order, editable content, external-link handling, and local drafts remain on the existing path. There are no new routes or persistence/auth/AI features. The landing page and the other 17 styles were not redesigned. `/template-demos` received only a Checkpoint 5C comparison mode and related QA copy.

## Structural differences

| Style | Implemented structure | Closest comparison | Audit |
|---|---|---|---:|
| Newsprint | Ruled masthead; 12-column article layout; desktop two-column context text; two-column article/project area; one reading column on mobile | Retro / print-inspired | 6/6 structural, 4/4 visible |
| Neo-brutalist | Bold dark identity block; deliberately offset slabs of differing widths; direct slash-separated text links; projects as hard-edged factual blocks | Swiss grid / studio | 5/6 structural, 4/4 visible |
| Botanical | Vertical field-journal flow; contained decorative SVG branch; unboxed project entries and soft dotted separators | Editorial | 6/6 structural, 4/4 visible |
| White-cube / gallery | Spacious white canvas; large abstract project panel before title and factual caption; supporting sections in open bands | Editorial | 6/6 structural, 4/4 visible |
| Notebook / terminal | Pale ruled-paper page and margin line; ordinary sans-serif prose/headings; monospace reserved for small index/metadata labels | Gaming / arcade | 6/6 structural, 4/4 visible |

All five meet the catalog audit threshold (at least 4/6 structural and 3/4 visible differences). Color was removed in the 5C comparison screenshot; the layout differences remain visible. Decorative project art is CSS geometry, and the botanical motif is a small aria-hidden SVG. No profile image, portrait, screenshot, caption fact, date, issue number, byline, command, log, or metric is fabricated.

## Validation results

- `npm run typecheck` — passed.
- `npm run build` — passed; `/` and `/template-demos` prerender successfully.
- Playwright matrix: **50/50** render cases passed: five styles × fixtures A, B, C, D, and D-no-project × 1440×900 desktop and 390×844 mobile.
- Per-style checks: Projects hidden with no navigation shortcut (5/5); reversed section order and matching anchor targets (5/5); safe project/contact links (5/5); keyboard-visible focus, reduced-motion preference, and measured 44px link targets (5/5); long text and missing-image behavior (5/5); no-project omission behavior (5/5); structural collision-pair audit (5/5).
- No browser console errors, page errors, or failed requests were recorded. No project `<img>` elements or horizontal overflow were found in the tested render roots.
- Newsprint’s article text measured two columns on desktop and one on mobile. Notebook prose remained proportional sans-serif on ruled light paper; its rendered content contains no code/terminal blocks.

Full machine-readable details are in `qa-5c-browser-matrix.json`; the repeatable browser test is `qa-5c-matrix.cjs`.

## Collision notes for review

The nearest shared conventions remain worth a human look: Newsprint and Retro both use print/serif cues; Botanical and Editorial both support long-form reading; White-cube and Editorial both use abstract art panels; Neo-brutalist and Swiss both use strong rules; Notebook and Arcade both use technical labels. Their tested structures differ (article columns vs print cover, vertical journal vs contents-rail stories, visual-first whitespace vs text-led editorial, offset slabs vs strict alignment, and ruled light paper vs framed dark cabinet). The art panels are intentionally abstract until the profile schema supports real images, so Gallery and Editorial will share that broad visual vocabulary by necessity.

## QA artifacts

- `qa-5c-grayscale-comparison-desktop.png` — side-by-side grayscale comparison of the five new styles.
- `qa-5c-{newsprint,brutalist,botanical,gallery,terminal}-{desktop,mobile}.png` — full-content fixture C screenshots captured under the 1440×900 desktop and 390×844 mobile viewport conditions.
- `qa-5c-browser-matrix.json` — render and behavior matrix, link/focus/reduced-motion/overflow metrics, collision checks, and artifact names.
