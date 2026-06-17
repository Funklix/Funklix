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

Context priority:
1. Brand Brain / Brand DNA / Archetype guidance is the source of truth for the product, offer, ICP, positioning, value proposition, messaging, tone, CTA style, and visual style.
2. Campaign Idea defines the campaign objective, theme, angle, activation, or marketing goal.
3. Additional Context provides optional campaign-specific details.
4. If Campaign Idea or Additional Context conflicts with Brand Brain, preserve Brand Brain and reinterpret the campaign idea as a brand-aligned marketing angle.
5. Do not replace the Brand Brain product, offer, ICP, positioning, value proposition, or messaging unless the user explicitly states this is a new product, new offer, market expansion, or new business line.
6. Do not target audiences outside the Brand Brain ICP unless the user explicitly frames it as a new market expansion.
7. Do not invent offers, proof, metrics, audience segments, or brand facts that are not supported by Brand Brain or explicit campaign input.
8. Every node must visibly reflect Brand Brain positioning, ICP, tone, messaging pillars, and Brand DNA/archetype when available.

Input campaign idea:
${campaignIdea}

Additional context:
${additionalContext || "none"}

Before generating nodes, silently check:
- Does the campaign idea align with Brand Brain ICP?
- Does the campaign idea align with Brand Brain positioning?
- Does it preserve the Brand Brain offer/value proposition as the thing being marketed?
- Does it match tone and archetype guidance?
If not, adapt the campaign into the closest brand-aligned version and treat the campaign idea as an angle rather than a replacement offer.

Do not ask the user for clarification in this generation flow.

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
- In content, use this exact plain-text structure with line breaks so it is readable in a textarea:
  Format:
  ...

  Core Thesis:
  ...

  Audience Pain:
  ...

  Key Message Points:
  - ...
  - ...
  - ...

  Proof / Credibility Approach:
  ...

  CTA:
  ...

  Repurposing Guidance for Social Posts:
  - Hook Post: ...
  - Problem Post: ...
  - Story Post: ...
- Use simple plain-text labels and bullet points only.
- No markdown bold, no double asterisks, and no markdown tables.
- Repurposing Guidance for Social Posts must explain how the child Social Media Posting nodes should draw from this pillar asset without duplicating each other.
- Include imagePrompt shaped by Brand Brain visual style and archetype guidance.

