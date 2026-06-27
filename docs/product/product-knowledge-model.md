# Funklix Product Knowledge Model

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Foundational Ownership Model |
| Owner | Product |
| Last Updated | 2026-06-27 |

## Purpose

The Product Intelligence Architecture defines what Funklix is as an intelligent system.

This Product Knowledge Model defines where knowledge lives, who owns it, who may change it, who may create or delete it, and which product areas may only read or display it.

This is the canonical ownership model for major Funklix product objects. Future features should use it before introducing memory, agents, dashboards, integrations, simulations, recommendations, or new data surfaces.

## Core Rule

Every meaningful piece of product knowledge should have exactly one owning object.

Everything else references, reads, reasons over, displays, or learns from that object. Duplicate ownership creates drift, conflicting AI behavior, unclear approvals, and unreliable collaboration.

## Ownership Model

### Brand Brain

**Purpose**

The Brand Brain is the persistent source of strategic brand truth.

**Owner**

Brand workspace / approved human brand owners.

**Can Read**

Dashboard, AI Brain, Campaign Canvas, Campaigns, Nodes, Insights, Simulation, Knowledge, Wizard, Agents, Integrations, Team members with access.

**Can Modify**

Humans with brand ownership; guided Brand workflows; approved learning flows that require human confirmation.

**Can Create**

Wizard/onboarding, Brand setup, explicit Brand Brain creation flows.

**Can Delete**

Brand owners only, with explicit confirmation and governance.

**Can Learn From**

Approved campaign outcomes, human edits, accepted insights, imported knowledge, simulation learnings, team decisions, performance evidence.

**Information that belongs here**

- Mission
- Vision
- Positioning
- Voice
- Tone
- ICP
- Personas
- Offers
- Messaging pillars
- Differentiators
- Objections
- Approved strategic decisions
- Brand guardrails
- Accepted learning that changes brand direction

**Must Never Own**

- Temporary chat messages
- Raw imported files
- Unapproved insights
- Dashboard layout state
- Campaign-specific execution details
- Simulation drafts
- Analytics event streams

### Knowledge

**Purpose**

Knowledge stores imported, curated, and reusable factual context that supports Brand Brain and AI work.

**Owner**

Knowledge workspace / content librarians / approved team maintainers.

**Can Read**

Brand Brain, AI Brain, Campaigns, Campaign Canvas, Insights, Simulation, Dashboard, Wizard, Agents, Integrations.

**Can Modify**

Humans with knowledge permission; ingestion workflows that preserve provenance; review workflows that classify raw vs accepted knowledge.

**Can Create**

Imports, integrations, uploads, research capture, meeting notes, accepted learning records.

**Can Delete**

Knowledge owners or admins, with retention rules where appropriate.

**Can Learn From**

Uploaded documents, customer research, campaign retrospectives, sales notes, support notes, market research, team decisions.

**Information that belongs here**

- Imported facts
- Research documents
- Meeting notes
- Customer quotes
- Market context
- Competitive notes
- Source material
- Approved reusable references
- Provenance and freshness metadata

**Must Never Own**

- Final Brand truth that belongs in Brand Brain
- Campaign execution state
- Dashboard state
- AI conversation state
- Raw analytics metrics without interpretation ownership

### Campaign

**Purpose**

A Campaign groups campaign-specific strategy, decisions, assets, status, and outcomes.

**Owner**

Campaign owner / campaign team.

**Can Read**

Brand Brain, Knowledge, Campaign Canvas, Nodes, AI Brain recommendations, Insights, Team activity.

**Can Modify**

Campaign owners, collaborators with edit access, approved campaign workflows.

**Can Create**

Campaign creation flows, Campaign Generator, Wizard, authorized campaign templates.

**Can Delete**

Campaign owners or admins according to board/workspace permissions.

**Can Learn From**

Performance, approvals, human edits, reviews, simulation outcomes, insights, asset outcomes.

