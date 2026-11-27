# BW-47.2 Guided Brand Builder

Base: `a38723b`, the merge of PR #868. The Builder opens from the regular Brand Profile and from new Brand setup. Existing links into a named Profile section still open that section directly.

## Guided flow

| Step | What users can do |
| --- | --- |
| Discover | Enter a website or a short description, review partial research coverage and source evidence, or continue directly. The optional Founder/About URL opens the existing Founder facts review. Successful research opens the first step with results to review, starting with Foundation when it has results. Foundation is also the fallback. |
| Foundation | Review and edit Brand description, Value Proposition, Mission, Vision and Values. |
| Audience & Offers | Work on Personas, or open the existing Audience, Offers & Proof and Advanced options editors. |
| Voice & Messaging | Work on Tone of Voice, Key messages, Content guidelines, Keywords, Communication guidelines and Voice examples. |
| Brand Identity | Work on the asset fields for colors, typography and references. Open the existing Founder Story, Brand DNA, Brand Assets or Brand Avatar workflows. |
| Review & Continue | Review drafts across all sections, accept eligible drafts together, see saved evidence and previous decisions, and return to the workspace or continue to the project. |

Navigation is available at every step. Back and Continue move between steps without requiring a strategy field, and each guided step is directly selectable. The Full Brand Profile disclosure retains Overview, all existing sections and specialized tools. Advanced options still opens the established canonical editor.

## Requests and authorization

The Builder uses `POST /api/enrich-brand-profile` on explicit user action. Section generation sends `action: 'draft'`, the BW-47.1 section identifier and the corresponding supported `targetFields`, narrowed to fields that the Builder can generate without replacing pending reviews. Field actions send `action: 'suggest'` and the matching single-field scope. An eligible saved value uses the improvement intent and a positive keep-current result when there is no supported improvement. Section requests include the same intent so they can improve saved fields while suggesting content for empty fields. Each request includes language, current Brand and Workspace IDs, and canonical revision. Changing sections alone issues zero inference calls.

Discovery reuses the existing multi-page research route and its diagnostics. Section assistance uses the server's authorized canonical context, approved Founder and DNA context, and short still-current accepted citations from discovery and prior reviews. Those calls omit the website URL and perform zero recrawls. The user can explicitly run new website research. The coverage view reports retrieval and processed excerpts separately and shows known gaps.

Optional questions use `action: 'questions'` and the same exact field scope. The endpoint returns localized questions without inference. Users can skip, reopen and edit an answer before explicitly requesting a draft. Answers go through the existing grounding contract as user-provided context. The Brand editor capability and existing server workspace membership, identity and revision checks govern each request and canonical mutation. Viewers can navigate and read saved values.

## Review and persistence

Guided field cards show saved canonical values and local drafts independently, with structured manual and proposal editors. The UI marks a saved value as user-confirmed only when it matches the corresponding accepted record. The sidebar counts saved fields and current draft suggestions. An optional gap has no completion penalty. Review actions include editing, individual acceptance, rejection, deferral, optional refinement and source access. Invalid, withheld and conflicting results are labeled separately. Existing records and citations remain available in Review.

Section acceptance uses the same eligibility planner as global acceptance with the supported active-section keys supplied to the planner. The planner excludes stale, invalid, conflicting, unavailable, missing and unchanged suggestions, and exposes the reasons. An edited draft keeps its original provenance and the accepted edited value. When drafts from multiple requests coexist, each retains its own origin and input association.

The controller submits one `profile_edit` command. It uses the existing server preview and signed review token for every section acceptance, including batches of empty-field additions. The existing confirmation dialog shows before and after fields and any exclusions. Cancel or Escape leaves the drafts and saved revision intact. Confirmation submits one protected mutation. An authoritative read verifies the complete resulting core, Brand name and revision before the controller removes the confirmed decisions. The full Review keeps global Accept All, and the existing write paths govern individual decisions. Canonical acceptance leaves campaign snapshots isolated.

## Accessibility and visual behavior

