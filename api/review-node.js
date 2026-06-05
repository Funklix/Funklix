function cleanGeneratedText(value = "") {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanList(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanGeneratedText(item))
    .filter(Boolean)
    .slice(0, 4);
}

function reviewFocusForNodeType(nodeType = "") {
  if (nodeType === "Social Media Posting") return "Focus especially on hook strength, platform fit, caption clarity, CTA, and formatting.";
  if (nodeType === "Landing Page") return "Focus especially on header claim strength, ICP problem clarity, solution clarity, trust building, and conversion CTA.";
  if (nodeType === "Email Campaign") return "Focus especially on subject line, preview text, body clarity, CTA, and reader motivation.";
  if (nodeType === "Content") return "Focus especially on hook, narrative, supporting points, CTA, and image prompt relevance.";
  if (nodeType === "Campaign Variation") return "Focus especially on angle clarity, differentiation, audience relevance, and strategic usefulness.";
  return "Focus on clarity, audience fit, goal alignment, CTA strength, completeness, and next-step readiness.";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const {
      nodeType = "",
      title = "",
      content = "",
      social = {},
      landingPage = {},
      imagePrompt = "",
      goal = "",
      audience = "",
      channel = "",
      funnelStage = "",
      tone = "",
      tags = [],
      campaignContext = "",
      connectedNodeContext = {},
      brandBrainData = {}
    } = req.body || {};

    const prompt = `Review this Campaign Canvas node and return concise, practical feedback.

Node context:
${JSON.stringify({ nodeType, title, content, social, landingPage, imagePrompt, goal, audience, channel, funnelStage, tone, tags })}

Connected campaign context:
${JSON.stringify(connectedNodeContext || {})}

Campaign summary:
${campaignContext || "none"}

Brand Brain data:
${JSON.stringify(brandBrainData || {})}

Review focus:
For any node, evaluate clarity, audience fit, goal alignment, CTA strength, completeness, and next-step readiness.
${reviewFocusForNodeType(nodeType)}

Constraints:
- Be concise and helpful.
- Plain text only.
- No markdown bold syntax.
- No markdown headings.
- No code fences.
- No giant walls of text.
- Do not fabricate proof, metrics, testimonials, or brand facts not present in context.
- Return strict JSON only.`;

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
            content: "You are an expert campaign reviewer. You give concise, actionable feedback and return only strict JSON."
          },
          { role: "user", content: prompt }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "node_review",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["score", "summary", "strengths", "improvements", "suggestedRewrite"],
              properties: {
                score: { type: "number", minimum: 0, maximum: 10 },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
                improvements: { type: "array", items: { type: "string" }, maxItems: 4 },
                suggestedRewrite: { type: "string" }
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
      const score = Math.max(0, Math.min(10, Number(parsed.score) || 0));
      return res.status(200).json({
        score,
        summary: cleanGeneratedText(parsed.summary || ""),
        strengths: cleanList(parsed.strengths),
        improvements: cleanList(parsed.improvements),
        suggestedRewrite: cleanGeneratedText(parsed.suggestedRewrite || "")
      });
    } catch (_error) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON", rawText });
    }
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to review node" });
  }
};
