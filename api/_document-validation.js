const crypto = require('crypto');
const zlib = require('zlib');

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2048;
const MAX_DOCX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_DOCX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 100;
const DOCUMENT_TYPES = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

class DocumentValidationError extends Error {
  constructor(code, message, status = 415) { super(message); this.code = code; this.status = status; }
}

function sanitizeFilename(value) {
  const raw = String(value || '').normalize('NFKC').replace(/\\/g, '/').split('/').pop() || 'document';
  const safe = raw.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return safe || 'document';
}

function extensionForFilename(filename) {
  const match = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function readZipEntries(buffer) {
  const min = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
  const count = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!count || count > MAX_DOCX_ENTRIES || centralOffset + centralSize > buffer.length) throw new DocumentValidationError('docx_limits', 'The DOCX package exceeds safe limits.', 413);
  const entries = new Map(); let offset = centralOffset; let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
    const flags = buffer.readUInt16LE(offset + 8); const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20); const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28); const extraLength = buffer.readUInt16LE(offset + 30); const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42); const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length || flags & 1) throw new DocumentValidationError('invalid_docx', 'Encrypted or malformed DOCX packages are not supported.');
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new DocumentValidationError('invalid_docx', 'The DOCX package contains an unsafe path.');
    if (entries.has(name) || uncompressedSize > MAX_DOCX_ENTRY_BYTES) throw new DocumentValidationError('docx_limits', 'The DOCX package exceeds safe limits.', 413);
    total += uncompressedSize;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES || (compressedSize === 0 ? uncompressedSize > 0 : uncompressedSize / compressedSize > MAX_DOCX_COMPRESSION_RATIO)) throw new DocumentValidationError('docx_limits', 'The DOCX package exceeds safe decompression limits.', 413);
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset }); offset = end;
  }
  return entries;
}

function readZipEntry(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
  const nameLength = buffer.readUInt16LE(offset + 26); const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength; const end = start + entry.compressedSize;
  if (end > buffer.length) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
  const compressed = buffer.subarray(start, end);
  let output;
  if (entry.method === 0) output = compressed;
  else if (entry.method === 8) output = zlib.inflateRawSync(compressed, { maxOutputLength: Math.min(entry.uncompressedSize + 1, MAX_DOCX_ENTRY_BYTES + 1) });
  else throw new DocumentValidationError('invalid_docx', 'The DOCX package uses an unsupported compression method.');
  if (output.length !== entry.uncompressedSize) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
  return output;
}

function validatePdf(buffer) {
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || !buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from('%%EOF'))) throw new DocumentValidationError('invalid_pdf', 'The PDF file is malformed.');
  const structural = buffer.toString('latin1');
  if (/\/Encrypt\b/.test(structural)) throw new DocumentValidationError('encrypted_pdf', 'Password-protected or encrypted PDFs are not supported.');
  const count = (structural.match(/\/Type\s*\/Page\b/g) || []).length;
  if (count > 100) throw new DocumentValidationError('page_limit', 'PDF documents may contain at most 100 pages.', 413);
  return { pageCount: count || null, pageCountStatus: count ? 'best_effort_validated' : 'requires_phase_b_validation' };
}

function validateDocx(buffer) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw new DocumentValidationError('invalid_docx', 'The DOCX package is malformed.');
  const entries = readZipEntries(buffer);
  for (const required of ['[Content_Types].xml', 'word/document.xml']) if (!entries.has(required)) throw new DocumentValidationError('invalid_docx', 'The file is not a valid DOCX document.');
  const types = readZipEntry(buffer, entries.get('[Content_Types].xml')).toString('utf8');
  if (!types.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') || /macroEnabled/i.test(types)) throw new DocumentValidationError('invalid_docx', 'Macro-enabled or invalid Office documents are not supported.');
  return { pageCount: null, pageCountStatus: 'requires_phase_b_validation' };
}

function validateDocument({ buffer, filename, declaredMimeType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new DocumentValidationError('empty_file', 'Choose a non-empty PDF or DOCX file.');
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new DocumentValidationError('file_too_large', 'Documents must be 20 MB or smaller.', 413);
  const displayFilename = sanitizeFilename(filename); const extension = extensionForFilename(displayFilename);
  if (extension === 'doc' || extension === 'docm') throw new DocumentValidationError('unsupported_type', 'Legacy DOC and macro-enabled DOCM files are not supported.');
  if (!DOCUMENT_TYPES[extension]) throw new DocumentValidationError('unsupported_type', 'Use a PDF or DOCX file.');
  if (declaredMimeType && declaredMimeType !== DOCUMENT_TYPES[extension] && !(extension === 'docx' && declaredMimeType === 'application/zip')) throw new DocumentValidationError('mime_mismatch', 'The file type does not match its extension.');
  const structural = extension === 'pdf' ? validatePdf(buffer) : validateDocx(buffer);
  return { displayFilename, extension, mediaType: DOCUMENT_TYPES[extension], fileSize: buffer.length, contentHash: crypto.createHash('sha256').update(buffer).digest('hex'), ...structural };
}

module.exports = { MAX_DOCUMENT_BYTES, DOCUMENT_TYPES, DocumentValidationError, sanitizeFilename, validateDocument, readZipEntries };
