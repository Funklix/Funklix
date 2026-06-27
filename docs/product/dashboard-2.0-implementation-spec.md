# Dashboard 2.0 Wireframe and Implementation Spec

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Product / Implementation Planning Spec |
| Owner | Product |
| Last Updated | 2026-06-27 |

## Purpose

Dashboard 2.0 is Funklix Mission Control: the daily briefing for the AI Marketing Operating System.

It should answer one question quickly:

> What deserves my attention today?

This document defines the Dashboard 2.0 information architecture and future implementation boundaries. It does not implement UI, runtime logic, analytics, API calls, AI workflows, or data storage.

## 1. Product Intent

Dashboard 2.0 is not a homepage. It is not a board list. It is not a feed of everything that happened.

Dashboard 2.0 is the morning briefing for a brand-aware marketing operating system. It should prioritize attention, summarize meaningful change, and route the user into the right workspace.

### Dashboard 2.0 should

- Prioritize attention.
- Show where to continue.
- Surface Brand evolution.
- Show AI-prepared ideas.
- Show today's focus.
- Show live campaign status only when available.
- Guide the user into the right workspace.
- Preserve the distinction between Brand Brain, AI Brain, Insights, Simulation, Campaign Canvas, Boards, and Team.

### Dashboard 2.0 should not

- Own business logic.
- Become Insights.
- Become AI Brain.
- Become Boards.
- Become a task manager database.
- Show everything.
- Calculate analytics directly.
- Store canonical knowledge.
- Create a second campaign workspace.
- Pressure the user with critical or nagging language.

## 2. Dashboard 2.0 Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ A. DAILY BRIEFING HERO                                                       │
│ ┌────────────┐  Good morning — I reviewed where we are today.                │
│ │ Brand      │  "I found one angle we may want to test in this campaign."   │
│ │ Avatar     │                                                               │
│ └────────────┘  [Continue Campaign / Open Priority Board]                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┬──────────────────────────────────────────────┐
│ B. CONTINUE WORKING           │ C. BRAND EVOLUTION                           │
│ Most relevant campaign/board  │ Brand Brain completeness                     │
│ Status                        │ Newest learning                              │
│ Completeness                  │ Suggested improvement                        │
│ Latest meaningful update      │ Missing knowledge inputs                     │
│ Next suggested action         │ Founder Story / Market Research / Pitch Deck │
└───────────────────────────────┴──────────────────────────────────────────────┘

┌───────────────────────────────┬──────────────────────────────────────────────┐
│ D. SUGGESTED OPPORTUNITIES    │ E. TODAY'S FOCUS                             │
│ AI-prepared ideas             │ Top 3 assigned/open node-based tasks         │
│ Campaign angle                │ Each links back to board/node                │
│ Positioning idea              │ No separate task database in MVP             │
│ Content opportunity           │                                              │
│ Competitor-based suggestion   │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘

┌───────────────────────────────┬──────────────────────────────────────────────┐
│ F. LIVE CAMPAIGNS             │ G. TEAM ACTIVITY                             │
│ Only if deployed/running data │ Meaningful updates only                      │
│ Lightweight status            │ AI suggestion accepted                       │
│ Details route to Insights     │ Asset approved / Node updated / Deployed     │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

### A. Daily Briefing Hero

**Purpose**

Create immediate orientation and confidence. The user should feel the Brand itself is prepared for the day.

**Required content**

- Brand Avatar.
- Brand greeting in first person.
- One concise daily insight or suggestion.
- Primary CTA: Continue Campaign / Open Priority Board.

**Tone**

Calm, collaborative, prepared, optimistic, and brand-aware.

### B. Continue Working

**Purpose**

Help the user resume the most relevant campaign or board.

**Required content**

- One most relevant campaign/board.
- Campaign status.
- Campaign completeness.
- Latest meaningful update.
- Next suggested action.

**Boundary**

This section routes users into Boards or Campaign Canvas. It does not replace either.

### C. Brand Evolution

**Purpose**

Show how the Brand Brain is becoming stronger and what missing inputs could improve it.

**Required content**

- Brand Brain completeness.
- Newest learning.
- Suggested improvement.
- Missing knowledge inputs.

**Example missing inputs**

- Founder Story.
- Market Research.
- Pitch Deck.
- Whitepaper.
- Business Plan.

**Boundary**

Dashboard can display Brand Brain status and route users to Brand/Knowledge workflows. It cannot edit Brand Brain directly.

### D. Suggested Opportunities

**Purpose**

Surface AI-prepared ideas as opportunities, not problems.

**Required content**

- New campaign angle.
- Positioning idea.
- Content opportunity.
- Competitor-based suggestion.

**Tone rule**

Use positive, opportunity-based language. Avoid problem/nagging language.

**Boundary**

In MVP, use safe placeholders. Later, AI Brain can generate suggestions from Brand Brain, Knowledge, Campaigns, and Insights.

### E. Today's Focus

**Purpose**

Show the top three concrete things the user can act on today.

