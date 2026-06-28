# Dashboard 2.0 Wireframe and Implementation Spec

| Field | Value |
|---|---|
| Status | Planning Spec |
| Owner | Product |
| Last Updated | 2026-06-27 |
| Scope | Documentation only; no runtime implementation |

## 1. Product Intent

Dashboard 2.0 is **Funklix Mission Control**: the daily morning briefing for the AI Marketing Operating System.

It is not a homepage, widget collection, reporting surface, or workspace. Its job is to answer one question quickly:

> What deserves my attention today?

Dashboard 2.0 should reduce complexity into a curated briefing that routes the user into the correct owning workspace.

### Dashboard 2.0 should

- Prioritize attention instead of showing everything.
- Show where the user should continue working.
- Surface how the Brand is evolving over time.
- Show AI-prepared opportunities and ideas.
- Highlight today's focus with a small number of meaningful actions.
- Show live campaign status only when deployed or running campaign data exists.
- Guide the user into the right workspace: Board, Campaign Canvas, Brand Brain, AI Brain, Insights, or Knowledge.

### Dashboard 2.0 should not

- Own business logic.
- Become Insights.
- Become AI Brain.
- Become Boards.
- Become a task-manager database.
- Show everything that exists in the product.
- Calculate canonical campaign, brand, analytics, knowledge, or AI truth directly.

## 2. Dashboard 2.0 Wireframe

```text
+--------------------------------------------------------------------------------+
| FUNKLIX MISSION CONTROL                                                        |
|                                                                                |
| A. DAILY BRIEFING HERO                                                         |
|    [Brand Avatar]                                                              |
|    "Good morning. Our positioning is becoming clearer."                       |
|    "I found one campaign angle we may want to test today."                    |
|                                                                                |
|    Primary CTA: [Continue Campaign] or [Open Priority Board]                   |
+--------------------------------------------------------------------------------+

+--------------------------------------+-----------------------------------------+
| B. CONTINUE WORKING                  | C. BRAND EVOLUTION                     |
|                                      |                                         |
| One recommended campaign/board       | Brand Brain completeness               |
| Status: Draft / Reviewing / Ready    | Newest learning                        |
| Completeness: 68%                    | Suggested improvement                  |
| Latest meaningful update             | Missing knowledge inputs               |
| Next suggested action                | - Founder Story                        |
| CTA: Open where I left off           | - Market Research                      |
|                                      | - Pitch Deck                           |
|                                      | - Whitepaper                           |
|                                      | - Business Plan                        |
+--------------------------------------+-----------------------------------------+

+--------------------------------------+-----------------------------------------+
| D. SUGGESTED OPPORTUNITIES           | E. TODAY'S FOCUS                       |
|                                      |                                         |
| AI-prepared ideas with positive tone | Top 3 assigned/open node-based actions |
| - New campaign angle                 | 1. Review landing-page hero node       |
| - Positioning idea                   | 2. Approve campaign email node         |
| - Content opportunity                | 3. Complete audience objection node    |
| - Competitor-based suggestion        | Each links back to board/node          |
+--------------------------------------+-----------------------------------------+

+--------------------------------------+-----------------------------------------+
| F. LIVE CAMPAIGNS                    | G. TEAM ACTIVITY                       |
| Conditional: only if deployed or     | Meaningful updates only                |
| running campaign data exists         | - AI suggestion accepted               |
|                                      | - Asset approved                       |
| Lightweight status only              | - Team member updated node             |
| Detailed analytics live in Insights  | - Campaign deployed                    |
+--------------------------------------+-----------------------------------------+
```

### A. Daily Briefing Hero

The hero should be the emotional and informational anchor of the Dashboard. It should show the Brand Avatar, a first-person Brand greeting, one concise daily insight or suggestion, and one primary CTA.

The CTA should route to the most relevant continuation point, such as **Continue Campaign** or **Open Priority Board**. It should not offer a broad menu of unrelated actions.

### B. Continue Working

Continue Working is the most important operational card. It should show one most relevant campaign or board, not a full recent-items list.

It should include:

- Campaign or board name.
- Campaign status.
- Campaign completeness.
- Latest meaningful update.
- Next suggested action.
- Direct link to the exact workspace where work should continue.

### C. Brand Evolution

Brand Evolution shows that the Brand Brain is becoming more useful over time. It should avoid generic health-score language and focus on progress, learning, and missing inputs.

