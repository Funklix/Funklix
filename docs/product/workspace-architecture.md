# Workspace Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Highest-Level Architecture |
| Owner | Product |
| Last Updated | 2026-06-27 |
| Scope | Product ownership hierarchy; documentation only |

## Purpose

Workspace Architecture is the highest-level architecture document in Funklix.

It defines the complete ownership hierarchy from the Workspace level downward and establishes the canonical context in which every product surface operates.

This document answers:

- What owns administration?
- What owns marketing intelligence?
- What is the user's active working context?
- Where do Boards, Canvas, Nodes, and Assets belong?
- How should agencies, single-company teams, client handovers, and future enterprise structures scale?

## Canonical Ownership Hierarchy

```text
Workspace
↓
Brand
↓
Dashboard
Brand Core
AI Brain
Insights
Boards
Content Workspace
Simulation
↓
Campaign Canvas
↓
Nodes
↓
Assets
```

The hierarchy means:

- Workspace owns administration.
- Brand owns marketing intelligence.
- Product surfaces operate inside one active Brand.
- Boards belong to exactly one Brand.
- Campaign Canvas belongs to exactly one Board.
- Nodes belong to exactly one Canvas.
- Assets belong to Nodes, unless explicitly promoted into Brand-level reusable assets.

## What is a Workspace?

A Workspace is the organizational and administrative container for one company, agency, client organization, department, enterprise group, or white-label tenant.

Workspace owns:

- Members
- Roles and permissions
- Billing
- Workspace settings
- Integrations
- Brand records
- Workspace-level audit and administration
- Subscription and plan limits

Workspace does **not** own marketing knowledge.

Workspace may decide who can access a Brand, but the Workspace is not the source of Brand truth. Workspace settings should not become a hidden Brand Brain, global AI memory, campaign memory, or knowledge repository.

## What is a Brand?

A Brand is the primary working context inside Funklix.

A Brand owns the marketing intelligence that makes Funklix useful:

- Brand Consciousness
- Brand Core
- Brand Brain
- Knowledge
- Research
- Positioning
- Voice
- Archetype
- Avatar
- ICP
- Founder Story
- Campaign History
- Learning
- Insights
- Simulation Memory
- AI Brain context
- Reusable Brand assets
- Boards
- Content Workspace context

A Brand is the operational expression of Brand Consciousness inside a Workspace. Brand Consciousness describes the living intelligence of the Brand; the Brand is the product-level entity users select, administer, and work inside.

## Why Brand is the Primary Working Context

Users do not primarily work inside a Workspace. They work inside a Brand.

A Workspace can contain many unrelated Brands. If product surfaces operated at Workspace scope by default, AI memory, Dashboard briefings, Insights, Boards, and Knowledge could accidentally mix unrelated marketing contexts.

Brand is the primary working context because:

- Marketing strategy is Brand-specific.
- AI reasoning must be Brand-specific.
- Dashboard priorities must be Brand-specific.
- Insights and learning must be Brand-specific.
- Boards and Campaigns must inherit Brand context.
- Simulation must test assumptions against a Brand's ICP, voice, history, and positioning.
- Client handover and agency workflows need Brand-level portability.

## Active Brand Concept

At any moment, a user operates inside one **active Brand**.

The active Brand determines:

- Which Dashboard is shown.
- Which Brand Core is edited.
- Which AI Brain context is used.
- Which Insights are visible.
- Which Boards are listed.
- Which Content Workspace assets are available.
- Which Simulation memory applies.
- Which Brand Brain and Knowledge are read.

If no active Brand is selected, the product should show Brand selection, Brand creation, or Workspace administration. It should not expose editable Campaign Canvas, AI Brain, Insights, or Dashboard context without a Brand.

## Brand Switching

Brand switching changes the active Brand context.

When a user switches Brand:

1. Dashboard changes to that Brand's Mission Control.
2. Brand Core changes to that Brand's editing surface.
3. AI Brain changes to that Brand's reasoning context.
4. Insights change to that Brand's observations and learning.
5. Boards list changes to that Brand's Campaign Boards.
6. Content Workspace changes to that Brand's content and reusable assets.
7. Simulation changes to that Brand's test memory.
8. URLs and session state should make the selected Brand explicit or recoverable.

Brand switching must never blend Brand Brain, AI memory, Insights, Boards, or Simulation memory across unrelated Brands.

## Session Ownership

A session belongs to:

```text
Workspace session
↓
Active Brand session
↓
Optional Active Board session
↓
Optional Active Canvas selection
```

The Workspace session establishes identity, membership, billing plan, and permission envelope.

The active Brand session establishes marketing context.

The active Board session establishes campaign work context.

The active Canvas selection establishes UI-level focus, such as selected nodes, zoom, inspector state, and local editing presence.

A user may be signed into a Workspace without an active Brand. A user may be inside a Brand without an active Board. But a user should not edit a Campaign Canvas without both an active Brand and an active Board.

## URL Implications

URLs should eventually encode or resolve the active hierarchy clearly.

Recommended future URL concepts:

```text
/workspaces/:workspaceId
/workspaces/:workspaceId/brands/:brandId
/workspaces/:workspaceId/brands/:brandId/dashboard
/workspaces/:workspaceId/brands/:brandId/boards/:boardId
/workspaces/:workspaceId/brands/:brandId/boards/:boardId/canvas
```

Shorter product URLs may be supported, but they must resolve to the same hierarchy.

A `/boards/:boardId` URL is acceptable only if the board lookup deterministically resolves its owning Brand and Workspace before editing.

Root `/` should resolve to a safe Workspace or active Brand entry point, not an anonymous editable Canvas.

## Workspace Responsibilities

Workspace owns administration:

- Members
- Invitations
- Roles
- Permissions
- Billing
- Subscription status
- Workspace settings
- Integrations configuration
- Security policies
- Audit logs
- Brand list
- Ownership transfer intake/outflow

Workspace does not own:

- Brand Brain
- Brand Consciousness
- Brand knowledge
- AI Brain memory
- Campaign learning
- Board content
- Node content
- Insights truth
- Simulation memory

## Brand Responsibilities

Brand owns marketing intelligence and marketing work context:

- Brand Consciousness
- Brand Core editing surface
- Brand Brain structured knowledge
- Knowledge library
- Research sources
- AI Brain context and memory
- Dashboard Mission Control
- Insights
- Simulation memory
- Boards
- Campaign history
- Reusable assets
- Content Workspace context
- Deployment learning

Brand does not own Workspace billing, global membership, or Workspace-wide integration administration unless those settings are explicitly Brand-scoped.

## Member Ownership

Members belong to the Workspace.

Member access to Brands, Boards, and product surfaces is granted through Workspace-owned roles and permissions.

A member may have:

- Workspace admin access.
- Brand owner access.
- Brand editor access.
- Board collaborator access.
- Read-only/client access.
- Billing/admin-only access.

Member identity is Workspace-owned. Marketing knowledge created by a member belongs to the relevant Brand, Board, Canvas, Node, or Asset depending on the object being edited.

## Roles & Permissions Ownership

Workspace owns the permission system.

Permissions should be applied at levels:

```text
Workspace role
↓
Brand role
↓
Board role
↓
Object-level permissions where needed
```

Examples:

- Workspace Owner can manage billing and members.
- Brand Owner can approve Brand Brain changes.
- Brand Editor can edit Brand Core, AI Brain context, Knowledge, and Boards.
- Board Editor can edit one Campaign Board and its Canvas.
- Viewer can inspect but not modify.

Permissions must preserve the ownership hierarchy. A Board-level permission should not grant global Brand Brain authority unless explicitly defined.

## Billing Ownership

Billing belongs to Workspace.

Billing may be influenced by:

- Number of members.
- Number of Brands.
- AI usage.
- Storage usage.
- Deployment usage.
- Enterprise features.
- White-label features.
- Agency transfer workflows.

Billing should not become marketing knowledge. Billing state may limit or unlock product capability, but it should not store Brand truth.

## Settings Ownership

Workspace owns global settings:

- Workspace name
- Workspace language defaults
- Security preferences
- Billing preferences
- Default permissions
- Integration administration
- Notification defaults

Brand owns Brand-specific settings:

- Brand language
- Brand voice/tone defaults
- AI behavior preferences
- Brand guardrails
- Dashboard preference within Brand context
- Content output preferences
- Simulation defaults

Settings must not become hidden canonical knowledge unless the setting is explicitly part of Brand Brain or Brand Consciousness.

## Integrations Ownership

Integrations may be Workspace-administered but Brand-scoped in use.

Workspace may own:

- OAuth connection administration.
- API keys.
- Billing for integrations.
- Security policy.
- Integration availability.

Brand should own:

- Which connected data belongs to the Brand.
- Which sources feed Knowledge.
- Which deployment channels are active for the Brand.
- Which imported facts are accepted into Brand Brain.
- Which performance data informs Insights.

An integration must not mix unrelated Brand data unless explicitly configured and governed.

## Product Surface Ownership Under Brand

### Dashboard

Dashboard always represents one active Brand.

Dashboard summarizes what deserves attention for that Brand and routes users into Brand-owned or Board-owned workspaces. Dashboard never becomes global storage.

### Brand Core

Brand Core is the editing surface of the Brand.

Brand Core is where users edit and review Brand-level identity, voice, positioning, ICP, founder story, archetype, avatar, and other structured Brand inputs.

### Brand Brain

Brand Brain is the structured knowledge system inside the Brand.

Brand Brain stores approved strategic truth. It is not the same as raw Knowledge and should not be silently overwritten by campaigns, AI suggestions, imported documents, or analytics.

### AI Brain

AI Brain always reasons inside one Brand.

AI Brain belongs to Brand context and must not act globally across unrelated Brands.

### Insights

Insights belong to one Brand.

Insights observe Brand-specific campaign performance, behavior, patterns, learning, and opportunities. Accepted Insights may enrich Brand Consciousness and Brand Brain through governed flows.

### Boards

Boards belong to exactly one Brand.

Boards contain campaign work, not Brand identity.

### Content Workspace

Content Workspace belongs to one active Brand.

It may organize reusable and campaign-specific content, but must preserve whether an asset belongs to a Node, Board, or reusable Brand asset library.

### Simulation

Simulation belongs to one Brand.

Simulation tests assumptions against Brand-specific context, ICP, voice, objections, history, and strategy.

## Campaign Canvas, Nodes, and Assets

Campaign Canvas belongs to exactly one Board.

Nodes belong to exactly one Canvas.

Assets belong to Nodes by default.

Assets may later be promoted or copied into Brand-level reusable assets through explicit user action or governed workflow.

```text
Brand
↓
Board
↓
Campaign Canvas
↓
Node
↓
Asset
```

A Canvas without a Board is invalid in the target architecture.

A Board without a Brand is invalid in the target architecture.

An Asset without provenance is incomplete.

## Complete Ownership Hierarchy

```text
Workspace
├─ Members
├─ Billing
├─ Workspace Settings
├─ Integrations Administration
├─ Roles & Permissions
└─ Brands
   ├─ Dashboard
   ├─ Brand Core
   │  └─ Brand Brain
   ├─ Knowledge
   ├─ AI Brain
   ├─ Insights
   ├─ Content Workspace
   ├─ Simulation
   └─ Boards
      ├─ Board Metadata
      ├─ Activity
      ├─ Tasks
      ├─ Deployment State
      ├─ Campaign Canvas
      │  └─ Nodes
      │     └─ Assets
      └─ Board History
```

## Single-Company Model

A single-company customer may have one Workspace and one Brand.

```text
Company Workspace
↓
Company Brand
↓
Dashboard / Brand Core / AI Brain / Insights / Boards / Content / Simulation
```

This is the simplest model. Even here, the distinction matters:

- Workspace owns administration.
- Brand owns marketing intelligence.
- Boards are campaign containers.

## Agency Model

An agency Workspace may contain many client Brands.

```text
Agency Workspace
├─ Brand A
│  └─ Brand A Boards
├─ Brand B
│  └─ Brand B Boards
└─ Brand C
   └─ Brand C Boards
```

Agency members may work across multiple Brands, but each Brand's intelligence must remain isolated unless an explicit governed portfolio layer is introduced later.

AI Brain, Dashboard, Insights, Simulation, Boards, and Content Workspace must always indicate or derive the active Brand context.

## Client Handover Model

Client handover transfers a Brand from one Workspace to another.

```text
Agency Workspace
↓
Transfer Brand
↓
Client Workspace
```

The handover should move the complete Brand package:

- Brand Consciousness
- Brand Core
- Brand Brain
- Knowledge
- Research
- AI Brain memory
- Dashboard context
- Insights
- Simulation memory
- Boards
- Campaign Canvas data
- Nodes
- Assets
- Campaign history
- Deployment state
- Permissions mapping
- Audit history where appropriate

Handover should not transfer only boards or files. Boards have meaning because they belong to a Brand.

## Future Enterprise Model

Enterprise Workspaces may contain many Brands, sub-brands, regions, business units, or product lines.

