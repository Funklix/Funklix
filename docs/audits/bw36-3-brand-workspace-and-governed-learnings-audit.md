# BW-36.3 Brand workspace and governed Learnings audit

> **Status:** documentation-only product and implementation specification. **No fix is implemented.** “Verified” means traced to repository source at the BW-36.2 baseline (`d70b09f12f620fe4747721e582f883c80dee1593`); it is not a claim about production data. “Recommendation” and “Required work” describe future changes. “Optional” is outside the first release.

## 1. Executive summary

The product currently exposes Brand in two different surfaces. The left sidebar has a remembered **Workspace Brand** card and a separate **Current Board Brand** card with technical actions. The full Brand Core page, however, edits the Board's saved `brand_core_snapshot`, not the reusable Brand selected in the Workspace card. This distinction is real and valuable, but the interface asks marketers to understand “canonical,” “Brand Core,” restoration, and comparison mechanics before it explains the user goal.

**Verified current model.** A reusable `brands` row owns name, JSON Brand Core, revision, and membership. A Board independently owns `brand_id`, a copied Brand Core snapshot, source provenance, and one recovery copy. The sidebar choice is a per-user browser preference over accessible Brand records; it is not a persisted Workspace entity. New branded Boards receive the then-current reusable Core. Later changes do not flow into a Board silently.

**Recommendation.** Present the reusable record as **Brand Profile / Markenprofil**, the stable Board copy as **Campaign Brand Snapshot / Kampagnen-Markenstand**, and a governed library as **Brand Learnings / Marken-Learnings**. The sidebar becomes one compact identity card: avatar, Brand name, one relationship line, **Open Brand Profile**, and the lower-emphasis **Change Brand** action. A bounded “Update available” status links into a dedicated Campaign Sync workflow; comparison leaves the sidebar.

The Brand workspace should become a calm operating system with Overview, Identity, Audience, Voice & Messaging, Offers & Proof, Learnings, and Campaign Sync. It should summarize first and edit one coherent section at a time. Existing Core fields and knowledge modules remain compatible behind that interface.

Learnings introduce a stricter boundary: AI and people may create a `proposed` record, but only an authorized human may transition it to `approved`. Only approved, Brand-scoped, bounded records can inform future work. Approval never rewrites Brand Profile fields. The safest persistence is a dedicated relational `brand_learnings` table plus an append-only revision/event table, protected by Brand ACL and optimistic concurrency—not an array embedded in Brand Core.

**Safest sequence:** simplify the sidebar (A), reorganize the workspace (B), redesign Campaign Sync (F), add human-created/reviewed Learnings (C), add campaign-observation promotion (D), and only then bounded AI proposals (E). Moving F before persistence establishes the mental model and conflict UI on which Learnings depend.

## 2. Evidence boundary

### Inspected repository evidence

| Area | Files inspected |
|---|---|
| Prior decisions | `docs/audits/bw36-contextual-shell-funnel-and-brand-workspace-audit.md`; `docs/implementation/2026-09-27-bw36-1r1-canvas-toolbar-isolation-and-funnel-footer.md`; `docs/implementation/2026-09-27-bw36-2-isolated-compact-context-bar.md`; Brand, Board, knowledge, AI Brain, Insights, Content, and deletion audits under `docs/audits/` |
| UI/runtime | `index.html`, `app.js`, `styles.css`, `language.js`, `content-workspace.js`, `funnel-simulator.js`, `persona-journey-simulator.js`, `automatic-planning.js`, `auto-plan-batch-runtime.js`, `posting-plan-export.js`, `posting-plan-pdf.js` |
| Brand/Board API and schemas | `api/_brands-storage.js`, `api/_boards-storage.js`, `api/_brand-access.js`, `api/_board-access.js`, `api/_board-serializer.js`, `api/_brand-deletion.js`, `api/brands/index.js`, `api/brands/[id].js`, `api/brands/[id]/members.js`, `api/boards/index.js`, `api/boards/[id].js` |
| AI/diagnostics | `api/_brand-brain-context.js`, `api/_ai-brain-canvas-context.js`, `api/_ai-brain-diagnostics.js`, `api/_ai-brain-conversation.js`, `api/ai-brain/advice.js`, `api/ai-brain/propose-node.js`, `api/_funnel-simulator.js`, `api/funnel-simulator/run.js` |
| Knowledge/documents | `knowledge-module-registry.js`, `knowledge-module-identity.js`, `knowledge-module-runtime-adapter.js`, `knowledge-module-dependency-engine.js`, `api/_document-records.js`, `api/_document-processing-records.js`, `api/_strategy-module-generation.js` |
| Migrations | all tracked files under `migrations/`, especially `20260911_bw33_5_supabase_rls_hardening.sql` and rollback, and the social-destination migration/verify set |
| Regressions | Brand/Workspace BW-1–13, BW-18/20/21, deletion, shell, knowledge-module, BW-26 AI Brain, BW-28 Insights/avatar, BW-29 Funnel, BW-31 Content, BW-33 foundation/RLS, BW-35 export/auto-plan, BW-36.1R1, and BW-36.2 checks under `scripts/` |

### Proven by source

Source proves the ownership and request paths described below, revision checks on canonical Brand PUT, explicit Brand-to-Board copy/restore operations, role projections, local selection storage, fallback avatar derivation, prompt-context projection and bounds, deterministic rather than measured Insights, knowledge-module storage inside Brand Core/custom tiles, and current responsive/theme selectors.

### Still requiring browser or production evidence

Production must establish: actual role/data prevalence; legacy Board shapes; divergence rates; whether runtime-created tables match formal migration state; real avatar URL longevity; long-name/localization wrapping; keyboard and screen-reader behavior; forced-colors rendering; 200% zoom; mobile sticky/editor behavior; failure timing; deletion retention obligations; tenant boundary configuration; and whether any external analytics source exists outside this repository. An authenticated browser matrix is required before implementation sign-off. No production database, browser session, provider, or AI endpoint was used for this audit.

## 3. Current sidebar Brand experience

**Verified structure and ownership.** Static sidebar markup in `index.html` is driven by `app.js`:

