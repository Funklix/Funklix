# BW-33.4B4 — Accessible ordinary Post-it emoji picker

## Investigation findings

`renderPostits(node, nodeEl)` remains the sole ordinary and AI Review Post-it renderer. It removes and rebuilds the owning node's `.postit` children. An ordinary record is identified by the inverse of the existing `source === "ai_review"`/AI author identity predicate and receives `data-postit-id`; AI Reviews receive `.ai-review-postit`. No renderer was replaced.

The root editor is the template-owned `.postit-text` textarea inside the cloned `article.postit`, itself appended to the owning `.node`. Its `input` listener assigns `note.text = area.value`, updates only the existing node comment badge, and calls `saveCampaignCanvasState()`. Root editing does not rerender the Post-it.

The ordinary header is rebuilt as `.postit-identity` plus `.postit-actions`; the latter owns color, Resolve/Reopen and delete controls. The new unresolved root trigger is inserted there between color and Resolve. Compact resolved ordinary Post-its return early after creating `.postit-resolved-summary`; the implementation deliberately does not create their trigger. Reopen follows the established resolve listener, rerenders, refreshes the badge, saves, and focuses the rebuilt root editor.

The reply composer is a DOM-only `.postit-reply-editor` appended to the exact Post-it by `.postit-reply-button`. It owns `.postit-reply-input` and the existing Send button. The reply trigger is inserted immediately before Send. Emoji insertion changes only this textarea draft. Send still trims the textarea, creates the established actor payload, pushes one reply into `note.replies`, records activity, rerenders, refreshes the badge and saves. The draft is destroyed by the established rerender/Board lifecycle.

`enablePostitDrag` rejects `pointerdown` from `textarea,input,button`; both triggers and every option are buttons. The body-portal surface additionally stops only its own pointerdown/click propagation. Canvas node selection, click ownership, connection handling, keyboard shortcuts, pointer pan, wheel zoom and Post-it drag remain untouched.

Canvas/Post-it rerenders destroy direct listeners. Root input intentionally avoids rerender; reply submission, resolve/reopen and deletion rerender. The picker is centrally closed when its originating `nodeEl` is about to rerender. Disconnected editor/trigger and active-Board checks provide a second stale guard.

Localization uses `FunklixLanguage.t`, `data-i18n-title`, and `data-i18n-aria-label`. The existing interface-language change handler closes the active picker before translating the application, preventing mixed-language UI. English is the key/fallback language; German contains trigger, picker, group and all emoji names.

Existing context menus are locally positioned inside Canvas ownership and dialogs are modal, so neither is safe to reuse. The picker uses one transient, fixed-position `document.body` portal with bounded viewport placement and `z-index:1200`. This avoids conversation-scroller clipping without changing Canvas or Post-it coordinates. One global lifecycle installs outside-pointer, resize, and capture-scroll listeners only while one picker is open; resize/scroll close rather than risk stale placement.

The design reuses semantic surface, text, border, primary, motion and focus-shadow tokens. Existing controls use `:focus-visible`; reduced-motion rules disable the new entrance and transitions. The BW-33.4B1R1 selector remains the sole contribution counter. BW-33.4B3 owns ordinary presentation and DOM insertion boundaries; BW-33.4B3.1 owns compact resolution and corrected Dark Mode controls. Inspector routing (`selectCanvasNode`, `fillInspector`, `synchronizeAppShell`, responsive mode and subtree), authentication, hydration and collaboration authority are unchanged.

## Implementation decisions

### Ownership, caret and mutations

There is exactly one module-local `activePostitEmojiPicker`; it is presentation-only. Opening captures UTF-16 `selectionStart`/`selectionEnd` before focus moves, then clamps both to the current value length and normalizes the end after the start. Selection replaces the range with Unicode text and places the caret at `start + emoji.length`, which is correct for browser textarea UTF-16 offsets and surrogate pairs.

A valid root selection dispatches one bubbling standards-based `input` event, activating the authoritative listener rather than duplicating persistence. A reply selection dispatches no event and cannot submit or mutate `node.postits`. If the editor/trigger is disconnected or its captured Board ID differs from `state.currentBoardId`, insertion closes safely and does nothing.

### Accessibility and interaction

