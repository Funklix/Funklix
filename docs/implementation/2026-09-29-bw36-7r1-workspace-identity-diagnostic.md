# BW-36.7R1 — Workspace identity diagnostic

**Status:** source and regression ready for one manual, read-only production diagnostic after merge and deployment. This work neither repairs identity data nor authorizes a Workspace backfill.

## Why this diagnostic is necessary

The manually executed production BW-36.7 preflight returned this verified evidence:

- All BW-36.6 schema checks passed.
- Existing Workspaces: **0**.
- Existing Workspace memberships: **0**.
- Brands already carrying `workspace_id`: **0**.
- Boards already carrying `workspace_id`: **0**.
- Total reusable Brands: **6**.
- Brands with stored primary owner: **6**.
- Brands without stored primary owner: **0**.
- Brand owner identity anomalies: **6**.
- Distinct normalized Brand owners: **2**.
- Brands with accepted members: **1**.
- Invalid Brand member identities: **1**.
- Total Boards: **20**.
- Boards with stored current owner: **20**.
- Ownerless Boards: **0**.
- Board owner identity anomalies: **20**.
- Boards associated with reusable Brands: **6**.
- Unbranded Boards: **14**.
- Snapshot-only Boards: **14**.
- Missing Brand associations: **0**.
- Board/Brand owner mismatches: **0**.
- Board editor relationships: **11**.
- Board share relationships: **11**.
- Boards with collaborators: **8**.
- Board-only collaborators: **10**.
- Active public-token Boards: **1**.
- Cross-owner Board shares requiring preservation: **11**.
- Records preventing automatic backfill: **38**.
- Brands safe for automatic assignment: **0**.
- Boards safe for automatic assignment: **0**.
- Brands requiring quarantine: **6**.
- Boards requiring quarantine: **20**.
- Final readiness: **blocked**, count **38**.

Every Brand owner and Board owner failed BW-36.7 identity resolution even though every record had stored owner authority and the authenticated application remained functional. A universal failure aligned to object type is more consistent with a systematic authority/join mismatch than with independently missing owners. That is a **hypothesis, not a conclusion**: only the aggregate production diagnostic can distinguish join mismatch, schema/access mismatch, mixed data, and actual unresolved authority. No existing record is presumed corrupt.

## Repository-proven identity model

The repository does not use Supabase Auth for application login and contains no durable application `users`, `accounts`, or `profiles` table. Google OAuth obtains a profile and puts `{name, email, avatar}` into an HMAC-signed `funklix_session` cookie. Authorization reads that signed session. The persistent canonical application identifier is therefore an email string copied into domain relations, compared after trim/lower normalization; the live session itself is the runtime authentication authority. SQL cannot enumerate or translate signed application sessions into the UUID required by `workspace_memberships.user_id`.

| Relationship | Stored identifier and database type | Canonical comparison | Source authority | Existing role | Workspace implication | Aggregate-only? |
|---|---|---|---|---|---|---|
| Brand owner | `brands.owner_email`, non-null `text` | lower-case persisted email; runtime normalizes session email with `trim().toLowerCase()` | signed Google application session email | singular Brand owner | candidate Workspace owner, but UUID mapping must first be proven | yes |
| Brand member | `brand_members.email`, non-null `text`; role `admin`, `editor`, or `viewer` | normalized session email equals stored lower-case email | signed Google application session email plus the stored Brand grant | existing Brand role | only minimal Workspace visibility needed to keep Brand discoverable; never creates a stronger Brand role | yes |
| Board owner | `boards.owner_email`, nullable `text`, and legacy `boards.owner_id`, nullable `text` | normalized email match **or**, if a session supplies `id`/`sub`, exact `owner_id` match | current writes put normalized email in both fields; runtime retains the legacy session-id/subject branch | singular Board owner | preserve Board authority; Workspace owner mapping is not inferred | yes |
| Board editor/share | `board_editors.email`, non-null `text`; role `editor` or `viewer` | normalized session email equals stored lower-case email | signed Google application session email plus stored Board grant | Board-scoped editor/viewer | remains Board-only unless a separate Brand grant already exists | yes |
| Associated Brand access to Board | Brand owner/member email via `boards.brand_id` | same Brand email comparisons | stored Brand authority | `brand_owner`, `brand_admin`, `brand_editor`, or `brand_viewer` | follows the independent Brand relationship; does not arise from the Board share | yes |
| Anonymous public Board access | `boards.public_view_enabled` plus a hashed token not read by this diagnostic | separate public-token verification path | public sharing helper | `public_viewer` | never creates Workspace membership, Brand access, or catalog visibility | boolean count only |
| Workspace membership foundation | `workspace_memberships.user_id`, non-null UUID | `auth.uid()` in BW-36.6 RLS | Supabase Auth UUID required by the new schema | owner/admin/member/viewer | future target only; no mapping is proven by this phase | yes |

