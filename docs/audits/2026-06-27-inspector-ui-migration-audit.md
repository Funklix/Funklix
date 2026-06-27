# Inspector UI Migration Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Right Inspector panel migration to Funklix design primitives |
| Current behavior | The Inspector is a persistent right-side panel with static form sections, conditional field groups, generated image controls, AI actions, node actions, connected context display, and autosave-sensitive fields. |
| Goal | Plan the smallest safe Inspector UI migration that adopts `.fk-*` primitives for static sections and fields without changing behavior, event targets, IDs, save/load, autosave, generated controls, or business logic. |

## Findings

- Inspector markup is static in `index.html`, while values, visibility, generated images, connected context, and action availability are controlled by `app.js`.
- `app.js` stores Inspector DOM references by ID in the central `el` registry.
- `fillInspector(node)` populates values, toggles conditional fields, updates connected context, renders images, and updates action visibility.
- `el.nodeForm.addEventListener("input", ...)` is the autosave-sensitive path for static form controls.
- Generated image controls are created in `renderInspectorImages(node)` and require a separate dynamic-controls PR.
- Action buttons trigger AI, image generation, scheduling, delete, disconnect, and propagation flows and should not be included in the first static migration.

## Critical DOM IDs to preserve

- Shell/form: `inspector-panel`, `inspector-meta`, `node-form`, `node-preview`
- Basic: `node-type`, `node-status`, `node-title`, `node-owner`, `node-content`
- Conditional content/landing: `content-image-prompt-field`, `node-image-prompt`, `landing-page-fields`, `lp-header-visual-prompt`, `generate-header-visual-btn`, `lp-header-claim`, `lp-problem`, `lp-solution`, `lp-trust`, `lp-cta`
- AI Workspace: `ai-workspace-section`, `ai-workspace-body`
- Social: `social-fields`, `node-platform`, `node-caption`, `node-hashtags`
- Images: `content-upload-fields`, `node-image-upload`, `inspector-image-list`, `content-format-field`, `node-content-format`, `generate-image-btn`, `generate-posting-visual-btn`
- Strategy: `node-audience`, `node-goal`, `node-channel`, `node-funnel-stage`, `node-tone`
- Actions: `node-variants`, `improve-node-btn`, `generate-next-step-inspector-btn`, `review-node-btn`, `regenerate-node-btn`, `regenerate-platform-btn`, `add-to-posting-calendar-btn`, `posting-schedule-meta`, `generate-full-pack-btn`, `disconnect-selected-btn`, `propagate-descendants-btn`, `delete-node-btn`, `delete-selected-btn`
- Connected context: `connected-context-details`, `connected-context-summary`, `connected-context-body`

## Safe first migration targets

- Static Inspector sections that only contain form fields: Basic, Social, and Strategy.
- Static Basic fields: `node-type`, `node-status`, `node-title`, `node-owner`, `node-content`, `node-image-prompt`, landing-page text fields.
- Static Social fields: `node-platform`, `node-caption`, `node-hashtags`.
- Static Strategy fields: `node-audience`, `node-goal`, `node-channel`, `node-funnel-stage`, `node-tone`.
- Add `.fk-card`, `.fk-input`, `.fk-select`, and `.fk-textarea` classes only.
- Add Inspector-scoped CSS overrides where existing broad `.node-form` styles would otherwise override `.fk-*` primitives.

## Deferred targets

- `app.js` changes.
- AI Workspace.
- Image upload and generated image controls.
- Image/action buttons.
- AI action controls and node action controls.
- Connected context display.
- File upload styling.
- Any save/load/autosave/data-model behavior.

## Recommended PR split

1. PR 1: static sections and static fields only.
2. PR 2: action button hierarchy.
3. PR 3: image upload and generated image controls.
4. PR 4: AI Workspace and generated dynamic content.

## Blast radius

Low-medium for PR 1 because it is class-only in static markup plus Inspector-scoped CSS. Behavior remains owned by existing IDs and event listeners.

## Decision

Proceed with PR 1 as a class-only static Inspector migration. Do not modify `app.js`.
