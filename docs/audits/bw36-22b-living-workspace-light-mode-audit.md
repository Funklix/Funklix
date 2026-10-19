# BW-36.22B — Tendra Living Workspace: Light Mode visual and technical audit

**Status:** implementation-ready proposal for review; audit only. No implementation phase or product decision is authorized by archiving this document.

**Baseline:** `Funklix/Funklix`, latest merged `main` at `9f26111420d666c2d80af4419b927d921c72e8b1`, including BW-36.22A, PR #794. Confirmed by fetching `origin/main` on 19 October 2026 (Europe/Berlin) before branching. Current source supersedes historical implementation descriptions.

**Reviewed visual target:** the actual single **Tendra One Living Workspace — LIGHT MODE** image attached to the requesting Codex conversation, visually inspected directly. The displayed reference is approximately 1672 × 941 px. It shows Felix Workspace, selected Appics, the large “Welcome back, Felix” greeting, left continuation card, right dimensional smiling Avatar with speech bubble, violet Brain CTA, four quick actions and a partially visible activity row. This is the authoritative visual direction. The binary is not a repository asset, has not been copied into this PR, and is not licensed for reuse by this audit. No Dark Mode reference was supplied or inferred.

## 1. Executive feasibility assessment

**Feasible with bounded Home composition changes and existing application workflows.** Preserve the expressive split composition, greeting scale, violet identity, luminous Avatar stage, friendly bubble and compact working entry. Insert the Living Workspace before all existing detailed Home modules; keep their projections, navigation, permissions and lifecycle behavior. This requires no new AI integration, analytics infrastructure, schema, production SQL or animation framework.

The central dependency is **canonical selected-Brand detail availability**: the Workspace catalog contains identity, logo, revision and role, not `brand_core` or the saved Avatar. Canonical Avatar creation already exists in Brand Profile. Reuse that authorized detail API and validation through a shared read coordinator, rather than reading the current Board snapshot or creating a parallel Home fetch/cache system. Current dialog-specific detail loading cannot simply be called from Home (§5, §13).

The exact reference mascot is not guaranteed: saved Avatars are arbitrary images, and the current generator explicitly requests a semi-realistic symbolic figure and excludes mascots. Render the actual accepted image without replacing it. CSS/SVG decorations can reproduce its luminous setting, not its facial expression or 3D animation. The reference's performance claims, approval-today count, activity timestamps and four-step progress have no equivalent complete Home contract. Replace them with verified current status, clearly scoped to Brand or Board.

Light Mode fidelity is the design objective. Preserve existing Dark Mode operation using existing theme resolution/tokens and regression checks; redesigning its visual direction remains separately scoped. A conservative implementation can leave the existing detailed composition as the Dark Mode presentation until separately approved.

### Evidence reviewed

- [BW-36.22 Home audit](bw36-22-home-ux-and-visual-design-audit.md) and [BW-36.22A implementation](../implementations/bw36-22a-compact-home-and-continuation.md), including its [visual/validation record](../implementations/bw36-22a-visuals/README.md).
- [Home Foundation](../implementations/bw36-21a-home-foundation.md), [independent Workspace/Brand selection](../implementations/bw36-21a-r2-2-multiple-workspaces-and-brand-selection.md), [Brand/Board consistency](../implementations/bw36-21a-r2-3-brand-board-context-consistency.md), [nonblocking adoption](../implementations/bw36-21a-r2-3r1-nonblocking-brand-adoption.md).
- [B1 knowledge/responsibilities](../implementations/bw36-21b1-brand-intelligence-and-team-responsibilities.md), [B2 Insights/Brain](../implementations/bw36-21b2-campaign-insights-and-ai-brain-home.md), [automatic diagnostics correction](../implementations/bw36-21b2-r2-automatic-home-diagnostics.md). The old B2 statement that a user must first visit Insights is superseded by the current automatic deterministic scheduler.
- [Guided Brand Profile](../implementations/bw36-13r4-guided-brand-profile-setup.md), [Profile entry](../implementations/bw36-13r4r1-brand-profile-entry-and-workspace-actions.md), [responsibility continuity](../implementations/bw36-15r1-responsibility-workspace-continuity.md), [governed Learnings](../implementations/bw36-17-governed-brand-learnings.md), [campaign creation](../implementations/bw36-14r1-restore-complete-campaign-v3.md), plus current source mapped in §13.

## 2. Exact Light Mode reference breakdown

Measurements below are approximate visual readings of the supplied image, not sampled CSS, production screenshots or a claim of pixel-perfect implementation. Colors are proposed starting values to tune against the image and contrast gates.

| Visual element | Observed composition and personality | Fidelity requirement / truthful adaptation |
| --- | --- | --- |
| Shell | Slim white emoji rail, about 86 px wide; top orientation strip about 94 px tall; FW identity left, selected Brand right, small utilities | Retain existing emoji navigation and real Workspace/Brand controls. Do not rebuild the global shell or add inert search/bell controls to imitate artwork. Respect actual expanded-sidebar width. |
| Background | Very pale lavender/white wash; cyan behind Avatar, pink/lilac lower halo; brightness remains high | Home-scoped layered radial/linear gradients; no whole-screen blur or heavy chart-grid backdrop. Starting ground `#f7f6ff`, violet `#7040ff`, ink `#17143d`; validate actual text contrast. |
| Greeting | Eyebrow around x151/y145; large dark greeting x150/y174, about 64 px; muted supporting line about 25 px | Display-name greeting only from actual session identity; generic welcome if unavailable. Workspace remains orientation context, not a fabricated personal name. Headline has strong weight and tight tracking, not an oversized card enclosing all text. |
| Main split | Left working area x139–873; right expressive area x900–1620; roughly equal visual mass | Left holds greeting + compact continuation, right holds Avatar/bubble. Avatar is the emotional focal point; continuation is the clearest work action. No dense KPI grid in the stage. |
| Continuation | White surface x139/y304, approximately 734 × 264 px; 16–20 px corners, 20–24 px padding; Brand mark and Board title; pale metadata strip and violet action | Actual authorized Board identity, saved modification date when valid, explicit open/view action; no claim of last visit. Full list retained below. |
| Avatar stage | Character centered near x1206/y320, roughly 275–320 px across; broad translucent rings and soft glow occupy roughly 540 × 450 px | Use saved accepted Avatar with `object-fit:contain`; preserve full image/background. Orbit/ring decorations behind it, not a mask that removes its identity. |
| Speech bubble | Upper-right x1319/y119, about 290 × 195 px; irregular rounded white shape, delicate violet border, tail toward character | HTML text in a responsive rounded bubble; CSS pseudo-element or SVG tail, EN/DE wrapping. Factual copy under §6. |
| Small signals | Green at upper-left stage; violet to left; orange to right; soft pill geometry | At most two by default, three only with sufficient width and real eligible data. No “All systems go” service-health claim. |
| Brain CTA | Violet pill near x1033/y484, about 355 × 63 px, white chat icon/arrow | Clear native button; match prominence while using actual Board context and eligibility. Separate label/caption may grow for German/mismatch. |
| Decoration | Sparse stars, tiny curved strokes, orbit arcs, handwritten annotation | CSS or small decorative SVGs, hidden from assistive technology, pointer-inert. Handwritten copy is optional, never the only context disclosure. |
| Quick actions | Heading near y600; four horizontal white cards y633–742, around 355 × 109 px, 16 px gaps; pastel emoji/icon tiles | Four navigation actions using existing destinations; distinct pink Brain, blue Insights, mint Learning, peach responsibilities accents. Counts only when validated. |
| Lower boundary | “What's new with Appics” near y779; three status/activity cards begin y815 and continue below frame | Prefer “At a glance for {brand}” / “{brand} im Überblick” with current status, not invented recency. Follow with a clear detailed Workspace heading. Natural scroll is intentional. |

