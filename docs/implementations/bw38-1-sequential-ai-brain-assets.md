# BW-38.1 — Sequential AI Brain assets

Base: `4113447801b4a123c746c99e7b4d0a1aa48b399b` (main including #834).
Implementation follows Section J of the complete BW-38 product UX audit.
No merge, deployment, migrations, paid inference or production application writes.

## Reproduction and behavior

Before application edits, a provider-free Chromium run on the exact base exercised
production shell/controllers and native insertion with fictional data. One answer
had two candidates and zero nodes. After explicitly creating Instagram and returning
to Brain: one node, two extractable candidates, proposal `applied`, zero Add actions,
and `aiBrainContentSourceCurrent` false. The failure was turn-wide consumption plus
whole-Canvas/selection freshness; parsing was already correct.

Now the same answer supports Instagram → review/edit/explicit Create → native
Inspector → return to Brain → Add to Canvas → X → review/edit/explicit Create →
Save → Reload. Each confirmation inserts exactly one native Draft. Source cards
show completed items as disabled; the conversation reports destinations, remaining
assets and local versus confirmed saved completion. All-consumed answers have no
Add action. Original question/answer and exact start/end/text references stay bound
to the original successful source, separately from shortened display copy.

Completion records live only on the existing ephemeral conversation turn. Undo
never unconsumes a source or authorizes recreation. Pre-insertion failure retains
retry; partial insertion consumes the item and fails continuation closed. Reload
retains native saved nodes, but clears conversation/progress with the existing owner.

## Narrow continuation and independent authorization

The original source is never rebound. A separate continuation stores only the
known post-insertion context, expected saved revision and full persistence snapshot.
It is established synchronously only after exactly one native insertion/selection,
unchanged preexisting nodes/edges, same account and unchanged Board/load/Workspace/
catalog/association metadata. The ordinary Board-to-Brain navigation clears selection
through `resetAdaptiveCanvasView`; this exact transition is checked before and after
that owner executes. An arbitrary selection change is not a continuation grant.

The full persisted snapshot includes native fields, edges, counters, zoom, activity
and Brand snapshot. Only save-owned `metadata.updatedAt` is excluded from snapshot
comparison. A successful existing Board save advances the expected revision only
when the dispatched payload and current snapshot both match, the previous revision
matches, and source/account/scope still validate. A conflict invalidates continuation;
failure does not claim save success. Lost acknowledgements cannot be guessed:
subsequent authoritative scope reads reject an unknown committed revision. Concurrent
unrelated edits remain dirty and cannot use that save as a continuation transition.

The proposal scope owner adds a SHA-256 comparison of the independently authorized
SQL scope with **only Board updated_at excluded**. It includes identity ID/revision,
signed actor, Board ownership/access, Workspace revision/membership and association.
It is a freshness checksum, not a credential. Every subsequent Prepare independently
captures, compares and revalidates that scope before any Content provider request.
Revocation or identity replacement cannot become a fresh source after an own save.
The existing full scope checksum and expected revision remain required at Create.

If an own confirmed save occurs while a preview is ready, its edits remain. The
Create scope route validates the exact previously prepared full checksum by replacing
only the acknowledged timestamp, compares the authorization checksum, independently
checks the current expected revision and revalidates SQL scope again. It returns the
current full checksum. Arbitrary remote revisions cannot pass the client continuation
or the unchanged expected-revision check. A save racing a Create preflight requires
another explicit Create after the save rather than inserting on the old preflight.

Board persistence and Brand access contracts are unchanged. No canonical data is
retrieved by the proposal scope. No new node types, parents, edges, images, schedules,
approvals, assignments, transcript storage or action framework. Existing Content and
Social editors/mappings, history, Inspector, autosave, Campaign and Profile owners
remain in place. Social stays deterministic with zero model calls; Content retains
one disclosed provider call per explicit Prepare. Selection, continuation, editing,
cancel and Create do not invoke inference.

## Validation and review

`check:bw38.1` runs signed production proposal/scope handlers over disposable,
projection-aware SQL transport plus the actual browser shell/controllers/native
owners. It checks the uninterrupted edited Instagram/X pair, exact source isolation,
two history/activity events, save/reload, confirmed autosave/manual save, pending and
failed save, conflicts, prepared-preview retention, undo, double clicks, failed and
partial insertion, same-email replacement account, source changes, Board/load/
Workspace/catalog/association/revision changes, unrelated edits, server identity
replacement/revision, revoked membership and changes during authorization awaits.
EN/DE, Light/Dark, 320/375/desktop, modal bounds, keyboard/Escape/focus and composer
return are included. SQL fixtures use real signed sessions and ACL/scope controllers;
they do not substitute `canEdit:true` for server authorization.

Existing focused BW-37 Social/reliability/Content/security/Campaign/Profile/Advisor/
workspace, BW-26 conversation, BW-28 script integrity/Insights, BW-36 Board/Brand
context and protected-knowledge suites are run unchanged. Runtime Boot Safety adds
the new suite and syntax checks to both existing PostgreSQL 17.6/18.4 jobs. Actual
final CI results and commit IDs are reported in the PR, not inferred from local tests.

Codex implementation review addressed native Board-exit selection reset, preserving
prepared fields across own autosave without inference, server identity continuity
across timestamp changes, concurrent unrelated edits during save, and insertion
failure consumption. Automated Codex PR review found one P2: a pending autosave during Create preflight discarded an unchanged edited preview. The busy-save path now retains that preview and requires another explicit Create after saving; a held-request regression covers the overlap.

## Changed files

- `app.js`
- `api/_ai-brain-proposal-scope.js`
- `api/ai-brain/propose-node.js`
- `api/ai-brain/content-scope.js`
- `scripts/check-bw38-1-sequential-assets.js`
- `scripts/check-bw38-1-sequential-scope.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `docs/implementations/bw38-1-sequential-ai-brain-assets.md`

## Limits

Unrelated Canvas/Brand/selection edits invalidate the original answer's continuation,
including editing the created node later in Inspector. Undo/recreate is deliberately
outside this package. Partial renderer outcomes fail continuation closed. Source
eligibility remains bounded and deterministic. Conversation and provenance remain
ephemeral. Consequential-boundary revalidation cannot retract already-dispatched
requests or make browser and server operations atomic; existing Board save conflict
protection remains authoritative. Browser fixtures do not certify live provider
quality, production activation, every device or manual assistive-technology behavior.
