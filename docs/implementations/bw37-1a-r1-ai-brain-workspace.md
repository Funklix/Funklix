# BW-37.1A-R1 — AI Brain workspace and scroll lifecycle

Base: `95e0839721dac65fef907a0f915c0d35e53c7217`, latest merged main including #816.

## Inspected dependencies and root cause

`index.html` retains `#ai-brain-view`, its legacy title, and `#ai-brain-summary.boards-library-panel`. The inline shared panel rule limits height to `calc(100vh - 210px)`. Historical `styles.css` further centers the view at 1180px and the conversation at 860px; the transcript has its own `max-height:52vh` and `overflow:auto`. The non-Canvas shell and shared summary can also scroll. Dark mode imposes `min-height:100%` on the view. Mobile navigation and the floating Workspace/Brand switcher occupy the bottom of the shell.

`renderAiBrain()` captures a draft and composer focus, then assigns the entire workspace's `innerHTML`. Every pending, completed, retry, language or background render therefore destroys the existing transcript scroll element. The new transcript starts at `scrollTop=0`; the existing focus restoration uses `preventScroll` and cannot restore that destroyed element's reading position. There was no latest-exchange scroll policy. This is a DOM replacement lifecycle bug, not a provider issue.

The production renderer then builds safe formatted-answer DOM, Avatar identity, Learning disclosures and Content-node previews, and rebinds form, mode, retry, prepare, cancel and create handlers. Advice success is already gated by request ID, account/Board lifecycle and Canvas context identity. Navigation calls `renderCampaignIntelligence()` after toggling visibility; background renders can therefore happen while Brain is hidden. These dependencies were inspected and reported before implementation.

## Changes

- Scoped overrides in `ai-brain-learning-context.css` remove the shared panel height cap and nested width limits. The workspace uses the available shell width up to 1560px, with 24px desktop gutters and 12px small-screen gutters. Answer text remains capped at 78ch. The historical shared stylesheet stays byte-for-byte unchanged, preserving BW-36.6's integrity assertion.
- A compact Avatar/header and wrapping Board, selected-node, node-count and saved/unsaved context sit above a flexible transcript. User questions use a subdued violet surface. Advisor responses use semantic typography, wider spacing and fewer nested borders. Existing safe Markdown rendering is unchanged.
- The composer occupies the bottom grid row. Conversation focus, freeform input, pending/disabled submission, mode semantics and retry handlers remain the existing controls. Mobile layout reserves room for the existing floating shell controls. Reduced motion, visible focus, 320px wrapping and a keyboard-sized compact presentation are covered.
- Rendering snapshots the visible transcript message and its relative offset, then restores that anchor after rebuilding the DOM. A reader at the end follows updates; new submissions/retries explicitly reveal their user message and pending response. On completion, a following reader sees the start of the latest exchange, including the beginning of a long answer. A reader who has scrolled up stays in place. Short exchanges clamp naturally to the end.
- A localized, keyboard-accessible **Jump to latest** appears when there is content below the reader. It moves only the transcript, then focuses that region with `preventScroll`. The transcript has an accessible name, focus target and pending `aria-busy` state.
- DOM-owned scroll metadata is guarded by account/Board identity, request generation, active-view visibility and the current transcript element. It is not a conversation store. Hidden renders defer restoration until the view is visible. Observers and visual-viewport listeners are disconnected when replaced. `ResizeObserver` handles message reflow, image loading and viewport changes; the scoped `ai-brain-workspace-viewport.js` helper handles visual-viewport keyboards that shrink the visible area without changing layout media queries. No fixed delays, animation timers, global scrolling or `scrollIntoView` are used.
- Existing draft/caret/direction preservation continues within the same identity. Old drafts and scroll positions cannot cross account/Board switches, including explicit invalidation before rerendering. Open Learning disclosures and focused transcript/Jump controls survive legitimate rerenders.

No API contracts, provider policy, SQL, authorization, knowledge persistence, autosave, diagnostics, campaign generation or Content-node mutation handlers were changed. The renderer's legacy signature is preserved because existing regression suites identify that boundary. The keyboard binding is isolated in a presentation-only helper loaded before `app.js`, preserving BW-27.7's unchanged guard on the two existing application/window resize listeners. It has no domain state or mutation API.

## Validation and evidence

`npm run check:bw37.1ar1` runs the real application in Chromium using the existing disposable authorized Board fixture. Advice transport alone is intercepted; requests never reach a provider. It asserts:

- empty/new conversation, original approved Avatar source and Learning disclosure continuity;
- multiple exchanges, safe Markdown, new question/pending visibility, lengthy responses, manual wheel scrolling, background rerenders and keyboard Jump to latest;
- failed requests/retry, navigation/back, account and Board switching, explicit invalidation and stale response suppression;
- draft value, caret range/direction, keyboard focus, all five modes, EN/DE, Light/Dark, desktop/tablet/375px/320px, reduced motion, mobile control hit-testing and both resized-layout and visual-viewport keyboards;
- no Canvas/Brand mutations, no unintended writes and no scrolling of the unrelated Canvas.

The existing BW-37.1A suite separately retains API/ACL/language/mode semantics and full-shell coverage. Existing BW-26/BW-28/BW-36 suites, including the controlled Content-node preview/confirmation boundary, remain registered without weakened assertions. The new test and syntax check are added to Runtime Boot Safety's existing PostgreSQL 17.6/18.4 matrix.

Real Chromium comparison captures use the same full application shell, authorized fixture, twelve-exchange conversation and approved Avatar on baseline main and the proposed branch:

| Viewport/theme | Before | After |
| --- | --- | --- |
| Desktop 1440px Light | [Before](bw37-1a-r1-visuals/before/conversation-1440-light.png) | [After](bw37-1a-r1-visuals/after/conversation-1440-light.png) |
| Desktop 1440px Dark | [Before](bw37-1a-r1-visuals/before/conversation-1440-dark.png) | [After](bw37-1a-r1-visuals/after/conversation-1440-dark.png) |
| Mobile 375px Light | [Before](bw37-1a-r1-visuals/before/conversation-375-light.png) | [After](bw37-1a-r1-visuals/after/conversation-375-light.png) |
| Mobile 320px Dark | [Before](bw37-1a-r1-visuals/before/conversation-320-dark.png) | [After](bw37-1a-r1-visuals/after/conversation-320-dark.png) |

These are provider-free browser fixtures, not claims of live model usefulness. Final CI and Codex review status are recorded on the PR. No merge or deployment is requested.
