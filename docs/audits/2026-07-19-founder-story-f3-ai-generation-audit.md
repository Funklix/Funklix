# Founder Story F3 AI Generation Audit

## Summary

F3 adds one safe `Generate Founder Story` action to the valid typed Founder Story specialized editor. The action reads the seven existing `moduleData.founderStory` source fields, sends a narrow authenticated AI request, shows one generated narrative in a review dialog, and writes accepted output only to existing `tile.content`.

## Dependency Findings

The existing F0/F1/F2/F2.5 work already provides registry-backed Founder Story discrimination, typed editor rendering, seven source fields, narrative storage in `tile.content`, derived card status, and immediate save behavior. No identity, registry, adapter, persistence schema, section routing, or card-status changes are needed.

## Existing AI Architecture

Existing frontend AI calls are plain `fetch()` calls from `app.js` to `/api/*` routes. Existing server AI routes keep provider keys server-side through `process.env.OPENAI_API_KEY`, call OpenAI directly, and commonly request structured JSON. Brand DNA generation is the closest structured Brand-context example, using a server prompt, response schema, JSON extraction, and normalized output.

## Frontend Request Flow

The Founder Story editor constructs a structured payload in `app.js` and posts it to `/api/generate-founder-story`. The frontend sends source fields, filtered Brand context, `moduleType: "founder_story"`, board id, and optional existing narrative. It does not send prompts, full board state, secrets, uploads, references, or campaign data.

## Backend Request Flow

`api/generate-founder-story.js` validates POST requests, requires a signed-in session, verifies Board access when `boardId` is supplied, validates `moduleType`, normalizes the source and Brand context, validates minimum input, builds the authoritative prompt server-side, calls the existing OpenAI Responses API pattern, parses strict JSON, validates one non-empty narrative, and returns `{ success: true, narrative }`.

## Authentication and Security

The endpoint uses `getSessionUser()` and rejects unauthenticated requests. When a board id is present, it reuses `getBoardAccess()` and requires view access before generation. Provider API keys remain server-side. Provider errors are sanitized. The response contains only a generated narrative and no provider secret or raw provider stack.

## Specialized Editor Discriminator

The action is rendered only inside `renderFounderStoryCustomTileEditor()`, which is reached only when `isFounderStoryCustomTile(tile)` validates the persisted canonical `moduleType` through the registry-backed helper. Title matching does not activate the action.

## Minimum Input Rule

Generation requires one identity clue (`founderNameRole` or reliable Brand name) and at least two non-empty source details among observed problem, motivation, turning point, background, proof points, and vision. Insufficient input shows: “Add the founder’s identity and at least two story details before generating.” No API request is sent.

## Source Data Contract

The source contract remains `moduleData.founderStory` with `founderNameRole`, `observedProblem`, `motivation`, `turningPoint`, `background`, `proofPoints`, and `vision`. The accepted narrative remains stored only in `tile.content`.

## Brand Context Selection

The frontend filters stable, useful Brand fields: brand name, mission, vision, values, audience/personas, positioning/value proposition, tone of voice, category, tagline, Brand DNA labels, and website domain. Empty fields are omitted and large website-analysis dumps are not sent.

## Request Payload

Payload shape is `{ moduleType, boardId, source, brandContext, existingNarrative }`. `source` contains only Founder Story source keys; `brandContext` contains only non-empty selected fields; `existingNarrative` is optional context.

## Prompt Design

The backend prompt instructs the provider to generate one grounded reusable Founder Story narrative, treat user source text as data rather than instructions, omit missing details, avoid invention, and return strict JSON.

## Narrative Structure

The narrative target is approximately 250–450 words and follows the supported arc: founder identity, observed problem, why it mattered, decision to act, background/credibility, brand purpose, and future vision. Empty sections are not forced and headings are not requested.

## Structured Response Contract

The endpoint returns success as `{ "success": true, "narrative": "..." }`. Failures return `{ "success": false, "error": { "code": "...", "message": "..." } }`. The frontend validates that `narrative` is a non-empty string within the local size bound before rendering review UI.

