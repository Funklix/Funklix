# BW-36.22B2 INC1 — Canonical Brand knowledge integrity investigation

Date: 20 October 2026 (Europe/Berlin). Severity: **P0 suspected canonical knowledge loss; unresolved.** Documentation only. No production SQL, data writes, migrations, backfills, regeneration, cache/session clearing, restoration or deployment was performed. No paid AI or image request was made.

## Executive finding and containment

**Production loss is not verified.** No authorized production database connection, production session, private asset access, backup control plane or historical production export was available. The four observations below are supplied by the user, not independently measured. All production classifications remain **G (unknown)** until SQL/API/UI evidence is compared.

Two concrete mechanisms require investigation:

1. **Historical storage split:** the legacy Brand Brain DNA and Avatar accept flows save Board state, not canonical Brand state. A previously developed identity may still exist in a Board snapshot or an existing local Board cache while the regular Profile legitimately reads an empty canonical Brand. This is the leading explanation to check for historical knowledge that was never copied into canonical storage; it is not proof for any affected Brand.
2. **Confirmed local destructive canonical write capability:** `PUT /api/brands/:id` accepts current-revision `brandDNA: null` and `brandDNA.avatar: null`. These erase populated accepted knowledge in the disposable fixture. Before `4da5a24`, PUT replaced the entire Core, so an omitted DNA field could also disappear. Which production writes occurred, when, and from which client remains unknown. The actual incident root cause cannot be ranked conclusively without historical data.

**Immediate recommendation:** ask affected editors to pause Profile/advanced Core saves, retries, generation, acceptance and Board-to-canonical initialization while evidence is preserved. An authorized operator should preserve a timestamped, access-controlled snapshot of current database state through the approved infrastructure process and retain existing backups/WAL, relevant logs and already-existing local drafts. Do not resave incomplete Profiles, delete caches, automatically restore records or copy a Board snapshot into canonical storage. If database/history comparison confirms destructive production writes, contain the responsible write path before further analysis or repair. Any operational write freeze or deployment requires separate approval; none was executed here.

## Baseline, evidence and limits

