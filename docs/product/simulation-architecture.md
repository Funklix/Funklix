# Simulation Architecture

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Canonical Conceptual Architecture |
| Owner | Product |
| Last Updated | 2026-07-06 |
| Scope | Product concepts and ownership language; documentation only |

## Purpose

Simulation is the conceptual layer that lets Funklix examine possible marketing outcomes before, during, and after campaign execution.

Simulation exists because marketing teams often need to ask: “What might happen if this customer sees this message, follows this path, chooses this offer, or encounters this objection?” Those questions cannot be answered by isolated content generation or by historical analytics alone.

Simulation helps teams reason through possible customer movement, friction, opportunities, objections, alternatives, and campaign readiness using Brand context and Marketing Knowledge Graph truth.

Simulation should become a first-class product capability that later powers:

- Funnel Simulator;
- AI Brain reasoning;
- Brand Avatar conversations;
- customer journey simulation;
- persona testing;
- scenario planning;
- campaign validation;
- future AI Agents.

## How Simulation Differs From AI Generation

AI generation creates or transforms content.

Simulation evaluates possible movement through context.

Generation asks:

- What copy should we write?
- What post should we create?
- What image direction should we explore?
- What landing page section should we draft?

Simulation asks:

- How might this ICP respond to this path?
- Where might this persona lose trust?
- Which decision point creates friction?
- Which missing asset blocks customer movement?
- Which alternative route may be stronger?
- Which assumptions remain untested?

Simulation may use generative intelligence to express observations, questions, or scenario narratives, but the product concept is not generation. Simulation is structured reasoning over Brand context, graph context, constraints, and possible customer behavior.

## How Simulation Differs From Analytics

Analytics observes what happened.

Simulation explores what may happen, what could happen, or what might have happened under different assumptions.

Analytics may say:

- this landing page converted at a given rate;
- this post got a given engagement pattern;
- this email had a given click-through rate;
- this audience segment behaved differently from another segment.

Simulation may ask:

- why might a visitor hesitate before conversion?
- what path could reduce friction?
- how might a different offer change intent?
- what message might better address a known objection?
- which Journey step needs proof before launch?

Simulation must not pretend to be analytics. It produces hypotheses, observations, risks, questions, alternatives, and opportunities. It becomes stronger when compared against real outcomes, but it is not itself evidence of what happened.

## Graph Intelligence vs Generative Intelligence

The separation between Graph Intelligence and Generative Intelligence is fundamental to Funklix architecture.

### Graph Intelligence is deterministic

Graph Intelligence reads product-owned structure.

It can determine:

- which nodes exist;
- which relationships exist;
- which nodes are upstream or downstream;
- which paths exist;
- which nodes are roots or leaves;
- which statuses are complete, in review, draft, or needing changes;
- which graph objects are connected, isolated, blocked, or unlocked according to explicit rules.

Graph Intelligence should be reproducible. Given the same graph state and rules, it should return the same result.

### Generative Intelligence is interpretive

Generative Intelligence explains, critiques, imagines, summarizes, role-plays, or proposes.

It can help interpret:

- how a persona may feel;
- what objection may appear;
- why a path may create friction;
- what alternative path may be worth exploring;
- what question a marketer should ask next.

Generative Intelligence is useful, but it is not the source of graph truth.

### Why the separation matters

If Generative Intelligence is allowed to invent graph truth, Funklix loses ownership clarity. AI could hallucinate dependencies, rewrite campaign structure, invent analytics, or treat speculation as fact.

If Graph Intelligence is treated as generative interpretation, Funklix loses determinism. Dashboard, Mission Control, Funnel Simulator, and future Agents would become inconsistent and difficult to audit.

Simulation must preserve the separation:

```text
Graph Intelligence reads what is true in the product.
Generative Intelligence interprets possible meaning from that truth.
Simulation combines them without confusing them.
```

## Relationship to the Marketing Knowledge Graph

Simulation reasons over graph truth.

Simulation never invents graph truth.

The Marketing Knowledge Graph provides the structured campaign context that Simulation consumes:

