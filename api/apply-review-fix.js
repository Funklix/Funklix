const { buildBrandBrainContext } = require("./_brand-brain-context");

function cleanText(value = "", maxLength = 8000) {
  return String(value || "").slice(0, maxLength).trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const {
      boardId = "",
      nodeId = "",
      improvementText = "",
      currentNodeContent = "",
      nodeType = "",
      brandBrainData = {}
    } = req.body || {};

    const cleanImprovement = cleanText(improvementText, 1200);
    const cleanCurrentContent = cleanText(currentNodeContent, 12000);
    if (!cleanImprovement) return res.status(400).json({ error: "Missing improvementText" });
    if (!cleanCurrentContent) return res.status(400).json({ error: "Missing currentNodeContent" });

    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const prompt = `Apply one AI Review improvement to an existing Campaign Canvas node.

Node id: ${cleanText(nodeId, 120) || "unknown"}
Node type: ${cleanText(nodeType, 120) || "unknown"}
Improvement to address:
${cleanImprovement}

Current node content:
${cleanCurrentContent}

${brandBrainContext.text}

Instructions:
- Generate a concrete revised version of the node content that specifically addresses the improvement.
- Preserve the node's core meaning, campaign intent, and factual claims.
- Do not invent proof, metrics, testimonials, guarantees, or brand facts not present in the content or Brand Brain context.
- Do not rewrite the node title.
- Return only the improved body/content text in suggestedContent.
- Keep the revision concise enough to remain usable in the existing node.
- Use Brand Brain context, including Brand DNA, archetype guidance, ICP/personas, tone, and messaging pillars when available.

Return strict JSON only.`;

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
            content: "You are a senior marketing strategist applying one specific review improvement to campaign node content. You preserve intent and brand truth while making the smallest useful content improvement."
          },
          { role: "user", content: prompt }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "applied_review_fix",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["explanation", "suggestedContent"],
              properties: {
                explanation: { type: "string" },
                suggestedContent: { type: "string" }
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
      const parsed = JSON.parse(rawText);
      return res.status(200).json({
        explanation: cleanText(parsed.explanation, 1200),
        suggestedContent: cleanText(parsed.suggestedContent, 12000)
      });
    } catch (_error) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON", rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to apply review fix" });
  }
};
