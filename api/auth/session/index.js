const { clearSessionCookie, getSessionUser } = require('../../_auth-session');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const user = getSessionUser(req);
    return res.status(200).json({ user: user || null });
  }
  if (req.method === 'DELETE' || req.method === 'POST') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'GET, DELETE, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
