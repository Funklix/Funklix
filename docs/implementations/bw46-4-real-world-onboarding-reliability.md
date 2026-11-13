# BW-46.4 — Real-world onboarding reliability

Base: `eed43c8`, latest merged main including PR #863. Dedicated branch: `bw46-4-real-world-onboarding-reliability`. No merge, manual deployment, migration, new provider or automatic inference retry.

## Incident and limits of reproduction

The reported real application attempt used `https://eiskrallt.de/`: discovered 1, retrieved 1, extracted 1, processed 0, unavailable 0, excluded 0, remaining 0. The homepage was Retrieved / Extracted / Not processed, robots.txt Retrieved, sitemap.xml Unavailable. No prepared draft appeared; the UI said “Enrichment failed. Retry safely.” The header said “No website yet” while the research input contained eiskrallt.de.

**The actual incident root cause remains unverified.** Neither its HTTP status/code, provider response nor deployment logs were supplied. A bounded, read-only HTTPS capture attempt (20-second timeout, 1 MiB maximum, no inference) failed at the managed proxy CONNECT boundary with HTTP 403. The runtime policy does not allow eiskrallt.de. No policy, DNS, TLS, robots or access restriction was bypassed. There is no captured eiskrallt.de HTML fixture, and no claim that fictional HTML is an equivalent capture or that the live model integration has been repaired/verified. No paid inference was run.

The new deterministic test uses explicitly fictional Frostspur HTML: a German landing page with fragment navigation, public robots policy and no sitemap. A separate variant adds relative/absolute internal About, Services and Contact links. This tests the reported accounting shape and actual production transport/extraction/selection/provider/handler boundaries; it does not reproduce the original server outcome. A safe original error code and authorized public HTML capture remain necessary to close the incident.

## Actual production sequence and verified boundaries

1. `brand-profile-setup.js` keeps `researchEntry.domain` separately from the canonical Website editor. Submission normalizes HTTPS via `website()`; the request includes domain, optional description, current Brand/Workspace/revision and language. Input does not save a canonical domain.
2. `api/enrich-brand-profile.js` authenticates, resolves independent Brand edit and Workspace membership/revision, then calls `_brand-enrichment.enrich`. Provider availability is checked before research. Authorization/revision are checked again before returning either a draft or recoverable research evidence.
3. `_brand-domain-research.js` validates URLs, obtains robots policy, safely retrieves public HTML via `_website-retrieval.js` and `_website-url-policy.js`, follows validated redirects and checks destination robots before evidence use. Its bounded link scanner resolves against the effective URL; same-origin and topic eligibility, restricted paths, query rules and duplicates are accounted for separately. Sitemap absence does not stop navigation discovery.
4. `_html-text-extractor.js` supplies visible text/metadata, excludes script instructions and segments long visible blocks. Research ranks/interleaves evidence within the existing 16,000-character context and marks selected sources `prepared`, with **processed still zero**.
5. `_brand-enrichment.js` adds explicit user input and authorized canonical/accepted historical context, then makes one existing gpt-4.1-mini request. It validates the HTTP/provider envelope, model JSON, field shapes and short exact attribution. Unsupported citations become missing/non-adoptable; conflicts remain conflicts. Protected Founder/DNA and special modules keep their owners.
6. Only a validated draft transitions selected sources to `processed_selected_excerpts`. The controller stores a review draft, never auto-saves it. Explicit acceptance uses the unchanged protected writer, expected values/revision, preview and authoritative readback. Context changes retire late responses.
7. Previously, the frontend mapped all enrichment error codes through a generic fallback, and the research details always claimed selected excerpts were analyzed, including failure with zero processed. This concealed the actual failure boundary. There is no evidence of an unexpected frontend exception in the original incident.

### Why one source and zero processed?

For the fictional fragment-navigation fixture, fragment removal deduplicates all links to the already-known homepage; the unavailable sitemap adds no page URL. Exactly one page is correct. The fixture asserts three requests: robots, homepage, sitemap; one extracted page; selected evidence retained. Adding three eligible internal navigation links produces four discovered/extracted pages despite the absent sitemap. Redirected canonical-www behavior and existing destination robots regressions remain tested. The real website's navigation, content type, canonical host, nofollow, filtering and robots outcomes cannot be established without its capture; **why eiskrallt.de produced one URL is unresolved**. No URLs or page quotas were invented.

Zero processed does not prove absent evidence. Both provider rejection and invalid output yield the reported 1/1/1/0 page counts in production-path tests, with valid selected evidence present before invocation and retained after failure. Research can also select no evidence (tested using an oversized metadata-only unit); that path now rejects with `NO_USABLE_WEBSITE_EVIDENCE` before inference when there is no explicit description/answer. A combined description remains usable with disclosed website limitations. The real attempt's selected-evidence loss versus post-preparation processing failure is unknown.

`counts.processed` retains the existing contract: number of source records whose selected excerpts completed the validated request, not the number of individual excerpt strings or complete pages semantically understood. Counts are asserted against actual source events. No extracted-only source is marked processed after failure.

## Verified fixes

### Missing-placeholder contract mismatch

