const { createSessionToken, setSessionCookie } = require('../../_auth-session');

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map((x) => x.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
  }));
}

module.exports = async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookies = parseCookies(req);
    if (!code || !state || state !== cookies.funklix_oauth_state) {
      return res.status(400).send('OAuth state mismatch');
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).send('Missing Google OAuth env vars');

    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) return res.status(502).send('Failed to exchange OAuth code');

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile?.email) return res.status(502).send('Failed to fetch user profile');

    const user = { name: profile.name || '', email: profile.email, avatar: profile.picture || '' };
    const token = createSessionToken(user);
    setSessionCookie(res, token);
    res.setHeader('Set-Cookie', [
      res.getHeader('Set-Cookie'),
      `funklix_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`
    ]);
    return res.redirect('/');
  } catch (error) {
    return res.status(500).send(error.message || 'Google auth callback failed');
  }
};