`auth.users` is consequently an authority assumed by BW-36.7 and required by BW-36.6's future UUID/RLS model, but it is not the repository-proven authority that currently authenticates Brands and Boards. There is no repository-proven profile/account fallback and the diagnostic invents none. Display names, avatars, provider subjects, metadata, and content are explicitly excluded from resolution.

## Old BW-36.7 assumptions and diagnostic paths

BW-36.7 grouped `auth.users` by normalized email, resolved Brand owners, Brand members, and Board shares through that table, and treated `boards.owner_id` as an `auth.users.id` string when owner email was absent. It then added Brand quarantine, Board quarantine, invalid Brand-member rows, and invalid Board-share rows. This assumes that the application-created email authorities are enrolled in the same Supabase Auth tenant and that legacy `owner_id` is a Supabase UUID. Repository history proves neither assumption; current Board creation writes normalized email into both `owner_email` and `owner_id`.

The R1 diagnostic separately counts:

1. exact lower-trimmed canonical email shapes;
2. case/whitespace-only normalized matches;
3. the legacy UUID path only where repository runtime permits it;
4. repository-supported application-session email shapes;
5. comparison matches against the BW-36.7-assumed `auth.users` relation;
6. ambiguous matches within candidate authorities;
7. empty, malformed, or unsupported values that are genuinely unresolved by repository rules;
8. identities resolving through competing candidate paths; and
9. repository-supported emails absent from `auth.users`.

It checks relation/column types, nullability, relevant uniqueness, assumed-auth catalog parity, and SQL Editor privileges. Because static SQL cannot safely catch a missing/inaccessible `auth.users` reference without forbidden dynamic SQL, failure to access that relation is a **manual stop condition**: capture the error, make no changes, and classify the run as schema/access parity blocked. The catalog/access rows provide bounded confirmation when access exists.

## Privacy boundaries

The file is exactly one `WITH ... SELECT` statement. It performs catalog reads, equality tests, existence checks, grouping, and counts only. It contains no mutation, DDL, privilege change, procedure, dynamic execution, transaction control, temporary object, remote link, migration, application invocation, or token generation.

The final result has exactly `category`, `check_name`, `status`, `record_count`, and `notes`, with deterministic ordering and statuses limited to `ok`, `info`, `review`, and `blocked`. Labels and notes are static. No raw UUID, email, name, provider subject, access/public token, token hash, authorization metadata, Brand/Board name, content, snapshot, caption, prompt, JSON, profile field, metadata, or reversible identifier encoding is returned. Identifiers are used internally only to aggregate and deduplicate typed records. The query reads only `public_view_enabled`; it never reads public-token values or hashes.

## Board-only and public-token isolation

A `board_editors` row is valid Board authorization in its own right. The diagnostic reports whether its normalized identity separately has associated-Brand authority, but a Board-only grant is informational and must remain Board-only. It does not become a Workspace member, reusable Brand grant, or catalog grant. Similarly, public viewing remains anonymous, Board-scoped access. The single production public-token Board is counted from boolean state only and cannot expand into authenticated access.

## Blocker reconstruction

R1 reproduces each old component: Brand owner, Board owner/quarantine, Brand member, and Board editor/share. It separately reports missing Brand associations, ambiguous matches, genuinely ownerless objects, and application-supported relationships included only because of the old `auth.users` assumption.

