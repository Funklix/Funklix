const { buildBrandBrainContext } = require("./_brand-brain-context");

const CAMPAIGN_CHAIN_TYPES = [
  "Idea",
  "Campaign Variation",
  "Content",
  "Social Media Posting",
  "Landing Page",
  "Email Campaign"
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });
  }

  try {
    const { campaignIdea = "", additionalContext = "", brandBrainData = {}, boardId = "" } = req.body || {};
    if (!campaignIdea.trim()) {
      return res.status(400).json({ error: "campaignIdea is required" });
    }

    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);

    const prompt = `You are a senior campaign team creating one complete Campaign Canvas chain.

Create exactly this linear chain, in this exact order:
1. Idea
2. Campaign Variation
3. Content
4. Social Media Posting
5. Landing Page
6. Email Campaign

Input campaign idea:
${campaignIdea}

Additional context:
${additionalContext || "none"}

${brandBrainContext.text}

Shared requirements:
- Generate the complete chain once; do not branch.
- Do not create multiple variations.
- Do not include Visual Concept or Image Brief.
- Every stage must have a distinct strategic purpose and must not repeat the same copy in different words.
- Use ICP, positioning, USP/value proposition, offer, messaging pillars, tone, CTA guidance, and visual style from Brand Brain when available.
- Plain text only: no markdown bold, no markdown headings, no code fences, no JSON inside fields.
- Keep fields UI-ready: concise, practical, and specific.
- Do not fabricate unavailable metrics, testimonials, logos, customers, or proof.

Stage instructions:

Idea:
- Core campaign idea only.
- Clear promise and strategic direction.
- Keep it broad enough to drive the next stages.

Campaign Variation:
- Create one distinct campaign angle from the Idea.
- Choose one angle type: Emotional, Rational, Authority, Community, Transformation, or Contrarian.
- Include the angle type, core promise, why this matters to the audience, and how it differs from the source idea.

Content:
- Expand the Campaign Variation into structured marketing content.
- Do not create another angle.
- Do not create a social post yet.
- Include clean sections: Hook, Narrative, Supporting points, CTA.
- Include a production-ready imagePrompt for visual generation that reflects Brand Brain visual style.

Social Media Posting:
- Adapt Content into one platform-ready social post.
- Use channel/platform from context when available; otherwise default to LinkedIn.
- If channel/platform is ambiguous, choose LinkedIn and write with LinkedIn-quality depth.
- LinkedIn: write a real post, not a one-line caption. Include a strong opening hook, 2-4 short body paragraphs with useful context/insight, a clear CTA, and 2-3 relevant hashtags if appropriate.
- Instagram: concise, visual, emotionally clear caption with a simple CTA.
- TikTok: hook-first, punchy, creator-native script/caption.
- X/Twitter: shorter, sharper, compressed post with direct CTA.
- Put the final platform-ready post in social.caption, not only in content.

Landing Page:
- Transform the Social Media Posting into landing page copy.
- Fill structured landingPage fields instead of dumping everything into content.
- Keep content empty or only a one-sentence summary.
- headerVisualPrompt: production-ready visual direction for a 16:9 hero image.
- headerClaim: short main headline claim.
- problem: concise ICP problem paragraph.
- solution: concise solution paragraph.
- trust: concise trust/credibility section without fabricated proof.
- cta: short CTA button text.

Email Campaign:
- Transform the Landing Page into an email campaign.
- Include clean sections in content: Subject line, Preview text, Email body, CTA.
- Keep it motivation-driven and concise.

Return ONLY strict JSON with this shape:
{
  "nodes": [
    {
      "type": "Idea",
      "title": "",
      "description": "",
      "content": "",
      "metadata": { "goal": "", "audience": "", "channel": "", "funnelStage": "", "tone": "" },
      "imagePrompt": "",
      "social": { "platform": "", "caption": "", "hashtags": "" },
      "landingPage": { "headerVisualPrompt": "", "headerClaim": "", "problem": "", "solution": "", "trust": "", "cta": "" }
    }
  ],
  "edges": [
    { "fromIndex": 0, "toIndex": 1 },
    { "fromIndex": 1, "toIndex": 2 },
    { "fromIndex": 2, "toIndex": 3 },
    { "fromIndex": 3, "toIndex": 4 },
    { "fromIndex": 4, "toIndex": 5 }
  ]
}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: "You are a senior campaign strategist creating a single linear Campaign Canvas chain. Return only strict JSON matching the schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "campaign_chain_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["nodes", "edges"],
              properties: {
                nodes: {
                  type: "array",
                  minItems: 6,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "title", "description", "content", "metadata", "imagePrompt", "social", "landingPage"],
                    properties: {
                      type: { type: "string", enum: CAMPAIGN_CHAIN_TYPES },
                      title: { type: "string" },
                      description: { type: "string" },
                      content: { type: "string" },
                      metadata: {
                        type: "object",
                        additionalProperties: false,
                        required: ["goal", "audience", "channel", "funnelStage", "tone"],
                        properties: {
                          goal: { type: "string" },
                          audience: { type: "string" },
                          channel: { type: "string" },
                          funnelStage: { type: "string" },
                          tone: { type: "string" }
                        }
                      },
                      imagePrompt: { type: "string" },
                      social: {
                        type: "object",
                        additionalProperties: false,
                        required: ["platform", "caption", "hashtags"],
                        properties: {
                          platform: { type: "string" },
                          caption: { type: "string" },
                          hashtags: { type: "string" }
                        }
                      },
                      landingPage: {
                        type: "object",
                        additionalProperties: false,
                        required: ["headerVisualPrompt", "headerClaim", "problem", "solution", "trust", "cta"],
                        properties: {
                          headerVisualPrompt: { type: "string" },
                          headerClaim: { type: "string" },
                          problem: { type: "string" },
                          solution: { type: "string" },
                          trust: { type: "string" },
                          cta: { type: "string" }
                        }
                      }
                    }
                  }
                },
                edges: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["fromIndex", "toIndex"],
                    properties: {
                      fromIndex: { type: "integer", minimum: 0, maximum: 5 },
                      toIndex: { type: "integer", minimum: 0, maximum: 5 }
                    }
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
      .find((contentItem) => contentItem?.type === "output_text" && contentItem?.text)?.text || "";
    const rawText = data?.output_text || data?.output?.[0]?.content?.[0]?.text || outputItemText || "";
    if (!rawText) {
      return res.status(500).json({ error: "OpenAI returned empty output", data });
    }
    try {
      const parsed = JSON.parse(rawText);
      return res.status(200).json(parsed);
    } catch (parseError) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON", rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate campaign" });
  }
};
