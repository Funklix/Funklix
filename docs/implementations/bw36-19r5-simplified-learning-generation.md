# BW-36.19R5 — simplified Learning generation

Base: merged `main`, `cac654e549bc462342bae62963aae1d62bdf88f6`, including PR #769. No historical migration or archived audit changes.

## Product behavior and model contract

The Responses request now uses `brand_learning_suggestions_v2`:

```json
{"suggestions":[{"title":"Clear next step","statement":"Offer a clear next step.","rationale":"The saved campaign calls for a concrete invitation.","source_refs":["s5"]}]}
```

Only title, statement, short rationale and optional supplied handles are requested. `source_refs` accepts an array or `null`; strict Structured Outputs requires every property to be listed in `required`, so null represents optional evidence. No model-generated type, confidence, confidence reason, evidence classification, decision status, limitations, related Learning IDs, relationship or quoted excerpt is required. Language comes from the authorized request. The schema has a closed root object and closed candidate objects.

The server independently derives actor/Brand ownership, authorization, source identity, freshness, duplicate relationships, proposal mode, signed receipt and mandatory human review. Titles are display-only; the existing persisted Learning stores its reviewed statement. New suggestions are proposed through the existing workflow, never automatically approved or written by generation. Existing Learning updates remain available through the governed successor workflow.

The external Advisor response and receipt retain `brand_learning_advisor_v1`; the Learning lifecycle retains `brand_learnings_v1`. New response fields include title and provenance status. Legacy provider-shaped results remain readable through an isolated compatibility validator with exact source/quote/classification checks and the existing successor behavior. Legacy output is not requested from the model. Independent invalid legacy candidates are now discarded; they cannot suppress valid siblings. No database migration is needed.

## Evidence for the failure and limits of the conclusion

R4 already reproduced an old 16,000-character output rejection and a 2,000-token reservation mismatch; merged main reserves 8,192 output tokens and uses schema-derived serialization bounds. Those fixes are retained.

A second demonstrated failure mechanism is R4's all-or-nothing candidate validation: a complete independent candidate plus another candidate with an unknown handle, missing handle or nonliteral excerpt caused the entire result to be rejected. R4's regression explicitly asserted that behavior. Executing the merged main validator against one valid saved-campaign candidate plus an independent forged-handle candidate produced `INVALID_OUTPUT / unknown_source_reference`; the R5 validator returned the one valid candidate for the same inputs. The updated regression proves the valid candidate survives while invalid legacy evidence is discarded. The new R5 regression also puts a malformed candidate before valid minimal EN/DE suggestions and proves the valid candidate is returned with its original position-based ID. Omitted or malformed optional references preserve usable prose as an unverified draft, rather than requiring the old eleven-field candidate contract to succeed.

These are proven contract/validation failure mechanisms, **not a proven attribution of the reported live incident**. No production response, production user content or R4 incident diagnostic was provided or fetched. A successful mocked response cannot establish production model availability or its exact output.

For the exact incident, obtain the existing bounded R4 log fields: `event` (`learning_advisor_validation`), random `correlation_id`, allowlisted `category`, `stage` and numeric `pass`. If the category is `provider_incomplete` or a transport failure, the additional safe fields needed are the configured model name, HTTP status, Responses `status`, allowlisted `incomplete_details.reason` (e.g. `max_output_tokens` / `content_filter`) and numeric `usage.input_tokens` / `usage.output_tokens` when present. Do not request prompts, source text, output text, excerpts, provider error messages, receipts, cookies, user IDs or provider keys. Those additional fields are a diagnostic request, not a claim that R4 already logs them.

## Provenance and partial-result rules

- References are checked against the authorized sources actually supplied in that pass. Unknown, duplicate, malformed, absent or unavailable optional handles are not returned as verified sources. If any optional reference is invalid, all that candidate's evidence is withheld to prevent incomplete evidence from being reclassified as a single-node observation.
- A candidate without usable references is explicitly an **unverified draft**, has no source-node identity, and can only enter the authorized manual proposal path. Both its card and the existing proposal review explain provenance limitations. Forged handles cannot create campaign-observation provenance.
- Valid handles identify saved content; they do not prove the suggested claim. Excerpts in v2 are server-generated saved-source previews, labelled as previews requiring human assessment, rather than model-generated quotations. Mutable attribution and resolved discussions still do not establish human agreement.
- Only candidates supported entirely by one authorized saved Node use the existing source-backed proposal path. Profile-only and multi-source suggestions use manual proposals with the existing disclosure that a full evidence ledger is not persisted.
- Malformed independent prose candidates and duplicate candidates are discarded. A nonempty result containing no usable candidates fails; an explicit valid empty array yields the existing empty state. Provider refusals, incomplete/failed responses, malformed JSON, ambiguous messages, HTTP failures and timeouts never become empty success.
- Whole-scope authorization and fingerprint validation still run before every provider dispatch, after every pass, at final release, during receipt validation and inside the adoption transaction. Revocation or stale context suppresses all results, even if individual candidates were valid.
- Adaptive context grouping, full discussion traversal, text deduplication, model-context accounting, cancellation, timeout and the existing five-suggestion selection are retained. No new byte, token, daily-use, Node or suggestion quotas were introduced. Consolidation only sees previously validated source previews; it cannot reopen unrelated sources or manufacture quotations.

