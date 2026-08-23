# BW-22 — Global Settings and interface simplification audit

**Status:** audit only  
**Baseline inspected:** `a2d0630` (merged BW-21 and BW-21.1)  
**Audit date:** 2026-08-23

## 1. Executive conclusion

Funklix currently has only **two genuine global preferences exposed to users**: Interface language and default campaign-output language. Both are stored together in local browser storage and are incorrectly mixed into Utilities with immediate Board and Canvas operations. The safest first Settings surface is therefore deliberately small: a device-accessible Settings entry near the bottom of the sidebar, containing a single **Language & Region** category with those two existing selectors.

The rest of the inspected interface is primarily contextual. Workspace Brand selection is Workspace scope; Brand membership and Canonical Brand editing are Brand scope; sharing and Brand association are Board scope; zoom, view switching, filtering, fit, compact, and expand are Canvas/view scope; save, duplicate, reset, claim, generation, and Inspector commands are immediate actions. Moving any of those into global Settings would obscure their authority and could cause users to mistake a one-Board mutation for an application preference.

There is no authenticated preference API or account-preference record in the inspected baseline. Account-following appearance, generation, notification, accessibility, privacy, and profile controls must remain future capabilities until product semantics and backend support exist. The existing CSS already honors the operating system's reduced-motion media query, but there is no user-selectable or persisted reduced-motion preference.

**Headline classification:** 2 current global/device preferences; 1 persisted Workspace preference; no current account preference; all authorization remains Brand/Board contextual; Canvas filters and Board-library scope are transient; zoom is Board content today rather than a global default; all other requested Settings candidates are unsupported future capabilities.

## 2. Current interface inventory

The inventory below records visible controls and hidden compatibility controls. Each item receives one primary scope in section 4.

### 2.1 Left sidebar and Workspace shell

- **Sidebar structure:** collapse/expand button; Workspace Brand switcher; Current Board Brand panel; Workspace navigation (Home, Boards, Campaign Canvas, Content Workspace, Board Brand Core, AI Brain, Insights); and Board Activity.
- **Workspace Brand switcher:** selects an accessible Canonical Brand, opens read-only Canonical Brand detail, creates a Brand, and exposes edit/team management from the detail rendering. Selection is explicitly separate from Current Board Brand association.
- **Current Board Brand:** shows association, opens Brand Core comparison, changes the Board's Canonical Brand association, initializes Canonical Brand Core from the saved Board snapshot, updates the Board snapshot from Canonical, or restores the prior Board snapshot.
- **Activity:** expands/collapses the Board activity feed and tracks locally seen activity/comments. Collapse state itself is memory-only.
- **Navigation:** switches application views; it does not persist a preference. Content Workspace is present as navigation but no Settings semantics were found.
- **Responsive behavior:** the sidebar can be visually collapsed, but the collapsed state is not persisted. Existing breakpoints adapt Boards and dialogs; there is no dedicated mobile Settings or account drawer.

### 2.2 Account and session area

- Signed out: **Sign in with Google**.
- Signed in: avatar, display name, email, and **Sign out**.
- Session restoration calls `/api/auth/session`; sign-out deletes that session. The signed session cookie is server-issued, `HttpOnly`, `SameSite=Lax`, 14-day, and `Secure` in production.
- There is no profile editor, password control, authenticated preference endpoint, notification center, data export, or deletion control.

### 2.3 Campaign Canvas toolbar

- Primary row: **Create campaign**, **Add node**, **Undo**, node search, account/session cluster.
- Secondary row: **Filters**, **Utilities**, view-only notice, **Duplicate to Edit** where applicable, Board access/presence indicators, and **Copy Link**.
- Floating Canvas control: zoom out, current zoom percentage, and zoom in.
- Canvas context menu: New Node, Add Post-It, Improve with AI when applicable, and emoji reactions.

### 2.4 Filters

- Node filters are multi-select sets for **Node Type** (Idea, Campaign Variation, Content, Landing Page, Social Media Posting), **Platform** (LinkedIn, X/Twitter, Instagram, TikTok), **Status**, **Ownership** (me, unassigned, and collaborators), and **State/Funnel** (scheduled, conversion, awareness, interest, consideration, retention).
- Node text search participates in the same current-Canvas visibility behavior.
- Filters live only in runtime state. They are neither localStorage preferences nor serialized Board state and do not mark a Board dirty.

