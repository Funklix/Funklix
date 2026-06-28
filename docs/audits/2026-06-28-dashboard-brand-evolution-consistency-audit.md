# Dashboard Brand Evolution Consistency Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Dashboard Intelligence polish audit |
| Scope | Brand Evolution wording and Continue Working / Live Campaigns visual separation |
| Runtime behavior changes | None |
| Expected files | `app.js`, `styles.css`, `docs/audits/2026-06-28-dashboard-brand-evolution-consistency-audit.md` |

## Audit Findings

### 1. Live Campaigns placement

The Live Campaigns empty-state copy is in the Live Campaigns support section, not in the Continue Working markup. The visual issue is presentation: the Dashboard needs clearer section separation so Continue Working visibly ends after its own footer/action area and Live Campaigns reads as a lower-priority support section.

### 2. Brand Evolution completeness wording

Brand Evolution currently summarizes Brand Core signal completeness separately from missing strategic knowledge inputs. When all ten Brand Core signal groups are present, the card can say `10 of 10 Brand Core signals present` while still showing Missing Knowledge pills. That is technically accurate but confusing because it does not explain that these are different dimensions.

### 3. Safe wording change

The safest fix is to keep the same passive reads and update the summary copy to distinguish:

- Brand Core signals present
- strategic knowledge inputs missing

Example:

`10 of 10 Brand Core signals present. 5 strategic inputs still missing.`

### 4. Suggested improvement behavior

If Brand Core signals are complete but strategic knowledge inputs remain missing, the suggested improvement should reference the missing input count and next missing input. This avoids implying the Brand is fully complete.

## Smallest Safe Implementation

1. Keep Brand Core completeness calculation as-is.
2. Keep missing knowledge pill rendering as-is.
3. Update the Brand Evolution completeness sentence to include the missing strategic input count.
4. Update suggested improvement wording when missing strategic inputs remain.
5. Add scoped Dashboard spacing/separation so Live Campaigns remains visually detached from Continue Working.

## Runtime Confirmation

This polish does not change:

- runtime ownership
- Brand Core persistence
- `getActiveContext()`
- save/load
- autosave
- routing
- Canvas
- APIs
- Brand records

All reads remain passive.

## Manual QA Checklist

1. Continue Working no longer appears visually connected to Live Campaigns copy.
2. Live Campaigns empty state appears only in the Live Campaigns section.
3. Brand Evolution copy distinguishes Brand Core signals from strategic knowledge inputs.
4. Missing knowledge pills still render.
5. Brand Core editing still works.
