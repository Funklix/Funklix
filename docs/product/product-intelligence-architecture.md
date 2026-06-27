# Funklix Product Intelligence Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Foundational Blueprint |
| Owner | Product |
| Last Updated | 2026-06-27 |

## Purpose

This document defines Funklix as an intelligent product system.

It is not a screen specification, implementation plan, UI brief, or feature backlog. It is the product blueprint for how Brand, AI, Campaigns, Knowledge, Insights, Simulation, Dashboard, and Teams should work together after Sprint A.

Use this document when deciding where a feature belongs, what it should own, what it should read, and what it must never become.

## 1. Core Philosophy

### Funklix exists because marketing context is fragmented

Most AI marketing workflows lose context because they are built around temporary conversations, isolated prompts, and one-off outputs. Each new chat requires people to re-explain the company, audience, positioning, voice, offer, campaign goal, objections, and constraints.

That creates inconsistent work. Not because AI cannot reason, but because the product does not preserve shared understanding.

Funklix exists to solve that problem by giving humans and AI a shared operating environment where marketing knowledge persists, improves, and compounds.

### Persistent Brand Intelligence matters

The Brand Brain is the persistent intelligence layer of Funklix. It should remember approved positioning, ideal customers, voice, tone, offers, messaging, campaign history, insights, and team decisions.

Without persistent Brand Intelligence, every AI interaction starts too close to zero. With it, every campaign, review, simulation, and strategic discussion can build from the same source of truth.

### Collaboration is the product

Funklix is not a tool where one user asks one model for one answer. It is a collaborative workspace where humans and AI work around shared objects: Brand Brain, Campaign Canvas, Nodes, Insights, Knowledge, Simulations, and Decisions.

AI should participate like a strategic teammate: suggesting, reviewing, questioning, identifying gaps, and helping teams move faster without removing human judgment.

### Humans remain strategic decision makers

AI can generate options, identify risks, summarize patterns, simulate audiences, and challenge assumptions. Humans remain responsible for choosing direction, approving brand truth, evaluating tradeoffs, and deciding what the company should actually do.

Funklix should make human judgment stronger, not quieter.

## 2. Core Product Objects

### Brand Brain

**Definition**

The Brand Brain is the persistent source of truth for a company inside Funklix.

**Responsibility**

- Store accepted brand knowledge.
- Preserve positioning, ICP, personas, messaging, voice, tone, offers, archetype, avatar, objections, differentiators, and strategic decisions.
- Provide shared context to AI Brain, Campaign Canvas, Insights, Simulation, Dashboard, and future workflows.
- Learn from approved campaigns, human edits, team feedback, and validated insights.

**Should never become**

- A generic document folder.
- A chat transcript archive.
- A dumping ground for unapproved knowledge.
- A place where every feature stores unrelated state.

### Campaign Canvas

**Definition**

The Campaign Canvas is the visual creation workspace where humans and AI build campaigns together.

**Responsibility**

- Represent campaign strategy and assets as connected Nodes.
- Make relationships visible.
- Support campaign editing, collaboration, review, and iteration.
- Read from Brand Brain and AI Brain context.

**Should never become**

- The owner of Brand truth.
- The owner of analytics truth.
- The Dashboard.
- A generic whiteboard disconnected from campaign intelligence.

### Campaign

**Definition**

A Campaign is a strategic marketing initiative with a goal, audience, message, channel strategy, creative assets, and performance outcomes.

**Responsibility**

- Group related Canvas work into a coherent initiative.
- Connect strategy, assets, status, review, and performance.
- Provide learning material back to Insights and Brand Brain after execution.

**Should never become**

- A random collection of content.
- A folder without strategy.
- A replacement for Brand Brain.

### Node

**Definition**

A Node is the smallest meaningful campaign object on the Campaign Canvas.

**Responsibility**

- Represent a campaign idea, landing section, content item, posting, strategy block, or other campaign unit.
- Carry editable content, metadata, status, ownership, images, and relationships.
- Support review, improvement, propagation, and collaboration.

**Should never become**

- An unbounded data container.
- The owner of global brand knowledge.
- A place to hide business logic that belongs to Campaign, AI Brain, Insights, or Brand Brain.

### AI Brain

**Definition**

AI Brain is the strategic advisor and reasoning layer of Funklix.

**Responsibility**

- Advise on strategy, positioning, campaigns, messaging, gaps, and risks.
- Act as creative sparring partner and brand-aware reviewer.
- Explain reasoning and help teams make decisions.
- Read Brand Brain, Campaign Canvas, Knowledge, Insights, and Simulation outputs.

**Should never become**

- A generic ChatGPT clone.
- The execution owner of every workflow.
- The source of truth for Brand data.
- A place where decisions disappear into chat history.

### Insights

**Definition**

Insights is the analytical observation layer of Funklix.

**Responsibility**

- Detect facts, patterns, metrics, signals, changes, risks, and opportunities.
- Convert performance and product usage into structured observations.
- Feed validated learnings back into Brand Brain and AI Brain.

**Should never become**

- A chat interface.
- A strategy discussion surface.
- A place for speculative recommendations without evidence.

