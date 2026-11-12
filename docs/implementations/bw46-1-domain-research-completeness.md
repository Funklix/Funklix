# BW-46.1 — Domain research completeness and field integrity

Base: `14eb9617fd7821fff0dde727dec04fb754ff0f0e` (main including PR #859). Implementation date: 2026-11-11. Follow-up to [BW-46.0](../audits/bw46-brand-profile-onboarding-completeness.md). No visual redesign, database schema change, new provider, additional inference request, customer write, merge or deployment.

## Delivered behavior

`analyzeBrandDomain` now calls the request-local `researchDomain` helper. Every document still goes through `retrieveWebsiteText`, the existing HTTPS/public-address/DNS-pinned/TLS-verified transport. The public specific-page extraction and Founder import routes retain their single-page contracts.

Research consults robots.txt, fetches the submitted page, discovers the homepage, eligible same-origin navigation, robots/link sitemap references and conventional sitemap.xml, including sitemap indexes. Relevant topics include About/company, founders/team, mission/vision/values, products/services/features/pricing, audiences/industries/customers, case studies/testimonials, FAQ/contact, and public editorial/resources. Topic selection uses URL and visible anchor text, including nested markup. Opaque URLs without a recognizable topic can be excluded; this heuristic is not a completeness guarantee.

Automatic targets exclude query-bearing navigation, credentialed URLs, account/auth/admin/cart/checkout paths, obvious non-HTML assets and other origins. External/invalid/non-HTML navigation exclusions are counted separately from the in-scope source inventory. A directly submitted URL retains its existing safe public redirect behavior; automatic page/sitemap redirects must stay on the research origin, checked **before** requesting the next hop. Redirect aliases and identical content are recorded; repeated evidence does not consume context again. Logo acquisition remains a separate preview/review/write authority.

Robots groups, Allow/Disallow wildcards and Crawl-delay are honored. The minimum request-start spacing is 250ms, with concurrency one. HTTP 404/410 robots responses permit ordinary public retrieval. An unavailable/invalid robots response permits only the explicitly requested page and defers automatic crawling. Known robots exclusions also apply to the submitted URL. Link and page nofollow restrictions are honored (including X-Robots-Tag); HTTP restrictions are never bypassed. No session cookies or credentials are forwarded. No JavaScript rendering, login, paywall bypass, robots retry loop or external crawler is introduced.

## Evidence preparation and response contract

The old first-240-block extraction gate is removed. Long visible blocks are segmented into bounded units; selection continues after an oversized unit. Exact duplicates and omissions now have separate counters. Titles are entity-decoded. Research receives all extracted visible units and relevant metadata, including metadata beyond the compatibility projection's presentation limit. Script/style/template/hidden/form content remains excluded. Static relevant metadata can contribute evidence when a JavaScript shell has no readable body; its source is explicitly labeled `metadata_only`, not rendered-page coverage. The public specific-page/Founder text extractor keeps its existing body-text contract. JSON-LD business facts are not newly extracted; the separate logo ranker retains its existing structured-logo handling.

Evidence selection is round-robin across sources, with relevance ranking within each source. Late relevant statements can participate before a long opening consumes the existing context budget. Each selected record retains source ID, sanitized URL and text. This is deterministic evidence selection, **not** semantic analysis of every extracted unit. Exact text duplicates may share preparation; distinct contradictory claims are retained.

The compatible response still includes `suggestions`, `logoDiscovery`, and `source.{url,sections,truncated}`. `sections` now counts selected evidence units; `truncated` conservatively indicates partial research. The additive `research.version = brand-domain-research/v1` envelope contains:

- `sources`: each in-scope URL, discovery origin, retrieval/extraction/processing outcome, final URL, retrieval time, content hash, unit counts, duplicate/alias references and bounded error reason.
- `documents`: robots and sitemap outcomes, separate from brand-content page counts.
- `counts`: discovered / fetched / extracted / processed / unavailable / rejected / deferred page totals. “Processed” means selected excerpts were submitted in the **one successful existing model request**, not that the entire page was understood.
- `selectedEvidence`, `remaining`, `excludedDiscovered`, `discoveryOmitted`, and explicit limitations and resource bounds.
- `fields`: supported schema paths, `website_supported`, `ai_interpretation`, `missing`, or `conflicting`, with checked source IDs and exact supporting excerpts of at most 300 characters. Excerpt occurrence establishes attribution, not entailment or truth. Strategic voice/messaging/value-proposition proposals remain interpretations even with citations. Missing means no returned suggestion, not a claim that the site lacks that information.
- `moduleSuggestions`: review-only drafts for existing mission/vision/values/product_knowledge/audience/icp modules. Only drafts with checked excerpts are returned; rejected and not-returned modules are explicit. No automatic module write or second Founder Story source model is introduced.
- `provenancePersisted: false`: evidence is request/session-local and is **not** saved with canonical fields.

Output is typed against the existing supported fields, with bounded list/string shapes. Unsupported native keys are excluded and reported in `research.rejectedFields`, preserving compatible supported suggestions; dangerous structural keys and malformed supported shapes invalidate the response. Untrusted source records are JSON-delimited under a separate system instruction; source instructions cannot authorize tools or writes. Returned suggestion text and research excerpts are text-safe; UI rendering uses text nodes. Invalid quotations are discarded and their associated native suggestion remains an explicitly ungrounded AI interpretation. Conflicting native drafts remain in `research.fields[].draftValue` and are excluded from automatic field adoption. Module drafts require manual review/editing in the existing module surface.

Provider errors return the usable source/evidence preparation envelope with zero successfully processed pages and no suggestions. Individual fetch/extraction failures preserve useful pages. Remaining queued work is marked deferred; omitted evidence is counted. There is no automatic continuation or durable resume token: manual retry restarts request-local work. Discovery exhaustion is named `eligible_discovered_sources_processed`, never “whole website complete.”

## Technical and AI boundaries

| Boundary | Actual behavior / purpose |
|---|---|
| Source URL | Existing <=2048 characters, HTTPS, public destination, no credentials, port443, validated DNS answers and redirects |
| Per response | Existing 4MiB transferred / 6MiB decompressed, encoding/content-type validation, <=5 redirects, <=10s request timer |
| Parser | Existing <=100,000 tags; no script execution or XML entity expansion; sitemap DOCTYPE/ENTITY rejected |
| Robots | 256KiB transferred/decompressed, same safe transport; unavailable policy defers automatic research |
| Research retrieval | Shared 20s window, concurrency1, >=250ms spacing or site's larger Crawl-delay; elapsed work yields a partial inventory |
| Request-local evidence | 12MiB retained evidence; 512KiB estimated URL-ledger allocation (URL bytes + per-entry overhead); overflow is disclosed rather than called complete |
| Provider input | Existing 16,000-character source-context budget, including serialized IDs/URLs; not represented as the model's maximum context window |
| Provider | Existing `gpt-4.1-mini` Chat Completions endpoint; exactly one call, no retry/provider change; 30s abort timer and 200,000-character response-parse boundary |
| Cancellation | Request disconnect/abort propagates to retrieval and provider; no automatic restart |
| Persistence | Existing <=1MiB write command/core and protected revision/expected-value/review/receipt/role contracts unchanged |

These are explicit technical safeguards, not a page-count or result-count product quota. A large site can exceed a request's retrieval, evidence or inference budget. Complete multi-batch semantic processing/consolidation would require additional model requests plus cost, cancellation, token accounting and durable lifecycle design; it is **not implemented or authorized here**. Model quality, deployed execution duration/plan limits and live-site availability were not measured; the application's retained input budget is not a verified model maximum. The existing logo preview can require additional image retrieval after research; it is not counted as text processing. No deployment duration setting is changed.

## Canonical integrity and Founder compatibility

See the [field-by-field matrix](../audits/bw46-1-brand-field-integrity-matrix.md). Website research itself performs no canonical write. Guided `analyze` still automatically persists **empty** supported native fields using `domain_fill` plus authoritative readback. Nonempty values become comparison proposals; selected acceptance uses `domain_accept`. Assets fill only empty individual colors/typography/references; domain is user-owned and logo is excluded. No evidence envelope is inserted into `brand_core`, command `source`, Learnings or campaign snapshots.

Protected writes preserve revision checks, exact old values, destructive review, idempotent receipts, Brand ACL and unrelated nested data. Accepting an array suggestion intentionally replaces that reviewed array; unknown fields outside that target remain protected. Saved canonical content, approved DNA/avatar, accepted Founder module data, approved modules, Learnings and independent logo authority are not regenerated by research. Legacy `analyzeBrandDomainFromEditor` remains the explicit-confirmation campaign-snapshot importer; its existing replacement semantics and simulated progress copy remain distinct and are documented, not silently converted to canonical behavior.

Specific Founder page extraction/mapping still uses `/api/extract-website-text` and `/api/map-founder-story-website`, seven exact-evidence fields, editable review, selected application, and existing Board persistence/lifecycle guards. Narrative acceptance and recommended Founder→DNA dependency remain separate. Missing Founder information does not block ordinary profile edits. Guided plain Founder content is not equivalent to accepted structured Founder facts. The dedicated existing tests cover mapping, context/lifecycle/cancellation and optional preflight; no live founder/provider claim is made.

## Validation and review

All website/provider/storage tests use fictional transports. `check-bw46-1-domain-research.js` exercises the real retrieval/parser/analyzer functions across one-page/multi-page, About, Founder, product/service, nested sitemap, duplicate, redirect, private target, large/late evidence, script-only, unavailable source, conflicting/absent facts, injected instructions, typed-invalid output, failed provider, policy failure and elapsed-work cases. Existing compression/DNS/TLS/redirect suites remain intact.

`check-bw46-1-brand-fields-browser.js` runs the actual app, real guided/advanced form event bindings, production HTTP handlers and protected write helper against a disposable SQL adapter, followed by authoritative GET/reload. It records 28 guided input bindings and a leaf inventory. The adapter is not a substitute for PostgreSQL permission/history execution. Advanced module leaves are tested through actual JSON editing, not inferred from JSONB storage. Unexercised lifecycle controls and specialized strategy editors are labeled in the matrix.

Local real PostgreSQL17.6: **68 protection groups + 55 restricted-runtime groups passed**, using the same non-bootstrap `postgres` operator as CI. Unchanged main passes the same groups. An initial run with the bootstrap fixture-admin as the operator produced a denial-message mismatch; matching CI's intended operator resolved it without modifying assertions or security. **PostgreSQL18.4: the same 68 protection + 55 restricted-runtime groups passed.** The full GitHub Runtime Boot Safety matrix remains a separate CI gate reported in the PR and final delivery.

The existing Runtime Boot Safety workflow retains both PostgreSQL17.6 and18.4 matrix jobs. Both new checks are added to that workflow. Existing Brand/onboarding/Founder/DNA/protected-write/Canvas/AI Brain suites are run locally; final results are listed below when the run completes. CI is a separate required gate, never implied by local fixture success.

Test expectation corrections are narrow: a true HTTPS loopback redirect still requires `unsafe_destination`; a separate HTTP case still requires HTTPS-first rejection. Navigation/footer retention is the unchanged extractor policy (confirmed on main), so the extractor fixture now expects it while checking script/form/hidden exclusion. The old first-unit-stops-all assertion now expects later fitting evidence. Stale logo-upload/DOM assertions now check the separate canonical logo preview/write authority. VM fixtures receive standard Node AbortController/timer globals needed by cancellation; no production protection is bypassed.

Publication review: only implementation, fictional tests and these documents are intended for publication. No scratch logs/screenshots, dependency directories, downloaded attachments, customer sources, secret values or environment dumps are included. The only credential-like strings in fixtures are existing explicitly disposable local test values. Self-review checks source-stage accounting, same-origin redirects, robots/SSRF/TLS, typed output, no raw HTML, conflict auto-fill exclusion, canonical/snapshot boundaries, and request-local provenance. Remaining defects are deliberately documented for narrow follow-ups, not bundled editor rewrites.

## Representative coverage and final local results

The deterministic Northstar graph in the new test is the comparison fixture. Before: the actual main analyzer fetches only the submitted root. After: the same submitted root leads to the following explicit source outcomes (robots/sitemaps excluded from page counts):

| Stage | Main single-page behavior | BW-46.1 fixture result |
|---|---:|---:|
| Discovered in-scope page URLs | Not inventoried (one submitted URL) | 13 |
| Successful page retrievals | 1 | 10 |
| Usable extracted pages | 1 | 9 |
| Pages with selected excerpts in the one successful model request | 1 | 8 |
| Unavailable retrieval/extraction sources | Not inventoried beyond root | 2 |
| Explicitly rejected site candidates | Not inventoried | 2 |
| Deferred page fetches | No discovery/queue | 0 |
| Omitted evidence units | Early clipping, incomplete accounting | 146 |
| Paid/provider calls during fixture test | 0 real (one mock) | 0 real (one mock) |
| Canonical writes by analyzer | 0 | 0 |

One fetched page is script-only, one relevant page is denied, and an identical page retains a duplicate reference. Late mission evidence, separate Founder/About and product/service evidence reach the one selected context; 146 remaining units are explicitly **not** called analyzed. The 80-product graph retrieves all 81 eligible HTML pages without a fixed page quota, then reports semantic-context omissions as partial. Model reasoning quality is not established by a mock. Field suggestions and accepted canonical storage are separate stages; acceptance is tested by the browser/handler tests, not by the retrieval counters.

Local existing regression commands (all `node scripts/<name>.js`):

| Check | Result |
|---|---|
| `check-bw26-6-3-large-brand-core-website-import` | PASS |
| `check-founder-story-website-mapping` | PASS |
| `check-founder-story-website-import-lifecycle` | PASS |
| `check-founder-story-brand-dna-context` | PASS |
| `check-founder-story-archetype-lifecycle` | PASS |
| `check-brand-dna-generation-preflight` | PASS |
| `check-canonical-brand-foundation` | PASS |
| `check-bw36-23-brand-knowledge-protection` | PASS |
| `check-bw36-23-brand-knowledge-browser` | PASS |
| `check-bw36-22b2r1-canonical-conflict-reload` | PASS |
| `check-bw36-17-governed-brand-learnings` | PASS |
| `check-bw37-1c1-brand-profile-proposal` | PASS |
| `check-bw36-13r4-guided-brand-profile-setup` | PASS |
| `check-bw42-brand-profile-browser` | PASS |
| `check-bw36-13r5-brand-lifecycle-stability` | PASS |
| `check-bw3-canonical-brand-creation` | PASS |
| `check-bw7-canonical-brand-editing` | PASS |
| `check-bw20-brand-team-roles` | PASS |
| `check-bw28-ai-insights-architecture` | PASS |
| `check-website-url-policy` | PASS |
| `check-website-retrieval-diagnostics` | PASS |
| `check-extract-website-text-route` | PASS |
| `check-bw36-20-approved-learning-ai-brain` | PASS |
| `check-website-retrieval` | PASS |
| `check-html-text-extractor` | PASS |
| `check-guided-brand-foundation-journey` | PASS |
| `check-bw5-board-brand-isolation-regression` | PASS |
| `check-bw8-brand-core-comparison` | PASS |
| `check-bw9-initialize-canonical-brand-core` | PASS |
| `check-browser-script-integrity` | PASS |
| `check-postgres-tls` | PASS |

Additional checks: nine new domain-research scenario groups passed; actual guided/advanced field browser check passed; PostgreSQL protection 68/68 and restricted runtime55/55 groups passed on both17.6 and18.4; syntax and `git diff --check` passed. No security/integrity assertion was weakened. Remote CI/reviews remain separately observable PR outcomes.

## Additional workflow replay and final source review

A local replay of the Runtime Boot Safety commands on PostgreSQL18.4 passed the initial 154 commands, then failed at BW-43 `check-bw43-insights-browser.js:135`, assertion **Expanded Journey sources reflow**. The same command fails at the same assertion on unchanged main `14eb961`, using the same system Chromium. This is an inherited failure in this local browser environment; the assertion is retained. Independent later checks continue separately. This local replay uses already-supplied dependencies, the prepared CI operator and system Chromium; it is not a claim of remote GitHub CI success. PR creation was blocked by automatic approval review pending direct chat authorization, so no remote PR CI/review result exists yet.

Final self-review caught a malformed-anchor complexity issue in the new discovery scanner. Navigation now visits each text/tag span once, accumulates nested anchor labels without repeatedly searching the remaining document, and applies the existing100,000-tag parse safeguard. Robots/XML requests advertise the appropriate Accept type while HTML requests retain their existing header. Sitemap URL/CDATA extraction uses the same bounded scanner instead of materializing unbounded regex matches. Deterministic regressions cover10,000 unclosed anchors, nested labels, CDATA, and navigation/sitemap parse-limit rejection. The full Profile decisions regression exposed an adapter compatibility issue: unsupported provider keys now receive explicit rejection diagnostics while valid supported fields retain their existing batched adoption behavior. Provider aborts are normalized into stable cancellation/timeout errors without mutating read-only DOMException codes; fixtures cover both branches. No original transport or integrity assertion is weakened.


## Completed local workflow replay

All225 workflow run commands were attempted on the disposable PostgreSQL18.4 environment. The three setup commands (dependency installation, non-bootstrap operator preparation, Chromium installation) used already-supplied equivalents; system Chromium differs from CI's downloaded browser, so this is a local replay, not remote CI certification.

| Final local result | Evidence / treatment |
|---|---|
| 223 commands pass, including documented retests | All remaining commands continued independently after the first failure; both new BW-46.1 checks, real PostgreSQL protection, initialization/replay recovery and maintenance gate pass |
| BW-43 `Expanded Journey sources reflow` assertion fails | Same assertion and line fail on unchanged main `14eb961`; retained unchanged |
| Safe Workspace switching incomplete at240s | Both head and unchanged main reached the local240s command cutoff while progressing through scenarios; no universal pass or product-defect claim; remote CI must complete this suite |
| Profile decisions/deletion initially exposed an adapter regression | Fixed in production adapter, not by weakening tests: unsupported keys receive explicit diagnostics while valid native suggestions retain batched adoption. Entire controller/browser suite then passes, including reviewed replacements, nested preservation, permissions, locale/theme/widths |
| Advisor visual contrast initially failed locally | Unchanged main passes. Standalone final-branch rerun passes all48 captures, text contrast, reduced motion, forced colors and focus checks; no CSS or contrast assertion changed. Recorded as an intermittent local result, not an inherited assertion failure |

Final coverage details display original and redirected source identities and explicitly disclose excluded unsupported suggestion fields. The actual field-browser test verifies this copy in EN/DE and both themes, alongside save/reload, clearing and snapshot isolation. Empty structured values are classified as missing, not as suggestions merely because the object has field names.

Remote Runtime Boot Safety on both PostgreSQL matrix versions and external PR reviews remain **unavailable**, because automatic approval review rejected public PR creation pending direct chat authorization. No PR URL, remote CI success, human approval, merge or deployment is asserted. The final hardening commit remains local until publication approval; the earlier implementation commit was already pushed. Detailed local logs, images, dependencies and baseline checkout remain uncommitted.
