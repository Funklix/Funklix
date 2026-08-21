const assert = require('assert');
const fs = require('fs');
const zlib = require('zlib');
process.env.AUTH_SECRET = 'document-foundation-test-secret';

const { normalizeBrandBrainData, buildBrandBrainContext } = require('../api/_brand-brain-context');
const { validateDocument, sanitizeFilename, DocumentValidationError, MAX_DOCUMENT_BYTES } = require('../api/_document-validation');
const { createSessionToken } = require('../api/_auth-session');
const records = require('../api/_document-records');
const { authorize } = require('../api/_document-route');

function zip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, bodyText] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name); const body = Buffer.from(bodyText); const compressed = zlib.deflateRawSync(body);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(8,8); local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(body.length,22); local.writeUInt16LE(nameBuffer.length,26);
    locals.push(local,nameBuffer,compressed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(8,10); central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(body.length,24); central.writeUInt16LE(nameBuffer.length,28); central.writeUInt32LE(offset,42);
    centrals.push(central,nameBuffer); offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralBody = Buffer.concat(centrals); const eocd = Buffer.alloc(22); const count = Object.keys(entries).length;
  eocd.writeUInt32LE(0x06054b50,0); eocd.writeUInt16LE(count,8); eocd.writeUInt16LE(count,10); eocd.writeUInt32LE(centralBody.length,12); eocd.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,centralBody,eocd]);
}
function expectCode(fn, code) { assert.throws(fn, (error) => error instanceof DocumentValidationError && error.code === code); }

const pdf = Buffer.from('%PDF-1.7\n1 0 obj <</Type /Page>> endobj\n%%EOF');
const pdfResult = validateDocument({ buffer: pdf, filename: 'deck.pdf', declaredMimeType: 'application/pdf' });
assert.strictEqual(pdfResult.extension, 'pdf'); assert.strictEqual(pdfResult.pageCount, 1); assert.strictEqual(pdfResult.contentHash.length, 64);
expectCode(() => validateDocument({ buffer: Buffer.from('not pdf'), filename: 'deck.pdf', declaredMimeType: 'application/pdf' }), 'invalid_pdf');
expectCode(() => validateDocument({ buffer: Buffer.from('%PDF-1.7 /Encrypt %%EOF'), filename: 'deck.pdf', declaredMimeType: 'application/pdf' }), 'encrypted_pdf');
expectCode(() => validateDocument({ buffer: Buffer.from(`%PDF-1.7\n${'/Type /Page\n'.repeat(101)}%%EOF`), filename: 'long.pdf', declaredMimeType: 'application/pdf' }), 'page_limit');
expectCode(() => validateDocument({ buffer: pdf, filename: 'deck.doc', declaredMimeType: 'application/msword' }), 'unsupported_type');
expectCode(() => validateDocument({ buffer: pdf, filename: 'deck.docm', declaredMimeType: 'application/zip' }), 'unsupported_type');
expectCode(() => validateDocument({ buffer: pdf, filename: 'deck.exe', declaredMimeType: 'application/pdf' }), 'unsupported_type');
expectCode(() => validateDocument({ buffer: pdf, filename: 'deck.pdf', declaredMimeType: 'text/plain' }), 'mime_mismatch');
expectCode(() => validateDocument({ buffer: Buffer.alloc(MAX_DOCUMENT_BYTES + 1), filename: 'deck.pdf', declaredMimeType: 'application/pdf' }), 'file_too_large');
assert.strictEqual(sanitizeFilename('../../secret\u0000 name.pdf'), 'secret_ name.pdf');