Triggers are real localized buttons with title, accessible name, `aria-haspopup="dialog"`, accurate `aria-expanded`, and active `aria-controls`. The picker is a named dialog containing localized sections and a bounded grid. Each option has a translated accessible name and title while its glyph is `aria-hidden`. Initial focus enters the first option; native Tab can leave the picker (no trap). Arrow keys move through the bounded collection, Home/End move to its bounds, native Enter/Space activate buttons, and Escape/outside-close restores the trigger when still valid. Selection closes and restores the editor/caret.

### Cleanup and isolation

Opening a trigger closes the previous picker. Selection, Escape, outside pointer, origin rerender, resolution, deletion, reply submission/closure, language change, viewport resize/scroll, Board replacement/disconnection, and stale active-Board validation remove it. Listeners are removed with the portal. No application-wide render occurs to open or close it.

All new Post-it trigger selectors require `.postit:not(.ai-review-postit)`. Portal selectors use the feature-unique class. No AI Review renderer/control is changed. The fixed portal does not participate in Canvas transform, drag, pan, selection or connections.

### Persistence, collaboration and counting

The emoji catalog and picker state are constants/transient DOM only. There is no schema field, storage, network, asset, dependency, history entry or collaboration event. A root emoji persists only through the existing input/save path. An unsent reply remains zero contributions; established Send adds one reply contribution regardless of emoji count. Resolution still makes the existing selector return zero and reopen restores valid retained contributions. AI-generated review content remains excluded.

### Visual and responsive behavior

The picker is a compact rounded layered surface with a nine-column grid, restrained shadow, tokenized hover/active/focus feedback, bounded width/height and internal scrolling. Narrow screens use seven columns and larger touch rows. Dark Mode uses semantic elevated/panel surfaces rather than brown portal buttons; only the ordinary trigger retains the warm Post-it identity. Reduced motion removes entrance and control transitions.

## Regression coverage

`check:bw33.4b4` executes the production caret/insertion functions for empty, beginning, middle, end, selection replacement, multiline, focus/caret, root-input and unsent-reply cases. It verifies stale safety, one lifecycle owner, eligibility insertion points, compact exclusion, portal/accessibility/keyboard contracts, drag guard, Send boundary, localization, theme/responsive/reduced-motion scope, absence of persistence/network/dependencies, workflow order and cancelled B2 absence. Existing counter, presentation, Inspector, Canvas, localization, persistence and collaboration suites remain the broader integration gates.

## Known limitations

The picker intentionally contains 36 collaboration emojis rather than an operating-system catalog, search, recents, skin-tone controls or custom uploads. Viewport scrolling closes it instead of continuously repositioning it. Deterministic Node regressions are not a substitute for authenticated production browser verification.

## Manual production verification gate

1. Sign in with Google.
2. Open an existing private Board.
3. Open an ordinary unresolved Post-it.
4. Activate the root emoji trigger.
5. Confirm the picker is readable and well positioned.
6. Navigate the picker using the keyboard.
7. Insert an emoji into an empty root.
8. Insert another emoji in the middle of existing text.
9. Replace selected text with an emoji.
10. Confirm focus and caret return to the editor.
11. Confirm the root saves through its established behavior.
12. Open a reply composer.
13. Insert an emoji into the reply.
14. Confirm it remains unsent.
15. Confirm the badge has not increased.
16. Submit using the existing Send action.
17. Confirm the reply appears and the badge increases by one contribution.
18. Open the picker and close it with Escape.
19. Open it and close it by clicking outside.
20. Confirm neither interaction drags the Post-it nor pans the Canvas.
21. Resolve the Post-it and confirm the picker is unavailable in compact resolved state.
22. Reopen it and confirm the picker returns.
23. Move and resize the Post-it.
24. Switch between Compact, Standard, and Detailed.
25. Test Light Mode.
26. Test Dark Mode, including trigger and picker button states.
27. Switch between English and German.
28. Confirm localized trigger, picker, category, and emoji names.
29. Open an AI Review and confirm no emoji picker was added there.
30. Confirm AI Review functionality and presentation remain unchanged.
31. Click ordinary nodes and confirm the Inspector still opens.
32. Return to Boards and open a second private Board.
33. Reload the browser.
34. Confirm Board access, Post-it content, replies, counter, geometry, and Inspector remain correct.