### 2.5 Utilities

- **Board:** Save Board, Duplicate Board, New Board, Reset Board, and conditionally Claim Board.
- **View:** Board View, List View, Calendar View.
- **Layout:** Fit to Board, Auto Arrange, Compact All, Expand All.
- **Language preferences:** Interface language and Campaign language.
- Several Utilities commands proxy hidden legacy toolbar buttons rather than owning independent command handlers.

### 2.6 Board library and Board creation

- Library scope buttons: **All Boards**, **Selected Brand**, and **Unbranded**. Scope defaults to `all`, remains in memory only, and Selected Brand depends on a resolved Workspace Brand.
- Board rows expose contextual open/rename/delete/share/access behaviors according to access. The library is account/access filtered.
- **Create New Board** opens a contextual flow that chooses an unbranded Board or the currently selected Brand and verifies that account/Brand/dialog context has not changed before completion.
- No Board-library option is a global preference in the current product.

### 2.7 Board sharing and permissions

- Board owner/editor/viewer access, collaborator management, duplication, claim, copy-link, public sharing enable/disable/link lifecycle, and read-only/public indicators are bound to the current Board and current authorization.
- Public Viewer mode deliberately hides mutating or inappropriate controls, including Board Brand Core navigation, copy link, save, and Duplicate-to-Edit CTA in the current CSS rules; runtime access checks provide the authoritative guard.
- Sharing and permissions are not account preferences and must never be relocated to global Settings.

### 2.8 Canonical Brand Workspace and Brand Team

- Canonical Brand detail is initially read-only; permitted roles can explicitly edit Brand name and complete Brand Core JSON.
- Brand creation, edit, conflict reload, and retry are operations on one Canonical Brand.
- Brand Team controls add/remove members and change roles (owner/admin/editor/viewer) subject to role rules. These are authorization mutations, not preferences.

### 2.9 Current Board Brand and Brand Core

- Board Brand association chooses which Canonical Brand a Board references.
- Compare Brand Cores is read-only. Initialize Canonical from Board, update Board from Canonical, restore the prior Board Brand Core, edit Board Brand Core modules, and reset Brand Core are explicit scoped mutations.
- Comparison warns that unsaved Board changes are excluded and uses the last server-saved Board snapshot. These boundaries would be dangerously blurred in global Settings.

### 2.10 Node Inspector

- Persistent Board-content fields: type, status, title, owner, description/prompt/task, image prompts, landing-page fields, platform, caption, hashtags, images, content format, audience, goal, channel, funnel stage, tone, and A/B variants.
- Immediate contextual actions: generate header/image/posting visual, improve, generate next step, review/apply fix, regenerate, regenerate for platform, schedule, generate content pack, disconnect, propagate, delete node(s), upload/download/favorite/delete image, and inspect connected context.
- These values/actions belong to node content or the selected-node context. None is a global setting.

### 2.11 Generation dialogs and overlays

- Campaign generation gathers campaign idea, additional context, channel, variation/post counts, landing-page/email inclusion, and the legacy-generator choice. Progress, completion, failure, retry, and reveal overlays are per generation run.
- Node type picker, posting schedule, review/fix, image generation/lightbox, Brand discovery/import, and strategy/Brand module dialogs are immediate contextual workflows.
- Campaign language is the sole existing reusable generation default; dialog inputs are briefs/content, not preferences. No persisted model, provider, creativity, style, or other AI-generation defaults were found.

### 2.12 Hidden legacy controls required by `app.js`

`#legacy-toolbar-hooks` is hidden and contains `#save-status`, Board-share status/link/claim hooks, view-cycle/menu/buttons, Save/New/Reset, Compact/Expand, and node-search count. `app.js` caches and binds many of these IDs; visible Utilities actions dispatch `.click()` to them. They are implementation compatibility hooks, not a second user-facing menu. Any later simplification must retain the IDs and handlers until callers are migrated and regression coverage proves removal safe. Hidden controls must stay hidden, uniquely identified, inert to keyboard navigation, and absent from accessibility presentation through the existing hidden container.

## 3. Existing preference and persistence inventory

### 3.1 Actual persisted preferences

