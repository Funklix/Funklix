# Marketing Knowledge Graph Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Canonical Conceptual Architecture |
| Owner | Product |
| Last Updated | 2026-07-06 |
| Scope | Product concepts and ownership language; documentation only |

## Purpose

The Marketing Knowledge Graph is the conceptual structure that turns Funklix from a canvas tool into a Marketing Operating System.

It exists because marketing work is not a flat collection of documents, tasks, prompts, or creative assets. Marketing work is made of connected decisions, messages, audiences, channels, offers, proof points, experiments, assets, results, and learning. A team needs to understand not only what exists, but also how each piece affects the others.

The Marketing Knowledge Graph gives Funklix a shared language for those connections.

It answers:

- What does this campaign object mean?
- What influenced it?
- What depends on it?
- What does it unlock?
- Where does it sit in the customer journey?
- What evidence supports it?
- What did it teach the Brand?
- What should humans and AI focus on next?

## How It Differs From a Whiteboard

A whiteboard can show visual proximity, arrows, and clusters. It is useful for brainstorming, but it does not necessarily preserve durable marketing meaning.

The Marketing Knowledge Graph is not merely a drawing surface. It is a structured conceptual model for campaign knowledge.

A whiteboard can say: “these blocks are near each other.”

The Marketing Knowledge Graph can eventually say:

- this offer supports this landing page;
- this landing page feeds this email sequence;
- this social proof asset reduces friction at this decision point;
- this campaign path is blocked because an upstream node needs review;
- this result should inform future campaign decisions.

## How It Differs From a Project Management Tool

A project management tool tracks work assignment, dates, checklists, and completion.

The Marketing Knowledge Graph tracks marketing meaning.

It can include work state, ownership, and status, but those are not the whole graph. The graph should explain why a node matters, how campaign assets relate, what customer path they support, what decision they express, and what learning they produce.

A project management tool asks: “Who owns this task, and when is it due?”

The Marketing Knowledge Graph asks: “What marketing idea, asset, decision, evidence, or customer movement does this node represent, and how does it affect the rest of the campaign?”

## Core Hierarchy

The canonical hierarchy is:

```text
Workspace
↓
Brand
↓
Campaign Board
↓
Campaign Canvas
↓
Marketing Knowledge Graph
↓
Nodes
↓
Relationships
↓
Assets
```

### Workspace

Workspace administers Brands. It owns people, permissions, billing, settings, and organizational boundaries. It does not own marketing meaning.

### Brand

Brand owns the Marketing Knowledge Graph. Brand is the active marketing context that gives campaign work meaning through positioning, voice, audience, offers, history, learning, and intelligence.

### Campaign Board

A Campaign Board is the collaboration container for a campaign initiative inside one Brand. It organizes campaign work and provides the board-level context in which a Campaign Canvas operates.

### Campaign Canvas

Campaign Canvas is the visual workspace where humans and AI can create, inspect, arrange, connect, and review graph objects. Canvas is how users interact with the graph; it is not the complete definition of the graph.

### Marketing Knowledge Graph

The Marketing Knowledge Graph is the conceptual network of campaign knowledge represented by nodes, relationships, paths, decisions, assets, outcomes, and learning.

### Nodes

Nodes are the meaningful units inside the graph.

### Relationships

Relationships create meaning between nodes.

### Assets

Assets are outputs produced by or attached to nodes. They may become reusable Brand assets only through an explicit promotion or learning path.

## Node

A Node is the smallest meaningful marketing object in the graph.

A Node may represent:

- an idea;
- a campaign variation;
- a strategic message;
- an audience segment;
- a landing page;
- an email;
- a social post;
- an offer;
- a proof point;
- a creative brief;
- an image concept;
- a decision;
- an experiment;
- an insight;
- a reusable asset candidate.

A Node is not merely a visual block. It represents knowledge, work, decisions, or marketing assets that can influence the rest of the campaign.

Nodes may carry content, metadata, status, ownership, assets, review state, comments, performance evidence, and learning over time. Not all nodes need all fields. A Node should remain meaningful even before runtime systems attach richer semantics.

## Relationship

A Relationship expresses how two graph objects relate.

Relationships may eventually express:

- flow;
- influence;
- dependency;
- sequence;
- variation;
- evidence;
- audience fit;
- channel fit;
- offer support;
- creative derivation;
- experiment lineage;
- deployment path;
- learning feedback.

Relationships are not merely lines. A line may be the visual expression of a relationship, but the relationship is the marketing meaning between objects.

Current runtime edges are implementation details. They are useful graph signals, but they are not yet canonical semantic relationships. Semantic relationships come later, after explicit product design, migration strategy, metadata design, and user-facing meaning are defined.

Until then, relationship intelligence should treat current edges as conservative graph relationships, not hard business dependencies.

## Campaign Path