GitHub confirmed latest `main` as `faeb730c77b81efd63903455d27daf2bbad7cfeb`, including merged PRs [#798](https://github.com/Funklix/Funklix/pull/798) and [#799](https://github.com/Funklix/Funklix/pull/799). The mounted checkout initially ended at `a4523b1` (#797); shell Git fetch failed because its configured proxy was unreachable. GitHub connector reads supplied both PR patches. Relevant files were reconstructed locally, then `git hash-object` was compared with the complete GitHub tree at `faeb730c`.

Exact blob matches were confirmed for `app.js`, `brand-profile-setup.js`, `canonical-brand-reader.js`, `home-foundation.js`, `api/brands/[id].js`, `_brands-storage.js`, `_brand-access.js`, `_brand-creation.js`, `_project-command.js`, `_boards-storage.js`, `api/boards/[id].js`, `discover-brand-dna.js`, `generate-brand-avatar.js`, and the #799 regression script. Local reconstruction is baseline material, not a proposed runtime change. The delivered PR adds only this report against latest main.

Evidence types: verified source/history; disposable in-memory database/handler/controller reproductions; user observation; production unknown. Local fixtures emulate PostgreSQL externally and execute real application handlers; they do not establish production rows, real PostgreSQL concurrency, deployment version, backup retention or image availability. No private Core contents, URLs, credentials or personal information are included.

## User-observed impact and per-Brand evidence

| Brand | Regular Profile DNA observed by user | Avatar observed by user | Independent canonical/API/UI evidence |
| --- | --- | --- | --- |
| APPICS | Present | Present | Unknown; useful comparison control, not proof of full integrity |
| SaúdeBrasil | Present | Previously saved Avatar missing | Unknown |
| Eiskrallt | Previously developed DNA missing | Previously saved Avatar missing | Unknown |
| TLDR | Previously developed DNA missing | Previously saved Avatar missing | Unknown |
| Other currently authorized Brands | Not reported | Not reported | Unknown; enumerate only within operator-approved access scope |

For **every row**: canonical existence, ID, current revision, populated Core, substantive DNA fields, both approvals, Avatar metadata, stored URL, asset response, historical revisions/backups, API equivalence and rendered equivalence are unverified. Do not infer deletion from a missing UI card. Keep real IDs and the account/Workspace/Brand mapping in the private incident record. Brand names alone are not unique identity evidence.

## Canonical write-path inventory

References below use file and function names at the pinned baseline so they remain searchable.

| Entry/path | Canonical effect and preservation boundary |
| --- | --- |
| `api/brands/[id].js` PUT handler, `mergeCore` | Only found application UPDATE of existing `brands.brand_core`. Validates top-level object, size, name and integer revision, checks independent Brand access and capability, recursively merges, then replaces JSONB with the merged result using `WHERE id=$1 AND revision=$4`. Increments revision and timestamp; no old Core is retained. Nested schema/approval values are not validated. |
| `brand-profile-setup.js` `save` | Sends full cloned editable Core and current controller revision to PUT. `editableCore` inserts defaults for listed fields but does not synthesize DNA. Success requires authoritative GET/readback; mismatch sets `syncRequired`, which does not roll back an already committed write. |
| Same file `persistSuggestions`, `analyze`, `applyProposal` | Website analysis may automatically persist eligible empty fields. Full cloned saved Core is submitted; manual proposals use the same persistence path. `filteredSuggestions` excludes DNA/Avatar keys. 409 verification rebases untouched draft fields and requires a new decision. No generic autosave of DNA was found. |
| Same file `acceptDna` | Merges accepted DNA draft over previous DNA, explicitly preserves previous Avatar and unknown keys, sets parent approval true, then calls `save`. No server write until save; failed save retains draft. |
| Same file `acceptAvatar` | Merges accepted Avatar draft over previous Avatar, preserves sibling DNA/unknown fields, sets Avatar approval true, then calls `save`. |
| `app.js` `submitCanonicalBrandEditing` | Advanced JSON editing submits the parsed object and draft revision to PUT. Can explicitly send nulls, empty leaves, arrays, false approvals or historical shapes. Exact response verification happens after persistence. No field-level loss confirmation is enforced server-side. |
| `app.js` `submitCanonicalBrandCoreInitialization` | Explicit Canvas/Board-to-canonical copy via PUT; browser eligibility requires **exactly empty `{}`** canonical Core, matching authoritative Board snapshot, context, catalog/editor capabilities and confirmation. Server PUT does not enforce an empty-Core-only initialization contract. Stale revision guards apply. Do not invoke for recovery. |
| `api/_brand-creation.js` `createWorkspaceBrand`; `api/brands/index.js` POST | Inserts a new UUID with default Core (`brandDNA:null`) and immutable creation fingerprint. Existing matching idempotent creation returns the row; no existing Core replacement. Identity/Workspace authority checked. |
| `api/_project-command.js` new-Brand branch | Inserts default Core for a new Brand during explicit Project creation; replay does not overwrite an existing Brand. Defaults alone do not prove a reset happened. |
| `api/_brand-deletion.js` `deleteOwnedBrand` | Explicit deletion removes the entire canonical row after ownership/name/use checks. Must consider missing-row incidents; not used here. |
| `api/brands/[id]/logo.js` | Updates separate `logo_*` columns/revision. Brand Logo is distinct from DNA Avatar; no `brand_core` assignment. |
| Workspace migrations, membership/learning routes | Workspace assignment changes `workspace_id`; Learnings maintain separate tables/events. No DNA/Avatar assignment found in these paths. Their event history is not a canonical Core revision archive. |

Repository searches for `brand_core` assignments, `UPDATE brands`, inserts and deletion were checked across API, migrations and scripts. Direct Core writes in `scripts/fixtures/` are disposable test infrastructure, not deployed handlers. Unknown external operator SQL, triggers in production, integrations or older deployments cannot be excluded from repository evidence alone.

### Revision and nested merge analysis

`mergeCore` starts with a shallow copy of saved keys and recurses only when **both** saved and incoming values are non-array objects. Omitted keys survive at all object depths. `{brandDNA:{}}` and `{brandDNA:{avatar:{}}}` preserve populated objects. Unknown nested object fields survive. Prototype-related keys are skipped.

Explicit null, string, number, boolean and array values replace the saved node. Arrays replace in full, including empty arrays. Examples: `brandDNA:null` removes all DNA and Avatar; `{brandDNA:{avatar:null}}` removes only Avatar; `{brandDNA:{avatar:{imageUrl:''}}}` clears the URL; `userApproved:false` hides accepted projections without deleting substantive data. This is intentional generic edit semantics, but not a sufficient preservation boundary for accepted knowledge. Empty nested objects alone are not a demonstrated cause of loss in current code.

The SQL compare-and-swap rejects an outdated revision with 409. A failed network response may follow a committed write; blindly retrying at the old revision should conflict. Revision counters are not revision history. A client that retains old content but adopts a current revision can submit stale explicit leaves and overwrite knowledge successfully. Guided reload's three-way `rebaseDraft` adopts untouched remote fields while preserving deliberate local differences; it cannot determine whether a local null is an intentional deletion or a stale default. Advanced conflict reload retains the old draft revision until a deliberate reconciliation. Do not remove 409 checks or silently rebase stale full documents.

The read/merge and UPDATE are separate operations. Protection depends on the submitted revision matching the snapshot being merged; investigate mismatched read/submitted revisions and access changes between authorization and UPDATE as a preventive review item. Fixture sequential CAS coverage does not prove all live transaction schedules are safe.

### Legacy Brand Brain and Canvas persistence

`app.js` `acceptBrandDna` assigns a newly normalized accepted DNA object and calls `saveBrandBrainState` and `saveBoardToServer('brand-dna-accept')`. `acceptBrandAvatar` calls `saveBoardToServer('brand-avatar-accept')`. `generateBrandAvatar` replaces Board-scoped Avatar with an unapproved generated result; DNA reacceptance can replace the Board DNA/Avatar object. `saveBrandBrainState` writes existing Board-scoped browser storage and marks Canvas dirty. `saveBoardToServer` sends `brand_core_snapshot` to `/api/boards/:id`, not canonical Brand PUT.

`api/boards/[id].js` ordinary Board PUT updates Board snapshot/Canvas. Explicit canonical-to-Board refresh keeps one Board backup, and restore swaps Board snapshots. Reassignment clears provenance/backup metadata but does not assign canonical Core. No automatic Board-to-canonical overwrite or legacy cache-to-canonical sync was found; the explicit initialization action above is the exception. A previously saved Board identity therefore need not ever have existed in PostgreSQL `brands.brand_core`.

### Read, selection and display boundaries

`api/_brands-storage.js` `serializeBrand` returns `row.brand_core` without DNA filtering. Logo projection failure is contained to Logo metadata. GET uses `_brand-access.js` independent owner/member authorization. Catalog summaries deliberately omit Core; their absence of DNA says nothing about the detail row. Navigation/session Brand, loaded Board association and regular Profile target must be recorded separately.

`canonical-brand-reader.js` is a volatile detail cache scoped to account, catalog/generation, Workspace, selected/requested Brand and revision. It uses canonical GET only, validates identity/access/revision, and rejects stale responses; no Board fallback or canonical write. #799 forces explicit conflict reloads to bypass prior pending/settled entries. Ordinary same-scope settled reads can remain cached until a freshness event; a non-refreshed detail can hide later changes without deleting them.

`brand-profile-setup.js` `acceptedAvatar` requires **both** parent DNA and Avatar `userApproved === true`, plus HTTPS or safe root-relative `imageUrl`. Overview and Home use this accepted projection. The dedicated Avatar section also displays saved unapproved Avatar metadata with a suitable URL; compare both views. Historical alternate key names, missing approvals or unsupported URL schemes can hide data. An image error displays an unavailable state; it does not delete metadata. `api/_image-storage.js` uploads generated images to blob storage and returns a URL; source inspection does not establish asset retention or reachability.

## Historical regression analysis

| Commit / PR | Verified change | Incident relevance |
| --- | --- | --- |
| `ef3194b` | Persist Brand DNA in Board snapshots | Historical developed DNA may be Board-only. |
| `bef2754` | Brand Avatar generation for DNA | Older Avatar lifecycle belongs to legacy Board state; inspect history in isolation. |
| `a4871d8` | Canonical server hardening | Historical PUT serialized incoming Core directly, replacing the full document. Partial/old clients could omit knowledge. |
| `68ac3d1` / #559 | Explicit canonical editing | Creates a user-facing full-JSON write path; inspect exact submitted payloads and deployed revision. |
| `a57452d` / #564 | Initialize empty canonical Core from Board | Controlled copy is separate from ordinary Brand Brain saves; never assume it happened automatically. |
| `9b1da34` | Guided Profile setup | Initial section list did not contain DNA or Avatar. Profile completeness does not prove historical canonical migration. |
| `a97322c` | Profile/workspace regression recovery | Introduced guided DNA/Avatar acceptance, preservation of prior Avatar during DNA acceptance and canonical saving. |
| `4da5a24` (9 Oct 2026) | Recursive `mergeCore` replaces direct incoming-document persistence | Mitigates omitted-field loss; explicit destructive values remain accepted. Code rollback cannot restore overwritten data. |
| #798, merge `3569ce8` | Shared canonical reader, saved Avatar on Home, deterministic speech | Read/display behavior may expose pre-existing canonical/Board divergence. No server Core persistence change in this PR. |
| #799, merge `faeb730c` | Conflict reload forces fresh detail and guards stale application | Addresses stale reads; no database recovery, no evidence that historical records were preserved. |

These are plausible introduction/mitigation points, not a timeline of production disappearance. Missing evidence: first known good timestamps/IDs, last known good canonical and Board revisions, actual deployment times, save payload presence/type summaries, approval transitions, conflict/retry events and asset lifecycle. Do not attribute original loss to the recent Home PR without that evidence.

## Safe SQL / API / UI verification plan

**Operator execution only; none of this SQL was executed against production.** Use an independently authorized, SELECT-only connection/role. Supply only Brand UUIDs independently mapped to the approved scope, including APPICS as control. Do not enumerate unrelated customers or print raw JSON, email, names, image URLs or credentials. Bind `$1` as `uuid[]`; never put IDs in public results.

First preserve current state through the approved infrastructure process. Run schema discovery before presence queries on a drifted database:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND (table_name IN ('brands','boards')
       OR table_name ILIKE '%brand%revision%'
       OR table_name ILIKE '%brand%audit%'
       OR table_name ILIKE '%event%')
ORDER BY table_name, ordinal_position;
ROLLBACK;
```

Presence check (bind the approved UUID array; each result uses only an ordinal token). A missing row must be represented explicitly rather than disappearing from the query result:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH requested AS (
  SELECT id, ord FROM unnest($1::uuid[]) WITH ORDINALITY AS x(id,ord)
), evidence AS (
  SELECT r.ord, b.id IS NOT NULL AS row_exists, b.revision,
         b.brand_core AS c
  FROM requested r LEFT JOIN public.brands b ON b.id=r.id
)
SELECT ord AS brand_token, row_exists, revision,
  COALESCE(jsonb_typeof(c)='object' AND c<>'{}'::jsonb,false) AS core_populated,
  COALESCE(jsonb_typeof(c->'brandDNA')='object',false) AS dna_object,
  COALESCE(EXISTS (
    SELECT 1 FROM jsonb_each_text(
      CASE WHEN jsonb_typeof(c->'brandDNA')='object'
           THEN c->'brandDNA' ELSE '{}'::jsonb END
    ) AS d(key,value)
    WHERE key IN ('primaryArchetype','secondaryArchetype','personality',
                  'positioning','reasoning','recommendedVoice','recommendedVisualDirection')
      AND length(btrim(value))>0
      AND lower(btrim(value)) NOT IN ('null','{}','[]','unknown','tbd','not provided')
  ),false) AS known_dna_fields_nonempty,
  COALESCE((c->'brandDNA') ? 'userApproved',false) AS dna_approval_key,
  COALESCE(c#>'{brandDNA,userApproved}'='true'::jsonb,false) AS dna_approved,
  COALESCE(jsonb_typeof(c#>'{brandDNA,avatar}')='object',false) AS avatar_metadata,
  COALESCE((c#>'{brandDNA,avatar}') ? 'userApproved',false) AS avatar_approval_key,
  COALESCE(c#>'{brandDNA,avatar,userApproved}'='true'::jsonb,false) AS avatar_approved,
  COALESCE(jsonb_typeof(c#>'{brandDNA,avatar,imageUrl}')='string'
    AND length(btrim(c#>>'{brandDNA,avatar,imageUrl}'))>0,false) AS avatar_url_stored,
  COALESCE(c ? 'brandAvatar' OR c ? 'brandDna',false) AS alternate_top_level_key
FROM evidence ORDER BY brand_token;
ROLLBACK;
```

The substantive-field predicate is a **candidate-presence check**, not semantic certification; placeholders or malformed types require private authorized inspection. A verified substantive assessment must confirm meaningful strategy in the historical schema without publishing content. Default Core can be nonempty with no DNA.

After confirming Board columns exist, inspect only associated Boards within the same approved Brand scope, returning aggregate evidence:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH requested AS (
  SELECT id,ord FROM unnest($1::uuid[]) WITH ORDINALITY AS x(id,ord)
)
SELECT r.ord AS brand_token, count(b.id) AS associated_boards,
  count(*) FILTER (WHERE jsonb_typeof(b.brand_core_snapshot->'brandDNA')='object') AS boards_with_dna,
  count(*) FILTER (WHERE length(btrim(b.brand_core_snapshot#>>'{brandDNA,avatar,imageUrl}'))>0) AS boards_with_avatar_url,
  count(*) FILTER (WHERE jsonb_typeof(b.brand_core_snapshot_backup->'brandDNA')='object') AS backups_with_dna,
  count(*) FILTER (WHERE length(btrim(b.brand_core_snapshot_backup#>>'{brandDNA,avatar,imageUrl}'))>0) AS backups_with_avatar_url,
  min(b.brand_core_source_revision) AS min_source_revision,
  max(b.brand_core_source_revision) AS max_source_revision,
  max(b.brand_core_snapshot_backup_created_at) AS latest_backup_at
FROM requested r LEFT JOIN public.boards b ON b.brand_id=r.id
GROUP BY r.ord ORDER BY r.ord;
ROLLBACK;
```

Association may have changed; zero associated matches does not exclude a historical unlinked/reassigned Board. Private authorized historical mapping is required before expanding scope. No Board snapshot is automatically selected as truth.

### Comparison protocol and classification

1. Record privately: account/session identity, Workspace UUID, selected Brand UUID, Profile target UUID, loaded Board UUID/association, observed time, deployed build and SQL revision. Publish ordinal status tokens only.
2. Use SQL above first. **Do not assume GET is operationally read-only:** Brand GET calls `ensureBrandsTable`, which includes CREATE/INDEX DDL and Board foreign-key reconciliation. This investigation did not call production GET. The operator must approve/establish a safe API comparison method under existing infrastructure policy before making requests; do not trigger lazy schema work as a forensic probe.
3. When safe API observation is established, inspect existing authorized traffic or perform only `GET /api/brands/<approved-id>` with existing authenticated access. Keep full body in approved private evidence storage or memory. Compare exact `brand_core` JSON equivalence and revision privately with the SQL snapshot; report booleans/status only. No PUT, analysis, generation, logo mutation or profile save. Separate captures may differ due to ongoing writes; align revisions and recapture safely.
4. Inspect Overview, DNA and Avatar sections on the matching Profile without editing/saving. Record presence/accepted/unapproved/loading/error and independently selected Brand/Board context. Existing UI mounting may request other endpoints; observe only under the same approved read boundary, rather than treating the entire application as read-only by assumption.
5. If a URL exists, an authorized operator may check its existing loaded response or retrieve it through approved asset access. Record only response status, content-type and whether image decode succeeded; keep URL, redirects and signed query values private. No third-party URL checkers. A 403/expired authorization is distinct from confirmed deletion; a 200 HTML error is not a valid image.

| Class | Required distinguishing evidence |
| --- | --- |
| A — PostgreSQL missing | Current authorized canonical row/field absent. **Loss** additionally needs a verified historical canonical baseline; current absence alone may mean never migrated. |
| B — API omission | Same ID and revision have fields in SQL but absent from API. Inspect serializer/deployed version/schema/proxy. |
| C — UI omission | Same fields returned by API, omitted by Profile. Inspect binding/cache/conditional rendering. |
| D — historical schema/approval | Data preserved under alternate schema or approval state; compare raw presence with accepted projection. |
| E — asset unavailable | URL remains, but approved asset check fails; distinguish permission/expiry/network from missing object. |
| F — identity/authorization mismatch | Wrong Profile/Brand/Workspace or request denied despite a different authorized Board. Do not bypass authorization. |
| G — unknown | No direct authorized evidence; current classification for all named Brands. |

## Disposable local reproductions

A dedicated harness executes real Profile controllers and Brand handlers using `scripts/fixtures/bw36-13r5-local-runtime.js`. All requests are intercepted; the harness rejects every path outside `/api/brands/`. No generation endpoint is called: accepted drafts are injected as synthetic local fixtures. It seeds substantive DNA, accepted Avatar and unknown-field sentinels. Every group checks preservation of unrelated knowledge; negative groups explicitly prove expected destructive behavior rather than asserting universal safety.

| # | Scenario | Result and scope |
| --- | --- | --- |
| 1 | Full DNA acceptance/save | Preserved Avatar, unknown DNA and unrelated sentinel |
| 2 | Accepted Avatar save | Preserved substantive DNA and unknown fields |
| 3 | Unrelated Profile update | Preserved full accepted knowledge |
| 4 | Partial nested Core | Added nested field; preserved Avatar and sentinel |
| 5 | Legacy client | Omitted DNA preserved today; explicit `brandDNA:null` accepted and erases it |
| 6 | Concurrent stale revision | Sequential stale-CAS fixture returns 409; preserved knowledge; real PostgreSQL scheduling not tested |
| 7 | Brand switch | Changed context prevents a new save; no PUT; pending server commit cannot be undone by UI cancellation |
| 8 | Workspace switch | Same boundary and preservation result; in-flight browser switching not fully verified here |
| 9 | Canonical cache refresh | Forced GET refresh leaves database fixture unchanged |
| 10 | Missing acceptance | False parent approval hides accepted projection; substantive DNA/Avatar URL remain |
| 11 | Empty nested object | Both empty DNA/Avatar objects preserve populated saved objects |
| 12 | Repeated stale data | Repeated old revisions return 409; same stale Avatar null with current revision succeeds destructively |
| 13 | Failed save/retry | Injected database failure leaves knowledge; successful retry preserves it |
| 14 | Owner/editor/viewer | Owner/editor updates allowed, viewer denied; seeded knowledge preserved |
| 15 | Reload after 409 | Guided reload adopts untouched remote DNA field, retains local name, then saves without losing Avatar |

**15/15 fixture groups completed**, including two expected-vulnerability groups. This is not a claim of 15 passing production-integrity invariants. Important missing scenarios: real DB overlapping transactions, fully in-flight browser Brand/Workspace switches, actual save-response loss after commit, runtime deployment fidelity and production asset access.

Existing checks executed unchanged:

- `node scripts/check-canonical-brand-foundation.js`: PASS, mocked/contract coverage.
- `node scripts/check-bw36-13r4-guided-brand-profile-setup.js`: PASS, provider-free controller/DOM coverage.
- `node scripts/check-bw36-22b2r1-canonical-conflict-reload.js`: first seven non-browser groups PASS; full command **FAILED** at Chromium launch (`setsockopt: Operation not permitted`, SIGTRAP). The two browser groups did not run. Do not count the full suite as passing.

No existing test was weakened, replaced or modified for the investigation. Latest-main test-file reconstruction was verified separately where material. No full Runtime Boot Safety pass is claimed for this documentation-only PR. SQL validation against a disposable PGlite engine was attempted but could not run because `@electric-sql/pglite` is unavailable in this environment. The SQL is supplied for operator schema review and execution, not claimed as executed or engine-validated.

## Preservation, backups and recovery readiness

| Candidate source | Source evidence | Production availability / limits |
| --- | --- | --- |
| PostgreSQL backup / PITR / WAL | No runtime-accessible backup credentials/control plane available | **Unknown** provider, retention, oldest/latest recovery time, continuity and last restore verification. Operator must inspect approved provider dashboard; do not assume PITR exists. |
| Current canonical row | `brands.brand_core`, numeric revision, timestamps | Only current value; no canonical Core revision archive found in checked application schema. Revision increment cannot reconstruct prior content. |
| Board snapshot | `boards.brand_core_snapshot`, source revision/timestamps | May preserve historical DNA/Avatar, including Board-only identities. Existence/content must be checked privately. May be edited or diverged. |
| Board one-step backup | `brand_core_snapshot_backup`, backup provenance/timestamp | One prior Board snapshot, not a chronological canonical archive. Reassignment can clear backup metadata; later refresh can supersede it. |
| Governed Learning events | `brand_learning_events` and separate learning snapshots | Useful provenance for learning decisions, not a full Core/Avatar backup. |
| Application logs / audit / old exports | Must inspect actual configured retention privately | Unknown completeness and access. Existing code logs some legacy Core state; do not copy logs publicly. Preserve restricted copies and sanitize summaries. |
| Existing Board browser drafts/cache | `brandBrainStorageKey`, `saveBrandBrainState`, Board-scoped cache | Possible last remaining local copy; do not clear, resave or promote. Access only with owner authorization and private evidence handling. |
| Historical application/Git backup | Source history is available | Can explain schema and restore code behavior; does not contain a production data backup. Historical infrastructure/export archives unknown. |
| Blob assets | `_image-storage.js` returns stored URL | Canonical/Board metadata may survive even when object access fails. Storage object versions/backups/retention unknown. |

Before any future repair: authorized operator preserves a timestamped current-state snapshot, obtains an immutable historical baseline in an **isolated recovery environment**, verifies identity/ownership and historical revisions, and compares candidate fields privately. Preserve current unrelated edits and all unknown nested fields. Never restore an entire old database over production as a shortcut; do not promote a Board snapshot wholesale. A historical accepted Avatar must include verified original asset availability and approvals; do not regenerate it or toggle approvals to make it appear.

Safe recovery options, conditional on evidence:

1. If canonical data exists and UI hides it: separately authorize a narrowly reviewed reader/schema/approval-display correction; preserve saved metadata, without changing approvals.
2. If data was always Board-only: verify the historical Board baseline and independent Brand authorization, then propose a field-specific, explicitly reviewed migration plan. No copy is authorized yet.
3. If canonical overwrite is proven and backup/PITR exists: restore backup to an isolated environment, recover only verified missing fields, prepare before/after presence/revision checks and a rollback plan, then obtain explicit production repair approval.
4. If only Board backup/export/local evidence remains: validate provenance and conflicts against the current row, retain private copies and prepare a per-Brand, field-level recovery proposal. Do not assume the oldest or latest snapshot is authoritative.
5. If only asset access is broken: investigate object retention/permission at the existing storage boundary, separately from Core repair.

## Minimum preventive correction — proposal only

A separate reviewed change should introduce explicit field-scoped update intent and server-side protection for previously accepted DNA/Avatar. Unrelated edits must not clear them through nulls, blank leaves, malformed nested types, default arrays or stale whole-document values. Legitimate removal/replacement needs an explicit reviewed contract; silently ignoring every null would also change legitimate edit semantics. Retain atomic revision enforcement, compare the merged source revision to the submitted revision, and do not auto-retry stale full documents at a new revision.

Keep generation drafts separate from accepted canonical knowledge; retain guided acceptance preservation and verified readback. Add private preimage/revision audit or an approved recovery source before destructive identity edits; record actor/intent/status without public payload logging. Review lazy schema work on GET to enable genuinely read-only incident collection. Add permanent regression assertions for the negative cases reproduced here plus real database overlapping transactions and in-flight navigation races. These changes are **not implemented or deployed** by this report.

## Secondary incident: Brand / Board Avatar speech mismatch

Verified in `home-foundation.js` `contextualMessages`: selected-Brand Learning messages can be followed by a loaded Board finding/responsibility and a saved continuation. Eligibility checks that a Board is available in the Workspace, but does not require its associated Brand to equal the independently authorized selected Brand. Even naming the foreign Board does not meet the requested selected-Brand personality contract. Brain remains Board-scoped; presenting it as selected-Brand conversation is misleading when they differ.

Approved future behavior: Avatar and initial speech belong to selected Brand; use Brand-only facts by default. Board-specific speech requires a currently loaded, independently authorized Board associated with that same selected Brand. On mismatch suppress foreign-Board speech, preserve the loaded Board and association, and offer a matching authorized Board route. Do not reassign a Board, present foreign Brain context as selected-Brand conversation, or generate facts. This is secondary to preservation; no fix is included here.

## Prioritized next steps and exact next authorization

1. **Now:** communicate a temporary pause on affected Profile/advanced saves and initialization to authorized editors; operator preserves current database state and existing backups/WAL/drafts through approved infrastructure. No automatic runtime freeze or changes were made.
2. **Next authorization required:** designate an authorized operator and approve scoped read-only production evidence collection for the four named Brands plus explicitly approved controls, with private UUID/account/Workspace mapping and access-controlled evidence storage. Approve the existing infrastructure snapshot-preservation process separately, and establish a safe API observation route that cannot invoke lazy DDL. This report does not request blanket DB credentials or write access.
3. Operator runs the supplied SELECT-only checks and compares aligned SQL/API/UI/asset status. Determine A–G per Brand; establish first/last known good historical canonical records, deployment version and save chronology. Escalate confirmed destructive production writes immediately and approve containment before proceeding.
4. Verify backup/PITR retention and perform any historical restore **only into a separately approved isolated environment**. Establish a per-Brand historical baseline and provenance. No production restoration authorization is implied.
5. Present a concrete, field-level recovery proposal and minimum preventive patch for separate review. Production recovery requires explicit approval naming Brand IDs, source baseline, exact fields, expected current revisions, conflict handling, preserved current snapshot, rollback and post-repair checks. Approval for investigation or this documentation PR is not approval for recovery.
6. Review the separate Brand/Board speech correction after integrity evidence is preserved.

Remaining unknowns: actual canonical loss versus never-canonical Board knowledge; affected IDs and current revisions; historical accepted metadata/approval shapes; production write payloads and deployment chronology; authorization/selection mismatches; asset health; backup/PITR retention; external writers/triggers; in-flight transaction schedules. **Local passes do not resolve this incident.**

## Reproduction harness (local only)

Run from any working directory against a disposable checkout of pinned main. Save the following as a temporary file outside tracked application paths; adjust the two absolute checkout paths if necessary. It never connects to production and its transport rejects generation calls. The fixture's database and external services are in memory. Do not replace its transport or sentinel configuration with real credentials.

```javascript
'use strict';
const assert=require('node:assert/strict');
const {runtime,B,W,clone,EMAIL}=require('/workspace/Funklix/scripts/fixtures/bw36-13r5-local-runtime');
const profile=require('/workspace/Funklix/brand-profile-setup');
const dna={primaryArchetype:'Sage',secondaryArchetype:'Creator',personality:'Synthetic substantive strategy',userApproved:true,unknown:{keep:'dna'}};
const avatar={imageUrl:'/synthetic-avatar.svg',prompt:'Synthetic accepted identity',userApproved:true,unknown:'keep'};
let total=0; async function check(label,fn){await fn();console.log('PASS '+label);total++;}
function fixture(){const r=runtime();r.db.brands[0].brand_core.brandDNA=clone({...dna,avatar});r.db.brands[0].brand_core.sentinel={keep:'unrelated'};const account={};const ctx={account,generation:1,brandId:B,workspaceId:W,authorized:true};
const fetchImpl=async(url,init={})=>{assert(url.startsWith('/api/brands/'),'No generation/network allowed');const x=await r.request(init.method||'GET',url,init.body?JSON.parse(init.body):undefined);return{ok:x.statusCode<300,status:x.statusCode,json:async()=>x.body};};
const session=()=>profile.createSession({brand:clone(r.db.brands[0]),getContext:()=>ctx,fetchImpl,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision)&&!!b.brand_core,onSave(){},onLogo(){}});
// Sessions require canonical access projection.
const s=async()=>{const b=(await r.request('GET','/api/brands/'+B)).body;return profile.createSession({brand:b,getContext:()=>ctx,fetchImpl,validateBrand:(b,id)=>b?.id===id&&Number.isSafeInteger(b.revision)&&!!b.brand_core,onSave(){},onLogo(){}})};
const put=(patch,revision=r.db.brands[0].revision,user)=>r.request('PUT','/api/brands/'+B,{name:'Local Brand',brand_core:patch,revision},user);
const intact=()=>{assert.deepEqual(r.db.brands[0].brand_core.brandDNA,{...dna,avatar});assert.deepEqual(r.db.brands[0].brand_core.sentinel,{keep:'unrelated'});};return{r,ctx,s,put,intact};}
(async()=>{
await check('1 full DNA acceptance preserves Avatar and unknown knowledge',async()=>{const f=fixture(),s=await f.s();s.state.dnaDraft={...dna};assert(await s.acceptDna());f.intact();});
await check('2 Avatar acceptance preserves DNA and unknown knowledge',async()=>{const f=fixture(),s=await f.s();s.state.avatarDraft={...avatar};assert(await s.acceptAvatar());f.intact();});
await check('3 unrelated Profile save preserves full DNA/Avatar',async()=>{const f=fixture(),s=await f.s();s.state.name='Unrelated rename';assert(await s.save());f.intact();});
await check('4 partial nested Core preserves full knowledge',async()=>{const f=fixture();assert.equal((await f.put({brandDNA:{unknown:{added:'value'}}})).statusCode,200);assert.equal(f.r.db.brands[0].brand_core.brandDNA.avatar.imageUrl,avatar.imageUrl);assert.equal(f.r.db.brands[0].brand_core.sentinel.keep,'unrelated');});
await check('5 legacy omission preserved; explicit null destructively accepted (expected vulnerability)',async()=>{const f=fixture();assert.equal((await f.put({brandCore:'Legacy'})).statusCode,200);f.intact();assert.equal((await f.put({brandDNA:null})).statusCode,200);assert.equal(f.r.db.brands[0].brand_core.brandDNA,null);assert.equal(f.r.db.brands[0].brand_core.sentinel.keep,'unrelated');});
await check('6 stale revision rejected with canonical knowledge intact',async()=>{const f=fixture();await f.put({brandCore:'Other editor'});assert.equal((await f.put({brandDNA:null},1)).statusCode,409);f.intact();});
for(const [n,key,value]of [[7,'brandId','foreign'],[8,'workspaceId','foreign']])await check(n+' changed scope blocks new save',async()=>{const f=fixture(),s=await f.s();f.ctx[key]=value;assert.equal(await s.save(),false);f.intact();assert.equal(f.r.requests.filter(x=>x.method==='PUT').length,0);});
await check('9 force detail cache refresh does not mutate knowledge',async()=>{const f=fixture();const {create}=require('/workspace/Funklix/canonical-brand-reader');const reader=create({context:()=>({brandId:B,revision:1}),validate:b=>b.id===B,fetchImpl:async()=>({ok:true,json:async()=>(await f.r.request('GET','/api/brands/'+B)).body})});await reader.read(B);await reader.read(B,{force:true});f.intact();});
await check('10 missing approvals hides accepted projection without deleting data',async()=>{const f=fixture();await f.put({brandDNA:{userApproved:false}});assert.equal(profile.acceptedAvatar(f.r.db.brands[0]),null);assert.equal(f.r.db.brands[0].brand_core.brandDNA.avatar.imageUrl,avatar.imageUrl);assert.equal(f.r.db.brands[0].brand_core.brandDNA.personality,dna.personality);});
await check('11 empty nested objects preserve knowledge',async()=>{const f=fixture();await f.put({brandDNA:{avatar:{},unknown:{}}});f.intact();});
await check('12 repeated stale save rejected; rebased stale null accepted (expected vulnerability)',async()=>{const f=fixture();await f.put({brandCore:'New'});for(let i=0;i<2;i++)assert.equal((await f.put({brandDNA:{avatar:null}},1)).statusCode,409);f.intact();assert.equal((await f.put({brandDNA:{avatar:null}})).statusCode,200);assert.equal(f.r.db.brands[0].brand_core.brandDNA.avatar,null);assert.equal(f.r.db.brands[0].brand_core.brandDNA.personality,dna.personality);});
await check('13 failed save/retry preserves canonical knowledge',async()=>{const f=fixture(),s=await f.s();s.state.name='Retry';f.r.db.failPut=true;assert.equal(await s.save(),false);f.intact();f.r.db.failPut=false;assert(await s.save());f.intact();});
await check('14 owner/editor allowed; viewer denied; knowledge preserved',async()=>{const f=fixture();assert.equal((await f.put({brandCore:'owner'})).statusCode,200);for(const role of ['editor','viewer']){f.r.db.brandRole=role;const x=await f.put({brandCore:role},undefined,{email:'member@example.test'});assert.equal(x.statusCode,role==='editor'?200:403);f.intact();}});
await check('15 Profile reload after 409 adopts untouched remote DNA and preserves local rename',async()=>{const f=fixture(),s=await f.s();s.state.name='Local rename';await f.put({brandDNA:{remote:'retained'}});assert.equal(await s.save(),false);assert(await s.reload());assert.equal(s.state.core.brandDNA.remote,'retained');assert(await s.save());assert.equal(f.r.db.brands[0].brand_core.brandDNA.remote,'retained');assert.equal(f.r.db.brands[0].brand_core.brandDNA.avatar.imageUrl,avatar.imageUrl);});
console.log(total+' fixture groups completed; destructive behavior reproduced locally, no production evidence.');
})().catch(e=>{console.error(e);process.exitCode=1});
```

P0 CANONICAL BRAND KNOWLEDGE INTEGRITY INVESTIGATION READY FOR REVIEW