Typography proposal: existing application font; desktop headline 48–64 px/1.05–1.12, body 16–18 px/1.45–1.6, section labels 20–24 px, card title 18–20 px, metadata at least 13–14 px. Start with 700–800 headline weight and approximately −0.035em tracking. Retain readable darker muted ink; do not copy pale reference text where contrast fails. Cards use 16–24 px radii, stage/bubble 40–64 px, CTA full pill; shadows are low-opacity violet, approximately `0 10px 30px rgb(75 45 145 / 6%)`, not hard dashboard borders everywhere.

## 3. Annotated desktop layout and dimensions

Coordinate proposal for a **1600 × 900 browser viewport with an approximately 80 px compact rail**. The application owns real shell geometry; never hardcode that rail size into Home. Available width after rail is about 1520 px. Home inner width is about 1408 px with 56 px outer margins; widening the current 1200 px Home cap is an explicit decision (§18).

```text
x=0       80      136                                  1544     1600
| rail     |      orientation / existing selectors       |        |
y≈0–96            Workspace identity     Selected Brand + real utilities
y≈128     ┌───────────────────────────┬──────────────────────────┐
          │ eyebrow                  │ bubble       (2 signals) │
          │ Welcome back, {name}     │       saved Avatar       │
          │ selected Brand subtitle  │    soft halo / orbit     │
y≈290     │ Continue where you left  │                          │
          │ off: one actual Board   │                          │
          │ metadata + Open/View    │    AI Brain CTA + scope   │
y≈550     └───────────────────────────┴──────────────────────────┘
y≈578     Quick actions                      See Workspace details ↓
y≈616     [ Brain ] [ Insights ] [ Learnings ] [ Responsibilities ]
y≈750     At a glance: factual current status (optional, no timeline)
y≈850+    Workspace details: all existing BW-36.22A modules continue
```

Main grid: about 680 px left + 32 px gap + 696 px right. Hero is about 430–460 px high; greeting 125–145 px; continuation about 240–265 px including metadata; Avatar image 280–320 px in a stage 420–450 px high; bubble 240–280 px wide with intrinsic height; Brain CTA at least 56 px high. Quick actions 98–112 px high with 16 px gaps. Optional status row must not squeeze the detail modules into the hero.

At 1440 px with compact rail, target inner width about 1248 px, columns about 600/616 px with 32 px gap; headline 48–56 px, Avatar 260–290 px, bubble 220–250 px. At an expanded sidebar, measure **available Home content width**, reduce margins to 24–32 px and reflow before overlap. These are design targets for populated ordinary labels, not fixed heights or guarantees for long German names. Mismatch disclosure belongs next to the affected CTA and in the existing notice; it may increase height. The first viewport should show continuation, Avatar and quick-action heading/row at normal desktop size. Detail content starts below the new experience without being deleted or collapsed by default.

DOM order proposal: orientation/selectors → Living Workspace heading/intro → continuation → Avatar/bubble/Brain → quick actions → optional current-status row → Workspace details → existing Next Moves → full Continue Working → B1 → B2 → full Brand exploration. A two-column CSS grid supplies desktop placement without reversing mobile/keyboard order. Existing detail header becomes compact orientation/management rather than a second greeting. Keep a single H1 and explicit section headings; do not duplicate selector IDs.

## 4. Responsive Light Mode composition

Use content-width breakpoints; viewport sizes are review cases. Existing sidebar preference must not force a two-column hero into insufficient space.

| Review size | Proposed layout / approximate dimensions | Acceptance focus |
| --- | --- | --- |
| 1920 × 1080 | Center max 1440 px composition; 32–48 px gutter; 320–360 px Avatar; avoid enlarging blank space indefinitely | Strong split and lower detailed boundary; no giant character covering navigation |
| 1600 × 900 | §3, ~1408 px inner with compact rail; four quick actions | Continuation and Avatar both immediately identifiable |
| 1440 × 900 | ~1248 px inner with compact rail; 48–56 px heading; 260–290 px Avatar | Match reference hierarchy; scope text and CTA remain fully readable |
| 1280 × 800 | 24 px margins; split only if content ≥1050 px; Avatar 220–260 px; actions 2 × 2 when needed | Expanded sidebar can trigger stacked mode; do not shrink fonts to force four cards |
| 1024 × 768 | Normally stacked or narrow split based on actual content; continuation before stage; stage 280–340 px high | Natural vertical scroll, no bubble overlap; detail not lost |
| 768 px tablet | Single column, 24 px gutters, ~240 px Avatar, bubble above/right within flow, quick actions 2 × 2 if labels fit | Rail and touch target clearance; names wrap |
| 375 px mobile | 16 px gutters; heading 32–36 px; continuation full width; Avatar 190–220 px, stage ~300 px; bubble in normal flow; single-column actions | Avatar recognizable within first scroll; no forced single-viewport composition |
| 320 px mobile | 12–16 px gutters; heading 28–32 px; Avatar 160–190 px; bubble and CTA separate full-width rows; single-column actions | No horizontal overflow or tiny text; long DE/name stress and focus visibility |

Mobile reading order preserves actionable continuation before the full Avatar stage; the top of the Avatar stage can be visible after continuation on typical phones, but full names, mismatch text and real shell clearance take precedence. Limit stage signals to one or move them to current status. Hide decorative annotation/orbits first, never essential scope. Keep CTA width intrinsic/full-width and label wrapping.

The scroll owner is `#dashboard-view`, not the document. Reuse `updateClearance`, `overlayRects` and `clearFocusedOverlay` from `home-foundation.js`; these account for existing fixed mobile sidebar/floating controls and focus collisions. Retain safe-area padding, viewport-end adjustment and scroll margins. Test the last detail action scrolling above the occupied control rectangles. Native 200% zoom and 400% reflow, text enlargement, landscape short-height, EN/DE and both sidebar preferences are release gates, not established by this audit.

## 5. Existing Brand Avatar integration

### Saved data, generation and editing

Canonical reusable Brand data lives in `brands.brand_core` (`api/_brands-storage.js`), specifically `brand_core.brandDNA.avatar`. Fields include `imageUrl`, `prompt`, optional `style`, `generatedAt`, `logoReference`, and `userApproved`; parent DNA has independent `userApproved`. `brand-profile-setup.js:acceptedAvatar(brand)` requires **both approvals** and a safe HTTPS/root-relative image URL. Reuse this predicate; do not promote a generated draft to saved accepted identity. Catalog `logo_url` is a company logo, not an Avatar. Workspace `avatar_url` is a third independent identity image.

`brand-profile-setup.js:createSession` owns `generateAvatar` and `acceptAvatar`. Generate requires saved confirmed DNA and no unsaved content; it POSTs `/api/generate-brand-avatar` with canonical `brandId` and `revision`. The result is a session draft. Save Avatar merges it into the draft Core with `userApproved:true` and calls the existing revisioned save. `api/brands/[id].js` PUT checks canonical edit permission, preserves omitted nested fields through `mergeCore`, uses revision compare-and-swap and returns 409 on conflict. Generation alone does not save the Brand. `renderBrandAvatarSection`/`generateBrandAvatar`/`acceptBrandAvatar` in `app.js` are the older **Board-local** path: `state.brandCore`, local Brand Brain storage and subsequent Board save. They must not supply selected-Brand hero identity.