It should include:

- Brand Brain completeness.
- Newest learning.
- Suggested improvement.
- Missing knowledge inputs, such as Founder Story, Market Research, Pitch Deck, Whitepaper, or Business Plan.

### D. Suggested Opportunities

Suggested Opportunities should inspire action. The tone must be positive and opportunity-based. It should avoid problem, nagging, or failure language.

Examples:

- New campaign angle.
- Positioning idea.
- Content opportunity.
- Competitor-based suggestion.

### E. Today's Focus

Today's Focus should show the top three assigned or open tasks. The preferred product model is that tasks are derived from assigned nodes whenever possible.

Each item should link back to its owning board and node. Dashboard should not introduce separate task ownership unless a future audit proves assigned nodes cannot support the required workflow.

### F. Live Campaigns

Live Campaigns should be conditional. It should appear only when deployed or running campaign data exists.

The section should show lightweight orientation only, such as Planning, Running, Learning, or Completed. Detailed metrics, diagnostics, trends, and performance analysis belong to Insights.

### G. Team Activity

Team Activity should surface meaningful collaboration only. It should avoid noisy activity streams.

Examples of meaningful updates:

- AI suggestion accepted.
- Asset approved.
- Team member updated a node.
- Campaign deployed.

## 3. Data Ownership

Dashboard owns no canonical product knowledge. It reads, summarizes, and routes. It may own presentation preferences only.

| Section | Owner | Reads From | Writes To | May Modify? | Empty State |
|---|---|---|---|---|---|
| Daily Briefing Hero | Dashboard presentation; Brand Avatar owned by Brand Brain | Brand Brain, AI Brain activity, current continuation target | Dashboard display preferences only | No domain modification; may route via CTA | Calm welcome with setup CTA to Brand Brain or first campaign |
| Continue Working | Campaigns, Boards, Campaign Canvas | Campaigns, Boards, Nodes, recent navigation state | None, except navigation intent | No | "No active campaign yet" with CTA to create/open a campaign workspace |
| Brand Evolution | Brand Brain and Knowledge | Brand Brain fields, Knowledge status, accepted learnings | None | No; routes to Brand Brain or Knowledge workflows | "Start by adding Founder Story, Market Research, or Pitch Deck" |
| Suggested Opportunities | AI Brain; later Insights-supported recommendations | AI Brain recommendations, Brand Brain, Knowledge, Insights where available | AI Brain-owned recommendation artifacts only when generated by AI Brain | Dashboard no; AI Brain may create recommendations in its own store | Safe placeholder opportunities or "No prepared opportunities yet" |
| Today's Focus | Campaign Canvas Nodes; Team assignments | Nodes, Boards, Campaigns, Team assignment metadata | None | No | "No assigned nodes need attention right now" |
| Live Campaigns | Campaigns and Insights/analytics layer | Campaign deployment status, lightweight campaign state, Insights summaries | None | No | Hide section entirely until deployed/running data exists |
| Team Activity | Team activity and owning product objects | Team activity, Nodes, Campaigns, Assets, AI Brain decisions | None | No | "No meaningful updates yet" or hide if empty |

## 4. MVP vs Later

### A. Daily Briefing Hero

**MVP**

- Static layout with Brand Avatar placeholder.
- Safe sample first-person Brand greeting.
- CTA using existing route/link targets only if available.

**Later**

- Dynamic Brand greeting from Brand Brain and AI Brain activity.
- Personalized morning briefing generation.
- Priority selection based on real attention signals.

### B. Continue Working

**MVP**

- Static or safely derived placeholder card.
- Use current local/existing board or campaign data only if already exposed safely.
- No new ranking algorithm.

**Later**

- Recent meaningful work detection.
- Campaign completeness from campaign/node status.
- AI-suggested next action from campaign context.

### C. Brand Evolution

**MVP**

- Placeholder completeness and missing-input labels.
- Link to Brand Brain or Knowledge if an existing safe route exists.

**Later**

- Brand Brain field completeness.
- Newest accepted learning.
- Knowledge freshness and missing-input detection.

### D. Suggested Opportunities

**MVP**

- Safe placeholder examples written as opportunities.
- No fake analytics or invented evidence.

**Later**

- AI Brain-generated recommendations.
- Insight-backed opportunities.
- Competitor and Knowledge-driven suggestions.

### E. Today's Focus

**MVP**