| Preference | Current storage | Allowed values and default | Device/account | Protected information | Restore and invalidation | Dirty/autosave effect | Audit decision |
|---|---|---|---|---|---|---|---|
| `uiLanguage` | `localStorage["funklix.languagePreferences.v1"]`, JSON property | `en`, `de`; default `en`; invalid/malformed values fall back | Device/browser-profile; not account keyed | No | Restored when `language.js` initializes before app state; persists immediately on selector change. It has no explicit expiry; malformed JSON/value falls back but is not removed. | None; translates marked UI and sets document language, without Board serialization or dirty state | Move its visible control from Utilities to future Settings; keep local initially and preserve key/semantics |
| `campaignLanguage` | Same JSON record | `en`, `de`, `es`; default `en`; invalid/malformed values fall back | Device/browser-profile; not account keyed | No | Same startup restore and immediate write; no expiry. Used for newly generated output; existing content is not translated. | Preference change itself: none. Later generated content is ordinary Board content and follows normal save/dirty behavior. | Move its visible control with `uiLanguage`; keep local initially |
| Workspace Brand selection | `localStorage["funklix.workspace-brand.v1." + SHA-256(normalized email)]`, `{v:1, brandId}` | Accessible UUID from the signed-in user's loaded Brand catalog; no-selection is the effective default | Device-local but account-separated | Brand UUID is potentially sensitive metadata; email is hashed rather than stored in the key, but hashing is not encryption | Restored only after session and Brand catalog success and only if generation/request/account still match. Removed for malformed shape/version/UUID, inaccessible or deleted Brand, and account/session invalidation paths. | None; explicitly not Canvas/Board-association authority | Keep in Workspace switcher, not Settings. Consider server sync only if “last Workspace per account” becomes a deliberate product requirement |

### 3.2 Persisted state that is **not** a preference

| State | Persistence and values | Restore/invalidation | Dirty/autosave | Classification and decision |
|---|---|---|---|---|
| Canvas zoom/view state | `zoom` is a finite numeric field in `campaignCanvasState` and server `canvas_json`; initial runtime default is `1` (100%). Current view (`board/list/calendar/...`) is memory-only. | Local draft may restore at boot; server Board load normalizes and applies Board zoom. Local draft is removed during Board lifecycle/reset paths and is not written for `public_viewer`. | Zoom is serialized with Board content; Canvas saves therefore include it. `setZoom` itself does not establish a separate global default. | Current zoom is **Canvas/view preference**, embedded in Board state. Keep zoom controls on Canvas. A future default view behavior is a separate unsupported capability and must not overwrite saved Board zoom. |
| Canvas/Board draft | `localStorage["campaignCanvasState"]`: nodes, edges, counters, zoom, activity, schema metadata | Restored as guarded local draft; overwritten/removed across server load/reset/Board transitions; public viewers do not cache server Board payload here | This is the core dirty/autosave payload | Board data/cache, not a Settings preference; never expose as such |
| Board Brand Core cache | `localStorage["brandBrainState"]` for an unscoped draft or `brandBrainState:<boardId>`; JSON Brand Core data | Restored per current Board key; removed/reset by Brand Core lifecycle | Brand Core saves may mark Board dirty and trigger server save; some internal writes explicitly suppress dirty marking | Board data/cache, not a preference |
| Activity seen marker | account/Board-derived localStorage key containing a timestamp | Loaded when Board activity restores; advanced when feed is viewed | No Board dirty state | Local UI read marker; Canvas/view support state, not a Settings candidate |
| Comment seen map | account/Board-derived localStorage key containing comment IDs/timestamps | Loaded/initialized per context and updated when comments are seen | No Board dirty state | Local read marker, not notification preferences |
| Auth session | Signed `funklix_session` cookie containing user payload and expiry; 14-day default; HttpOnly, SameSite=Lax, Secure in production | Server verifies signature/expiry on `/api/auth/session`; sign-out clears cookie | None | Protected session data, not preference storage. Never mirror into Settings/localStorage |
| Board path/public token | `/boards/:id` in pathname; public token in `#public=<43-char token>` fragment; `pushState` on Board navigation | Browser history restores URL location; runtime re-resolves access. Fragment token is capability-bearing protected information. | Loading does not itself dirty the Board | Navigation/access state, not preference. Never persist a public token as a preference |

