# Brand Consciousness Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Foundational Architecture |
| Owner | Product |
| Last Updated | 2026-06-27 |
| Scope | Product ownership model; documentation only |

## 1. Vision

Funklix is not a collection of Boards.

Funklix is a system for growing **Brand Consciousness**: the persistent, evolving intelligence of a Brand across strategy, knowledge, campaigns, AI collaboration, insights, simulations, assets, and learning.

Boards, Campaigns, Campaign Canvas, AI Brain, Insights, Simulation, Knowledge, and Dashboard do not exist as isolated products. They exist to enrich one living Brand Consciousness.

A Board is a workspace for campaign work.

A Campaign is an initiative.

A Canvas is a visual thinking surface.

A Node is a campaign object.

An Asset is an output.

The primary entity inside Funklix is none of these.

The primary entity is **Brand Consciousness**.

Brand Consciousness is what persists when campaigns end, when boards are archived, when assets are replaced, and when teams change. It is the shared understanding that lets humans and AI stop starting from zero.

## 2. Hierarchy

The canonical hierarchy is:

```text
Workspace
↓
Brand Consciousness
↓
Campaign Boards
↓
Campaign Canvas
↓
Nodes
↓
Assets
```

### Workspace

The Workspace is the administrative and organizational container. It owns people, permissions, billing, settings, and the list of Brand Consciousnesses available inside that organization.

### Brand Consciousness

Brand Consciousness is the primary intelligence container. It owns persistent brand identity, knowledge, memory, positioning, learning, and AI context.

### Campaign Boards

Campaign Boards are campaign-specific collaboration containers that belong to exactly one Brand Consciousness. They organize campaign work, history, deployment state, tasks, activity, and the Campaign Canvas.

### Campaign Canvas

Campaign Canvas is the visual creation workspace inside a Campaign Board. It represents campaign structure and relationships as visible, editable work.

### Nodes

Nodes are the smallest meaningful campaign objects on the Campaign Canvas. They may represent ideas, campaign variations, content, landing-page sections, emails, social posts, visual concepts, or other campaign units.

### Assets

Assets are campaign outputs and reusable materials created from or attached to Nodes. Assets may include copy, images, briefs, documents, visuals, exports, and deployment-ready creative.

## 3. Workspace

A Workspace owns the account-level and organization-level frame around the product.

Workspace owns:

- Members
- Billing
- Settings
- Permissions
- Brand Consciousnesses

Workspace does **not** own marketing knowledge.

Workspace-level settings may decide who can access or administer a Brand Consciousness, but the Workspace is not the source of brand truth. It should not store positioning, voice, ICP, founder story, campaign learnings, AI memory, or strategic marketing context as its own canonical knowledge.

A Workspace may contain one Brand Consciousness for a single-company team or many Brand Consciousnesses for an agency, portfolio, enterprise, or multi-brand organization.

## 4. Brand Consciousness

Brand Consciousness is the living identity of the Brand inside Funklix.

It is the persistent intelligence container that gathers, organizes, and evolves everything Funklix knows about a Brand.

Brand Consciousness owns:

- Brand Brain
- Knowledge
- Memory
- Positioning
- Voice
- Archetype
- Avatar
- ICP
- Founder Story
- Research
- Assets
- Campaign History
- Learning
- Simulation Memory
- Future AI Personality

Brand Consciousness is more than a profile and more than a database. It is the Brand's accumulated understanding: what the Brand believes, who it serves, how it speaks, what it has tried, what it has learned, and how its AI collaborators should reason.

Brand Consciousness is persistent. Campaigns are temporary expressions of it.

Brand Consciousness should be improved by:

- Approved Brand Brain edits.
- Curated research and imported knowledge.
- Accepted AI recommendations.
- Campaign outcomes and retrospectives.
- Human strategic decisions.
- Validated Insights.
- Simulation results that are accepted as useful learning.
- Asset approvals and rejected directions.

Brand Consciousness should never be silently overwritten by a single campaign, imported document, AI message, or analytics event. It evolves through governed learning.

## 5. Campaign Boards

