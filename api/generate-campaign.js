module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });
  }

  try {
    const { campaignIdea = "", additionalContext = "", brandBrainData = {} } = req.body || {};
    if (!campaignIdea.trim()) {
      return res.status(400).json({ error: "campaignIdea is required" });
    }

    const prompt = `You are a senior marketing strategist specializing in high-performing campaign concepts. You think in hooks, angles, emotional triggers and conversion logic.

Create a campaign plan in strict JSON only.

Input idea: ${campaignIdea}
Additional context: ${additionalContext}
Brand brain data: ${JSON.stringify(brandBrainData)}

Quality requirements:
- Use tone of voice from Brand Brain to shape wording.
- Use messaging pillars to define campaign angles.
- Include keywords naturally (not stuffed).
- Reflect value proposition directly in message and promise.
- Keep language human, realistic, and specific.
- Avoid generic phrases and clichés (e.g. "innovative solutions").

Content requirements by section:
- idea: clear hook, short but powerful.
- variations[0]: emotional angle.
- variations[1]: rational angle.
- variations[*].contentNode: clear concept description, platform-agnostic idea.
- variations[*].socialPost: very strong first-line hook, concise caption, no fluff.
- landingPage: include headline, subheadline, and core promise in the content.
- emailCampaign: include subject line and short body copy in the content.

Return ONLY JSON with this schema:
{
  "idea": { "title": "", "content": "" },
  "variations": [
    {
      "title": "",
      "content": "",
      "contentNode": { "title": "", "content": "" },
      "socialPost": { "title": "", "caption": "", "platform": "" }
    }
  ],
  "landingPage": { "title": "", "content": "" },
  "emailCampaign": { "title": "", "content": "" }
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
            content: "You are a senior marketing strategist specializing in high-performing campaign concepts. You think in hooks, angles, emotional triggers and conversion logic. Return only strict JSON matching the schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "campaign_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["idea", "variations", "landingPage", "emailCampaign"],
              properties: {
                idea: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "content"],
                  properties: { title: { type: "string" }, content: { type: "string" } }
                },
                variations: {
                  type: "array",
                  minItems: 2,
                  maxItems: 2,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "content", "contentNode", "socialPost"],
                    properties: {
                      title: { type: "string" },
                      content: { type: "string" },
                      contentNode: {
                        type: "object",
                        additionalProperties: false,
                        required: ["title", "content"],
                        properties: { title: { type: "string" }, content: { type: "string" } }
                      },
                      socialPost: {
                        type: "object",
                        additionalProperties: false,
                        required: ["title", "caption", "platform"],
                        properties: {
                          title: { type: "string" },
                          caption: { type: "string" },
                          platform: { type: "string" }
                        }
                      }
                    }
                  }
                },
                landingPage: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "content"],
                  properties: { title: { type: "string" }, content: { type: "string" } }
                },
                emailCampaign: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "content"],
                  properties: { title: { type: "string" }, content: { type: "string" } }
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
    console.log("OpenAI responses payload", JSON.stringify(data));
    const rawText =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";
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