### Simulation

**Definition**

Simulation is the future testing environment where teams can evaluate marketing ideas before execution.

**Responsibility**

- Simulate ICP reactions, founder perspectives, customer objections, landing-page reviews, sales calls, investor reactions, and funnel scenarios.
- Help teams expose weak assumptions early.
- Produce structured outputs that AI Brain can reason about and Insights can compare over time.

**Should never become**

- A game-like gimmick.
- A substitute for real performance data.
- A black-box score without explanation.

### Knowledge

**Definition**

Knowledge is the persistent library of approved, reusable context beyond the formal Brand Brain schema.

**Responsibility**

- Store documents, learnings, decisions, examples, market notes, customer research, and reusable references.
- Provide searchable context to AI systems.
- Distinguish accepted knowledge from raw or unverified material.

**Should never become**

- An uncurated file dump.
- The same object as Brand Brain.
- A place where outdated information silently overrides approved truth.

### Dashboard

**Definition**

Dashboard is the mission-control surface of Funklix.

**Responsibility**

- Show what needs attention now.
- Orchestrate continuation, review, risk awareness, team activity, and next actions.
- Read from Boards, Campaigns, Brand Brain, Insights, AI Brain, Simulation, and Team activity.

**Should never become**

- Merely Recent Boards.
- A second Campaign Canvas.
- A place that calculates domain truth directly.
- A cluttered admin panel.

### Team

**Definition**

Team is the human collaboration layer around Brand Brain and campaigns.

**Responsibility**

- Represent people, roles, ownership, feedback, decisions, approvals, and collaboration state.
- Keep accountability clear when AI contributes ideas or assets.
- Preserve who decided what and why.

**Should never become**

- A passive user list.
- A social feed without product relevance.
- A replacement for clear ownership and decision history.

## 3. Information Flow

Funklix should operate as a closed learning loop.

```text
Brand Brain
    ↓
AI Brain
    ↓
Campaign Canvas
    ↓
Campaign Assets
    ↓
Performance
    ↓
Insights
    ↓
Learning
    ↓
Brand Brain
```

### Flow responsibilities

1. **Brand Brain defines truth.** It supplies the shared context every AI and human workflow should respect.
2. **AI Brain reasons from truth.** It advises, reviews, challenges, and proposes next steps.
3. **Campaign Canvas makes strategy visible.** It turns decisions into connected campaign assets.
4. **Campaign Assets enter the world.** They become posts, landing pages, messages, ads, emails, sales assets, and other execution outputs.
5. **Performance creates evidence.** Results, reactions, edits, and outcomes become observable data.
6. **Insights detects patterns.** It separates signal from noise and identifies what changed.
7. **Learning updates the system.** Validated learning improves the Brand Brain, future AI behavior, and future campaign quality.

The loop is the product advantage. Every completed cycle should make Funklix more useful.

## 4. Dashboard Philosophy

The Dashboard is Mission Control.

It should help users answer:

- What needs my attention?
- Where should I continue?
- What changed since I was last here?
- What is at risk?
- What can AI help me improve next?

### Dashboard belongs to orchestration

The Dashboard should gather signals from other product areas and present a clear operational view. It should not own the underlying domain logic.

### What belongs on Dashboard

- Work requiring attention.
- Campaigns or Boards with meaningful changes.
- Brand status and confidence signals.
- Review queues and approvals.
- AI recommendations that need human decision.
- Insight highlights with clear evidence.
- Team activity relevant to current work.
- Simulation outcomes that require follow-up.
- Quick Actions that route users into existing workflows.

### What does not belong on Dashboard

- Full campaign editing.
- Raw analytics exploration.
- Long AI conversations.
- Brand Brain editing workflows.
- Every board or every activity event.
- Metrics without interpretation.
- Business logic duplicated from other product areas.

The Dashboard informs and routes. It does not calculate or replace specialized workspaces.

## 5. AI Brain Philosophy

AI Brain is not ChatGPT embedded in Funklix.

AI Brain should become the brand-aware strategic intelligence layer of the product.

### AI Brain should act as

- **Brand Advisor** — protects positioning, voice, consistency, and strategic fit.
- **Strategic Partner** — helps evaluate direction, tradeoffs, sequencing, and priorities.
- **Creative Sparring Partner** — generates alternatives and challenges weak ideas.
- **Decision Support** — summarizes options, risks, reasoning, and implications.
- **Gap Finder** — identifies missing context, unclear claims, weak CTAs, or audience mismatch.
- **Campaign Reviewer** — evaluates work against Brand Brain, objectives, and channel expectations.
- **ICP Simulator** — reasons from the perspective of defined audience segments.
- **Brand Guardian** — flags drift away from accepted Brand truth.

### AI Brain boundaries

AI Brain should not own the Brand Brain. It should not execute every workflow directly. It should not silently make strategic decisions. It should not hide meaningful reasoning from the user.

The best AI Brain experience should feel like collaborating with a senior strategist who knows the brand, sees the campaign, remembers the history, and helps humans decide better.

## 6. Insights Philosophy

Insights and AI Brain are related but not the same.

### Insights observes

Insights should focus on:

- Facts.
- Patterns.
- Metrics.
- Signals.
- Changes.
- Diagnostics.
- Evidence-backed conclusions.

Insights should answer: **What happened? What changed? What pattern is visible? What deserves attention?**

### AI Brain reasons

AI Brain should focus on:

- Recommendations.
- Strategy.
- Discussion.
- Planning.
- Tradeoffs.
- Creative alternatives.
- Decision support.

AI Brain should answer: **What should we do about it? What are the options? What is the strongest path? What might we be missing?**

### Relationship

Insights should provide structured observations that AI Brain can discuss. AI Brain should not invent metrics. Insights should not become a chat surface.

## 7. Simulation

Simulation belongs in Funklix because marketing quality improves when ideas are tested before public execution.

The Simulation Engine should allow teams to evaluate campaigns, messages, offers, and assets against realistic perspectives.

### Future simulation examples

- **ICP simulation** — how a target customer segment might interpret a message.
- **Founder simulation** — whether the campaign fits founder intent, ambition, and risk tolerance.
- **Customer objections** — likely objections and blockers before conversion.
- **Landing page review** — clarity, trust, CTA, proof, and friction analysis.
- **Sales call simulation** — how prospects might respond to claims or offers.
- **Investor simulation** — whether messaging communicates market, traction, and ambition clearly.
- **Funnel simulation** — where users may drop off or misunderstand the offer.

### Simulation boundaries

Simulation should not pretend to be real market proof. It should explain assumptions, expose likely risks, and create structured learning that can later be compared against real performance.

## 8. Wizard / Onboarding Philosophy

Onboarding should build the first useful Brand Brain, not merely collect setup data.

A high-level onboarding path should be:

```text
Brand
  ↓
Archetype
  ↓
Avatar
  ↓
Knowledge
  ↓
Campaign
  ↓
Simulation
  ↓
Optimization
```

### Onboarding should

- Help the user articulate brand truth.
- Establish ICP, positioning, voice, tone, offers, and differentiators.
- Create an initial Brand Avatar and archetype direction.
- Import or capture key Knowledge.
- Generate a first campaign from persistent context.
- Simulate likely audience response.
- Recommend optimization steps.

### Onboarding should not

- Be a generic account setup checklist.
- Ask for information without showing immediate product value.
- Create disconnected data that AI cannot reuse.

The first-session goal is not completion. It is confidence: the user should feel that Funklix understands the brand and can help improve future work.

## 9. Long-term Learning

Funklix should become smarter as teams work.

### Learning sources

- Campaign history.
- Approved content.
- Rejected content.
- Human edits.
- Brand decisions.
- Strategic discussions.
- Insight outcomes.
- Team feedback.
- Simulation outcomes.
- Performance results.
- Review comments.
- Repeated objections or risks.

### Learning rules

- Learning should be explainable.
- Accepted Brand truth should be distinguishable from raw observations.
- Human approval should matter when knowledge changes strategic direction.
- The system should avoid duplicating knowledge across objects.
- Historical learning should improve future suggestions, reviews, simulations, and campaign generation.

The long-term promise is compounding intelligence: every meaningful interaction should improve future AI behavior.

## 10. Product Principles

1. **Brand Brain is the single source of truth.** Every major AI and campaign workflow should respect accepted Brand Intelligence.
2. **AI augments human thinking.** AI can advise, simulate, and generate, but humans remain accountable for strategy and decisions.
3. **Every interaction can teach the system.** Campaigns, edits, reviews, insights, and simulations should create learning opportunities.
4. **No duplicated knowledge.** If a fact belongs in Brand Brain or Knowledge, features should read it rather than copy it silently.
5. **Consistency before creativity.** Creative output should remain aligned with positioning, voice, audience, and offer.
6. **Intelligence before automation.** Funklix should help users understand and decide before it automates execution.
7. **Dashboard informs.** Dashboard surfaces what matters and routes users to the right workspace.
8. **AI Brain advises.** AI Brain reasons, recommends, reviews, and challenges; it does not own domain truth.
9. **Insights observe.** Insights detects facts, patterns, metrics, and changes; it does not become a chat surface.
10. **Simulation experiments.** Simulation tests assumptions before execution and explains uncertainty.
11. **Campaign Canvas makes strategy visible.** Visual structure is part of thinking, not decoration.
12. **Learning must be governed.** New knowledge should be traceable, explainable, and intentionally accepted when it changes brand direction.

## 11. How Future Work Should Use This Document

Future product work should reference this architecture before implementation when it affects:

- Brand Brain.
- AI Brain.
- Dashboard.
- Campaign Canvas.
- Insights.
- Simulation.
- Knowledge.
- Onboarding.
- Collaboration.
- Long-term learning.

For each major feature, teams should answer:

1. Which product object owns this?
2. Which product objects does it read from?
3. Which product objects can it update?
4. Does it duplicate knowledge?
5. Does it strengthen the closed learning loop?
6. Does it keep humans in strategic control?
7. Does it preserve the difference between Dashboard, AI Brain, Insights, and Canvas?

If the answer is unclear, perform an audit and create an ADR before implementation.
