const { put } = require("@vercel/blob");

function parseBase64Payload(imageBase64, mimeType = "image/png") {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new Error("imageBase64 is required");
  }

  const trimmed = imageBase64.trim();
  if (!trimmed) throw new Error("imageBase64 is empty");

  let payload = trimmed;
  let detectedMime = mimeType;

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL payload");
    detectedMime = match[1] || mimeType;
    payload = match[2] || "";
  }

  return {
    buffer: Buffer.from(payload, "base64"),
    mimeType: detectedMime || "image/png"
  };
}

async function uploadGeneratedImage({ imageBase64, mimeType = "image/png", prefix = "generated" }) {
  const { buffer, mimeType: resolvedMimeType } = parseBase64Payload(imageBase64, mimeType);
  const extension = resolvedMimeType.split("/")[1] || "png";
  const pathname = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: resolvedMimeType,
    addRandomSuffix: false
  });

  return { imageUrl: blob.url, mimeType: resolvedMimeType };
}

async function uploadImageBuffer({ buffer, mimeType, prefix = "uploaded" }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Image buffer is required");
  const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  const extension = extensions[mimeType];
  if (!extension) throw new Error("Unsupported image type");
  const pathname = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const blob = await put(pathname, buffer, { access: "public", contentType: mimeType, addRandomSuffix: false });
  return { imageUrl: blob.url, mimeType };
}

module.exports = { uploadGeneratedImage, uploadImageBuffer };
