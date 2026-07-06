# Dashboard Executive Hero Polish Audit

Date: 2026-07-06

## Scope

This is a Dashboard presentation-only polish PR. It updates hero wording, progress copy casing, and Workflow Snapshot accents using existing Dashboard values only. It does not add APIs, AI, persistence, routing, Canvas changes, save/load changes, autosave changes, node behavior changes, status model changes, Dashboard actions, Today's Focus logic, or Suggested Opportunities logic.

## Why the hero became an executive summary

Mission Control should open like an executive briefing, not a technical dashboard. Campaign Health and Continue Working already show board details, progress, workflow counts, campaign structure, and workspace-oriented context. Repeating the campaign name and exact percentage in the hero made the first screen feel more like an admin report than a premium operating system.

The hero now summarizes momentum in one deterministic line, while Continue Working remains the detailed workspace card.

## Why duplication was removed

The previous hero could repeat information already shown below, such as campaign progress and the same next-work cue. The polished hero no longer repeats `Pick up this campaign where you left off.` and no longer restates the Campaign Health percentage when a campaign has nodes. Instead, it uses existing completed/progress values to choose one executive summary line.

## Existing data reused

The hero reuses existing Dashboard values and helpers only:

- safe signed-in first name from `getDashboardUserFirstName()`
- Campaign Health from `getDashboardCampaignHealthModel(state.nodes)`
- completed node count from Campaign Health
- progress percentage from Campaign Health
- Today's Focus first item from `getDashboardTodaysFocusActions()`
- active context from `getActiveContext()`
- current board/campaign name only for zero-node ready-state copy

Workflow Snapshot accent colors reuse existing status buckets and counts. Campaign Structure sorting remains the existing descending count behavior.

## Deterministic executive summary rules

For a campaign with nodes, the hero chooses one line in deterministic priority order:

1. Progress over 80%: `You're approaching launch.`
2. Progress over 50%: `Great progress so far.`
3. Completed count over 0: `Your campaign is taking shape.`
4. Otherwise: `Your next milestone is ready.`

No randomization and no AI are involved.

## Today's Focus sentence

If the existing Today's Focus helper returns an item, the hero shows:

```text
Today you're focusing on:
[Node Title]
```

If no Today's Focus item exists, the focus line is hidden. No new focus logic was introduced.

## Presentation polish

- Campaign Progress copy now uses lower-weight wording: `X approved · Y remaining`.
- Workflow Snapshot KPI cards get subtle status accents: green for Completed, amber for In Review, neutral for Draft, and soft red for Needs Changes.
- No chart, extra button, or layout expansion was added to the hero.

## Runtime confirmation

Dashboard remains read-only. This PR updates deterministic text and scoped Dashboard styles only. It does not mutate nodes, write status, create storage, call AI, call APIs, change routing, touch Canvas, change save/load, change autosave, or alter Dashboard action behavior.