`api/_brand-generation-access.js:resolveGenerationBrand` independently requires signed session, Brand access, `canEditCanonicalBrand`, matching revision and authoritative saved Core for Brand calls. Legacy Board calls require editable Board access. Profile editing also checks owner/admin/editor and canonical capability. A Board editor is not thereby a canonical Brand editor; Workspace membership alone grants neither. Viewers may see an authorized saved Avatar, but receive Profile/view guidance rather than generation controls.

The generator calls `gpt-image-1`, 1024 × 1024, high-quality image generation, then uploads **PNG** through `api/_image-storage.js:uploadGeneratedImage` to Vercel Blob. `logoReference.used` is false: the generation endpoint has no image-reference input. Do not promise that generation reproduces a saved logo or the approved mascot. No generation, paid AI or image request was executed in this audit.

### Rendering and missing capability boundary

Render one ordinary `<img>` of the accepted saved URL, reserved width/aspect ratio and `object-fit:contain`, decoding asynchronously. Existing accepted-Avatar validation restricts URL scheme, not MIME; browser-compatible JPEG/WebP/PNG can render if already saved, but the Avatar generator produces PNG. The shared image uploader supports PNG/JPEG/WebP/GIF; that does **not** establish a generic Avatar-upload workflow. No saved SVG, video, sprite rig, transparent cutout or animated Avatar contract is guaranteed. Do not add data URLs/remote SVG injection to broaden support. On decode/network error, retain stage dimensions and show “Brand Avatar unavailable. Retry safely.” / “Brand Avatar nicht verfügbar. Bitte erneut versuchen.” Distinguish failure/loading from confirmed absence.

Confirmed absence: **“Bring your Brand to life.” / “Erwecke deine Brand zum Leben.”** with a polished abstract pastel stage and existing **Open Brand Profile / Brand-Profil öffnen** navigation for the selected Brand. Once in Profile, choose **Brand Avatar**; that screen already offers generation, direction, review and save. Critical current limitation: `openRegularBrandProfile` and `createSession.initialSection` special-case only **Brand Learnings**, so passing `section:'Brand Avatar'` does not directly open the Avatar editor today. Phase 2 may minimally extend the existing section adapter under separate authorization; until then link to Overview and instruct the user to select Brand Avatar. Do not advertise one-click generation from Home. If DNA is incomplete, link to the existing DNA section through Profile, without creating an unsupported deep link.

The current `sidebarProfileCache` stores only Core by Brand ID after Profile reads/saves. It lacks response access/revision/freshness metadata and is not sufficient authorization for hero reuse. §13 proposes sharing a validated selected-detail read owner with the existing Profile loader. Do not mount/open the dialog to fetch an image invisibly. Reuse accepted assets as-is; no silent crop, style transfer, regeneration or mutation to fit the mascot. Static whole-image floating is feasible; facial blinking, eye tracking, speaking and articulated 3D motion need purpose-built assets and are not supported.

## 6. Deterministic speech bubble specification

The bubble is presentation over existing authorized projections. It never calls an AI service or reads statements/history to improvise personality. Selected Brand identity and current-Board evidence remain separately named. Use complete EN/DE dictionary entries in `language.js`, text nodes/interpolation and plural forms; no concatenated German sentence fragments. Target 70–120 characters plus names, normally 2–4 desktop lines; dynamic names wrap rather than being truncated to satisfy a hard cap. Detailed meaning stays in adjacent scope/caption when necessary.

| Category / priority | Exact source, authorization and eligibility | Freshness / lifecycle | Proposed EN / DE copy | Fallback |
| --- | --- | --- | --- | --- |
| Confirmed action, 0 (temporary) | Successful revisioned Profile save confirmation (`reconcileConfirmedBrand` path) or successful Learning mutation event plus a revalidated response; only exact captured selected Brand/account | Current client-confirmed action only; show once for ≤5 s, never replay after reload; discard on scope change | “Your Brand Avatar is saved.” / “Dein Brand Avatar ist gespeichert.” Only for confirmed Avatar save, not generic Core save | Next eligible category; no timer-derived achievement |
| Contextual onboarding, 1 | Ready catalog + validated canonical detail; `acceptedAvatar` and `readiness` for missing identity; `model.canCreate`/actual Profile capability for actions | After successful read, recheck on save/context change; unknown is not incomplete | “Bring your Brand to life.” / “Erwecke deine Brand zum Leben.” Or “Start with your Brand Profile.” / “Starte mit deinem Brand-Profil.” | Generic greeting when denied/unavailable; no setup accusation |
| Learning review, 2 | `learningSummary` from valid `brand_learnings_v1`, selected Brand; `proposed>0`, `canWrite===true` for review wording | Existing Home invalidation on focus/visibility/mutation and `sameScope`; pending/error removes old count | “{n} Learning is ready for review in {brand}.” / “Für {brand} ist {n} Learning zur Prüfung bereit.” Plural: “{n} Learnings are ready for review in {brand}.” / “Für {brand} sind {n} Learnings zur Prüfung bereit.” | For reader use “{n} proposed Learnings in {brand}.” / “{n} vorgeschlagene Learnings für {brand}.” Otherwise next category |
| Structural opportunity, 3 | `homeCampaignInsights()` status `ready`, current evidence key, first applicable finding in engine order; authorized hydrated Board in Workspace | Recalculate via existing scheduler only; discard on Canvas fingerprint/generation/access/source change | “A structural check in {board} needs a look: {finding}.” / “Sieh dir diese Strukturprüfung in {board} an: {finding}.” Use actual localized finding title | If lengthy, “Review structural checks in {board}.” / “Prüfe die Kampagnenstruktur in {board}.” No opportunity/success promise |
| Continuation, 4 | Candidate in §8, from authorized `model`; catalog/loader owns access | Revalidate exact Board on activation; never call recency “last opened” | “Ready to continue {board}?” / “Bereit, an {board} weiterzuarbeiten?” Read-only: “Take another look at {board}.” / “Sieh dir {board} wieder an.” | Browse Boards |
| Brand introduction, 5 | Selected authorized `model.brand.name`; no approved-knowledge claim | Rebuild immediately on explicit Brand/Workspace/account change | “Let's explore ideas for {brand}.” / “Entdecken wir Ideen für {brand}.” | Generic greeting |
| Friendly greeting, 6 | Actual `state.user` display name if available; authenticated Home context; no time-of-day inference needed | Current session; no storage or personal history inference | “Welcome back, {name}.” / “Willkommen zurück, {name}.” Missing name: “Welcome to your creative Workspace.” / “Willkommen in deinem kreativen Workspace.” | Sign-in/availability state |

**Rotation:** recommend meaningful-state changes with manual Previous/Next controls when ≥2 eligible messages; no timer by default. Select the highest eligible message on a new scope, then retain stable message ID while its evidence remains valid. Do not replace focused controls or reset a manually selected valid message every runtime tick. Recompute eligibility using already-updated projections, not fresh requests per message. Limit initial set to three accurate messages; no artificial carousel pagination for one message.

If timed rotation is later approved, use ≥12 s dwell and an explicit pause/resume button; pause on hover, focus anywhere inside stage, hidden tab and user pause. Resume only from explicit user action after interaction. Reduced motion disables automatic advance and transitions. State-driven urgent invalidation still removes stale content even while paused; replace with neutral available context, not the next old count. Animate only opacity 120–180 ms, with no layout movement. Keep bubble off live-region auto-announcements; announce user-driven selection politely and confirmed save once. Context changes clear message IDs, action receipts and pending transitions **before** showing the incoming identity. No unverified “approved today,” “AI found,” “campaign active” or “all systems go” copy.

