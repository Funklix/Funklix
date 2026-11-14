# BW-46.5 — Enrichment response reliability

Base: `b1dea27`, merged main including PR #864. Dedicated branch: `bw46-5-enrichment-response-reliability`. No paid inference, automatic retries, migration, permission changes, manual deployment or merge.

## Incident evidence and verified defects

The original eiskrallt.de failure is **not confirmed or reproduced**. This environment exposes no deployment/provider operational logs or configured provider credentials. Neither the original provider HTTP result, finish reason, response envelope nor exact submitted founder description is available. No real provider diagnostic was performed; explicit cost approval would be required. Mock success does not establish live model reliability, semantic accuracy or the incident's root cause.

Read AGENTS.md and BW-46.2–46.4 documentation; inspected production enrichment, research, contract, controller, deployment configuration and regression fixtures. Independently loaded the original `api/_brand-enrichment.js` from base into its normal module location and reproduced:

1. The `model_fields` loop's combined `throw INVALID_AI_OUTPUT` condition rejects valid, grounded `brandCore` when another field contains invalid personas. Unknown keys cause the same whole-response rejection. Before: all useful work lost. After: invalid/unsupported fields are excluded with safe reasons, valid independently grounded proposals survive, omitted/rejected supported fields become non-adoptable missing placeholders.
2. The `provider_response` parser reads only `choices[0].message.content` and ignores `finish_reason`. A response marked `length` with syntactically complete JSON is incorrectly accepted. Before: truncated generation can appear complete. After: `MODEL_RESPONSE_TRUNCATED` rejects the whole response before any proposal becomes reviewable, even if its JSON parses.
3. The provider request has no `response_format`, relying on prose for different nested field shapes. The current gpt-4.1-mini Chat Completions integration supports strict Structured Outputs; it now sends `response_format: json_schema` with `strict: true`. This is contract hardening, not a claim that unconstrained output caused the original incident.
4. The route labels missing credentials as generic provider unavailability; HTTP status/code, refusal, shape and JSON failures are collapsed. Description-only failures have no research envelope and therefore no processing stage. New diagnostics are independent of research and distinguish these outcomes.
5. The combined-input fallback handles only five research errors. Content/encoding/size/parse and redirect retrieval failures unnecessarily prevent using a valid independent description. These recoverable retrieval outcomes now retain description-based enrichment. URL safety, unsupported protocols, unsafe destinations and cancellation still fail closed. Empty selected website evidence with a description now discloses the website gap.

## Structured response and field recovery

`api/_brand-enrichment-schema.js` derives its eligible keys from the unchanged Brand Profile contract. Text: brandCore, valueProposition, mission, vision, values. String arrays: toneOfVoice, messagingPillars, contentGuidelines, keywords. Personas: array of `{name,note}`. Do/don't: `{dos:[],donts:[]}`. Voice examples: `{good,avoid}`. Assets: any nonempty subset of colors, typography and references, using closed object alternatives so the model need not invent absent visual parts. Domain/logo, Founder, DNA, Avatar and arbitrary keys cannot be proposed by this schema.

Every schema object is closed and every declared property required, as required by strict Structured Outputs. Each field record is nullable to represent optional/missing fields. A non-null record has value, classification and short sourceId/excerpt evidence. Value may be null only as a non-adoptable missing placeholder after production validation. The parser also supports omitted optional fields and the previous missing-record shape for compatibility. Field-specific assistance sends only its requested key. The unchanged contract remains authoritative for length/array bounds, unsafe nested keys, value shapes and protected adoption. Schema constraints are not evidence verification.

Whole-response rejection remains appropriate for provider errors/timeouts, interruption, unreadable provider envelope, refusal, truncation, unsupported content/finish shape, oversized model text, invalid JSON and malformed top-level envelope. No salvage is attempted from truncated or unparseable JSON.

Within a parseable fields envelope, invalid values/classifications/evidence arrays and unsupported keys are excluded independently. Null field records and omitted fields become missing. Unknown key strings are never echoed into diagnostics: only a fixed `unsupported_field` category is retained. Unsafe nested keys fail the individual contract validator rather than escaping validation. Invalid citations are removed using the original exact excerpt/source check, now also rejecting unknown citation properties. A suggestion can survive only under the existing grounding rules with its remaining evidence; unsupported factual drafts stay missing. Conflicts remain visible and non-adoptable even if citation validation fails. Strategic interpretations keep their existing classification. No automatic canonical mutation occurs.

## Safe diagnostics and failure categories

The handler generates a server-owned UUID (`X-Request-ID`) and includes it in authorized response diagnostics and one structured `brand_enrichment` operational event. Metadata contains only fixed categories, processing stage, HTTP status class, allowlisted finish reason, affected supported field key, whether website evidence was submitted, and whether a model message was received. Unknown exception codes map to `ENRICHMENT_FAILED`, even when an exception supplies an HTTP status. The logger never receives research envelopes, user descriptions, prompts, credentials, provider messages/content or website HTML. Logging failure cannot fail a draft.

`websiteEvidenceSent` means checked website excerpts were included when dispatching the provider request. It cannot prove remote receipt after a network failure. `modelResponseReceived` means the provider envelope contained a model message; it does not mean the message passed validation. HTTP status classes and finish reasons remain available for authorized diagnostics. Exclusion records are deduplicated and bounded by the supported field/category set, without arbitrary source-controlled keys.