* The **Workspace** card lists accessible Brands from `GET /api/brands`; its choice is `ephemeralBrandSwitcherSelection`, remembered under a versioned, hashed-per-email `localStorage` key. It restores only if the ID remains in the authorized catalog; stale, signed-out, or deleted selections are cleared.
* The selected Brand summary does not contain Brand Core or avatar. Detail is fetched separately. Avatar resolution therefore uses loaded Brand data/Brand Core assets where available, then a derived initial/fallback; the catalog itself returns only ID, name, revision, dates, and role.
* **Current Board Brand** derives from the loaded Board's authoritative `brand_id`, not the Workspace selection. The relationship survives a Workspace selection change.
* “Brand · Restored” reports browser preference restoration, not server Workspace restoration.
* **View Canonical Brand** opens a detail dialog; **Compare Brand Cores** opens a read-only Board-versus-reusable diff; **Change Board Brand** mutates the Board association through the authorized Board route. The child navigation **Board Brand Core** opens the full snapshot editor.
* With no selected Brand, the Workspace card asks for selection/creation; with no Board or no Board Brand, Board actions are disabled or show their corresponding empty state. Unauthorized Brands are absent from the catalog and unauthorized Boards do not expose actionable content. Public-token presentation hides Brand Core navigation.

**Likely cause of confusion.** Two adjacent cards present selection and association as peers, while the strongest verbs are technical. A “Workspace” appears to be an entity, “Current Board Brand” appears to mirror it, and “View Canonical Brand,” “Board Brand Core,” and “Compare Brand Cores” require internal architecture knowledge. The avatar is not consistently the dominant anchor, restored-state copy adds noise, and two similarly prominent actions imply equivalence between viewing and mutation.

## 4. Current full Brand Core workspace

**Verified inventory.** The `brand-core-workspace` is entered as Brand app mode and currently means the Board snapshot. Its hero contains “Board knowledge snapshot,” avatar, “Board Brand Core,” current Brand/name, an explanatory sentence, readiness meter/copy, and Reset. The body renders grouped knowledge tiles beside a sticky detail editor. The normalized snapshot includes built-ins such as Brand Core/positioning, value proposition, tone of voice, messaging pillars, personas, content guidelines, do/don't rules, voice examples, keywords, assets, Brand DNA, and custom knowledge tiles. Registered custom modules include Founder Story, Market Research, Business Plan, Pitch Deck, and Whitepaper; strategy modules carry draft/accepted lifecycle data.

Selecting a tile opens its field editor; custom modules have specialized editors and generation/import states. Reset is a Board-edit operation. Autosave ultimately persists the full Board canvas plus `brand_core_snapshot`; it does not update the reusable Brand. Compare, initialization, refresh-from-canonical, and one-copy restore live in the separate sidebar dialog rather than this page. Canonical editing remains a JSON textarea in another dialog.

Authorization comes from Board access (`canViewBoardBrandCore`, `canEdit`, restore/refresh/compare capabilities) and server checks. Mobile CSS collapses the two-column body and removes sticky behavior at narrow widths; dark-mode rules theme the surfaces. Source selectors demonstrate intended responsiveness and theming, not visual conformance in every browser.

**Overload.** The page simultaneously presents completeness, many heterogeneous tiles, a persistent editor, generation/import lifecycle, reset, and Board-specific terminology. The reusable Profile is elsewhere and edited as raw JSON. The result mixes overview, editing, knowledge ingestion, and lifecycle management without a task-first hierarchy.

## 5. Verified data model

| Concept | Actual owner and persistence |
|---|---|
| Selected Workspace Brand | Client preference: selected accessible Brand ID in memory and versioned per-email `localStorage`; not a database Workspace row |
| Reusable Brand record | `brands`: UUID, owner email, name, `brand_core` JSONB, integer revision, timestamps; durable server state |
| Brand access | Owner column plus `brand_members` (`admin`, `editor`, `viewer`); durable server state |
| Board Brand association | Nullable `boards.brand_id`, FK reconciled to `brands` with `ON DELETE SET NULL`; durable and authoritative for the Board |
| Campaign Brand Snapshot | `boards.brand_core_snapshot` JSONB; durable, independently editable Board state |
| Board data | `boards.canvas_json`, identity/owner/order/public sharing fields, timestamps; comments/content/approvals are represented in Board/canvas structures rather than a Brand learning store |
| Brand avatar | No standalone Brand avatar column. It is resolved from Brand Core assets/logo and UI fallback initials; Board list display is projected from snapshot |
| Snapshot provenance | source revision, source updated time, copied time; plus equivalent fields for one backup; durable Board columns |
| Revision | Reusable Brand owns `revision`; canonical PUT uses compare-and-swap and increments it. General Board saves use `lastKnownUpdatedAt`; refresh checks Brand revision and Board updated time |
| Board role | Owner/unowned, direct editor/viewer, inherited Brand owner/admin/editor/viewer, public viewer, unrelated; server-projected capabilities |

Client state includes active view, loaded Board, the editable snapshot, unsaved changes, loaded canonical detail, and comparison UI. Local canvas recovery and AI Brain conversation memory are browser state, not reusable Brand truth. Knowledge-module instances are currently nested inside Brand Core/custom tiles, not independent relational records. No Brand Learning entity or approval lifecycle exists.

## 6. Current Brand consumption

| Consumer | Verified path and precedence today |
|---|---|
| Campaign generation | Uses current `state.brandCore` in generation/preflight paths; on a loaded Board this is the Board snapshot. Explicit campaign form inputs constrain generation. No reusable-Brand live merge is proven. |
| AI Brain | Client sends Board ID, bounded Canvas context, history, question, language, and selection. Server reloads authorized Board and projects `board.brand_core_snapshot` through `_brand-brain-context`; accepted strategy evidence is projected with bounds and private document-source modules are excluded. Explicit question/current Canvas lead; snapshot supplies Brand context. |
| Diagnostics/Insights | Deterministic Canvas diagnostics inspect nodes/edges and can compare ICP/tone signals using current context. UI explicitly says no campaign analytics are connected and does not claim reach, conversions, revenue, or impact. Results are derived views, not durable Brand memory. |
| Content Workspace | Reads the active authorized Board/canvas nodes, review and approval state. Brand display/context follows the Board snapshot; review feedback does not become reusable Brand data. |
| Funnel Simulator | Persona journey execution is Board-authorized and sends bounded campaign/Brand context; assumption mode is simulated. It produces no authoritative performance learning. |
| Auto-plan | Plans from current Board content and freshness inputs. It neither reads a separate learning library nor writes reusable Brand knowledge. |
| Exports | CSV/PDF export current posting-plan/Board material and resolved Brand display/branding. Export is not a Brand write path. |
| Dashboard/other | Brand-evolution summaries count meaningful fields in current Brand Core. Knowledge modules are visible as accepted evidence. Comments, edits, approvals, conversation memory, and diagnostics remain in their own current lifecycles. |

