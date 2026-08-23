# BW-21 language separation audit

## Pre-implementation findings

- **Language state and persistence:** there was no UI-language or campaign-language state, selector, request field, prompt parameter, or language preference. Browser persistence used `localStorage` for Canvas drafts and small versioned, namespaced preferences such as Workspace Brand selection. BW-21 therefore uses one namespaced, versioned preference record containing only the two allowlisted language identifiers.
- **Existing language:** the document declared German while the active shell was predominantly English and the Undo tooltip/node picker contained isolated German text. English was the effective interface and generation default. No existing campaign-language field was found.
- **Campaign shell strings:** active strings are split between static `index.html` navigation/toolbar/sidebar markup and dynamic `app.js` Filters, Utilities, campaign setup, progress, completion, error, save/failure/retry, access and confirmation surfaces. User content is rendered separately by node/Brand/Board/member renderers and must not enter translation.
- **Generation path:** `#create-campaign-btn` opens the V3 setup dialog (with a legacy fallback); submission normalizes setup, calls `fetchGeneratedCampaignPlan()`, posts to `/api/generate-campaign`, normalizes and quality-checks nodes, optionally calls `/api/refine-node` for repairs, then commits the Campaign V3 plan to Canvas. The legacy dialog uses the same authoritative generation route and progressive Canvas commit path.
- **Lifecycle protection:** V3 already had validation, deterministic normalization/fallback, a bounded repair loop and modal retry using the same setup object. BW-21 adds a per-attempt token and captured language to that setup; stale attempts stop before commit, and repairs receive the same language through campaign context.
- **DOM dependencies:** `app.js` has a boot-time DOM contract plus direct references for all toolbar controls. Existing IDs are retained. New selector/status IDs are confined to the existing Utilities popover.
- **Boot safety:** `runtime-boot-safety.yml` checks JavaScript syntax, browser script ordering/integrity and BW-1 through BW-20.1 regressions. The BW-21 check is registered immediately after BW-20.1.

## Selected architecture and translated boundary

`language.js` is a dependency-free browser/CommonJS module. It owns strict allowlists, defaults, safe restoration/persistence, English fallback, German registry entries and text-safe application through `textContent`/attributes. `app.js` mirrors explicit `uiLanguage` and `campaignLanguage` values in runtime state but never serializes them with Board or Brand state.

The translated package boundary is the actively used Campaign Canvas primary navigation and toolbar, Filters and Utilities popovers (including language settings), and the V3 campaign setup/progress/completion/error flow. Dynamic user-created or API-provided Board names, Brand names, member identities, node fields and comments are explicitly outside this boundary and are never passed to the translator. Legacy and specialist Brand Brain editors remain English in this stability-first package.

Generation captures `campaignLanguage` on submit. The browser sends only `en`, `de`, or `es`; the server independently maps that identifier to a controlled language name and defaults malformed input to English, preserving the previous behavior. The prompt requires user-facing assets in that language while preserving schema keys, types, enums, IDs and diagnostics. Repair instructions carry the same captured identifier. UI progress always resolves through `uiLanguage`.
