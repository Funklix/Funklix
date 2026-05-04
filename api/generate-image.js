const { uploadGeneratedImage } = require("./_image-storage");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const { nodeTitle = "", nodeContent = "", brandBrainData = {}, campaignContext = "", contentFormat = "1:1" } = req.body || {};
    const formatGuidance = contentFormat === "16:9"
      ? "Create a wide 16:9 landing-page/hero-style visual composition."
      : contentFormat === "9:16"
        ? "Create a vertical 9:16 story/reel-style visual composition."
        : "Create a square 1:1 social/creative visual composition.";
    const prompt = `Create a conceptual marketing visual based on the structured context below.

Structured context:
- nodeTitle: ${nodeTitle}
- nodeContent: ${nodeContent}
- brandBrainData (tone/style/assets): ${JSON.stringify(brandBrainData)}
- campaignContext: ${campaignContext || "none"}
- contentFormat: ${contentFormat}

Creative direction:
- Create a visual metaphor or scene that represents the idea.
- Use brand tone/style cues from brandBrainData where relevant.
- ${formatGuidance}
- Make it modern, minimal, premium, and high-quality.
- Use cinematic lighting and strong composition.
- Favor realistic detail or high-end editorial style.
- Avoid generic stock-photo look.
- Avoid plain white backgrounds unless explicitly requested.
- Keep composition clean and suitable for social media marketing.

Strict constraints:
- Do NOT include any text, letters, words, numbers, logos, or typography in the image.
- No UI elements.
- No screenshots.
- No posters.

Internal style preset:
- premium editorial marketing visual.`;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "high",
        n: 1
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ error: `OpenAI API error: ${errorBody}` });
    }

    const data = await response.json();
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) return res.status(500).json({ error: "OpenAI returned no image" });

    const uploaded = await uploadGeneratedImage({ imageBase64, mimeType: "image/png", prefix: "content" });
    return res.status(200).json(uploaded);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate image" });
  }
};