**Current fallback rule:** explicit operation inputs and current Board data dominate; the loaded Board snapshot supplies Brand context; generic behavior is used when Brand context is absent. Canonical Brand data is copied at Board creation/explicit refresh, not consulted as a silent runtime fallback. There is no approved-learning layer today.

## 7. Current comparison and synchronization behavior

**Compare Brand Cores** fetches the current authorized Board snapshot and the associated reusable Brand Core, flattens objects, and groups matching/different/missing paths. Raw object paths appear because this is a generic schema-preserving JSON diff, including unknown forward-compatible fields. It is read-only and warns when unsaved Board changes mean the server snapshot is being compared.

**Initialize Canonical Brand Core from this Board** is offered only when the associated reusable Core is empty. After confirmation it copies the last saved Board snapshot into that Brand and advances the Brand revision. It does not update this or other Boards and creates no live synchronization.

**Update Board Brand Core from Canonical** transactionally replaces the Board snapshot with the reusable Core, stores the prior snapshot in the single backup slot, and stamps provenance. It requires Board edit/refresh capability, access to the associated Brand, expected canonical revision, and expected Board `updated_at`; stale requests fail. **Restore previous Board Brand Core** swaps current and backup values, enabling one-step recovery rather than an audit history.

Changing `brand_id` clears provenance and backup metadata but does not prove an automatic snapshot replacement in that association operation. Canonical edits use Brand revision compare-and-swap. Initialization/refresh boundaries are destructive only to the named destination; they never merge fields. Labels are ambiguous because “initialize,” “canonical,” “from this Board,” and two directions are shown together without a user-goal preview.

## 8. Sidebar information architecture recommendation

Use one **Brand** block:

1. 40px avatar and selected Brand name.
2. One relationship line: **“This campaign uses this Brand”**, **“Campaign uses {other Brand}”**, or **“No campaign selected.”**
3. Primary text/button: **Open Brand Profile**.
4. Secondary menu/action: **Change Brand**. On a Board, clarify whether it changes the filter or campaign relationship before confirmation.
5. One bounded status chip only when useful: **Update available · Review changes**, **Campaign version is current**, or **Campaign uses a different Brand**.

Remove **Compare Brand Cores** from the sidebar. Comparison belongs in **Campaign Sync**, reached by Review changes. Do not show raw canonical/snapshot words, a long explanatory paragraph, initialization, refresh, and restore as equal actions. Keep Board association semantics unchanged behind the simpler interface.

## 9. Sidebar visual specification

* Expanded desktop: 16px outer padding; avatar 40×40px, circular/squircle consistent with existing system; 10–12px gap; name one line with ellipsis; relationship/status below at muted small text. Fallback is up to two Unicode-safe initials on a deterministic, contrast-safe Brand color—never an empty image icon.
* Primary action occupies one 44px row. Change Brand is a quiet 44px row or overflow item. Status is not a third competing button; its inline **Review changes** link is the sole exception.
* Collapsed nav: 32px avatar centered, accessible name “{Brand name}, Brand”; badge dot for update. Tooltip/flyout exposes name and actions by keyboard and pointer.
* Compact desktop/tablet: retain avatar/name; stack actions, never truncate both identity and status. Mobile drawer uses a 48px avatar and full-width 44px actions; closing restores focus to the nav trigger.
* Loading: neutral avatar skeleton plus two text lines, `aria-busy=true`; never flash a stale relationship. No Brand: fallback mark, “Choose a Brand,” primary Choose Brand. No Board: “Used across campaigns,” no sync status.
* Mismatch/update: amber/information semantics, icon plus text—not color alone. Viewer sees Profile and Review changes but no mutation action; label “View only.”
* Dark mode uses semantic surface/border/text tokens. Forced colors uses system colors, 1px borders, and preserves the avatar initials. Focus ring must remain 2px visible with offset. Motion is opacity-free or ≤150ms and removed under reduced motion.

## 10. Full Brand workspace information architecture

Final top-level navigation, grounded in existing fields:

| Section | Existing material grouped here |
|---|---|
| **Overview** | completeness, recent Profile revision, missing essentials, approved/proposed Learning counts, campaigns needing review, next action |
| **Identity** | Brand Core/positioning foundation, Brand DNA/archetype, values/mission/vision where present, Brand assets and visual direction, Founder Story |
| **Audience** | personas/ICP; relevant accepted Market Research audience facts |
| **Voice & Messaging** | tone of voice, messaging pillars, content guidelines, do/don't rules, good/avoid voice examples, keywords |
| **Offers & Proof** | value proposition, offer/business-plan offer fields, differentiators, proof/credibility, objections when represented; do not fabricate absent fields |
| **Learnings** | governed proposal queue, approved library, history |
| **Campaign Sync** | campaigns associated with the Brand, snapshot freshness, human-readable compare/update workflows |

Pitch Deck, Whitepaper, Market Research, Business Plan, custom tiles, and future fields remain evidence/knowledge modules surfaced contextually, not seven simultaneous raw editors. Unknown fields remain preserved in storage and can appear under a labeled “Additional knowledge” section for authorized editors.

## 11. Brand workspace visual specification

The page header uses a 56px avatar, Brand name, “Reusable Brand knowledge for future campaigns,” access badge, and compact completeness indicator. The primary next action is contextual: Complete Profile, Review Learnings, or Review campaign updates. Destructive deletion/reset lives in Settings/Danger zone, never the hero.

Desktop uses a sticky, keyboard-operable section rail and a max-width reading column. Each section opens with a readable summary and missing-information callouts; **Edit section** opens one focused form. Never render JSON. Show “Saved,” “Saving…,” “Unsaved changes,” and conflict states next to the section action. Cancel confirms only when dirty.

At tablet/mobile, section navigation becomes a select/menu or horizontally scrollable tablist with visible focus; content and editor become one column. Editors are full-page sheets below 768px, not narrow split panes. Light/dark tokens must meet contrast, reduced motion removes transitions, forced colors retains boundaries, and 200% zoom reflows without horizontal page scrolling. Long values wrap; structured lists become stacked rows.

## 12. Exact user-facing mental model