- Brand context;
- graph nodes;
- relationships;
- campaign paths;
- journeys;
- decision points;
- status;
- assets;
- evidence when available;
- outcomes when available.

Simulation may identify potential friction, missing context, possible alternatives, or untested assumptions, but those outputs do not overwrite the graph. A human or governed product workflow must decide whether simulation output becomes a node, relationship, insight, learning, decision, or asset.

## Simulation Inputs

Simulation inputs should be explicit, scoped, and owned by the correct product layer.

The conceptual input flow is:

```text
Brand
↓
Brand Core
↓
Marketing Knowledge Graph
↓
Relationships
↓
Campaign Paths
↓
ICP
↓
Persona
↓
Objectives
↓
Constraints
```

### Brand

The active Brand provides the marketing context, memory, positioning, voice, history, and strategic boundaries for a simulation.

### Brand Core

Brand Core provides structured Brand truth such as tone, messaging pillars, value proposition, personas, dos and don'ts, content guidelines, keywords, and assets.

### Marketing Knowledge Graph

The graph provides campaign structure: nodes, relationships, paths, decisions, assets, statuses, evidence, and learning context.

### Relationships

Relationships show how graph objects influence, support, sequence, unlock, or constrain each other. Current runtime edges are not yet semantic relationships, so early simulation should treat them as conservative graph signals only.

### Campaign Paths

Campaign Paths define the route through which a customer, persona, or scenario moves.

### ICP

ICP context defines the ideal customer profile being tested against the campaign path.

### Persona

A Persona is a simulation participant representing a customer segment, buyer profile, founder audience, investor, internal stakeholder, or other perspective.

### Objectives

Objectives define what the campaign or simulation is trying to evaluate, such as clarity, trust, offer fit, conversion readiness, objection handling, or channel fit.

### Constraints

Constraints define boundaries such as Brand voice, compliance, campaign scope, channel limits, budget assumptions, timeline, audience maturity, proof availability, or launch requirements.

## Simulation Outputs

Simulation outputs are interpretive results. They should never overwrite graph truth.

Outputs may include:

- observations;
- questions;
- risks;
- alternative paths;
- potential friction;
- missing assets;
- untested assumptions;
- opportunities.

### Observations

An observation describes something the simulation noticed about a path, message, audience, decision point, or asset.

### Questions

A question identifies what the team should clarify before launch, review, or further generation.

### Risks

A risk identifies a possible weakness, uncertainty, objection, confusion, mismatch, or launch-readiness concern.

### Alternative Paths

An alternative path suggests another route through the graph that may better match a Persona, objective, offer, or channel.

### Potential Friction

Potential friction describes where a customer may hesitate, lose trust, misunderstand the offer, face an objection, or fail to move forward.

### Missing Assets

Missing assets identify graph objects that may be needed to support a Journey, such as proof, comparison content, retargeting, offer details, FAQ, testimonial, email follow-up, or onboarding material.

### Untested Assumptions

Untested assumptions identify claims, beliefs, persona expectations, channel expectations, or conversion assumptions that lack evidence.

### Opportunities

Opportunities suggest places where the team may strengthen the campaign, explore a variant, add proof, clarify an offer, improve sequencing, or validate a decision point.

Simulation outputs remain proposals or observations until a human or governed product workflow converts them into graph changes, insights, learning, or decisions.

## Simulation Types

### Customer Journey Simulation

Simulates how a customer may move through a Campaign Path from first touch through conversion, drop-off, or learning.

### ICP Simulation

Evaluates whether campaign paths, offers, messages, and assets align with the ideal customer profile.

### Persona Walkthrough

Role-plays a specific Persona moving through a graph path, identifying expectations, objections, trust moments, and friction.

### Offer Validation

Tests whether an offer is clear, relevant, differentiated, believable, and connected to the customer's problem.

### Landing Page Review

Evaluates a landing page node in the context of upstream promises, downstream actions, Brand voice, proof, and conversion objective.

### Content Journey

