# BW-33.4B4.1 — Stable Post-it emoji picker lifecycle

## Verified cause and event trace

The first deterministic closing condition during the failed production interaction was a `scroll` event whose target was the independently scrollable, fixed `document.body` picker portal. BW-33.4B4 registered `window.addEventListener("scroll", onViewportChange, true)`. Because that listener used capture and `onViewportChange` unconditionally closed, an internal picker scroll was classified as a Canvas/app-shell viewport change. Moving toward/within the overflow-constrained picker with a trackpad or scrolling it therefore reached the Window capture listener before target handling and removed the portal. The eight-pixel visual gap and pointer enter/leave did not close it; no pointer-movement, hover, blur, focusout, observer, timer, animation-frame, or disconnection callback was registered for picker dismissal.

The complete opening sequence is: trigger `pointerdown` snapshots the textarea selection; Post-it drag rejects the button target; trigger `click` stops click propagation; an existing global picker is closed; the portal and options are created and appended to `document.body`; one document capture `pointerdown`, one Window `resize`, and one Window capture `scroll` listener are installed; placement is measured; then the first option receives focus. The portal and trigger are physically separate DOM branches. The failed sequence continued with an internal portal scroll, Window capture invoking `onViewportChange`, centralized close removing all three global listeners and the portal, resetting trigger ARIA state, and leaving pointer travel with no picker to enter.

BW-33.4B4 did not detect this because its executable coverage exercised caret capture and root/reply insertion, while open/portal/listener behavior was checked only as source text. It did not open through the production trigger in a DOM-shaped runtime or dispatch the trigger-to-portal interaction sequence.

## Close-call inventory and authoritative lifecycle

All closure still runs through `closePostitEmojiPicker`. Its call sites are:

1. Board loading starts in `loadBoardFromUrlIfPresent`.
2. Stale/disconnected editor, trigger, or Board identity is detected before insertion.
3. Successful emoji selection completes.
4. Placement detects a disconnected trigger or changed Board.
5. Opening/transferring to another trigger first removes the prior global picker.
6. Escape is handled by the picker keyboard listener.
7. A document capture `pointerdown` is outside the active picker and trigger.
8. A genuine non-picker scroll or Window resize invalidates placement.
9. Activating the active trigger toggles it closed.
10. The owning node's Post-its are authoritatively rerendered (including resolve, delete, reply Send, and composer removal).
11. Interface language changes before application translation.

The repair preserves these state changes and distinguishes picker-local scroll from Canvas/app-shell viewport changes. Picker-local scroll now returns without cleanup. Initial keyboard focus uses `{ preventScroll: true }`, preventing focus placement itself from initiating avoidable scrolling. No pointer movement listener was added, and movement over the Canvas, the portal gap, category headings, options, empty picker space, or another non-interactive area has no close path. Actual Canvas scrolling/panning still emits a non-picker scroll and closes under the established placement policy; Post-it drag still begins only after a qualifying non-control `pointerdown` and can invalidate placement through the resulting authoritative viewport/rerender lifecycle.

## Outside interaction, portal, focus, and accessibility

Outside dismissal remains one bounded document-level capture `pointerdown` installed only while active and removed centrally. The boundary now checks `event.composedPath()` when available, then uses `contains` as fallback. Picker descendants (including its scrollbar/surface) and trigger descendants are internal even though the fixed portal and trigger do not share a parent. The opening `pointerdown` precedes listener installation because opening occurs on `click`, so it cannot immediately dismiss the new picker. There is no duplicate document `click` dismissal. Activating the current trigger retains the established toggle; activating another trigger dismisses the old instance on pointerdown and opens exactly one replacement on click.

Pointer travel is independent of textarea/trigger hover and focus. Focus may enter the roving grid without dismissal. Selection closes then restores the originating editor and captured caret. Escape and outside activation restore the trigger only when it remains connected and belongs to the current Board. Native Tab remains available, so no keyboard trap is introduced. Trigger names, `aria-haspopup`, `aria-expanded`, `aria-controls`, dialog/grid roles, translated category/emoji names, roving Arrow/Home/End navigation, native Enter/Space activation, visible focus, and disconnected-reference guards are unchanged.

