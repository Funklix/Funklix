# BW-37.1C-3B — Content eligibility and editable preview

Base: `f8997a18eb6e56a5b1797f789d36c585703b385e`, verified merged main including PR #828 on 2026-10-27 (Europe/Berlin). Implements package B of the [contextual Canvas audit](../audits/bw37-1c3-contextual-canvas-actions-audit.md) after [package A](./bw37-1c-3a-content-proposal-hardening.md). The [product architecture](../constitution/product-architecture.md) and [intelligence architecture](../product/product-intelligence-architecture.md) retain ownership: Brain owns ephemeral advice and review, Canvas owns creation, Boards owns saving, and Brand owns canonical knowledge.

## Behavior and call boundaries

Previously, Content eligibility required specific labelled fields, later sections could satisfy an earlier asset, Prepare sent the whole answer, preview was read-only, and Create relied on cached browser authorization. Now **Add to Canvas** opens a local source review. It shows the original destination Board, fixed supported type Content, an AI-generated suggestion disclosure, and an exact original excerpt. Opening review and changing the selection make zero inference calls and create nothing.

`aiBrainContentAssets` applies bounded deterministic rules to successful non-clarification answers of at most 12,000 characters, independently of advice mode. Existing structured EN/DE positive fixtures remain accepted within their individual asset boundary. Natural introductory prose, substantial drafted copy with an audience action, and concrete reusable concepts with format/audience/purpose cues qualify. Content-intent questions can disambiguate unlabelled drafts or concepts. Generic recommendations, diagnostics, questions, acknowledgements and complete campaign briefs without an individual asset do not qualify. These rules improve recall; they are neither semantic classification nor proof of quality/truth.

Offsets always refer to the exact original answer, retaining Markdown, whitespace and CRLF. Independent asset headings, numbered alternatives and distinguishable quoted alternatives produce separate candidates; later asset fields cannot complete an earlier incomplete candidate. Multiple candidates start with no selection and disabled Prepare. Only one selected span is submitted. Unrecognized/ambiguous formats can remain in the conversation instead of being guessed into a node.

Campaign Creator and protected Brand Profile handoffs retain their owners and eligibility. At most two result actions are prominent; when both existing handoffs also qualify, Content is available in a compact native details disclosure. No unsupported destination type is advertised.

The explicit **Prepare as Content node** control discloses one AI request and invokes the existing source-only conversion. It preserves #828's active identity, Board ownership projection, applicable Workspace membership, persisted association, pre/post scope checks, `store:false`, model, strict schema, field limits, bounded provider transport, safe errors and no automatic retry/classifier/repair. Only the selected exact span replaces the previous whole-answer input. Ordinary Advice is unchanged.

The prepared preview uses the existing validator and only the actual Content fields: title and body. Rationale stays separately labelled. Editing is local and makes zero inference calls. Create is disabled for invalid data and revalidates normalized required title 1–120/body 1–4,000 and existing control-character/prototype/type rules. Source/destination/rationale use `textContent`; editable values use native input/textarea `.value`. Generated and user-entered markup remains inert.

## Consequential Create boundary

Preparation also returns a 64-character SHA-256 equality digest of the already-authorized in-memory scope snapshot. This digest contains no source or canonical knowledge and is not a capability, signature, durable receipt or authorization grant. It stays in ephemeral proposal state.

On explicit Create, the proposal enters `checking` synchronously to prevent duplicate clicks. `/api/ai-brain/content-scope` is a new narrow **read-only** preflight, using the existing `api/_ai-brain-proposal-scope.js` owner. It authenticates the signed session, re-reads the complete ownership/identity/Workspace/membership/association/revision scope, compares the original persisted expectations and preparation digest, revalidates after its read boundary, and returns only the digest. It never accepts source text, fetches canonical knowledge, calls a model or writes a Board. Board-only editors and Brand viewers with actual Board edit remain supported. Viewers, anonymous/unrelated actors, revoked membership/access, disabled identity, changed identity/Workspace revision, persisted association changes and unavailable authorization reads fail closed.

After the await, the browser rechecks the same proposal object/controller state, original turn/question/answer/excerpt, account object, Board/load, native Canvas/selection, saved association/revision, Workspace/catalog scope, current view, edit permission and exact validated fields. A cancelled, navigated, edited, replaced or stale intent cannot insert. Detected stale source/scope is retired; restoring an old value or rerendering cannot re-enable that turn. Network/preflight failure safely requires fresh advice rather than guessing that insertion is authorized.

