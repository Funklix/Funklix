# Dashboard Suggested Opportunities Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence MVP PR 12 audit |
| Scope | Suggested Opportunities reads Brand Core and Canvas nodes only |
| Runtime behavior changes | None; Dashboard reads only |
| Files changed | `app.js`, `index.html`, `styles.css`, `docs/audits/2026-06-28-dashboard-suggested-opportunities-audit.md` |

## Audit Findings

### 1. Current Suggested Opportunities markup

Suggested Opportunities is currently static markup with three hard-coded ideas. It has no render target, no empty state, and does not respond to existing Brand Core or Canvas state.

### 2. Brand Evolution helper output

Brand Evolution already exposes safe helper logic for existing Brand Core signal presence and requested strategic knowledge inputs through `getDashboardBrandSignals()` and `getDashboardKnowledgeInputStatus()`. Suggested Opportunities can reuse those read-only helpers without writing Brand data.

### 3. Node types available

Current boards can include node types such as:

- Idea
- Campaign Variation
- Content
- Social Media Posting
- Landing Page
- Email Campaign

The opportunity rules can read node `type`, `status`, `title`, and `content` without mutating nodes.

### 4. Safe rule-based opportunity generation

Safe opportunities should be deterministic, positive, and based on existing data only:

- Founder Story input absent when Brand Core has data -> Explore founder-led storytelling.
- Market Research input absent when Brand Core has data -> Expand ICP research.
- Persona/ICP signal weak or absent when Brand Core has data -> Sharpen audience language.
- Landing Page node exists -> Review landing page message.
- Email Campaign node exists -> Strengthen follow-up sequence.
- Social Media Posting nodes exist -> Turn posts into a campaign sequence.
- Several draft nodes exist -> Review draft-to-ready flow.

No AI, API, analytics, score, or performance claim is involved.

### 5. Fallback

When neither Brand Core signals nor campaign nodes exist, the Dashboard should show:

`Opportunities will appear once Brand Core or campaign nodes are available.`

## Implementation Summary

- Replaced static opportunity cards with a render target and empty state.
- Added read-only rule helpers that derive up to three opportunities from existing Brand Core and node data.
- Rendered Suggested Opportunities when Home renders and through the existing Dashboard refresh helper.
- Added scoped Dashboard styles for opportunity titles/explanations.

## Runtime Confirmation

This PR does not:

- use AI
- add APIs
- write data
- create storage
- score or analyze performance
- change Brand Core persistence
- change node data
- change save/load
- change autosave
- change routing
- change Canvas
- implement AI Brain
- implement Insights
- implement analytics

Dashboard remains read-only.

## Manual QA Checklist

1. Empty state appears when no Brand Core or campaign node data exists.
2. Missing Founder Story creates founder-led storytelling opportunity when Brand Core has data.
3. Board node types create relevant opportunities.
4. No fake analytics, scores, warnings, or AI claims appear.
5. Dashboard remains read-only.
