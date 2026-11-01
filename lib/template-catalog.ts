import type { TemplateId } from '@/lib/profile-schema';

export type TemplateCategory = 'Recommended' | 'Editorial' | 'Visual' | 'Technical' | 'Creative' | 'Personal';
export type TemplateLayout = 'classic' | 'editorial' | 'project' | 'retro' | 'pinboard' | 'arcade' | 'after-hours' | 'swiss' | 'newsprint' | 'brutalist' | 'botanical' | 'gallery' | 'terminal' | 'blueprint' | 'bauhaus' | 'y2k' | 'pastel' | 'academic' | 'zine' | 'documentary' | 'community' | 'case-study';

export type StructuralDimension = 'grid' | 'navigation' | 'hero' | 'projects' | 'section rhythm' | 'image treatment';
export type VisibleDimension = 'layout' | 'hero' | 'navigation' | 'projects';

export type TemplateArtDirection = {
  positioning: string;
  composition: string;
  navigation: string;
  hero: string;
  projects: string;
  sectionRhythm: string;
  typography: string;
  imageTreatment: string;
  spacing: string;
  decoration: string;
  mobileTransformation: string;
  interaction: string;
};

export type TemplateStructuralAudit = {
  closestId: TemplateId;
  changedDimensions: StructuralDimension[];
  visibleDifferences: VisibleDimension[];
  evidence: string;
};

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  layout: TemplateLayout;
  description: string;
  featured?: boolean;
  artDirection: TemplateArtDirection;
  structuralAudit: TemplateStructuralAudit;
};

/**
 * Authoritative 22-style manifest. Art direction describes the intended design
 * contract; structuralAudit records what the current renderer actually changes
 * against the closest current style. Color, font, and copy changes alone do not
 * count as structural differences.
 */