No `sessionStorage` use was found. No authenticated preference API, preference database/schema, stored theme/appearance value, persisted filter set, persisted Board-library scope, persisted sidebar collapse, or persisted active view was found.

### 3.3 Transient preference-like state

- Node filters and search: memory-only, current Canvas, reset with reload; no dirty/autosave effect.
- Board-library scope: memory-only `all|brand|unbranded`, default `all`; account/Workspace-context dependent; no dirty/autosave effect.
- Active view: memory-only; default Board view; no dirty/autosave effect.
- Sidebar and activity collapse: memory-only; no dirty/autosave effect.
- Generator form choices: per invocation; output creation may dirty the Board, but the choices are not defaults.

## 4. Scope classification matrix

Every inspected control/preference is assigned exactly one primary scope. “Future capability” is used only where the requested concept is not supported today.

| Inspected control or concept | Primary scope | Decision and evidence |
|---|---|---|
| Interface language | **1. Global/device preference** | Applies throughout this browser; currently local and independent of sign-in |
| Default campaign-output language | **1. Global/device preference** | Reused by generation across Boards on this browser; not Board content itself |
| Appearance/theme and future dark mode | **8. Future capability** | No theme control or persisted theme state exists |
| Reduced motion/animation preference | **8. Future capability** | CSS honors OS `prefers-reduced-motion`, but Funklix has no override/control/storage |
| Default Canvas zoom/view behavior | **8. Future capability** | No default exists; current saved zoom is a Canvas/Board view value, and active view is transient |
| Current zoom in/out and Fit to Board | **6. Canvas/view preference** | Changes current presentation; should remain adjacent to Canvas |
| Board/List/Calendar view and current node search/filter sets | **6. Canvas/view preference** | Presentation of the current Board only; transient |
| Board-list filtering (`all|brand|unbranded`) | **6. Canvas/view preference** | Presentation of the Board library; depends on selected Workspace Brand |
| Workspace Brand selection | **3. Workspace preference** | Selects Workspace context; explicitly not Board association |
| Create Canonical Brand | **7. Contextual action** | Immediate creation workflow; not a preference |
| Canonical Brand editing | **4. Canonical Brand setting** | Mutates one Canonical Brand |
| Brand Team management and roles | **4. Canonical Brand setting** | Mutates one Brand's authorization/team |
| Board Viewer/Editor permissions | **5. Board setting** | Mutates access to one Board |
| Public Board sharing enable/disable | **5. Board setting** | Mutates one Board's public access |
| Board Brand association | **5. Board setting** | Changes one Board's association |
| Brand Core compare | **7. Contextual action** | Read-only immediate comparison in current Board/Brand context |
| Initialize Canonical from Board | **4. Canonical Brand setting** | Explicitly writes one Canonical Brand from a saved snapshot |
| Update/restore Board Brand Core | **5. Board setting** | Mutates one Board snapshot, not the Canonical Brand/default |
| Board Brand Core/module editing and reset | **5. Board setting** | Changes the current Board's Brand content |
| Save, duplicate, new, reset, claim Board; copy link | **7. Contextual action** | Immediate Board operation, permission/mode dependent |
| Auto Arrange, Compact All, Expand All | **7. Contextual action** | Immediate current-Canvas operation; Auto Arrange can change node layout and Compact/Expand presentation, but none is a reusable persistent default |
| Add/undo/node context menu/Inspector edits and actions | **7. Contextual action** | Immediate operation on current Board selection/content |
| Campaign/generation dialog inputs and actions | **7. Contextual action** | One generation brief/run; not stored as defaults |
| AI generation defaults beyond campaign language | **8. Future capability** | No supported persistent defaults found |
| AI Brain preferences | **8. Future capability** | AI Brain is a navigation/view surface; no preference model found |
| Notifications | **8. Future capability** | Activity/read markers are not delivery preferences |
| Transactional email preferences | **8. Future capability** | No email-delivery preference or backend found; essential transactional mail may require separate policy semantics |
| Account/profile controls | **8. Future capability** | Session identity is displayed, but no editable profile/account service exists |
| Sign in and sign out | **7. Contextual action** | Immediate session operations, not persistent preferences |
| Privacy/data export or deletion | **8. Future capability** | No UI/API/workflow found; requires identity, retention, and deletion design |
| Accessibility preferences | **8. Future capability** | No app-level preference storage/control; OS reduced motion is automatic CSS behavior |
| Sidebar collapse, activity collapse/read markers | **6. Canvas/view preference** | Current shell/Board presentation support; not global Settings today |

