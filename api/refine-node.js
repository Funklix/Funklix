const generation = require('./_campaign-generation-context');
const { getSessionUser } = require('./_auth-session');

module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = getSessionUser(req);
    if (!user?.email) return res.status(401).json({ error: 'Authentication required' });
    generation.validateBody(req.body, ['nodeType', 'currentContent', 'instruction', 'brandBrainData', 'boardId',
      'parentNode', 'campaignContext', 'connectedNodeContext']);
    const {
      nodeType = "",
      currentContent = {},
      instruction = "",
      boardId = "",
      parentNode = null,
      campaignContext = ""
    } = req.body || {};
    const nodeKeys = ['id', 'tempId', 'type', 'title', 'description', 'content', 'caption', 'metadata', 'social', 'landingPage'];
    const validNode = node => generation.object(node) && Object.keys(node).every(key => nodeKeys.includes(key))
      && Object.entries(node).every(([key, value]) => ['metadata', 'social', 'landingPage'].includes(key)
        ? generation.object(value) : typeof value === 'string');
    if (!['Idea', 'Campaign Variation', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign'].includes(nodeType)
      || typeof instruction !== 'string' || !instruction.trim() || instruction.length > 256 * 1024
      || !Object.hasOwn(req.body, 'currentContent') || !Object.keys(currentContent || {}).length
      || !validNode(currentContent) || (parentNode !== null && !validNode(parentNode))
      || typeof campaignContext !== 'string' || campaignContext.length > 256 * 1024) generation.fail('VALIDATION', 400);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });
    const dataContext = await generation.capture({ boardId, user });
    const brandBrainContext = generation.context(dataContext);
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

    await generation.revalidate({ data: dataContext, user });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        store: false,
        input: [
          {
            role: "system",
            content: `You are a senior marketing strategist refining campaign content. You always consider brand voice, campaign context, and strategic intent. ${generation.POLICY}`
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
      await generation.revalidate({ data: dataContext, user });
      return res.status(502).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    await generation.revalidate({ data: dataContext, user });
    const outputItemText = (data?.output || [])
      .flatMap((item) => item?.content || [])
      .find((c) => c?.type === "output_text" && c?.text)?.text || "";
    const rawText = data?.output_text || data?.output?.[0]?.content?.[0]?.text || outputItemText || "";
    if (!rawText) return res.status(500).json({ error: "OpenAI returned empty output" });
    try {
      return res.status(200).json(JSON.parse(rawText));
    } catch (_error) {
      return res.status(500).json({ error: "Failed to parse OpenAI JSON" });
    }
  } catch (error) {
    return generation.respond(res, error);
  }
};
