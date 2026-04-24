// =============================================================================
// /api/google-oauth-init
// -----------------------------------------------------------------------------
// Lance le flow OAuth Google. À appeler UNE SEULE FOIS depuis ton navigateur
// après validation de l'accès API par Google.
//
// Usage : https://app.solution-phone.fr/api/google-oauth-init
// Redirige vers Google, qui redirige vers /api/google-oauth-callback
// =============================================================================

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI manquant dans les env vars Vercel"
    });
  }

  // State anti-CSRF — stocké dans un cookie pour vérification au callback
  const state = Buffer.from(JSON.stringify({
    t: Date.now(),
    r: Math.random().toString(36).slice(2)
  })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",       // indispensable pour obtenir un refresh_token
    prompt: "consent",            // force Google à renvoyer un refresh_token même si déjà autorisé
    state: state,
    include_granted_scopes: "true"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.setHeader("Set-Cookie", `google_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.writeHead(302, { Location: authUrl });
  res.end();
}
