# Folio — product differentiation plan

**Status:** UX and design proposal only. No application code has been changed for this phase.

**North star:** Someone with no web-building experience can share a few real details and get a credible portfolio draft that still sounds like them. The product organizes their information; it does not invent achievements or generate arbitrary application code.

**Scope guardrails:** Keep the current structured profile, component renderer, browser-local drafts, optional Supabase preparation, and unconnected Publish UI. Improve the experience around them rather than replacing working foundations. Do not add analytics, billing, a dashboard, or publishing in this phase.

## 1. Product UX critique

### What is already working

- The profile and design are separate structured data, so content can be reused across visual styles.
- The user gets a visible preview while editing, can reorder or hide sections, and can save a draft locally.
- Three featured styles plus an expandable 19-style browser is more manageable than presenting 22 choices at once.
- The Publish dialog is honest that public publishing is not connected.

### Where it currently feels like a builder rather than a portfolio-generation product

1. **The first interaction is a six-step form.** “Education,” “Skills,” “Projects,” and “Highlights & links” make the user decide what belongs in a portfolio before the product has helped them see what they have.
2. **It asks for polished writing too early.** A student may have rough notes, classwork, a club contribution, or a small experiment—but may not know how to turn those into a bio or project description.
3. **The user does the organizing.** They must decide whether a fact is a skill, interest, project, highlight, or education detail. That is precisely the work the product should reduce.
4. **Style choice still asks for a lot of taste-making.** The expandable collection helps, but 22 named directions can still feel like a design decision before the user understands their own content.
5. **The visual audit needs to test structure, not just theme.** The styles have separate art directions, but they need to be judged with identical real-world profile data to ensure their layouts, navigation, hero, project treatment, and section rhythm differ—not merely their colors.
6. **The builder UI needs its own hierarchy and accessible sizing.** The product should read like a friendly creative workspace. Its labels, controls, and typography should not inherit the mood of any generated portfolio, and small helper text should not be the primary way instructions are conveyed.
7. **AI assistance is a product promise, not an implementation yet.** There is no connected AI content assistant today. Any future assistant needs to produce reviewable profile suggestions, with sources and user approval—not quietly rewrite the saved profile.

## 2. Recommended onboarding flow

Keep the first version short and content-first. Offer a guided path and a paste-notes path; make resume import a clearly labeled future path until extraction is implemented.

### Stage A — “How would you like to start?”

- **A few quick questions** — recommended, default path.
- **Paste rough notes** — accept imperfect sentences, lists, or a short free-form description.
- **Use a resume** — show as “Planned” until PDF/DOCX extraction, consent, and data handling are implemented. Do not make a non-working upload control look live.

### Stage B — collect a small amount of raw material

Ask in everyday language, one prompt at a time or in a compact, calm set of prompt cards:

- “What are you currently learning?”
- “What have you built or tried—even something small?”
- “What are you proud of?”
- “What have you participated in or helped with?”
- “What links do you want people to find?”

Name is useful, but the rest should be skippable. Education can live under **Add a little more detail** rather than blocking progress. Give one realistic example and say that rough notes are fine; do not require a word count or polished bio.

### Stage C — “Here’s what I understood”

When a real AI service is configured, show a brief, truthful processing state, followed by a countable summary such as “I found 2 projects, 1 activity, and what you’re learning.” If the service is unavailable or uncertain, preserve the raw notes and offer the manual path—never simulate AI success.

### Stage D — review before generation

Present extracted information as editable cards grouped into familiar ideas: **A little about you**, **Things you tried**, **What you’re learning**, **Things you’re proud of**, and **Links**. Each proposed item should offer **Edit**, **Keep**, **Remove**, or **Move**. Where useful, show the short source excerpt that led to the suggestion. Flag uncertainty as “Please check this.” Nothing is applied silently.

### Stage E — choose a visual direction

Keep the current three recommended styles and the expandable full collection. Describe them by outcome (“calm and simple,” “story-led,” “projects up front”), not by design jargon. Show actual layout thumbnails. If AI or deterministic rules recommend a style, say why and let the user change it; do not claim a recommendation is personalized until it is.

### Stage F — generate, then edit

Generate the portfolio from the reviewed profile and selected template. Keep the live preview, section visibility/order, and direct field editing. Put writing help next to the field it changes: “Make this clearer,” “Shorten,” or “Give me another version.” Every suggested replacement remains editable and requires the user to apply it.

