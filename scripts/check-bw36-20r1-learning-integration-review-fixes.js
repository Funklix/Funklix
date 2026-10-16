'use strict';

// Real Advice, ACL and revalidation code; disposable PostgreSQL and mocked OpenAI.
const assert = require('node:assert/strict');
const { fixture } = require('./fixtures/bw36-20-database');

async function main() {
  const f = await fixture();
  const unavailable = {
    error: 'Approved Brand Learning context is temporarily unavailable. Please retry.',
    code: 'learning_context_unavailable', retryable: true
  };
  const changed = {
    error: 'Advice context or access changed. Please retry with current context.',
    code: 'advice_context_changed', retryable: true
  };
  const plain = value => JSON.parse(JSON.stringify(value));
  try {
    for (const kind of ['board-only', 'empty-library', 'approved-learnings']) {
      await f.reset();
      if (kind === 'board-only') await f.pg.exec('DELETE FROM brand_members');
      if (kind === 'approved-learnings') await f.insert();
      const response = await f.invoke();
      assert.equal(response.statusCode, 200, kind);
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].store, false, kind);
      assert.equal(f.calls[0].model, 'gpt-4o-mini');
      if (kind === 'approved-learnings') assert.equal(response.body.context.approved_learnings.items.length, 1);
    }

    const faults = ['ECONNRESET', '08006', '55P03', '57014', '42P01', '42703', '40001', '40P01', undefined];
    for (const stage of ['pre-dispatch', 'post-inference']) {
      const target = stage === 'pre-dispatch' ? 2 : 3;
      for (const code of faults) for (const point of ['connect', 'scope', 'identity', 'selected', 'commit']) {
        await f.reset(); await f.insert();
        let connections = 0, injected = false;
        const originalConnect = f.db.connect;
        const fault = () => { injected = true; throw Object.assign(new Error('PRIVATE database host, SQL and authorization details'), { code }); };
        f.db.connect = async () => {
          connections++;
          if (connections === target && point === 'connect') fault();
          return originalConnect();
        };
        f.onQuery = sql => {
          if (connections !== target) return;
          if ((point === 'scope' && sql.includes('NOWAIT'))
            || (point === 'identity' && sql.includes('FROM public.app_identities'))
            || (point === 'selected' && sql.includes('id=ANY'))
            || (point === 'commit' && sql === 'COMMIT')) fault();
        };
        const released = f.released;
        let response;
        try { response = await f.invoke(); } finally { f.db.connect = originalConnect; }
        assert(injected, `${stage}/${point}/${code}: exercised fault`);
        assert.equal(response.statusCode, 503, `${stage}/${point}/${code}`);
        assert.deepEqual(plain(response.body), unavailable, 'Only bounded public details; no answer');
        assert.equal(f.calls.length, target - 2, 'No provider retry; no dispatch after pre-check failure');
        assert.equal(f.active, 0, 'Transaction rolled back');
        assert.equal(f.released - released, target - (point === 'connect' ? 1 : 0), 'Every acquired connection released');
        if (point !== 'connect') assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
      }

      const mutations = [
        "DELETE FROM board_editors",
        "DELETE FROM brand_members",
        "UPDATE app_identities SET status='disabled'",
        "UPDATE app_identities SET canonical_email='revoked@example.invalid'",
        "UPDATE boards SET brand_core_snapshot='{\"changed\":true}'::jsonb",
        "UPDATE brand_learnings SET status='archived',revision=revision+1"
      ];
      for (const sql of mutations) {
        await f.reset(); await f.insert();
        if (stage === 'post-inference') f.onProvider = () => f.pg.exec(sql);
        else {
          let transactions = 0;
          f.onQuery = async query => { if (/^BEGIN/.test(query) && ++transactions === 2) await f.pg.exec(sql); };
        }
        const response = await f.invoke();
        assert.equal(response.statusCode, 409, `${stage}: confirmed stale context/authorization (${sql})`);
        assert.deepEqual(plain(response.body), changed);
        assert.equal(f.calls.length, target - 2);
        assert.equal(f.active, 0);
      }
    }
    console.log('PASS BW-36.20R1: explicit store:false with/without approved Learnings; 90 infrastructure failures and 12 stale-context cases across both revalidation stages; bounded errors, suppressed output, released transactions, no provider retries.');
  } finally { await f.pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
