const { buildBrandBrainContext } = require('./_brand-brain-context');

const ARCHETYPES = [
  'Explorer',
  'Sage',
  'Hero',
  'Ruler',
  'Magician',
  'Caregiver',
  'Creator',
  'Everyman',
  'Jester',
  'Innocent',
  'Rebel',
  'Lover'
];

const ARCHETYPE_SET = new Set(ARCHETYPES.map((name) => name.toLowerCase()));
const SIGNAL_KEYS = ['toneSignals', 'missionSignals', 'audienceSignals', 'messagingSignals', 'visualSignals'];

function cleanText(value = '', maxLength = 1200) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value = [], maxItems = 5, maxLength = 240) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeArchetype(value = '') {
  const raw = cleanText(value, 80);
  if (!raw) return '';
  const match = ARCHETYPES.find((name) => name.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  const loose = ARCHETYPES.find((name) => raw.toLowerCase().includes(name.toLowerCase()));
  return loose || '';
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function cleanAlternatives(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      const archetype = normalizeArchetype(item?.archetype || item?.name || item);
      if (!archetype) return null;
      return {
        archetype,
        confidence: clampConfidence(item?.confidence),
        why: cleanText(item?.why || item?.reasoning || '', 360)
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function cleanSignals(value = {}) {
  return SIGNAL_KEYS.reduce((signals, key) => {
    signals[key] = cleanList(value?.[key], 5, 220);
    return signals;
  }, {});
}

function normalizeResult(result = {}) {
  const primaryArchetype = normalizeArchetype(result.primaryArchetype);
  let secondaryArchetype = normalizeArchetype(result.secondaryArchetype);
  const alternatives = cleanAlternatives(result.alternatives);
  if (primaryArchetype && secondaryArchetype === primaryArchetype) {
    secondaryArchetype = alternatives.find((item) => item.archetype !== primaryArchetype)?.archetype || '';
  }
  return {
    primaryArchetype,
    primaryConfidence: clampConfidence(result.primaryConfidence),
    secondaryArchetype,
    secondaryConfidence: clampConfidence(result.secondaryConfidence),
    alternatives,
    reasoning: cleanText(result.reasoning, 1200),
    signals: cleanSignals(result.signals),
    recommendedVoice: cleanText(result.recommendedVoice, 700),
    recommendedVisualDirection: cleanText(result.recommendedVisualDirection, 700)
  };
}

function outputItemText(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (item.type === 'output_text' && item.text) return item.text;
  if (Array.isArray(item.content)) return item.content.map(outputItemText).filter(Boolean).join('\n');
  if (item.text) return item.text;
  return '';
}

function extractResponseText(data = {}) {
  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.output)) return data.output.map(outputItemText).filter(Boolean).join('\n');
  return '';
}

function parseJsonResponse(text = '') {
  const raw = cleanText(text, 12000);
  try {
    return JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI did not return JSON');
    return JSON.parse(match[0]);
  }
}

function hasMeaningfulBrandData(brandBrainData = {}) {
  if (!brandBrainData || typeof brandBrainData !== 'object') return false;
  return Object.values(brandBrainData).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.values(value).some(Boolean);
    return Boolean(cleanText(value, 20));
  });
}

function buildDiscoveryPrompt({ brandBrainContext, brandBrainData, refineGuidance }) {
  const website = brandBrainData?.brandAssets?.domain || brandBrainData?.website || brandBrainData?.domain || '';
  const refinement = cleanText(refineGuidance, 500);
  return `You are a senior brand strategist specializing in Jungian brand archetypes.

Analyze the available Brand Brain and discover the brand's likely Brand DNA.

Feature language:
- Refer to this as Discover Brand DNA.
- Do not call it Generate Brand Archetype in user-facing output.

Use only these 12 Jung brand archetypes:
${ARCHETYPES.map((name) => `- ${name}`).join('\n')}

Brand Brain source of truth:
${brandBrainContext.text}

Raw Brand Brain fields, including any custom tiles or website-derived context:
${JSON.stringify(brandBrainData || {}, null, 2)}

Website/domain context if present:
${website || 'none'}

Archetype detection priority:
1. Founder Story, if present in Brand Brain or custom tiles.
2. Mission / Vision.
3. Value Proposition.
4. Messaging Pillars.
5. ICP / Personas.
6. Visual Assets.

${refinement ? `User refinement guidance for this rerun:\n${refinement}\n` : ''}

Rules:
- Return a primary archetype and a secondary archetype.
- Confidence values must be percentages from 0 to 100.
- The primary and secondary archetypes must be different.
- Include 1 to 3 alternatives.
- Include signals grouped into tone, mission, audience, messaging, and visual signals.
- If Brand Brain is weak or incomplete, use conservative confidence and say what signals are missing.
- Do not invent facts, testimonials, colors, founder stories, or website content.
- Keep the reasoning concise, clear, and emotionally understandable for non-marketers.
- Use plain text only. No markdown bold. No markdown headings. No code fences.
- Return strict JSON only.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY' });

  try {
    const { boardId = '', brandBrainData = {}, refineGuidance = '' } = req.body || {};
    if (!hasMeaningfulBrandData(brandBrainData)) {
      return res.status(400).json({ error: 'Add Brand Brain details before discovering Brand DNA.' });
    }

    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const prompt = buildDiscoveryPrompt({ brandBrainContext, brandBrainData, refineGuidance });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_BRAND_DNA_MODEL || 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: 'You analyze Brand Brain data into concise Jungian Brand DNA profiles. Return valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'brand_dna_discovery',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: [
                'primaryArchetype',
                'primaryConfidence',
                'secondaryArchetype',
                'secondaryConfidence',
                'alternatives',
                'reasoning',
                'signals',
                'recommendedVoice',
                'recommendedVisualDirection'
              ],
              properties: {
                primaryArchetype: { type: 'string', enum: ARCHETYPES },
                primaryConfidence: { type: 'number', minimum: 0, maximum: 100 },
                secondaryArchetype: { type: 'string', enum: ARCHETYPES },
                secondaryConfidence: { type: 'number', minimum: 0, maximum: 100 },
                alternatives: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['archetype', 'confidence', 'why'],
                    properties: {
                      archetype: { type: 'string', enum: ARCHETYPES },
                      confidence: { type: 'number', minimum: 0, maximum: 100 },
                      why: { type: 'string' }
                    }
                  }
                },
                reasoning: { type: 'string' },
                signals: {
                  type: 'object',
                  additionalProperties: false,
                  required: SIGNAL_KEYS,
                  properties: SIGNAL_KEYS.reduce((properties, key) => {
                    properties[key] = {
                      type: 'array',
                      maxItems: 5,
                      items: { type: 'string' }
                    };
                    return properties;
                  }, {})
                },
                recommendedVoice: { type: 'string' },
                recommendedVisualDirection: { type: 'string' }
              }
            }
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || 'Could not discover Brand DNA';
      return res.status(response.status).json({ error: message });
    }

    const parsed = parseJsonResponse(extractResponseText(data));
    const result = normalizeResult(parsed);
    if (!ARCHETYPE_SET.has(result.primaryArchetype.toLowerCase()) || !ARCHETYPE_SET.has(result.secondaryArchetype.toLowerCase())) {
      throw new Error('AI returned an invalid archetype');
    }
    if (result.primaryArchetype === result.secondaryArchetype) {
      throw new Error('AI returned duplicate primary and secondary archetypes');
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[DISCOVER_BRAND_DNA_FAILED]', {
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({ error: error?.message || 'Could not discover Brand DNA' });
  }
};