### Stage G — save

Continue browser-local saving and the optional, configured cloud-sync path. Keep Publish as a clearly future capability; do not imply that a public site is live.

## 3. Recommended information architecture

Do not add a new dashboard or a broad feature menu yet. Keep one focused creation journey:

1. **Start** — new draft / resume a local draft; choose quick questions or paste notes; show resume import as planned until ready.
2. **Tell us** — short prompts, plus optional detail fields.
3. **Review your story** — confirm the structured facts before they are used.
4. **Choose a look** — three recommendations, then “See all styles.”
5. **Make it yours** — structured editor and responsive preview; retain section ordering and visibility.
6. **Save draft** — visible device/account save status. Publishing stays unavailable.

A simpler progress vocabulary could group the existing six-step rail into **Tell us → Review → Design → Edit** while preserving the existing fields behind those stages. The user should not see schema or implementation concepts.

### Map plain-language answers into the current profile

| User language | Existing structured destination |
|---|---|
| What are you learning? | `basics.role`, `learning`, and relevant `interests` |
| What have you built or tried? | One or more `projects` with title, description, tools, and link where supplied |
| What are you proud of? | `highlights`, or a project if the answer describes a build |
| What have you participated in or helped with? | `highlights` for now; only add a separate activity/experience structure if the product proves it needs one |
| What links should people find? | `links` |
| Where and what are you studying? | Optional `education` fields |

Keep this mapping explicit so the conversational intake does not collapse useful information into one unstructured bio field.

## 4. Visual direction for the builder UI

**Direction:** a welcoming creative workspace—calm, tactile, clear, and slightly editorial, but not a portfolio page or developer tool.

- **Product palette:** warm paper and white surfaces; charcoal/evergreen text; restrained sage and terracotta accents. Avoid making dark charcoal + lime the product identity; no default purple-gradient AI SaaS treatment.
- **Typography:** readable neutral sans-serif for controls and body copy. Use a restrained serif only for occasional product-brand moments. As a starting rule, body text 14–16px, labels/helper text 12–14px, compact metadata no smaller than 12px, headings mostly 24–32px. Do not use oversized landing-page typography inside the editor.
- **Controls:** aim for 44px minimum touch targets, clear labels, visible keyboard focus, and clear selected/disabled states. Avoid controls that depend on tiny text or color alone.
- **Surfaces:** flat, quiet cards with thin borders and soft, minimal shadows. No glass panels, neon glow, terminal chrome, or excessive rounded pills.
- **Layout:** a compact brand/save header; a plain-language progress rail; one primary task at a time; the preview is present but not allowed to compete with the current question. On mobile, make Edit/Preview switching obvious and preserve the user's place.
- **Writing tone:** supportive, specific, and non-judgmental. Prefer “Add a project you tried” over “Add a case study.” Never imply that a beginner needs impressive work to belong.
- **Separation rule:** product UI tokens belong to the studio shell. Portfolio theme tokens belong to the generated preview. Changing a portfolio style must never restyle the builder itself.

## 5. Design-system rules for the 22 portfolio styles

### Shared acceptance rules

These apply to every style; the individual descriptions below define its distinct art direction.

1. **Color alone is not a different template.** A style must have a distinct composition and differ structurally in at least four of: page grid, navigation placement, hero, project presentation, section rhythm, and image treatment. At least three of layout, hero, navigation, and project presentation must be visibly different from its closest neighbor.
2. **Same profile, same viewport for comparisons.** Audit with a fixture that has a short and long name, a brief and long bio, no image, one project, several projects, education, activities, and links. Also test an empty/early-stage profile so no theme invents content.
3. **Content stays factual.** Do not manufacture dates, metrics, client names, titles, project screenshots, or outcomes. If an image is absent, use an honest abstract illustration or a neutral placeholder—not a fake screenshot presented as real work.
4. **Mobile is a designed composition.** Reflow at narrow widths, preserve reading order, prevent horizontal scrolling, and keep project images/captions legible. Navigation may wrap or become a compact anchor list; it must not disappear without an alternative.
5. **Interactions are real and accessible.** Anchors navigate to sections; project links work; cards that look interactive are actually interactive. Provide keyboard focus, at least 44px targets for controls, and no hover-only information. Respect reduced-motion preferences. Decorative animation is optional and never carries meaning.
6. **Do not lock content to the template.** The existing section visibility/order controls remain authoritative. Styles can change visual grouping and rhythm, but cannot silently hide user-approved content.
7. **Readable type and images.** Body copy should be comfortable at portfolio size; small labels are supporting details. Preserve image aspect ratios or crop intentionally with an accessible alt text strategy.

