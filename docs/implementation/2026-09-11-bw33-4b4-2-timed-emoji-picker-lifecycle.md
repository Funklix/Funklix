# BW-33.4B4.2 — timed emoji-picker lifecycle repair

## Proven temporal root cause

BW-33.4B4.1's internal-scroll diagnosis is disproven for the observed idle failure. The bounded trace identified a different sequence: opening the picker moves focus from the Post-it textarea into the body-portalled emoji grid; the editing-presence `focusout` cleanup runs after 80 ms and schedules a presence update; the asynchronous presence response calls `refreshOwnershipDisplays`, then `updateNodeCard`. `nodeHasActivePostitEditor` saw neither the portalled focused button nor an element inside the Post-it and returned false. `updateNodeCard` consequently called `renderPostits`, whose first statement called `closePostitEmojiPicker`, removed the picker directly, and then replaced every Post-it DOM node. The observed response completed at 900 ms in the deterministic trace.

Trace (monotonic elapsed time):

| Time | Event | Result before repair | Result after repair |
| ---: | --- | --- | --- |
| 0 ms | picker created, inserted, assigned ownership, grid focused | connected | connected |
| 80 ms | root editor focusout cleanup | presence clear/update scheduled | connected |
| 500 ms | asynchronous presence work in flight | connected | connected |
| 900 ms | presence response → `refreshOwnershipDisplays` → `updateNodeCard` → active-editor predicate | predicate false → `renderPostits` → centralized close, anonymous cleanup | predicate true; disposable Post-it render skipped |
| 1,000/2,000/10,000 ms | deterministic checkpoints and all lifecycle frames | disconnected from 900 ms | same picker remains connected |

The exact historical close call site was the first line of `renderPostits`; it removed the picker directly (rather than merely hiding it), before the same render replaced its trigger and editor ancestors. The picker itself owns no timers, intervals, animation-frame loop, mutation observer, or resize observer. Autosave watching (1,000 ms), save debounce (3,000 ms), Board polling (12,000 ms), and presence polling (20,000 ms) do not close it merely because they elapsed. The initial focus-driven presence request—not the periodic poll—explains why production usually failed near one second.

The earlier regressions missed this because they exercised the picker functions in isolation: their fake lifecycle never passed the portalled-focus state through the production `nodeHasActivePostitEditor` render gate or the presence-completion call chain. BW-33.4B4.1 instead encoded its now-disproven internal-scroll fixture.

## Repair and close-reason inventory

The preferred minimal repair prevents the unnecessary Post-it rerender. `nodeHasActivePostitEditor` now regards a picker whose trigger belongs to the node as the same logical active editor even while focus is in the body portal. Stable Board protection remains in the picker state, and authoritative resolution, deletion, reply submission, target loss, and Board loading still render or close normally. No persisted identifier or schema change was needed; caret state and the original trigger/editor remain intact.

The centralized close boundary now rejects calls without a stable internal reason. Reasons map to: `emoji-selected`, `escape`, `outside-pointer`, `trigger-toggle`, `ownership-transferred`, `postit-resolved`, `postit-deleted`, `reply-submitted`, `board-load-start`, `board-changed`, `target-invalid`, `target-removed`, `viewport-transition`, and `interface-layout-transition`. The reason is retained on the closing transient instance for deterministic verification; it contains no user or Board content. Cleanup still removes the single outside listener and viewport listeners, resets ARIA state, and removes the portal.

Internal scroll and composed-path safeguards from BW-33.4B4.1 remain. Root selection still inserts at the captured range, restores focus/caret, and dispatches the established `input` event. Reply selection remains only in the DOM draft until normal Send. No picker code writes storage, history, network, collaboration, approval, publishing, `node.postits`, counters, or geometry. Inspector, AI Review, density modes, Light/Dark styling, and picker visuals are unchanged.

## Regression and browser status

`check:bw33.4b4.2` loads the real production picker functions, uses deterministic temporal checkpoints through ten seconds, runs the exact historical portalled-focus/render-gate sequence, and verifies background-refresh resilience, close reasons, insertion semantics, scroll/outside behavior, Board staleness, ownership transfer, and listener cleanup. It is registered immediately after BW-33.4B4.1 in Runtime Boot Safety.

No installed browser or browser-testing runtime was available in the repository/environment. Browser verification therefore remains **ready for manual production review**, not claimed complete.

## Manual production verification gate

1. Sign in with Google.
2. Open an existing private Board.
3. Open an unresolved ordinary Post-it.
4. Click the root emoji trigger.
5. Do not move the pointer for ten seconds.
6. Confirm the picker remains open.
7. Move through all categories for another ten seconds.
8. Confirm it remains open.
9. Scroll inside the picker.
10. Confirm it remains open.
11. Hover several emojis.
12. Select one.
13. Confirm correct root insertion and caret restoration.
14. Open the picker again.
15. Wait through the normal autosave interval.
16. Confirm it remains open.
17. Open a reply composer.
18. Open its emoji picker.
19. Leave it idle for ten seconds.
20. Confirm it remains open.
21. Insert an emoji.
22. Confirm the reply remains unsent.
23. Send it normally.
24. Confirm the badge increases by one contribution.
25. Open and close with Escape.
26. Open and close with a genuine outside click.
27. Confirm no Post-it drag or Canvas pan starts.
28. Resolve and reopen the Post-it.
29. Test Light Mode.
30. Test Dark Mode.
31. Test Compact, Standard, and Detailed.
32. Confirm AI Review remains unchanged.
33. Click ordinary nodes and confirm the Inspector opens.
34. Return to Boards and open another private Board.
35. Reload.
36. Confirm Board access, conversations, counter, geometry, and Inspector remain correct.