* **Brand Profile:** “Your reusable Brand knowledge. It helps keep future campaigns consistent.”
* **Campaign Brand Snapshot:** “The Brand information saved with this campaign.”
* **Why snapshots exist:** “A campaign keeps its saved version so later Profile changes do not alter work unexpectedly.”
* **Updates:** “When the Brand Profile changes, you can review the differences before updating this campaign.”
* **Synchronization:** “Choose which version to update and confirm the fields. Nothing changes until you approve it.”
* **Brand Learnings:** “Reusable observations from your work that may improve future campaigns.”
* **Approval:** “Suggestions are not Brand knowledge until an authorized person reviews and approves them.”

## 13. Final English terminology

| Term/action | Exact label | Supporting copy where needed |
|---|---|---|
| reusable record | **Brand Profile** | Reusable Brand knowledge for future campaigns. |
| Board copy | **Campaign Brand Snapshot** | Brand information saved with this campaign. |
| governed library | **Brand Learnings** | Reviewed observations that can guide future work. |
| open | **Open Brand Profile** | — |
| select/associate | **Change Brand** | Choose the Brand this campaign uses. |
| freshness | **Update available** | The Brand Profile has changed since this campaign version was saved. |
| enter diff | **Review changes** | Compare understandable fields before updating anything. |
| Profile → campaign | **Update campaign** | Replace the selected campaign fields with the latest Profile values. |
| campaign → Profile | **Update Brand Profile** | Apply the selected campaign changes to reusable Brand knowledge. |
| decline sync | **Keep current campaign version** | Make no changes to this campaign. |
| states | **Proposed learning**, **Approved learning**, **Rejected learning**, **Archived learning** | — |
| actions | **Approve**, **Edit and approve**, **Reject**, **Archive** | — |
| evidence labels | **Source**, **Evidence** | Where the proposal came from; what supports it. |
| usage | **Used in future campaigns**, **Not yet used** | Means eligible/observed use; never imply causal performance. |
| queue | **Needs review** | Requires an authorized person's decision. |

## 14. Final German terminology

| English | Exact German |
|---|---|
| Brand Profile | **Markenprofil** |
| Campaign Brand Snapshot | **Kampagnen-Markenstand** |
| Brand Learnings | **Marken-Learnings** |
| Open Brand Profile | **Markenprofil öffnen** |
| Change Brand | **Marke wechseln** |
| Update available | **Aktualisierung verfügbar** |
| Review changes | **Änderungen prüfen** |
| Update campaign | **Kampagne aktualisieren** |
| Update Brand Profile | **Markenprofil aktualisieren** |
| Keep current campaign version | **Aktuellen Kampagnenstand behalten** |
| Proposed learning | **Vorgeschlagenes Learning** |
| Approved learning | **Bestätigtes Learning** |
| Rejected learning | **Abgelehntes Learning** |
| Archived learning | **Archiviertes Learning** |
| Archive / Approve / Edit and approve / Reject | **Archivieren / Bestätigen / Bearbeiten und bestätigen / Ablehnen** |
| Source / Evidence | **Quelle / Beleg** |
| Used in future campaigns | **In zukünftigen Kampagnen verwendet** |
| Not yet used | **Noch nicht verwendet** |
| Needs review | **Prüfung erforderlich** |

**Decision:** retain **Learning** intentionally. In German marketing/product practice it conveys an actionable, reusable takeaway; “Erkenntnis” can sound conclusive and would overstate a proposal. Use correct German compounds and explain the term once; do not alternate between Learning and Erkenntnis.

## 15. Brand Learnings product definition

A Brand Learning is a concise, structured, Brand-scoped observation, supported by identifiable evidence, that an authorized human has decided is relevant to future work. It is specific, reusable, understandable, attributable, reviewable, editable through a new revision, and reversible by archive/supersession.

It is **not** a raw message or conversation, unsupported AI claim, secret/credential, provider payload, hidden system instruction, automatic Profile rewrite, or unverified performance conclusion. Evidence may justify a proposal without making it truth. Learning text is user-controlled data.

## 16. Learning categories

Release 1 has exactly eight primary categories: **Audience, Positioning, Messaging, Tone of Voice, Offer, Objections, Proof, Content**. These map to current Brand and content capabilities while remaining understandable. Defer Channel and Campaign Process until observed use proves a stable cross-campaign need; they too easily capture campaign tactics rather than Brand knowledge.

Each learning has exactly one required primary category and zero to five optional normalized tags. Tags are filtering aids, not authorization, scope, or prompt instructions. Category changes create a revision.

## 17. Learning sources

| Source | Availability | Evidence quality / privacy risk | Automatic proposal? | Approval |
|---|---|---|---|---|
| Explicit user correction | Current interaction exists; capture action is required work | High when user deliberately summarizes; medium personal-data risk | No in R1; explicit “Suggest as Brand Learning” | Always |
| Approved Content review feedback | Current review/approval state exists; durable learning link is future | Medium-high if tied to approved version; content/author risk | Later, only after explicit trigger | Always |
| Resolved Canvas comments | Collaboration/comment state exists in Board structures; promotion is future | Medium; high personal/conversation risk | No background inference | Always |
| AI Brain recommendation | Current bounded conversations exist, primarily browser memory/request history; durable proposal link is future | Medium/low and prompt-injection/privacy risk | Phase E only, evidence-backed and visible | Always |
| Campaign diagnostics | Current deterministic Canvas checks | Medium for structure; not performance; low/medium content risk | Later for bounded repeated patterns | Always |
| Insights | Current deterministic/inferred/simulated views; no connected analytics | Medium/low; must preserve classification | Not until explicit, supported trigger | Always |
| Funnel Simulator | Current simulated/assumption results | Low for truth; must say simulated | No automatic R1 | Always |
| Campaign results/performance | **Not authoritative in repository today** | Unknown/high; future verified connector required | Future only | Always |
| Repeated content approvals | Events exist conceptually in content state; cross-campaign aggregation not verified | Potentially medium; behavior profiling risk | Future only after minimum sample and disclosure | Always |
| Repeated user edits | Edits exist; reliable semantic diff/event history not verified | Low/medium; surveillance and context risk | Future only, opt-in/bounded | Always |

No source may embed a full conversation, raw provider response, signed URL, credential, email, or unnecessary personal data. Store a safe reference plus human-readable evidence summary.

## 18. Human approval state machine

Allowed states are `proposed`, `approved`, `rejected`, and `archived`.