For each direction, the specification below explicitly covers layout, typography, navigation, hero, project treatment, section rhythm, image treatment, spacing, decoration, mobile behavior, and interaction pattern.

### Core styles

#### 1. Minimal — “Quiet & minimal”
- **Layout / navigation:** narrow, centered single column; one quiet top line with the owner’s name and simple About / Work / Contact anchors.
- **Typography / hero:** neutral sans, restrained 30–40px name, one short role or learning line; no oversized poster heading.
- **Projects / images:** plain project list with title, one-sentence description, and optional small thumbnail; avoid card chrome.
- **Rhythm / spacing / decoration:** generous consistent vertical gaps, hairline separators, almost no ornament.
- **Mobile / interaction:** same one-column order; nav wraps cleanly; links underline on focus/hover and all sections remain visible.

#### 2. Editorial — “Story-led”
- **Layout / navigation:** asymmetric main column with a narrow metadata/portrait rail; masthead-like name and a short section index.
- **Typography / hero:** expressive serif headline paired with sans body; hero combines name, introduction, and optional portrait rather than a generic title block.
- **Projects / images:** one featured project with a large, captioned image, followed by shorter story-led entries.
- **Rhythm / spacing / decoration:** alternating text/image blocks, generous margins, fine rules and editorial captions.
- **Mobile / interaction:** stack introduction before image and then projects; keep anchor navigation visible; image captions stay attached to their image.

#### 3. Project-focused — “Project-forward”
- **Layout / navigation:** compact identity header; Work is first in the anchor navigation and first in page order.
- **Typography / hero:** clear sans-serif name and role with a concise intro; hero is intentionally shorter than the featured work.
- **Projects / images:** large, consistent project cards with real screenshots or honest abstract art, title, tools, and a useful description.
- **Rhythm / spacing / decoration:** a strong featured project, a regular work grid, then compact About/Education/Links sections; borders are functional, not decorative.
- **Mobile / interaction:** one project per row; image above text; card links have clear labels and keyboard focus.

### Additional styles

#### 4. Retro / print-inspired
- **Layout / navigation:** poster/magazine masthead with a small print-style section index.
- **Typography / hero:** warm serif or slab display with compact sans labels; hero reads like a printed cover but uses only real profile facts—no fabricated issue/date stamp.
- **Projects / images:** project “print panels” with caption and optional real screenshot or illustration; do not use fake scans as evidence.
- **Rhythm / spacing / decoration:** broad paper margins, ruled dividers, restrained ink/registration marks; texture is subtle and does not reduce contrast.
- **Mobile / interaction:** move stamps below the title, not over it; nav wraps; panels become a single vertical reading sequence with ordinary links.

#### 5. Pinboard / visual
- **Layout / navigation:** asymmetric board with varied tile sizes, but aligned to a grid; compact top navigation.
- **Typography / hero:** friendly sans with hand-labeled accents; short intro acts as the board heading rather than a full-screen hero.
- **Projects / images:** visually prominent tiles; real images, sketches, or clearly illustrative placeholders; captions stay attached to each tile.
- **Rhythm / spacing / decoration:** loose tile rhythm inside consistent gutters; restrained tape/pin details, never covering text.
- **Mobile / interaction:** preserve source order in one column (two only when truly readable); every tile has a visible link and focus state.

#### 6. Gaming / arcade
- **Layout / navigation:** framed profile layout with simple section labels; avoid fake status bars, scores, levels, or gamer statistics.
- **Typography / hero:** monospace accents with readable sans body; hero presents the person's name and real interests, not a fictional player persona.
- **Projects / images:** “build” panels with actual tools/links and optional project screenshots; pixel motifs may be decorative only.
- **Rhythm / spacing / decoration:** discrete panels and small status-like labels; color and pixel decoration are secondary to the information.
- **Mobile / interaction:** stack panels; no horizontal game canvas; all nav remains ordinary accessible links and no fake game interaction is implied.

