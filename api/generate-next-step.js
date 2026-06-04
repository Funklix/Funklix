const NEXT_NODE_BY_TYPE = {
  Idea: 'Campaign Variation',
  'Campaign Variation': 'Content',
  Content: 'Social Media Posting',
  'Social Media Posting': 'Visual Concept',
  'Social Media Post': 'Visual Concept',
  'Visual Concept': 'Image Brief'
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
- Angle type
- Core promise
- Why this matters to the audience
- How it differs from the source idea

Avoid:
- Rewriting the Idea with similar words
- Multiple angle options
- Structured content, social copy, visual direction, or image prompt details`,

  Content: `NEXT NODE TYPE: Content

Strategic purpose:
Expand the source Campaign Variation into structured marketing content. The variation defines the angle; do not create another angle.

The generated node must include:
- Hook
- Narrative
- Supporting points
- CTA

Use audience, goal, channel, funnel stage, tone, and Brand Brain data when available to shape the message.

Avoid:
- Social-media formatting
- Hashtag-heavy copy
- Visual storytelling or image prompt instructions
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

The generated node must include:
- Opening hook
- Main caption/body
- CTA
- Suggested hashtags only if appropriate for the platform

Avoid:
- Long-form article structure
- Image-generation instructions
- Repeating the Content node verbatim`,

  'Visual Concept': `NEXT NODE TYPE: Visual Concept

Strategic purpose:
Translate the source Social Media Posting into visual storytelling only. The post contains the message; this node defines the visual direction.

The generated node must include:
- Scene
- Composition
- Main subjects
- Emotion
- Symbolism
- Brand fit

Use Brand Brain visual guidance, audience, tone, and platform/channel when available.

Avoid:
- Rewriting the caption
- Marketing copy
- CTA language
- Hashtags
- Technical image-generation prompt syntax`,

  'Image Brief': `NEXT NODE TYPE: Image Brief

Strategic purpose:
Convert the source Visual Concept into a high-quality image-generation prompt. This is for image creation only.

The generated node must include:
- Subject
- Setting
- Composition
- Lighting
- Mood/emotion
- Style
- Brand fit
- Camera/framing
- Negative constraints if useful

Avoid:
- Marketing copy
- Captions
- CTA language
- Hashtags
- Multiple prompt options`
};

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
      brandBrainData = {}
    } = req.body || {};

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

Brand Brain data:
${JSON.stringify(brandBrainData || {})}

Shared constraints:
- Generate exactly ONE next node.
- Do not branch.
- Do not create a full content pack.
- Do not repeat the source node in different words.
- Create a distinct next-stage artifact with a different strategic purpose.
- Use audience, goal, channel, funnel stage, tone, and Brand Brain data when available.
- Keep the output practical, specific, and directly connected to the source node.`;

    const prompt = `${sharedContext}

${stageInstructions}

Return strict JSON only with this schema:
{
  "nodeType": "${nextNodeType}",
  "title": "",
  "description": "",
  "content": ""
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
              required: ['nodeType', 'title', 'description', 'content'],
              properties: {
                nodeType: { type: 'string', enum: [nextNodeType] },
                title: { type: 'string' },
                description: { type: 'string' },
                content: { type: 'string' }
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
        title: parsed.title || nextNodeType,
        description: parsed.description || '',
        content: parsed.content || parsed.description || ''
      });
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to parse OpenAI JSON', rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to generate next step' });
  }
};
