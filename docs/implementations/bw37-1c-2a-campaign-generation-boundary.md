# BW-37.1C-2A — Campaign Creator generation boundary

Baseline: latest merged main `6c397e4c825f3e2bcae57a03adad31d6a5951caa`, including PR #824. Verified 2026-10-26 (Europe/Berlin). Current code supersedes the historical audits. No AI Brain → Creator handoff is implemented.

## Verified workflow and gaps before editing

| Boundary and exact owning files | Existing guarantee / verified gap |
| --- | --- |
| `app.js`: `resolveCampaignCreationContext`, `campaignCreationIdentity`, `openStableCampaignCreation`; `campaign-creation-dialog.js` | Signed-in client, editable saved Board, ready Workspace catalog and persisted association, clean saved Canvas, editable idea/context followed by counts/channel/LP/email setup. Sidebar selection is not authority. These browser checks did not protect direct generation requests. |
| `app.js`: `fetchGeneratedCampaignPlan`; `api/generate-campaign.js`; `api/_brand-brain-context.js` | Client sent Board ID and full `state.brandCore`. Server had no session, active identity, Board/Workspace access, persisted association, independent canonical Brand ACL or freshness checks. It promoted client Brand data to authoritative generation context. Input coercions accepted malformed values or produced 500 errors. |
| `api/generate-campaign.js`; `api/refine-node.js` | Existing OpenAI Responses requests use `gpt-4o-mini`, one call per invocation, strict JSON schemas. Neither set `store:false`. Raw provider bodies, malformed model text and exception messages could reach callers. No explicit provider timeout or automatic provider retry existed in these routes. |
| `app.js`: `runCampaignV3AICompatibility`, normalization/fallback functions, `evaluateCampaignV3Quality`, `runCampaignV3QualityRepairLoop`, `repairCampaignV3Node`; `api/refine-node.js` | Complete V3 normalization, structural/strategic quality checks and bounded repair targets already exist. Repair uses the shared refine route, which had the same authentication/context/storage gaps. This route also serves manual Inspector refinement; leaving it open would leave the Creator repair boundary open. |
| `campaign-v3.js`; `campaign-creation.js`; `app.js`: real Canvas adapter, `startCampaignV3Creation` | Validated plan/layout/edge references, stale-generation suppression, provisional local nodes, autosave suspension and rollback. Explicit Generate authorizes the existing generation-and-save workflow. Ready/Reveal is shown after confirmed save; Reveal is navigation, not a separate save approval. There is no new preview-acceptance step in this package. |
| `api/campaigns.js`; `api/_campaign-creation.js` | Signed session, unique active application identity, explicit Board ownership projection/edit capability, accepted membership in an active Workspace, persisted Board/Brand/Workspace consistency, transactional revision check, complete-funnel validation, existing assets and snapshot retention, idempotent immutable replay and unknown-outcome recovery. No canonical Brand read permission is inferred from Board edit permission. |
| `api/ai-brain/advice.js`; `api/_ai-brain-learning-context.js`; `api/_board-access.js`; `api/_brand-access.js`; `api/_app-identity.js` | Advice already has independent canonical authorization, protected retrieval, boundary revalidation and `store:false`. Reuse identity and access utilities; do not reuse Advice orchestration, Learning retrieval/token budgets or its conversation contract. |

The action-handoffs audit's generation findings remain true on #824. The earlier strategic-advisor audit describes Advice protections, not guarantees of the separate Creator routes.

## Implemented scope

`api/_campaign-generation-context.js` is a read-only context boundary for the two existing routes. It validates the signed-session identity through existing application-identity utilities; requires a unique active identity; resolves Board edit permission using `getBoardAccess` with explicit ownership columns; rejects legacy implicit `unowned` access; and requires accepted membership in the Board's active Workspace. It verifies `boards.brand_id` and both persisted Workspace IDs using a metadata-only Brand projection before reading any canonical Core.