#### 7. Gen Z Dark / after hours
- **Layout / navigation:** dark editorial page with a relaxed, staggered content column and unobtrusive text nav—not a terminal or cyberpunk HUD.
- **Typography / hero:** expressive sans display, controlled scale, conversational copy; accent can be coral, lavender, or soft acid green, but not a generic neon-on-black kit.
- **Projects / images:** prominent image-and-copy cards using actual work or clear abstract art.
- **Rhythm / spacing / decoration:** intentional asymmetry, breathing room, occasional symbols; no repetitive glowing cards.
- **Mobile / interaction:** shrink display type without clipping; stack cards; maintain contrast and visible link/focus states.

#### 8. Swiss grid / studio
- **Layout / navigation:** strict modular grid, numbered index, and aligned columns; navigation is typographic, not pill-based.
- **Typography / hero:** disciplined grotesk sans; hero places a large but controlled statement alongside name/role metadata.
- **Projects / images:** grid-aligned project rows or tiles with consistent image crops and concise captions.
- **Rhythm / spacing / decoration:** repeatable column and baseline rhythm; thin rules, deliberate whitespace, no extra illustration.
- **Mobile / interaction:** collapse columns in reading order; retain small section indices; anchors and project links stay visible.

#### 9. Newsprint / field notes
- **Layout / navigation:** newspaper masthead and article-like columns; navigation reads as a simple contents line.
- **Typography / hero:** serif headline and readable serif/sans body pairing; hero is a headline plus real byline/context, not a fabricated publication issue.
- **Projects / images:** short project stories with image captions and metadata only when supplied.
- **Rhythm / spacing / decoration:** column grid, double rules, bylines, and compact but readable section starts.
- **Mobile / interaction:** one column; masthead wraps without clipping; captions stay with images and there is no horizontal newspaper strip.

#### 10. Neo-brutalist / direct
- **Layout / navigation:** asymmetrical blocks and direct high-contrast index navigation.
- **Typography / hero:** bold sans headline, but size is capped for actual names; hero uses strong text blocks rather than a giant empty slogan.
- **Projects / images:** thick-bordered, offset project cards with clear links and real/abstracted imagery.
- **Rhythm / spacing / decoration:** hard dividers, solid color blocks, square corners, and a small number of deliberate offset shadows.
- **Mobile / interaction:** stack blocks with no sideways overflow; focus outlines remain prominent; shadow/hover is not the only sign of clickability.

#### 11. Botanical / organic
- **Layout / navigation:** calm editorial column with a lightweight section index.
- **Typography / hero:** humanist sans plus a soft serif; hero pairs an introduction with a restrained line-art botanical motif.
- **Projects / images:** field-note cards with captions and natural/handmade imagery when supplied.
- **Rhythm / spacing / decoration:** flowing but consistent vertical spacing, fine dotted rules, restrained leaf/branch line art.
- **Mobile / interaction:** stack text and art; do not let decoration overlap copy; normal links and visible focus states.

#### 12. White-cube / gallery
- **Layout / navigation:** spacious gallery grid with a minimal name/index header.
- **Typography / hero:** quiet sans/serif pairing; hero is a curator-like one- or two-sentence introduction, not an oversized bio.
- **Projects / images:** large artwork/screenshot first, followed by concise title and useful caption; avoid generic card borders.
- **Rhythm / spacing / decoration:** image-led spacing and wide margins; almost no decorative chrome.
- **Mobile / interaction:** one artwork per row, consistent image ratios and attached captions; no inaccessible carousel or hover-only titles.

#### 13. Notebook / terminal
- **Layout / navigation:** text-first logbook with a small table of contents; use a light notebook-paper direction so it is not confused with an IDE.
- **Typography / hero:** monospace for labels/metadata, highly readable sans or serif for body; hero resembles a personal field log, not a command prompt.
- **Projects / images:** dated entries only when dates are provided; project notes show real title, tools, and learning, not fake console output.
- **Rhythm / spacing / decoration:** ruled lines, margin marks, and deliberate indentation; no blinking cursor or fabricated shell commands.
- **Mobile / interaction:** long text wraps safely; no fixed-width terminal; section anchors work and motion is unnecessary.

#### 14. Blueprint / workshop
- **Layout / navigation:** measured grid with small drawing-index navigation and a clear content column.
- **Typography / hero:** technical sans plus monospace labels; hero uses a real project/learning statement with optional diagram motif.
- **Projects / images:** process cards or diagrams paired with project descriptions; do not invent dimensions or engineering metrics.
- **Rhythm / spacing / decoration:** numbered stages, fine grid lines, drafting marks and consistent gutters.
- **Mobile / interaction:** diagrams reflow or crop with labels preserved; cards stack; nav and links remain ordinary and touchable.