**Information that belongs here**

- Campaign objective
- Campaign audience selection
- Campaign-specific message choices
- Campaign timeline
- Campaign status
- Campaign review decisions
- Campaign-specific assumptions
- Outcome summaries

**Must Never Own**

- Global brand positioning
- Global voice and tone
- Imported knowledge library
- Cross-campaign analytics truth
- Dashboard orchestration state

### Campaign Canvas

**Purpose**

Campaign Canvas is the visual workspace where campaign relationships become visible and editable.

**Owner**

Campaign Canvas / board workspace.

**Can Read**

Brand Brain, Campaign, Nodes, Assets, AI Brain advice, Team activity.

**Can Modify**

Users with board/campaign edit access; collaboration flows; approved AI-assisted editing flows.

**Can Create**

Nodes, connections, layout relationships, canvas annotations, campaign structure.

**Can Delete**

Canvas editors for canvas-owned objects, subject to permissions and recovery rules.

**Can Learn From**

Human edits, accepted node changes, collaboration patterns, completed campaign structures.

**Information that belongs here**

- Node relationships
- Canvas layout
- Visual structure
- Connection metadata
- Workspace-specific collaboration context

**Must Never Own**

- Brand Brain truth
- Knowledge library facts
- Insights metrics
- Dashboard summaries
- AI Brain memory
- Team identity

### Node

**Purpose**

A Node is the smallest meaningful campaign object on the Campaign Canvas.

**Owner**

Campaign Canvas / Campaign, with node-level owners where assigned.

**Can Read**

Brand Brain, Campaign context, parent/child Nodes, Assets, AI Brain advice.

**Can Modify**

Canvas editors, node owners, approved AI refinement flows, image/action flows tied to the node.

**Can Create**

Canvas creation, Campaign Generator, AI next-step generation, manual user actions.

**Can Delete**

Canvas editors with permission.

**Can Learn From**

Human edits, reviews, variants, generated assets, comments, selected/favorite assets, performance after execution.

**Information that belongs here**

- Node type
- Title
- Content
- Status
- Owner
- Node-specific prompt context
- Node-specific assets
- Node relationships
- Node comments or review state

**Must Never Own**

- Global brand truth
- Imported knowledge library
- Product-wide insight definitions
- AI Brain conversation memory
- Team membership

### Dashboard

**Purpose**

Dashboard is Mission Control. It displays and routes attention.

**Owner**

Home/Dashboard surface owns presentation and orchestration only.

**Can Read**

Brand Brain, Campaigns, Boards, Insights, AI Brain activity, Team activity, Simulation outcomes, Knowledge status.

**Can Modify**

Dashboard layout preferences and presentation settings only.

**Can Create**

Quick-action intents that route users into owning workflows. It does not create domain knowledge directly.

**Can Delete**

Dashboard display preferences only.

**Can Learn From**

Navigation patterns and attention signals, if governed as product telemetry.

**Information that belongs here**

- Attention queues
- Display configuration
- Summaries sourced from owning objects
- Quick-action entrypoints
- Read-only status cards

**Must Never Own**

- Brand truth
- Campaign logic
- Board ownership
- AI conversations
- Insights calculations
- Simulation scenarios
- Knowledge records

### AI Brain

**Purpose**

AI Brain reasons over product knowledge and helps humans decide.

**Owner**

AI Brain workspace / AI reasoning layer.

**Can Read**

Brand Brain, Knowledge, Campaigns, Campaign Canvas, Nodes, Insights, Simulation outputs, Team decisions.

**Can Modify**

AI Brain conversation state, drafts, recommendations, review notes, proposed changes.

**Can Create**

Advice, recommendations, critiques, draft plans, strategic alternatives, review summaries, proposed knowledge updates.

**Can Delete**

AI Brain-owned drafts/conversation artifacts according to retention rules.

**Can Learn From**

