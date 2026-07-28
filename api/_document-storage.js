const { del, get, issueSignedToken, presignUrl } = require('@vercel/blob');

function assertConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && (process.env.BLOB_STORE_ID || process.env.DOCUMENT_BLOB_STORE_ID))) throw new Error('private_document_storage_unavailable');
}
function options() { return process.env.DOCUMENT_BLOB_STORE_ID ? { storeId: process.env.DOCUMENT_BLOB_STORE_ID } : {}; }
async function createUploadUrl({ pathname, contentType, maximumSizeInBytes }) {
  assertConfigured(); const validUntil = Date.now() + 5 * 60 * 1000;
  const signed = await issueSignedToken({ ...options(), pathname, operations: ['put'], validUntil, allowedContentTypes: [contentType], maximumSizeInBytes });
  return (await presignUrl(signed, { operation: 'put', pathname, access: 'private', validUntil, allowedContentTypes: [contentType], maximumSizeInBytes, allowOverwrite: false, addRandomSuffix: false })).presignedUrl;
}
async function readPrivate(pathname) { assertConfigured(); return get(pathname, { ...options(), access: 'private', useCache: false }); }
async function deletePrivate(pathname) { assertConfigured(); return del(pathname, options()); }
module.exports = { createUploadUrl, readPrivate, deletePrivate, assertConfigured };
