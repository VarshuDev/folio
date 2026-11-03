<p align="center">
  <a href="https://github.com/VarshuDev/folio">
    <img src="assets/hero-banner.svg" alt="Folio Studio &amp; Publishing Engine Header" width="100%" />
  </a>
</p>

<p align="center">
  <strong>An opinionated personal portfolio studio, aesthetic compiler, and zero-dependency static engine.</strong>
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.3%20(Turbopack)-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19.1-23272f?style=for-the-badge&logo=react&logoColor=61dafb" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Backend-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://vercel.com"><img src="https://img.shields.io/badge/Vercel-REST%20Automated%20Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-purple?style=for-the-badge" alt="License MIT" /></a>
</p>

<p align="center">
  <a href="#-quickstart">⚡ Quickstart</a> •
  <a href="#-22-handcrafted-art-directions">🎨 22 Art Directions</a> •
  <a href="#-compiler-pipeline--architecture">🧬 Architecture</a> •
  <a href="#-zero-lock-in-compilation-targets">📦 Export Engine</a> •
  <a href="#-privacy-first-cookieless-telemetry">🔒 Privacy Spec</a> •
  <a href="#-test-suite--rigor">🧪 Test Suite</a>
</p>

---

## ⚡ Why Folio?

Most modern portfolio solutions force developers into one of two compromises: **cookie-cutter templates** that look like generic SaaS marketing pages, or **proprietary hosting lock-ins** that inject invasive tracking scripts, pop-up consent banners, and recurring subscriptions.

**Folio is engineered differently:**

1. **22 Expressive Art Directions**: From Swiss Modernism to Cyberpunk Arcade, Neo-Brutalism, and Technical Blueprints. Every style is a complete, structural design paradigm—not just an interchangeable color swap.
2. **Zero-Lock-In Static Compiler**: Compile your portfolio into a **single 48KB offline HTML file** with inlined CSS, a static ZIP bundle for GitHub Pages/Netlify, or a fully scaffolded Next.js 16 multi-page application.
3. **Cryptographic Cookieless Analytics**: Measure real visitor engagement without dropping a single cookie, storing an IP address, or displaying a GDPR cookie banner.
4. **Headless Vercel REST Deployment**: Connect directly to Vercel via pure REST API endpoints with SHA-1 asset deduplication. No intermediate GitHub repository required unless you want one.
5. **Grounded AI Copy Assistance**: Intelligent, non-hallucinatory bio and project polish powered by Google Gemini, enforced by strict review boundaries.

---

## 🧬 Compiler Pipeline & Architecture

Folio operates as an end-to-end compilation pipeline. The diagram below illustrates how creator data flows from the visual studio into compiled static artifacts and edge distribution:

<p align="center">
  <img src="assets/pipeline.svg" alt="Folio Compilation and Distribution Pipeline" width="100%" />
</p>

```
  ┌──────────────────────┐       ┌────────────────────────┐       ┌──────────────────────┐
  │   Creator Intake     │  ───► │  Style & Core Engine   │  ───► │  Distribution Edge   │
  │                      │       │                        │       │                      │
  │ • Visual Studio UI   │       │ • 22 Structural Themes │       │ • 48KB Offline HTML  │
  │ • Dual Builder Modes │       │ • GF(2^8) Reed-Solomon │       │ • Static Drop ZIP    │
  │ • Gemini AI Polish   │       │ • Dynamic next/og SVG  │       │ • Vercel REST Deploy │
  │ • Draft Auto-Save    │       │ • HMAC SHA-256 Hasher  │       │ • Custom Domains     │
  └──────────────────────┘       └────────────────────────┘       └──────────────────────┘
```

---

## 🎨 22 Handcrafted Art Directions

Folio rejects homogenous design. Each theme represents an intentional visual philosophy with distinct layout rhythms, custom typographic pairings, and bespoke micro-interactions:

<table align="center" width="100%">
  <tr>
    <td width="50%" align="center">
      <strong>📰 Editorial Minimalist</strong><br>
      <em>Asymmetric contents rail, literary hierarchy, quiet pacing.</em><br><br>
      <img src="qa-5a-editorial-desktop.png" alt="Editorial Theme" width="100%" />
    </td>
    <td width="50%" align="center">
      <strong>🕹️ Arcade &amp; Cyberpunk</strong><br>
      <em>High-contrast neon accents, glowing status grid, phosphor glow.</em><br><br>
      <img src="qa-5b-arcade-desktop.png" alt="Arcade Cyberpunk Theme" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>🇨🇭 Swiss Modernist</strong><br>
      <em>Strict typographic grid, bold sans-serif, asymmetric weight.</em><br><br>
      <img src="qa-5b-swiss-desktop.png" alt="Swiss Modernist Theme" width="100%" />
    </td>
    <td width="50%" align="center">
      <strong>💻 Terminal CLI</strong><br>
      <em>Monospace hierarchy, green phosphor styling, ASCII accents.</em><br><br>
      <img src="qa-5c-terminal-desktop.png" alt="Terminal CLI Theme" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>📐 Technical Blueprint</strong><br>
      <em>Engineering cad-lines, cyan drafting grid, measurement markers.</em><br><br>
      <img src="qa-5d-blueprint-desktop.png" alt="Blueprint Theme" width="100%" />
    </td>
    <td width="50%" align="center">
      <strong>⚡ Neo-Brutalist</strong><br>
      <em>High-impact borders, hard offset drop shadows, expressive contrast.</em><br><br>
      <img src="qa-5c-brutalist-desktop.png" alt="Neo-Brutalist Theme" width="100%" />
    </td>
  </tr>
</table>

<details>
<summary><strong>🔍 Click to expand the full 22-Theme Catalog &amp; Typography Specs</strong></summary>
<br>

| Theme ID | Name | Category | Primary Mood &amp; Philosophy | Layout Archetype |
| :--- | :--- | :--- | :--- | :--- |
| `minimal` | **Minimal** | Recommended | Distraction-free, centered reading measure, quiet rules | Single Column Classic |
| `editorial` | **Editorial** | Recommended | Magazine contents rail, rich long-form storytelling | Asymmetric Split |
| `project` | **Project** | Recommended | Visual card showcase for high-volume makers | Responsive Grid |
| `swiss` | **Swiss** | Recommended | International Typographic Style, mathematical grids | Geometric Structured |
| `arcade` | **Arcade** | Creative | CRT scanlines, 80s arcade aesthetics, neon borders | High-Contrast Dark |
| `after-hours` | **After Hours** | Creative | Midnight jazz lounge vibes, moody indigo gradients | Fluid Ambient |
| `terminal` | **Terminal** | Technical | Hacker / sysadmin CLI prompt with monospace hierarchy | Monospace Terminal |
| `blueprint` | **Blueprint** | Technical | Architectural schematic with drafting lines and grid | CAD Grid |
| `brutalist` | **Brutalist** | Visual | Raw neo-brutalism, 3px solid black borders, hard drop shadows | Offset Block Grid |
| `bauhaus` | **Bauhaus** | Visual | Primary color geometry, constructivist layout | Asymmetric Bauhaus |
| `gallery` | **Gallery** | Visual | Museum exhibition catalog, whitespace-focused | Curated Exhibition |
| `botanical` | **Botanical** | Personal | Earthy organic tones, serif headers, peaceful rhythm | Warm Organic |
| `pastel` | **Pastel** | Personal | Soft vapor aesthetics, pill navigation, playful cards | Rounded Modern |
| `y2k` | **Y2K** | Creative | Early 2000s cyber web, iridescent chrome gradients | Nostalgic Cyber |
| `retro` | **Retro** | Creative | 1970s warm print press, retro typography | Vintage Print |
| `pinboard` | **Pinboard** | Personal | Physical corkboard layout with pinned notes &amp; index cards | Freeform Pinboard |
| `newsprint` | **Newsprint** | Editorial | Broadside newspaper columns with serif body text | Multi-Column Press |
| `academic` | **Academic** | Editorial | Clean LaTeX paper aesthetic with citation anchors | Scholarly Monograph |
| `zine` | **Zine** | Creative | Indie photocopied DIY zine, rotated stamps &amp; badges | Punk Collage |
| `documentary`| **Documentary** | Personal | Cinematic photography portfolio with widescreen headers | Filmstrip Focus |
| `community` | **Community** | Personal | Open-source advocate layout with social links front &amp; center | Social Networked |
| `case-study` | **Case Study** | Recommended | In-depth engineering problem/solution breakdown | Deep-Dive Narrative |