Accepted recommendations, rejected recommendations, human edits, campaign results, insights, simulation outcomes.

**Information that belongs here**

- Conversation context
- Reasoning artifacts
- Recommendations
- Strategic critiques
- Proposed updates
- Review notes
- Decision-support summaries

**Must Never Own**

- Brand Brain truth
- Knowledge records
- Insights facts
- Campaign execution state
- Permanent strategic changes without human approval

### Insights

**Purpose**

Insights observes facts, signals, metrics, and changes.

**Owner**

Insights / analytics layer.

**Can Read**

Campaigns, Assets, performance sources, Brand Brain, Knowledge, Team activity, historical outcomes.

**Can Modify**

Insight records, diagnostics, metric summaries, signal classifications, trend observations.

**Can Create**

Observations, metrics, alerts, diagnostics, trend records, evidence summaries.

**Can Delete**

Insights owners/admins according to data retention rules.

**Can Learn From**

Performance metrics, campaign outcomes, content results, behavior signals, team feedback on insight usefulness.

**Information that belongs here**

- Facts
- Metrics
- Signals
- Trends
- Changes
- Diagnostics
- Evidence-backed observations

**Must Never Own**

- Strategy recommendations as final decisions
- Brand Brain edits
- AI conversation state
- Campaign Canvas layout
- Simulation drafts

### Simulation

**Purpose**

Simulation tests assumptions before execution using temporary scenarios.

**Owner**

Simulation engine / experiment workspace.

**Can Read**

Brand Brain, Knowledge, Campaigns, Nodes, Assets, AI Brain prompts, selected audience/persona context.

**Can Modify**

Simulation scenarios, temporary personas, test results, experiment notes.

**Can Create**

Scenario runs, simulated objections, persona responses, landing-page reviews, funnel tests, sales-call simulations.

**Can Delete**

Simulation owners or users with experiment permission.

**Can Learn From**

Simulation results, user ratings, follow-up performance comparisons, accepted experiment learnings.

**Information that belongs here**

- Temporary scenarios
- Test assumptions
- Simulated responses
- Experiment outputs
- Confidence notes
- Follow-up questions

**Must Never Own**

- Permanent Brand Brain truth
- Final campaign execution state
- Real performance metrics
- Team identity
- Knowledge library source material

### Team

**Purpose**

Team represents human collaboration, roles, ownership, approvals, and accountability.

**Owner**

Organization/team administration.

**Can Read**

Boards, Campaigns, activity, assignments, decisions, comments, approvals, relevant Brand Brain access policy.

**Can Modify**

Membership, roles, permissions, assignments, approvals, team preferences.

**Can Create**

Members, roles, permissions, comments, approval records, ownership assignments.

**Can Delete**

Admins or authorized owners according to organization policy.

**Can Learn From**

Collaboration patterns, approval bottlenecks, ownership history, feedback loops.

**Information that belongs here**

- Users
- Roles
- Permissions
- Ownership
- Approvals
- Team feedback
- Decision attribution
- Collaboration state

**Must Never Own**

- Brand truth
- Campaign content
- Insight calculations
- AI recommendations
- Simulation scenarios

### Assets

**Purpose**

Assets store reusable and campaign-specific media or content outputs.

**Owner**

Asset library / Campaign or Node when asset is campaign-specific.

**Can Read**

Campaigns, Nodes, Brand Brain, AI Brain, Dashboard, Insights, Simulation, Content Library.

**Can Modify**

Asset owners, campaign editors, approved asset workflows.

**Can Create**

Uploads, generated images, generated copy, exported content, approved reusable assets.

**Can Delete**

Asset owners, campaign editors, or admins according to retention and permissions.

**Can Learn From**

Asset usage, approvals, performance, human edits, favorites, reuse patterns.

**Information that belongs here**

- Images
- Copy assets
- Files
- Exported content
- Asset metadata
- Usage context
- Favorite/approved state

**Must Never Own**