## 5. Utilities and Filters audit

### 5.1 Utilities action-by-action

| Current Utilities item | Frequency/type | Duplicate/role or mode constraints | Best long-term home | Settings? |
|---|---|---|---|---|
| Save Board | Frequent Board action | Proxies hidden `#save-board-btn`; irrelevant/disabled in Viewer/Public | Prefer a visible Board command/status area; retain hidden hook during migration | No |
| Duplicate Board | Occasional contextual action | Also exposed as Duplicate-to-Edit in relevant read-only flow; availability depends on access | Board-specific overflow/menu; avoid two simultaneously visible duplicates | No |
| New Board | Occasional contextual action | Proxies hidden `#new-board-btn`; Boards library has Create New Board | Prefer Boards library/sidebar creation; later remove visible Utilities duplicate only after route/context coverage | No |
| Reset Board | Rare destructive contextual action | Proxies hidden hook; editor/owner relevance, not Viewer/Public | Board-specific danger menu with confirmation | No |
| Claim Board | Rare contextual authorization action | Conditional: signed in, saved/unowned Board | Board access/share menu | No |
| Board View | Frequent Canvas presentation action | Proxies hidden view button | Compact view switcher near Canvas, perhaps Board menu on narrow screens | No |
| List View | Occasional presentation action | Same hidden view infrastructure | Same view switcher | No |
| Calendar View | Occasional presentation action | Same hidden view infrastructure | Same view switcher | No |
| Fit to Board | Frequent Canvas action | Related to visible zoom controls | Place beside zoom controls | No |
| Auto Arrange | Occasional current-Board mutation/layout action | Editor-only in effect; irrelevant in Viewer/Public if mutation is blocked | Board/Canvas layout menu with clear mutation semantics | No |
| Compact All | Occasional Canvas presentation action | Proxies hidden `#compact-all-btn` | Canvas layout menu | No |
| Expand All | Occasional Canvas presentation action | Proxies hidden `#expand-all-btn` | Canvas layout menu | No |
| Interface language | Persistent preference | Not duplicated elsewhere | Future Settings → Language & Region | **Yes** |
| Campaign language | Persistent generation default | Not duplicated elsewhere | Future Settings → Language & Region | **Yes** |

**Utilities conclusion:** only the two language selectors belong in Settings. In the first implementation, retain all twelve contextual Board/View/Layout actions in Utilities unchanged. Later simplification can split them into a Board-specific menu and Canvas view/layout controls, but that is a separate behavior-sensitive package. Do not remove hidden legacy DOM merely because a visible action moves.

### 5.2 Filters audit

Filters are not Settings. They answer “what current Board content should I see now?” rather than “how should Funklix behave generally?” Their values are transient, do not dirty or save the Board, and ownership choices change with collaborators/account. Keep Filters adjacent to search and Canvas. A future “remember my filters” feature would still be a Canvas/library convenience and should be specified separately; it should not silently turn current filter state into an account default.

The Board-library scope is likewise a library filter, not Settings. Keep it in the library. Its Selected Brand option correctly depends on the Workspace selection, but neither should be moved merely to reduce toolbar controls.

## 6. Proposed Settings information architecture

This is the minimal target architecture, not an instruction to build all categories now.

### 6.1 Language & Region — implementable now

| Exact setting | Why global/account-level | Current source | Required persistence | Readiness/dependencies |
|---|---|---|---|---|
| Interface language (`en`, `de`) | Applies to application chrome on this device, including signed-out/public use | Utilities-generated selectors; `language.js` local preference module | Preserve `funklix.languagePreferences.v1` and validation/default behavior initially | Implementable now. Risk: translations remain incomplete where elements lack translation markers/dictionary entries |
| Default campaign-output language (`en`, `de`, `es`) | Default for future generation requests, not existing Board content | Same Utilities popover and language module | Preserve same local JSON record initially | Implementable now. Label must say “default” and explain existing content is unchanged |