## Root/reply, Canvas/drag, stale state, and persistence

Root selection still inserts at the captured UTF-16 range, restores focus/caret, and dispatches exactly one bubbling `input` event through the existing root mutation/save boundary. Reply selection changes only the transient reply textarea, dispatches no input/save event, remains unsent, and cannot change the contribution badge until established Send pushes the reply. The global picker transfers safely between root and reply triggers.

Trigger and option buttons remain covered by the Post-it drag guard. Portal pointerdown/click propagation remains scoped to the portal, so it cannot initiate Canvas pan, node selection, connection creation, Post-it drag, or Inspector dismissal. No Canvas, node, Inspector, AI Review, density, or geometry code changed. Legitimate rerender, resolve, delete, reply composer removal/Send, Board load/switch, stale Board identity, and disconnected editor/trigger cleanup remain active.

Opening, pointer travel, internal scrolling, and closing only alter transient DOM/listeners/ARIA. They do not mutate `node.postits`, Board dirty state, history, collaboration, APIs, storage, geometry, approval, publishing, density, or selection. No CSS changed: the approved Light Mode, Dark Mode, narrow layout, four-category layout, spacing, surface, shadow, typography, trigger, ordinary/resolved Post-it, AI Review, Inspector, and Canvas density visuals are preserved.

## Regression coverage

`check:bw33.4b4.1` executes the real production capture, trigger, open, placement, inside-boundary, insertion, and close functions in a DOM-shaped runtime. It opens through production `pointerdown`/`click`; traverses trigger, gap, portal, sections, empty space, and every option with pointer and mouse movement/enter/leave; verifies instance/ARIA/listener stability; verifies picker-local scroll and composed-path containment; and verifies one outside dismissal with focus restoration. It also covers toggle, transfer, Escape, root/reply insertion, unsent reply behavior, stale editor/Board protection, real viewport invalidation, repeated cleanup, no persistence/network calls, unchanged CSS, drag/AI Review/resolved boundaries, workflow order, and cancelled BW-33.4B2 absence. BW-33.4B4, BW-33.4B3.1, and BW-33.4B1R1 remain independent required gates.

## Manual production verification gate

1. Sign in with Google.
2. Open an existing private Board.
3. Open an unresolved ordinary Post-it.
4. Click the root emoji trigger.
5. Slowly move the pointer away from the trigger.
6. Move across the visible gap into the picker.
7. Move across all four emoji categories.
8. Hover several emoji buttons.
9. Pause over empty space inside the picker.
10. Move outside the picker without clicking.
11. Move back into the picker.
12. Confirm the picker remained open throughout.
13. Select an emoji.
14. Confirm it is inserted at the correct root caret position.
15. Confirm focus and caret return to the editor.
16. Open the picker and press Escape.
17. Confirm it closes and focus returns to the trigger.
18. Open it and click outside.
19. Confirm it closes once.
20. Open it and click inside the picker without selecting where possible.
21. Confirm it does not close as an outside interaction.
22. Open a reply composer.
23. Open its emoji picker.
24. Move from the reply trigger into the picker.
25. Confirm it remains open.
26. Insert an emoji.
27. Confirm the reply remains unsent.
28. Send the reply through the existing Send action.
29. Confirm the badge increases by one contribution.
30. Confirm no Post-it drag or Canvas pan begins during picker use.
31. Resolve the Post-it and confirm the picker is unavailable.
32. Reopen it and confirm the trigger returns.
33. Test Light Mode.
34. Test Dark Mode.
35. Test Compact, Standard, and Detailed.
36. Open an AI Review and confirm it remains unchanged.
37. Click ordinary nodes and confirm the Inspector still opens.
38. Return to Boards and open another private Board.
39. Reload the browser.
40. Confirm Board access, conversations, counter, Post-it geometry, and Inspector remain correct.