## Loading State

During generation the button is disabled and its text changes to `Generating…`. No global loading state is used. Editor values, selected card, existing narrative, and source fields are preserved.

## Review and Confirmation UX

Generated output appears in an existing `.brand-confirm-modal` / `.brand-confirm-card` pattern with heading `Generated Founder Story`, an editable textarea preview, primary action `Use this narrative`, and secondary action `Keep current narrative`.

## Existing Narrative Protection

API success never writes to `tile.content`. Existing non-empty narratives stay visible during generation and can only be replaced after the user clicks `Use this narrative` in the review dialog.

## Apply Behavior

Apply revalidates the current tile context, writes only accepted preview text to `tile.content`, calls `saveBrandBrainState()`, rerenders Brand Core tiles and editor, and closes the dialog. Structured source fields and unrelated tile data are preserved.

## Cancel Behavior

Cancel removes the temporary dialog and does not mutate or save `tile.content`, source fields, or unrelated tile data.

## Error Handling

The editor shows local concise messages for insufficient input, stale context, network/server/provider failure, malformed response, empty narrative, and unexpected response shape. Expected user-facing failures do not log browser console noise.

## Concurrency and Stale-Context Protection

A local `state.founderStoryGeneration.inFlight` guard prevents duplicate requests. Generation captures tile id and board id. Before opening review and before applying, the app confirms the same board is active, the tile still exists, the selected tile still matches, and the tile remains a valid typed Founder Story.

## DOM IDs Added

- `brand-core-founder-story-generate-button`
- `brand-core-founder-story-generate-message`
- `brand-core-founder-story-generate-heading`
- `brand-core-founder-story-generate-preview`
- `brand-core-founder-story-generate-apply`
- `brand-core-founder-story-generate-cancel`

No existing F1/F2.5 IDs were removed or renamed.

## Event Listener Strategy

Listeners are attached to freshly rendered Founder Story editor elements and to the temporary review dialog elements. No accumulating global listeners are added. The in-flight guard prevents duplicate API calls.

## Persistence Behavior

`saveBrandBrainState()` is synchronous in the local mutation path: it writes the normalized Brand Brain state into local storage immediately and schedules board save through existing dirty-state behavior. F3 uses this path only after explicit acceptance.

## Card Preservation

No card helper, card status, preview order, card markup branch, section routing, or selection behavior was changed. Accepted narrative naturally makes the existing derived status become `Story ready`.

## Generic Editor Preservation

The generic Custom Tile editor and all non-Founder Story modules remain unchanged. Legacy untyped title-only Founder Story tiles do not receive the generate button.

## No Automatic Mutation Confirmation

Generation does not change structured fields, create missing source facts, rewrite title, alter module type, assign IDs, modify items/references, reorder custom tiles, or persist AI metadata. Only explicit acceptance changes `tile.content`.

## Files Changed

Runtime files changed: `app.js` and `api/generate-founder-story.js`. Documentation added: this audit file. No stylesheet change was required.

## Runtime Confirmation

Runtime scope remains within the allowed three runtime files: one frontend file and one API file. No provider configuration, shared routing, auth system, registry, identity, adapter, board schema, or persistence schema files were modified.

## Risks

Existing OpenAI routes are not uniformly authenticated, but this new endpoint is authenticated and board-aware. Manual browser QA is still needed for visual polish and provider-failure simulation.

## Rollback

Revert the F3 commit to remove the editor action, API endpoint, and this audit. No data migration is required because accepted narratives use existing `tile.content` only.

## Manual QA

Follow the task checklist for visibility, minimum input, loading, empty narrative, existing narrative protection, generated preview safety, error handling, concurrency, rename, preservation, generic regression, boot regression, and security verification.

## Deferred F4 Scope

Future work may add deeper tests, richer review styling, retry affordances, version history, channel-specific variants, interview flow, or generalized module AI only in separate scoped PRs.