- Brand strategy
- Campaign strategy
- Analytics truth
- AI Brain memory
- Team permissions

### Brand Avatar

**Purpose**

Brand Avatar is a symbolic or visual representation of brand identity.

**Owner**

Brand Brain / Brand workspace.

**Can Read**

Dashboard, AI Brain, Campaigns, Campaign Canvas, Assets, Simulation, Wizard.

**Can Modify**

Brand owners through Brand workflows.

**Can Create**

Brand setup, Brand DNA workflows, approved avatar generation flows.

**Can Delete**

Brand owners only.

**Can Learn From**

Accepted Brand DNA, human preference, visual feedback, campaign usage.

**Information that belongs here**

- Avatar image
- Avatar prompt
- Symbolic identity notes
- Visual direction metadata
- Approval state

**Must Never Own**

- Campaign-specific assets
- Full visual asset library
- Unapproved image experiments
- Dashboard decoration state

### Archetype

**Purpose**

Archetype defines a high-level brand character model used to guide voice, visuals, and strategic consistency.

**Owner**

Brand Brain / Brand workspace.

**Can Read**

AI Brain, Campaigns, Campaign Canvas, Simulation, Dashboard, Wizard, Content Library.

**Can Modify**

Brand owners through explicit Brand workflows.

**Can Create**

Wizard, Brand setup, Brand DNA workflows.

**Can Delete**

Brand owners only, usually by replacing or archiving the archetype.

**Can Learn From**

Brand strategy decisions, voice approvals, campaign performance, human feedback.

**Information that belongs here**

- Archetype selection
- Archetype rationale
- Voice implications
- Visual implications
- Messaging implications
- Approval state

**Must Never Own**

- Campaign-specific creative decisions
- Temporary simulation personas
- Imported source documents
- Insight metrics

### Content Library (future)

**Purpose**

The Content Library will organize approved and reusable content outputs across campaigns.

**Owner**

Content Library / content operations.

**Can Read**

Brand Brain, Campaigns, Nodes, Assets, Insights, AI Brain, Knowledge.

**Can Modify**

Content owners, editors, approved publishing/library workflows.

**Can Create**

Approved campaign outputs, reusable posts, landing sections, email snippets, ads, case examples, templates.

**Can Delete**

Content owners or admins according to retention rules.

**Can Learn From**

Performance, reuse, approvals, edits, audience response, content freshness.

**Information that belongs here**

- Approved content
- Reusable copy
- Templates
- Campaign examples
- Publishing metadata
- Performance-linked content references

**Must Never Own**

- Brand truth
- Raw imported research
- AI conversation history
- Dashboard state
- Unapproved drafts unless explicitly marked as drafts

## Relationship Model

### Brand Brain owns

- Mission
- Vision
- Positioning
- Voice
- Tone
- ICP
- Personas
- Offers
- Messaging pillars
- Brand Avatar
- Archetype
- Approved strategic decisions

### Knowledge owns

- Imported facts
- Research sources
- Customer evidence
- Market context
- Source provenance
- Reusable references that are not yet Brand truth

### Campaign owns

- Campaign-specific decisions
- Campaign objectives
- Campaign status
- Campaign assumptions
- Campaign outcome summaries

### Campaign Canvas owns

- Visual layout
- Node relationships
- Canvas structure
- Collaboration context inside the workspace

### Node owns

- Node-level content
- Node metadata
- Node-specific assets
- Node status
- Node relationships within a campaign context

### Dashboard owns

Nothing strategic.

Dashboard owns presentation state and attention orchestration only. It reads from other objects and routes users into owning workflows.

### AI Brain owns

No canonical knowledge.

AI Brain owns reasoning artifacts, conversations, recommendations, critiques, and proposed changes. It reasons over knowledge; it does not become storage.

### Insights owns

Observed facts, metrics, signals, diagnostics, and trend records.

Insights does not own strategic decisions and does not directly edit Brand Brain.