</details>

---

## 📦 Zero-Lock-In Compilation Targets

Folio guarantees complete ownership of your work. You can export or deploy your portfolio through three distinct compilation targets:

```
                  ┌──────────────────────────────────────────────┐
                  │           FOLIO PROFILE SPEC                 │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┼──────────────────────┐
                 ▼                       ▼                      ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │  Single-File HTML   │ │   Static Drop ZIP   │ │  Next.js 16 Project │
      │                     │ │                     │ │                     │
      │ • 48KB total weight │ │ • Drag & Drop ready │ │ • Multi-page routes │
      │ • Inlined SVG & CSS │ │ • GitHub Pages      │ │ • Dynamic OG images │
      │ • 100% offline-ready│ │ • Netlify / Cloudfl.│ │ • Full source code  │
      └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

1. **48KB Standalone Single-File HTML**:
   - Zero external scripts, zero external font stylesheets, zero CDN dependencies.
   - All styles, vector icons, and layout structures are inlined directly into a single self-contained `.html` file.
   - Runs instantly from a local USB drive, email attachment, or local preview.

2. **Static Drop ZIP Archive**:
   - Pre-bundled with `index.html`, responsive styling, and an automated deployment `README.md`.
   - Ready for instant drag-and-drop hosting on **GitHub Pages**, **Netlify Drop**, or **Cloudflare Pages**.

3. **Full Next.js 16 (Turbopack) Application**:
   - Compiles a complete, standalone TypeScript project with route handlers, dynamic `next/og` OpenGraph cards, and contact form handling.
   - Fully decoupled from Folio—host anywhere that runs Node.js or edge servers.

---

## 🔒 Privacy-First Cookieless Telemetry

Unlike traditional analytics platforms that rely on invasive third-party cookies and persistent cross-site tracking, Folio incorporates a **zero-cookie, privacy-first telemetry engine**:

$$\text{Visitor Token} = \operatorname{HMAC-SHA256}\Big(\text{Salt}_{\text{daily}},\; \text{IP Address} \;\parallel\; \text{User-Agent}\Big)$$

- **Zero Cookie Banners Required**: Because no identifier is written to the visitor's device, your portfolio is 100% compliant with GDPR, ePrivacy, and CCPA out of the box.
- **Daily Salt Rotation**: Telemetry salts rotate every 24 hours. A visitor today cannot be tracked or correlated against their visit tomorrow.
- **Zero Raw Data Persistence**: IP addresses and raw user-agent strings are strictly hashed in memory and immediately discarded. Never written to disk or database.
- **Metrics Tracked**: Total pageviews, daily unique visitors, normalized referrers (GitHub, X/Twitter, LinkedIn, Direct), and outbound link click counts.

---

## 🤖 Grounded AI Copy Assistance

Folio includes an integrated copy refinement assistant powered by **Google Gemini**, engineered with strict anti-hallucination boundaries:

- **Bounded Action Contracts**: The assistant is constrained to exactly three operations:
  - `Make clearer` (eliminates jargon, improves cadence)
  - `Shorten` (condenses text for mobile viewports)
  - `Make more professional` (polishes tone for hiring managers)
- **Factual Grounding Defense**: Prompts are strictly bounded to the factual context supplied by the creator. The model is forbidden from inventing company names, dates, or credentials.
- **Mandatory Human-in-the-Loop**: Every AI suggestion is presented as an interactive diff with explicit **Accept**, **Edit**, or **Dismiss** controls.

---

## 📱 Pure TypeScript Vector QR Engine

Folio features an internal, zero-dependency QR code generator built entirely in TypeScript:

- Compliant with the **ISO/IEC 18004** international standard.
- Implements Galois Field $\text{GF}(2^8)$ polynomial mathematics for Reed-Solomon error correction.
- Emits high-contrast, mathematically pure **SVG vector graphics** with customizable foreground and background tones.
- Zero client-side canvas dependencies; 100% server-side and static compile compatible.

---

## 🚀 Headless Vercel Deployment

Deploy directly to your custom production domain on Vercel with zero friction:

```
[ Folio Studio ] ───( SHA-1 Digest )───► [ POST /v2/files ] ───► [ POST /v13/deployments ] ───► [ Live Edge URL ]
```

- **Direct REST Integration**: Uses Vercel's Files API (`POST /v2/files`) and Deployments API (`POST /v13/deployments`) with SHA-1 asset deduplication.
- **No Git Repository Required**: Deploys project file trees directly into Vercel's build pipeline without requiring write access to your GitHub account.
- **Strict Server Secret Boundary**: OAuth tokens, client secrets, and deployment tokens remain strictly isolated on server-side endpoints and are never sent to the browser.

---

## ⚡ Quickstart

### Prerequisites
- **Node.js** 20.0 or higher
- **npm** or **pnpm**

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/VarshuDev/folio.git

# Enter the project directory
cd folio

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

*(Optional: Fill in Supabase or Gemini keys in `.env.local`. If left blank, Folio seamlessly runs in local memory mode with browser-persisted drafts!)*

### 3. Launch Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:

- **Studio Builder**: `http://localhost:3000/studio`
- **Visual QA Theme Showcase**: `http://localhost:3000/template-demos`
- **Account & Messages Inbox**: `http://localhost:3000/account`
- **Public Portfolio Route**: `http://localhost:3000/p/[slug]`

