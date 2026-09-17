'use strict';

const PAGE_ID = /^[0-9]{1,32}$/;

// Keep provider identity and token-map selection inside the server boundary.
function resolveSelectedPageCredential(credentials, externalPageId) {
  if (!credentials || typeof credentials !== 'object' || !PAGE_ID.test(externalPageId || '')) return null;
  const token = credentials.pageTokens?.[externalPageId];
  if (typeof token !== 'string' || token.length < 8 || token.length > 12000) return null;
  return Object.freeze({ accessToken: token, tokenSource: 'selected_page_token' });
}

module.exports = { PAGE_ID, resolveSelectedPageCredential };
