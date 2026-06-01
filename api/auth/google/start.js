const crypto = require('crypto');

function safeRelativeReturnTo(value) {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return '/';
  try {
    const parsed = new URL(trimmed, 'https://funklix.local');
    if (parsed.origin !== 'https://funklix.local') return '/';
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch (_error) {
    return '/';
  }
}

function withAuthError(path) {
  const parsed = new URL(path, 'https://funklix.local');
  parsed.searchParams.set('auth_error', 'not_configured');
  return `${parsed.pathname}${parsed.search}` || '/?auth_error=not_configured';
}

module.exports = async (req, res) => {
  try {
    const returnTo = safeRelativeReturnTo(req.query?.returnTo);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.redirect(withAuthError(returnTo));
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    const secure = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', [
      `funklix_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${secure ? 'Secure;' : ''}`,
      `funklix_oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${secure ? 'Secure;' : ''}`
    ]);
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
