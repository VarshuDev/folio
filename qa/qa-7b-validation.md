# Checkpoint 7B — AI Copy Improvement Validation

## Scope and product behavior

Checkpoint 7B adds small, contextual wording controls to the existing About and project-description editor fields. It extends the Checkpoint 6 `/api/ai` boundary; it does not add a chatbot, global assistant, page, or style-aware rewriting. No generated content is applied automatically.

The request contract is strict and limited to:

```json
{
  "operation": "improve_copy",
  "path": "basics.about",
  "text": "the selected field only",
  "action": "clearer"
}
```

The only targets are `basics.about` and a bounded `projects[index].description` path. The only action values are `clearer`, `shorten`, and `professional`. Whole profiles, design state, other projects, and local project IDs are not accepted or sent to Gemini. `adapt_copy_to_style` remains deferred and returns HTTP 422 with `unsupported_operation` before any provider call.

Before a request, the UI shows the selected text and action and explains that unrelated profile details and design are not sent. Cancel/decline sends no request and leaves the normal editor available. Results are 2–3 review-only alternatives. The original remains unchanged until the user explicitly chooses **Use this**, **Edit**, or **Dismiss**. Accepted/edited text is applied with the existing copy-on-write lifecycle and saved through the existing local-draft path.

## Security and grounding

- Gemini is opt-in through server-only `FOLIO_AI_PROVIDER=gemini` and `FOLIO_AI_API_KEY`; `FOLIO_AI_MODEL` is optional. The key is sent in the server request header, never in a browser bundle, URL, or generated portfolio.
- The provider receives fixed instructions and the finite action separately from a single untrusted user-content field containing only the selected text. It receives no local project ID or unrelated profile/design data.
- Provider output is size-bounded, parsed as JSON, schema-validated, and checked server-side for exact source excerpts, factual-token additions, protected names/tools/quantities/URLs, negation changes, duplicate/unchanged alternatives, and instruction-like input. Unsafe outputs fail closed; at least two safe alternatives are required.
- These deterministic grounding checks are intentionally conservative but are not a proof of semantic equivalence. Human review remains required; users should verify every proposed sentence before using it.
- No provider retention, deletion, or training guarantee is made. Review the provider’s current terms before enabling external processing.

### Mocked-provider scenario coverage (23 groups, with subcases)

1. About is accepted as the narrow target.
2. A project description is accepted as the narrow target.
3. Project indices are bounded; malformed, out-of-range, prototype, and non-description paths are rejected.
4. `clearer` is passed as a trusted action and validated.
5. `shorten` is passed as a trusted action and validated, including an actual-shortening check.
6. `professional` is passed as a trusted action and validated.
7. Unknown actions, blank text, and oversized selected text are rejected.
8. Strict request objects reject full-profile or extra-property payloads.
9. Provider inputs structurally separate fixed instructions/action from the untrusted selected text.
10. Project requests omit the local project ID and sibling/profile fields.
11. Source provenance must be an exact excerpt; missing, malformed, or non-verbatim provenance is rejected.
12. New achievements, employers/clients, technologies, credentials, or project claims are rejected.
13. Numeric facts and quantities must be preserved exactly.
14. Names, tools/acronyms, and links are preserved; invented links are rejected.
15. Negation changes, meaning-bearing token additions, and unchanged alternatives are rejected.
16. Instruction-like source text stays untrusted and suspicious prompt-injection content fails closed.
17. Invalid JSON and malformed provider envelopes fail closed.
18. One or four alternatives are rejected; successful output is limited to 2–3 distinct review-only proposals.
19. Missing provider configuration and provider errors are sanitized and do not echo source text or secrets.
20. Timeouts abort the provider request and return a safe error; oversize service input is bounded.
21. Dismissal does not apply copy; explicit accept/edit updates by copy-on-write; a still-suggested proposal cannot be applied.
22. Stale targets are rejected and project approval changes only the selected description, preserving IDs and sibling fields.
23. `adapt_copy_to_style` returns 422 `unsupported_operation` without invoking the provider.

An additional Gemini REST mock verifies the API key stays in a server header, the URL/body contain no key or project ID, and only selected copy is sent as user content.

## Validation results

- `npm run test:ai` — **44 passed, 0 failed**.
- `npm run typecheck` — **passed**.
- `npm run build` — **passed**; `/api/ai` is dynamic and the app pages are generated successfully.
- `node qa-6-regression.cjs` — **10/10 checks passed**; includes legacy draft, all 22 styles, client-bundle secret/instruction scan, and `.env.local` ignore check.
- `node qa-7a-regression.cjs` — **7/7 flows passed**; no browser errors or Axe violations.
- `node qa-7a-all-style-accessibility.cjs` — **22 styles, 44/44 cases passed**, no Axe violations or browser errors.
- `node qa-7b-regression.cjs` — **21/21 checks passed**: consent decline/zero calls, source-only About and project payloads, unchanged originals before decision, dismiss/use/edit lifecycle (including unchanged copy before explicit edited approval), draft reload, mobile 390px project flow and resume, manual editing after an unavailable response, `/template-demos`, keyboard/focus plus Escape/focus restoration, zero horizontal overflow, and Axe on desktop/mobile copy results and the edit form. No browser errors; zero Axe violations.

The browser suites mock `/api/ai`; no real provider request was made. No Gemini credential or `.env.local` is present in the workspace/runtime, so a live smoke test was not possible. The adapter’s behavior is covered only by mocked REST tests.

## Before public exposure

The app currently has no account authentication or application-level rate limiter on `/api/ai`. Before enabling a paid provider for public traffic, add authenticated access (or an explicit abuse-resistant anonymous policy), per-user and per-IP rate limits, request/token and spend quotas, and `429` responses; validate same-origin/CSRF behavior if browser sessions are introduced; and monitor abuse without logging selected text or API keys. Confirm the provider’s current terms and publish accurate disclosure/consent language before sending user copy externally.
