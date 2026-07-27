# A6 Founder Story Website Import Architecture Audit

**Date:** 2026-07-27  
**Topic:** Secure website retrieval and deterministic text extraction foundation for Founder Story import  
**Inspected commit:** `1e57992` (`Merge pull request #531 from Funklix/codex/integrate-founder-story-into-brand-dna-generation`)

## 1. Executive Summary

The repository can isolate one authenticated, request-scoped website retrieval route under `api/` without changing browser state or the Founder Story model. Node's `http`/`https`, `dns.promises`, `net`, streams, `AbortSignal`, and a pinned custom `lookup` can provide manual redirects, streaming limits, and validation-to-connection address binding. The repository has no general HTML DOM parser; A7 does not need a DOM and can isolate a conservative inert tokenizer that only emits bounded text and never executes markup. With address pinning at every hop, fail-closed DNS validation, manual redirects, strict bounds, and no persistence, the architecture is ready.

## 2. Repository State and Inspected Commit

Inspection began on branch `work` at `1e57992`. `git status --short` showed only an unrelated untracked `node_modules/` directory; `git diff --name-only` and `git diff --stat` were empty. That directory is user/environment-owned and must not be staged. The runtime is Vercel-style CommonJS functions configured by `vercel.json`; the inspected local Node runtime is v24.15.0. `package.json` initially declares only `@vercel/blob` and `pg`.

## 3. A1–A5 Contracts

A1/A2 establish registry-backed Knowledge Module identity and graph metadata in `knowledge-module-registry.js`, `knowledge-module-identity.js`, and `knowledge-module-runtime-adapter.js`. A3 exclusively evaluates typed-module readiness in `knowledge-module-dependency-engine.js`. A4 owns Brand DNA preflight and its user choice in `brand-dna-generation-preflight.js` plus the calling flow in `app.js`. A5 passes a narrow, readiness-gated Founder Story context into Brand DNA discovery through `buildUsableFounderStoryContext()` and `discoverBrandDna()`; `scripts/check-founder-story-brand-dna-context.js` protects that boundary. A7 must not call or modify any of these contracts.

## 4. Founder Story Architecture and Exact Seven Fields

A valid Founder Story is a typed Custom Tile whose persisted `moduleType` is `founder_story`; title matching is not identity. `app.js` defines `FOUNDER_STORY_FIELD_DEFINITIONS` and stores exactly seven structured fields under `moduleData.founderStory`:

1. `founderNameRole`
2. `observedProblem`
3. `motivation`
4. `turningPoint`
5. `background`
6. `proofPoints`
7. `vision`

The editable/generated narrative remains `tile.content`. `api/generate-founder-story.js` independently allowlists the same seven keys in `FOUNDER_STORY_SOURCE_KEYS`.

## 5. Founder Story State Ownership and Write Path

`renderFounderStoryCustomTileEditor()` in `app.js` owns the specialized manual editor. `getFounderStoryModuleData()` reads conservatively; `updateFounderStoryTile()` merges only known fields, and accepted narrative generation writes `tile.content` only after explicit review. `saveBrandBrainState()` is the existing persistence path. A7 must remain server/request-scoped and must not import, call, or alter these paths.

## 6. A3 Readiness Ownership

`evaluateFounderStory()` and `READINESS_EVALUATORS` in `knowledge-module-dependency-engine.js` are authoritative. Readiness requires founder identity (or Brand name fallback) plus two of the six detail fields. A7 returns extracted text only and cannot calculate or persist readiness.

## 7. A4 Preflight Boundary

`evaluateBrandDnaGenerationPreflight()` in `brand-dna-generation-preflight.js` consumes dependency-engine output rather than inspecting fields. `initiateBrandDnaGeneration()` in `app.js` owns recommendation/continue behavior. A7 has no dependency on preflight and must not change it.

## 8. A5 Brand DNA Context Boundary

`buildUsableFounderStoryContext()` in `brand-dna-generation-preflight.js` emits only allowlisted structured facts and optional supplemental narrative after a usable A3/A4 result. `api/discover-brand-dna.js` sanitizes this optional context. Website text is not Brand DNA context in A7 and must not enter this flow.

## 9. Existing Server and AI Infrastructure

Routes are CommonJS handlers under `api/`. `api/generate-founder-story.js` demonstrates POST-only routing, `{ success, error: { code, message } }` errors, `getSessionUser()` authentication, optional `getBoardAccess()`, server-only provider credentials, and sanitized diagnostics. A7 needs authentication but no Board access because its request contract has no Board id and no state write. AI routes use global `fetch`, but its automatic DNS/redirect connection behavior cannot bind an audited DNS answer to the actual socket, so it is unsuitable for attacker-controlled URLs. A7 contains no AI call.

## 10. Existing URL Retrieval and HTML Extraction Capabilities

No repository service retrieves arbitrary submitted webpages. Existing `fetch()` uses fixed provider endpoints. There is no HTML parsing/sanitization dependency. Node has transport and streaming primitives but no DOM parser. A7 only needs bounded visible-text projection, so an isolated conservative tokenizer can parse comments, declarations, tags, quoted attributes, raw-text exclusions, and entities without constructing or executing active content. It must fail safely on empty output and be covered by adversarial fixtures; a regex-only tag stripper is not sufficient.