## 7. Existing AI Brain navigation contract

Three independent identities must remain explicit:

1. **Navigation Brand:** `state.session.brandId` / `selectedBrandPreferenceId()`, scoped to current authorized Workspace catalog; changes browsing preference only.
2. **Loaded Board Brand:** `state.boardBrandAssociation`, validated by `brandBoardNavigationContext()` against hydration/access/generation; not derived from the navigation Brand or an image snapshot.
3. **AI Brain:** existing current saved editable Board context and its authorized snapshot/knowledge resolution; `api/ai-brain/advice.js` independently authorizes submission and supplementary canonical/approved-Learning context.

Hero image activation and its separate CTA should invoke the same existing Home `brain` action, using captured `actionScopes` and `boardActionContexts` as appropriate. `home-foundation.js` delegation must recheck `sameScope`, catalog Board membership, complete hydration and `canEdit===true`; `app.js:openHomeBoardDestination('brain')` then clicks existing `aiBrainNavButton`, preserves draft/transcript and focuses `#ai-brain-question` only after navigation succeeds. This sends no question, replaces no draft, performs no inference and creates no separate chatbot.

Matched context wording: **“Open AI Brain for {board}” / “AI Brain für {board} öffnen.”** A shorter “Talk to your Brand Brain” label is acceptable only with always-visible actual Board context and eligibility caption. Mismatch wording: **“Open AI Brain for {board}”**, caption **“Selected Brand: {selected}. AI Brain uses the open Board, {board} · {boardBrand}.” / “Ausgewählte Brand: {selected}. AI Brain nutzt das geöffnete Board {board} · {boardBrand}.”** Hidden Brand association: say “No visible Brand association” / “Keine sichtbare Brand-Zuordnung”, never reveal snapshot names. Confirmed unassigned remains distinct.

No eligible Board: Avatar remains a recognizable image with no misleading Brain button; offer **“Open a saved Board with edit access to use AI Brain.” / “Öffne ein gespeichertes Board mit Bearbeitungszugriff, um AI Brain zu nutzen.”** + Browse Boards. Read-only: **“AI Brain requires editable Board access.” / “AI Brain erfordert Bearbeitungszugriff auf das Board.”** Offer View Board/Browse instead. Loading/access failure retains explicit pending/unavailable state. Do not silently load the continuation candidate merely because the Avatar is clicked. An Avatar image button and a separate CTA may share an action, but must have distinct accessible labels and no nested buttons; bubble navigation/review controls are siblings, not inside the image button.

## 8. Real continuation and progress feasibility

`home-foundation.js:model(context, metadata, filter)` is the authoritative existing ordering: selected Brand connected Boards → other visible Brands → unassociated/hidden; saved `updated_at` descending inside each group; missing dates last; stable catalog order for ties. `/api/boards` metadata is intersected with catalog IDs; collection names/Core never authorize identities. The six-Board preview and Show all expand presentation only. Preserve this full detailed module and ordering.

**Proposed hero selection:** use the first selected-Brand connected Board in the existing **unfiltered** model order. If the currently loaded authorized Board belongs to that selected Brand, offer that Board as the explicit current-work continuation. If no matching Board exists, offer the authorized current Board as **“Continue open Board: {board}”**, with its actual Brand/mismatch context; otherwise first available model entry labeled **“Open saved Board”**. With no candidate offer Browse or permitted Create project. This is an explicit product decision: the existing model does not promote current Board globally, and the hero must not change the detailed order. It has no personal last-visit history, so “Continue where you left off” is an inviting section title, not a claim that the selected Board was last visited.

Activation uses existing `actions.board(id)`: current Board clicks the Canvas navigation adapter; another Board uses `/boards/{id}` and existing loader/auth/leave behavior. Viewers see View Board, not Edit/Continue editing. Saved modification date is only valid `updated_at` from authorized metadata; label **“Last saved modification” / “Zuletzt gespeichert geändert”**, not “You were working on campaign strategy.” Unknown timestamps retain an actionable Board and an explicit date-unavailable statement. Preserve missing/partial metadata explanations below.

| Reference progress candidate | Evidence and exact feasible formula | Recommendation |
| --- | --- | --- |
| Completed responsibilities | Supported types from `FunklixCampaignResponsibilities.types`; current hydrated Board nodes; require nonempty unique IDs and normalized assigned owner. Let A = these assigned nodes, C = nodes in A where `isDashboardNodeComplete(n)` is true (Approved/Published or legacy done/completed/complete). Display `C.length of A.length assigned nodes complete` only when A.length>0 | Possible deterministic helper for **current candidate only**; runtime/unsaved label required. `responsibilitySummary.items` excludes completed nodes so cannot supply denominator. No fan-out to other saved Boards. Prefer count, not percentage; never describe as whole-campaign completion. |
| Campaign creation steps | Brand Profile readiness and generated Canvas structures are different systems; campaign-v3 node presence does not establish four persisted workflow milestones | No “3 of 4 steps.” Use “Campaign structure present” only after supported structure validation, or qualitative “Open Board”; do not add a parallel maturity classifier to Phase 1. |
| Saved lifecycle/status | Individual nodes have status; existing Board collection/catalog has no audited universal saved campaign-completion field | No global Board percentage; do not repurpose `updated_at` or count nodes as progress. |
| Brand identity readiness | `brand-profile-setup.js:readiness` has section statuses and confirmed-value predicates, including optional/partial fields | Use a specific incomplete-section action after canonical read, not an onboarding percentage or Board progress bar. |

Default: omit the decorative progress track until a separately approved count-based responsibility indicator is available. Saved nonloaded candidates show saved metadata only. A visually attractive qualitative chip is more truthful than a segmented bar that resembles an invented workflow.

## 9. Supported status indicator matrix

A = existing validated projection ready for presentation; B = existing deterministic data needs a bounded presentation helper/shared reader; C = additional backend aggregation needed; D = unsupported/not recommended. “Ready” means source readiness, not implementation authorization. Hero defaults to selected-Brand proposed Learning count plus assigned-to-me current-Board count; when zero/ineligible, a fresh structural-check count may substitute. Never force three nonzero pills.