- Placeholder top-three focus items or safely derived open assigned nodes if already available.
- Links back to board/node only where IDs and routes already exist.

**Later**

- Assigned-node query.
- Priority ranking by status, due date if later introduced, campaign importance, and owner.
- Team-aware filtering.

### F. Live Campaigns

**MVP**

- Do not show unless existing deployed/running campaign data is available.
- Prefer hiding over fake status.

**Later**

- Deployment state integration.
- Lightweight status from campaign execution model.
- Insights summaries with deep links to detailed analytics.

### G. Team Activity

**MVP**

- Safe placeholder or hide if no meaningful local activity exists.
- Do not create a noisy audit log.

**Later**

- Collaboration event model.
- Meaningful-event filtering.
- Activity links to nodes, assets, campaigns, or AI Brain decisions.

## 5. Task Model Recommendation

Dashboard should treat **tasks as assigned nodes** for the foreseeable product model.

Recommended model:

- A task is a node that requires attention.
- Assignment, status, and context belong to the node, board, campaign, and team ownership layers.
- Dashboard reads those nodes and displays the top three most relevant actions.
- Each focus item routes back to the owning board/node where work happens.

Dashboard should not create a separate task system in the first implementation. A separate task ownership system should only be considered after a future audit proves that node assignment cannot support cross-campaign accountability, due dates, recurring operational work, or non-canvas work without overloading nodes.

## 6. Brand Avatar Behavior

The Brand Avatar represents the Brand itself. It is not a generic assistant and should never sound like ChatGPT.

### Principles

- Speak as the Brand, not as an external bot.
- Use first person plural where appropriate.
- Feel collaborative, observant, prepared, and strategic.
- Never nag, criticize, shame, or overstate certainty.
- Suggest rather than command.
- Prefer calm confidence over urgency theater.
- Avoid generic phrases like "As an AI" or "I can help you with."

### Example tone

- "I think our Founder Story could create more trust in this campaign."
- "I found a new angle we may want to test."
- "Our positioning is becoming clearer."
- "We may have an opportunity to turn this objection into a stronger landing-page section."
- "I noticed this campaign is close to review-ready."

## 7. Implementation Guidance

The safest future implementation is a sequence of small PRs with narrow blast radius:

1. **PR 1: Dashboard 2.0 static layout and visual structure only**
   - Use existing design components/patterns where possible.
   - Use safe placeholders.
   - Do not add business logic.
   - Do not modify Campaign Canvas, Campaign V3, save/load, auth, routing contracts, API files, or analytics.
2. **PR 2: Continue Working from existing recent board/campaign data**
   - Read only from already available local/existing data.
   - Add no new persistence ownership.
3. **PR 3: Brand Evolution from Brand Brain fields**
   - Read Brand Brain fields and Knowledge status.
   - Route users to owning workflows for edits.
4. **PR 4: Today's Focus from assigned nodes**
   - Read assigned/open node metadata.
   - Link back to board/node.
   - Do not create separate task storage.
5. **PR 5: Suggested Opportunities placeholder, then later AI Brain integration**
   - Keep MVP opportunities clearly placeholder or recommendation artifacts owned by AI Brain.
   - Avoid fake evidence.
6. **PR 6: Live Campaigns only after deployment/analytics model exists**
   - Add conditional visibility.
   - Keep detailed analytics in Insights.

## 8. Risks

- Dashboard starts owning canonical data instead of orchestrating.
- Dashboard duplicates Boards by becoming an all-projects view.
- Dashboard duplicates Insights by showing detailed metrics, diagnostics, and trends.
- Dashboard duplicates AI Brain by becoming a strategy conversation surface.
- Dashboard adds fake analytics or simulated campaign status without evidence.
- Dashboard creates a separate task model too early.
- Implementation assumes APIs, analytics, collaboration, or deployment models that do not exist yet.
- First screen becomes overloaded and stops answering what deserves attention today.
- AI copy sounds critical, nagging, or generic instead of collaborative and Brand-led.
- Static placeholders are mistaken for real intelligence.

## 9. Final Recommendation

The smallest safe first implementation PR should be:

**Dashboard 2.0 static layout / visual structure only, using existing design components, with safe placeholders and no business logic.**

That PR should not modify runtime behavior outside the existing Dashboard surface, should not introduce storage, should not create APIs, should not add analytics assumptions, and should not change Campaign Canvas, Campaign V3, save/load, auth, routing, or existing campaign behavior.