Evaluates whether content nodes create a coherent progression from awareness to trust, interest, consideration, or conversion.

### Channel Journey

Evaluates whether a path makes sense for a specific channel, such as LinkedIn, X / Twitter, Instagram, TikTok, email, paid ads, events, or search.

### Launch Readiness

Evaluates whether a campaign graph appears ready for launch based on graph structure, status, missing assets, unresolved questions, known risks, and evidence availability.

### Campaign Scenario Comparison

Compares multiple scenarios over the same graph or related graph paths to understand tradeoffs, risks, and alternatives.

## Scenario

A Scenario is a bounded simulation setup.

A Scenario defines:

- the graph or graph path being evaluated;
- the Persona or ICP perspective;
- the objective;
- the assumptions;
- the constraints;
- the decision points to explore;
- the outputs expected from the simulation.

Multiple scenarios may exist over the same graph.

For example, one campaign graph may support:

- a budget-conscious buyer scenario;
- an executive decision-maker scenario;
- a skeptical technical evaluator scenario;
- a competitor-comparison scenario;
- a launch-readiness scenario;
- a post-launch learning scenario.

Scenarios are ways to inspect the graph. They do not own the graph.

## Persona

Personas are simulation participants.

They are not graph owners.

A Persona may represent:

- an ICP segment;
- a buyer role;
- a founder audience;
- an investor profile;
- a customer maturity level;
- a skeptical evaluator;
- an internal stakeholder;
- a future Agent role.

Personas help Simulation ask: “How might this perspective interpret the graph path?”

Personas should be grounded in Brand truth, research, or explicit assumptions. If a Persona is speculative, Simulation should preserve that uncertainty instead of presenting it as fact.

## Journey

A Journey is a Persona or customer traversal through Campaign Paths.

Journey traversal asks:

- where does the Persona begin?
- what do they see first?
- what belief changes at each node?
- what objection appears?
- what proof is needed?
- what decision point branches the path?
- what action might they take next?
- where do they stop, convert, or require follow-up?

A Journey should connect Simulation to the Marketing Knowledge Graph. It should not be a free-floating narrative disconnected from graph paths.

## Decision Points

Decision Points are where scenarios branch.

A scenario may branch when:

- the Persona chooses between offers;
- the campaign chooses between channels;
- a visitor chooses whether to click;
- a buyer accepts or rejects proof;
- a landing page variant changes the message;
- a CTA changes the next action;
- a follow-up path diverges by objection;
- a launch decision depends on readiness.

Simulation should use Decision Points to explore alternatives without rewriting the underlying graph.

## Simulation Session

A Simulation Session is temporary simulation state.

It may include:

- selected graph path;
- selected Persona or ICP;
- scenario assumptions;
- active questions;
- generated observations;
- explored branches;
- provisional risks;
- suggested alternatives;
- facilitator notes;
- collaborator discussion.

A Simulation Session is not graph truth.

It should never be persisted as graph truth by default. Simulation outputs require review before becoming Insights, Decisions, Nodes, Relationships, Assets, or Brand learning.

## Brand Avatar

Brand Avatar participates in simulation.

It never owns simulation.

Brand Avatar can help express feedback in the Brand's voice, personify Brand posture, challenge weak assumptions, or guide teams through a scenario. It may communicate how the Brand would respond to a Persona, Journey, or campaign path.

Brand Avatar should not own scenario state, simulation results, graph truth, or Brand truth. It should communicate from Brand context while respecting graph and simulation boundaries.

## AI Brain

AI Brain facilitates simulation.

It does not replace the graph.

AI Brain may help frame scenarios, ask strategic questions, compare alternatives, summarize possible friction, explain tradeoffs, and help teams interpret simulation outputs.

AI Brain should not overwrite graph truth, create analytics, assert real-world performance, or convert simulation output into Brand learning without governed review.

## Mission Control

Mission Control summarizes reality.

It does not summarize simulations as if they were reality.

Dashboard may eventually show simulation-related status, such as:

- open simulation questions;
- scenarios needing review;
- launch-readiness concerns;
- unresolved assumptions;
- comparison summaries;
- validated learnings after review.

But Mission Control should clearly distinguish actual campaign state, graph state, analytics, and simulation hypotheses.

## Insights

Insights compare reality against previous simulations.

After launch, analytics, team feedback, customer behavior, or validated observations may be compared against prior simulations:

- Did the predicted friction appear?
- Did the Persona concern match real objections?
- Did the alternative path perform better?
- Did launch-readiness risks become real issues?
- Which assumptions were confirmed or rejected?

Insights should preserve provenance. A simulation prediction is not the same as a measured outcome.

## Learning Loop

Validated outcomes improve future simulations.

The conceptual loop is:

```text
Brand and graph truth
↓
Simulation scenario
↓
Simulation outputs
↓
Campaign execution or further review
↓
Observed outcomes
↓
Insights
↓
Human validation
↓
Approved learning
↓
Brand Consciousness improves
↓
Future simulations improve
```

Simulation becomes valuable when it learns from reality through governed review. It should help Funklix get better at asking the right questions before launch and interpreting the right signals after launch.

## Simulation Principles

1. Simulation consumes Brand context.
2. Simulation consumes graph truth.
3. Simulation never invents graph truth.
4. Simulation outputs are interpretive until validated.
5. Simulation should preserve uncertainty.
6. Simulation should distinguish assumption from evidence.
7. Simulation should distinguish possible friction from measured performance.
8. Simulation should support human judgment, not replace it.
9. Simulation should be scoped to one active Brand.
10. Simulation should be explainable through inputs, scenario, and graph path.

## Future Extensions

### Multi-Agent Simulations

Multiple simulated participants may examine a graph path from different roles, such as buyer, champion, skeptic, founder, investor, competitor, reviewer, or support stakeholder.

### Competitor Simulations

Simulation may compare how a customer could interpret a Brand's offer against competitor positioning, claims, proof, or alternatives.

### Emotional Journeys

Simulation may evaluate emotional states such as curiosity, trust, doubt, urgency, skepticism, relief, confidence, or confusion across a Campaign Path.

### Trust Scoring

Future systems may estimate trust signals across a Journey, but trust scoring must remain explainable and must distinguish simulation from real analytics.

### Objections

Simulation may track likely objections and whether campaign nodes answer them clearly.

### Purchase Confidence

Simulation may estimate where confidence rises or falls along a Journey, but it must not claim real conversion probability without evidence.

### Experimentation

Simulation may propose experiments to validate uncertain assumptions, compare variants, or test decision points.

### Monte Carlo Style Exploration

Future systems may explore many combinations of assumptions or paths to reveal sensitivity, variance, or scenario clusters. This should remain exploratory, not predictive certainty.

### Scenario Branching

Scenarios may branch into alternative paths, outcomes, or decisions while preserving the original graph truth.

### Collaborative Simulations

Teams may co-review scenarios, annotate risks, accept or reject observations, and decide what should become graph changes or learning.

## Golden Rules

1. Simulation consumes graph truth.
2. Simulation never rewrites graph truth.
3. Simulation reasons over Brand context.
4. Brand owns simulations.
5. Workspace administers Brands.
6. Multiple simulations may exist over the same graph.
7. Simulation sessions are temporary.
8. Personas participate in simulations; they do not own graph truth.
9. Scenarios inspect the graph; they do not own the graph.
10. AI facilitates simulations; it does not replace the graph.
11. Brand Avatar participates in simulations; it does not own simulation state.
12. Mission Control summarizes reality and must label simulation hypotheses clearly.
13. Insights compare reality against previous simulations.
14. Learning requires validation before Brand Consciousness changes.
15. Graph Intelligence is deterministic.
16. Generative Intelligence is interpretive.
17. Simulation must keep deterministic graph truth separate from interpretive outputs.
18. Simulation must not infer real performance without evidence.
19. Simulation must not create semantic relationships without governed graph changes.
20. Simulation exists to improve human strategic judgment.