Do not call this category simply “General”: the two values are specifically language semantics, and a broad empty category invites unrelated actions.

### 6.2 Appearance — deferred

- **Exact eventual settings:** system/light/dark color scheme only after a complete token/theme design exists.
- **Why:** application-wide presentation; signed-out/public users also need it.
- **Current source:** none.
- **Persistence:** local immediately for pre-auth rendering; optionally account-following in a later hybrid model.
- **Status/risks:** future capability. Avoid flash-of-wrong-theme, inaccessible contrast, unthemed dialogs/generated content, and implying dark mode exists before full coverage.

### 6.3 Accessibility — deferred

- **Exact eventual setting:** motion preference `system|reduce|no-preference` only if an application override is justified. Continue honoring OS preference without requiring a setting.
- **Why:** application-wide/device accessibility presentation.
- **Current source:** CSS `prefers-reduced-motion` rules only.
- **Persistence:** local-first so it applies signed out and before authentication; account sync could be additive later.
- **Status/risks:** future capability. Must cover all animations, preserve essential status feedback, and avoid conflicting with OS intent. Other accessibility preferences require separate evidence; do not invent toggles.

### 6.4 Account — deferred as a service, not a dumping ground

- **Exact eventual controls:** profile attributes only if editable identity support is introduced; privacy data export/deletion only with complete backend/legal workflows.
- **Why:** signed-in identity across devices.
- **Current source:** read-only session name/email/avatar and sign-in/sign-out actions.
- **Persistence:** authoritative server account records, never localStorage.
- **Status/risks:** future capability. Sign-out remains an immediate account-menu action, not a setting. Export/deletion needs reauthentication, auditability, retention rules, cascading Brand/Board ownership decisions, and failure recovery.

### 6.5 AI & Generation — do not create yet

Campaign language is initially housed under Language & Region. Add this category only when at least one other validated, supported reusable default exists (for example a defined generation model or default quantity with stable API semantics). Current generator fields and AI Brain navigation are contextual, not preferences. Persistence would likely be authenticated account storage, with explicit Workspace/Brand overrides if those are ever supported.

### 6.6 Notifications — do not create yet

No delivery system/preferences exist. Local activity/comment “seen” markers are not notification subscriptions. A future account category could contain exact supported channels/events and transactional-email distinctions, stored server-side. Product/legal decisions must define which transactional messages cannot be disabled.

### 6.7 General — omit initially

There is no current generic setting to place here. Default Canvas zoom/view behavior is unsupported and would require rules for interaction with saved Board zoom, public Boards, responsive viewport, and Fit to Board. Create General only after such behavior is specified and implemented.

## 7. Entry-point and responsive recommendation

### 7.1 Options compared

1. **Sidebar Settings near the bottom:** best context-neutral discoverability; works signed in/out and in public viewing; matches persistent Workspace navigation. Requires a responsive drawer/modal treatment and a compact-sidebar icon/tooltip.
2. **Account menu:** conventional for server account preferences, but the current account area is not a menu and disappears when signed out. It would incorrectly hide device language/accessibility from signed-out and public users.
3. **Utilities:** already mixes contextual operations and preferences. Keeping Settings here perpetuates the information-architecture problem and makes it Canvas-dependent.
4. **Combination — Sidebar Settings plus Account menu:** strongest long-term separation if it means **one Settings surface**, not duplicate settings pages: sidebar opens Settings; account menu retains identity/session actions and may later contain profile/privacy destinations owned by an account service.

### 7.2 Recommendation

Use option 4 with a strict single-surface rule. Add one **Settings** item near the bottom of the sidebar, below Workspace navigation/activity and above a future account/session footer. It opens the same Settings dialog/panel in signed-in, signed-out, and public Viewer modes. Do not add a second Settings link to the current topbar account cluster in the first package; when a true account menu is later built, it may deep-link to Account inside the same surface, never fork another implementation.

Desktop should use a focus-managed modal or side panel that does not inherit Brand/Board authority. On responsive/mobile layouts, the same trigger belongs in the sidebar/navigation drawer and the surface becomes a full-height, scrollable dialog with a visible title and Close button. The trigger remains available in public Viewer mode because language is device-wide, while unavailable account-only sections would be omitted rather than disabled ambiguously.

