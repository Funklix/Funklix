# BW-40.1 — Stable references and prompt shortcuts

Base: merged main including PR #843 (`8def2f4`).

## Historical identity

PR #843's unresolved P2 finding concerns retained positional labels. The client now captures the ordered Canvas ID/type mapping at Advice dispatch. Before rendering or dispatching another question, it checks retained successful turns containing Node #N labels. If the mapping changed or is unknown, it invalidates the affected conversation with the existing request/source cleanup, clears the ambiguous draft, and shows an EN/DE explanation. Dispatch stops before inference. A new question must be deliberately entered with the current Canvas context.

Reference objects are never relabeled or rebound. Unchanged mappings preserve follow-up history and existing reference cards. All existing click authorization, scope revisions, freshness validation, and exact Canvas/Inspector navigation remain intact. No provider prompt, output schema, API contract, database, model, quota, or Canvas write changes.

Conservative limitation: adding, deleting, reordering, or changing the type of a node resets a conversation containing positional labels, even when a particular referenced node survives. Content edits alone do not change this mapping. This deliberately chooses the task's permitted safe invalidation over a new stable-label model. Conversations without positional references retain their existing behavior.

## Exact user-visible suggestions

Chips insert only the visible localized text, focus the existing editable question input, and never submit. Focus changes update chips without touching the question. Native buttons support keyboard use. Existing surface, text and focus tokens provide Light/Dark styling; wrapping supports mobile and 200% zoom without animation or dependencies. With a mobile keyboard or short viewport, a single horizontally scrollable chip row keeps all shortcuts reachable by touch/keyboard without displacing Ask.

| Existing focus | English | German |
| --- | --- | --- |
| Review social posts | Improve my calls to action | Meine Handlungsaufforderungen verbessern |
| Review social posts | Review my social posts | Meine Social-Posts prüfen |
| Review social posts | Find weak social messaging | Schwache Social-Botschaften finden |
| General conversation | What should I improve? | Was kann ich verbessern? |
| General conversation | Help me clarify my goal | Hilf mir, mein Ziel zu klären |
| General conversation | What should I focus on? | Worauf sollte ich mich konzentrieren? |
| Review Strategy | Check campaign alignment | Die Ausrichtung meiner Kampagne prüfen |
| Review Strategy | Review my campaign priorities | Meine Kampagnenprioritäten prüfen |
| Review Strategy | What should I improve first? | Was sollte ich zuerst verbessern? |
| Explore Ideas | Give me 3 campaign ideas | Gib mir 3 Kampagnenideen |
| Explore Ideas | Find a fresh angle | Eine neue Perspektive finden |
| Explore Ideas | Suggest a creative hook | Einen kreativen Aufhänger vorschlagen |
| Find Gaps | Find gaps in my Canvas | Lücken in meinem Canvas finden |
| Find Gaps | What assumptions should I check? | Welche Annahmen sollte ich prüfen? |
| Find Gaps | What evidence is missing? | Welche Belege fehlen? |
| Evaluate Options | Compare my campaign options | Meine Kampagnenoptionen vergleichen |
| Evaluate Options | Which option fits my goal? | Welche Option passt zu meinem Ziel? |
| Evaluate Options | Explain the main trade-offs | Die wichtigsten Zielkonflikte erklären |

## Validation

- `npm run check:bw40.1`: production Advice/resolver through disposable SQL with mocked provider and signed sessions; exact-node navigation; follow-up history; A/B/C deletion, reordering and unknown-mapping invalidation before dispatch; original B identity unchanged; all six focus modes and exact EN/DE suggestions; insert/edit without submit; manual draft preservation; keyboard; Light/Dark; mobile/desktop; 200% zoom; reduced motion.
- `npm run check:bw37.1ar1`: existing conversation scroll, composer/focus preservation and mobile keyboard/visual viewport regressions.
- `npm run check:bw39.2`: independent conversational Advice with optional evidence.
- `npm run check:bw37.1b`: strategic Advice, formatting, request freshness/retry, modes and authorization.
- `node scripts/check-bw38-2a-marketing-goals.js`: goal projection, scope and stale-response checks.
- Full Runtime Boot Safety runs on both PostgreSQL 17.6 and 18.4 in the pull request. The existing workflow now includes BW-40.1.

Review: the correction is client-side safe invalidation, matching the option explicitly allowed by the task and original P2 finding. Mode keys and descriptions, legacy DOM IDs, server prompts and all server authorization paths are unchanged. New browser coverage uses mocked provider responses; no live model quality claims are made.
