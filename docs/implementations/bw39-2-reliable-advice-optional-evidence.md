# BW-39.2 — Reliable Advice with optional verified Evidence

## Feasibility and architecture decision

Baseline: merged main `33fe2a8124ea350d7dc8009cbd17ad8391056c37` (PR #841),
verified against GitHub before implementation. The missing architecture-review
commit and ADR were not used or recovered. Authority: production Advice,
Evidence/index/resolver, goal/Learning/scope helpers, transcript and handoff
owners, BW-39 audit and BW-39.1 implementation/regressions.

| Option | Verified source contract | Decision |
| --- | --- | --- |
| A. All-or-nothing envelope | Advice calls Responses once; `inspect` rejects valid answer text when findings schema fails. Source matching already drops unverifiable references without dropping the answer. | Replace schema coupling only. |
| B. Native structured output | Responses supports `text.format` with `type: json_schema`, `name`, `schema`, `strict:true`; the repository's Learning Advisor already uses it with default `gpt-4o-mini`. Advice currently sends plain text. | Do not change provider format. Strict schema does not verify quotes or eliminate refusal/incomplete output; actual model overrides and live provider acceptance are unverified. |
| C. Independently validated answer plus optional verified Evidence | Complete JSON parsing establishes answer boundaries before validating optional metadata. Production-route fixtures prove recovery with absent/wrong-type/over-limit/malformed finding or citation fields. | Chosen: retain the existing single-call JSON wire contract; validate the answer independently and discard invalid optional metadata. |

Provider references:

- https://developers.openai.com/api/docs/guides/structured-outputs
- https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_text_config_param.py
- https://github.com/openai/openai-python/blob/main/src/openai/types/responses/response_format_text_json_schema_config_param.py

The chosen decision requires no new model feature. The one existing inference,
current model selection, `store:false`, request/input bounds, output reservation
and timeout remain unchanged. No retry, repair call, Canvas mutation, migration
or database write was added.

## Exact recovery and release rules

1. Preserve rejection of malformed provider envelopes, non-2xx HTTP, transport
   errors, timeouts, provider errors, refusals and incomplete responses. Failed
   responses carrying otherwise valid answer text remain rejected.
2. Preserve aggregation precedence, all assistant text blocks in order and the
   response size bound. Reasoning/tool data never becomes answer prose.
3. Parse the complete JSON value. Never clip, repair, extract a substring, accept
   a closed answer followed by broken metadata, or render malformed raw JSON.
4. Reject duplicate object members, including escaped aliases, after syntax
   validation. The token scan ignores punctuation inside strings and compares
   decoded names. JSON.parse's last-member-wins behavior is insufficient for
   unambiguous recovery. Duplicate keys in metadata also fail closed.
5. Require one top-level object with an own `answer` member and no unknown keys.
   `findings` may be absent. Require a nonempty string within the existing bound;
   reject obvious JSON/array prefixes, fences and disallowed control characters.
   The answer must still pass the existing response-language guard.
6. Validate optional metadata separately using the existing exact keys, string,
   finding-count and citation-count limits. Any optional schema failure discards
   the entire findings set, retains the exact answer and returns zero cards with
   `evidenceUnavailable:true`. Invalid fragments never reach source resolution
   or appear in the browser response.
7. For schema-valid candidates, continue exact source resolution. Wrong-language
   optional findings are omitted rather than invalidating a valid answer.
   Omission counts include those candidates.
8. Preserve pre/post-inference Learning and saved-scope revalidation. Revoked
   identity/Board/Workspace access, changed associations and raw revision/source
   changes block both full and answer-only release.

## Before and after

| Response | Before | After |
| --- | --- | --- |
| Valid answer, verified findings | Answer and cards | Same |
| Valid answer, empty findings | Answer without cards | Same, with concise no-cards feedback |
| Valid answer, missing/invalid optional schema | Entire reply fails | Exact answer retained; zero cards; friendly evidence-unavailable feedback |
| Valid answer, forged/unmatched references | Answer, unsupported cards omitted | Same |
| Valid answer, optional findings in wrong language | Entire reply fails | Answer retained; those cards omitted |
| Invalid/empty/oversized answer or unknown envelope fields | Safe failure | Safe failure |
| Broken/truncated JSON, multiple values or duplicate keys | Safe failure or JSON last-key acceptance | Safe failure; duplicate keys explicitly rejected |
| Provider error/refusal/incomplete output or stale/revoked scope | Safe failure | Same, including answer-only path |

The transcript keeps natural answer text separate from compact verified cards.
English/German feedback says when supporting cards could not be verified or
when no verified cards accompany the answer. It exposes no parser details.
Existing rendering, response actions and Campaign/Profile/Content/Social
handoff source text remain intact; metadata never enters `turn.answer`.

## Security boundaries and review

Exact positive quote-prefix matching, allowlisted fields, saved Social identity
and type, same-node optional goal, conservative claim guard and full-value
saved/working provenance remain unchanged. Source matching attests quoted text,
not strategic correctness. No candidate reference becomes clickable before
server verification. Canonical Brand authorization remains independent from
Board/Workspace access.

Open in Canvas retains its read-only resolver, independent authorization and
two saved-scope captures, then navigates to the exact node ID and native
Inspector. No additional inference or navigation path was added. Browser
identity/Canvas freshness and safe text rendering remain intact.

Self-review focused on answer ambiguity, optional-language coupling, metadata
leakage and answer-only authorization. Duplicate-key rejection and language
omission address the first two; regressions assert no invalid metadata leaks
or answer release after revocation/revision changes. No external review approval
is claimed.

Hosted acceptance exposed a native disclosure toggle race: rerender could replace
the disclosure before its queued toggle event persisted the open state. Capture
live disclosure state before DOM replacement and ignore detached toggle events.
A synchronous open/close plus rerender regression retains all existing assertions
and verifies delayed old events cannot overwrite the current state.

## Validation

`check:bw39.2` runs production Advice with signed sessions, disposable fictional
SQL and mocked provider transport. Cases include valid/empty citations; absent,
wrong-type, over-limit and malformed optional metadata; independent recovery;
duplicate/escaped keys and escaped string punctuation; ambiguous/incomplete
output; invalid answers; refusal/provider errors; optional language mismatch;
access revocation/freshness; one unchanged inference and read-only SQL.

Existing BW-39 R1/R2 optional-schema cases now assert exact answer preservation
and zero cards. Fatal answer/envelope cases retain exact 502 assertions. No test
is skipped; changed assertions have contract-specific replacements. Original
source matching, provenance, revoked Workspace, missing/stale scope, hidden Brand,
resolver and navigation checks remain.

The real production-shell browser test adds empty/invalid metadata success in
EN/DE, Light/Dark and 320/375/1440 widths: exact answer, localized feedback,
zero cards/raw metadata, keyboard/composer focus preservation, no overflow,
one inference and zero writes. Existing exact navigation, compact cards,
disclosures, reduced motion, zoom and stale-reference checks remain.

Runtime Boot Safety includes `check:bw39.2` in both PostgreSQL 17.6 and 18.4 jobs.
Final focused, local matrix and hosted CI results are reported in the PR.
Local matrix executes every workflow validation command unchanged against each
version, using preinstalled dependencies/Chromium in place of hosted setup.

## Limits and publication review

Syntactically malformed or incomplete provider output is intentionally not
recoverable. This does not guarantee every live formatting failure yields
advice, identify an earlier incident's cause or prove the deployed provider's
output distribution. No live/paid inference or production data was used.
Prompt constraints and safe rendering are not semantic verification of prose;
the natural-language answer remains AI advice.

The publication review covers this record and the full diff for credentials,
confidential data and sensitive operational details. The record contains public
source architecture and fictional acceptance behavior only. Publication is
limited to the requested implementation PR; no merge or deployment.