| Signal / class | Source, exact calculation and scope | Freshness; persistence; completeness | Permissions, wording and destination |
| --- | --- | --- | --- |
| Proposed Learnings, A | `learningSummary` → valid `counts.proposed`; selected Brand, not all Workspace Brands | Persisted library aggregate covers all pages; sparse missing status = 0 only within valid counts. Home reads one bounded page and discards statements/history; refresh on focus/visible/mutation and scope invalidation | Separate Learning authorization; owner/admin/editor can review, viewer can view. “{n} Learnings awaiting review · {brand}”; Profile Brand Learnings |
| Approved Learnings, A | Same response `counts.approved`, selected Brand | All-page current-status total, not approvals today, not proof of strategic truth | “{n} approved Learnings · {brand}”; view library. No green service-health implication |
| Assigned to me, A | `responsibilitySummary(c).mine`: unique-ID, assigned, incomplete supported nodes whose normalized owner email matches session email | Current hydrated Board runtime only; includes unsaved changes; generation-bound. Complete for projected supported nodes, not all team work or all Boards | Authorized Board view; edit capability enforced by manager. “{n} assigned to you · {board}”; existing responsibilities manager |
| Structural findings, A | `homeCampaignInsights().findings.length` only in fresh `ready`; existing applicability filters and engine ordering | Runtime-derived local diagnostic snapshot; source `loaded_saved` or `live_unsaved`, actual analysis time and key. Not performance analytics; no cross-Board total | Board view/catalog identity; “{n} structural checks to review · {board}”; existing Insights. `none` means no applicable checks, never “campaign healthy” |
| Visible Brands/saved Boards, A | `model.workspace.brands.length`, `.boards.length` from authorized catalog | Counts currently available in selected Workspace; bounded catalog coverage, not organization totals; collection date failure does not remove identities | “{n} Brands visible to you” / “{n} available Boards”; full Brand exploration / Boards |
| Assigned-node completion, B | Formula in §8 over current supported assigned unique-ID nodes; not `items.length` denominator | Current Canvas runtime; persisted only after normal Board save; zero denominator hides result; no claim about other Boards | Board view; “{c} of {a} assigned nodes complete · {board}”; responsibilities |
| Approved today / recent Learning activity, C | `brand_learning_events` exists; library pages sorted by status and item update, each history max 10 events | Current response is not a complete time-window event stream. Cannot count today's approvals from `counts.approved` or first page | Additional independently authorized aggregation with defined time zone/day boundaries would be needed. Defer; no API/SQL in this audit |
| Brand active / all systems go, D | No audited health/presence contract in Home | Decorative motion cannot establish activity or service availability | Replace with “Selected Brand · {brand}”; Profile destination if actionable |
| Engagement up 24%, campaign success, D | No comparable authorized Home outcome baseline/window in these projections | Even separate social features do not establish a complete Brand-wide comparison or attribution | Omit; never copy illustration metrics |

Failed, denied, malformed, unknown and pending never become zero. Only show identity from the source permitted to name it. The catalog may legitimately name a Brand while a Learning module cannot confirm its library access. On pill activation revalidate captured scope and current eligibility, then delegate; pills do not approve Learnings or assign tasks.

## 10. New-user and experienced-user states

| Actual state | First-screen adaptation and clear next step | Boundary |
| --- | --- | --- |
| No Workspace | Warm generic welcome; existing Create Workspace for signed-in eligible user; no Brand Avatar or fictitious work | Preserve creation controller and authoritative result; public/anonymous sees Sign in |
| Workspace without Brands | Workspace identity, Create/manage Brand through existing capability-aware flow; abstract invitation stage | No auto-created Brand/Board or generated image |
| Selected Brand without Avatar | Confirmed absence invitation from §5; Profile action; continuation still available | Loading/denied is not absence; accepted identity/DNA prompts disappear when complete |
| Brand with Avatar | Actual saved accepted image, contextual bubble and eligible Brain CTA; no setup prompt | No regeneration on render or Brand switch |
| Incomplete Brand identity | Use existing `readiness` section state after canonical read; one relevant Profile/DNA instruction | Preserve usable Boards and any accepted Avatar; no invented completion percentage |
| Brand without Boards | Keep Avatar and Profile; permitted Create project, otherwise Browse/contact appropriate owner through existing UX | No Brain action until saved editable Board; don't invent a chat with selected Brand |
| Board without generated structures | Continue/View Board; accurate existing empty/no-applicable-diagnostic state; existing campaign creation action in Canvas when allowed | Do not infer exact campaign workflow progress from node count or auto-generate |
| Several Brands/Boards | Compact selectors, one hero candidate, saved Avatar, ≤2–3 signals, four quick actions, details below | Full six-Board preview/expansion and all Brand exploration preserved |
| Selected Brand differs from loaded Board Brand | Avatar belongs to selected Brand; continuation/Brain/Board signals name their actual Board/authorized Brand; retain mismatch notice | Brand preference never changes Board association, snapshot or inference context |
| Read-only Board | View continuation, visible Board diagnostics/responsibilities, explicit Brain edit requirement and Browse | Independent Brand rights can still allow Profile edits; do not conflate roles |
| Hidden/unavailable Brand data | Distinct hidden-association copy; no snapshot identity/Avatar leak; canonical or Learning unavailability state separately | No unauthorized fallback from Board snapshots or previous selection |
| Network/loading failure | Stable stage/card space, nonanimated skeleton or brief loading text, module-level retry; keep independent catalog/Board navigation usable | Abort stale requests; retry no automatic generation. Failed image ≠ no Avatar; failed catalog ≠ empty Workspace |

Do not order users back into setup merely because optional assets or a Learning library are empty. No routine “all done” or repeated celebratory state on every render.

## 11. Animation and playful interaction specification

Effects are proposed defaults for review, not an implementation. Use ordinary CSS transforms/opacity; no canvas/WebGL, animation library, sprite generation or image transformation. At most the Avatar and one ambient layer move; everything else responds to real interaction. Static appearance must retain the approved composition.

| Effect | Purpose / trigger / appearance / timing | Mobile / reduced motion | Cost, technology and misleading-activity check |
| --- | --- | --- | --- |
| Floating Avatar | Presence when saved image has decoded and Home is visible; translateY 0→−5→0 px, 7–9 s ease-in-out, at most 2 cycles by default | 2–3 px on mobile; none with reduced motion; stop on pointer/focus interaction | Composite one wrapper with CSS keyframes, no per-frame JS. Decorative presence, not evidence of “online” or active inference |
| Breathing halo | Luminous depth behind image; opacity .25→.35, scale 1→1.015, 9 s, synchronized with finite float | Static on mobile/reduced motion | One gradient layer; no animated blur/filter. Prefer this **instead of**, not in addition to, multiple continuous effects |
| Orbital particles | Sparse reference personality; 3–5 static stars/curves, optional one 8 px drift on initial stage entry, 800 ms once | Hide smallest decorative pieces on mobile; all static with reduced motion | Inline decorative SVG/CSS, no particle engine; no “processing” spinner connotation |
| Bubble transition | New eligible state/manual message selection; crossfade opacity 120–180 ms | Same intrinsic layout; immediate replacement with reduced motion | CSS transition; reserve ordinary space, no typing effect or token streaming. No pretend live AI speech |
| CTA/image interaction | Hover/focus indication, soft ring and ≤1 px lift, 120 ms; press settles | Touch press tint only; reduced motion keeps focus/contrast | CSS; native focus ring remains. No glowing ring labeled as active model work |
| Confirmed celebration | Only exact successful captured Avatar save or approved Learning action receipt; one small sparkle/confirmation ≤600 ms, text ≤5 s | Text-only mobile/reduced motion | 2–3 SVG/CSS accents max; never on mere counts increasing, page load, network optimism or generated-unsaved draft |
| Energy/ripple | Optional one low-opacity ring on actual Brain navigation press, ≤400 ms, only if navigation accepted | Omit mobile/reduced motion | Transform/opacity, no continuous ripple; cannot imply inference is underway. Lower priority than legible scope |
| Emoji navigation | Preserve existing emoji rail and active/focus treatment; no bouncing every icon | Existing shell behavior | No new framework or navigation replacement; emojis with text/accessible names where needed |

Any motion lasting >5 s must have an accessible **Pause animation / Animation pausieren** control, even decorative ambient motion; default finite cycles can stop automatically, and user pause must stop immediately. Pause when Home/tab is hidden or stage is offscreen; resume only within captured current scope, never restart on each 1-second Home sync. A persistent pause preference, if chosen, stores only display preference, never business completion. No motion/audio on every element, no rapid flashing, no moving text, no celebratory inference from a backend timeout.

## 12. Activity and KPI feasibility