export const TEMPLATE_CATALOG: readonly TemplateMeta[] = [
  {
    id: 'minimal', name: 'Minimal', category: 'Recommended', layout: 'classic', featured: true,
    description: 'Quiet, centered, and text-first, with projects as simple curated entries.',
    artDirection: {
      positioning: 'A thoughtful developer or student’s personal site with almost no visual competition and no implied level of seniority.',
      composition: 'A narrow, centered reading column: a single-line identity/navigation row, short introduction, then ordered ruled sections; no sidebar or card dashboard.',
      navigation: 'One quiet horizontal line with the owner’s name at left and plain same-page text anchors at right; no pills or floating navigation, and only visible sections appear.',
      hero: 'A restrained 30–40px name followed by one short supplied role or learning statement; no giant hero, avatar, or background image.',
      projects: 'A vertical, unboxed list: supplied title, description, tools, and a real link when present. Use hairline separators, not large cards or generated thumbnails.',
      sectionRhythm: 'Quiet rows separated by hairline rules; render visible sections in DesignConfig order and omit empty optional sections.',
      typography: 'Neutral readable sans-serif throughout, with a restrained hierarchy and a short measure; no display-font theatrics.',
      imageTreatment: 'ProfileDocument has no image field. Minimal projects stay text-only; never draw screenshot-like filler or imply a missing image.',
      spacing: 'Broad outer margin around a compact reading measure, steady section spacing, and enough room for long names and paragraphs to wrap.',
      decoration: 'Whitespace, alignment, typography, and hairline rules only; no gradients, blobs, glass, glow, shadows, or status-like badges.',
      mobileTransformation: 'Remain one reading column; let the wordmark sit above or beside naturally wrapped text links, reduce outer padding, and keep navigation visible.',
      interaction: 'Keyboard-focusable section anchors and honest external links; no hover-only content or motion-dependent cues.',
    },
    structuralAudit: {
      closestId: 'editorial', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Minimal is a narrow centered reading column with a single inline name/nav rule, a short sans-serif intro, unboxed text-only project entries, and even ruled rows. Editorial uses an asymmetric contents rail, a two-part essay hero, large abstract project art with alternating rows, and a slower feature/story rhythm. The contrast remains structural in grayscale.',
    },
  },
  {
    id: 'editorial', name: 'Editorial', category: 'Recommended', layout: 'editorial', featured: true,
    description: 'An asymmetric, magazine-like profile with a contents rail and featured project stories.',
    artDirection: {
      positioning: 'An independent-magazine-style personal essay: story and context are foregrounded without implying a publication or résumé status.',
      composition: 'An asymmetric page: a two-part intro and metadata spread, then a left contents rail beside a wide story column; projects have one feature and alternating text/art rows.',
      navigation: 'A numbered Contents index in a side rail on desktop; it moves directly below the intro on mobile and links only to visible sections.',
      hero: 'The supplied name and role/learning line share the lead column; supplied location and education sit in a distinct metadata column. No assumed portrait.',
      projects: 'The first supplied project receives a large abstract decorative panel and story treatment; later projects alternate image-treatment and copy columns. Titles, descriptions, tools, and valid links stay attached.',
      sectionRhythm: 'Ruled, essay-like sections with generous breaks and a feature-led projects section; preserve visibleSections and the exact DesignConfig order.',
      typography: 'Expressive but controlled serif for name, section headings, and project titles; neutral sans-serif for body, tools, navigation, and metadata.',
      imageTreatment: 'ProfileDocument has no image field. Use a non-photographic geometric CSS composition in the art panel, hidden from assistive technology; it is decoration, never project evidence.',
      spacing: 'Wide editorial margins, a distinct rail/main gutter, and a comfortable text measure; mobile stacks the grid without reducing body leading.',
      decoration: 'Fine rules, aligned metadata, and small sequence numbers only; no fake bylines, dates, quotes, stickers, or awards.',
      mobileTransformation: 'Stack name, intro, and metadata first; place Contents next; then show featured art above its project story and stack each alternating row in source order.',
      interaction: 'Same-page anchors and true links remain keyboard accessible with visible focus; no navigation item should be decorative-only.',
    },
    structuralAudit: {
      closestId: 'minimal', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Editorial differs from Minimal in the asymmetric contents-rail grid, side-rail navigation, split name/metadata hero, large first project panel with alternating later rows, story-paced rules, and abstract art treatment versus no project art. Those differences remain visible with color removed.',
    },
  },
  {
    id: 'project', name: 'Project-focused', category: 'Recommended', layout: 'project', featured: true,
    description: 'A wide work archive with one featured project, a supporting grid, and compact profile sections.',
    artDirection: {
      positioning: 'A work-oriented portfolio that answers “what has this person built?” quickly, while representing only supplied projects and details.',
      composition: 'A wide canvas with a short identity header, a large first-project feature, a two-column archive for additional work, and compact secondary sections; DesignConfig order remains authoritative.',
      navigation: 'A top row with the owner’s name and Work first when Projects is visible; other same-page links follow, and hidden sections never gain links.',
      hero: 'A short name-and-role/learning introduction with little vertical padding; move quickly into the configured sections without an oversized headline or decorative hero.',
      projects: 'Make the first supplied project a large feature and place remaining supplied projects in a consistent two-column archive. With one project, show one feature; with none, show an honest empty state only when Projects is visible.',
      sectionRhythm: 'Projects receive the strongest visual weight; remaining visible sections stay compact and follow DesignConfig order exactly. Omit empty optional sections, except the explicit visible Work empty state.',
      typography: 'Clean sans-serif hierarchy: confident project titles, functional labels, and readable descriptions; no editorial display-serif direction.',
      imageTreatment: 'There is no image field in ProfileDocument. Use squared, neutral CSS geometry in isolated decorative panels; never draw a faux interface or imply a project screenshot.',
      spacing: 'Use a broad page measure, large feature-art area, and consistent archive gutters; secondary facts use tighter spacing.',
      decoration: 'Functional borders and abstract framed panels only; no gradients, blobs, shadows, metrics, clients, or fabricated outcomes.',
      mobileTransformation: 'Collapse feature and archive to one project per row; place each abstract panel above its title, description, tools, and link, then stack compact secondary sections.',
      interaction: 'Project links are real external links with safe target behavior; section anchors work only for visible sections and show keyboard focus.',
    },
    structuralAudit: {
      closestId: 'case-study', changedDimensions: ['grid', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'projects'],
      evidence: 'Project-focused uses a broad canvas, short unboxed identity hero, a full-width large project feature followed by a two-column archive, and compact secondary rows. Product Case Study uses a narrower case narrative with text-led project features and its own case rhythm; this style’s squared neutral art panels and archive grid add distinct project treatment without changing the user’s section order.',
    },
  },
  {
    id: 'retro', name: 'Retro / print-inspired', category: 'Creative', layout: 'retro',
    description: 'A structured print-inspired portfolio with a numbered contents index and ruled work notes.',
    artDirection: {
      positioning: 'A contemporary personal field-notes page with print warmth, without implying a real publication or a dated résumé.',
      composition: 'A narrow paper-toned publication sheet with a two-part masthead, large nameplate, numbered contents index, and sequential ruled sections. Projects use a separate text-and-abstract-plate record rather than a collage.',
      navigation: 'A numbered contents row sits in the masthead and links only to visible sections; it wraps into readable rows on small screens.',
      hero: 'A prominent nameplate followed only by the supplied role or learning line; print framing is decorative and does not imply a real issue, date, or byline.',
      projects: 'Ordered project records pair one small abstract ink panel with the supplied title, description, tools, and valid link; ordinal labels indicate only list position.',
      sectionRhythm: 'Numbered section heads and restrained rules create a clear publication cadence; retain the configured section order without interleaving projects or filler.',
      typography: 'Warm serif display with a plain sans-serif utility face; maintain body-size readability and robust wrapping.',
      imageTreatment: 'No user image is available in the schema. Use paper texture and geometric decoration only; never make a project tile look like a screenshot.',
      spacing: 'Generous hero margins with compact but comfortable section spacing; avoid cramming long copy into narrow columns.',
      decoration: 'Use restrained ink rules, paper tones, and a few abstract print marks; avoid fictional dates, bylines, and availability claims.',
      mobileTransformation: 'Keep the masthead and wrapped index ahead of the story; reduce sheet margins and stack each project plate above its copy in source order.',
      interaction: 'Every masthead item is a same-page anchor to visible content; decorative arrows do not replace link labels or focus indication.',
    },
    structuralAudit: {
      closestId: 'zine', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Retro is a centered paper sheet with a large masthead, numbered in-masthead contents row, and serial ruled sections. Its projects are ordered article records with a small decorative print plate, not Zine’s common two-column card grid; the masthead and stable numbered rhythm remain legible in grayscale.',
    },
  },
  {
    id: 'pinboard', name: 'Pinboard / visual', category: 'Visual', layout: 'pinboard',
    description: 'An asymmetric physical-board composition for real work and supplied notes.',
    artDirection: {
      positioning: 'A physical-board-inspired visual index for genuine work; sparse profiles stay sparse rather than being filled with sample tiles.',
      composition: 'A physical-board canvas anchored by a pinned identity card, with visibly offset paper notes and an asymmetric project area. Cards follow source order even when their edges are offset; this is not a grid of browser windows.',
      navigation: 'Visible section links sit as paper tabs along the board edge; they point only to rendered sections and remain ordinary keyboard links.',
      hero: 'A compact pinned identity card names the owner and shows only a supplied role; the board itself stays visually distinct from the page masthead.',
      projects: 'Each real project is a captioned paper note with a small abstract decoration, factual copy, and optional valid link; no missing item is filled with a tile.',
      sectionRhythm: 'Identity, sections, and notes occupy a board-like composition, while DOM and mobile reading order follow DesignConfig exactly.',
      typography: 'Plain, readable sans-serif for captions with a distinctive but legible serif accent for display labels.',
      imageTreatment: 'ProfileDocument has no image field. Use simple geometric marks as aria-hidden decoration inside paper notes; never imply a photograph, screenshot, or project preview.',
      spacing: 'Use uneven tile sizes but consistent gutters; reserve enough caption space for long titles and avoid cramped mobile tiles.',
      decoration: 'Pins, paper edges, and soft accent shapes may decorate empty space but must never imply an actual photograph or screenshot.',
      mobileTransformation: 'Collapse to one column in source order; preserve captions and touchable links, with no sideways-scrolling board.',
      interaction: 'Tiles are not hover-dependent; links and section anchors use semantic elements and visible keyboard focus.',
    },
    structuralAudit: {
      closestId: 'gallery', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Pinboard now uses an asymmetric, offset paper-board composition with a pinned identity card, edge-tab section navigation, and variable note cards. It no longer shares Gallery’s regular section-card grid or uniform project-art cards; the geometry and source-order layout remain distinct without color.',
    },
  },
  {
    id: 'arcade', name: 'Gaming / arcade', category: 'Technical', layout: 'arcade',
    description: 'A framed arcade-inspired portfolio for real projects—not a gamer-stat dashboard.',
    artDirection: {
      positioning: 'A game-development portfolio for real builds and learning notes, without invented ranks, scores, player stats, or team availability.',
      composition: 'A framed arcade cabinet/screen silhouette encloses the identity and content; each ordered section reads as a clear screen row, not terminal output or a generic dashboard.',
      navigation: 'A high-contrast, wrap-capable section index sits inside the identity frame; every item is a same-page link to a visible section, not a faux game control.',
      hero: 'The supplied name leads a framed profile header, followed by the supplied role; a small pixel-grid edge is decoration, never a player rank or status.',
      projects: 'Each supplied project appears as a compact build record with its actual title, description, tools, and valid link beside a non-screenshot geometric mark.',
      sectionRhythm: 'Sections sit in individually ruled rows inside one cabinet-like screen; the sequence numbers are decorative and the configured order remains authoritative.',
      typography: 'Monospaced display and metadata paired with readable body text; do not use tiny all-caps for essential information.',
      imageTreatment: 'No image field is available. Any pixel-grid or geometric marks are explicitly decorative and must not resemble gameplay screenshots.',
      spacing: 'Use a consistent modular rhythm with enough line-height for dense technical text and wrapped long titles.',
      decoration: 'Use a restrained grid and one accent color; omit fake system alerts, progress bars, and availability indicators.',
      mobileTransformation: 'Stack sections and project entries, wrap command links, and keep the full page free of horizontal scrolling.',
      interaction: 'Keyboard-operable section links and project links; no keypress or hover is required to reveal information.',
    },
    structuralAudit: {
      closestId: 'terminal', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Arcade uses a framed screen with an enclosed numbered section index and rule-separated rows; Terminal remains an open technical page. Project records are compact and in-row rather than Terminal’s shared art cards. Cabinet framing, row logic, and pixel decoration read in grayscale without fabricated stats or terminal output.',
    },
  },
  {
    id: 'after-hours', name: 'Gen Z dark / after hours', category: 'Personal', layout: 'after-hours',
    description: 'A contemporary dark editorial profile with restrained, staggered work stories.',
    artDirection: {
      positioning: 'A casual, expressive personal profile that feels current without leaning on slang, assumptions, or unverified availability claims.',
      composition: 'A narrow contemporary editorial canvas: a quiet wordmark/navigation line, type-led profile introduction, then generous story rows. Project stories use one alternating abstract panel and a readable text column.',
      navigation: 'A quiet, fully labeled top bar links to visible sections; the wordmark returns to the page top and no abbreviations conceal destinations.',
      hero: 'A composed display headline uses the supplied name with the supplied role; body copy appears in its ordered section rather than being repeated in the hero.',
      projects: 'Each project is an alternating editorial row with a non-photographic geometric panel and factual title, description, tools, and optional valid link.',
      sectionRhythm: 'Large open story rows and fine dividers create an editorial pace; alternating project panels never reorder the configured sections.',
      typography: 'Confident display sans-serif with a highly legible body face, comfortable line height, and sufficient contrast on dark surfaces.',
      imageTreatment: 'No image field exists; leave the canvas clean or use neutral CSS decoration, never synthetic portrait or project imagery.',
      spacing: 'Use large hero spacing and stable section gutters, then reduce outer padding (not text size) on mobile.',
      decoration: 'Use quiet geometric line-and-shape panels with no glow or faux interface; each mark is aria-hidden and carries no factual copy.',
      mobileTransformation: 'Stack hero content, move decorative elements out of the text path, and keep navigation and project links comfortably tappable.',
      interaction: 'Same-page links, safe external links, visible focus, and no hover-only notes or motion-dependent states.',
    },
    structuralAudit: {
      closestId: 'arcade', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'After Hours is an open editorial canvas with a calm wordmark row, large type-led intro, spacious story sections, and alternating project-story rows. Arcade is a framed screen with an enclosed index and ruled rows. The dark palette is not the distinction: the layout and content rhythm remain clearly different in grayscale.',
    },
  },
  {
    id: 'swiss', name: 'Swiss grid / studio', category: 'Editorial', layout: 'swiss',
    description: 'A strict modular studio grid with aligned section and project columns.',
    artDirection: {
      positioning: 'A precise studio profile for people who value hierarchy and clarity over expressive decoration.',
      composition: 'A strict twelve-column studio grid aligns a two-part identity, a compact index, numbered section labels, and project rows on shared vertical rules; no card masonry or spare sidebar.',
      navigation: 'A compact numbered index follows the same column start and baseline as the content; links map only to visible sections.',
      hero: 'A modular identity block gives the name the lead column and supplied role a separate aligned cell; it stays typographic, not a centered minimal reading column.',
      projects: 'Each real project uses explicit number, title, detail, and action columns. Empty title/detail/action cells collapse without inventing content.',
      sectionRhythm: 'Visible sections become aligned horizontal bands with stable label and content tracks; their sequence is exactly DesignConfig.sectionOrder.',
      typography: 'Neutral grotesk/sans-serif with a carefully used serif accent; align typography to a readable baseline and body size.',
      imageTreatment: 'No image field exists in the profile schema. Favor negative space and simple rules over pretend imagery.',
      spacing: 'Use consistent grid gutters and generous whitespace; collapse unused tracks instead of leaving blank columns.',
      decoration: 'Thin rules, section numbers, and one restrained accent; numbers are sequence aids, not publication claims.',
      mobileTransformation: 'Collapse the grid to two columns (label/content), then stack hero metadata; avoid empty grid tracks and preserve source order.',
      interaction: 'Section labels link only to visible targets; keyboard focus follows reading order and links do not rely on color alone.',
    },
    structuralAudit: {
      closestId: 'minimal', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Swiss is a rigid studio grid: modular identity, numbered column-aligned index, section bands, and four-part project rows. Minimal is a centered single reading column with plain inline navigation and text-only project entries. Their alignment systems and hierarchy stay unmistakably different in grayscale.',
    },
  },
  {
    id: 'newsprint', name: 'Newsprint / field notes', category: 'Editorial', layout: 'newsprint',
    description: 'A newspaper-like portfolio with real article columns and a readable field-note rhythm.',
    artDirection: {
      positioning: 'A field-note portfolio that borrows newspaper structure without pretending to be a publication.',
      composition: 'A ruled masthead leads into a twelve-column article grid: long-form context gets actual newspaper columns, compact facts occupy narrow article spans, and projects form a two-column work desk.',
      navigation: 'A compact Contents row sits below the masthead and links only to populated, visible sections; links remain plain text rather than tabs.',
      hero: 'The supplied name is the headline, followed only by the supplied role or learning line and actual location; no byline, issue, or date is implied.',
      projects: 'Projects read as paired article entries with abstract, clearly decorative CSS panels before their factual title, description, tools, and optional valid link.',
      sectionRhythm: 'Article spans create an editorial page rather than a list of cover panels; DOM, navigation, and grid placement follow DesignConfig order.',
      typography: 'A strong newspaper serif for name and article headings, with readable sans-serif body and metadata; long paragraphs retain generous leading.',
      imageTreatment: 'ProfileDocument has no image field. Project panels are neutral CSS geometry, aria-hidden and visibly unlike screenshots or portraits.',
      spacing: 'A bounded print sheet uses rules, an ample text measure, and enough gutter between columns; no paragraph is squeezed into a narrow sidebar.',
      decoration: 'Masthead rules and restrained article framing only; omit invented dates, bylines, issue numbers, and article counts.',
      mobileTransformation: 'The article grid and project archive become one column, and long-form body text switches to one reading column without reordered content.',
      interaction: 'Contents anchors target only rendered sections; valid user project URLs remain keyboard-accessible with visible focus.',
    },
    structuralAudit: {
      closestId: 'retro', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Newsprint has a 12-column article grid, two-column body text on desktop, inline Contents links, and two-column project reports. Retro is a centered print cover with a large nameplate, numbered in-masthead contents, and sequential text-plus-print-plate records. The page structures and project treatment remain distinct in grayscale.',
    },
  },
  {
    id: 'brutalist', name: 'Neo-brutalist / direct', category: 'Creative', layout: 'brutalist',
    description: 'Asymmetric, hard-edged blocks and direct text navigation for real work.',
    artDirection: {
      positioning: 'A candid, high-contrast portfolio with no fabricated confidence metrics, status claims, or outcomes.',
      composition: 'An inky identity block anchors a deliberately uneven stack of offset section slabs; each slab changes width and alignment rather than following a modular grid.',
      navigation: 'Visible section links form a direct, wrapping text line with slash separators; no cards, pills, or hover-only destinations.',
      hero: 'The real name leads in heavy, high-contrast type, followed only by supplied role or learning context.',
      projects: 'Projects are factual, square-edged text blocks with strong offset borders; real title, description, tools, and valid links stay together without generated project art.',
      sectionRhythm: 'Alternating widths and block weights make intentional asymmetry while DOM, nav, and mobile stack preserve the configured order.',
      typography: 'Confident heavy display type paired with a plain, readable sans-serif body; long names and descriptions wrap safely.',
      imageTreatment: 'There is no image field in ProfileDocument. Keep projects text-led; borders and color blocks are not screenshots or evidence.',
      spacing: 'Give every slab ample padding and a controlled hard-shadow offset; reduce block offsets on phones instead of compressing text.',
      decoration: 'Square rules, solid fields, and hard-edged shadows only; avoid decorative metrics, faux labels, and symbols that imply facts.',
      mobileTransformation: 'Stack every block at full width, remove lateral offsets, and keep the same source order and touch-sized links.',
      interaction: 'Use semantic anchors and links with visible focus and adequate contrast; hover is never required to understand the page.',
    },
    structuralAudit: {
      closestId: 'swiss', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Neo-brutalist uses uneven, alternating-width slabs, a dark name block, slash-separated direct text nav, and inset text-only project blocks. Swiss aligns every section, nav item, and four-part project row to strict shared columns. Their alignment systems and project forms remain different in grayscale.',
    },
  },
  {
    id: 'botanical', name: 'Botanical / organic', category: 'Visual', layout: 'botanical',
    description: 'A vertical field journal with an airy, organic rhythm and restrained botanical line art.',
    artDirection: {
      positioning: 'A calm, human profile; botanical marks are a design motif and do not assign the owner an interest or lifestyle.',
      composition: 'A narrow, continuous field-journal flow: a spacious identity and one contained line-art branch lead into vertically stacked, open notes and project entries.',
      navigation: 'Quiet text anchors sit below the identity, separated from all illustration; only visible, populated sections receive links.',
      hero: 'Use the real name, supplied role or learning line, and actual location only; the small SVG branch is decorative and kept clear of text.',
      projects: 'Actual projects form simple, vertically ordered journal entries with a discreet list index and their supplied title, description, tools, and valid link.',
      sectionRhythm: 'Open vertical notes and fine dotted separators, never pastel cards or a magazine rail; section and project order stays data-driven.',
      typography: 'A humanist sans-serif for reading with restrained serif headings; retain body size, contrast, and comfortable paragraph leading.',
      imageTreatment: 'No profile image exists. A hand-drawn abstract SVG branch decorates empty header space only; it is not a portrait or project image.',
      spacing: 'Use a centered reading measure and generous vertical gaps; the botanical illustration stays in its own column and never overlays text.',
      decoration: 'One quiet line-art plant and subtle organic rules; no invented nature-themed copy, projects, dates, or interests.',
      mobileTransformation: 'Keep the journal in one vertical stream, scale the SVG into a reserved header corner, and let every entry and link wrap naturally.',
      interaction: 'Every anchor and project link is semantic, keyboard-accessible, and focus-visible; no information depends on hover or color.',
    },
    structuralAudit: {
      closestId: 'editorial', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Botanical is a single central field-journal stream with a separate line-art branch and unboxed vertical project entries. Editorial has a two-part essay hero, a numbered contents rail, large feature art, and alternating story rows. No magazine grid, cards, or overlapping decoration are shared.',
    },
  },
  {
    id: 'gallery', name: 'White-cube / gallery', category: 'Visual', layout: 'gallery',
    description: 'A whitespace-heavy, visual-first work index with accessible factual captions.',
    artDirection: {
      positioning: 'A quiet white-cube presentation that never claims a decorative panel is user-supplied artwork.',
      composition: 'Large, unframed abstract panels lead the Projects section; each is followed by its real title, description, tools, and link as a caption. Supporting profile sections sit in spacious full-width bands.',
      navigation: 'A small numbered section index sits beneath the owner’s name and links only to visible populated sections.',
      hero: 'A restrained identity title gives way quickly to visual work; supplied role or learning text stays concise and never competes with the project panels.',
      projects: 'Render each actual project visual-first, then title, factual description, supplied tools, and optional valid link; decorative geometry is never presented as the project itself.',
      sectionRhythm: 'Work receives the greatest whitespace and visual scale; remaining sections follow the configured order in quiet, unboxed rows.',
      typography: 'Neutral sans-serif captions with a clear, accessible title hierarchy and comfortable reading sizes.',
      imageTreatment: 'ProfileDocument has no image field. Large CSS geometric studies are explicitly aria-hidden placeholders, not screenshots, portraits, or user artwork.',
      spacing: 'Use a broad white canvas, substantial gaps around each panel, and a bounded caption measure; mobile reduces panel height, not text readability.',
      decoration: 'Gallery-like white space and simple geometric marks only; no fictional wall labels, dates, exhibition titles, or work counts.',
      mobileTransformation: 'Keep the visual-before-caption order, stack every entry in source order, and keep the panel within the phone width.',
      interaction: 'Section anchors and project URLs remain real, keyboard-operable links with visible focus; project titles remain visible without hover.',
    },
    structuralAudit: {
      closestId: 'editorial', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'White-cube gives projects the largest visual area, with abstract geometry before the title and caption, and separates supporting facts into spacious unboxed bands. Editorial is text-led: a split essay hero, numbered side rail, and alternating image/copy story rows. Source order and accessible captions remain intact in grayscale.',
    },
  },
  {
    id: 'terminal', name: 'Notebook / terminal', category: 'Technical', layout: 'terminal',
    description: 'A light, ruled engineering journal with readable prose and monospace labels only.',
    artDirection: {
      positioning: 'A practical learning log for real builds and supplied technical notes, not a terminal emulator or activity feed.',
      composition: 'One fluid notebook page on pale ruled paper: an ordinary identity header, linked section index, and orderly written entries with a margin rule.',
      navigation: 'A numbered, wrapping notebook index contains functional same-page anchors; no prompt, command, or fake control is shown.',
      hero: 'The real name and supplied role or learning line lead; there are no fabricated dates, session labels, statuses, or shell prompts.',
      projects: 'Each build is a prose entry with its actual title, description, optional tools, and safe link; simple ordinal labels only express list position.',
      sectionRhythm: 'Ruled rows and a margin track give the page a learning-log cadence; preserve sectionOrder and omit hidden or empty sections.',
      typography: 'Readable proportional sans-serif for all body text and headings; monospace is restricted to small index and metadata labels.',
      imageTreatment: 'ProfileDocument has no image field. Use paper rules only—no screenshots, code blocks, fabricated commands, dates, logs, or output.',
      spacing: 'Keep a fluid page measure, generous row padding, and a stable margin gutter; long technical tokens wrap instead of widening the paper.',
      decoration: 'Subtle rules and a single margin line; do not emulate a black screen, cursor, status light, or system output.',
      mobileTransformation: 'Retain ruled-paper cues while narrowing the margin gutter and stacking every entry; never require fixed-width or horizontal scrolling.',
      interaction: 'Anchors and external links are keyboard operable and visibly focused; no command or hover is needed to reveal content.',
    },
    structuralAudit: {
      closestId: 'arcade', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Notebook uses a pale ruled-paper page, sans-serif prose, a linked written index, and build entries without project art. Arcade is a dark framed cabinet with monospaced display, a screen-bound index, and pixel-grid project marks. Paper texture, text treatment, and entry structure remain distinct in grayscale.',
    },
  },
  {
    id: 'blueprint', name: 'Blueprint / workshop', category: 'Technical', layout: 'blueprint',
    description: 'A technical drafting sheet with a measured grid and abstract line diagrams.',
    artDirection: {
      positioning: 'A drafting-sheet/workshop aesthetic for the supplied profile, without implying engineering credentials, measurements, or specifications.',
      composition: 'A pale drawing-board grid, name-and-focus header, separate reserved line-art panel, numbered index, and a two-column note grid; Projects expand into horizontal records.',
      navigation: 'A numbered horizontal drawing index links to visible populated sections only; it is a row of real anchors, not a toolbar or dashboard control.',
      hero: 'The actual name leads; the supplied role or learning line provides focus. Abstract vector linework sits in its own framed area and never overlays text.',
      projects: 'Each actual project remains a text-first record with supplied title, description, tools, and safe link. Repeated abstract line diagrams are decorative only—not screenshots, technical drawings, measurements, annotations, or project evidence.',
      sectionRhythm: 'Compact two-column note sections follow DesignConfig order exactly; the Projects section spans the sheet where it occurs in that order. Empty and hidden sections disappear.',
      typography: 'Readable sans-serif body and headings; monospaced accents are limited to ordinal labels and never carry essential information.',
      imageTreatment: 'ProfileDocument has no image field. Inline SVG paths are explicitly aria-hidden decorative diagrams, with no labels, numbers, dimensions, or implied specifications.',
      spacing: 'Fine drafting lines organize the page without reducing the text measure; reserve a distinct diagram area and allow long names and paragraphs to wrap.',
      decoration: 'A restrained 24-unit grid with a lighter major interval and abstract linework only; no terminal, code, gauges, status widgets, fake measurements, or revision marks.',
      mobileTransformation: 'Collapse the note grid and project records into one readable column; keep diagrams in their own bounded area, then preserve text and link order with 44px targets.',
      interaction: 'Visible same-page anchors and safe external links work by keyboard; focus is explicit, motion is nonessential, and decoration is hidden from assistive technology.',
    },
    structuralAudit: {
      closestId: 'terminal', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Notebook, Blueprint uses a measured drafting grid, a separate abstract vector panel, a two-column note grid with a full-width Projects row, and diagram-led project records. Notebook uses a ruled page and margin gutter, a serial label/content rhythm, and text-only project notes; the layouts remain distinct in grayscale.',
    },
  },
  {
    id: 'bauhaus', name: 'Bauhaus / geometric', category: 'Creative', layout: 'bauhaus',
    description: 'Balanced circles, rectangles, and lines frame a clear content grid.',
    artDirection: {
      positioning: 'A geometric design-study portfolio that organizes real profile content without suggesting an unsupported professional background.',
      composition: 'A balanced split hero places identity and an abstract shape study in separate columns; a twelve-track modular grid gives the supporting sections measured alignment and whitespace.',
      navigation: 'A numbered row of real anchors sits between the hero and content; shapes remain noninteractive and never masquerade as controls.',
      hero: 'The owner’s name and supplied role or learning line share the lead with a bounded composition that stays separate from the text.',
      projects: 'Actual projects appear as paired entries: a small geometric study beside the supplied title, description, tools, and valid link. Shapes frame content; they never overlap it or stand in for a project image.',
      sectionRhythm: 'Balanced, open modules and thin rules follow the visible DesignConfig order; Projects occupy the full grid width at their configured position.',
      typography: 'Confident sans-serif identity and headings with readable, uncompressed body text and strong contrast.',
      imageTreatment: 'The profile schema has no image field. CSS circles, squares, and bars are isolated aria-hidden decoration, not screenshots or artwork.',
      spacing: 'Reserve a separate artboard for shapes, keep text panels open, and scale decoration—not type—down on narrow screens.',
      decoration: 'A limited red, blue, yellow, and ink palette applied to disciplined geometry; no heavy offset shadows, raw Neo-brutalism, or unsupported numeric/status marks.',
      mobileTransformation: 'Narrow layouts stack project entries and collapse the modular section grid to one column; hero shapes remain in their own smaller frame with no overlap.',
      interaction: 'Semantic section anchors and safe project links remain keyboard-operable with visible focus; decoration has no hover or interactive behavior.',
    },
    structuralAudit: {
      closestId: 'brutalist', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Neo-brutalist, Bauhaus uses a balanced twelve-track section grid, a separate contained shape artboard, and a numbered index between hero and content. Projects are two-up rows with small reserved geometric marks; Neo-brutalist uses heavy outlines, offset shadows, and large block cards. The distinction persists in grayscale.',
    },
  },
  {
    id: 'y2k', name: 'Y2K / internet diary', category: 'Creative', layout: 'y2k',
    description: 'A fluid personal-web diary framed by real, accessible section tabs.',
    artDirection: {
      positioning: 'A playful personal digital-web environment with early-web character, not generic glassmorphism, a game screen, or an assumed online identity.',
      composition: 'A fluid framed page with a simple static title strip, identity panel, tab-like anchor row, then a single vertical stream of readable sections and project notes.',
      navigation: 'Every tab is a real same-page anchor to visible content; the title strip contains no faux close/minimize controls or other fake browser actions.',
      hero: 'A friendly greeting uses the real name and supplied role or learning line; no invented handle, online status, date, or “currently listening” state.',
      projects: 'Actual projects remain full-width diary entries with their supplied text and optional safe link; a tiny star mark is decorative, not a screenshot or project preview.',
      sectionRhythm: 'Dashed separators and open rows create an informal diary cadence while preserving exact DesignConfig order and omitting hidden or empty sections.',
      typography: 'Playful but sturdy sans-serif headings and body text with comfortable line-height; decorative tracking stays limited to short labels.',
      imageTreatment: 'There is no user image field. Simple CSS stars and a flat color panel are aria-hidden decoration; no glass panels, mock browser chrome, or faux pixel screenshot.',
      spacing: 'Keep generous space inside the page frame, readable one-column copy, and wrap long names, URLs, and project titles.',
      decoration: 'Solid pastel-web colors, small star marks, and an understated page frame; no blinking, marquee, terminal effects, or hover-dependent content.',
      mobileTransformation: 'The page becomes an ordinary one-column layout; tabs wrap as links, project marks shrink, and all text and content remain in source order.',
      interaction: 'Section tabs and external project URLs are genuine keyboard-operable links with visible focus; reduced motion is respected and no control is simulated.',
    },
    structuralAudit: {
      closestId: 'pinboard', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Pinboard, Y2K uses a contained early-web page frame, true horizontal anchor tabs, a name-led greeting, and one-column dashed diary rows with small abstract star marks. Pinboard uses a physical-board composition with offset paper notes and variable project cards. Their geometry, project arrangement, and interaction cues remain distinct in grayscale.',
    },
  },
  {
    id: 'pastel', name: 'Soft pastel / friendly', category: 'Personal', layout: 'pastel',
    description: 'Warm, readable modules with simple color and generous spacing.',
    artDirection: {
      positioning: 'An approachable, adult-friendly personal portfolio that feels warm without infantilizing the owner or assuming their personality.',
      composition: 'A contained identity hero precedes softly tinted two-column content modules; Projects use a restrained two-up card layout, with all sections in configured order.',
      navigation: 'A clear header row uses readable, pill-shaped anchors to visible populated sections; every pill remains a real link with a clear focus state.',
      hero: 'The real name is introduced plainly; any supplied role or learning line stays readable and primary, with abstract shapes in a separate reserved area.',
      projects: 'Each real project shows supplied title, description, tools, and optional valid link inside a calm rounded card; no fabricated work or generated image.',
      sectionRhythm: 'Consistent softly grouped modules are spaced rather than crowded; hidden and empty optional sections leave no decorative placeholders.',
      typography: 'Neutral readable sans-serif with restrained display weight, comfortable line-height, and ink colors dark enough for contrast.',
      imageTreatment: 'No image field exists. A few simple circles and rounded rectangles are aria-hidden decoration, not botanical illustration, project imagery, or user-supplied art.',
      spacing: 'Comfortable card padding and stable gutters; preserve long text and 44px anchor/link targets instead of shrinking copy.',
      decoration: 'Limited soft color fields and simple geometry only; no leaf motifs, SaaS widgets, hover-dependent information, or childish stickers.',
      mobileTransformation: 'Collapse every module and project card into one column, reduce only the decorative footprint, and preserve text, focus, and link sizes.',
      interaction: 'Semantic anchors and external links remain visible without hover; focus is clear against every pastel surface and motion is nonessential.',
    },
    structuralAudit: {
      closestId: 'botanical', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Botanical, Pastel uses a two-column grid of softly filled modules, a header-level pill-link row, a greeting hero with separate simple geometry, and two-up project cards. Botanical is a single journal stream with a line-art plant, post-hero navigation, and open vertical project records. Layout and project cadence stay distinct in grayscale.',
    },
  },
  {
    id: 'academic', name: 'Academic / reading room', category: 'Editorial', layout: 'academic',
    description: 'A narrow, serif-led reading page with a compact linked contents list.',
    artDirection: {
      positioning: 'A formal reading page for only the coursework, projects, and profile details the owner supplies; it does not imply scholarship or credentials.',
      composition: 'A centered, narrow reading measure begins with a quiet nameplate, then a compact Contents row and formal, text-first essay/project entries.',
      navigation: 'A compact, wrapping contents list contains numbered real anchors to visible populated sections; it follows the header rather than forming a sidebar.',
      hero: 'The actual name and supplied role or learning context lead; location appears only when present. Never add an institution, degree, date, research claim, or award.',
      projects: 'Each supplied project uses a formal prose entry with actual title, description, tools, and optional safe link; no fabricated citation, publication, credential, or screenshot.',
      sectionRhythm: 'Single-column reading sections use a steady heading-and-prose hierarchy in DesignConfig order; Projects remain text-led and plainly labeled.',
      typography: 'Comfortable serif-led paragraphs and headings paired with a clear sans-serif utility face; essential labels are never tiny footnotes.',
      imageTreatment: 'The schema has no image field. Use no book covers, article scans, research figures, or faux citations; restrained rules provide structure.',
      spacing: 'Keep paragraphs at a comfortable reading width with generous leading and clear section breaks; let long names and project titles wrap.',
      decoration: 'Fine rules and legible ordinal labels only; no fake page counts, publication metadata, institution seals, or scholarly apparatus.',
      mobileTransformation: 'Keep the same single-column essay order, wrap the contents links, and maintain readable body text and touch-sized anchors.',
      interaction: 'Contents and project links are genuine keyboard-operable anchors with visible focus; no essential claim is hidden in hover text or footnotes.',
    },
    structuralAudit: {
      closestId: 'newsprint', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Newsprint, Academic is a narrow text-first reading column with a horizontal compact Contents list and prose project entries. Newsprint uses a broader editorial sheet, column-based contents/section layout, and decorative project art. The different grid, entry treatment, and navigation remain clear in grayscale and avoid the ruled Notebook treatment.',
    },
  },
  {
    id: 'zine', name: 'Cut-and-paste / zine', category: 'Creative', layout: 'zine',
    description: 'A handmade collage rhythm with intentionally ordered, readable content.',
    artDirection: {
      positioning: 'Controlled cut-and-paste character for real personal work, distinct from an organized pinboard or polished magazine spread.',
      composition: 'A clear masthead and linear section sequence; paper marks stay in reserved decorative areas and never cover content or focus.',
      navigation: 'A visible, keyboard-accessible row of same-page anchors; every target follows the saved section order and visibility.',
      hero: 'The supplied name and role or learning statement lead; stamp-like geometry is decoration, not a fictional publication identity.',
      projects: 'Each entry contains only its supplied title, description, tools, and link, paired with labeled abstract cut-paper shapes.',
      sectionRhythm: 'Sequential ruled sections with a narrow category rail; never a tiled pinboard or multi-column editorial grid.',
      typography: 'Restrained serif display with plain high-contrast body copy; expressive texture comes from paper edges and isolated shapes.',
      imageTreatment: 'The schema has no project image field. Cut-paper geometry is explicitly decorative and never pretends to be a project visual.',
      spacing: 'Keep all text, links, and focus outside decoration; long strings wrap and project copy has an unrotated paper panel.',
      decoration: 'Small stamps, tape and offset paper edges remain clipped to their art slot; no text-bearing panel overlaps another.',
      mobileTransformation: 'Stack art above copy in source order, remove rotations, simplify the marks, and prevent horizontal overflow.',
      interaction: 'Real links only, clear underlines and focus rings; decoration has no hover-only or interactive meaning.',
    },
    structuralAudit: {
      closestId: 'pinboard', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Against Pinboard, Zine uses sequential ruled sections and one-column art-and-copy project entries instead of a 12-column corkboard with pinned two-column tiles. Its masthead and nav are stacked rather than embedded in a board identity row; project paper marks are contained beside copy, not pinned-card decorations. These layout, navigation, hero, project, and rhythm differences remain visible without color.',
    },
  },
  {
    id: 'documentary', name: 'Documentary / photo essay', category: 'Visual', layout: 'documentary',
    description: 'A linear visual narrative using only real profile facts and labeled abstract art.',
    artDirection: {
      positioning: 'A documentary-inspired sequence for supplied projects and observations; never imply photographs, events, dates, or places that were not provided.',
      composition: 'A concise identity opener and restrained contents rail lead into a vertical sequence of paired abstract frames and readable captions.',
      navigation: 'A quiet, indexed contents list targets only visible sections in their saved order; every anchor is an explicit link.',
      hero: 'The real owner name and supplied role or learning statement lead; no simulated cover photo or fictional event framing.',
      projects: 'Each sequential entry shows only its supplied title, description, tools, and link beside a labeled abstract decorative panel.',
      sectionRhythm: 'Linear essay-like sections with generous intervals; no gallery mosaic, carousel, or hover-only caption.',
      typography: 'Readable neutral type for identity and clear caption hierarchy; body copy remains comfortably sized.',
      imageTreatment: 'ProfileDocument has no image fields. Every geometric panel is visibly labeled abstract decoration and excluded from the accessibility tree; no photography is fabricated.',
      spacing: 'Give each frame and its adjacent caption room to breathe while keeping copy and controls in a readable measure.',
      decoration: 'Use geometric, non-photographic forms only; decorative frames do not suggest a location, person, or project screenshot.',
      mobileTransformation: 'Stack each frame before its caption in source order, use a single column, and let long text wrap.',
      interaction: 'Contents anchors and project links are keyboard operable with visible focus; no hover-only meaning or motion-dependent content.',
    },
    structuralAudit: {
      closestId: 'gallery', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Compared with Gallery, Documentary places its contents rail beside the identity opener and uses numbered linear sections with side-by-side frame/caption project pairs on desktop. Gallery presents an open exhibition header, a horizontal index, and full-width art above caption text with staggered artwork. Documentary stacks each pair on mobile and uses labeled decoration rather than implying documentary photographs.',
    },
  },
  {
    id: 'community', name: 'Community / local impact', category: 'Personal', layout: 'community',
    description: 'A warm, contribution-led profile built only from supplied facts.',
    artDirection: {
      positioning: 'A human, action-led presentation of real profile details without assuming a community, mission, identity, leadership role, or local affiliation.',
      composition: 'Owner identity leads into a readable sequence; supplied highlights and activities receive room without dashboard cards or social counters.',
      navigation: 'A plain row of semantic anchors to visible sections, preserving configured order and omitting hidden Projects.',
      hero: 'Show the real name and only the supplied role or learning statement; do not imply organizer, volunteer, or beneficiary status.',
      projects: 'Keep real projects as a simple linear list of supplied title, description, tools, and link; no invented outcomes or people.',
      sectionRhythm: 'Use warm, legible contribution rows and preserve the saved order instead of making a nonprofit landing page or social feed.',
      typography: 'Humanist serif headings with clear, accessible body text and strong contrast.',
      imageTreatment: 'No image fields exist. Keep contributions and projects text-led; never use fabricated event or community photography.',
      spacing: 'Let long activities and project descriptions wrap at a comfortable measure without clipping.',
      decoration: 'Restrained paper-toned rules only; no badges, impact seals, metrics, testimonials, or engagement counts.',
      mobileTransformation: 'Stack contribution metadata and text, keep projects linear, and retain all contact links at touch-friendly sizes.',
      interaction: 'Use only real anchors and supplied contact/project links; keyboard focus stays visible and no information appears only on hover.',
    },
    structuralAudit: {
      closestId: 'project', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Compared with Project-focused, Community uses a name-first profile header and configured section navigation rather than a project-led hero with a Work shortcut. Supplied highlights/activities become labeled linear contribution rows, projects are text-only entries without abstract screenshot-like art, and every section follows saved order. The contrast remains in grayscale and does not rely on color or social metrics.',
    },
  },
  {
    id: 'case-study', name: 'Product case study', category: 'Technical', layout: 'case-study',
    description: 'A project-first presentation grounded in the supplied project fields.',
    artDirection: {
      positioning: 'Lead with the first supplied project when Projects is visible; never imply a complete process, measured result, or missing project detail.',
      composition: 'A large project-title lead with a compact facts column, followed by sections in configured order and a linear project record list.',
      navigation: 'A restrained, indexed contents row links only to visible sections; an empty but visible Projects section remains navigable.',
      hero: 'Use the real first project title and description as the lead. If Projects is hidden or empty, use a profile lead instead.',
      projects: 'Show only actual title, description, tools, and link. Feature the first project and label later supplied entries as supporting work; invent no process stages.',
      sectionRhythm: 'Keep the configured Projects position intact; other profile sections remain in their saved order and visibility.',
      typography: 'Project-first serif display with readable body copy and adjacent real tools/link details; no tiny labels as sole evidence.',
      imageTreatment: 'The schema has no project image field. Use no screenshots, fake UI, research imagery, or decorative diagram presented as evidence.',
      spacing: 'Allow long titles and descriptions generous space; facts stack beside the feature on desktop and below it on mobile.',
      decoration: 'Use rules and whitespace only; avoid fabricated Context, Approach, Decisions, Results, roles, outcomes, and metrics.',
      mobileTransformation: 'Stack the project lead and facts in reading order, keep all supplied projects, and wrap long content without overflow.',
      interaction: 'Semantic section anchors, valid project links, clear keyboard focus, and no hover-only evidence or motion-dependent cues.',
    },
    structuralAudit: {
      closestId: 'project', changedDimensions: ['grid', 'navigation', 'hero', 'projects', 'section rhythm', 'image treatment'], visibleDifferences: ['layout', 'hero', 'navigation', 'projects'],
      evidence: 'Compared with Project-focused, Case Study gives the first project title—not the profile name—the lead heading, places only real tools/link facts in a separate column, and uses an indexed contents row instead of a Work shortcut. Its configured Projects section is a one-column record list rather than a featured abstract-art panel plus two-column archive. It uses no project art or screenshot, so the first entry is not reduced to an archive tile; these differences survive grayscale.',
    },
  },
] as const;

export const ADDITIONAL_TEMPLATE_IDS = TEMPLATE_CATALOG.filter((template) => !template.featured).map((template) => template.id);
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ['Editorial', 'Visual', 'Technical', 'Creative', 'Personal'];

export function getTemplateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATE_CATALOG.find((template) => template.id === id) ?? TEMPLATE_CATALOG[0];
}

export function getStructuralAuditCounts(template: TemplateMeta) {
  return {
    structural: template.structuralAudit.changedDimensions.length,
    visible: template.structuralAudit.visibleDifferences.length,
    passes: template.structuralAudit.changedDimensions.length >= 4 && template.structuralAudit.visibleDifferences.length >= 3,
  };
}