```text
Enterprise Workspace
├─ Global Parent Brand
├─ Regional Brand
├─ Product Brand
└─ Campaign-specific Brand Variant
```

Future enterprise architecture may introduce:

- Parent/child Brand relationships.
- Brand inheritance.
- Regional permissions.
- Shared approved knowledge libraries.
- Governance workflows.
- Legal approval flows.
- Enterprise-wide integration administration.
- Portfolio Insights.

These extensions must not violate isolation rules. Shared knowledge must be explicit, governed, and traceable.

## Golden Rules

1. Workspace owns administration.
2. Workspace does not own marketing knowledge.
3. Brands own marketing intelligence.
4. Users always operate inside one active Brand for marketing work.
5. Dashboard always represents one active Brand.
6. Brand Core is the editing surface of the Brand.
7. Brand Brain is the structured knowledge system inside the Brand.
8. AI Brain always reasons inside one Brand.
9. Insights belong to one Brand.
10. Simulation belongs to one Brand.
11. Boards belong to exactly one Brand.
12. Campaign Canvas belongs to exactly one Board.
13. Nodes belong to exactly one Canvas.
14. Assets belong to Nodes unless explicitly promoted to Brand assets.
15. Campaign Canvas cannot be canonical Brand storage.
16. Boards cannot own Brand identity.
17. Global AI memory across unrelated Brands is forbidden.
18. Local sessions must not create ambiguous Brand or Board ownership.
19. Brand switching must switch all Brand-scoped surfaces.
20. Client handover transfers the Brand, not just boards.

## Anti-patterns

Reject these patterns:

- Workspace-level AI memory for unrelated Brands.
- Workspace-level Dashboard combining unrelated Brand priorities.
- Boards owning Brand Brain.
- Campaign Canvas existing without Brand context.
- Campaign Canvas existing without Board context.
- Nodes storing canonical Brand identity.
- Assets without Node, Board, or Brand provenance.
- Insights stored globally without Brand scope.
- Simulation memory shared across unrelated Brands.
- Integrations importing data into the wrong Brand.
- Brand switching that changes UI but not AI context.
- Local storage restoring editable Canvas without active Brand and Board.
- Client handover that exports boards but loses Brand intelligence.
- Permissions that grant Board editing and accidentally grant Brand ownership.

## Future Extension Principles

Future features must answer these questions before implementation:

1. Which Workspace owns administration for this feature?
2. Which Brand owns the marketing intelligence involved?
3. Does the user have an active Brand?
4. Does this feature require an active Board?
5. Does this feature create, read, update, or delete Brand knowledge?
6. Does it store canonical truth or only display/derive from it?
7. Does it need Brand-level, Board-level, Node-level, or Asset-level permissions?
8. Does it preserve provenance?
9. Can it leak data across Brands?
10. How does it behave during Brand transfer?

## Review Checklist

Before approving a product or engineering change, review:

- Is the active Workspace clear?
- Is the active Brand clear?
- Is the active Board clear if Canvas editing is involved?
- Does the feature write to the correct owner?
- Does the feature avoid duplicating Brand Brain, Knowledge, Insights, or AI memory?
- Does the feature preserve permissions boundaries?
- Does it work in a single-company Workspace?
- Does it work in an agency Workspace?
- Does it support future client handover?
- Does it avoid anonymous editable Canvas state?

## Decision Checklist

If any answer is "No," stop and redesign before implementation:

1. Can this feature identify its Workspace owner?
2. Can this feature identify its Brand owner?
3. Does the feature avoid global Brand knowledge?
4. Does the feature avoid global AI memory?
5. Does the feature avoid Board-owned Brand identity?
6. Does the feature avoid Canvas without Board context?
7. Does the feature avoid Board without Brand context?
8. Is the active Brand visible or recoverable from session/URL state?
9. Does save/load preserve ownership hierarchy?
10. Is client handover still possible without losing intelligence?

## Future Architecture Guidelines

- Prefer explicit ownership over inferred ownership.
- Prefer Brand-scoped context over Workspace-global context.
- Prefer Board-scoped campaign work over anonymous sessions.
- Prefer governed learning over silent memory mutation.
- Prefer scoped local cache over global local storage.
- Prefer transfer-ready Brand packages over disconnected exports.
- Prefer user-visible Brand switching over hidden context changes.
- Prefer permission layering over one flat role model.
- Prefer provenance-rich assets over detached files.
- Prefer architecture clarity over quick feature wiring.
