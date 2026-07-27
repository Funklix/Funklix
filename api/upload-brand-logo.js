const { getSessionUser } = require('./_auth-session');
const { uploadImageBuffer } = require('./_image-storage');
const { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } = require('./_website-image-retrieval');

const SIGNATURES = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getSessionUser(req)?.email) return res.status(401).json({ error: 'Sign in before uploading a logo.' });
  try {
    const { imageBase64 = '', mimeType = '' } = req.body || {};
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || typeof imageBase64 !== 'string') return res.status(415).json({ error: 'Use PNG, JPEG, WebP, or GIF.' });
    const buffer = Buffer.from(imageBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Logo must be 2 MB or smaller.' });
    if (!SIGNATURES[mimeType]?.(buffer)) return res.status(415).json({ error: 'The file content does not match its image type.' });
    const uploaded = await uploadImageBuffer({ buffer, mimeType, prefix: 'brand-logo' });
    return res.status(200).json(uploaded);
  } catch (_error) {
    return res.status(500).json({ error: 'Could not persist the logo.' });
  }
};