## Real Responses contract verification

Checked official OpenAI documentation on 2026-10-14:

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses `text.format` with `type: json_schema`, `name`, `strict: true`, closed objects, required keys and nullable optional fields; `gpt-4o-mini` is supported. Incomplete output can report `incomplete_details.reason: max_output_tokens`; refusal is distinct from schema output.
- [Text generation](https://developers.openai.com/api/docs/guides/text): raw Responses output is an array of items, including assistant message content of type `output_text`. SDK `output_text` is a convenience; the parser retains that compatibility but does not use it to conceal a contradictory message/refusal.
- [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini): Responses and Structured Outputs support, 128,000-token context and 16,384-token maximum output. The configured override remains supported with the existing explicit context/encoding configuration requirement. No paid model probe was made.

Request shape: `POST /v1/responses`, configured model (default `gpt-4o-mini`), `store: false`, `max_output_tokens: 8192`, system/user `input`, and the minimal `text.format` schema. The parser requires a completed response and completed assistant message, accepts contiguous text parts as one JSON document, and rejects contradictory top-level error/incomplete details, refusals and ambiguous documents. HTTP 429 and server errors retain their real error outcomes. Incomplete/refused responses have distinct actionable UI messages; ordinary failures explain explicit retry and administrator configuration checks. Usage reads numeric input/output tokens and reports unknown usage as null.

The new test uses a realistic raw envelope with response/message IDs, object, created_at, model, status, error, incomplete_details, output/content/annotations and token usage details. The browser path uses actual `Response` bodies and the real NDJSON Advisor handler. All provider traffic is injected; no OpenAI network request or production data is used.

## Acceptance regression and verification

`npm run check:bw36.19r5` exercises the actual Advisor HTTP handler, signed session, authorization, SQL and Learning HTTP handler against disposable PGlite, with Chromium running the actual Advisor and Learning UI. It seeds a canonical Brand Profile, a saved campaign with two Campaign Variations, Post-its and persisted replies. The mocked provider asserts those saved categories and reply text reached its input.

The test observes title, statement and rationale on the suggestion card; confirms zero Learning/event writes and unchanged saved Profile/Canvas after generation; explicitly clicks **Propose as Brand Learning** and **Save as proposed**; reads the persisted proposed row with saved Node provenance; refreshes the page and finds the proposal; clicks the existing authorized human approval action; refreshes again and finds the approved Learning. Exactly two lifecycle events are persisted (proposal and approval), and refresh does not invoke the provider. It also checks empty/error UI, retained selection, and visible unverified drafts with no forged source preview.

The contract/security tests additionally cover EN/DE minimal results, malformed independent candidates, optional malformed/forged evidence restricted to manual adoption, forged receipts, authorization/revocation, all-invalid failures, incomplete statuses, refused/malformed provider envelopes, 429/503/timeouts, and adaptive multi-pass consolidation. Existing Advisor and Learning suites cover transaction rollback, stale adoption, role restrictions, identity invalidation, successor governance and UI continuity.

Focused Advisor, Learning, Canvas, Brand and Workspace verification: 54 npm checks passed. One initial BW-36.19 Profile browser run timed out while waiting for a Board selector; its immediate rerun passed. The subsequent full Runtime Boot Safety validation run passed all 173 validation steps / 217 validation command lines, including BW-36.19/R1/R2/R4/R5, Learning lifecycle/provenance, Canvas, Brand and Workspace regressions. The BW-36.19 browser suite also passed in that sequential workflow run. The only failing run step was the local browser provisioning command described below, not a validation regression.

Local setup detail: dependencies were installed with scripts disabled, and `/usr/bin/chromium` is preinstalled. The workflow's `npx playwright-core install --with-deps chromium` provisioning command could not authenticate for root system-package installation in this environment. Browser regressions use the existing working Chromium; the setup command is distinguished from validation checks.

## Remaining risks

Provider schema conformance does not prove semantic truth or citation relevance. Human review remains mandatory. The exact live INVALID_OUTPUT attribution still needs the safe diagnostic record described above. No production deployment, production SQL, paid request or merge is part of this correction. Disposable PostgreSQL/browser tests establish the requested application path, not multi-process contention or production provider uptime. The existing lifecycle stores one primary Node reference or manual provenance, not a full evidence ledger or a durable Advisor conversation.
