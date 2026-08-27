# BW-26.5 — per-turn AI Brain response-language investigation

## Reproduction and traced path

The provider-message fixture reproduces multiple successful English exchanges followed by the first German request, `super mach gerne weiter`. The Settings selector synchronously writes its allowlisted value through `language.js` into `state.uiLanguage`; AI Brain does not own a separate cached language closure. The language change translates the interface and does not clear the transcript. Submission then builds the account/Board/lifecycle identity, Canvas projection, bounded conversation history, and request body.

Before this correction, the first post-switch request did send `response_language: "de"`. The server received it, independently allowlisted `en`/`de`, and used it in the leading policy system message. It did not accept browser system messages or use `campaignLanguage`. The weakness was provider-message ordering: the only German directive preceded the authoritative context and every English historical user/assistant message. There was no server-controlled language instruction adjacent to the current question. Thus the provider fixture ended with English conversational momentum followed directly by a short, referential German continuation; that history could weaken the distant instruction. The next German follow-up succeeded because the current German question and the immediately preceding turn then supplied stronger German momentum. This is an ordering defect, not evidence of a stale client closure or a language-selector race.

Changing the selector is synchronous, so immediate submission observes the updated state. Submission now captures the allowlisted Interface language exactly once and carries it through a request-scoped identity, body, validated server value, provider call, safe response context, and acceptance check. A preference change while the fetch is pending does not alter the captured value or invalidate the existing BW-26 account/Board/Canvas stale-response checks.

## Correction

The server inserts a controlled per-turn language system message after all historical conversation exchanges and immediately before the current user question. The question remains the final user message, preserving BW-26.4 ordering and reference resolution. The instruction makes history reference-only for language and covers headings, explanation, and newly proposed copy while preserving quoted or analyzed text, names, URLs, platforms, and user content when appropriate. Existing rendered answers and conversation history remain untouched.