**Required content**

- Top 3 assigned/open tasks.
- Tasks should be derived from assigned Nodes where possible.
- Each task should link back to the board/node.

**Boundary**

Do not create a separate task ownership system in Dashboard unless a future audit proves assigned Nodes cannot support the need.

### F. Live Campaigns

**Purpose**

Show lightweight live campaign status only when deployed/running campaign data exists.

**Required content**

- Running/deployed campaign indicator.
- Lightweight status.
- Link to Insights for detail.

**Boundary**

Detailed analytics belong to Insights. Dashboard should not invent or calculate analytics.

### G. Team Activity

**Purpose**

Show meaningful collaboration updates without becoming a noisy feed.

**Examples**

- AI suggestion accepted.
- Asset approved.
- Team member updated a Node.
- Campaign deployed.

**Boundary**

Avoid low-signal events such as every click, every view, or raw edit noise.

## 3. Data Ownership

Dashboard owns no canonical knowledge. Dashboard reads and orchestrates. Dashboard never becomes storage.

| Section | Owner | Reads From | Writes To | May Modify? | Empty State |
|---|---|---|---|---|---|
| Daily Briefing Hero | Dashboard presentation only | Brand Brain, Brand Avatar, AI Brain suggestion source, Continue Working priority | Nothing canonical; CTA routes only | No, except local presentation preference in future | Friendly greeting with safe placeholder and CTA to create/open campaign |
| Continue Working | Boards/Campaigns/Campaign Canvas | Boards, Campaigns, Nodes, Team activity | Nothing canonical; routes to owner | No | Prompt to create/open a campaign or board |
| Brand Evolution | Brand Brain / Knowledge | Brand Brain completeness, Knowledge inputs, accepted learning | Nothing from Dashboard; route to Brand/Knowledge | No | Invite user to add foundational Brand knowledge |
| Suggested Opportunities | AI Brain later; Dashboard placeholder in MVP | Brand Brain, Knowledge, Campaigns, Insights, competitor inputs when available | AI Brain recommendation artifacts later; not Dashboard | No direct modification from Dashboard | Safe opportunity placeholders with link to AI Brain |
| Today's Focus | Nodes/Campaign Canvas/Team assignments | Assigned/open Nodes, board ownership, node status | Nothing canonical; routes to Node/Board | No | “No assigned focus items yet” with route to Canvas |
| Live Campaigns | Insights / deployment analytics later | Deployment data, campaign status, performance signals | Nothing canonical | No | Hidden until live/deployed campaign data exists |
| Team Activity | Team/Activity system | Meaningful collaboration events, approvals, deployments, accepted AI suggestions | Nothing canonical | No | Quiet state: “No meaningful updates yet” |

## 4. MVP vs Later

### A. Daily Briefing Hero

**MVP**

- Static layout.
- Safe placeholder Brand Avatar state.
- Safe first-person Brand greeting.
- Static daily suggestion.
- CTA routes to current campaign/board when available or safe placeholder action.

**Later**

- Personalized briefing from Brand Brain, AI Brain, recent meaningful changes, and user role.
- Dynamic priority CTA.
- Brand Avatar personality derived from Brand Brain.

### B. Continue Working

**MVP**

- Safe placeholder or most recent local/existing board/campaign only if already available without new APIs.
- Static status/completeness placeholders if reliable data is unavailable.

**Later**

- Recent board/campaign ranking.
- Meaningful update detection.
- Completeness based on campaign structure and node status.
- Next suggested action from AI Brain or deterministic rules.

### C. Brand Evolution

**MVP**

- Static Brand completeness placeholder.
- Missing knowledge input cards.
- Route to Brand/Knowledge surfaces when available.

**Later**

- Brand Brain completeness calculation.
- Newest accepted learning.
- Knowledge freshness.
- Recommended input priorities.

### D. Suggested Opportunities

**MVP**

- Static opportunity placeholders.
- Positive language only.
- Link to AI Brain when interactive suggestions are needed.

**Later**

- AI Brain 2.0-generated opportunity cards.
- Competitor/context-aware suggestions.
- Accept/dismiss feedback loop.

### E. Today's Focus

**MVP**

- Placeholder top-three focus layout.
- If existing assigned Node data is safely available, display assigned/open Nodes only.
- No separate task database.

**Later**

- Node assignment queries.
- Role-aware prioritization.
- Due dates only if Campaign/Node model supports them.
- Team task coordination after a dedicated task model audit.

### F. Live Campaigns

**MVP**

- Hide section unless safe running/deployed campaign data exists.
- Do not use fake analytics.

**Later**

- Deployment integrations.
- Campaign health summaries sourced from Insights.
- Lightweight status with deep links to Insights.

### G. Team Activity

**MVP**

- Static layout or safe existing meaningful updates only.
- Avoid noisy activity feed duplication.

**Later**

- Meaningful activity scoring.
- Approval events.
- Accepted AI suggestion events.
- Deployment events.
- Collaboration-aware filtering.

