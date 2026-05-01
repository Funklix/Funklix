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

    const prompt = `Create a campaign plan in strict JSON only.\nInput idea: ${campaignIdea}\nAdditional context: ${additionalContext}\nBrand brain data: ${JSON.stringify(brandBrainData)}\nReturn ONLY JSON with this schema:\n{\n  "idea": { "title": "", "content": "" },\n  "variations": [\n    {\n      "title": "",\n      "content": "",\n      "contentNode": { "title": "", "content": "" },\n      "socialPost": { "title": "", "caption": "", "platform": "" }\n    }\n  ],\n  "landingPage": { "title": "", "content": "" },\n  "emailCampaign": { "title": "", "content": "" }\n}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt,
        text: { format: { type: "json_object" } }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ error: `OpenAI API error: ${errorBody}` });
    }

    const data = await response.json();
    const rawText =
      data?.output_text ||
      data?.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      "";
    const parsed = JSON.parse(rawText);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate campaign" });
  }
};