A Campaign Path is an ordered graph route through campaign nodes and relationships.

Example:

```text
Idea
↓
Campaign Variation
↓
Landing Page
↓
Email
↓
Retargeting
↓
Offer
↓
Purchase
```

Campaign Paths are graph concepts. They represent how a campaign idea may become a sequence of strategy, content, assets, channels, offers, decisions, and customer actions.

A Campaign Path may be linear, branched, circular through learning, or split into variants. It should not be reduced to a simple task list. The path matters because it reveals what must be understood, reviewed, tested, launched, measured, and learned.

## Journey

A Journey describes how a customer, buyer, persona, or audience segment moves through campaign paths.

A Journey may traverse:

- awareness content;
- social posts;
- landing pages;
- lead magnets;
- email sequences;
- sales pages;
- offers;
- retargeting assets;
- objections;
- proof points;
- purchase or conversion actions.

Journeys are needed for the future Funnel Simulator because simulation should not evaluate isolated assets only. It should simulate movement through graph paths: what the customer sees, what they believe, where they hesitate, which message answers an objection, and what might move them forward.

## Decision Point

A Decision Point is a node or relationship moment where the campaign can branch, narrow, choose, test, or commit.

Decision Point examples:

- audience split;
- offer selection;
- channel choice;
- landing page variant;
- messaging angle;
- CTA selection;
- budget allocation;
- creative direction;
- proof point selection;
- funnel step priority.

Decision Points are important because marketing strategy is made of choices. The graph should preserve the choices, alternatives, rationale, evidence, and downstream impact.

Decision Points may later become first-class Decision Nodes, relationship labels, experiment structures, or approval gates. This document defines the concept only.

## Bottleneck

A Bottleneck is a graph condition where progress, clarity, review, performance, or learning is constrained by one or more nodes or relationships.

Bottlenecks emerge from relationships. They do not emerge from AI by default.

Examples:

- several downstream assets depend on an unfinished landing page;
- multiple campaign paths converge on an offer that has not been approved;
- a Journey reaches a missing proof point;
- variants cannot be compared because they lack shared goals;
- a funnel path has many assets but no clear conversion action.

AI may help detect, explain, or prioritize bottlenecks, but AI does not create the bottleneck. The graph structure, node status, evidence, and outcomes create the condition.

## Unlock

An Unlock is the positive counterpart to a bottleneck. It is a graph condition where completing, approving, connecting, validating, or learning from one object enables downstream progress.

Examples:

- approving one Landing Page unlocks several downstream email and retargeting assets;
- selecting an offer unlocks the final CTA across multiple paths;
- validating an audience angle unlocks future variants;
- adding a proof point unlocks trust-building sections across a funnel;
- approving a Brand voice direction unlocks consistent creative generation.

Unlocks should be deterministic and explainable. They should not imply guaranteed performance, conversion, or ROI without evidence.

## Root Nodes

Root Nodes are graph entry points. They have no upstream relationship within a given graph view.

Root Nodes may represent:

- campaign ideas;
- campaign goals;
- strategic briefs;
- audience hypotheses;
- offers;
- starting assumptions;
- top-level decisions.

A Root Node is not automatically the most important node. It is the visible starting point for one path or graph region.

## Leaf Nodes

Leaf Nodes are graph endpoints. They have no downstream relationship within a given graph view.

Leaf Nodes may represent:

- final campaign assets;
- deployment-ready outputs;
- experiments waiting for results;
- terminal offers;
- conversion actions;
- unresolved loose ends.

A Leaf Node is not automatically complete or ready. It is simply an endpoint in the current graph structure.

## Campaign Health

Campaign Health should eventually derive from graph structure and node status.

It should not be arbitrary scoring.

Graph-aware Campaign Health may consider:

- node status distribution;
- path completion;
- review bottlenecks;
- root-to-leaf coverage;
- disconnected or orphaned nodes;
- missing Journey steps;
- unresolved Decision Points;
- incomplete downstream assets;
- evidence coverage;
- deployment readiness when deployment data exists;
- learning completeness after outcomes exist.

Campaign Health should remain explainable. If a campaign is marked healthy or at risk, the product should be able to show which nodes, relationships, paths, statuses, or evidence produced that conclusion.

## Mission Control

Mission Control should summarize the graph.

It should not become its own knowledge source.

Mission Control may show:

- the active Brand context;
- current campaign focus;
- graph health;
- bottlenecks;
- unlocks;
- review needs;
- incomplete paths;
- suggested next actions;
- recent team activity;
- relevant insights.

Mission Control should route users back to the owning graph objects. It should not duplicate, invent, or permanently store graph truth.

## AI Brain

AI Brain reasons over the graph.

It does not replace the graph.

AI Brain should use the Marketing Knowledge Graph to understand context, relationships, decisions, paths, status, Brand constraints, and evidence. It can help explain risks, suggest next steps, compare variants, critique assets, and identify missing context.