* Human Brand editor/owner/admin may create `proposed`; Board editors may propose from a Board only when they can also read the associated Brand (final mapping must be server-enforced). AI may only create `proposed` in Phase E through an authenticated, visible trigger.
* Only Brand editor/admin/owner can Approve or Edit and approve. Board ownership alone must not grant authority over reusable Brand knowledge. The same roles can reject. Only Brand admin/owner should archive approved records in R1; Brand editors may archive their still-proposed items. Viewers and public-token users are read-only/no access respectively.
* `proposed → approved|rejected`; `approved → archived`; `rejected → archived` or remain history. There is no rejected-to-approved shortcut: create a new proposal, optionally `supersedes` the rejection, with new evidence.
* Editing an approved learning creates a proposed revision; the approved revision remains active until the new one is approved. Archiving removes it from future consumption without deleting audit history.
* A normalized Brand/category/statement fingerprint flags duplicates. Exact active duplicates are rejected server-side; near duplicates require a merge/supersede choice. Contradictions are warnings and block one-click approval until resolved or explicitly acknowledged.
* Every transition is compare-and-swap on revision and records actor, timestamp, previous/new status, and safe reason. AI can never invoke a transition to `approved`.

## 19. Learning proposal contract

Recommended logical record (names are implementation guidance, not a migration in this task):

| Field | Contract |
|---|---|
| `id`, `brand_id` | immutable UUIDs; Brand scope required |
| `status` | bounded enum; starts `proposed` without exception |
| `category`, `tags` | one controlled category; ≤5 normalized tags |
| `title`, `statement` | plain text; concise, bounded (for example 120/600 chars) |
| `recommended_use` | bounded plain text explaining future application |
| `source_type`, `source_ref` | allowlisted type; opaque internal reference with tenant/ACL validation, nullable if source later deleted |
| `evidence_summary` | bounded, redacted human-readable text; no raw payload/chat |
| `confidence` | optional `low|medium|high`; evidence indicator, never approval |
| `proposer_type`, `proposer_actor_id` | `human|ai`; stable internal actor reference or service identity, not exposed email |
| dates/reviewer | created/reviewed/archived timestamps and actor IDs |
| `revision` | positive integer for optimistic concurrency |
| supersession | nullable `supersedes_id`, `superseded_by_id`; same Brand only |
| archive metadata | actor/date/bounded reason; no hard-delete implication |
| safety/identity | normalized fingerprint, schema version, created/updated timestamps |

An append-only event/revision record stores the immutable state transition facts and the reviewed text snapshot. Mutable current text is a projection. Never store unrestricted provider payloads, full private conversations, system prompts, credentials, or signed URLs.

## 20. Learning review UX

The Learnings tab opens with counts for **Needs review**, **Approved**, and **Archived/Rejected**; counts are status only, not quality scores. Default focus is Needs review. Search covers safe title/statement; filters cover category, status, source type, proposer, and date.

Each proposal shows status/category, statement, why it matters/recommended use, source, evidence summary, proposer type, and date. Primary action is **Approve**; secondary **Edit and approve**; Reject is lower emphasis and requests a bounded reason. Approved items offer Archive. Duplicate/conflict banners precede actions and link the related human-readable record. Batch approval is excluded from R1.

Empty states explain how to propose a learning. Viewers see the library and “You can view but not review Learnings.” Access loss closes edit UI without discarding an unsent local draft until navigation. Mobile uses stacked cards and a full-screen detail/review sheet with sticky single primary action, never a multi-column table.

## 21. Learning detail presentation

A detail header shows category + status, title, statement, and affected Brand name/avatar. Sections are **Why it matters**, **Recommended application**, **Source**, **Evidence**, and **History**. Metadata shows proposer (“You,” team member display name, or “Tendra AI”), date, review actor/date, and usage eligibility. Actions follow role/state. History is chronological human-readable revisions and decisions. Internal UUIDs, JSON, fingerprints, tokens, raw prompts, and object paths never appear.

## 22. Approved-learning consumption

Only the latest active `approved` revision can be projected. Server-side retrieval must enforce Brand access, cap count and total bytes, select deterministically (relevance/category then recency, with stable IDs), and label every item as user-controlled evidence. Each consuming request records only learning IDs/revisions and consumer class for explainability.

* Campaign generation, AI Brain, and Content creation may use relevant approved learnings as supplemental guidance.
* Diagnostics and Insights may explain consistency against them but must not convert inference into measured results.
* Funnel Simulator may use them as disclosed assumptions, never measured facts.
* Auto-plan may use relevant channel/content guidance; exports may display already-generated output but should not inject hidden new content during export.
* No learning mutates Brand Profile, snapshot, Board, schedule, approval, publication, or social state.

**Corrected precedence:** (1) explicit current user instruction, subject to safety/authorization; (2) campaign-specific instructions and the Campaign Brand Snapshot; (3) explicit Brand Profile fields as reusable authority; (4) approved Brand Learnings as supplemental evidence; (5) generic defaults. A learning conflicting with levels 1–3 is excluded and surfaced for review. This extends, rather than changes, today's Board-snapshot-first runtime.

## 23. Conflicts between learnings and Brand Profile

On proposal and before consumption, compare category/semantic target against positioning, audience, tone, value proposition, campaign instructions, and active learnings. Show **Potential conflict**, both statements, affected field/category, sources, and choices: Edit proposal, Reject, Archive/supersede older learning, or Update Profile through its separate workflow. Approval is blocked for direct Profile/campaign contradictions unless a Brand editor records a scoped rationale; even then the campaign instruction/Profile wins consumption. Never silently rank two contradictory learnings. A Profile change rechecks active learnings and marks them `needs_attention` as a derived flag, not a new lifecycle state.

## 24. Campaign-specific versus Brand-wide learning

**R1 boundary:** persist Brand-wide proposals/approved Learnings only. A user may explicitly create a proposal from a campaign source, but the durable record is Brand-scoped and remains inactive until Brand authorization approves it. Do not introduce a general Board-observation store in Phase C.

Phase D may add campaign observations attached to a Board and an explicit **Suggest as Brand Learning** promotion that copies a safe summary/reference into `proposed`. Observations never influence other campaigns directly and Board deletion rules remain distinct.

## 25. Learning generation policy

R1 supports only explicit human **Suggest as Brand Learning** / Create proposal actions. This is the correct first boundary: it proves taxonomy, ACL, evidence, duplicates, and review without surveillance or surprise cost.

