module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const { sourceImage = "", overlayText = "", format = "1:1", brandBrainData = {}, campaignContext = "" } = req.body || {};
    if (!sourceImage) return res.status(400).json({ error: "sourceImage is required" });
    if (!overlayText) return res.status(400).json({ error: "overlayText is required" });

    const formatGuidance = format === "16:9"
      ? "Design for a wide 16:9 social hero visual."
      : format === "9:16"
        ? "Design for a vertical 9:16 story/reel visual."
        : "Design for a square 1:1 social post visual.";

    let imageBuffer;
    if (sourceImage.startsWith("data:")) {
      const base64 = sourceImage.split(",")[1] || "";
      imageBuffer = Buffer.from(base64, "base64");
    } else {
      const fetched = await fetch(sourceImage);
      if (!fetched.ok) return res.status(400).json({ error: "Could not fetch source image" });
      imageBuffer = Buffer.from(await fetched.arrayBuffer());
    }

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", `Create a polished, minimal, marketing-ready social visual from this source image.\nOverlay text to include prominently: "${overlayText}".\n${formatGuidance}\nCampaign context: ${campaignContext || "none"}\nBrand guidance: ${JSON.stringify(brandBrainData)}\nKeep typography clean and legible with strong composition.`);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("image", new Blob([imageBuffer], { type: "image/png" }), "source.png");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ error: `OpenAI API error: ${errorBody}` });
    }

    const data = await response.json();
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) return res.status(500).json({ error: "OpenAI returned no image" });
    return res.status(200).json({ imageBase64, mimeType: "image/png" });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate posting visual" });
  }
};