`app.js:state.activityFeed`, `sanitizeActivityFeed`, `appendActivity` and `renderActivityFeed` are **current-Board collaboration feed** machinery. The feed is included in Canvas serialization (`serializeState` path), restored with Canvas state and can be updated from remote Canvas. Thus actual saved Board events exist; it is inaccurate to call the whole feed client-only. However, new entries may be local/unsaved, the feed is capped, and its sanitizer can fill absent timestamps with current time. “Last seen”/unread state is localStorage. It is not an authoritative cross-Brand timeline, comprehensive event log or a safe source for invented “2h ago” cards without validated event provenance.

`api/_brand-learnings.js:appendEvent` writes real lifecycle events; `readLibrary` returns all-status aggregates but only 50 rows plus bounded per-row history (10). Neither the row page nor history covers a complete recent time window; approved count is current status, not events today. Board `updated_at` is a saved modification timestamp, not a classified user action, last opened date or team event. Diagnostics and assignment counts are current projections, not dated discoveries.

Recommend the reference's lower row as **current status**, with cards such as “Review Learnings · {brand},” “Assigned to you · {board},” and “Structural checks · {board}.” Use real counts/states from §9; omit relative timestamps and the “What's new” implication. No additional reads beyond the reused Home sources. Actual saved Board collaboration activity could later be shown only with explicit Board scope and original valid timestamps, separated from unsaved updates; not Phase 1.

A: existing count/status cards, valid saved modification metadata. B: bounded assigned-node completion and shared canonical readiness/Avatar projection. C: complete Brand/Workspace recent-event feed, approvals today and cross-Board task totals require new backend aggregation and product definitions. D: engagement uplift, campaign success, universal health/presence and fabricated opportunities. No analytics infrastructure or server query is added by this audit.

## 13. Data/API reuse and exact source map

File links resolve relative to this document; function names are stable evidence anchors at this baseline.

| Source | Relevant functions/contracts | Implementation boundary |
| --- | --- | --- |
| [index.html](../../index.html) | `#dashboard-view > .mission-control > #home-foundation`; legacy `#dashboard-title`, `#dashboard-continue-working`, `#dashboard-hero-avatar` and other mounted siblings | All static IDs remain. `home-foundation.css` hides legacy siblings; those are not the BW-36.22A detailed modules to unhide. |
| [home-foundation.js](../../home-foundation.js) | `model`, `sameScope`, `learningSummary`, `responsibilitySummary`, `create`; nested `draw`, `identity`, `nextMoves`, `intelligence`, `boardIntelligence`, `sync`, `load`, `loadLearnings`, `refreshLearnings` | One Home owner and existing projections. Hero can be a new presentation helper within `create`; no duplicate collection/controller. `host.replaceChildren()` requires deliberate state/focus preservation. |
| [app.js](../../app.js) | `brandBoardNavigationContext`, `selectSessionWorkspace`, `selectSessionBrand`, `openSelectedBrandBoards`, Home `context/actions` registration near `homeFoundationController = ...create` | Existing catalog/selection/leave guards remain sole navigation owners; add minimized selected-detail projection here, not direct renderer access to all state. |
| [app.js](../../app.js) | `isCanonicalBrandDetail`, `loadCanonicalBrandDetail`, `reconcileConfirmedBrand`, `openRegularBrandProfile`, `renderGuidedBrandProfile`, `guardBrandProfileLeave`, `sidebarProfileCache` | Existing detail loader is dialog-gated and writes dialog state/cache; extract/share its **read transport, validation and scope ownership** minimally. Keep Profile editing/draft/conflict controllers unchanged. |
| [brand-profile-setup.js](../../brand-profile-setup.js) | `acceptedAvatar`, `readiness`, `createSession`, `current`, `generateAvatar`, `acceptAvatar`, `save`, `mount` | Reuse predicates and canonical workflow. Initial section currently only honors Brand Learnings. No Home generation controls or percentage model. |
| [Brand item API](../../api/brands/[id].js), [storage](../../api/_brands-storage.js), [Brand access](../../api/_brand-access.js) | GET/PUT, `serializeBrand`, `getBrandAccess`, `mergeCore`, revision/access fields | Reuse `/api/brands/:id`, no new endpoint. Do not weaken source access or bypass revision conflicts. |
| [Avatar generator](../../api/generate-brand-avatar.js), [generation authorization](../../api/_brand-generation-access.js), [image storage](../../api/_image-storage.js) | `resolveGenerationBrand`, `buildAvatarPrompt`, `uploadGeneratedImage` | Existing explicit paid workflow only. Audit and Home rendering perform zero generation requests. |
| [workspace-catalog.js](../../workspace-catalog.js), [catalog API projection](../../api/_workspace-catalog.js), [workspace-sidebar.js](../../workspace-sidebar.js) | Authorized account-bound Workspace/Brand/Board collections; Brand logo/revision/role | Catalog has no canonical Avatar/Core. No collection snapshot identity enrichment; no broad Brand detail fan-out. |
| [Learning API](../../api/brands/[id]/learnings.js), [library](../../api/_brand-learnings.js), [brand-learnings.js](../../brand-learnings.js) | `operate`, `authorize`, `readLibrary`, `appendEvent`; `brand_learnings_v1`; mutation invalidation event | Existing Home aggregate read only; no separate hero read or event scan. Independent app identity/Brand ACL. |
| [campaign-responsibilities.js](../../campaign-responsibilities.js), [app.js](../../app.js) | `types`, `openCampaignResponsibilities`, `normalizeNodeStatus`, `isDashboardNodeComplete`, `focusNodeInCanvas` | Current loaded Board supported nodes only; owner email, not display name, establishes assignment. Manager remains the write owner. |
| [app.js](../../app.js) | `homeInsightsContext`, `ensureHomeInsightsDiagnostic`, `cancelHomeInsightsRequest`, `homeCampaignInsights`, `currentInsightsCanvasIdentity`, `captureInsightsDiagnostic`, `openHomeBoardDestination` | Shared local deterministic engine; existing applicability/freshness key and deferred scheduler. No parallel diagnostics or AI request for the bubble. |
| [Advice API](../../api/ai-brain/advice.js), [Learning context](../../api/_ai-brain-learning-context.js) | Independently authorized Board advice and approved supplementary knowledge | Existing explicit submit only; no prefill/auto-submit or selected-Brand context override. |
| [app.js](../../app.js) | `loadBoardFromUrlIfPresent`, `saveBoardToServer`, `saveBrandBrainState`, `serializeState`, `state.boardLoadGeneration`, `authoritativeBoardBrandCore` | Hydration/autosave/dirty/conflict semantics untouched. Home never serializes or changes snapshots, edges, nodes or association. |
| [home-foundation.css](../../home-foundation.css), [styles.css](../../styles.css), [language.js](../../language.js), [theme.js](../../theme.js), [theme-bootstrap.js](../../theme-bootstrap.js) | Home cap/container queries, mobile clearance, `--fk-*`, EN/DE `uiText`, resolved `data-theme`, `funklix:themechange` | Light-specific decoration scoped to resolved Light, not preference “system”; generic structure remains accessible. Avoid global `.home-hero` typography changes leaking into detail/other views. |

**Minimal shared-read design (proposed, not currently present):** factor existing Brand-detail GET/validation into one application-level read coordinator used by Profile and the selected-Brand Home projection. Key in-flight work and results by account object/normalized identity, authorized Workspace, catalog generation, Brand ID and known catalog revision. Validate actual response ID/access/revision before exposing `acceptedAvatar`, readiness and read-only capability. A catalog revision is not proof that a cached response is current; refresh on Home entry/visible focus and successful canonical save, and clear on access/identity invalidation. Reuse the confirmed save response; do not fetch once per hero element. Deduplicate concurrent Profile/Home reads. One selected Brand only; no Board detail hydration or all-Brand reads.