| Boundary | Safe outcome |
| --- | --- |
| Missing key | PROVIDER_NOT_CONFIGURED (503), before research/inference |
| Provider 401/403 | PROVIDER_AUTH_FAILED (502), status class 4xx |
| Provider 429 | PROVIDER_RATE_LIMITED (502), no retry |
| Provider context_length_exceeded | PROVIDER_CONTEXT_TOO_LARGE (502), full input retained |
| Provider invalid_json_schema | PROVIDER_SCHEMA_REJECTED (502), no unconstrained fallback |
| Other HTTP/transport failure | PROVIDER_UNAVAILABLE (502), available HTTP class retained |
| Existing 30-second provider deadline | PROVIDER_TIMEOUT (504) |
| Client disconnect | REQUEST_CANCELLED (499), listener cleanup |
| Unreadable provider JSON envelope | INVALID_PROVIDER_RESPONSE (502) |
| length finish | MODEL_RESPONSE_TRUNCATED (502) |
| Refusal/content_filter | MODEL_RESPONSE_REFUSED (502) |
| Unsupported content/finish shape | UNSUPPORTED_MODEL_RESPONSE (502) |
| Existing 200,000-character parse boundary | MODEL_RESPONSE_TOO_LARGE (502) |
| Invalid model JSON | INVALID_MODEL_JSON (502) |
| Invalid top-level fields envelope | INVALID_AI_OUTPUT (502) |
| Invalid field value/classification/evidence | Individual exclusion with fixed category |
| No website evidence and no explicit description/answers | NO_USABLE_WEBSITE_EVIDENCE, no inference |

Authorization and current revision are independently rechecked before both successful drafts and failure diagnostics/research are disclosed. Revoked/stale access withholds processing metadata and returns only the correlation ID. No new access to logs is introduced. The UI provides localized EN/DE error messages, a collapsed processing-details disclosure with exact category/request ID/stage, and field exclusion explanations. Inputs remain available for manual editing or another explicit request.

`vercel.json` previously had no route-specific duration for this endpoint; the actual deployed platform default is unknown. The endpoint now declares 90 seconds to cover the existing 20-second research plus 30-second provider deadlines and authorization overhead. This does not lengthen those internal deadlines or establish that deployment timeout caused the incident. No new provider configuration, model, key, quota or retry is introduced.

## Description and protected ownership

Website failure never clears or rewrites the submitted description. The fixture uses the reported founder name Laurent Krall with minimal synthetic background/personality wording; it is not the unavailable original natural-language brief or a claim to have researched his biography. The parser produces a reviewable `user_provided` partial description with mission, vision and audience missing. It never creates Founder facts or requires optional strategy completion. Existing structured Founder Story, narrative approval and Founder-to-DNA flows remain their own owners. Existing saved values stay unchanged until explicit acceptance. The unchanged protected writer, expected values/revisions, reviewed destructive changes, authoritative reload, manual editing and snapshot isolation remain in force.

## Regression proof

`check-bw46-5-enrichment-response.js` checks the actual request schema against every supported value shape and all seven partial-asset combinations; optional/nullable/missing fields; one valid field alongside invalid values/classifications/citations/unknown/unsafe keys; source validation and conflict blocking; field-specific schema; original description retention; recoverable website failures and empty website evidence; missing configuration; every provider category above, timeout and actual request-aborted event; no retries; safe logs and reauthorization nondisclosure.

`check-bw46-5-enrichment-browser.js` starts at actual frontend input controls in both EN/DE. It uses the production handler/controller/contracts, actual public-URL retrieval/research with mocked transport, mocked provider, production parser, rendered UI, explicit editing/acceptance, protected HTTP save, reload and later manual save/reload. It covers website only, description only and both; one/multiple valid fields; invalid alongside valid fields; missing strategy; existing saved values; provider error, timeout, truncation, conflicts, empty evidence, and description recovery after a content-type failure. Generation does not write; campaigns and specialized saved fields remain unchanged. No mocks replace the production parser or adoption contract. The browser database adapter is a disposable test implementation, not real PostgreSQL; the existing complete Runtime Boot Safety matrix additionally exercises real PostgreSQL 17.6 and 18.4 protection fixtures.

Existing BW-46.2/46.4 tests now assert the intentionally changed individual-exclusion behavior and precise envelope/JSON codes; their grounding, authorization, conflict and no-inference assertions remain. Both new suites are registered in the unchanged Runtime Boot Safety PostgreSQL matrix. Focused local and final-head hosted results are reported separately in the PR/delivery; no mock or local check is presented as live provider proof.

## Publication review and remaining unknowns

Only the scoped production/schema/UI/localization/deployment files, regression scripts, workflow registration and this document are staged. Attachments, scratch analysis, raw logs, screenshots, dependencies and environment files are excluded. No secrets, full original user brief, captured customer HTML or real model response is published. Public PR publication is authorized by the request, subject to repository publication review; no merge/deployment is authorized or performed.

Remaining evidence needed to close the live incident: the original authorized correlation/log record (including exact provider outcome/finish reason/stage), actual deployment configuration/timeout, the original description, and, separately with explicit cost approval, a live provider diagnostic. The implemented schema is compatible with documented [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs); deterministic fixtures do not certify current deployed provider acceptance or factual inference quality.

## Completed focused local validation

All 23 focused suites pass: BW-46.1 research/field browser; BW-46.2 API/browser; BW-46.3 onboarding browser; BW-46.4 API/browser; BW-46.5 API/browser; URL policy/retrieval/retrieval diagnostics/extractor; Founder mapping/import/context/archetype; DNA preflight; protected Brand contract/browser; script integrity; PostgreSQL TLS; maintenance. EN/DE new browser paths and original regression assertions pass. The final added provider-schema-rejection/invalid-input/field-specific-schema checks also pass. `git diff --check` passes. These focused results are distinct from the complete hosted PostgreSQL matrix and cannot establish the original live failure.