const docx = zip({ '[Content_Types].xml': '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', 'word/document.xml': '<w:document/>' });
const docxResult = validateDocument({ buffer: docx, filename: 'paper.docx', declaredMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
assert.strictEqual(docxResult.extension, 'docx'); assert.strictEqual(docxResult.pageCountStatus, 'requires_phase_b_validation');
expectCode(() => validateDocument({ buffer: zip({ '[Content_Types].xml': '<Types/>', 'word/other.xml': '<x/>' }), filename: 'bad.docx', declaredMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'invalid_docx');
expectCode(() => validateDocument({ buffer: Buffer.from('PK malformed'), filename: 'bad.docx', declaredMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'invalid_docx');
expectCode(() => validateDocument({ buffer: zip({ '../bad': 'x', '[Content_Types].xml': 'x', 'word/document.xml': 'x' }), filename: 'bad.docx', declaredMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'invalid_docx');
expectCode(() => validateDocument({ buffer: zip({ '[Content_Types].xml': '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', 'word/document.xml': 'x'.repeat(200000) }), filename: 'bomb.docx', declaredMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'docx_limits');

const accepted = { content:'Accepted market evidence', structuredFacts:{ marketCategory:'SaaS' }, acceptedAt:'2026-01-01', revisionId:'km_revision_12345678' };
const brand = { customTiles: [
  { id:'km_pitch_12345678', moduleType:'pitch_deck', title:'Renamed private tile', content:'PRIVATE PITCH', moduleData:{ documentImport:{ documentId:'doc_private', displayFilename:'secret.pdf' } } },
  { id:'km_white_12345678', moduleType:'whitepaper', title:'Whitepaper', content:'PRIVATE WHITEPAPER' },
  { id:'km_custom_12345678', moduleType:'custom', title:'Allowed custom', content:'LEGITIMATE CUSTOM CONTEXT' },
  { id:'km_market_12345678', moduleType:'market_research', title:'Market Research', content:'', moduleData:{ marketResearch:{ lifecycle:{status:'accepted'}, accepted } } }
]};
const context = buildBrandBrainContext('board', brand).text;
for (const privateValue of ['PRIVATE PITCH','PRIVATE WHITEPAPER','doc_private','secret.pdf']) assert(!context.includes(privateValue), privateValue);
assert(context.includes('LEGITIMATE CUSTOM CONTEXT')); assert(context.includes('Accepted market evidence'));
assert.strictEqual(normalizeBrandBrainData(brand).acceptedStrategyModules.length, 1);

const originalQuery = records.pool.query.bind(records.pool);
records.pool.query = async (sql) => {
  if (String(sql).includes('FROM boards')) return { rowCount:1, rows:[{ id:'board-a', owner_email:'owner@example.com', owner_id:'owner@example.com', brand_core_snapshot:{ customTiles:[{ id:'km_pitch_12345678', moduleType:'pitch_deck' }] } }] };
  if (String(sql).includes('FROM board_editors')) return { rowCount:0, rows:[] };
  throw new Error(`Unexpected query: ${sql}`);
};
function response() { return { statusCode:200, body:null, status(code){ this.statusCode=code; return this; }, json(body){ this.body=body; return this; } }; }
(async () => {
  let res = response(); let auth = await authorize({ headers:{}, query:{boardId:'board-a',tileId:'km_pitch_12345678',sourceType:'pitch_deck'} }, res); assert.strictEqual(auth,null); assert.strictEqual(res.statusCode,401);
  const token = createSessionToken({ email:'owner@example.com', id:'owner@example.com' });
  res=response(); auth=await authorize({ headers:{cookie:`funklix_session=${token}`}, query:{boardId:'board-a',tileId:'km_pitch_12345678',sourceType:'pitch_deck'} },res); assert(auth); assert.strictEqual(auth.tileId,'km_pitch_12345678');
  res=response(); auth=await authorize({ headers:{cookie:`funklix_session=${token}`}, query:{boardId:'board-a',tileId:'km_other_12345678',sourceType:'pitch_deck'} },res); assert.strictEqual(auth,null); assert.strictEqual(res.statusCode,409);
  res=response(); auth=await authorize({ headers:{cookie:`funklix_session=${token}`}, query:{boardId:'board-a',tileId:'km_pitch_12345678',sourceType:'whitepaper'} },res); assert.strictEqual(auth,null); assert.strictEqual(res.statusCode,409);
  records.pool.query=originalQuery;

  const app = fs.readFileSync(require.resolve('../app.js'),'utf8'); const route = fs.readFileSync(require.resolve('../api/_document-route.js'),'utf8'); const schema = fs.readFileSync(require.resolve('../api/_document-records.js'),'utf8');
  assert(app.includes('documentSourceOperationByTileId') && app.includes('active?.requestId !== requestId'));
  assert(app.includes('malwareScanStatus === "not_configured" ? "Not configured — not scanned"'));
  assert(route.includes("access?.canEdit") && route.includes("access?.canView"));
  assert(route.includes("row.id !== expected") && route.includes("current?.id || null) !== (upload.expected_document_id"));
  assert(schema.includes('storage_key TEXT NOT NULL UNIQUE') && schema.includes('brand_documents_active_tile_uidx'));
  assert(!app.includes('moduleData.documentImport =') && !app.includes('imageBase64: file'));
  assert(app.includes('deleteDocumentSource(tile, { removeTileAfter: true })'));
  const boardRoute = fs.readFileSync(require.resolve('../api/boards/[id].js'),'utf8');
  assert(boardRoute.includes('linkedDocuments') && boardRoute.includes('deletePrivate(document.storage_key)'));
  const boardCreate = fs.readFileSync(require.resolve('../api/boards/index.js'),'utf8');
  assert(!boardCreate.includes('brand_documents') && !boardCreate.includes('documentId'));
  console.log('Document import Phase A security, validation, context, and lifecycle checks passed.');
})().catch((error) => { records.pool.query=originalQuery; console.error(error); process.exitCode=1; });
