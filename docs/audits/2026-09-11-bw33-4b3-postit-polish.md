# BW-33.4B3 Post-it polish implementation record

## Investigation and selector boundary

The existing `renderPostits` owner remains in place. It clones `#postit-template`, applies the persisted local `x`, `y`, and color, renders the author/avatar and relative timestamp, owns root input/autosave, flat reply creation, Resolve/Reopen, physical close/deletion, color mutation, and then installs `enablePostitDrag`. Drag ignores textarea, input, and button targets and writes only `x`/`y`; the textarea's native resize corner remains the existing resize affordance. Post-its are absolutely positioned inside their parent node and retain existing Canvas stacking and node-selection/connection ownership.

Creation remains `addPostitToNode`: it stores an empty `text` value and existing identity, author, timestamp, replies, color, and local position fields. Persistence remains whole-Board serialization/autosave, while collaboration continues to reconcile sanitized nodes. The authoritative B1R1 selector and badge updater remain unchanged. Compact, Standard, and Detailed continue to affect ordinary-node summaries rather than Post-it conversation content.

The prior template phrase was an HTML placeholder, not creation-time content. There is no metadata capable of proving that similarly worded persisted records were system generated and never edited or collaborated on. Therefore this change performs no migration and never rewrites historical text. New empty Post-its use a true localized placeholder only.

The exact new visual boundary is `html[data-theme] .postit:not(.ai-review-postit)` and descendants: `> header`, `.postit-identity`, `.postit-actions`, `.postit-user`, `.postit-time`, `.postit-avatar`, `.postit-text`, `.postit-color`, `.postit-resolve`, `.postit-delete`, `.postit-replies`, `.postit-reply`, `.postit-reply-avatar`, `.postit-reply-body`, `.postit-reply-meta`, `.postit-reply-editor`, `.postit-reply-input`, `.postit-reply-button`, and `.postit-resolved-summary`. Dark and responsive rules retain the same exclusion. No ordinary node, `.ai-review-card`, Inspector, Content Workspace, or dialog selector is included.

## Presentation and behavior

Ordinary Post-its use the established `var(--fk-font-family)` stack (`Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`) without a new font dependency. The warm yellow surface remains color-overridable through the existing inline user color. The header now has two minimal presentation wrappers: identity (avatar, author, timestamp) and actions (color, state, close). Root and reply controls have scoped hierarchy, wrapping, preformatted newlines, bounded reply scrolling, visible focus, practical targets, and a narrow-screen rule. Dark Mode uses deliberate amber layers rather than inversion or filters.

Resolved notes retain disabled root text and readable replies, add a textual localized status summary, and preserve Reopen. Geometry, mutation listeners, root/reply payloads, timestamps, counter semantics, autosave, and collaboration ownership are unchanged. Unicode emoji continues through native textarea/string storage; no picker or dependency is added.

The safest B4 insertion point is the existing `.postit-actions` wrapper for a root-composer emoji trigger, or `.postit-reply-editor` immediately before its Send button for reply insertion. B4 must keep pointer events from reaching drag and insert at the current textarea selection without changing storage.

## Manual production verification gate

1. Sign in with Google.
2. Open an existing private Board.
3. Create or open an empty Post-it.
4. Confirm the placeholder matches the current UI language.
5. Switch UI language and confirm only the placeholder changes.
6. Enter a root message with normal text, line breaks, and an emoji.
7. Confirm the badge becomes one.
8. Add two replies and confirm the badge becomes three.
9. Resolve and confirm the badge becomes zero.
10. Confirm resolved history remains readable.
11. Reopen and confirm the badge becomes three.
12. Drag the Post-it.
13. Resize it.
14. Select and edit text without moving it.
15. Use the color control.
16. Close and reopen it.
17. Switch Light and Dark Mode.
18. Switch Compact, Standard, and Detailed.
19. Open an AI Review and confirm its design and functionality remain unchanged.
20. Click an ordinary node and confirm the Inspector opens.
21. Return to Boards and reopen the Board.
22. Confirm Post-it content, replies, state, position, and size persist.

## Known limitation

Historical authored text matching an old placeholder cannot be safely distinguished from user content and is intentionally preserved. The native root textarea remains the established resize affordance; no new persisted width/height schema is introduced.
