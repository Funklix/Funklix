# BW-33.5.1 operator runbook (Felix)

This is an unapplied, one-table follow-up to the already-applied BW-33.5 boundary. Never edit or replay the original migration, add permissive policies, or reconstruct the SQL in Supabase Assistant.

## Manual production gate

1. Confirm the application still works before execution.
2. Confirm the latest Supabase backup or recovery point remains available.
3. Open a new Supabase SQL Editor query.
4. Paste and run only the BW-33.5.1 delta migration.
5. Confirm `Success. No rows returned`.
6. Run the separate BW-33.5.1 verification query.
7. Confirm exactly one row with `compliant = true`.
8. Open Tendra One.
9. Sign in with Google.
10. Open Social Connections.
11. Confirm connected-account and publishing-destination state loads.
12. Open Content Workspace.
13. Confirm existing content loads.
14. Confirm paused or disabled publishing remains unchanged.
15. Refresh Supabase Security Advisor.
16. Confirm zero remaining security errors.

Run `migrations/20260914_bw33_5_1_social_publishing_destinations_rls.sql` once and then run `migrations/20260914_bw33_5_1_social_publishing_destinations_rls.verify.sql` separately. Stop on any prerequisite error or any verification result other than exactly one compliant row.

Use `migrations/20260914_bw33_5_1_social_publishing_destinations_rls.rollback.sql` only if the delta migration errors or the immediate Social Connections/publishing-destination smoke test fails. The rollback does not restore browser-role grants. Capture the exact error and escalate rather than editing SQL or toggling RLS manually.