Canonical Core is returned only by the independently ACL-filtered `getBrandAccess` query. Board-only editors receive their authorized saved Board snapshot, with no canonical Core, canonical labels, counts or Learnings. A separate canonical section is supplied only when authorized. Saved campaign constraints stay distinct from current canonical identity; no snapshot refresh, canonical merge or mutation occurs.

Context capture uses a short read-only repeatable-read transaction and a four-second per-statement bound. Transactions end before inference. Revalidation captures current authority immediately before dispatch and after the response body arrives, comparing actual Board/snapshot/association values, revisions, identity, Workspace membership, access and canonical data. Permission changes and changed values suppress delivery with 409; SQL/transport failures return opaque 503. No database locks span a provider call. There is no continuous permission lease: already transmitted context cannot be retracted.

Both routes require a signed session, a UUID Board ID, an allowlisted JSON object body and a 512 KiB request bound. Briefing uses the existing commit limits (2,000-character idea, 4,000-character context); setup types/enums are checked before existing count clamping/defaults. EN/DE/ES generation remains supported. Repair accepts all eight existing Canvas node types (including Visual Concept and Image Brief for manual Inspector refinement), validated node-summary keys/types, a nonempty instruction and bounded campaign text (256 KiB each for instruction/context). These are technical input bounds, not new paid steps or campaign formats. They permit the existing provisional unsaved generated nodes; repair does not demand persisted node membership.

Legacy `brandBrainData` is accepted only as a bounded object for older clients and ignored as a source. Current Creator generation and repair requests stop sending it. Other existing refine callers can keep their request shape. Briefing, generated node summaries and campaign text remain untrusted user task input. Fixed system policy makes this distinction explicit; it cannot guarantee model obedience or factual truth.

Every OpenAI request in both routes now sets `store:false`. Model, endpoint, schema, response format, request count, provider timeout behavior and explicit retry lifecycle are retained. Errors retain their existing 500/502 classes while removing raw provider bodies/text and internal exception details; protected responses use `Cache-Control: private, no-store`. No automatic retry, quota, new provider or additional paid inference is introduced.

## Preserved owner behavior

No changes to `campaign-v3.js`, either campaign-creation contract/dialog, `api/campaigns.js` or `api/_campaign-creation.js`. Complete campaign normalization, quality/repair, node/edge validation, layout, explicit Generate, provisional Canvas application, autosave suppression, rollback, one transactional save, save-only retries, exact replay, confirmed-save reconciliation and Reveal are retained. Browser code changes are two payload-field removals only. Ordinary autosave still belongs to its existing Board owner contract.

No AI Brain UI integration; new Canvas schemas; generation architecture replacement; migrations; RLS/TLS/database-role/Vercel changes; Brand Profile/Learning changes; automatic background Canvas writes; paid evaluation; merge or deployment.

## Exact changed files

- `api/_campaign-generation-context.js` — scoped read-only access/context/freshness boundary.
- `api/generate-campaign.js` — protected generation inputs, provider storage and safe errors.
- `api/refine-node.js` — same protections on the existing repair dependency.
- `app.js` — remove client Brand Core from Creator generation/repair payloads.
- `scripts/check-bw37-1c-2a-campaign-generation-boundary.js` — signed-session production-route tests with disposable SQL and mocked provider.
- `scripts/check-bw36-15-campaign-team-responsibilities.js` — advance only the exact generator source hash for this authorized boundary change; all other byte guards and assertions retained.
- `package.json` — register `check:bw37.1c2a`.
- `.github/workflows/runtime-boot-safety.yml` — syntax and regression registration; every existing step and both PostgreSQL versions retained; #824 bounded Chromium setup unchanged.
- This implementation record.

## Validation