The read coordinator must not open Profile, modify `canonicalBrandDetail`, or promote `sidebarProfileCache` to authority. Mirror existing request-token, AbortController and post-JSON scope rechecks; allow an optional read to fail without blocking Home/Board boot. A 12 s timeout and explicit retry are suitable consistent with the current Learning read. Reset projected identity immediately on scope retirement; both abort and ignore late results. Do not add a second Home-specific detail cache. Reauthorization remains server/session-refresh based; this work does not create push revocation guarantees.

Possible pure presentation helpers: `livingWorkspaceState(context, model, selectedDetail)`, `heroContinuation(model, context)`, `eligibleBrandMessages(projections)`, `heroSignals(projections)` and `renderLivingWorkspace(...)`. These are proposed names, not claims that functions already exist. Keep them read-only and feed them minimized existing data. Avoid repeated large-Canvas fingerprint work per button; current draw captures one render scope.

## 14. DOM, lifecycle, switching and risk assessment

| Risk | Required preservation / mitigation |
| --- | --- |
| Removing boot-owned DOM | Retain all existing static nodes and IDs in `index.html`, including hidden mission-control siblings. New visible hero belongs inside `#home-foundation`; do not replace dashboard root or move Canvas/Brain/Profile mounts. |
| Losing BW-36.22A details | `draw` still renders Next Moves, Continue Working (six + expansion), B1 Brand Intelligence/responsibilities, B2 Insights/Brain and all Brands below the new section. Keep module/finding markers, headings, filters and destination buttons. Compact existing header once; selectors/management remain reachable. |
| Repeated redraw | `draw` replaces children; store message/pause/selection state in controller, not transient DOM. Preserve focus by stable placement keys; never restart image motion on every tick or refetch on draw. Avoid replacing focused carousel controls on count changes. |
| Forged/stale actions | Existing `actionScopes` and `boardActionContexts` WeakMaps capture trusted scope/evidence. Every new placement must register there and revalidate on activation; copied `data-*` attributes do not authorize. |
| Account switch/logout/public token | Immediately clear Avatar/detail/message/status projections and cancel requests, timers, observers; never display previous account data while incoming catalog is pending. Public-token/anonymous Home stays existing sign-in/access flow. |
| Workspace switch | Use `selectSessionWorkspace` and existing dirty/busy/unsaved/AI-operation guards; Board retirement/generation remains authoritative. Retire hero scope before loading incoming Workspace; do not bypass guard through a new selector. |
| Brand switch | Use `selectSessionBrand`; changes preference, not loaded Board association. Cancel outgoing canonical/Learning result; preserve current Board capabilities with explicit mismatch copy. Do not transform current snapshot to selected Core. |
| Board switch/hydration/save | Board signals/Brain absent until `brandBoardNavigationContext.openBoard` is hydrated for current generation. Invalidate diagnostics via existing fingerprint/source; retain dirty versus saved metadata distinctions. Hero presentation must not set dirty or trigger autosave. |
| Remote permission change | Honor existing refresh/revalidation, clear denied data, destinations reauthorize. No claim of instantaneous remote revocation; no persistent unbounded image cache for old authorized details. Public Blob URLs are existing storage behavior, not a newly private asset guarantee. |
| Leaks from CSS | Current `.mission-control` and Home both cap at 1200 px; any widening must change Home-only constraints together. Current Board cards reflow at 959/639 content-width breakpoints; hero needs its own content breakpoints. Preserve theme focus/forced-colors and mobile viewport calculation. |
| New background work | Existing Home polls minimized runtime context every 1 s and schedules deterministic diagnostics when needed. Do not add per-second fetching, bubble AI, extra Canvas fingerprint loops, animation rAF loops or hidden-tab message timers. |

Dispose cancels new scoped read subscriptions, animation handlers, IntersectionObserver and any optional message timer alongside existing `runtimeTimer`, resize/focus/visibility and Learning listeners. Navigating Home → Profile/Brain/Canvas must leave drafts and the normal loader unchanged. Optional-read failure must never delay root/Board boot or authoritative project hydration.

## 15. Asset, CSS and SVG implementation approach

Use the existing application font, emoji system, violet tokens and image renderer patterns. Add a Home-scoped Light presentation namespace, not a global shell redesign. Compose stage from two or three static radial gradients, one or two thin SVG orbit paths, 3–5 small decorative stars/strokes, and a rounded HTML speech bubble with a tail. Mark decoration `aria-hidden=true`, `focusable=false`, `pointer-events:none`. Never put user names/messages inside an SVG path or image, and never parse saved SVG/image URL content as HTML.

The saved Avatar is an image layer separate from halo/particles/bubble; reserve its slot before download. A square image with a background stays square/rounded within the stage; do not promise the reference's free-floating transparent silhouette. Prefer two static gradient layers over multiple blurred full-screen layers. Any custom raster decoration, mascot model, alternate font or handwritten annotation asset needs design/licensing approval and a local optimized asset strategy; it is not automatically provided by the conversation attachment. Existing logos remain identity marks in header/continuation, never substituted for the hero character.

No new image-generation requests, asset purchases, build system or animation dependency is needed for the recommended composition. If an optimized derivative is later approved, preserve the original URL/asset and do not overwrite canonical data; image transformation infrastructure is not established by this audit.

## 16. Performance, accessibility and validation acceptance

These are **future implementation release gates**, not claims of completed browser validation in this documentation PR.

- At 1600 × 900 and 1440 × 900 Light, compare against the attached reference: expressive split, oversized welcoming greeting, compact continuation, prominent real Avatar/bubble/CTA, pastel quick actions and natural detail boundary. No generic dense SaaS KPI grid. Review actual nested-scroll section captures, not only full-page screenshots.
- Zero automatic AI/image generation/Advice requests on Home, image activation or CTA navigation. Existing Brain inference starts only with explicit submit. Zero Home-introduced Canvas writes, dirty flags, saves, node/edge/Core/association changes or Board hydration fan-out.
- Repeated Home sync/draw produces no additional collection/Learning/canonical request per placement. Shared optional canonical read ≤1 in flight for the selected scope; no all-Brand prefetch/poll. Existing diagnostic engine runs once per changed valid evidence, not per bubble. Optional failures do not block initial Board render.
- Reserve image/stage/bubble layout space; target hero-introduced CLS ≤0.05 in fixtures. Profile on a throttled device: no new animation-induced >50 ms main-thread task, no continuous JS rendering loop; offscreen/hidden stage has no animation work. Measure decoded image memory; one 1024-square RGBA image is roughly 4 MiB decoded, so do not mount duplicate hidden hero images. Do not assert a network-byte budget for existing arbitrary assets without measurement.
- All actions keyboard-operable with native controls and 44 px target heights; names and explicit Brand/Board scope accessible. Visible 3 px focus ring, no keyboard trap, no focus lost by async draw. Restore origin focus after responsibilities/Profile when supported by adapters. No whole-stage button wrapping other controls.
- Text contrast ≥4.5:1 normal and ≥3:1 large; meaningful controls/focus boundaries ≥3:1. Color/emoji alone never establishes status. Forced colors retains outlines, labels and actionable boundaries; gradient-only differentiation is insufficient.
- Single H1, logical headings/reading order, descriptive image-button name; image alt can be empty when its parent fully names it. Bubble is ordinary readable text; no repeated live announcements from runtime polling. Manual NVDA/Firefox or VoiceOver/Safari verification remains required.
- Reduced motion: no float/orbit/ripple/crossfade/automatic message advance; same information/actions. User can stop any longer ambient movement; hover/focus pauses optional carousel. No flashing or fake typing/processing.
- Test every §4 size with EN/DE, long Workspace/Brand/Board/user names, both sidebar preferences, keyboard focus, loading/denial/zero/error/partial data, all §10 states, actual fixed mobile controls/safe areas, native zoom and text enlargement. No horizontal overflow, clipped label, bubble collision or obscured focused/last action. Do not solve by forced short names or smaller tap targets.
- Regression checks for existing Dark Mode navigation/contrast/functional behavior and resolved-system theme remain necessary; no Dark Mode visual redesign is approved.