Phase E permits bounded triggers such as an explicit action on an approved review item, resolved comment, diagnostic, or AI Brain response. The UI previews source and requested processing before any provider call. No constant background inference, hidden request, weak/missing evidence proposal, automatic approval, automatic Brand mutation, or retry loop is allowed. Deduplicate before and after generation; rate-limit by Brand/source; record safe diagnostics; allow dismissal. Provider output is untrusted and must pass schema, length, secret/PII, and prompt-injection checks before a `proposed` insert.

## 26. Authorization matrix

`✓` is supported/recommended, `R` read-only, `—` denied, and `?` requires product mapping. Existing ACL has separate Board and Brand roles; Learning permissions do not yet exist.

| Actor | View Profile | Edit Profile | View Snapshot | Compare | Sync campaign from Profile | Propose | Approve/reject | Archive | Use approved |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Public-token user | — | — | R where public Board permits current rendered content; Brand Core nav currently hidden | — | — | — | — | — | only server-projected output already in public Board; no library read |
| Authenticated unrelated/viewer | — | — | only authorized Board viewer | — | — | — | — | — | no direct use |
| Board editor | R only if also Brand member | — | ✓ | existing Board capability can compare when Brand-readable/editable | ✓ only with Brand read + Board edit | `?` recommend ✓ with Brand read | — | own proposal only before review (`?`) | via authorized Board consumer |
| Board owner | R only if also Brand member | — | ✓ | same | same | same | — unless Brand editor+ | — unless Brand admin/owner | via Board |
| Brand viewer | ✓ | — | ✓ for associated Brand Boards under current inherited ACL | ✓ | — unless separately Board editor | recommend ✓ proposal | — | — | R/consumer access |
| Brand editor | ✓ | ✓ | ✓ | ✓ | ✓ through inherited Board edit | ✓ | ✓ | proposed; approved archive reserved | ✓ |
| Brand owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brand admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Unresolved mapping:** current Brand `admin` and `editor` both write Core; admins manage members, owners manage admins. There is no global application administrator in inspected ACL. Do not invent one. If an operational administrator exists, it receives no content permission by default; audited break-glass access requires a separate policy. All checks must occur server-side, not from hidden buttons.

## 27. Persistence options

| Option | Audit/concurrency/query | ACL/deletion/versioning | Risk/verdict |
|---|---|---|---|
| Embed array in `brands.brand_core` | Whole-document revision; poor per-item audit/query; duplicate approvals race | inherits Brand ACL/deletion; portable JSON; revisions conflate Profile and learning edits | Lowest migration effort, highest governance risk; reject |
| Existing knowledge-module custom tiles | Stable module IDs and accepted lifecycle concepts, but Board/reusable JSON ownership and module semantics are content-centric | inherits enclosing record; evidence/status query and reviewer audit weak | Reuse UI/identity patterns only; reject as persistence |
| Dedicated `brand_learnings` + event/revision table | Per-record optimistic concurrency, indexed queue/search, immutable transitions, duplicate uniqueness | explicit Brand FK/ACL/RLS, cascade/restrict policy, clean portability/versioning and future evidence links | **Recommended**; requires formal forward/rollback/verify migration |
| Generic Board/canvas node or comment | Existing persistence, but wrong scope and lifecycle | Board deletion/access conflicts with reusable Brand truth | Reject |

Recommendation: dedicated tables with `brand_id` FK, current projection row, append-only revision/event facts, normalized fingerprint uniqueness among active records, and indexes on Brand/status/category/updated time. Service routes reuse `getBrandAccess`; formal Supabase RLS hardening and repository runtime schema strategy must be resolved before rollout. Export/import can serialize safe records separately. Do not implement through opportunistic `CREATE TABLE IF NOT EXISTS` alone.

## 28. Provenance and concurrency

The learning row owns its revision; every mutation requires expected revision. Approval transaction locks/checks proposal, Brand access, duplicate fingerprint, conflict acknowledgement, and inserts one audit event atomically. Replayed approval is idempotent by action key; a different stale request returns 409 and latest safe metadata.

Brand deletion should cascade current Learnings and their events only after the existing owner/name confirmation and documented retention policy; audit retention may instead require tombstoned Brand ID—legal decision unresolved. Board deletion must not delete an approved Brand Learning; its source reference becomes unavailable while the immutable safe evidence summary remains. Source deletion removes/de-identifies the live link, signed URLs, and personal data, not decision facts. Reviewer actor ID, role-at-action, timestamp, from/to state, revision, and text hash are immutable; display names may be resolved separately.

Editing approved text creates a proposed successor. Approval atomically archives/supersedes the old revision. Rollback means approve a new revision copying a prior safe snapshot; never rewrite history. Brand Profile revision and Learning revision remain independent.

## 29. Privacy and safety

Minimize personal data from comments and conversations; require a user-authored/redacted evidence summary. Never persist provider payloads, system/developer prompts, credentials, OAuth material, signed URLs, exported documents, or full chats. Logs contain request/action ID, Brand ID, learning ID, state/classification, latency, and error class—not text, email, raw content, or payload.

Tenant isolation follows authorized Brand membership on every read/write/consume path and source references are re-authorized. Deletion must cover current rows, search indexes, caches, exports, and retention schedules. Approved text is **untrusted user-controlled content**, delimited as evidence in prompts and forbidden from altering system policy, tool instructions, authorization, or data scope. Sanitize rendering, bound size, detect likely secrets/PII, and make prompt injection warnings reviewable. Access loss invalidates caches immediately.

## 30. Compare and synchronization redesign

Campaign Sync lists associated campaigns and states. A review opens grouped sections matching the workspace: **Current campaign version** beside **Latest Brand Profile version**. Each field is labeled in plain language and marked Added, Changed, or Removed; unchanged fields collapse. Unknown fields appear under Additional knowledge, never raw paths in the primary view.

The user first chooses one direction: **Update campaign** (primary for an outdated snapshot) or, in a separate lower-emphasis owner/editor path, **Update Brand Profile**. Then select supported fields, preview final values, and confirm destination plus unaffected objects. “Keep current campaign version” exits without writes. Do not allow an ambiguous two-way merge or two equal destructive buttons.

