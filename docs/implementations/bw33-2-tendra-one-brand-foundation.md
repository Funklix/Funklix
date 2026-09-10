# BW-33.2 — Tendra One brand foundation

## Investigation and scope

The BW-33.1 inventory was rechecked before implementation. Product-name presentation occurred in the document title, sidebar placeholder mark, interface-language help, Insights disclosure, Founder Story and generation guidance, Social Connections authorization/disconnect copy, Content Workspace publication recovery, and localized English/German strings. There is no separate login page, email template, manifest, Apple icon, Open Graph metadata, or prior favicon in this repository. Authentication remains in the existing top bar and inherits the branded shell.

Compatibility-sensitive `Funklix*` browser globals, `funklix.*` storage keys/events, `funklix_session` and OAuth cookies, `x-funklix-request-id`, `ai@funklix.local`, diagnostic labels, provider user-agent, publishing idempotency namespace, DOM IDs, CSS `.fk-*` hooks, API/database contracts, routes, environment variables, migrations, and historical documentation remain unchanged. They are runtime or deployed integration contracts rather than product presentation.

The existing theme hierarchy starts with BW-27 semantic light and `html[data-theme="dark"]` roots, followed by legacy `--fk-*` compatibility tokens and component overrides. BW-33.2 therefore adds `--brand-*` roles and maps only bounded existing aliases; it does not rename compatibility variables. Compact remains the approved future Canvas default, but this phase adds no preference, storage key, control, node-density rule, or Board mutation.

## Asset inspection and normalization

The untouched symbol SVG is 440 × 354 with `viewBox="0 0 440 354"`, 180 paths, no scripts, events, links, masks, clips, or gradients. Its traced paths include a near-white background and baked color transitions. The wordmark SVG is 612 × 172 with a matching viewBox, 124 paths, and the same absence of active/external content. Both are complex traced exports rather than clean masters.

The PNGs are 440 × 354 and 612 × 172, respectively, 8-bit RGBA. They are not upscaled or shipped because SVG is supported by the current browser surfaces and the non-square rasters are poor application-icon candidates. The source SVG root generator attributes and fixed `width`/`height` were removed from deterministic production copies while viewBoxes, path order, path data, fills, opacity, strokes, and visible proportions remain byte-equivalent. Source SHA-256 values are pinned by the BW-33.2 check.

Production assets:

- `/assets/brand/tendra-one-symbol.svg`: primary shell mark and SVG favicon.
- `/assets/brand/tendra-one-wordmark.svg`: normalized provisional wide-surface asset, not placed in the dark shell because its traced artwork has no approved dark-background variant.

The shell uses the unchanged-gradient symbol plus accessible rendered “Tendra One” text and tagline on a controlled theme surface. At collapsed and narrow widths, the symbol remains and the rendered copy hides without changing shell ownership. The browser falls back to its default icon if SVG favicons are unsupported; no fabricated raster master is supplied.

## Theme and accessibility recipe

Light uses Deep Focus `#4F46E5` for primary/focus, `#4338CA` hover, Creative Energy for secondary emphasis, the approved warm accents only as decorative aliases, Clear Thinking for the app foundation, and white primary text. Dark uses lavender `#A78BFA` actions, `#C4B5FD` hover/focus, and layered violet-slate app/page/nav/canvas/panel/card/elevated surfaces (`#101225` through `#282B4A`) rather than black. Existing warning, danger, success, disabled, focus-visible, reduced-motion, and forced-colors contracts remain independent. The logo has a single accessible name; its decorative image has an empty alt.

## Behavior and release boundaries

No stable ID, event owner, visibility contract, route, storage key, Canvas/Inspector/Content Workspace lifecycle, collaboration/review/approval flow, publishing material, or response contract was changed. LinkedIn text publishing remains environment-gated and disabled by default. Only personal destinations remain modeled; no Company Page or image-publication path was added.

The provisional vectors retain visible tracing complexity, including the symbol's near-white backdrop and highly segmented color geometry. A clean original vector export and an approved dedicated dark-background wordmark are still recommended before treating these files as master artwork.
