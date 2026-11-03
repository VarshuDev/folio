# Checkpoint 6 — AI Contract + Safe Provider Boundary

**Status:** Complete — architecture and safety only  
**Date:** 2026-10-03

## Scope and outcome

Added a provider-neutral, server-only request/response boundary and a deterministic test-fixture provider. No production provider, model SDK, AI client UI, design-aware copy, or second editor was added. The existing manual **Tell us → Review → Design → Edit** workflow remains the only user-facing path; fixtures are not called by client components and are never presented as AI output.

## Architecture

- `app/api/ai/route.ts` — Node-runtime `POST /api/ai`; bounded JSON-body reader, safe status mapping, `Cache-Control: no-store`, and a provider selector. With no provider configured it returns **503 `unavailable`** and a manual-fallback message. Fixture mode is gated to non-production environments and requires `FOLIO_AI_PROVIDER=fixture`.
- `lib/ai/contract.ts` — Zod request, proposal, provenance, status, value, and safe-error schemas; static profile-path allowlist and limits.
- `lib/ai/provider-contract.ts` — provider interface and fixed application instructions. User source text is passed separately in `untrustedUserContent`, not concatenated into instructions.
- `lib/ai/service.ts` — injected-provider orchestration, timeout/abort, output-size and JSON checks, Zod validation, exact-source verification, and safe error mapping. It returns review-only proposals and never saves or mutates a profile.
- `lib/ai/fixtures.ts` — deterministic local/test fixtures. Unmatched text returns an empty response rather than guessed content. Fixture success includes `mode: "fixture"` and an explicit “not AI output” notice.
- `lib/ai/proposal-lifecycle.ts` — pure `suggested → accepted | edited | rejected | deferred` decision helpers. Applying is allowed only for `accepted` or `edited` proposals; application is copy-on-write, revalidates the value, and uses explicit path switches rather than dynamic path traversal.
- `tests/ai/contract.test.ts` — Node tests run via `npm run test:ai` (`tsx` test loader).

## Contract, paths, and safety

The operation-specific request union includes `extract_profile`, `suggest_project`, `improve_copy`, `suggest_sections`, `adapt_copy_to_style`, and `ask_clarifying_question`. Requests are strict Zod objects, limited to only the fields needed for that operation; they do not accept a whole draft or design config. **Only `extract_profile` is currently dispatched**; the other operations return `422 unsupported_operation`. Design-aware copy is therefore not implemented.

Only these exact profile paths can be proposed:

`basics.name`, `basics.role`, `basics.about`, `basics.location`; `education.college`, `education.degree`, `education.branch`, `education.gradYear`, `education.note`; `skills`, `interests`, `projects`, `highlights`, `activities`, `learning`; `links.email`, `links.github`, `links.linkedin`, `links.other`.

List paths accept one item per proposal. Project proposals cannot supply IDs; the application generates an ID only after approval. Per-path value schemas enforce field lengths/types, safe HTTP(S) links, and collection caps. `settings`, `schemaVersion`, `design`, `basics.originalNotes`, prototype paths (`constructor`, `__proto__`, `prototype`), and any unknown path are rejected.

Limits: **8,000 source characters**, **48 KiB request body**, **64 KiB provider response**, **30 proposals**, **5 clarifying questions**, and **1,200 characters per exact source excerpt**, plus per-field/list bounds. Provider timeout defaults to **8 seconds** and is clamped between 25 ms and 30 seconds. Errors for unavailable service, timeout, rate limit, provider failure, malformed/empty/unsupported output, and oversized requests are normalized; raw exceptions and provider secrets are not returned.

Each proposal must require review and starts with status `suggested`. An `exact` provenance excerpt must be a literal substring of the supplied source; fabricated excerpts invalidate the response. Missing exact provenance is represented explicitly as `unavailable`. Low-confidence results still require review. The immutable original notes field is not an allowed proposal path.

## Fixture coverage

Automated deterministic cases cover:

1. Simple student notes
2. Messy notes
3. Multiple projects
4. Mixed project/activity content
5. Missing information
6. Ambiguous information
7. Long input
8. Malicious/instruction-like pasted text

Unknown fixture input returns `empty_response`. The malicious case stays in the separate untrusted-content field and cannot create an application/configuration path.

## Validation results

- `npm run test:ai` — **17/17 passed**; includes invalid/missing/wrong-type outputs, arbitrary and prototype paths, oversized source/output, empty/malformed/unsupported responses, exact/unavailable provenance, injection-like notes, provider exceptions, timeout, rate limit, no-provider fallback, approval-only profile application, original-note preservation, and legacy profile defaults.
- `npm run typecheck` — **passed**.
- `npm run build` — **passed**. Build lists `/api/ai` as a dynamic server route; `/` and `/template-demos` remain static.
- Existing browser renderer suites:
  - Checkpoint 5C: **50/50** render cases; 0 failed checks and 0 browser errors; all recorded link, hidden-project, reordered-section, accessibility, long-copy, missing-data, and distinctness checks passed.
  - Checkpoint 5D: **50/50**; 0 failed checks, 0 browser errors, **0 Axe violations**.
  - Checkpoint 5E: **40/40**; 0 failed checks, 0 browser errors, **0 Axe violations**. Focused/grayscale comparisons and structural-collision checks passed.
- `qa-6-regression.cjs` — **9/9 checks**; 0 failed checks and 0 browser errors. Covered quick intake → existing review → design → editor, paste-note/manual fallback with exact original notes preserved, local save/resume, legacy draft load/defaults, all **22** template IDs rendered (22 unique), default API 503 fallback, and client-bundle scan.
- Client bundle scan found none of: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOLIO_AI_PROVIDER`, or `AI_SYSTEM_INSTRUCTIONS` in `.next/static` JavaScript. No active AI provider/key variables or `.env.local` were present during validation.

Machine-readable browser result: `qa-6-browser-regression.json`. Existing updated renderer results remain in `qa-5c-browser-matrix.json`, `qa-5d-browser-matrix.json`, and `qa-5e-browser-matrix.json`.

## Concerns / intentionally deferred

- No real provider is connected or configured; this is intentional. No fixture result is wired into the product UI.
- When the real AI experience is authorized, proposals should be rendered inside the existing `ProfileReview` flow (not a second editor). Persisting pending decision/provenance state across resume should be designed then; the current manual `DraftBundle` is unchanged.
- Provider rate-limit errors are handled, but there is no account-level authentication or application quota/rate limiter because no live provider is enabled. Add those protections, user consent, and privacy/data-retention rules before connecting a paid provider.