---

## 🧪 Test Suite & Rigor

Folio is backed by an automated test suite verifying compilers, security boundaries, and rendering engines:

```bash
# Run the complete test suite (180+ tests)
npm test

# Run TypeScript typecheck
npm run typecheck

# Run Turbopack production build
npm run build
```

| Engine Under Test | Test Command | Verification Scope |
| :--- | :--- | :--- |
| **Publishing & Deploy** | `npm run test:publishing` | Slug sanitization, OAuth replay protection, Vercel REST payload validation |
| **AI Boundaries** | `npm run test:ai` | Prompt injection defense, hallucination prevention, diff merging |
| **Export Compiler** | `npm run test:export` | IEEE 802.3 CRC-32 integrity, PKZIP Deflate format, standalone HTML |
| **Cookieless Analytics**| `npm run test:analytics` | Salt rotation lifecycle, hash collision prevention, zero IP leakage |
| **Vector QR Engine** | `npm run test:qr` | Galois Field $\text{GF}(2^8)$ polynomials, version matrices, clean SVG paths |
| **Contact Honeypot** | `npm run test:contact` | Honeypot trap triggers, sliding-window rate limiters, message isolation |
| **Dev Credits Ledger** | `npm run test:credits` | Ledger immutability, idempotent balance constraints |

---

## 🛡️ Security & Integrity

- **Zero Plaintext Secrets**: All sensitive secrets (`SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_CLIENT_SECRET`) are enforced server-only.
- **Bot Honeypot Defense**: Public portfolio contact endpoints feature silent honeypots (`hp_company`) and IP sliding-window limiters (maximum 3 messages per hour).
- **Subresource Integrity**: Exported HTML bundles use zero external dependencies, neutralizing third-party supply-chain attacks.

---

## 👨‍💻 Author & Credits

Engineered and maintained with care by **[VarshuDev](https://github.com/VarshuDev)**.

If you find Folio useful for your developer portfolio, consider starring ⭐ the repository!

Released under the **[MIT License](LICENSE)**.
