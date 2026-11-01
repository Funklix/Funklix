# BW-40 — Simple Canvas node references

## Identity and model context

Base: latest merged main, `f6eb386dac131ee0e147c1ab37668c5dc0f21d56` (BW-39.2).

Canvas persists nodes in `boards.canvas_json.nodes`. `node.id` is the stable string identity used by edges, `getNode`, DOM `data-id`, selection and Inspector. `createNode` currently allocates `node-${state.nodeCounter++}`; imported/saved nodes may use other strings, including UUIDs. The counter and array position are not an alternate persisted identity. Titles can repeat. The supported node projection has no independent visible-number field. Canvas shows node type/title, while AI Brain already receives the allowlisted working node projection including exact IDs and titles. The existing BW-39 mapping is specific to structured Social CTA findings and is retained unchanged.

Ordinary Advice now supplies `workingCanvas.nodeReferences`, a small application-generated mapping of exact `Node #N` labels to persisted IDs. N is the one-based position in that request's working node projection, never an ID suffix. Only exact ID/type matches in the independently authorized saved Canvas receive labels. Unsaved new nodes receive no clickable reference. The policy tells the existing single inference to use these labels in natural English/German Advice. No model, output schema, tools, provider cards or additional inference were introduced.

## Resolution, scope and freshness

The server recognizes only the explicit, case-sensitive `Node #N` format with bounded token boundaries. Bare numbers, `#N`, title matches, numeric ID suffixes, decimal metrics, nonexistent labels and unsupported IDs are ignored. The original Advice text is preserved. Returned references contain only application-resolved label, exact ID and a freshness digest. The digest is not a credential.

The browser supplies the known saved Canvas revision for ordinary Advice. The existing goal-context/proposal-scope readers capture and revalidate the saved Canvas, Board revision (including PostgreSQL microseconds), verified actor, active identity, Board edit permission, Workspace membership/lifecycle and Brand association around inference. Existing legacy requests without a revision can still receive ordinary Advice but do not acquire references. Existing native-goal requests retain their strict revision requirement.

Every click posts to the new read-only `/api/ai-brain/node-reference` endpoint. It independently reauthorizes twice, verifies the digest and unique exact supported node ID, and returns no source copy. Deleted nodes, changed Board/Workspace/association, revoked permissions, changed identity or saved data fail closed. Browser origin checks also reject local edits, saves, account/scope changes and changes while a click is pending. A stale reference displays a clear EN/DE unavailable state. Transient failures can be retried.

## UI and navigation

Compact keyboard-accessible buttons appear beside the relevant formatted paragraph/list item. They show node type, title, up to 140 characters from the existing `getNodeListPreview` Canvas preview helper and an Open in Canvas affordance. Canvas surface/text/border/focus tokens support Light/Dark; text wraps on mobile. User content uses DOM text only. References are deduplicated across a heading-delimited answer section; a new heading permits a fresh nearby reference. Original answer formatting and text remain readable.

Navigation uses `setActiveView('board')`, the existing `focusNodeInCanvas` selection/Inspector owner, and the existing visibility helper. The Inspector receives focus. References never infer, create, edit, save or mutate Canvas content/history. Campaign Creator, Content handoffs, Brand Learnings, legacy DOM IDs and BW-39 Evidence behavior are unchanged.

## Changed files

- `api/_ai-brain-node-references.js`: deterministic mapping, reference policy and answer recognition.
- `api/ai-brain/node-reference.js`: authenticated read-only click resolver.
- `api/ai-brain/advice.js`: ordinary Advice context and resolved references.
- `api/_ai-brain-canvas-context.js`: export the existing supported-type set for the resolver.
- `app.js`, `ai-brain-node-references.css`, `index.html`: compact actual-node presentation, freshness state and native navigation.
- `scripts/check-bw40-node-references*.js`: signed-session SQL/Chromium integration fixtures.
- Existing BW-38.2A/BW-37.1B harnesses: include reference lifecycle helpers and the additive response field.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: focused check and both PostgreSQL CI jobs.

## Validation

Focused `npm run check:bw40` passes. Fictional saved fixtures include `node-27` and a UUID with identical titles, deliberately distinct from their labels `Node #1` / `Node #2`. Server tests cover one/multiple/repeated references, ambiguous metrics/numbers, forged/nonexistent/unsaved nodes, deleted nodes, stale revisions, wrong Board/Workspace, missing permissions and in-flight revocation. Browser integration invokes the production Advice handler and click resolver with signed sessions and disposable SQL, then exercises real Canvas selection/Inspector opening in EN/DE, Light/Dark, desktop/mobile, Enter/Space keyboard activation, distinct native theme surfaces, native Landing Page previews and heading/paragraph/list deduplication. It checks unchanged Canvas/history, no additional inference on click and no writes, plus scope changes while reauthorization is pending.

The complete Runtime Boot Safety workflow runs as two independent PR CI jobs on PostgreSQL **17.6** and **18.4**, including BW-40 and all existing regressions. [PR #843 Checks](https://github.com/Funklix/Funklix/pull/843/checks) contains the authoritative current results; the PR description records the final validation status. The local full-workflow run uses an explicitly disposable PostgreSQL 17.6 container. The local environment blocks `cdn.playwright.dev`, so local browser checks use `/usr/bin/chromium`; CI retains its original matching-browser installation. Native-goal response/VM expectations were updated for the additive references, and historical global stylesheet/checksum baselines remain byte-exact.

## Limitations

- Exact explicit labels only; arbitrary names, translated label spellings and indirect mentions do not become links.
- Labels are request-local and may change after reordering; old references are invalidated on source/scope changes.
- Only persisted nodes link. Local unsaved node content can inform Advice, but new unsaved IDs cannot navigate through a persisted reference.
- Freshness is intentionally conservative: any saved Board/scope change or local Canvas change can require asking again. The server validates immediately before native navigation; access changes after that final check remain subject to the application's existing Canvas lifecycle.
- Fixture tests mock provider output; they verify the integration contract, not a promise that every model answer will use a label.
