'use strict';

const CONVERSATION_LIMITS = Object.freeze({ turns: 4, user: 2000, assistant: 12000, characters: 28000 });

// Deliberately limited to conversational deixis. This is not used to interpret
// the question; it only prevents the server from pretending that an omitted
// exchange is sufficient grounding for an obvious follow-up.
const REFERENCE_PATTERN = /\b(?:the\s+(?:first|second|third|last|previous)\s+(?:idea|option|suggestion|one)|expand\s+on\s+that|make\s+it\s+shorter|rewrite\s+the\s+previous\s+one|what\s+did\s+you\s+mean\s+by\s+this|(?:die|der|das)\s+(?:erste|zweite|dritte|letzte|vorherige)\s+(?:idee|option|vorschlag|variante)|der\s+letzte\s+vorschlag|diese\s+variante)\b/i;

function plainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

function validateConversationHistory(value) {
  if (value === undefined) return { ok: true, history: [] };
  if (!Array.isArray(value) || value.length > CONVERSATION_LIMITS.turns) return { ok: false };
  let characters = 0;
  const history = [];
  for (const exchange of value) {
    if (!plainObject(exchange) || Object.keys(exchange).length !== 2
      || !Object.prototype.hasOwnProperty.call(exchange, 'user')
      || !Object.prototype.hasOwnProperty.call(exchange, 'assistant')
      || typeof exchange.user !== 'string' || typeof exchange.assistant !== 'string'
      || exchange.user.length > CONVERSATION_LIMITS.user
      || exchange.assistant.length > CONVERSATION_LIMITS.assistant) return { ok: false };
    const user = exchange.user.trim(); const assistant = exchange.assistant.trim();
    if (!user || !assistant) return { ok: false };
    characters += user.length + assistant.length;
    if (characters > CONVERSATION_LIMITS.characters) return { ok: false };
    history.push({ user, assistant });
  }
  return { ok: true, history };
}

function hasConversationalReference(value) {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value);
}

module.exports = { CONVERSATION_LIMITS, hasConversationalReference, validateConversationHistory };
