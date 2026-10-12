'use strict';
const { getSessionUser } = require('../../_auth-session');
const { pool } = require('../../_boards-storage');
const { previewSource, LearningError, boundedError } = require('../../_brand-learnings');
module.exports = async function handler(req,res) {
  res.setHeader?.('Cache-Control','private, no-store');
  try {
    if (req.method !== 'GET') throw new LearningError('INVALID_REQUEST',405);
    const user = getSessionUser(req);
    if (!user?.email) throw new LearningError('AUTHENTICATION_REQUIRED',401);
    if (!process.env.POSTGRES_URL) throw new LearningError('DATABASE_UNAVAILABLE',503);
    const query = req.query || {};
    if (Object.keys(query).some(k => !['id','board_id','node_id','expected_board_updated_at'].includes(k))
      || Object.values(query).some(v => typeof v !== 'string')) throw new LearningError('INVALID_REQUEST');
    const { id, ...source } = query;
    return res.status(200).json(await previewSource({db:pool,user,brandId:id,source}));
  } catch(error) { const safe=boundedError(error); return res.status(safe.status).json({contract:'brand_learning_source_v1',error:{code:safe.code}}); }
};
