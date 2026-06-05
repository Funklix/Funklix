const { buildBrandBrainContext } = require('./_brand-brain-context');

const NEXT_NODE_BY_TYPE = {
  Idea: 'Campaign Variation',
  'Campaign Variation': 'Content',
  Content: 'Social Media Posting',
  'Social Media Posting': 'Landing Page',
  'Social Media Post': 'Landing Page',
  'Landing Page': 'Email Campaign'
};

const STAGE_INSTRUCTIONS_BY_NEXT_TYPE = {
  'Campaign Variation': `NEXT NODE TYPE: Campaign Variation

Strategic purpose:
Create one distinct campaign angle from the source Idea. The Idea is the strategic seed; do not simply restate it.

Choose exactly ONE angle type:
- Emotional
- Rational
- Authority
- Community
- Transformation
- Contrarian

The generated node must include:
Angle type:
Core promise:
Why this matters to the audience:
How it differs from the source idea:

Avoid:
- Rewriting the Idea with similar words
- Multiple angle options
- Structured content, social copy, landing page copy, or email copy`,

  Content: `NEXT NODE TYPE: Content

Strategic purpose:
Expand the source Campaign Variation into a structured, platform-neutral marketing content asset. The variation defines the angle; do not create another angle.

The generated node content must include clean plain-text sections:
Hook:
Narrative:
Supporting points:
- ...
- ...
CTA:

Also generate a production-ready image prompt in the imagePrompt field. The image prompt should describe the subject, setting, visual style, composition, mood, and brand fit. It should be usable directly for image generation.

Avoid:
- Social-media formatting
- Hashtag-heavy copy
- Landing page sections
- Repeating the variation instead of developing it`,

  'Social Media Posting': `NEXT NODE TYPE: Social Media Posting

Strategic purpose:
Adapt the source Content into platform-ready social copy. The content contains the substance; your job is adaptation.

Platform/channel guidance:
- LinkedIn: professional, insight-led, credibility-focused
- Instagram: concise, visual, emotionally clear
- TikTok: hook-first, punchy, creator-native
- X / Twitter or X: compressed, sharp, direct
- If no platform/channel is available, default to LinkedIn

The generated node content must include clean plain-text sections:
Opening hook:
Caption/body:
CTA:
Hashtags: include only if appropriate for the platform

Avoid:
- Long-form article structure
- Image-generation instructions
- Repeating the Content node verbatim`,

  'Landing Page': `NEXT NODE TYPE: Landing Page

Strategic purpose:
Transform the source Social Media Posting into structured landing page fields that can convert campaign interest into action.

Return the landing page copy in the landingPage object using these exact fields:
headerVisualPrompt: production-ready visual direction for a 16:9 hero image.
headerClaim: short main headline claim.
problem: concise Problem of ICP clearly stated paragraph.
solution: concise Solution for ICP presented paragraph.
trust: concise Building Trust / credibility section.
cta: short Call to action for conversion button text.

Keep content empty or use only a one-sentence summary. Do not dump the full landing page into content.

Use the social post's promise and audience insight, but do not copy the caption verbatim.

Avoid:
- Hashtags
- Social post formatting
- Email subject lines
- Giant text blocks
- Markdown formatting`,

  'Email Campaign': `NEXT NODE TYPE: Email Campaign

Strategic purpose:
Transform the source Landing Page into an email campaign that drives the same conversion goal in an inbox-native format.

The generated node content must include clean plain-text sections:
Subject line:
Preview text:
Email body:
CTA:

Use the landing page's promise, problem, solution, and CTA, but adapt it for email.

Avoid:
- Landing page section repetition without email framing
- Hashtags
- Image-generation instructions
- Multiple email variants`
};