Social Media Posting:
- social.caption must contain the FULL publish-ready post copy.
- social.caption must begin with the post hook or opening line, not hashtags.
- Do not place hashtags at the beginning of social.caption.
- Prefer no hashtags inside social.caption.
- If hashtags appear in social.caption, they must be at the very end after the CTA, never before the body.
- social.hashtags should contain clean comma-separated campaign hashtags.
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
- Landing pages should read like real conversion pages, not campaign summaries.
- Landing Page fields must be customer-facing conversion copy, not internal campaign summaries.
- Do not copy or lightly rephrase Campaign Idea, Additional Context, Goal, Audience, or Campaign Variation titles. Convert internal planning inputs into customer-facing language.
- Avoid internal verbs in Landing Page copy: promote, increase, launch, drive, generate, campaign, objective, audience, goal.
- Landing Page copy must never mention campaign angle, variation, emotional angle, rational angle, authority angle, synthesis, marketing strategy, targeting, audience as a metadata label, or goal as a metadata label.
- The Landing Page is the central conversion asset for the whole campaign, not a child of one Campaign Variation.
- Landing Page strategy hierarchy: 1. Campaign Objective, 2. Brand Brain Offer, 3. ICP / Persona, 4. Brand Positioning, 5. Value Proposition, 6. Messaging Pillars.
- Build the page around the Brand Brain offer/value proposition as the product, service, event, offer, or experience being promoted; use Campaign Idea as the objective, angle, or activation unless it explicitly says new product, new offer, market expansion, or new business line.
- Use Campaign Variations only as internal planning inputs. Customer-facing Landing Page copy must describe the offer itself, not the campaign structure.
- If variations contain emotional, rational, authority, or other angles, translate those angles into customer-facing benefits, proof points, and persuasion elements without naming or describing the angles.
- Never describe the Landing Page as a campaign, campaign angle, variation, strategy, synthesis, combination of angles, marketing asset, emotional angle, rational angle, or authority angle.
- Never use titles like "Combined Campaign Landing Page" or copy like "A synthesis of emotional and rational angles." Instead write offer-first conversion copy.
- The Landing Page headline should focus on the product, service, event, offer, or experience itself, not on a specific campaign angle.
- Good example for campaign "Increase honeymoon helicopter bookings in Bali": "Private Honeymoon Helicopter Experiences in Bali".
- Bad example for that campaign: "Combined Campaign Landing Page".
- Bad example for that campaign: "Why Safety Matters in Aerial Tourism".
- Good supporting copy: "Experience Bali from above with a private helicopter tour designed for unforgettable honeymoon memories.".
- Bad supporting copy: "A synthesis of emotional and rational angles.".
- Good example for campaign "Promote exclusive networking events for executives": "Exclusive Networking Events for C-Level Executives".
- Bad example for that campaign: "The Emotional Power of Leadership Relationships".
- headerVisualPrompt: concrete hero visual direction aligned with the offer, audience, Brand Brain visual style, and campaign objective.
- headerClaim: the Hero Headline. It must be a real customer-facing landing page headline, 5-15 words, benefit-oriented, focused on the offer itself, and grounded in the Brand Brain offer rather than a single campaign variation. It must name the offer or experience, speak to the customer outcome, avoid internal campaign verbs, and never simply restate the Campaign Idea.
- Never use these words in headerClaim: promote, increase, launch, drive, generate, campaign, objective, audience, targeting, angle, variation, strategy.
- Bad headerClaim: "promote honeymoon helicopter flights in Bali".
- Bad headerClaim: "increase bookings for helicopter tours".
- Good headerClaim: "Private Honeymoon Helicopter Tours Over Bali".
- Good headerClaim: "See Bali From Above On Your Honeymoon".
- description/content: include a readable landing page outline using plain-text labels for Hero Headline, Subheadline, Primary CTA, Problem Section, Benefits, Trust Elements, Offer, FAQ, and Final CTA. Problem Section must be customer pain; Benefits/Offer must be offer positioning; Trust Elements must be credibility proof.
- problem: write the Subheadline and Problem Section in 2-4 concise sentences that describe the customer's pain, friction, unmet desire, risk, doubt, fear, missed opportunity, or current frustration plus the stakes and desired outcome.
- Problem must never be an audience description, location description, campaign objective, product category, marketing goal, internal strategy, campaign angle, or targeting statement.
- Bad problem: "romantic events for wedding couples on vacation in Bali".
- Bad problem: "married couples on vacation in Bali".
- Good problem: "Many honeymoon activities feel crowded, predictable, or impersonal when couples want a once-in-a-lifetime memory they can share forever.".
- solution: write the Offer and Benefits section in 2-4 concise sentences or simple bullets that position the Brand Brain offer as the answer to the customer pain. Explain what the customer gets, how the offer works, why it solves the problem, why it is different, and what outcome it creates. Never write a campaign summary, marketing plan, generic phrase like "focused campaign experience", or restatement of the Campaign Idea.
- Bad solution: "A focused campaign experience for romantic honeymoon helicopter flights in Bali.".
- Good solution: "Private helicopter tours give couples a breathtaking way to experience Bali from above, combining unforgettable views, privacy, and a premium guided flight experience.".
- trust: write Trust Elements and FAQ content using only supported credibility elements from Brand Brain/context: safety, professionalism, experience, pilots/team, process, exclusivity, operational quality, reviews/testimonials only if explicitly provided, guarantees only if explicitly provided, and authority only if explicitly provided. Trust must explain why the customer should believe and feel safe choosing the offer. Never use generic buzzwords, unrelated context, invented metrics, invented testimonials, vague phrases like "built around trust", or repetition of the solution.
- Bad trust: "Built around trust, exclusivity, and meaningful business relationships.".
- Good trust: "Professional pilots, clear safety procedures, and a premium private-flight experience help couples enjoy the journey with confidence from takeoff to landing.".
- cta: action-oriented button-style Primary CTA language, 2-6 words, using an imperative action verb that matches the offer. Examples: "Book Your Flight", "Reserve Your Tour", "Request Your Invitation", "Schedule A Consultation", "Start Your Journey". Avoid vague CTA copy like "Learn More" or "Discover More" unless appropriate. The Final CTA in content should reinforce the same action.
- Before finalizing a Landing Page node, silently check each field: Problem must describe a real customer pain or unmet desire; if it only describes an audience, location, campaign, or product category, rewrite it. Solution must describe the Brand Brain offer as the answer; if it describes the campaign or marketing strategy, rewrite it. Trust must provide credibility or reassurance; if it uses generic buzzwords or unrelated context, rewrite it. Header Claim must sound like a customer-facing landing page headline; if it sounds like a campaign objective, rewrite it.
- Fly Bali guidance example — Campaign Idea: Increase honeymoon helicopter bookings in Bali. Brand Brain Offer: Private helicopter tours over Bali, Bajo, and Sumba.
- Bad Landing Page: Header Claim: promote honeymoon helicopter flights in Bali | Problem: married couples on vacation in Bali | Solution: A focused campaign experience for romantic honeymoon helicopter flights in Bali | Trust: Built around trust, exclusivity, and meaningful business relationships. | CTA: Request an invitation
- Good Landing Page: Header Claim: Private Honeymoon Helicopter Tours Over Bali | Problem: Many honeymoon activities feel crowded, predictable, or impersonal when couples want a once-in-a-lifetime memory they can share forever. | Solution: Private helicopter tours give couples a breathtaking way to experience Bali from above, combining unforgettable views, privacy, and a premium guided flight experience. | Trust: Professional pilots, clear safety procedures, and a premium private-flight experience help couples enjoy the journey with confidence from takeoff to landing. | CTA: Book Your Flight
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
