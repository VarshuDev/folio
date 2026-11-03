# Checkpoint 7A — Implementation and verification

**Status:** Complete; stopped for review.  
**Verification date:** 2026-10-04 (Asia/Kolkata)

## What was delivered

Checkpoint 7A adds one narrowly scoped AI capability: turn pasted rough notes into structured portfolio suggestions. The existing flow remains **Tell us → Review → Design → Edit**. Suggestions appear inside the existing `ProfileReview`; there is no AI-only page, step, editor, or chat. Quick-question intake, manual pasted-note intake, browser-local drafts, existing renderers, and the Checkpoint 6 proposal contract remain in place.

No copy rewriting, design-aware writing, resume import, publishing, analytics, billing, chat, autonomous profile edits, or other AI actions were added.

## Provider and configuration

- **Provider:** Google Gemini, using the server-side REST API (`generateContent`) through a native `fetch` adapter. No provider SDK is imported into React/client code.
- **Default model:** `gemini-3.8-flash`; an optional server-side model override is supported.
- **Environment variables:**
  - `FOLIO_AI_PROVIDER=gemini`
  - `FOLIO_AI_API_KEY=<server-side key>`
  - `FOLIO_AI_MODEL=gemini-3.8-flash` (optional; this is the default)
- Keep these values in the server environment or ignored `.env.local`; never add a `NEXT_PUBLIC_` prefix or commit a real key. `.env.example` documents the settings.
- If the provider/key is absent or invalid, `/api/ai` returns a safe unavailable response and the existing manual flow remains usable. Deterministic fixtures are test/development-only, are blocked from the user suggestion UI, and are not enabled in production.
- The REST adapter places the key in the provider request header—not the URL, body, or browser—and sends a JSON-schema-constrained generation request. The Checkpoint 6 server validator remains authoritative.

## Request and response boundary

After explicit consent, the browser sends `POST /api/ai` with exactly `{ "operation": "extract_profile", "sourceText": "…" }`. It does not send the current profile, design, local draft, or other application data. The provider request includes the fixed extraction instructions plus the user’s note as untrusted user content; the user’s existing profile and design are not included.

The API bounds request-body and source sizes, accepts only the supported extraction operation, and uses a bounded provider timeout and response size. Provider JSON is validated server-side for exact allowed profile paths, path-specific value shapes, safe HTTP(S) links, collection limits, provenance, and conservative source grounding. Exact excerpts must occur verbatim in the notes; unsupported claims fail closed. The server replaces model-written explanations with fixed review guidance and downgrades unavailable provenance to low confidence. Provider details and credentials are not returned in errors.

The response contains review-only proposals (with `status: "suggested"` and `needsReview: true`) plus optional clarifying questions—or a sanitized error. Nothing is written to the profile by the API.

## Consent and review behavior

- Before the first provider request, the paste flow explains what draft information is sent, that fixed extraction instructions are also included, and that existing profile/design data are not sent.
- The user can choose **Continue without AI**; browser QA confirmed that this path sends no request.
- The existing ProfileReview shows the suggestion, reason, confidence/uncertainty, and the exact source excerpt when verified. Users must explicitly **Keep**, **Edit**, or **Remove** each suggestion. Source/provenance is retained with approved values where available.
- Existing scalar values are preserved until an explicit decision; replacements warn first. Duplicate list values and normalized equivalent links are suppressed where practical, including links across profile link fields. Possible project duplicates stay visible and are flagged for human review rather than silently discarded.
- Original notes remain available and unchanged through successful review, poor-note responses, provider failures, retries, and manual continuation. Accepted values use the ordinary profile/draft schema consumed by the existing renderers.
- No retention, deletion, or model-training promise is made. Users/operators should review Google’s current provider terms and policies before enabling external processing.

## Verification results

| Check | Result |
|---|---:|
| `npm run typecheck` | Passed |
| `npm run test:ai` | **31/31 passed** |
| `npm run build` | Passed |
| Checkpoint 7A browser flows A–G | **7/7 passed** |
| Checkpoint 7A Axe checks | **0 violations** at desktop and 390px mobile review |
| Checkpoint 7A browser errors | **0** |
| 390px review overflow | None (`scrollWidth` 390px) |
| Checkpoint 6 regressions | **9/9 passed** |
| Checkpoint 6 draft, legacy draft, and manual intake checks | Passed; exact pasted notes retained |
| All 22 style catalog | All 22 present and rendered in the catalog check |
| All-style accessibility run | **44/44** (22 styles × desktop/mobile); 0 WCAG 2.1 A/AA Axe violations; no horizontal overflow; 0 browser errors |
| Checkpoint 5C matrix | **50/50** render cases; 0 failed checks; 0 browser errors |
| Checkpoint 5D matrix | **50/50** render cases; 0 Axe violations; 0 failed checks; 0 browser errors |
| Checkpoint 5E matrix | **40/40** render cases; 0 Axe violations; 0 failed checks; 0 browser errors |
| Production client-bundle secret/config scan | Passed; no forbidden provider keys/config, model identifier, server instructions, or Gemini endpoint/header strings found in `.next/static` JavaScript |

Browser flows specifically covered: (A) consent-gated source-only request, unchanged pre-approval profile, conflict warning, Keep/Edit/Remove, and retained source; (B) no-AI manual continuation with zero requests; (C) retry after provider failure and then manual fallback; (D) poor-note/add-detail/manual fallback; (E) fixture output not presented as AI; (F) unconfigured API returns unavailable; and (G) AI test suite from the browser harness.

**Verification artifacts:** `qa-7a-browser-regression.json`, `qa-6-browser-regression.json`, `qa-7a-style-accessibility.json`, and the Checkpoint 5C/5D/5E browser-matrix JSON files. Re-runnable harnesses are `qa-7a-regression.cjs`, `qa-7a-all-style-accessibility.cjs`, `qa-6-regression.cjs`, and `qa-5c/5d/5e-matrix.cjs`.

## Remaining risks / deployment steps

1. **No live Gemini request was made.** There was no configured key; the provider adapter was tested end-to-end through mocked REST responses and the real validator, not against Google’s live service. Before enabling, configure server-only env values and verify current model availability, structured-output compatibility, quotas, costs, and data terms in the target deployment.
2. **Abuse and cost controls:** the API boundary validates and bounds requests but does not add user authentication or a deployment-wide rate limiter. Add suitable gateway/server rate limiting before exposing a funded provider key publicly.
3. **AI grounding is conservative, not proof of truth.** The source excerpt/token checks prevent many unsupported proposals, but users should still verify meaning and accuracy before keeping anything.
4. **Provider data handling is governed by the provider/account terms.** The app makes no retention, deletion, or training guarantee.

Official references consulted: [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) and [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
