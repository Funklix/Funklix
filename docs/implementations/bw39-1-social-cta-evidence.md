# BW-39.1 — Evidence-linked Social CTA analysis

Base: `b159e18be4a5eab61b07a1a05912b1a24ce5b242`, merged main including #838.
Approved contract: [BW-39 audit, G/H/J](../audits/bw39-ai-brain-evidence-visual-experience.md).

## User experience

Before, Advice returned natural text with inert node IDs and no validated
source-to-Canvas action. Ordinary Advice retains that behavior. An explicit
**Analyze Social CTAs** conversation-focus option now selects a narrow same-call
analysis contract, supporting a freeform question about existing Social posts.
Its description is localized with the existing interface language owner.

The natural answer remains exactly `turn.answer`, separate from at most three
compact source cards. One card is initially visible; native details expose more
findings and optional native goals. Each card names the actual working node title,
canonical type and ID, identifies the field, quotes its exact indexed prefix,
discloses excerpts and per-field provenance, labels the judgment **AI
interpretation**, and offers **Open in Canvas**. Source checked means the
quotation matched supplied source text, not that the judgment is correct or that
the model demonstrably used it. Partial citable Social coverage is disclosed.

No reliable evidence produces conversational text with no fabricated cards.
Individual invalid references are omitted with an insufficient-evidence notice.
Malformed/incomplete/refused output is a distinct retryable-turn failure, never
raw JSON or a fabricated finding. Existing explicit Retry captures current context.

## Server contract and integration

- `advice.js` selects the envelope deterministically from `advice_mode`;
  the existing projection, validator, index, diagnostics, approved Learning and
  independently authorized canonical Brand owners remain authoritative.
- `_ai-brain-goal-context.capture` gains opt-in `requireScope`. Analysis captures
  persisted Canvas and active identity/Board edit/Workspace/association scope even
  with no goals. Ordinary no-goal Advice acquires no extra capture. The identical
  capture shape is checked before dispatch and release; raw SQL timestamp
  microseconds remain in the private fingerprint.
- `_ai-brain-social-evidence` parses complete assistant text before clipping:
  exactly `{answer,findings}`, answer <=12,000, <=3 findings, title <=120,
  explanation <=600, one or two evidence entries with ID <=160 and exact quote
  <=180. The raw parser bound is 24,000 code units. Unknown keys, malformed
  objects, refusal, incomplete output and excessive bounds fail without salvage,
  repair inference or automatic retry.
- Primary evidence must be positive `cta`, `social.cta`, `social.caption`,
  `social.preview` or `content`; optional second evidence is the same node's
  relevant native `goal`. The exact ID/type must exist uniquely in the authorized
  saved Canvas and the supplied index. Never-saved, deleted, wrong-type,
  out-of-index and forged references receive no card. Server derives node
  metadata, quotations, excerpt flags, source-match labels and provenance.
- Non-goal saved status requires full supplied value equality with the full saved
  value after validator trimming. A longer saved value matching only a projected
  prefix is **working context**, potentially including unsaved edits. Goal uses
  the existing exact-whitespace saved/unsaved comparison. Neither proves approval.
- Natural-language policy requires CTA counterevidence and forbids unsupported
  absence, counts and measurement. A conservative lexical guard also omits obvious
  absence, numeral/percentage and measurement claims in finding prose. This is
  intentionally conservative and is not semantic proof of remaining prose.

## Read-only opening and freshness

`evidence-reference.js` accepts only bounded Board ID, exact node ID and a
freshness digest. It independently verifies the signed session, active identity,
Board edit ACL, accepted Workspace membership/status/revision, persisted
Board-to-Brand association, raw Board revision and exact saved Social identity.
Two same-shape captures must agree. The digest covers authorized scope and the
selected node's allowlisted saved baseline; hidden fields, other nodes, canonical
Brand content and Learnings are not reference payloads. The endpoint returns only
the same ID/digest or a generic unavailable result. A digest grants no access.

The browser binds the exact account object, Board/load, saved revision,
Workspace/catalog/association state, complete current native nodes/edges, and
turn/reference identity. Checks run after transport, JSON and animation-frame
awaits and before native focus. Same-email object replacement, source edits,
saves/autosaves, reloads, scope changes or deletion invalidate the reference;
there is no own-save rebase. Stale presentation and reference metadata are cleared.

Only explicit clicking invokes the resolver. Existing modal/detail guards are
respected; an unavailable rendered node or deferred/blocked destination fails
without selecting another object. Navigation uses `setActiveView`, then
`focusNodeInCanvas`, its normal selected IDs/Inspector owner, and a narrow final
viewport reveal. Exact DOM dataset comparison avoids interpolating source IDs
into selectors. No creation helper, edit, save, history entry, canonical update
or provider request belongs to opening. Composer draft/caret/mode, evidence
disclosures/focus and same-context return remain in the existing scroll lifecycle.

## Provider and budgets

One existing Advice Responses call, same model (`gpt-4o-mini` default), explicit
`store:false`, 4,096 output tokens and 1,024 framing reservation. Envelope
instructions are counted in the existing complete-message budget. No additional
format/schema payload or uncounted context is sent. Existing 422 capacity failures,
200 nodes, 400 edges and 350,000 request bytes remain. Expansion, validation,
opening, errors and fallback make no model calls. Existing explicit downstream
Content/Campaign calls remain independently owned and disclosed.

## Verification and review

`npm run check:bw39.1` exercises fictional disposable PGlite SQL, real signed
session/ACL/scope/Advice/resolver code, mocked Responses and the actual production
shell/projection/Canvas/Inspector. It covers saved/working goals and copy,
repeated titles/alias/exact IDs, counterevidence, missing evidence/goals,
index omissions, Unicode/truncation, forged citations, malformed output,
hidden/revoked/deleted/never-saved contexts, microsecond revisions, local and
in-flight account/scope/source changes, JSON/frame races, missing DOM, blocked
navigation, zero writes/inference on Open, exact answer, composer return,
disclosure/focus, EN/DE, Light/Dark, 320/375/desktop and 200% zoom.

The existing strategic-advisor test now expects the six actual focus options
and explicitly checks the new entry; all five original modes keep their original
assertions. Existing language capture remains exactly once per request.
Both focused suites run as an additional Runtime Boot Safety step in the existing
PostgreSQL 17.6/18.4 jobs; no existing check is disabled, skipped or weakened.
Final CI and regression execution results are recorded on the PR, rather than
implied by workflow registration.

Codex self-review tightened source invalidation after remote denial, retained
evidence disclosure focus across renders, removed arbitrary selector
interpolation at the shared native focus boundary, checked complete output before
clipping, and preserved the original request-language boundary. Final review
results and any external review findings are reported separately on the PR.

## Limits

Matching text does not prove strategic correctness, a missing CTA, actual model
use, or performance. Mocked inference does not establish live model adherence;
no paid evaluation was run. The lexical claim guard can omit otherwise useful
interpretations and is not a general semantic classifier. Index/projection limits
remain partial. Strict freshness intentionally invalidates even unrelated saves.
Remote revocation after the final SQL check cannot be eliminated continuously.
No durable references/transcripts, new schemas/migrations, broader graph scope,
other node types, automatic changes, merge or deployment are included.