Only then does the unchanged Canvas insertion block consume the proposal ID, take one history snapshot, call the existing `createNode` once with title/body and default Draft state, and mark dirty. It adds no edge or canonical Brand change. Existing pre-insertion failure handling and partial-insertion recovery still prevent duplicate retries. Existing Canvas navigation selects/reveals the node and fills/focuses Inspector. Local insertion and dirty/pending autosave are distinct from the Board save owner's validated remote response. No save/conflict/history architecture was replaced.

## Conversation lifecycle

Source review and prepared preview remain inline in the retained conversation. Return to conversation, Cancel and Escape cancel the proposal/controller and restore the result action without replacing the composer draft, caret, mode or scroll anchor. Leaving AI Brain cancels open/pending review before navigation and retains the existing same-Board conversation. Account/Board identity invalidation still clears protected ephemeral state. Existing fixed composer and Jump to latest owners remain unchanged. Responsive controls use native labels/select/inputs, visible keyboard focus and existing Light/Dark theme tokens.

## Verification

- `check:bw37.1c3b`: production recognition/extraction functions, actual signed read-only Create route with real scope/ACL owners and fictional projection-aware SQL, and actual browser shell/controllers with mocked providers/transport. Covers natural EN/DE, legacy/Markdown/CRLF, mode independence, strategy/diagnostic/campaign negatives, isolated multiple assets, source equality, zero-call opening/selection/edit, one explicit proposal call, required/boundary/control-character edits, inert source/title/body, cancellation/Escape/navigation, composer/caret/mode/scroll, Light/Dark at 320/375/1440 pixels, remote denial and await-time account/source/Board/Workspace/navigation/cancel races, no stale revival, one Content/undo snapshot, Inspector and pending-save/confirmed-save/reload.
- Existing `check:bw37.1c3a` still exercises actual proposal authentication/projection, independent roles and nullable legacy associations, source-only `store:false`, one inference, body limits/real 25-second deadline, pre/post-inference races and browser one-node/undo/partial-insertion recovery. Its browser interactions now explicitly confirm preparation after zero-cost opening, supply the new response digest and await the new Create boundary. Its 409 assertion additionally proves stale source cannot retry until new advice. Existing assertions are retained.
- Existing conversational Advisor browser flow also explicitly confirms preparation, mocks the read-only preflight and retains its call-count, cancel, creation and responsive assertions.
- Full Runtime Boot Safety retains the unchanged PostgreSQL 17.6/18.4 matrix and existing checks. New syntax and focused checks are registered. Actual CI and Codex review outcomes are reported in the PR handoff; a pending matrix/review is not a pass.

Local Chromium runs require the executor's approved socket-capable sandbox permissions; the initial restricted launch failed before browser execution. GitHub API CLI access is unavailable under this environment's HTTP policy, so the connected GitHub tools are used for PR metadata/review/CI. Git fetch/push use the configured proxy with approved sandbox permissions. No provider call uses live transport or paid credentials.

## Exact changed files

- `app.js`
- `styles.css`
- `api/_ai-brain-proposal-scope.js`
- `api/ai-brain/propose-node.js`
- `api/ai-brain/content-scope.js`
- `scripts/check-bw37-1c-3b-content-eligibility.js`
- `scripts/check-bw37-1c-3b-content-scope.js`
- `scripts/check-bw37-1c-3b-content-browser.js`
- `scripts/fixtures/bw37-1c3a-proposal-runtime.js`
- `scripts/check-bw37-1c-3a-content-proposal-browser.js`
- `scripts/check-bw37-1b-r1-conversational-advisor.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `docs/README.md`
- This implementation record

## Remaining limits

Recognition is intentionally bounded and heuristic; arbitrary prose, unusual alternative boundaries and factual correctness are not guaranteed. Conservative source/catalog/native Canvas freshness can require new advice after changes that would not alter the text. Fresh read boundaries narrow authorization races but cannot eliminate a later revocation before the independent Board save, recall already dispatched provider input, or prove durable transcript origin. The legacy optional/non-atomic Board PUT revision contract, five-entry history behavior, cross-tab idempotency and canonical Brand protections are unchanged. Mocked transport and disposable SQL/browser fixtures do not claim live provider quality or production permission telemetry. No new schemas/types, Social/Visual/Image adapters, migrations/RLS/TLS, persistent conversation/provenance storage, automatic generation, connections, merge or manual deployment.