AI Brain should not become the source of truth for graph structure, Brand truth, approvals, analytics, or decisions. Human-approved objects and governed product data should remain authoritative.

## Brand Avatar

Brand Avatar communicates from Brand context while reasoning over the graph.

It should express the Brand's voice, personality, strategic posture, and feedback style while understanding where an object sits in the campaign graph.

For example, Brand Avatar feedback may differ when reviewing:

- an upstream campaign idea;
- a mid-funnel proof point;
- a landing page variant;
- an endpoint offer;
- a disconnected asset;
- a Journey bottleneck.

Brand Avatar should not invent graph relationships or override Brand truth. It should use the graph to make feedback more contextual and human-readable.

## Funnel Simulator

Funnel Simulator should simulate customer movement through graph paths.

It should evaluate how an ICP, persona, buyer, founder, investor, or customer segment may respond as they encounter nodes along a Campaign Path or Journey.

Future simulation may ask:

- Does the message create interest?
- Does the next step answer the customer's objection?
- Does the landing page fit the ad promise?
- Does the email sequence maintain trust?
- Where does the customer drop off?
- Which decision point creates friction?
- Which proof point or offer could unlock movement?

The simulator should be grounded in Brand context, graph paths, node content, relationships, and evidence. It should not be a standalone black-box score.

## Insights

Insights observe graph outcomes.

Insights should detect patterns, changes, evidence, risks, and opportunities from campaign work and outcomes. The graph provides structure so Insights can know what a result belongs to and what it may affect.

Examples:

- a landing page outcome informs its upstream message angle;
- a social post result informs its campaign variation;
- a repeated objection informs future proof-point nodes;
- an experiment result informs future Decision Points;
- a high-performing path informs future campaign templates.

Insights should distinguish observation from approved learning. Raw outcomes should not silently rewrite Brand truth.

## Learning Loop

The Learning Loop turns outcomes into better future graph decisions.

A healthy Learning Loop follows this path:

```text
Campaign graph
↓
Deployment or simulation
↓
Outcomes and observations
↓
Insights
↓
Human review
↓
Approved learning
↓
Brand Consciousness evolves
↓
Future graph decisions improve
```

The Learning Loop should help Funklix compound knowledge. Campaigns should not disappear after execution. They should teach the Brand what worked, what failed, what assumptions changed, and what future graph structures may perform better.

## Future Extensions

The Marketing Knowledge Graph can eventually support richer graph concepts.

### Semantic Relationships

Explicit relationship types such as depends on, supports, variant of, derived from, tests, informs, contradicts, unlocks, blocks, routes to, or learns from.

### Weighted Relationships

Relationship strength, importance, traffic allocation, confidence, business impact, or evidence weight.

### Confidence

Confidence that a node, relationship, insight, assumption, or recommendation is supported by evidence.

### Evidence

Research, analytics, user feedback, simulation outputs, experiments, approvals, source documents, or team decisions attached to graph objects.

### Experiments

Structured tests that compare variants, channels, messages, offers, or funnel paths.

### Variants

Alternative versions of nodes, paths, offers, audiences, messages, or creative directions.

### Deployment

Launch state, channel placement, external IDs, publishing history, and live asset relationships.

### Analytics

Performance metrics and behavioral data mapped back to graph nodes, relationships, paths, and Journeys.

### Optimization

Recommendations for improving graph structure, messaging, path flow, evidence coverage, conversion movement, or learning loops.

All extensions should preserve ownership clarity, human review, explainability, and compatibility with existing graph concepts.

## Golden Rules

1. The graph is the source of marketing context.
2. Brand owns the graph.
3. Workspace administers Brands.
4. Boards organize campaign work inside a Brand.
5. Campaign Canvas is the visual interaction surface for the graph.
6. Nodes never exist without a graph.
7. Nodes represent marketing meaning, not just visual blocks.
8. Relationships create meaning.
9. Current runtime edges are implementation details until semantic relationships are designed.
10. Campaign Paths are graph concepts, not task lists.
11. Journeys traverse Campaign Paths.
12. Bottlenecks emerge from graph structure, status, evidence, and outcomes.
13. Unlocks must be explainable and must not imply guaranteed performance.
14. Campaign Health derives from graph structure, node status, evidence, and outcomes when available.
15. Mission Control summarizes the graph; it does not own graph truth.
16. AI consumes and reasons over the graph; it does not replace the graph.
17. Brand Avatar communicates from Brand context while using graph position for relevance.
18. Funnel Simulator simulates movement through graph paths.
19. Insights observe graph outcomes.
20. Learning improves future graph decisions through governed review.
21. Semantic relationships, analytics, deployment, experiments, and optimization must be added incrementally.
22. No product surface should duplicate graph truth as its own source of truth.