#### 15. Bauhaus / geometric
- **Layout / navigation:** asymmetrical geometric composition with a simple horizontal index.
- **Typography / hero:** geometric sans plus one restrained contrasting face; shapes frame the person's real name and role.
- **Projects / images:** modular project blocks with geometric image masks or plain rectangular screenshots.
- **Rhythm / spacing / decoration:** disciplined blocks, circles/squares/lines used as an intentional system—not random decoration.
- **Mobile / interaction:** stack the composition; move geometric shapes to the margins; never cover labels, links, or copy.

#### 16. Y2K / internet diary
- **Layout / navigation:** personal-web “window” composition with clearly labeled tabs; no fixed-width fake browser that overflows.
- **Typography / hero:** rounded display accent with plain sans body; hero feels personal and playful without chrome/glass overload.
- **Projects / images:** small web-diary tiles with real screenshots or user-supplied photos, lightly framed.
- **Rhythm / spacing / decoration:** modular cards, badges, subtle metallic/silver details and occasional star shapes.
- **Mobile / interaction:** panels become fluid and vertical; no horizontal scrolling; any tab-like nav is a real anchor with focus styling.

#### 17. Soft pastel / friendly
- **Layout / navigation:** simple modular layout with a compact, pill-like but legible anchor row.
- **Typography / hero:** friendly sans with an optional soft serif accent; hero sits on one gentle color field, not a generic purple gradient.
- **Projects / images:** clear rounded project cards with real/illustrative thumbnails and plain-language captions.
- **Rhythm / spacing / decoration:** even spacing, a few soft color blocks and simple circles; no excessive glass or childish clutter.
- **Mobile / interaction:** cards stack; buttons remain high contrast and large enough; no information appears only on hover.

#### 18. Academic / reading room
- **Layout / navigation:** narrow essay column with a compact contents list.
- **Typography / hero:** bookish serif headline, sans labels/body support; hero states current study or question without claiming publications.
- **Projects / images:** coursework, experiments, or reading notes as citations/entries; publication details appear only if supplied.
- **Rhythm / spacing / decoration:** numbered sections, footnote-like notes, understated rules and generous text measure.
- **Mobile / interaction:** contents list wraps above the essay; citations remain readable; no tiny footnotes as the only source of meaning.

#### 19. Cut-and-paste / zine
- **Layout / navigation:** controlled collage grid with a recognizable masthead/index and aligned reading order.
- **Typography / hero:** no more than two type families; bold display plus handwritten/serif accent used sparingly; hero is a layered introduction.
- **Projects / images:** paper-like project tiles with captions, actual snapshots, or clearly illustrative cutouts.
- **Rhythm / spacing / decoration:** intentional offsets, tape/stamp details, light rotation; text never collides and no effect is required to parse content.
- **Mobile / interaction:** remove overlaps and rotation where they hurt legibility; stack in source order; every link is directly tappable.

#### 20. Documentary / photo essay
- **Layout / navigation:** minimal contents nav and a vertical sequence of image/story blocks.
- **Typography / hero:** quiet editorial serif with compact caption labels; hero is a real image plus title and context.
- **Projects / images:** photo-essay frames with captions and alt text; use user-provided media or honest placeholders only.
- **Rhythm / spacing / decoration:** measured sequence, broad margins, fine rules, little decorative chrome.
- **Mobile / interaction:** one column, responsive crops with meaningful focal points, no carousel unless it has accessible controls and a non-carousel fallback.

#### 21. Community / local impact
- **Layout / navigation:** people/activity-first page with anchors such as About, Projects, and Involvement.
- **Typography / hero:** warm humanist sans; hero makes space for the person's role and community context without assuming identity or impact.
- **Projects / images:** contribution cards state role, action, and outcome only when known; no invented impact numbers. Use group/person imagery only when provided and appropriate.
- **Rhythm / spacing / decoration:** alternating contribution blocks, comfortable whitespace, one restrained seal/mark at most.
- **Mobile / interaction:** linear story with readable role labels; contact links are explicit; no social proof or group-photo cliché.

