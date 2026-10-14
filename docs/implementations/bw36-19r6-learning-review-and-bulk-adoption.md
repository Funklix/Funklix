# BW-36.19R6 — Learning review and bulk adoption

Base: merged main including BW-36.19R5 / PR #770. No schema migration or production SQL.

## Root causes

The Advisor editor initialized evidence/context to an empty string. Successful adoption called `clear()`, which destroyed the completed analysis, receipt and suggestions. Merely retaining the browser results would not work: the signed receipt fingerprints the approved/proposed Learning library as well as saved Profile/Board sources, so the first proposal legitimately changed its fingerprint.

## Context prefill

`evidenceContext()` formats only the completed analysis. It labels rationale as AI interpretation, separate from literal server-validated saved-source excerpts. R5 server source previews identify saved content but do not independently verify the suggested claim. Missing/unverified references supply an explicit warning and never fabricate source evidence. Existing attribution warnings, discussion resolution caveats and candidate limitations remain visible. Descriptions use available source kind/title/field rather than generated identifiers or measurements.

The statement and complete context are editable. No additional AI request occurs. The existing database normalization contract remains authoritative: NFKC, whitespace normalization, 2000 Unicode characters for statements and 4000 for context, with existing invalid-character checks. Context is never silently shortened to fit storage. Oversized prefill remains in the textarea, displays a capacity explanation and prevents saving until reviewed and shortened. Storage remains plain explanatory text, not a new structured provenance ledger.

## Review session

Analysis, Board/discussion choices, selections, edits and proposed states stay in memory for the open Advisor. Single adoption returns to the suggestion list, disables the adopted candidate, confirms success and refreshes the underlying Brand Learning library. Other candidates remain reviewable without inference. Closing, changing source scope, changing Brand/user/language, or invalidation clears the session. The original expiry timer and focus/visibility validation remain active.

A successful governed write returns `review_session` with a newly signed receipt. It retains the original expiry, actor, signed-session binding, scope and remaining candidate digests/modes/targets; removes consumed candidate IDs; and fingerprints the saved sources/library after this transaction's writes. Receipt advancement runs before commit under the same locks. Arbitrary stale receipts cannot be refreshed. Old receipts become stale; consumed IDs are rejected using the new receipt. Any external Profile/Board/Learning changes or current permission failure still invalidate adoption. Expiry clearly requires a new explicit analysis and never extends source validity.

Transport uncertainty does not trigger automatic writes or inference. Retrying validates the receipt again; a completed but unacknowledged mutation changes its fingerprint and cannot be duplicated through the old session. On authorization/freshness errors, editable review text stays visible while save/navigation controls are disabled; existing source refresh/new analysis is required.

## Selection and confirmation

Eligible cards provide labeled checkboxes and current state. `Review selected` enters independent statement/context editing with Previous/Next navigation and removal. Edits survive navigation. Bulk save displays the reviewed statements/context and an all-or-nothing explanation, freezes the payload, and requires a separate `Confirm save` click. `Keep editing` returns to review. Selection never submits or approves knowledge. Existing single-save explicit action remains supported.

After success all saved candidates display Proposed, other candidates remain accessible, and the Brand Profile Learning library is refreshed behind the dialog. Closing the Advisor provides the existing path to human review/approval there. Native dialog semantics, Tab trapping, Escape/discard, textarea focus, responsive scrolling and shared theme tokens remain intact.

## Transaction and security boundaries

The internal governed Learning operation accepts an input set and an after-mutation hook; existing HTTP Learning mutations still supply their single input. The Advisor's strict `adopt_selected` request validates every candidate against the signed receipt and applies existing text normalization before writing. Duplicate IDs and normalized statements within a batch are rejected. The existing single-proposal request byte boundary scales with the intrinsic five-candidate analysis capacity for the batch, so valid long Unicode context across selected items is not restricted to a single-item payload size. Every item passes through existing `mutate()` duplicate, revision, successor and event logic; each source-backed item also uses the existing current source authorization/precision checks.

One database transaction locks the Brand for writing, revalidates signed receipt/actor and current Workspace/source scope under authorization locks, writes each independently validated proposal/event, derives the next receipt, and commits. The shared scope authorization stays locked for the entire batch. Any candidate, source, revision, duplicate, event, receipt-renewal or commit failure rolls back every item and event. Success reports each item's Proposed state and Learning; failures report every submitted bounded candidate as Not saved, with the bounded failure code. There is no partial-success claim.

All output remains proposed. Manual proposals have manual provenance; source-backed proposals derive immutable Board/Node provenance on the server; legacy successor candidates inherit existing provenance and leave the original approved. Browser values cannot replace those fields. Signed-session authentication, Brand/Workspace/Board authorization, source freshness, immutable ownership, browser database privilege boundaries, event atomicity and human approval are unchanged. There are no new provider calls, quotas or product restrictions.

## Validation

`npm run check:bw36.19r6` passes:

- Full context prefill, AI/literal-source distinction, missing/unverified evidence, no truncation and EN/DE formatting.
- Actual API/service continuation after a single save, unchanged expiry, consumed IDs, no second provider call, human edits and event persistence.
- Duplicate normalized statements/IDs, existing library changes, invalid statements/candidates and malformed IDs, long Unicode batch context, forged/expired receipts, stale sources, Brand changes, revoked membership, event/commit failure and mixed manual/source/successor semantics.
- Chromium review controls in EN/DE, light/dark, desktop/375/320 widths, overflow notice, independent edits, unavailable/Proposed states, confirmation, focus, Tab/Escape and preserved session.
- Real HTTP handlers, Chromium and disposable PGlite: durable reload, Board/discussion continuity, selection/deselection/removal, second-event atomic rollback, retained edits and successful retry, and unchanged Canvas/Profile data.

The historical SQL assertion suites are unchanged. The external database doubles now expose transaction-visible Learning rows to Advisor scope reads, matching PostgreSQL visibility for renewed fingerprints; no historical assertion was weakened. Providers are mocked and all database records are disposable synthetic fixtures.

Historical focused regressions `check:bw36.17`, `check:bw36.17r1`, `check:bw36.17r2`, `check:bw36.18`, `check:bw36.19`, `check:bw36.19r1`, `check:bw36.19r2`, `check:bw36.19r4` and `check:bw36.19r5` all passed. Full Runtime Boot Safety then passed all 174 executable workflow steps locally, including the final R6 changes, syntax and browser script integrity. Dependencies were installed separately and system Chromium supplied the browser runtime; the checkout/install setup steps are not counted as regression checks. No historical assertion was weakened, no paid OpenAI requests were made, and no production SQL was executed. GitHub runs the same workflow for PR #771.

## Deployment and remaining limitations

Deploy browser and API changes together through the normal application deployment. Existing R2 provenance schema remains required; no migration, production SQL, credentials or provider configuration changes are needed. Old clients retain their existing single-adoption response fields; the new review-session fields are additive.

Review sessions are temporary and are not restored after a browser reload. Edited context is normalized according to the existing plain-text storage contract. Source previews remain bounded by the existing analysis contract; the UI preserves all available candidate context rather than claiming a complete evidence ledger. Tests use disposable PGlite and mocked providers, not live production or a multi-process contention test. Transport loss after commit may require library inspection/new analysis because old receipts deliberately fail freshness validation; the UI does not silently retry or infer a successful save.