`raw_blocker_component_sum` is labeled as arithmetic only. `typed_unique_old_blocking_records` deduplicates within an explicit `(relationship type, record key)` domain. `overlapping_component_records` shows duplicate component coverage. `unique_blocking_records` is rebuilt from genuinely empty/unsupported/ambiguous authority and missing-parent/association evidence. Unlike Brand rows, Board rows, member grants, and share grants are not collapsed into a misleading global “record” identity. This exposes whether the reported 38 was a sum of non-disjoint or review-only components rather than silently relabeling it.

## Derived conclusions

Exactly one or more bounded evidence flags may describe the run; interpret their `record_count` as 0/1:

- `identity_model_confirmed`: supported identities also resolve in the assumed authority and no malformed/ambiguous evidence exists. Diagnostic readiness may be `ok`, but this permits only preparation of a later corrected preflight.
- `preflight_join_defect`: well-shaped repository-supported session emails systematically miss the separately assumed `auth.users` join. Readiness is `review`, because a safe email-to-Workspace-UUID bridge is still not proven.
- `production_identity_anomalies`: empty, unsupported, or ambiguous authority exists. This is evidence requiring review, not a corruption label; readiness is `blocked`.
- `mixed_identity_state`: both a join defect pattern and genuine anomalies exist. Readiness is at least `review` and may be `blocked`.
- `schema_parity_blocked`: expected assumed-auth columns or access are unavailable. Stop; readiness is `blocked`.

`diagnostic_readiness` means only: `ok`—identity authority and a safe corrected-preflight approach are proven; `review`—understandable mixed evidence needs an explicit migration design decision; `blocked`—schema/access ambiguity or genuinely unresolved authority prevents correction. It never means backfill readiness.

## Exact deployment and manual execution procedure

1. Merge and deploy BW-36.7R1.
2. Open the correct authenticated Supabase project.
3. Open `scripts/sql/bw36-7r1-workspace-identity-diagnostic.sql` from the merged repository.
4. Copy the complete raw file without modification.
5. Paste it into a new Supabase SQL Editor query.
6. Verify it is read-only and ends with the bounded final projection and deterministic ordering.
7. Execute it exactly once.
8. Copy or screenshot the complete output.
9. Do not alter any Brand, Board, membership, share, authentication, or Workspace record.
10. Do not rerun BW-36.7 with modifications.
11. Do not proceed to BW-36.8.
12. Review the diagnostic output first and prepare a separate evidence-based correction.

If execution reports missing/inaccessible `auth.users`, an unexpected relation or column, an incomplete result, a changed projection, or any other SQL error, preserve only privacy-safe error context and stop. Do not add dynamic SQL or weaken the query.

## Evidence required for later phases

Before correcting BW-36.7, reviewers require the complete output, confirmation of schema/access checks, all four relationship shape/resolution groups, typed blocker reconciliation (including the old 38), and a documented conclusion. A correction must identify a repository- and production-proven mapping from current signed-session email authority to the UUID required by BW-36.6 without broadening access.

Before BW-36.8 can begin, a separately reviewed corrected preflight must run successfully; ownership mappings must be unambiguous; genuinely unresolved records must have an explicit quarantine decision; Brand and Board grants must be preserved without expanding Board-only/public access; and the proposed migration must have independent transactional, idempotency, RLS, and aggregate-preservation review. R1 alone cannot satisfy these gates.

## Rollback

No database rollback exists because nothing is deployed to or executed by a migration path and the diagnostic writes nothing. To roll back repository delivery, revert the single BW-36.7R1 commit, which removes the SQL, regression, documentation, package script, and workflow step. If the manual query is open, close or delete the editor draft; do not execute compensating SQL. Captured aggregate evidence may be removed from its restricted review record according to the normal retention process.

## Remaining limitations

Repository inspection cannot prove live production rows, SQL Editor privileges, Supabase tenant enrollment, a safe UUID mapping, or the diagnostic conclusion. The static statement cannot tolerate absent required relations without unsafe dynamic SQL. Email shape validation is intentionally bounded and is not proof that a mailbox or person exists. Aggregate results can conceal row-to-row swaps and cannot authorize record repair. No live Supabase call, production credential, database mutation, provider request, AI request, application runtime change, UI change, migration, backfill, or visual verification is part of this phase.