function cleanGeneratedText(value = '') {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLandingPageFields(value = {}) {
  return {
    headerVisualPrompt: cleanGeneratedText(value.headerVisualPrompt || ''),
    headerClaim: cleanGeneratedText(value.headerClaim || ''),
    problem: cleanGeneratedText(value.problem || value.problemOfIcp || ''),
    solution: cleanGeneratedText(value.solution || value.solutionForIcp || ''),
    trust: cleanGeneratedText(value.trust || value.buildingTrust || ''),
    cta: cleanGeneratedText(value.cta || value.conversionCta || '')
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY' });

  try {
    const {
      nodeType = '',
      title = '',
      description = '',
      content = '',
      goal = '',
      audience = '',
      channel = '',
      funnelStage = '',
      tone = '',
      tags = [],
      parentContext = null,
      connectedParentContext = null,
      campaignContext = '',
      brandBrainData = {},
      boardId = ''
    } = req.body || {};

    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const nextNodeType = NEXT_NODE_BY_TYPE[nodeType];
    if (!nextNodeType) return res.status(400).json({ error: 'No next step available.' });

    const stageInstructions = STAGE_INSTRUCTIONS_BY_NEXT_TYPE[nextNodeType] || '';
    const sharedContext = `You are generating exactly ONE next Campaign Canvas node.

Source node context:
${JSON.stringify({ nodeType, title, description, content, goal, audience, channel, funnelStage, tone, tags })}

Connected parent/context nodes:
${JSON.stringify(parentContext || connectedParentContext || null)}

Campaign context:
${campaignContext || 'none'}

${brandBrainContext.text}

Shared constraints:
- Generate exactly ONE next node.
- Do not branch.
- Do not create a full content pack.
- Do not repeat the source node in different words.
- Create a distinct next-stage artifact with a different strategic purpose.
- Use audience, goal, channel, funnel stage, normalized Brand Brain data, and archetype guidance when available.
- Keep the output practical, specific, archetype-aware, and directly connected to the source node.
- Generated fields must be plain text suitable for UI text fields.
- Do not use markdown bold syntax like **text**.
- Do not use markdown headings like ## Heading.
- Do not use code fences.
- Do not put JSON inside content fields.
- Avoid excessive line breaks.
- Use clean section labels such as Hook:, Narrative:, CTA:.
- Use landingPage fields only when the next node type is Landing Page; otherwise return empty landingPage field values.`;

    const prompt = `${sharedContext}

${stageInstructions}

Return strict JSON only with this schema:
{
  "nodeType": "${nextNodeType}",
  "title": "",
  "description": "",
  "content": "",
  "imagePrompt": "",
  "landingPage": {
    "headerVisualPrompt": "",
    "headerClaim": "",
    "problem": "",
    "solution": "",
    "trust": "",
    "cta": ""
  }
}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: 'You are a senior campaign strategist helping progress one marketing campaign canvas node into exactly one next logical node. Return only valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'generated_next_step',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['nodeType', 'title', 'description', 'content', 'imagePrompt', 'landingPage'],
              properties: {
                nodeType: { type: 'string', enum: [nextNodeType] },
                title: { type: 'string' },
                description: { type: 'string' },
                content: { type: 'string' },
                imagePrompt: { type: 'string' },
                landingPage: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['headerVisualPrompt', 'headerClaim', 'problem', 'solution', 'trust', 'cta'],
                  properties: {
                    headerVisualPrompt: { type: 'string' },
                    headerClaim: { type: 'string' },
                    problem: { type: 'string' },
                    solution: { type: 'string' },
                    trust: { type: 'string' },
                    cta: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ error: `OpenAI API error: ${errorBody}` });
    }

    const data = await response.json();
    const outputItemText = (data?.output || [])
      .flatMap((item) => item?.content || [])
      .find((c) => c?.type === 'output_text' && c?.text)?.text || '';
    const rawText = data?.output_text || data?.output?.[0]?.content?.[0]?.text || outputItemText || '';
    if (!rawText) return res.status(500).json({ error: 'OpenAI returned empty output', data });

    try {
      const parsed = JSON.parse(rawText);
      return res.status(200).json({
        nodeType: parsed.nodeType || nextNodeType,
        title: cleanGeneratedText(parsed.title || nextNodeType),
        description: cleanGeneratedText(parsed.description || ''),
        content: cleanGeneratedText(parsed.content || parsed.description || ''),
        imagePrompt: cleanGeneratedText(parsed.imagePrompt || ''),
        landingPage: cleanLandingPageFields(parsed.landingPage || {})
      });
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to parse OpenAI JSON', rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to generate next step' });
  }
};