Keyboard requirements: native button trigger; clear accessible name; `aria-labelledby`/description; focus moved to the Settings heading or first control on open; Escape and explicit Close; focus trap while modal; and focus restored to the exact trigger after close. If the sidebar collapses or a breakpoint changes while open, retain a stable trigger reference/fallback. Opening or closing Settings must not change URL/Board history, Canvas selection, dirty state, or autosave.

## 8. Persistence recommendation

### 8.1 Models compared

- **Local device-only:** immediate before authentication, works signed out/public/offline, avoids backend work; but does not follow users, can become stale, and can leak one user's preference to the next user in a shared browser.
- **Authenticated server-side:** follows an account and supports centralized validation; but cannot cover signed-out/public use, needs schema/API/conflict/account-switch behavior, and risks a flash before session restoration.
- **Hybrid:** local bootstrap plus optional account preference sync after authentication. Best eventual experience, but requires precedence, timestamps/versioning, logout/account-switch isolation, and failure semantics.

### 8.2 Recommendation by preference

- **Keep local now:** `uiLanguage`, `campaignLanguage`, Workspace Brand selection (still account-keyed locally), Canvas draft/zoom cache, activity/comment seen markers. Only the first two belong in Settings.
- **Keep server-authoritative outside preferences:** session, Canonical Brand/team, Board/access/public sharing/Brand association, and saved Board content including current zoom.
- **Future local-first/device:** theme and accessibility/motion, because they must apply before auth and in public/signed-out views. If synced later, preserve an explicit device override or deterministic last-update policy.
- **Future account-following:** supported AI defaults, notification delivery choices, editable profile, privacy requests, and transactional communication choices, all via authenticated APIs with server validation.

Adopt a **hybrid model eventually**, but do not build server persistence in the first package. First preserve the language key and its validation exactly. A later account-preference API must define precedence: apply safe local preferences synchronously, fetch account preferences after session, reconcile only versioned recognized fields, write the resolved non-sensitive value locally for next paint, and clear/invalidate account-scoped caches on account change without deleting deliberate device accessibility choices.

## 9. Simplification opportunities

These are sequenced opportunities, not work authorized by BW-22:

1. Remove the visible language block from Utilities only when the new Settings entry is live and regression-tested.
2. Move Fit to Board beside zoom; consider a compact Canvas **View/Layout** menu for Board/List/Calendar, Auto Arrange, Compact All, and Expand All.
3. Move Save/status to a persistent Board command/status location; group Reset and Claim under a Board-specific overflow menu.
4. Prefer Boards library/sidebar creation over duplicate New Board entry points; preserve contextual Duplicate-to-Edit where it explains read-only recovery.
5. Keep Copy Link/share/permissions near Board access, not Settings or generic Utilities.
6. Keep Filters and search together. Improve active-filter clear/reset affordances separately rather than turning filters into preferences.
7. Retain hidden legacy hooks until visible callers no longer proxy them and DOM integrity/regression checks are updated. “Removal from visible UI” means deduplicating the visible route, not deleting required DOM.

No cleanup above should be combined with the first Settings package: each changes discoverability, permissions, or event routing and needs mode-specific testing.

## 10. Risks and legacy dependencies