#### 22. Product case study
- **Layout / navigation:** project-led page with a compact, functional table of contents.
- **Typography / hero:** readable sans with a restrained serif or mono label; hero names the actual project, role, and question.
- **Projects / images:** one lead project structured as context → approach → decisions → result/learning; outcomes and screenshots must come from the user, not the template.
- **Rhythm / spacing / decoration:** numbered process stages, annotated diagrams/screenshots, short captions and consistent generous spacing.
- **Mobile / interaction:** linear case-study flow; contents links remain visible or wrap above it; optional detail disclosures are keyboard accessible and never conceal required content.

## 6. How AI should interact with the structured profile

Keep `ProfileDocument` and `DesignConfig` as the source of truth. Add an AI service boundary that returns structured proposals—not React, HTML, CSS, routes, or database code.

### Suggested proposal contract

Each proposed change should contain:

- a permitted profile path, such as `basics.about` or `projects[0].description`;
- the proposed text/value;
- a short source excerpt or source pointer;
- a confidence/needs-review signal;
- a reason such as “This sounds like a project” or “This could be shorter.”

The response also may include clarifying questions, candidate project records, missing-information prompts, section suggestions, and one or two copy alternatives. Validate every response with Zod and an allowlist of profile paths before rendering it.

### User-control rules

- AI suggestions start in a **suggested** state; the user can accept, edit, reject, or defer them.
- Accepting a suggestion applies only that validated change. Never replace an existing user value silently.
- Show why an item was extracted and, where practical, the words it came from.
- Do not invent employers, credentials, metrics, tools, dates, project results, awards, or links. If a fact is missing, ask or leave it blank.
- “Adapt this to my design” may adjust tone/length/section emphasis, but must preserve facts and require approval.
- Keep a manual route if AI is unavailable. Do not label deterministic placeholder text as AI-generated.
- Call the model from a server-side provider adapter; no AI secret or service-role key goes in browser code. Keep request/response schemas provider-neutral.

### Assist actions, in a sensible order

1. Turn raw notes into candidate profile fields and project records.
2. Improve one selected About/project description with a few alternatives.
3. Suggest relevant sections and point out missing details without blocking.
4. Adapt wording to the selected portfolio direction (for example, concise/editorial/direct) while preserving facts.

## 7. Future Resume → Portfolio path

Design the path now; do not pretend the complete upload backend exists:

**Choose resume → upload PDF/DOCX → extract text → show detected information with source excerpts → user edits/confirms → map to structured profile → choose style → generate → edit.**

For a later implementation, include explicit consent, accepted MIME types and size limits, server-side parsing, clear error/retry states, and a policy for deleting the source file and extracted text. Never publish automatically. Keep page/source references with uncertain extractions so the user can verify them. Until that work is approved and secured, present the route as planned rather than as a working upload feature.

## 8. Exact implementation phases and checkpoints

Each phase should be a small reviewable change. Run typecheck/build and the relevant manual checks after each checkpoint. Stop for review before starting the next phase.

### Checkpoint 1 — product shell, visual separation, and accessibility

- Define independent studio tokens and portfolio tokens; ensure selected templates affect only the preview.
- Improve builder typography, spacing, keyboard focus, contrast, mobile panels, and control target sizes.
- Do not change profile storage or the template renderer's public API.
- **Acceptance:** the builder reads as a friendly creative product; no dark/terminal/portfolio theme leaks into it; controls are usable at desktop and mobile widths; the current draft still loads/saves.

### Checkpoint 2 — content-first onboarding, manual-first

- Add the everyday-language prompts and a paste-notes option, using the current profile schema.
- Make education/extra details optional and progressively disclosed; keep direct editing available.
- Preserve the six existing fields/steps behind a simpler progress vocabulary where possible.
- **Acceptance:** a new user can create a useful draft with a few short answers; no portfolio jargon is required; existing local drafts remain valid.

### Checkpoint 3 — profile review and correction

- Add the “Here’s what I understood” review surface with editable grouped facts, source/uncertainty labels, and accept/edit/remove/move actions.
- Initially support manual/preset data so the review UX can be tested without pretending an AI provider is connected.
- **Acceptance:** every generated/entered item can be corrected before it reaches the portfolio; existing profile fields map without loss.

### Checkpoint 4 — 22-style art-direction manifest and fixture audit

- Record the per-style layout, type, nav, hero, project, rhythm, image, spacing, decoration, mobile, and interaction choices above in the catalog/spec.
- Create a consistent preview fixture set (early-stage profile, one-project profile, image-rich profile, long-text profile).
- **Acceptance:** side-by-side review uses the same data; color/font changes alone do not pass the distinctness rubric.