### Simulation owns

Temporary scenarios, assumptions, simulated responses, and experiment outputs.

Simulation does not permanently modify campaigns or Brand Brain without an explicit accepted-learning flow.

### Team owns

People, roles, permissions, ownership, approvals, and decision attribution.

### Assets owns

Media/content files and asset metadata, unless the asset is explicitly promoted into Content Library or Brand Avatar.

### Content Library owns

Approved reusable content outputs and templates.

## Read / Write Matrix

| Object | Reads | Writes | Learns | Displays |
|---|---|---|---|---|
| Brand Brain | Knowledge, approved Insights, Campaign outcomes, Team decisions, Simulation learnings | Brand truth, positioning, voice, ICP, offers, decisions, Avatar, Archetype | Human approvals, accepted learning, performance evidence | Brand status, guardrails, source-of-truth summaries |
| Knowledge | Imports, research, customer evidence, campaign retrospectives, integrations | Curated facts, source material, provenance, reusable references | Imported facts, validated notes, research updates | Knowledge records, source context, freshness |
| Campaign | Brand Brain, Knowledge, Nodes, Assets, AI Brain, Insights | Campaign objective, decisions, status, campaign-specific assumptions | Outcomes, reviews, human edits, performance | Campaign summary, status, risks, history |
| Campaign Canvas | Brand Brain, Campaign, Nodes, Assets, Team activity | Layout, connections, visual structure, canvas collaboration state | Editing patterns, accepted structure, collaboration history | Canvas, relationships, workspace context |
| Node | Brand Brain, Campaign context, connected Nodes, Assets, AI suggestions | Node content, metadata, status, owner, node assets | Edits, reviews, selected variants, asset performance | Node card, Inspector fields, comments, status |
| Dashboard | Brand Brain, Campaigns, Boards, Insights, AI Brain, Simulation, Team activity | Presentation preferences and quick-action routing only | Attention and navigation signals, if governed | Mission control summaries, alerts, quick actions |
| AI Brain | Brand Brain, Knowledge, Campaigns, Nodes, Insights, Simulation, Team decisions | Conversations, recommendations, critiques, proposed changes | Accepted/rejected recommendations, outcomes, edits | Advice, reasoning, strategic options |
| Insights | Campaigns, Assets, performance sources, Team activity, historical outcomes | Facts, metrics, diagnostics, signals, trend observations | Performance, content outcomes, feedback on usefulness | Charts, alerts, observations, evidence |
| Simulation | Brand Brain, Knowledge, Campaigns, Nodes, Assets, AI prompts | Temporary scenarios, simulated responses, experiment notes | User ratings, follow-up outcomes, validated assumptions | Scenario results, objections, confidence notes |
| Team | Users, boards, campaigns, assignments, approvals | Members, roles, permissions, ownership, comments, approvals | Collaboration patterns, approval bottlenecks | Presence, ownership, activity, approvals |
| Assets | Uploads, generated media, campaign context, Brand Brain | Files, asset metadata, approval/favorite state, usage context | Usage, edits, performance, reuse | Thumbnails, previews, downloadable/openable assets |
| Brand Avatar | Brand Brain, Brand DNA, human visual preferences | Avatar image, prompt, symbolic identity metadata | Approved visual direction, campaign usage feedback | Avatar preview, brand identity summary |
| Archetype | Brand strategy, voice feedback, campaign performance | Archetype choice, rationale, implications, approval state | Voice approvals, strategic feedback, performance patterns | Archetype summary, guidance, guardrails |
| Content Library (future) | Brand Brain, Campaigns, Nodes, Assets, Insights, Knowledge | Approved content, templates, publishing metadata, reusable examples | Performance, reuse, edits, freshness | Library items, templates, examples, content history |

## Learning Loop

