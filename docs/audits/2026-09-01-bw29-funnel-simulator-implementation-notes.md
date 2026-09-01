# BW-29 Funnel Simulator — implementation notes

## Investigation and go/no-go

The application is a classic-script, single-page workspace. `setActiveView` is the central visibility and selected-navigation switch; stable destinations are permanent sibling `<section>` elements and sidebar buttons. AI Insights and AI Brain already follow this pattern. No dormant Simulator route, element, icon, label, or state existed. A new scoped navigation ID and permanent sibling section can therefore be added without removing or renaming stable DOM. **Go:** all six go/no-go conditions are satisfied.

The Canvas model is held in the in-memory `state.nodes`/`state.edges` arrays and is serialized only by the established Board save path. Active Board, account, public token, access and `boardLoadGeneration` form the protected lifecycle. View rendering is synchronous. BW-28's `analyzeCampaign` projects the five canonical stages (Awareness, Interest, Consideration, Conversion and Retention) from each node's explicit `funnelStage`, plus bounded node-role rules: Idea and Social Media Posting contribute Awareness, Content contributes Interest, and Landing Page/goal/CTA rules contribute Conversion. A `Set` makes stage projections unique.

The current Board name, explicit node audiences, channel/social-platform strings, unique stage coverage, node count, and saved/unsaved state are safe descriptive context. Diagnostic/AI Review scores, node counts, content length, coverage percentage, ICP/tone consistency, CTA structure and inferred mappings are **not** performance assumptions and must never populate a rate. The implementation displays context but leaves every numerical field empty.

The existing deliberate BW-28.1 handoff opens AI Brain and fills `#ai-brain-question` without submitting. It can safely be reused without changing the request contract. Existing eligibility is authenticated editor access outside Public Viewer mode. Public Viewers may use local assumption controls because they cannot mutate the Canvas; handoff is suppressed.

Existing number formatting uses `Intl`; BW-29 uses explicit `en-US`/`de-DE` locales and an explicit EUR/USD/GBP selector. Theme surfaces use the established CSS variables, selected nav treatment, responsive grids, and no chart dependency. Browser integrity checks every local classic script with `vm.Script`. Dynamic values are inserted with `textContent`; bounded scenario and context projections are never interpolated as HTML.

## Blast radius and architecture

The change adds one isolated UMD browser module, one navigation button, one view section, scoped CSS, one German nav translation, a small `app.js` adapter, this audit, and one regression check/workflow entry. The module owns ephemeral state in a closure. It has no storage, fetch, URL, cookie, analytics, Board/Brand serialization, dirty-state, autosave, Canvas mutation, generation, repair, review, or provider dependency. Its identity includes account, Board, load generation, access and Public Viewer token; a changed identity resets assumptions before rendering. Refresh naturally recreates empty state.

## Data and calculation contract

A scenario accepts only these own fields: bounded normalized name, integer starting audience (1–1,000,000,000,000), four rates (0–100 with four decimal places), optional budget/value (0–1,000,000,000,000 with two decimals), and EUR/USD/GBP. Unexpected fields and non-plain shapes fail validation. Scientific notation, NaN, Infinity and negatives are rejected.

For both Baseline and Alternative independently:

- `awareness = startingAudience`
- `interest = awareness × awarenessToInterest / 100`
- `consideration = interest × interestToConsideration / 100`
- `conversion = consideration × considerationToConversion / 100`
- `retention = conversion × conversionToRetention / 100`

Full numeric precision feeds later stages; rounding occurs only for displayed counts. Each transition exposes absolute drop-off, entered rate and `100 − rate` loss. Optional outputs are budget/conversions, budget/retention, conversions × value, and conversion value/budget under their documented non-zero conditions. Invalid divisions are unavailable, never zero, Infinity, NaN or negative zero.

Alternative starts empty, can copy Baseline only through an explicit action, and thereafter calculates independently. No optimization, multiplier, default rate, benchmark or AI assumption exists. Comparison reports stage counts, signed absolute difference, and percentage difference only when Baseline is non-zero.

## Honesty, methodology, and lifecycle

The header always classifies the page as a simulation based on user assumptions and explicitly says it is neither measured performance nor a prediction. Funnel, comparison and commercial results remain separate from AI Insights and Measured Performance. The collapsed methodology discloses formulas, rounding, inputs, limitations, absence of benchmarks/measurement/prediction, and the descriptive-only Canvas boundary. All entered assumptions remain visible outside it.

Reset confirms after meaningful input and resets only module memory. Board/account/access/public-mode generation changes invalidate module identity. Leaving the view preserves memory only inside the same authorized lifecycle. Public Viewer assumptions remain local and Board data remains read-only. The optional editor-only handoff builds a bounded, editable prompt containing assumptions, modeled volumes, Board/channel/stage context, and the simulated classification; opening AI Brain neither submits nor creates a transcript turn.