### Checkpoint 5 — redesign the portfolio styles in small batches

Keep the current renderer and profile schema. Audit and refine composition, not just theme values. Stop for review after each batch:

- **5A:** Minimal, Editorial, Project-focused.
- **5B:** Retro, Pinboard, Gaming, Gen Z Dark, Swiss Grid.
- **5C:** Newsprint, Neo-brutalist, Botanical, White-cube, Notebook/Terminal.
- **5D:** Blueprint, Bauhaus, Y2K, Pastel, Academic.
- **5E:** Zine, Documentary, Community, Product Case Study.

- **Acceptance per batch:** identical fixture content reads naturally; layouts are structurally distinct; real/placeholder images are honest; all sections remain controllable; mobile has no overflow or missing content.

### Checkpoint 6 — AI contract and safe provider boundary

- Define request/response Zod schemas, permitted profile paths, source provenance, and suggestion states.
- Add a server-side provider adapter behind configuration; use deterministic test fixtures for tests, not a fake user-facing AI result.
- **Acceptance:** invalid or untrusted model output cannot mutate a draft; no secret is exposed to the browser; manual editing works with no AI configuration.

### Checkpoint 7A — first real AI action: rough notes → profile suggestions

- Use the existing server-only `POST /api/ai` boundary and Checkpoint 6 proposal contract; configure Gemini through server environment variables only.
- Obtain consent before the first provider request and send only the pasted `sourceText` needed for extraction.
- Validate provider output, provenance, allowed profile paths, and conservative source grounding on the server. Keep suggestions review-only until a person chooses Keep, Edit, or Remove inside the existing ProfileReview.
- Preserve the quick-question/manual flow, local drafts, and original notes. Warn about scalar conflicts, normalize link duplicates, and flag possible project duplicates.
- Provider failures, timeouts, malformed/empty output, and poor notes retain the original notes and offer a retry or working manual fallback.
- **Out of scope:** copy rewriting, design-aware writing, resume import, publishing, analytics, billing, chat, autonomous edits, or additional AI actions.
- **Acceptance:** no secrets enter client code, no unsupported facts pass the safety tests, accepted values remain ordinary profile data, and browser regression covers consent, review decisions, manual fallback, responsive use, accessibility, and all 22 styles.

### Checkpoint 7B — AI copy improvement (implemented; stop for review)

- Extend the existing Checkpoint 6 `/api/ai` contract/provider boundary; add small contextual controls only for About text and bounded project-description paths.
- Support only the actions `clearer`, `shorten`, and `professional`. Obtain consent before sending the selected text plus necessary target/action data; never send the full profile, design, other projects, or a local project ID.
- Validate proposals server-side for factual grounding and source provenance. Keep results as proposals until explicit Use, Edit, or Dismiss, then apply approved text with safe copy-on-write into the existing editor/draft lifecycle.
- Keep `adapt_copy_to_style` unsupported (HTTP 422 `unsupported_operation`). No chatbot, automatic/global rewriting, new page, design-aware copy, renderer redesign, or unrelated AI actions.
- **Acceptance:** mocked-provider tests cover the narrow request boundary, actions, grounding/injection, provider failures, unsupported operations, and the approval lifecycle; browser checks cover consent decline, manual fallback, About/project use, drafts/reload, legacy drafts, keyboard/focus, 390px layout, all 22 styles, `/template-demos`, browser errors, and Axe. Public deployment requires authentication and rate limiting before enabling paid-provider traffic.

### Checkpoint 8 — resume path design and later implementation decision

- Finalize UX, supported files, privacy/data lifecycle, and error handling.
- Build the upload/extraction backend only after provider/storage decisions and security review; it is not a prerequisite for the first AI-assisted intake.
- **Acceptance:** no file is retained or sent to an unconfigured service; extracted fields have reviewable source context.

### Checkpoint 9 — regression and release readiness (publishing remains out of scope)

- Test draft persistence, responsive preview, keyboard navigation, contrast, content edge cases, style variants, and AI fallback.
- Keep Publish clearly marked as future and verify it does not make content public.
- **Acceptance:** all current functionality remains intact; no public publishing is triggered or implied.

## Recommended immediate next step

Review **Checkpoint 7B** using `qa-7b-validation.md` and its regression artifacts. Stop here until review. Do not begin style-aware copy adaptation, other AI actions, resume extraction, publishing, or unrelated product work in the same increment.
