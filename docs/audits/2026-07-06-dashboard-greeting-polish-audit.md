# Dashboard Greeting Polish Audit

Date: 2026-07-06

## Scope

This is a Dashboard hero presentation polish only. It changes the greeting text from time-of-day language to a timeless conversational greeting. It does not modify Dashboard intelligence, routing, save/load, autosave, Canvas, AI, persistence, Mission Insight logic, Today's Focus logic, or Continue Campaign behavior.

## Time-independent greeting

The hero no longer uses `Good morning`, `Good afternoon`, or `Good evening`. The greeting is now independent of current time and renders as:

- `Hi <FirstName>,` when a safe first name exists.
- `Hi there,` when no safe display name exists.

## Existing user helper reused

The implementation continues to use the existing `getDashboardUserFirstName()` helper. That helper already trims the signed-in user's display name, extracts the first token, and suppresses the placeholder `Google user`, so this PR does not introduce new user identity logic.

## Runtime confirmation

Only the greeting string changed. The rest of the hero remains as-is, including campaign momentum, Today's Focus, Mission Insight, avatar rendering, and CTA behavior. No data is written and no runtime authority changed.