On confirmation refetch/revalidate Brand revision, Board `updated_at`, access, source values, and selection. Apply one atomic direction, preserve current backup protection (and eventually richer audit), then show success with changed-field count and destination. A 409 keeps selections, displays the changed source, and offers Review latest. Network failures are retryable without claiming success. Viewers see the complete diff and “View only,” with no confirmation control.

## 31. Empty, loading, error, and recovery states

| State | Required presentation/recovery |
|---|---|
| No Brand selected | “Choose a Brand to open its Profile”; Choose Brand; no fake data |
| Brand without avatar | contrast-safe initials and accessible Brand name |
| Incomplete Profile | percentage/essentials count plus one Complete next section action; never shame |
| Board without Brand | “This campaign is not connected to a Brand”; authorized Connect Brand |
| Legacy Core only | preserve/read snapshot; “Campaign has saved Brand information but no linked Profile”; offer explicit link/create flow |
| Snapshot matches | “Campaign version is current”; no update CTA |
| Snapshot behind | “Update available”; Review changes |
| Conflicting changes | explain both sources; require resolution, no auto-merge |
| No Learnings | explain purpose; Create proposal for authorized user |
| Proposed | Needs review queue and count; never consumed |
| Rejected | history with reason and New proposal from this option |
| Stale review | disable action, retain draft, reload latest and compare |
| Access lost | close mutation UI, announce change, route to safe list |
| Network/storage failure | inline error, request ID where safe, Retry; do not optimistic-claim persistence |

## 32. Responsive behavior

* **≥1440px:** 240–280px section rail, 680–800px content, optional 320px summary; no more than two reading columns.
* **1024–1439px:** rail + single content column; summary moves inline; sidebar card remains compact.
* **768–1023px:** collapsible rail/top tabs; editors one column; comparison rows stack while retaining labels.
* **480–767px:** mobile drawer, stacked cards, full-screen edit/review sheets, bottom action region with safe-area padding.
* **320–479px:** one column, wrapping chips, full-width 44px actions, ellipsis only for names with accessible full text.
* **200% zoom:** treat layout as narrow viewport; no horizontal page scroll, two-pane diff becomes sequential “Campaign” then “Profile,” and no sticky element obscures focused content.

## 33. Accessibility

Use one `h1`, hierarchical section headings, and true tab semantics only if content behaves as tabs (`tablist`, roving focus, associated panels); otherwise use navigation links with current-page state. Avatar images use “{Brand} logo”; decorative duplicates are hidden; initials expose the Brand name. Status uses text/icon and polite live regions, not color.

Review actions have learning-specific accessible names. Confirmation dialogs name destination and irreversible effect, trap focus, support Escape where safe, and restore focus to invoker. Keyboard order follows visual order; drawers/sheets return focus. Save, conflict, approval, and queue changes are announced once. Targets are at least 44×44 CSS px; text/non-text contrast meets WCAG AA; reduced motion and forced colors are first-class. Errors are programmatically associated with fields and summarized at the top. At 200% zoom, focused controls remain visible and comparison order remains understandable.

## 34. Analytics and diagnostics

Recommended allowlisted events: `brand_profile_opened`, `brand_profile_section_opened`, `brand_sync_comparison_opened`, `brand_sync_direction_selected`, `brand_learning_proposed`, `brand_learning_approved`, `brand_learning_edited_approved`, `brand_learning_rejected`, `brand_learning_archived`, and `brand_learning_consumed`.

Payloads may contain pseudonymous tenant/Brand/Board IDs, role class, section/category/source enum, prior/new status, revision, count/byte bucket, consumer class, UI locale, viewport bucket, result/error classification, and request ID. Consumption records learning stable IDs/revisions server-side for explanation. Never emit Brand/learning text, evidence, content, email, credential, URL, conversation, provider payload, or free-form rejection reason. Diagnostics must distinguish UI intent, accepted server mutation, and provider request; Phase A–D create zero learning-related AI/provider traffic.

## 35. Migration and compatibility

UI relabeling of `brands.brand_core` to Brand Profile requires no data migration and must not rename storage fields. Board `brand_core_snapshot` and provenance remain unchanged. Legacy Boards with only a snapshot remain readable and are not auto-linked or rewritten. Unknown JSON fields and knowledge-module structures remain round-trippable.

Learning persistence **does require a formal migration** plus rollback and verification, RLS/service authorization, indexes, and back-up/restore validation. Do not backfill Learnings from existing chats, comments, diagnostics, or edits. Roll out reads behind a feature flag, then human proposals/review, then consumption separately. Rollback disables creation/consumption before schema rollback; it never mutates Brand/Profile/Board data. Terminology changes do not justify database renames.

## 36. Implementation phases

1. **Phase A — sidebar Brand simplification:** identity/avatar, relationship line, plain actions; remove Compare from sidebar while preserving selection, association, and persistence behavior.
2. **Phase B — Brand workspace IA:** Profile shell, sections, summaries, focused editors, responsive/accessibility cleanup; preserve JSON and modules; no Learning persistence.
3. **Phase F — compare/sync redesign:** human-readable grouped diff, explicit direction/fields/preview, revision revalidation, current backup/recovery. Do this **before Phase C** so “Profile versus campaign” and conflicts are understood before reusable observations arrive.
4. **Phase C — human-created/reviewed Learnings:** formal persistence, ACL/RLS, audit revisions, proposal/review library; consumption remains separately flagged until proven.
5. **Phase D — campaign observation promotion:** Board-scoped observation contract and explicit promotion with safe provenance.
6. **Phase E — bounded AI suggestions:** explicit evidence-backed triggers, always proposed, never auto-approved, duplicate/conflict/rate containment and privacy-safe diagnostics.

Each phase gets independent browser acceptance, rollback, language, and access tests. Optional later work: verified performance connectors, Channel/Process categories, import/export, richer learning usage explanations, and multi-revision snapshot recovery.

## 37. Deletion and simplification candidates

After replacement acceptance, remove raw JSON paths from the primary comparison, user-facing “canonical,” **Compare Brand Cores** from sidebar, duplicated Brand explanation paragraphs, and ambiguous initialization/update labels. Replace simultaneous tile-plus-editor overload rather than delete underlying fields. Retain JSON compatibility, unknown-field round trips, provenance, revision checks, the recovery snapshot, ACL, and legacy Board readers.