The new suite executes the actual routes, signed-cookie implementation, identity and access helpers against disposable PGlite SQL, or a uniquely named disposable database on a local explicitly opted-in PostgreSQL fixture. It covers Board editor/Board-only operation, independent canonical viewer access, unrelated accounts/Brands, invalid ownership projections, inactive/ambiguous identities, Workspace and association failures, pre-dispatch revocation, post-inference changes/revocation (including changed Core without a revision bump), tampered/unknown/missing/malformed/oversized inputs, no canonical leakage, `store:false`, unchanged model/schema framing, error redaction and fresh explicit retry. SQL transport asserts read-only statements and no transaction across inference. EN/DE/ES output language and repair response contracts are checked with mocked transport. Exact provider schema hashes match baseline main for generation and repair.

Verified local results:

- `check:bw37.1c2a`: PASS on disposable PGlite, PostgreSQL **17.6** and **18.4**, actual SQL/access helpers and mocked provider. Both PostgreSQL databases are created uniquely and removed by the suite.
- `scripts/campaign-v3-harness.js`: PASS all 14 valid/invalid campaign cases.
- `check:bw36.14r1`: PASS complete production Creator browser/transaction suite, 13 nodes/17 edges, quality/repair, AI retry, save-only retry, reconciliation, immutable replay, refresh and identity invalidation. First local run timed out opening a dialog; the unchanged rerun and clean-main comparison both passed. No assertions/timeouts were relaxed.
- `check:bw36.15`: PASS responsibilities and actual V3 completion, EN/DE, Light/Dark, seven viewport sizes/reflow, accessibility and zero external I/O.
- `scripts/check-bw21-language-separation.js`: PASS.
- `scripts/check-bw36-20r0-ai-brain-board-authorization.js`: PASS 17 ACL cases and 11 invalid ownership projections.
- `scripts/check-bw36-23-brand-knowledge-protection.js`: PASS 15 protected-write contract/controller groups.
- `check:bw36.21ar2.3`: PASS all 30 Brand/Board context groups, including sidebar Y/Board X and hidden independent shared Boards.
- `check:bw37.1br1` and `check:bw37.1c1`: PASS actual conversational-advisor and Profile handoff API/owner/browser regressions.

Codex review of the first commit identified one P2 compatibility issue: limiting the shared refine route to V3's six types disabled existing Visual Concept/Image Brief Inspector actions. The correction accepts all eight existing types; the boundary regression reads the actual browser `NODE_TYPES` registry and exercises each type through the protected production route. No new Canvas type or schema is introduced.

The full Runtime Boot Safety matrix runs on the PR, including the new suite against disposable PostgreSQL 17.6/18.4; final commit/check results are reported in the PR checks and delivery report. Every preexisting step remains. Local browser download is denied by the environment's Chromium CDN policy; local browser regressions use installed Chromium. GitHub CI uses #824's unchanged five-minute matched Chromium installation and real 30-second launch/page-title probe.

## Verified limitations relevant to future handoff

- This does not authorize a Brain-origin brief, source proposal, navigation or protected source return. Future work must bind account/Board/load/Workspace/Brand/source freshness and preserve manual drafts through existing Creator entry points.
- Access is revalidated at operation boundaries, not continuously. Revocation after a check cannot retract provider context or data already delivered. Provider work already started can still incur its existing cost even if delivery is suppressed.
- The existing routes have no explicit provider timeout. This package preserves that behavior and adds no automatic provider retry. Normal provider retention guarantees beyond `store:false` are not established by mocked tests.
- Unsaved client Brand edits no longer become authoritative generation context. Creator already requires a clean saved Board. Manual refinement now also uses the persisted snapshot and authorized canonical source; save desired Board changes through the existing owner first.
- Generated campaign format validation remains in the existing V3 owner and transactional commit contract. Provider JSON schema and mocks do not prove strategic quality, claim accuracy, injection resistance or live model obedience.
- Other AI endpoints, including Brain Content-node proposal and legacy non-Creator generation routes, are separate audit follow-ups. This package makes no security claim about them and does not redirect Creator into them.
- No new durable provenance, generation receipt, cost redesign, persistence layer or cross-Board/Brand reuse contract is introduced.