Campaign Boards belong to exactly one Brand Consciousness.

Boards contain:

- Campaign Canvas
- Nodes
- Campaign Assets
- Activity
- Tasks
- Deployment State
- History

Boards never own Brand Identity.

A Board may contain campaign-specific strategy, status, work-in-progress, task-like node assignments, deployment state, and activity. It may reference Brand Consciousness constantly. It may feed learnings back into Brand Consciousness after review. But it must not become the permanent owner of positioning, voice, ICP, archetype, founder story, Brand Avatar, or AI memory.

Boards are containers for work. Brand Consciousness is the container for intelligence.

This means a Campaign Canvas should not exist as an anonymous long-lived object outside Brand context. If a Board is opened, edited, deployed, duplicated, or archived, the Brand Consciousness relationship must remain explicit.

## 6. AI

AI belongs to Brand Consciousness.

AI always reasons inside Brand context.

AI never acts globally.

Funklix AI should not be a generic assistant that happens to see campaign data. It should be a brand-aware collaborator that reasons from the active Brand Consciousness.

This means:

- AI Brain conversations should be scoped to one active Brand Consciousness.
- AI recommendations should cite or derive from Brand Consciousness, Knowledge, Campaign context, or Insights.
- AI memory should not be global across unrelated Brands.
- AI-generated campaign suggestions should enrich the Brand when accepted.
- AI should not modify Brand Consciousness permanently without governed approval.

In an agency workspace, AI for Brand A must not leak memory, tone, strategy, ICP, or campaign learnings from Brand B.

## 7. Dashboard

Dashboard belongs to the active Brand Consciousness.

Mission Control summarizes one Brand.

Dashboard never becomes global storage.

Dashboard should answer: "What deserves my attention today for this Brand?"

Dashboard may read from Brand Consciousness, Campaign Boards, Campaign status, Insights, AI Brain activity, Simulation outputs, Knowledge status, and Team activity. But Dashboard does not own canonical knowledge. It orchestrates attention and routes users into the owning workspace.

In a multi-brand Workspace, Dashboard must either:

- clearly show the active Brand Consciousness being summarized, or
- help the user select which Brand Consciousness they want to enter.

Dashboard should never merge unrelated Brands into one ambiguous briefing.

## 8. Knowledge Flow

The canonical knowledge flow is:

```text
Research
↓
Knowledge
↓
Brand Brain
↓
Campaign
↓
Learning
↓
Brand Consciousness evolves
```

### Research

Research includes market notes, customer interviews, competitor analysis, founder input, sales notes, documents, pitch decks, whitepapers, business plans, and other source material.

### Knowledge

Knowledge stores curated, reusable context with provenance. It distinguishes raw source material from accepted facts.

### Brand Brain

Brand Brain stores approved strategic truth: positioning, voice, ICP, messaging pillars, offers, objections, differentiators, archetype, avatar, and guardrails.

### Campaign

Campaigns apply Brand Brain and Knowledge to a specific initiative, audience, channel, message, asset set, and goal.

### Learning

Learning comes from human review, campaign outcomes, accepted Insights, Simulation feedback, asset decisions, and retrospective evaluation.

### Brand Consciousness evolves

Accepted learning updates the wider Brand Consciousness. The Brand becomes smarter over time.

## 9. Agency Model

Multiple Brand Consciousnesses may coexist inside one Workspace.

```text
Agency Workspace
↓
Brand A Consciousness
↓
Brand A Boards
```

```text
Agency Workspace
↓
Brand B Consciousness
↓
Brand B Boards
```

In this model, the agency owns administration, access, billing, and team structure. Each client Brand owns its own Brand Consciousness.

Brand A and Brand B may share the same agency team, but they must not share canonical Brand Brain, AI memory, ICP, positioning, campaign learning, or Simulation Memory unless an explicit future product model defines a governed shared portfolio insight layer.

Boards created for Brand A must stay attached to Brand A. Boards created for Brand B must stay attached to Brand B.

## 10. Transfer Model

Future ownership transfer should move Brand Consciousness as a complete intelligence package.

```text
Agency
↓
Transfer Brand Consciousness
↓
Client Workspace
```

