# BW-33.2R1 — Corrected Tendra One brand foundation

## Edit boundary and naming

This bounded foundation changes the existing sidebar lockup, presentation metadata, presentation-only product copy, semantic brand aliases, and production brand asset. It does not restructure the shell or change authentication, routing, state ownership, Canvas, Inspector, Content Workspace, publishing, or provider behavior.

Presentation copy now names **Tendra One** in the document title/application metadata, the sidebar, settings and Social Connections explanations, Insights limitations, AI/strategy helpers, campaign creation, Founder Story guidance, and the Content Workspace publication-confirmation message. Compatibility names remain unchanged, including `window.FunklixLanguage`, `window.FunklixContentWorkspace`, `.fk-*`, `funklix_session`, OAuth state cookies, `funklix.workspace-brand.v1.`, diagnostic namespaces, request headers, and publishing/idempotency namespaces. Campaign Canvas remains the feature name. The tagline appears only in description metadata.

## Asset normalization

Production uses `assets/brand/tendra-one-symbol.svg`; no production surface reads from `docs/brand-assets`. All four source files retain their baseline SHA-256 digests, asserted by the BW-33.2R1 regression.

The source symbol contains 180 traced paths. Path 0, fill `#FCFBFB`, begins `M278.000000,355.000000` and describes a compound near-white backdrop with outer bounds approximately x=1.043525–440.831482 and y=1.099251–355. It was the visible rectangular sticker and is the only removed path. The production viewBox is cropped from `0 0 440 354` to `36 28 371 303`, retaining roughly eight units of breathing room around mark geometry at approximately x=44–399 and y=36–323. All 179 mark paths remain, including path 82 (`#FCFBFC`, beginning `M198.291595,253.753326`) as internal tonal geometry. The intentional circular opening remains as unpainted negative space between the three surrounding forms, so it correctly reveals the surface behind it rather than acting as a white tile.

The shell renders the vector at 40 × 32 CSS pixels (preserved aspect ratio with `object-fit: contain`), aligned centrally with an 8px gap. The rendered name is a single, non-wrapping line. Collapsed mode hides the name, sizes the symbol within 20 × 32 CSS pixels, and retains the lockup's `aria-label` and title. No tile, filter, card, badge, or backdrop is applied.

The traced source remains unusually path-heavy and includes subtle raster-trace edge character. A future brand package should replace it with an original clean vector supplied by the designer, preserving the approved geometry and color transitions rather than algorithmically simplifying this trace.

## Brand tokens

Light Mode maps Deep Focus `#4F46E5` to primary/action/focus, uses a restrained `#EEEDFF` selected surface, and retains neutral Clear Thinking `#F8F9FB` as the approved neutral reference. Dark Mode keeps the existing layered slate/violet application surfaces and maps Creative Energy `#A78BFA` to primary action, `#C4B5FD` to hover/focus, and a 14% Creative Energy tint to selected surfaces. Human Warmth `#F8B4C4` and Open Possibility `#FFD1A8` are aliases for future restrained moments, not replacements for semantic warning, error, success, disabled, or informational colors.

## Authentication preservation

The regression pins the exact post-revert SHA-256 baselines of `_auth-session.js`, Google OAuth start, Google OAuth callback, and session route. It also asserts the Google/sign-out DOM IDs and listener ownership, `/api/auth/google/start`, `/api/auth/session`, origin-derived `/api/auth/google/callback` construction in both OAuth phases, and all three established cookie names. No production hostname is hard-coded.

## Rendered acceptance evidence

A deterministic local raster harness removed only edge-connected near-white source canvas pixels while preserving enclosed mark geometry, then rendered seven PNGs under `/tmp/bw332r1-evidence`: symbol on white, symbol on dark violet/slate, expanded header, collapsed header, narrow shell, full Light shell, and full Dark shell. All seven were inspected. The evidence showed no outer rectangle, excessive whitespace, tagline, name wrap, control collision, blurred source substitution, unreadable Dark Mode mark, global purple wash, or navigation geometry change. The central opening remained visible as an intentional opening on both backgrounds.
