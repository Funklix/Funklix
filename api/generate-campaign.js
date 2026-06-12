const { buildBrandBrainContext } = require("./_brand-brain-context");

const CAMPAIGN_CHAIN_TYPES = ["Idea", "Campaign Variation", "Content", "Social Media Posting", "Landing Page", "Email Campaign"];
const ANGLE_FAMILIES = ["Emotional", "Rational", "Authority", "Community", "Transformation", "Opportunity", "Trust", "Contrarian"];
const SOCIAL_PURPOSES = ["Hook", "Problem", "Story", "Objection", "CTA", "Proof", "Behind the scenes", "Educational", "Contrarian", "Community"];

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeChannel(channel = "LinkedIn") {
  const allowed = new Set(["LinkedIn", "X", "Instagram", "TikTok", "Mixed"]);
  return allowed.has(channel) ? channel : "LinkedIn";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const {
      campaignIdea = "",
      additionalContext = "",
      brandBrainData = {},
      boardId = "",
      variationCount: rawVariationCount = 3,
      postsPerVariation: rawPostsPerVariation = 5,
      includeLandingPage = true,
      includeEmailCampaign = true,
      channel: rawChannel = "LinkedIn"
    } = req.body || {};
    if (!campaignIdea.trim()) {
      return res.status(400).json({ error: "campaignIdea is required" });
    }

    const variationCount = clampInteger(rawVariationCount, 3, 1, 10);
    const postsPerVariation = clampInteger(rawPostsPerVariation, 5, 1, 20);
    const channel = normalizeChannel(rawChannel);
    const shouldIncludeLandingPage = includeLandingPage !== false;
    const shouldIncludeEmailCampaign = includeEmailCampaign !== false;
    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const nodesPerVariation = 2 + postsPerVariation + (shouldIncludeLandingPage ? 1 : 0) + (shouldIncludeEmailCampaign ? 1 : 0);
    const expectedNodeCount = 1 + variationCount * nodesPerVariation;
    const expectedEdgeCount = variationCount * (2 + postsPerVariation + (shouldIncludeLandingPage ? postsPerVariation : 0) + (shouldIncludeEmailCampaign ? (shouldIncludeLandingPage ? 1 : postsPerVariation) : 0));
    const angleGuidance = Array.from({ length: variationCount }, (_, index) => `${index + 1}. ${ANGLE_FAMILIES[index % ANGLE_FAMILIES.length]}`).join("\n");
    const purposeGuidance = Array.from({ length: postsPerVariation }, (_, index) => `${index + 1}. ${SOCIAL_PURPOSES[index % SOCIAL_PURPOSES.length]}`).join("\n");

    const prompt = `You are a senior campaign team creating a Campaign Canvas plan that feels like an AI marketing employee building a real multi-angle campaign.

Input campaign idea:
${campaignIdea}

Additional context:
${additionalContext || "none"}

Setup:
- Campaign variations: ${variationCount}
- Social posts per variation: ${postsPerVariation}
- Include landing page per variation: ${shouldIncludeLandingPage ? "yes" : "no"}
- Include email campaign per variation: ${shouldIncludeEmailCampaign ? "yes" : "no"}
- Primary channel: ${channel}

${brandBrainContext.text}

Structure requirements:
- Return exactly ${expectedNodeCount} nodes and ${expectedEdgeCount} edges.
- Node 0 must be the single Idea node.
- Node order must be: Idea, then for each variation in sequence: Campaign Variation, Content, all Social Media Posting nodes for that variation, optional Landing Page, optional Email Campaign.
- For each variation, create this structure:
  Idea -> Campaign Variation
  Campaign Variation -> Content
  Content -> each Social Media Posting
  each Social Media Posting -> Landing Page if enabled
  Landing Page -> Email Campaign if both are enabled
  if Landing Page is disabled but Email Campaign is enabled, each Social Media Posting -> Email Campaign
- Do not create extra node types.
- Avoid direct Content -> Email Campaign or Campaign Variation -> Email Campaign connectors.

Variation quality:
- Variations must not be simple rewordings.
- Each variation must intentionally choose a distinct angle family and explicitly state the angle in the Campaign Variation description/content.
- Use these angle families in order, adapting to Brand Brain and Brand DNA:
${angleGuidance}

Social post diversity:
- Within each variation, social posts must be distinct, not duplicates.
- Use these content purposes in order, adapting to the variation angle:
${purposeGuidance}
- Social titles should include the purpose, e.g. "Hook Post", "Problem Post", "Story Post".
- For channel Mixed, distribute posts across LinkedIn, X, Instagram, and TikTok. Otherwise use ${channel}.

Node type hard rules:
- Nodes titled or purposed as Hook Post, Problem Post, Story Post, Authority Post, Objection Post, or CTA Post MUST have type "Social Media Posting".
- Do NOT use type "Content" for individual social posts.
- Content nodes are only one strategic content asset per Campaign Variation.
- For each Campaign Variation, generate exactly 1 Content node.
- For each Campaign Variation, generate exactly ${postsPerVariation} Social Media Posting nodes.
- Social Media Posting nodes must contain the full publish-ready post in social.caption.
- Social Media Posting nodes should still have content as a short summary, but their type must be "Social Media Posting".

Node requirements:
Idea:
- Core campaign idea only.
- Clear goal, ICP/audience, and strategic context.

Campaign Variation:
- A distinct campaign angle.
- Title should name the angle.
- Description/content must explicitly include "Angle:".

Content:
- Exactly one strategic pillar asset for that Campaign Variation.
- Content nodes must be strategic assets, not social posts and not campaign variation summaries.
- Content nodes must not read like a social caption, hook post, thread, or short promotional post.
- Content nodes must not simply restate the Campaign Variation angle; they must translate the angle into a reusable campaign asset.
- Content nodes must not be titled Hook Post, Problem Post, Story Post, Authority Post, Objection Post, CTA Post, or any other social post purpose.
- In description/content, include these clearly labeled sections:
  - Format:
  - Core Thesis:
  - Audience Pain:
  - Key Message Points:
  - Proof / Credibility Approach:
  - CTA:
  - Repurposing Guidance for Social Posts:
- Repurposing Guidance for Social Posts must explain how the child Social Media Posting nodes should draw from this pillar asset without duplicating each other.
- Include imagePrompt shaped by Brand Brain visual style and archetype guidance.

Social Media Posting:
- social.caption must contain the FULL publish-ready post copy.
- content must contain only a short one-sentence summary of the post purpose.
- Do not put the full post in content; put the full post in social.caption.
- Hashtags should be clean campaign hashtags, not full sentences.
- Keep purpose distinct from sibling posts.

For LinkedIn posts:
- Write complete, publish-ready LinkedIn posts.
- Use short paragraphs with line breaks.
- Avoid generic slogans.
- Each post should feel specific to the campaign variation angle, audience, and Brand Brain context.

LinkedIn Hook Post (title/purpose only; node type must be "Social Media Posting"):
- 120-220 words.
- Strong attention-grabbing opening.
- 2-4 short paragraphs.
- Include a clear insight.
- End with a CTA.

LinkedIn Problem Post (title/purpose only; node type must be "Social Media Posting"):
- 120-220 words.
- Describe a real audience pain point.
- Explain the consequences of ignoring it.
- Introduce the campaign solution.
- End with a CTA.

LinkedIn Story Post (title/purpose only; node type must be "Social Media Posting"):
- 120-220 words.
- Use a narrative structure.
- Include situation, transformation, lesson, and CTA.

LinkedIn Authority Post (title/purpose only; node type must be "Social Media Posting"):
- 120-220 words.
- Lead with expert insight.
- Include a contrarian observation.
- Give a practical takeaway.
- End with a CTA.

LinkedIn Objection Post (title/purpose only; node type must be "Social Media Posting"):
- 120-220 words.
- Address skepticism directly.
- Reframe the concern.
- Include evidence, reasoning, or a concrete rationale.
- End with a CTA.

LinkedIn CTA Post (title/purpose only; node type must be "Social Media Posting"):
- 80-150 words.
- Direct action-focused post.
- Make the desired action clear.
- Use a strong CTA.

For non-LinkedIn channels:
- Keep posts platform-native and complete.
- X/Twitter must remain 280-character aware.
- Instagram and TikTok captions should include hook, context, and CTA.
- Do not return only 1-2 sentence summaries for LinkedIn posts.

Landing Page:
- headerVisualPrompt, headerClaim, problem, solution, trust, cta.
- Do not fabricate proof, metrics, testimonials, or brand facts.

Email Campaign:
- Include clean sections in content: Subject line, Preview text, Email body, CTA.
- Tie back to the variation angle.

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
    { "fromIndex": 0, "toIndex": 1 }
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
            content: "You are a senior campaign strategist creating a multi-variation Campaign Canvas plan. Return only strict JSON matching the schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "campaign_canvas_plan_v2",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["nodes", "edges"],
              properties: {
                nodes: {
                  type: "array",
                  minItems: expectedNodeCount,
                  maxItems: expectedNodeCount,
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
                  minItems: expectedEdgeCount,
                  maxItems: expectedEdgeCount,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["fromIndex", "toIndex"],
                    properties: {
                      fromIndex: { type: "integer", minimum: 0, maximum: expectedNodeCount - 1 },
                      toIndex: { type: "integer", minimum: 0, maximum: expectedNodeCount - 1 }
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
      return res.status(200).json({
        ...parsed,
        setup: {
          variationCount,
          postsPerVariation,
          includeLandingPage: shouldIncludeLandingPage,
          includeEmailCampaign: shouldIncludeEmailCampaign,
          channel,
          expectedNodeCount,
          expectedEdgeCount
        }
      });
    } catch (parseError) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON", rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate campaign" });
  }
};
