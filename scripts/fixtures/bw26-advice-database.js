'use strict';
// Legacy BW-26 tests already replace Board/Brand ACL helpers. Give their Board-only
// fixtures a transaction transport; the real context module and tokenizer still run.
// BW-36.20 separately executes the real helpers and SQL against disposable PostgreSQL.
module.exports = function installAdviceDatabaseFixture() {
  require('../../api/_board-access').normalizeEmail = email => String(email || '').trim().toLowerCase();
  const filename = require.resolve('../../api/_boards-storage');
  const query = async sql => {
    if (/^SELECT id FROM boards/.test(sql)) return { rows: [{ id: 'board' }], rowCount: 1 };
    if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT role FROM board_editors)/.test(sql)) return { rows: [], rowCount: 0 };
    throw new Error(`Unexpected legacy fixture SQL: ${sql}`);
  };
  require.cache[filename] = { id: filename, filename, loaded: true, exports: { pool: { query, connect: async () => ({ query, release() {} }) } } };
};
