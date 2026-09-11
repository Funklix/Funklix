# BW-33.4B1R1 authoritative open-comment counter

## Frozen Inspector baseline

Before production editing, the existing boundaries were recorded and are protected by deterministic SHA-256 contracts in `scripts/check-bw33-4b1r1-open-conversation-count.js`: `selectCanvasNode` (ordinary click selection and `selectedPrimary` assignment), `fillInspector`, `synchronizeAppShell`, `inspectorResponsiveMode`, and the complete `aside#inspector-panel` subtree (root, `.inspector-content`, node fields, AI Actions, Node Actions, Connected Context, live region, close control, and responsive hooks). The runtime fixture executes the real selection, fill, visibility, and responsive functions and rejects a fixture with the Inspector subtree removed.

The reverted BW-33.4B1 commit removed the `selectCanvasNode` function while the ordinary node click and pointer handlers still invoked `selectCanvasNode(node)`. That exact dangling call caused a `ReferenceError`, preventing selected-node assignment, `fillInspector`, and Inspector opening. This recovery retains the function, every Inspector call, and every Inspector DOM node unchanged.

## Counter boundary

`getOpenConversationCountForNode(node)` is the sole selector. It derives a bounded non-negative integer from `node.postits` without mutation or external effects. An open ordinary Post-it contributes its non-empty human root and each eligible human reply. An AI Review contributes only eligible human records in its `replies`; generated review root/title/score/summary/strengths/improvements/rewrite never contribute. Resolved surfaces exclude all children; resolved replies, deleted/deletedAt records, empty text, system/generated/activity records, malformed values, AI authors, repeated object references, and duplicate stable IDs are excluded. Distinct ID-less contributions remain distinct. Reopening restores eligible, non-deleted stored contributions.

The existing badge owner and click listener remain intact. Only its displayed number, accessible name, existing title, and count-dependent presentation classes use the selector. English and German singular/plural labels and the established explanatory title are localized. Existing rendering/hydration/collaboration/density paths already reach `updateNodeCard`/`updateNodeCommentBadge`; established resolve/reopen, reply, deletion, and AI insertion paths already refresh it. The only missing targeted refresh was human root textarea input, where the existing badge updater is now called.

## Isolation and historical protection

The regression snapshots the full Board fixture and verifies byte-equivalence after counting, including geometry, dirty/history/collaboration/autosave counters, density, approval fingerprint, and publishing material. It also verifies reload parity and statically forbids DOM, network, storage, save, history, rendering, hydration, selection, and Inspector calls from the selector. A deliberately removed Inspector fixture represents the historical unsafe removal and must be rejected.
