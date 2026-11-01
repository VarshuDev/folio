# Folio — Portfolio Studio & Publishing Platform

Folio is a modern personal portfolio studio and deployment engine built with Next.js 16 (Turbopack), TypeScript, and Supabase. It offers a dual-mode workflow (Simple 22-theme builder and Advanced multi-page Next.js app generator) alongside zero lock-in code export, social sharing, privacy-friendly analytics, direct lead capture, and automated Vercel deployment.

For an in-depth architectural breakdown of every engine, data flow, and test suite, see the [Architecture Walkthrough](docs/architecture-walkthrough.md).

---

## Features

- **22 Art Directions**: 22 distinctive, handcrafted visual themes selectable in real-time, with an interactive visual QA gallery at `/template-demos`.
- **Dual Portfolio Modes**:
  - **Simple Mode**: Instant single-page portfolio with responsive theme rendering, customizable typography, and live preview.
  - **Advanced Mode**: Multi-page Next.js portfolio project generator with dedicated projects, writing, and contact sections.
- **AI Copy Assistance (Gemini)**:
  - Contextual copy improvements for About and project descriptions with 3 bounded actions: *Make clearer*, *Shorten*, and *Make more professional*.
  - Strict factual grounding and anti-hallucination boundaries; mandatory creator review (*Accept*, *Edit*, *Dismiss*).
  - Note extraction for converting raw notes into structured profile suggestions.
- **Privacy-Friendly Visitor Analytics**:
  - Cookieless telemetry using daily-rotated salted SHA-256 HMAC hashing of IP, User-Agent, and date.
  - Raw IP addresses and user agents are never stored in the database.
  - Creator dashboard in `/account` with total views, unique visitors, normalized referrers, and outbound link click tracking.
- **Interactive Contact & Lead Capture**:
  - Embedded contact form on public portfolios with silent bot honeypot protection (`hp_company`) and sliding-window IP rate limiting (max 3/hour).
  - Creator inbox in `/account` with filtering (*All*, *Unread*, *Archived*), 1-click email replies (`mailto:`), and status controls.
- **Zero Lock-In Code Export**:
  - 1-click standalone single-file HTML export with inlined responsive CSS (offline-ready, zero external dependencies).
  - Static ZIP package (`index.html` + `README.md`) for hosting on GitHub Pages, Netlify Drop, or Cloudflare Pages.
  - Full Next.js standalone project ZIP export for Advanced mode.
- **Vector QR Code Generator**:
  - Pure TypeScript ISO/IEC 18004 vector QR generator with Galois Field $\text{GF}(2^8)$ Reed-Solomon polynomial math and SVG download.
- **Dynamic Social Preview Cards (`next/og`)**:
  - On-the-fly 1200×630 OpenGraph and Twitter cards (`summary_large_image`) with monogram avatars, creator details, and skills clusters.
- **Vercel 1-Click Deployment**:
  - Dual connection support: 1-Click OAuth flow (with CSRF/replay-defended state nonces) and Personal Access Token (PAT) connection.
  - Direct REST deployment via Vercel Files API (`POST /v2/files`) and Deployments API (`POST /v13/deployments`) with SHA-1 deduplication; no GitHub repository creation required.
  - Server-isolated secret boundaries: access tokens and client secrets are never exposed in client API responses.

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation

```bash
git clone https://github.com/VarshuDev/folio.git
cd folio
npm install
```

### Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Studio Editor**: [http://localhost:3000/studio](http://localhost:3000/studio)
- **Theme Showcase**: [http://localhost:3000/template-demos](http://localhost:3000/template-demos)
- **Account & Inbox**: [http://localhost:3000/account](http://localhost:3000/account)
- **Public Portfolio Route**: `http://localhost:3000/p/[slug]`

---

## Environment Configuration

Copy `.env.example` to `.env.local` to configure optional server integrations:

```bash
cp .env.example .env.local
```

### 1. Supabase (Database & Auth)
If omitted, Folio defaults to in-memory repositories and browser-local draft persistence:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-only service role key for publishing, contact storage, and verified server operations. (Never expose with a `NEXT_PUBLIC_` prefix).

### 2. Google Gemini (AI Assistance)
Optional. If unconfigured, the manual review workflow is retained without external API calls:
- `FOLIO_AI_PROVIDER`: Set to `gemini`.
- `FOLIO_AI_API_KEY`: Your Gemini API key from Google AI Studio.
- `FOLIO_AI_MODEL`: Optional model name (defaults to `gemini-3.8-flash`).

### 3. Vercel Integration (1-Click Deployment)
- `VERCEL_CLIENT_ID`: Vercel OAuth application client ID.
- `VERCEL_CLIENT_SECRET`: Vercel OAuth application client secret (server-only).
- `VERCEL_REDIRECT_URI`: OAuth callback URI (e.g. `http://localhost:3000/api/integrations/vercel/callback`).

### 4. Privacy Analytics Salt
- `ANALYTICS_SALT`: Secret salt used in hashing visitor telemetry.

---

## Verification & Testing

Folio includes a comprehensive automated test suite covering all core engines:

```bash
# Run full automated test suite (180 tests)
npm test

# Run TypeScript type check
npm run typecheck

# Run Next.js Turbopack production build
npm run build
```

| Test Suite | Command | Coverage |
| :--- | :--- | :--- |
| **AI Boundaries** | `npm run test:ai` | Request boundaries, prompt injection defense, factual grounding |
| **Publishing & Vercel** | `npm run test:publishing` | Slug validation, RLS snapshot security, OAuth replay defense, Vercel REST deployment |
| **Dev Credits** | `npm run test:credits` | Ledger immutability, idempotent grants, balance constraints |
| **Analytics** | `npm run test:analytics` | Referrer classification, daily salt rotation, zero raw IP leakage |
| **Export Engine** | `npm run test:export` | IEEE 802.3 CRC-32, PKZIP Deflate format, standalone HTML generation |
| **QR Engine** | `npm run test:qr` | Reed-Solomon math, version matrices, SVG output |
| **Contact Engine** | `npm run test:contact` | Honeypot trap, sliding-window rate limit, message CRUD, creator isolation |

---

## Security & Privacy Highlights

- **Server-Only Secret Isolation**: All sensitive credentials (`SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_CLIENT_SECRET`, Vercel access tokens) are strictly stored and accessed within server-only boundaries. Client-facing API endpoints never return access tokens or secret keys.
- **Cookieless Analytics**: Telemetry never uses cookies or localStorage tracking IDs. Visitor hashes rotate daily to avoid longitudinal cross-day profiling.
- **Honeypot & Rate Limiting**: Contact forms are safeguarded by silent bot honeypots and salted SHA-256 sliding-window IP limits (max 3 submissions per hour per portfolio).
- **Zero Lock-In Guarantee**: Creators can export their entire portfolio at any time as clean standalone HTML or complete Next.js projects that run anywhere without Folio dependencies.

---

## 👨‍💻 Author & Credits

Designed, architected, and engineered with precision by **[VarshuDev](https://github.com/VarshuDev)**.

All code and architecture rights reserved. Released under the [MIT License](LICENSE).
