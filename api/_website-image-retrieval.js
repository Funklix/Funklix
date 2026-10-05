const { validateWebsiteUrl, resolvePublicAddresses } = require('./_website-url-policy');
const { requestOnce, WebsiteRetrievalError } = require('./_website-retrieval');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_IMAGE_DIMENSION = 4096;
function imageDimensions(buffer,mime){
  if(mime==='image/png'&&buffer.length>=24)return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(mime==='image/gif'&&buffer.length>=10)return {width:buffer.readUInt16LE(6),height:buffer.readUInt16LE(8)};
  if(mime==='image/webp'&&buffer.length>=30&&buffer.toString('ascii',12,16)==='VP8X')return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};
  if(mime==='image/jpeg'){let i=2;while(i+9<buffer.length){if(buffer[i]!==255){i++;continue;}const marker=buffer[i+1],len=buffer.readUInt16BE(i+2);if([0xc0,0xc1,0xc2,0xc3,0xc9,0xca].includes(marker))return {height:buffer.readUInt16BE(i+5),width:buffer.readUInt16BE(i+7)};if(len<2)break;i+=2+len;}}
  return null;
}
function validateImageBuffer(buffer,mimeType){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_IMAGE_BYTES||!ALLOWED_IMAGE_TYPES.has(mimeType))throw new WebsiteRetrievalError('unsupported_content_type','Unsupported logo.');
  const signatures={'image/png':b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'image/jpeg':b=>b[0]===255&&b[1]===216&&b[2]===255,'image/gif':b=>/^GIF8[79]a$/.test(b.subarray(0,6).toString('ascii')),'image/webp':b=>b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'};
  if(!signatures[mimeType](buffer))throw new WebsiteRetrievalError('unsupported_content_type','Image signature mismatch.');const size=imageDimensions(buffer,mimeType);if(!size||size.width<16||size.height<16||size.width>MAX_IMAGE_DIMENSION||size.height>MAX_IMAGE_DIMENSION)throw new WebsiteRetrievalError('invalid_dimensions','Logo dimensions are not supported.');return size;
}

async function retrievePublicImage(input, options = {}) {
  let url = validateWebsiteUrl(input);
  const visited = new Set();
  for (let redirects = 0; ; redirects += 1) {
    if (visited.has(url.href)) throw new WebsiteRetrievalError('redirect_loop', 'The image redirect loop could not be followed.');
    visited.add(url.href);
    const addresses = await resolvePublicAddresses(url.hostname.replace(/^\[|\]$/g, ''), options.lookup);
    const response = await requestOnce(url, addresses, { requestImpl: options.requestImpl });
    const status = Number(response.statusCode || 0);
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (redirects >= 5) throw new WebsiteRetrievalError('too_many_redirects', 'The image has too many redirects.');
      const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
      url = validateWebsiteUrl(new URL(location, url).href);
      continue;
    }
    if (status < 200 || status >= 300) { response.destroy(); throw new WebsiteRetrievalError('http_error', 'The image did not return a successful response.'); }
    const mimeType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) { response.destroy(); throw new WebsiteRetrievalError('unsupported_content_type', 'The logo is not a supported image.'); }
    const declared = Number(response.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The logo is too large.'); }
    const chunks = []; let total = 0;
    for await (const chunk of response) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES) { response.destroy(); throw new WebsiteRetrievalError('response_too_large', 'The logo is too large.'); }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks, total);
    if (!buffer.length) throw new WebsiteRetrievalError('empty_content', 'The logo response was empty.');
    validateImageBuffer(buffer, mimeType);
    return { buffer, mimeType, sourceUrl: url.href };
  }
}

module.exports = { retrievePublicImage, validateImageBuffer, imageDimensions, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION };
