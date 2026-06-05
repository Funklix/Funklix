const { buildBrandBrainContext } = require("./_brand-brain-context");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const {
      nodeType = "",
      currentContent = {},
      instruction = "",
      brandBrainData = {},
      boardId = "",
      parentNode = null,
      campaignContext = ""
    } = req.body || {};
    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const parentNodeSection = parentNode
      ? `Parent node: ${JSON.stringify(parentNode)}`
      : "Parent node: none";
    const campaignContextSection = campaignContext
      ? `Campaign context: ${campaignContext}`
      : "Campaign context: none";
    const prompt = `Refine campaign node content.
Node type: ${nodeType}
Instruction: ${instruction}
Current content: ${JSON.stringify(currentContent)}
${brandBrainContext.text}
${parentNodeSection}
${campaignContextSection}
Guidance: Use parent node and normalized Brand Brain context to guide tone, archetype-aligned behavior, emotional direction, and intent. Do not let archetype guidance override strategy or change core meaning unless the instruction implies it.
Return strict JSON only:
{
  "title": "",
  "content": "",
  "caption": ""
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
            content: "You are a senior marketing strategist refining campaign content. You always consider brand voice, campaign context, and strategic intent."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "refined_node",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "content", "caption"],
              properties: {
                title: { type: "string" },
                content: { type: "string" },
                caption: { type: "string" }
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
      .find((c) => c?.type === "output_text" && c?.text)?.text || "";
    const rawText = data?.output_text || data?.output?.[0]?.content?.[0]?.text || outputItemText || "";
    if (!rawText) return res.status(500).json({ error: "OpenAI returned empty output", data });
    try {
      return res.status(200).json(JSON.parse(rawText));
    } catch (_error) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON", rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to refine node" });
  }
};