Everything moves together:

- Knowledge
- Campaigns
- History
- AI Memory
- Brand Brain
- Research
- Assets
- Campaign Boards
- Campaign Canvas data
- Nodes
- Deployment records
- Accepted Insights
- Simulation Memory
- Permissions mapping where appropriate

Transfer should not copy only boards or files. It should transfer the Brand Consciousness that gives those boards meaning.

A transferred Brand should arrive in the Client Workspace with its intelligence intact and with clear ownership, permissions, audit history, and provenance.

## 11. Anti-patterns

Reject these patterns:

- Boards owning Brands.
- Global AI memory across unrelated Brands.
- Shared Brand Brain between unrelated Brands.
- Campaign Canvas existing without Brand context.
- Brand knowledge stored inside Campaigns as canonical truth.
- Dashboard storing Brand truth.
- Insights directly rewriting Brand Brain without approval.
- Simulation results becoming permanent truth without review.
- Imported documents silently overriding approved Brand positioning.
- Task systems becoming a second Board or Campaign ownership layer.
- Assets becoming the only memory of why a campaign decision was made.
- Agency-wide defaults leaking into client-specific Brand Consciousness.

## 12. Golden Rules

1. Brand Consciousness is the primary intelligence container in Funklix.
2. Every Campaign Board belongs to exactly one Brand Consciousness.
3. A Workspace may own multiple Brand Consciousnesses.
4. Workspace owns administration; Brand Consciousness owns marketing intelligence.
5. Campaign Canvas never exists without Brand context.
6. Nodes belong to Campaign Boards and derive strategic context from Brand Consciousness.
7. Assets belong to the Board or Brand Consciousness depending on whether they are campaign-specific or reusable Brand material.
8. AI always reasons inside the active Brand Consciousness.
9. AI memory must never be global across unrelated Brands.
10. Dashboard summarizes the active Brand Consciousness; it does not store canonical truth.
11. Insights observe and validate; accepted learning enriches Brand Consciousness.
12. Simulation tests assumptions; accepted simulation learning strengthens Brand Consciousness.
13. Campaigns are temporary expressions of Brand Consciousness.
14. Boards are temporary work containers; Brand Consciousness is persistent.
15. Knowledge compounds over time and must preserve provenance.
16. Brand Identity must not be owned by Boards, Campaigns, Nodes, or Assets.
17. Transfer moves Brand Consciousness, not just files or boards.
18. Multi-brand Workspaces require strict Brand Consciousness isolation.

## 13. Future Features

This architecture enables future product areas to scale without ownership confusion.

### Dashboard

Dashboard can become Mission Control for the active Brand Consciousness, showing what deserves attention today for one Brand.

### AI Brain

AI Brain can become a strategic collaborator whose memory, tone, recommendations, and reasoning are scoped to Brand Consciousness.

### Insights

Insights can observe campaign patterns and feed accepted learnings back into Brand Consciousness.

### Simulation

Simulation can test assumptions against the Brand's ICP, voice, history, and strategic context, then contribute accepted learning.

### Deployments

Deployments can attach performance and status to Campaign Boards while feeding outcomes into Brand Consciousness.

### Tasks

Tasks can remain board/node-derived while the task priority is informed by Brand Consciousness and campaign importance.

### Version History

Version history can track how Brand Consciousness changes over time, including who approved a learning and why.

### Permissions

Permissions can separate Workspace administration from Brand Consciousness ownership and Board-level collaboration.

### Multi-brand Workspaces

Agencies and enterprises can manage multiple Brands without mixing memory, strategy, or AI behavior.

### Enterprise

Enterprise organizations can govern Brand Consciousness across teams, regions, products, or sub-brands with clear isolation and transfer rules.

### Agency

Agencies can operate many client Brand Consciousnesses in one Workspace while preserving strict client boundaries.

### White-label

White-label deployments can transfer or expose a Brand Consciousness to a client-facing Workspace without losing history or intelligence.

### Subscriptions

Subscriptions and billing can attach to Workspace administration while product value compounds inside Brand Consciousness.