The Builder uses Tendra One theme tokens in Light and Dark Mode. The sidebar becomes an inline navigation grid in narrow viewports. Headings receive focus after step navigation. Native buttons and disclosures provide keyboard and screen-reader semantics, with named navigation regions, current-step announcements and polite feedback. The existing confirmation dialog starts on Cancel, contains focus, supports Escape, and restores focus to the originating action. Existing reduced-motion and forced-colors styles apply. English and German cover navigation, assistance, statuses and review actions.

## Browser captures

These captures use the actual application with the fictional Northstar Toolworks fixture, mocked inference and local transports. To regenerate them, run `node scripts/check-bw47-2-guided-brand-builder-browser.js`. Runtime Boot Safety exports the captures from each PostgreSQL job.

| Screen | Capture |
| --- | --- |
| Guided Builder overview | [Discover](bw47-2-guided-brand-builder/overview.png) |
| Foundation | [Foundation](bw47-2-guided-brand-builder/foundation.png) |
| Audience & Offers | [Audience](bw47-2-guided-brand-builder/audience.png) |
| Voice & Messaging | [Voice & Messaging](bw47-2-guided-brand-builder/voice.png) |
| Brand Identity | [Brand Identity](bw47-2-guided-brand-builder/identity.png) |
| In-context section suggestions | [Suggestions](bw47-2-guided-brand-builder/suggestions.png) |
| Protected section confirmation | [Confirmation](bw47-2-guided-brand-builder/confirmation.png) |
| German mobile, Dark Mode | [Mobile and Dark Mode](bw47-2-guided-brand-builder/mobile-dark-de.png) |

## Regression coverage

| Behavior | Evidence |
| --- | --- |
| New, partial and populated profiles, Discover handoff, six freely navigable steps | BW-47.2 browser, BW-36 setup and profile-entry checks |
| Exact scope, scoped field and section requests, improvement, no change, missing inputs, optional and skipped questions | BW-47.2 browser and BW-47.1/R1 |
| Typed editing, per-field accept/reject/defer, section/global batches, one reviewed PUT, cancellation and exclusions | BW-47.2 browser, BW-46.6, BW-47.1/R1 |
| Save, reload, re-edit, Brand switching, stale revisions, viewer permissions | BW-47.2 browser, BW-36 lifecycle/protection, BW-46 field integrity |
| Founder Story, DNA, Assets, Avatar, Advanced options, campaign snapshot isolation | BW-47.2 browser, BW-36 and BW-42 profile flows, BW-46.3 |
| EN/DE, Light/Dark, 320px–desktop reflow, native Chromium 200%, keyboard and focus restoration | BW-47.2 browser, BW-42 and BW-46.3 |
| Research source security and partial coverage | BW-46.1, BW-46.4, BW-47.1/R1 |

The local BW-47.2 Chromium journey passed in both languages, plus the read-only viewer and native 200% zoom runs. The focused BW-46 and BW-47 regressions passed after updating legacy browser entry paths to open the Full Brand Profile. The compatibility checks retained their existing authorization, mutation and persistence assertions.

Runtime Boot Safety runs the browser journey on both PostgreSQL 17.6 and 18.4. A local replay reproduced the existing BW-43 Expanded Journey sources reflow assertion on both the implementation and exact merged base with system Chromium. Its separate native 200% zoom check passed on the base. Hosted job results are available in the pull request checks.

## Remaining limitations

Discovery evidence becomes reusable by later requests when the user accepts the relevant suggestion and the saved value still matches. Pending research and optional answers stay in memory for the authorized account and Brand during the session. A new browser session rebuilds the view from saved canonical values and evidence decisions. An independent revision change invalidates pending proposals until an explicit new request. The fixtures exercise workflow and grounding with mocked responses. Live model quality was outside this verification.

## Repository map

`app.js` owns the Brand workspace and account-scoped pending data. `brand-profile-setup.js` owns guided navigation, the existing `data-profile-key` actions, manual and proposal editors, and the `brand-suggestion-review-title` dialog. `brand-profile-setup.css` and `language.js` own the presentation and copy. `brand-enrichment-contract.js` plans canonical changes and evidence provenance. `brand-write-contract.js` submits preview, confirmation and the single protected write. The production handler and specialized editors keep their existing routes and authority.
