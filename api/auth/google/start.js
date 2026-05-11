const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.redirect('/?auth_error=not_configured');
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    const secure = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `funklix_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${secure ? 'Secure;' : ''}`);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return res.redirect(url.toString());
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to start Google OAuth' });
  }
};