Reuse browser fixtures in [scripts/fixtures/home-browser.js](../../scripts/fixtures/home-browser.js), [BW-36.22A](../../scripts/check-bw36-22a-compact-home.js), [B1](../../scripts/check-bw36-21b1-home-intelligence.js), [B2](../../scripts/check-bw36-21b2-home-insights-brain.js), [Foundation](../../scripts/check-bw36-21a-home-foundation.js), [Profile](../../scripts/check-bw36-13r4-guided-brand-profile-setup.js), [Avatar](../../scripts/check-bw28-3-premium-insights-and-brand-avatar.js), selection/switching checks and [.github/workflows/runtime-boot-safety.yml](../../.github/workflows/runtime-boot-safety.yml). Future tests must intercept provider/network calls before navigation and verify unchanged serialized Canvas/snapshot/association state. This audit runs documentation/link/scope validation only; no fresh runtime screenshots, production observations or screen-reader results are claimed.

## 17. Minimal phased implementation sequence

| Phase | Authorized only after separate approval | Exit evidence / dependency |
| --- | --- | --- |
| 1 — Light composition | Living Workspace layout, greeting, reserved static stage, real compact continuation, quick actions, detail boundary and Home-only visual tokens; preserve all existing modules | Reference comparison at desktop + basic mobile; correct mismatch/read-only actions; no new fetching/AI/Canvas mutation. A factual empty/loading stage must not be represented as finished Avatar integration. |
| 2 — Avatar, bubble, Brain | Shared existing canonical detail reader, accepted saved image, missing/error states, deterministic message set, guarded Brain navigation; optionally supported Profile section entry extension | Selected Brand versus loaded Board mismatch/revocation/race tests; Profile save updates stage; zero generation/inference on render/navigation. Requires canonical read/freshness decision. |
| 3 — Real status and maturity | Approved aggregate/status pills, complete §10 states, optional current-Board assigned-node completion count and current-status row | Exact formulas/authorization/unknown states verified; no reference metrics copied, no cross-Board fan-out, no percentages without approved semantics. |
| 4 — Motion and polish | Finite subtle motion, pause controls, mobile spacing, EN/DE stress, accessibility and visual fidelity refinement | Full §16 visual, keyboard, reduced-motion/performance and runtime regression evidence. Accessibility/reflow basics start in Phase 1, not postponed until Phase 4. |

Sequence is sensible, with two refinements: prototype real arbitrary saved-image fit during Phase 1 design review, and treat scope/keyboard/reduced-motion safeguards as requirements from the first phase. Phase 4 polishes them. No phase includes backend activity aggregation, generator style changes, analytics, a new chatbot or Dark Mode design. Keep each implementation minimal and reviewable; phase approval does not imply later phases approved.

## 18. Product decisions requiring approval and unsupported reference details

| ID | Decision | Recommendation / fallback |
| --- | --- | --- |
| L1 | New expressive first section, Home width and detailed-header reduction | Approve §2–4 direction and Home-only max width up to 1440 px, retaining all detailed modules. If width remains 1200 px, accept earlier reflow/smaller stage, not compressed text. |
| L2 | Accepted-Avatar policy and missing capability UX | Reuse both-approval predicate and saved original. Open existing Profile Overview, with optional minimal Avatar section entry support separately approved. Never auto-generate or replace identity to match mascot. |
| L3 | Shared canonical detail availability on Home | Approve minimal shared GET/validation coordinator and freshness ownership in §13; no second cache, all-Brand reads or Board snapshot fallback. Until then no claim of canonical Avatar availability on Home. |
| L4 | Brain wording for selected/current mismatch | Prefer explicit Board-named CTA + visible context; no Brand-only chat promise. No eligible Board → Browse, read-only → View/Browse. |
| L5 | Hero continuation selection | Approve §8 current-matching-Board/selected-Brand ordering and explicit foreign-current fallback; detailed ordering unchanged. Alternative: always first unfiltered existing model Board, labeled Open saved Board. No last-visited claim. |
| L6 | Progress | Default omit track. Optional assigned-node count only for loaded candidate with exact denominator/source caption; never four-step campaign or onboarding percentage. |
| L7 | Bubble behavior and personality | Deterministic priority + manual selection, no timed rotation by default; approve EN/DE text together. Timed rotation needs explicit pause policy and separate approval. |
| L8 | Signal choice and lower row | Two truthful signals by default; ≤3 on wide desktop; replace timeline with current status. No approved-today/engagement/all-systems-go claim. |
| L9 | Animation/assets | Finite whole-image float or halo, sparse static decoration, pause/reduced-motion. Purpose-built mascot/rig or raster artwork requires separate approval and assets; do not change generator prompt silently. |

**Reference elements not reproducible as shown from existing infrastructure:**

1. Exact glossy smiling spherical mascot, transparent silhouette, eye/expression animation, 3D orbit/lighting or speaking character: not guaranteed by saved arbitrary static images; generator deliberately excludes mascots. CSS can reproduce setting only.
2. “Brand active / All systems go”: no Home health/presence source. Decorative presence cannot substitute.
3. “2 Learnings approved today”: current aggregate lacks a complete approval-day event query and day/time-zone definition.
4. “3 opportunities worth reviewing”: only real current-Board structural findings are available; they must be named and scoped, not attributed to a new AI discovery.
5. “3 of 4 steps” and “You were working on campaign strategy”: no audited persisted four-step progress or last-visit context. Use saved metadata/qualitative state.
6. “Engagement is up 24%,” “performing above average,” and illustrative timed activity: no comparable Home outcome dataset or complete Brand-wide event stream. Use current status without relative event timestamps.
7. Universal selected-Brand chat: existing Brain requires current saved editable Board. No direct-Brand chatbot is introduced.
8. Exact top-right search/notification chrome and handwritten art: only retain existing functional controls; extra shell features and licensed artwork are outside this Home audit.

**Delivery and validation scope:** one Markdown audit, one normal non-draft PR against latest `main`, no merge. No production HTML/JS/CSS/backend/schema/runtime changes, binary reference commit, SQL, deployment, paid image or AI request. Implementation recommendations remain proposals requiring the decisions above.

### Documentation validation record

Validated against the fetched baseline above: all 18 audit sections present; all 51 relative Markdown links resolve to tracked repository files; all explicitly named function references checked against current source (including `reconcileConfirmedBrand`, `serializeState` and `appendActivity`); balanced fenced layout annotation; no binary reference included. The staged/committed scope is exactly this new audit Markdown file and whitespace validation passes. No application tests were run because no application/runtime files changed; future implementation acceptance is specified in §16. PR metadata and final changed-file scope are verified at delivery; no merge is performed.

BW-36.22B LIVING WORKSPACE LIGHT MODE AUDIT READY FOR REVIEW