## 5. Task Model Recommendation

The first Dashboard 2.0 task model should be: **Tasks are assigned Nodes.**

Dashboard should show open assigned Nodes instead of creating a separate task system.

### Why assigned Nodes are the safest model

- Nodes already represent actionable campaign work.
- Nodes can link directly back to the board and context.
- Node ownership avoids a separate task database.
- Node status can become the earliest task state.
- This preserves Campaign Canvas as the owner of campaign work.

### What Dashboard may display

- Node title.
- Node status.
- Assigned owner.
- Board/campaign context.
- Link back to Node/Board.

### What Dashboard should not create yet

- Separate task objects.
- Separate task permissions.
- Separate task completion logic.
- Separate task comments.
- Separate due-date model.

A dedicated task-system audit should happen only if assigned Nodes cannot support the product need.

## 6. Brand Avatar Behavior

The Brand Avatar represents the Brand itself. It should feel like the brand is prepared, observant, and collaborative.

### Voice principles

- Speak in first person plural where appropriate.
- Feel collaborative, never generic.
- Never sound like ChatGPT.
- Never nag, scold, or criticize.
- Prepare, observe, and suggest.
- Express confidence without pretending to know unsupported facts.
- Route users toward action without pressure.

### Example tone

- “I think our Founder Story could create more trust in this campaign.”
- “I found a new angle we may want to test.”
- “Our positioning is becoming clearer.”
- “We have enough context to strengthen this landing page.”
- “I noticed one opportunity to make this campaign feel more specific.”

### Avoid

- “You forgot to complete your Brand Brain.”
- “Your campaign is weak.”
- “I generated tasks for you.”
- “As an AI language model...”
- Generic productivity-dashboard language.

## 7. Implementation Guidance

Recommended future implementation split:

### PR 1: Dashboard 2.0 static layout

- Visual structure only.
- Existing design components.
- Safe placeholders.
- No business logic.
- No new APIs.
- No analytics.
- No assigned-node queries unless already trivial and safe.

### PR 2: Continue Working from existing data

- Use existing recent board/campaign data only.
- Preserve board ownership and routing.
- No new ranking model unless audited.

### PR 3: Brand Evolution from Brand Brain fields

- Read Brand Brain fields.
- Display completeness conservatively.
- Route edits to Brand/Knowledge owner workflows.

### PR 4: Today's Focus from assigned Nodes

- Read assigned/open Nodes if current data supports it.
- Link back to board/node.
- Do not create a separate task system.

### PR 5: Suggested Opportunities placeholder / AI Brain integration

- Start with placeholders or manually curated suggestions.
- Later integrate AI Brain 2.0 after a reasoning/ownership audit.

### PR 6: Live Campaigns after deployment/analytics model

- Only show real running/deployed campaign data.
- Route details to Insights.
- Never fake analytics.

### PR 7: Team Activity meaningful updates

- Use meaningful events only.
- Avoid noisy activity duplication.
- Filter for accepted AI suggestions, asset approvals, node updates, and deployments.

## 8. Risks

- Dashboard owning data.
- Dashboard duplicating Boards.
- Dashboard duplicating Insights.
- Dashboard duplicating AI Brain.
- Adding fake analytics.
- Creating a separate task model too early.
- Adding API assumptions before data ownership is clear.
- Overloading the first screen.
- Making AI sound critical instead of collaborative.
- Showing noisy activity instead of meaningful updates.
- Treating placeholders as real signals.
- Ranking “priority” without a documented model.
- Writing to Brand Brain or Campaigns from Dashboard directly.

## 9. Final Recommendation

The smallest safe first implementation PR should be:

**Dashboard 2.0 static layout / visual structure only.**

It should use existing design components and safe placeholders. It should not add business logic, analytics, AI Brain integration, task models, APIs, deployment data, or new storage.

### PR 1 should include

- Dashboard 2.0 layout shell.
- Daily Briefing Hero placeholder.
- Continue Working placeholder.
- Brand Evolution placeholder.
- Suggested Opportunities placeholder.
- Today's Focus placeholder.
- Live Campaigns section hidden or placeholder-only depending on design decision.
- Team Activity placeholder.
- Existing navigation behavior preserved.

### PR 1 should not include

- Real campaign ranking.
- Real Brand completeness calculation.
- Real AI suggestions.
- Assigned-node task queries.
- Live campaign metrics.
- Team activity aggregation.
- New APIs.
- Writes to any owning object.

## 10. Future Implementation Acceptance Checklist

Before implementing any Dashboard 2.0 section, confirm:

1. What object owns the data?
2. Is Dashboard only reading/displaying/routing?
3. Is the empty state safe and honest?
4. Is any metric real and sourced from the correct owner?
5. Does the copy sound collaborative rather than critical?
6. Does the section avoid duplicating Boards, AI Brain, Insights, or Canvas?
7. Does the implementation avoid new storage unless separately audited?
8. Does the section route users into the owning workspace for edits?