Do **not** delete current dialogs/routes, compatibility adapters, knowledge-module identities, or legacy storage merely because they are hidden by a new UI. First prove no call sites/legacy records require them, add regression coverage, announce deprecation, and provide rollback. Canonical raw JSON editing may remain an administrator/debug escape hatch only if authorized, audited, and outside primary UX; otherwise remove it after field-editor parity is proven.

## 38. Acceptance criteria

* In moderated testing, ≥80% of representative marketing users correctly identify Profile versus campaign version and find the Profile/change action without explanation; no participant must interpret canonical/snapshot/JSON terminology.
* Avatar appears in sidebar/workspace with correct fallback, dark/forced-colors support, and accessible alternative.
* Sidebar has exactly one primary Profile action and one lower-emphasis Brand change action; Compare is absent.
* Every existing Brand field round-trips unchanged through focused editing; unknown fields survive; saved/unsaved/conflict states are accurate.
* Sync names both directions/destinations, previews selected changes, revalidates concurrency, preserves backup, and never writes on view/cancel/failure.
* Every new learning starts `proposed`; provider/service identities cannot approve; only authorized human Brand writers approve/reject; archive removes consumption.
* Consumption includes only active approved records for the exact authorized Brand, within configured bounds, with stable IDs/revisions; proposed/rejected/archived records produce zero prompt context.
* Provenance/history identifies source class, proposer, reviewer, dates, and revisions without exposing prohibited data. Duplicate/conflict/stale cases require resolution.
* No Learning action rewrites Profile, snapshot, Board canvas, approval, schedule, publication, or social state.
* English/German, 320px–desktop, 200% zoom, keyboard, screen reader, reduced motion, forced colors, light/dark mode pass the documented plan with no horizontal page scroll or obscured focus.
* Telemetry contains no text/email/credential/raw content/provider payload. Phase A–D make no provider/AI requests; Phase E only after visible explicit trigger.

## 39. Manual browser acceptance plan

Use seeded, non-production fixtures: Brand A with avatar and complete Profile; Brand B without avatar, incomplete Profile, and a >80-character name; Board 1 linked to A with matching snapshot; Board 2 linked to A at an older revision; Board 3 without Brand; a legacy Board with Core only; viewer/editor/owner identities; proposed, approved, rejected, archived, duplicate, conflicting, and stale-revision Learnings.

1. In English/light/1440px as owner, select A; reload; verify avatar/name restoration and that Board relationship does not change. Open Profile and traverse every section by mouse and keyboard.
2. Switch to B; verify initials, long-name wrapping/accessible full name, incomplete next action, and that Board 1 still says it uses A. Change only after confirmation, then restore fixture.
3. Open Boards 1–3 and legacy Board. Verify current/no-Brand/legacy copy, no mutation during navigation, and correct Campaign Sync availability.
4. On matching snapshot verify “current” and no update. On outdated snapshot review grouped additions/changes/removals, choose fields, cancel, then update fixture; verify revision recheck, destination copy, provenance, backup, success, and one-step recovery.
5. Force Brand and Board revisions to change in a second session; verify stale sync/review retains selections and performs no write until refreshed.
6. As viewer, inspect Profile/snapshot/diff/Learnings and verify every mutation is absent/disabled and direct API attempts fail. Repeat as Board editor without Brand membership, Brand editor, Brand owner/admin according to the matrix.
7. Create a human proposal; verify it is not consumed. Approve, Edit and approve, Reject, repropose with new evidence, Archive, duplicate, and conflict flows; inspect human-readable history and consumption ID/revision diagnostics.
8. Attempt an AI-proposer fixture direct approval and altered/stale requests; verify server rejection. Confirm no provider call in Phases A–D and no automatic mutation anywhere.
9. Repeat key paths in German; verify the exact section 14 terms and no mixed-language primary UI.
10. Repeat light/dark, forced-colors, reduced-motion, keyboard-only, screen-reader announcements, 1024/768/480/320 widths, and 200% zoom. Verify 44px targets, visible focus, focus restoration, dialog naming, no clipped actions/horizontal page scroll.
11. Simulate offline/500/409/access loss/source deletion/Brand deletion/Board deletion. Verify truthful errors, retry/idempotency, retained audit policy, severed safe references, and no unintended Brand/Board mutation.

Record browser/OS, viewport, locale/theme, role, fixture IDs, expected/actual result, console/network evidence, screenshots, accessibility findings, and cleanup. Never use live customer text or real provider credentials.

## 40. Final recommendation

Adopt one user model: the **Brand Profile** is reusable, every campaign can keep a stable **Campaign Brand Snapshot**, and **Brand Learnings** are governed reusable observations. Make the avatar the visual identity anchor. Replace the sidebar's two technical cards with one calm Brand block and move all comparison into Campaign Sync. Rebuild the workspace around Overview, Identity, Audience, Voice & Messaging, Offers & Proof, Learnings, and Campaign Sync, with summaries before focused editing.

Persist Learnings in dedicated Brand-scoped current and append-only history tables. AI may propose; an authorized human Brand editor/admin/owner must approve; only active approved revisions may be consumed. Keep Learnings supplemental, inspectable, editable through revision, archivable, attributable, bounded, and untrusted in prompts. Start with explicit human proposal actions and Brand-wide approved records; defer background suggestions and performance claims.

Implement A, B, F, C, D, E in that order. Relabel the interface without renaming existing database fields. Keep Board snapshots, explicit synchronization, legacy readability, unknown-field preservation, provenance, revision/concurrency checks, one-copy recovery, Board/Brand ACL, privacy boundaries, and provider isolation unchanged. No raw JSON belongs in the primary experience, and no learning may silently rewrite Profile or campaign data.

### Unresolved production decisions before build

* Confirm production schema/RLS parity and choose deletion/audit-retention policy.
* Decide whether a Board editor who can read a Brand may propose, and whether Brand editors may archive approved records; encode one server policy.
* Measure legacy/unlinked/diverged Board prevalence and unknown Core fields before field-editor parity claims.
* Verify avatar source durability, production breakpoints, German copy, forced colors, assistive technology, and 200% zoom.
* Define the first stable source-reference types and retention/redaction behavior; no authoritative campaign-performance source is currently proven.
* Set consumption count/byte/relevance bounds and conflict-classification quality before enabling any prompt consumer.

**Audit conclusion:** implementation is feasible without changing existing Brand/Profile or Board snapshot semantics. Learning persistence requires a new reviewed migration; UI terminology alone does not. This document applies no code, schema, data, workflow, provider, AI, approval, publication, schedule, or social-media change.
