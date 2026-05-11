const { clearSessionCookie, getSessionUser } = require('../../_auth-session');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const user = getSessionUser(req);
    const authConfigured = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!(process.env.AUTH_SECRET || process.env.SESSION_SECRET);
    return res.status(200).json({ user: user || null, authConfigured });
  }
  if (req.method === 'DELETE' || req.method === 'POST') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'GET, DELETE, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
