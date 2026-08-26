'use strict';

const CONVERSATION_LIMITS = Object.freeze({ turns: 4, user: 2000, assistant: 12000, characters: 28000 });

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

module.exports = { CONVERSATION_LIMITS, validateConversationHistory };