```text
Human Decision
    ↓
Brand Brain
    ↓
AI Brain
    ↓
Campaign
    ↓
Campaign Canvas / Nodes / Assets
    ↓
Performance and Team Feedback
    ↓
Insights
    ↓
Knowledge
    ↓
Accepted Learning
    ↓
Brand Brain
```

### How intelligence compounds

1. Humans approve strategic direction in Brand Brain.
2. AI Brain reasons from Brand Brain and Knowledge.
3. Campaigns apply that intelligence to specific goals.
4. Canvas, Nodes, and Assets make the work visible and executable.
5. Performance and team feedback create evidence.
6. Insights observes patterns and separates signal from noise.
7. Knowledge stores source material, retrospectives, and contextual evidence.
8. Humans accept or reject strategic learning.
9. Accepted learning updates Brand Brain.
10. Future AI behavior improves because the system now has better context.

## Anti-Patterns

- Dashboard storing Brand knowledge.
- Dashboard calculating domain truth directly.
- AI Brain becoming another database.
- AI Brain silently overwriting strategic knowledge.
- Insights editing Brand Brain directly.
- Insights presenting speculative strategy as fact.
- Simulation permanently modifying campaigns without approval.
- Campaign Canvas owning global Brand truth.
- Nodes hiding product-wide business logic.
- Assets becoming the source of campaign strategy.
- Content Library duplicating Brand Brain.
- Knowledge becoming an uncurated dumping ground.
- Multiple objects owning the same fact.
- Multiple sources of truth for the same strategic decision.
- Imported data replacing accepted Brand truth without review.

## Golden Rules

1. Every piece of knowledge has exactly one owner.
2. Everything else references the owner.
3. Brand Brain owns strategic truth.
4. Knowledge owns imported and curated facts.
5. Campaign owns campaign-specific decisions.
6. Dashboard never owns domain knowledge.
7. AI Brain reasons; it does not become storage.
8. Insights observes; it does not decide strategy.
9. Simulation experiments; it does not permanently change truth.
10. Humans approve strategic changes.
11. AI never silently overwrites Brand Brain.
12. Duplicate ownership is a product bug.
13. Raw evidence and accepted truth must stay distinguishable.
14. Learning should be traceable to source, decision, or outcome.
15. Product surfaces should make ownership clear to users.

## Future Guidance

### Dashboard 2.0

Dashboard should remain read-only for domain knowledge. It may display summaries, alerts, and quick actions, but owning workflows must handle changes.

### AI Brain 2.0

AI Brain should improve reasoning, memory of conversations, and recommendation quality without becoming the canonical store for Brand, Campaign, or Insight data.

### Insights

Insights should focus on observed facts, diagnostics, trends, and evidence. Strategic recommendations should be routed through AI Brain or explicit decision workflows.

### Wizard

Wizard should create and enrich Brand Brain, Knowledge, Campaign, Simulation, and Content Library objects through owning workflows rather than storing onboarding data separately.

### Memory

Memory must distinguish raw observations, proposed learnings, and accepted knowledge. Strategic memory should require human approval before becoming Brand Brain truth.

### Agents

Agents should operate within explicit permissions. Each agent must know what it can read, what it can propose, and what it can write. Agents should never create hidden sources of truth.

### Integrations

Integrations should write imported facts to Knowledge or performance data to Insights. They should not directly mutate Brand Brain unless a governed acceptance flow exists.

### Content Library

Content Library should store approved reusable content and templates. It should read Brand Brain and campaign performance, but it must not become the owner of brand strategy.

## Review Checklist for Future Features

Before implementing a major feature, answer:

1. Which object owns the knowledge?
2. Which objects only read it?
3. Which users or systems may modify it?
4. Can AI propose changes, or can it write directly?
5. Is human approval required?
6. Does this duplicate an existing source of truth?
7. Does it preserve Dashboard, AI Brain, Insights, and Simulation boundaries?
8. Does it strengthen the learning loop?
9. Is the learning traceable?
10. Does the feature need an ADR before implementation?
