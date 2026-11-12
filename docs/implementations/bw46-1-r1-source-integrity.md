# BW-46.1 R1 — Source integrity and redirect robots policy

Base: `7dc8d26` (latest main including merged PR #860). Scope: the two P2 findings [same-page conflicts](https://github.com/Funklix/Funklix/pull/860#discussion_r4543535842) and [redirect destination robots](https://github.com/Funklix/Funklix/pull/860#discussion_r4543535851). Implementation authorized; no merge or manual deployment.

## Same-source conflicts

Before: `groundedFields` required multiple distinct source IDs to preserve a provider-reported conflict. Two checked quotations from one page ("Our company started in 2001." / "Our company started in 2002.") became `ai_interpretation`. The conflicting draft survived `suggestions` and could enter the guided empty-field `domain_fill` mutation.

After: a reported conflict remains `conflicting`, independently of source count. Checked evidence is deduplicated by the pair `(sourceId, excerpt)`; different excerpts from one source remain separate evidence. Duplicate, absent or invalid citations cannot downgrade a reported conflict into an adoptable interpretation. Existing conflict filtering retains the draft and checked references in the research envelope and clears the corresponding automatic suggestion. The existing single inference prompt explicitly includes within-page contradictions. No independent semantic detector or additional inference is introduced.

Production-path fixtures cover one-page and cross-page contradictions, duplicate and invalid citations, ordinary supported evidence, empty/nonempty canonical descriptions, and independent valid suggestions. Actual `BrandProfileSetup.createSession().analyze()` calls consume the analyzer result, then use the protected HTTP handlers and authoritative readback against the existing fictional SQL adapter. Conflicts alone cause zero PUTs and no Brand/revision change. Ordinary supported descriptions fill empty fields; existing descriptions remain intact. Mixed responses adopt only eligible fields, and campaign snapshots and unrelated module data remain unchanged.

## Effective redirect policy

Before: the safe retrieval transport followed a submitted public URL to another origin. Research loaded that origin's robots policy but extracted the returned page without checking whether the new policy allowed its final URL. A disallowed submitted page could contribute evidence despite a separately discovered alias being rejected.

After: robots rules in the per-hop callback apply only to their own origin. Restricted paths and the existing HTTPS/public-DNS/address-pinned/TLS/redirect checks remain active. The final URL is validated, its origin's policy loaded when necessary, and the effective resource checked before discovery, extraction, deduplication/cache insertion, root-page reuse or evidence selection. Already-fetched disallowed bytes are discarded. The inventory records `retrieval: rejected`, `reason: robots_disallowed`, with no extraction or processing; the effective URL and retrieval timestamp remain available when the response had already arrived. Same-origin robots-denied redirects also receive the precise rejection reason through the existing typed retrieval error.

The existing unavailable-policy contract is preserved: 404/410 allows public research, while other robots failures permit only the submitted page and defer automatic crawling. No new transport or crawler is added. Final policy enforcement happens after the submitted response has been fetched; this fix excludes those bytes from research rather than claiming it prevented that already-completed request.

Fixtures use hostname-aware fictional HTTPS transports and mocked providers. They cover original-host allow versus destination disallow, denied canonical www root redirects, allowed cross-origin/www/same-origin redirects, robots 503 and 404, mixed allowed/disallowed sources, aliases to denied paths, and provider-failure partial results. A sole disallowed source produces zero selected evidence and zero model calls. A denied submitted destination plus allowed sitemap sources retains only allowed evidence; denied HTML cannot introduce links, cached excerpts, or partial-result content.

## Reproduction and validation

The two new scenario groups were run against production modules from `7dc8d26` before the fix. Same-page conflict reproduction failed with actual `ai_interpretation` versus expected `conflicting`. Destination-robots reproduction reached the mocked provider with the forbidden marker, failing the no-disallowed-context assertion. Loading unchanged main modules into the extended fixtures reproduces both failures without modifying the checkout. Both groups pass on the corrected modules.

- `node scripts/check-bw46-1-domain-research.js`: all 11 scenario groups pass, including the two extended production-path groups. `BW46_SCENARIO=same-page` and `BW46_SCENARIO='redirect destination'` select the focused regressions.
- `node scripts/check-bw46-1-brand-fields-browser.js`: pass; 28 guided bindings, 227 inspected fixture leaves, advanced protected save/reload, viewer denial and snapshot isolation. Existing F2/F6 defects remain characterized separately.
- Existing URL policy, retrieval, retrieval diagnostics, HTML extraction, extraction route and large Brand website-import checks: pass.
- Founder website mapping/import lifecycle/Brand DNA context/archetype lifecycle and DNA generation preflight: pass.
- Protected Brand contract, browser-script integrity and PostgreSQL TLS checks: pass. No protected function or digest is changed.

Full Runtime Boot Safety matrix results are tracked in the pull request CI and delivery report. Local workflow replay uses existing dependencies, system Chromium, the workflow's non-bootstrap PostgreSQL operator, original commands and per-step environment. It continues after failures to expose subsequent checks. Dependency installation and the hosted browser installation are environment preparation; local replay reuses the supplied tools. Remote GitHub Actions remains an independent gate.

## Scope and publication review

Changed production files are only `api/analyze-brand-domain.js` and `api/_brand-domain-research.js`; tests extend the existing `scripts/check-bw46-1-domain-research.js`. This document is the only new tracked file. No API routes, migrations, dependencies, UI, protected writer, Brand mapping, provider count, Foundation/Founder/DNA/logo/avatar/Learning authority, authorization or Canvas behavior is changed. No paid inference or customer website requests occur. Only fictional fixtures and focused source/documentation are published; scratch logs, downloaded attachments, screenshots, dependency directories and environment data are excluded.

Remaining limits: conflict detection still relies on the existing provider reporting a conflict; excerpt occurrence is attribution rather than entailment or independent fact verification. Evidence remains request-local. Robots-unavailable behavior and bounded partial research retain the BW-46.1 contract. The fixes do not repair unrelated persona-context or DNA input-binding defects identified in the field-integrity matrix.