Unchanged main was loaded directly from Git and tested with one valid supported description and `mission: {value: null, classification: 'missing', evidence: []}`. It rejects the whole draft with `INVALID_AI_OUTPUT`, discarding the valid suggestion. The application itself already represents omitted missing fields using null, while the prompt only said to preserve unknowns as missing. This is a verified reliability defect, **not a verified explanation of the live incident**.

The provider prompt now explicitly permits omission or null missing placeholders. Only `classification: missing` may contain null. It remains non-adoptable under the unchanged `brand-enrichment-contract.js`; actual proposals must still satisfy every existing typed validator. Null with website_supported, malformed personas, unknown keys and unsafe structure still fail. No factual information is invented, no partial malformed proposal is silently accepted, and review before adoption is unchanged.

### Failure boundaries and recovery

Research now carries a fixed processing stage: provider_request, provider_response, model_json, model_fields, or draft_ready. Provider transport failures and malformed provider envelopes receive stable safe categories. Timeout/cancellation retains its precise code. Original provider bodies, exception messages, prompts, stack traces and secrets are never included. Research evidence is retained only after the handler reauthorizes; revoked/stale requests withhold it.

The handler exposes only an allowlisted set of existing retrieval outcome codes/statuses, allowing the UI to distinguish website/URL policy failures from provider failures. Unknown exceptions remain `ENRICHMENT_FAILED`. Localized EN/DE messages explain provider unavailability/timeout, invalid model response, no selected evidence, interrupted work, invalid website, unsuccessful retrieval, authorization and changed revision. Inputs remain available for retry/manual editing. An explicit **Use description only** action omits the URL without erasing it or silently retrying the provider. No-supported-suggestions responses receive truthful feedback rather than promising available content.

### Canonical website and disclosure

The header still displays the actual saved canonical domain (or “No saved website yet”). It separately shows “Research website (not saved): …” immediately as the research input changes. Normalized equal saved/input URLs suppress the draft label. Research success/failure does not save or replace a website. The normal explicit Website save/reload updates the header through authoritative saved data.

Research status remains visible outside a collapsed native details disclosure. Technical counts, source URLs/redirects/outcomes, robots/sitemap and evidence remain expandable. Zero processed gets “No website excerpts were successfully processed”; automatic legacy-adoption copy is not shown for failed enrichment. No major visual redesign or legacy ID removal.

## Security and compatibility review

No changes to retrieval/link discovery, URL/DNS/IP pinning, redirect/TLS validation, robots, HTML extraction, provider/model selection, Brand permissions, protected writes/revisions, schema, canonical evidence retention or campaign snapshot projection. BW-46.1 R1 conflicting evidence and destination robots checks remain intact. Existing field edits/save/reload, field assistance, Founder import/story, DNA, logo/avatar, Learnings, advanced editing, themes/localization and navigation retain their contracts. New tests use no external website/provider and no credentials. Only source/test/documentation and fictional strings are staged; downloaded attachment, raw logs, screenshots, dependencies and scratch material are excluded from publication.

## Tests and delivery

New checks are registered in Runtime Boot Safety's unchanged PostgreSQL **17.6 / 18.4** matrix:

- `check-bw46-4-onboarding-reliability.js`: actual safe transport/research/enrichment/handler, fictional one-page and multi-link/no-sitemap/robots/redirect, exact counts, missing null plus supported field, strict invalid fields, no-selected-evidence/no inference, provider non-success/transport/envelope/JSON failures, invalid attribution, partial evidence, retained diagnostics and revoked-access nondisclosure.
- `check-bw46-4-onboarding-browser.js`: actual application/production handler/controller, EN/DE failures, retained input, zero-count copy, collapsed disclosure, explicit retry and description-only choice, non-adoptable missing placeholder, draft without mutation, unsaved/saved website/save/reload, stale context during research, Light/Dark and 320/375/1440 widths. Screenshots are uncommitted fictional application evidence under work/.

Existing BW-46.1/46.2/46.3, protected-write, Founder/DNA, URL/retrieval/extractor, maintenance, script-integrity and TLS results and full final-head CI/review outcomes are recorded in the delivery report/PR. Hosted CI is independent of fictional semantic model responses: even a fully green matrix cannot establish successful eiskrallt.de onboarding or live model quality. The remaining incident limitation is release-relevant and explicitly unresolved.

Scoped inventory: `.github/workflows/runtime-boot-safety.yml`, `api/_brand-enrichment.js`, `api/enrich-brand-profile.js`, `brand-profile-setup.js`, `brand-profile-setup.css`, `language.js`, the two new BW-46.4 checks and this document. No other production files are modified.

### Completed focused local validation

All 21 focused suites pass: BW-46.4 API/browser; BW-46.1 domain research/field browser; BW-46.2 API/browser; BW-46.3 onboarding browser; URL policy, website retrieval, retrieval diagnostics, HTML extractor, extraction route; Founder mapping, import lifecycle, Founder-to-DNA context and DNA preflight; protected Brand contract/browser; browser-script integrity, PostgreSQL TLS and maintenance boundary. This includes existing Viewer/stale revision/field edit-save-reload checks and both new EN/DE/theme/mobile journeys. `git diff --check` passes. The baseline nullable-missing rejection was independently reproduced against unchanged `origin/main` before reporting the fix. No existing test was changed or weakened. Full hosted matrix and review results are separate final-head gates reported with the PR; these focused results do not certify the live incident.