- **Legacy DOM IDs/event bindings:** `app.js` eagerly caches critical elements and binds hidden toolbar buttons. Deleting/renaming IDs can break boot, visible Utilities proxies, save state, or view switching.
- **Duplicate controls:** a transition that leaves language selectors in both Settings and Utilities needs bidirectional synchronization and creates conflicting focus/status announcements. Cut over atomically while retaining only non-user-facing compatibility nodes.
- **Stale restoration:** malformed language JSON falls back but remains stored; Workspace selection validates catalog membership. New settings need versioned allowlists and deterministic cleanup rather than trusting old values.
- **Account switching:** language currently spans accounts on one browser; Workspace selection is hashed-account keyed. Server sync must prevent the previous account's AI/notification/profile settings flashing or being written into the new account.
- **Public Viewer mode:** global device settings must remain available, while Board mutation, sharing administration, Brand Core, and account-only controls remain hidden/guarded. Never store fragment public tokens in preferences or analytics.
- **Board dirty state/autosave:** language changes currently do not dirty a Board. Extracting controls must not call `markUnsaved`, serialize settings into `canvas_json`, trigger autosave, or reinterpret current Board zoom as a global default.
- **Zoom semantics:** zoom is currently in Board serialization. Introducing a global default without precedence rules could dirty Boards on load, overwrite collaborators' saved view, or produce viewport-specific bad fits.
- **Responsive layout:** a fixed desktop popover can overflow narrow screens. A Settings dialog needs scroll containment, safe-area spacing, touch targets, virtual-keyboard behavior, and preserved access when the sidebar is collapsed.
- **Keyboard/focus:** current dynamically created popovers do not constitute a complete Settings-dialog pattern. New modal semantics require trapping/restoration without stealing focus from Canvas or leaving a removed trigger as the return target.
- **Incomplete translations:** changing UI language translates marked strings, not every hard-coded/dynamic surface. Settings copy itself must be translated and should not imply complete localization.
- **Unavailable backend support:** account sync, notifications, email preferences, profile editing, privacy workflows, dark mode, and AI defaults must not appear as nonfunctional toggles. UI promises require APIs, security, migrations, and operational handling.
- **Authorization confusion:** Brand Team, Board permissions, public sharing, Canonical editing, and Brand association are scoped authoritative mutations. A global Settings location would imply broader or different effect than reality.
- **History and routing:** Board IDs and public fragments are navigation/access state. Settings should be URL-neutral initially; if deep links are later introduced, they must not clobber `/boards/:id` or public fragment handling.
- **Browser storage availability/protection:** localStorage writes are optional and may fail. Language controls must still work in memory. Never place session tokens, public tokens, or sensitive exports in localStorage.

## 11. Deferred capabilities

The following are explicitly **not present** and must remain deferred until separately specified:

- system/light/dark appearance and complete theme coverage;
- an in-app reduced-motion override or any additional accessibility preference;
- global default Canvas zoom, initial view, fit behavior, or remembered filters;
- server-synced account preferences and preference conflict resolution;
- persistent AI model/style/creativity/quantity defaults or AI Brain preferences;
- notification subscriptions, channels, digests, and transactional-email choices;
- editable account/profile fields;
- privacy export, deletion, retention, ownership transfer, and reauthentication flows;
- Workspace/Brand preference inheritance or per-Brand generation defaults.

Their omission is intentional. Mere plausibility is not evidence of current infrastructure.

## 12. Exactly one next implementation package

### Recommended package: device-local Language Settings extraction

Implement **one** narrowly bounded package:

- **Exact entry point:** one `Settings` button near the bottom of the left sidebar, available signed in, signed out, collapsed (icon plus accessible name/tooltip), and in public Viewer mode. On narrow screens it remains in the navigation drawer and opens a full-height focus-managed dialog; on desktop it opens the same Settings dialog/panel.
- **Initial categories:** exactly one category, **Language & Region**.
- **Exact existing preferences to move:** the existing Interface language selector (`en|de`) and Default campaign-output language selector (`en|de|es`), including explanatory text that existing Board content is not translated.
- **Exact controls remaining in Utilities:** Save Board, Duplicate Board, New Board, Reset Board, conditional Claim Board, Board View, List View, Calendar View, Fit to Board, Auto Arrange, Compact All, and Expand All. Filters remain a separate Canvas control. No other menus move in this package.
- **Persistence:** reuse `funklix.languagePreferences.v1`, defaults, allowlists, and local device behavior unchanged; no database, API, schema, or account synchronization. Preference changes must not affect Board dirty state/autosave.
- **Legacy handling:** retain required hidden toolbar IDs/event bindings; remove only the visible Utilities language block after the new controls are wired, avoiding duplicate selectors.
- **Explicit exclusions:** no theme/dark mode, motion toggle, accessibility suite, account/profile/privacy UI, notifications/email controls, AI defaults beyond campaign language, default zoom/view, remembered filters, Workspace Brand selection, Brand Team, permissions/public sharing, Canonical Brand editing, Board Brand association, Brand Core operations, Utilities restructuring, or general responsive/navigation redesign.

This is the smallest safe implementation because it relocates only proven global preferences, reduces Utilities without changing any Board/Brand authority, preserves current persistence, and creates no unsupported product promise.
