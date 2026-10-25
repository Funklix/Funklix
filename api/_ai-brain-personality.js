'use strict';
const { getArchetypeGuidance } = require('./_archetype-guidance');
const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
// Inputs come exclusively from independently authorized, freshness-checked Advice
// context. Persistence alone does not approve generated DNA. Never inspect drafts.
function advisorPersonality({ canonical, snapshot }) {
  const core = canonical ? canonical.brand_core : snapshot;
  if (!core || typeof core !== 'object' || Array.isArray(core)) return null;
  const dna = core.brandDNA;
  const approved = dna?.userApproved === true;
  const archetypes = approved ? ['primaryArchetype', 'secondaryArchetype'].flatMap(key => {
    const name = text(dna[key], 80), guidance = getArchetypeGuidance(name);
    return Array.isArray(guidance?.communicationStyle) ? [{ role: key, name, communicationStyle: guidance.communicationStyle }] : [];
  }) : [];
  const tone = (Array.isArray(core.toneOfVoice) ? core.toneOfVoice : [core.toneOfVoice]).map(value => text(value, 160)).filter(Boolean).slice(0, 8);
  const voice = approved ? text(dna.recommendedVoice, 500) : '';
  if (!archetypes.length && !tone.length && !voice) return null;
  return { source: canonical ? 'canonicalBrandCore' : 'boardBrandCore', archetypes, tone, voice };
}
module.exports = { advisorPersonality };
