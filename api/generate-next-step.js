const NEXT_NODE_BY_TYPE = {
  Idea: 'Campaign Variation',
  'Campaign Variation': 'Content',
  Content: 'Social Media Posting',
  'Social Media Posting': 'Visual Concept',
  'Social Media Post': 'Visual Concept',
  'Visual Concept': 'Image Brief'
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
      tags = [],
      parentContext = null,
      connectedParentContext = null,
      campaignContext = '',
      brandBrainData = {}
    } = req.body || {};

    const nextNodeType = NEXT_NODE_BY_TYPE[nodeType];
    if (!nextNodeType) return res.status(400).json({ error: 'No next step available.' });

    const prompt = `Generate exactly one logical next campaign canvas node.

Current node context:
${JSON.stringify({ nodeType, title, description, content, goal, audience, channel, tags })}

Connected parent context:
${JSON.stringify(parentContext || connectedParentContext || null)}

Campaign context:
${campaignContext || 'none'}

Brand brain data:
${JSON.stringify(brandBrainData || {})}

Next node type must be: ${nextNodeType}

Guidelines:
- Create a natural next campaign step, not a full content pack.
- Keep it practical, specific, and directly connected to the source node.
- Preserve goal, audience, and channel intent when relevant.
- For Social Media Posting to Visual Concept, describe the creative visual idea.
- For Visual Concept to Image Brief, describe a concise production/image-generation brief.
- Do not create multiple options or branches.

Return strict JSON only with:
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
