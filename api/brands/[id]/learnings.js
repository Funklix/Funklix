'use strict';
const { getSessionUser } = require('../../_auth-session');
const { pool } = require('../../_boards-storage');
const { operate, inputRequest, LearningError, boundedError } = require('../../_brand-learnings');
module.exports = async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  try {
    if (!['GET','POST','PATCH'].includes(req.method)) throw new LearningError('INVALID_REQUEST',405);
    const user = getSessionUser(req);
    if (!user?.email) throw new LearningError('AUTHENTICATION_REQUIRED',401);
    if (!process.env.POSTGRES_URL) throw new LearningError('DATABASE_UNAVAILABLE',503);
    if (Object.keys(req.query || {}).some(k => !['id','status','offset'].includes(k))
      || Object.values(req.query || {}).some(Array.isArray)) throw new LearningError('INVALID_REQUEST',400);
    const input = req.method === 'GET' ? null : inputRequest(req.body, req.method === 'POST');
    const offset = req.query?.offset == null ? 0 : /^\d{1,5}$/.test(req.query.offset) ? Number(req.query.offset) : -1;
    const result = await operate({ db:pool, user, brandId:req.query?.id, input, filter:req.query?.status || 'all', offset });
    return res.status(req.method === 'POST' ? 201 : 200).json(result);
  } catch (error) {
    const safe = boundedError(error);
    return res.status(safe.status).json({ contract:'brand_learnings_v1', error:{ code:safe.code } });
  }
};