## 11. SSRF and DNS-Rebinding Findings

Validation before DNS is insufficient. A7 must parse canonical URLs, restrict schemes and ports, reject credentials/local aliases/IP literals in unsafe or non-canonical forms, resolve all hostname answers, reject any unsafe or mixed set, then pin one validated address into the request's custom `lookup`. HTTPS must retain the original hostname for SNI/certificate verification and the `Host` header. Each redirect repeats the full process. This makes the connected address one of the validated addresses and prevents a second resolver lookup from rebinding it. Failure to obtain or pin a safe address fails closed.

Unsafe space includes IPv4 unspecified, private, loopback, link-local, carrier-grade NAT, benchmarking/documentation/multicast/reserved ranges; IPv6 unspecified, loopback, link-local, unique-local, multicast/documentation/reserved ranges; and IPv4-mapped unsafe IPv6. Metadata IPs such as `169.254.169.254` are covered by link-local rejection. Ports are restricted to default HTTP 80 and HTTPS 443 (explicit default ports normalize safely).

## 12. Redirect, Timeout, Size, and Content-Type Requirements

A7 policy: at most 5 redirects, detect normalized-URL loops, resolve relative `Location` values, and validate/pin every hop. Use GET only, a 10-second total operation timeout, caller cancellation, and a 1 MiB wire-byte streaming cap (including compressed bytes). Send `Accept-Encoding: identity` and reject any non-identity `Content-Encoding`, preventing transparent decompression from bypassing the boundary. Accept only `text/html` and `application/xhtml+xml`. Treat non-2xx status, absent/invalid redirect location, unsupported type/encoding, empty bodies, timeout, and oversize bodies as bounded failures.

## 13. Recommended Retrieval Architecture

Add an isolated `api/_website-retrieval.js` service. Separate pure URL/address policy from DNS resolution and transport. Dependency-inject resolution/request primitives for controlled tests. Never forward inbound/user headers, cookies, authorization, referrer, or redirect-hop headers. Send only bounded constants (`Accept`, `Accept-Encoding`, `User-Agent`, `Host`). Log only stable error code/status; never URL/query, chain, HTML, text, DNS answer, or IP.

## 14. Recommended Extraction Architecture

Add `api/_html-text-extractor.js` with an inert, bounded tokenizer (no script execution, DOM, or subresource loading). Exclude `script`, `style`, `noscript`, `template`, `form`, form controls, embeds/frames, SVG/canvas, navigation/footer/aside, and nodes hidden by `hidden`, `aria-hidden=true`, or simple inline `display:none`/`visibility:hidden`. Extract title with a 300-character cap. Preserve deterministic block boundaries for headings, paragraphs, and list items; normalize whitespace and cap text at 50,000 characters with explicit `truncated` metadata. Return no DOM or raw HTML.

## 15. Draft-State and Persistence Boundary

A7 produces no import draft. Submitted/final URLs, query strings, redirect history, HTML, extracted text/title, DNS data, status, and errors remain in memory for one request. No Board, tile, `moduleData`, `tile.content`, local/session storage, Brand Brain, Brand DNA, Missing Knowledge, database, blob, migration, or history write is permitted.

## 16. A7 Scope

Implement URL/address validation, pinned DNS resolution, one-page GET transport, manual redirects, cancellation/timeout/wire-size/content checks, inert deterministic extraction, an authenticated narrow POST route, safe error mapping, and local dependency-injected tests. No browser UI is required.

## 17. A8 Scope

A8 may add an authenticated Founder Story import/review UI that submits one URL to the A7 endpoint, maps the returned bounded text with AI into a temporary seven-field draft with evidence, allows explicit review/edit/apply, and writes only explicitly accepted fields. A8 must re-read this audit, preserve A3–A5 ownership, treat website text as untrusted data, and never auto-persist URL/content or overwrite manual values.

## 18. Expected Files

- `docs/audits/A6-founder-story-website-import-architecture-audit.md`
- `api/_website-url-policy.js`
- `api/_website-retrieval.js`
- `api/_html-text-extractor.js`
- `api/extract-website-text.js`
- `scripts/check-website-url-policy.js`
- `scripts/check-website-retrieval.js`
- `scripts/check-html-text-extractor.js`
- `scripts/check-extract-website-text-route.js`

## 19. Test Strategy

Use Node assertion scripts consistent with `scripts/check-*.js`. Inject DNS and transport fakes so no test reaches the public Internet. Cover URL/address classes, mixed DNS, pinned lookup, every redirect hop, loops/limit/relative locations, headers, timeout/cancellation, streaming byte limit, content type/encoding/status, deterministic extraction/exclusions/truncation/empty output, route authentication/error response shape, and raw-content absence. Run existing browser globals, script integrity, Campaign harness, A3, A4, and A5 checks to prove compatibility.

## 20. Security or Architecture Blockers

No blocker was found. Server retrieval is isolated; private destinations and mixed DNS can fail closed; custom lookup pins validated DNS to the connection; redirect hops can be manually revalidated; wire limits can stop streams immediately; and the inert tokenizer processes text without executing or loading content. No dependency or platform prerequisite is required for the deliberately narrow inert text projection.

## 21. Final Verdict

**READY FOR A7**

READY FOR A7
