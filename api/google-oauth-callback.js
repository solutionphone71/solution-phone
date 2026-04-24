// =============================================================================
// /api/google-oauth-callback
// -----------------------------------------------------------------------------
// Reçoit le code OAuth de Google, l'échange contre un refresh_token + access_token,
// chiffre le refresh_token et stocke dans Supabase.
// Récupère aussi accountId + locationIds pour configuration auto.
// =============================================================================

import crypto from "node:crypto";

// ─── Helpers chiffrement AES-256-GCM ────────────────────────────────────────
function encrypt(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format : iv:authTag:ciphertext (tous en base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

// ─── Helper Supabase ────────────────────────────────────────────────────────
async function supabaseRequest(path, method, body) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "resolution=merge-duplicates,return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} : ${text}`);
  }
  return res.json();
}

// ─── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`<h1>Erreur OAuth Google</h1><p>${error}</p>`);
  }

  if (!code) {
    return res.status(400).send("<h1>Code manquant</h1>");
  }

  // ─── Vérif state anti-CSRF ────────────────────────────────────────────────
  const cookieHeader = req.headers.cookie || "";
  const stateCookie = cookieHeader.split(";").find(c => c.trim().startsWith("google_oauth_state="))?.split("=")[1];
  if (!stateCookie || stateCookie !== state) {
    return res.status(400).send("<h1>State invalide (anti-CSRF)</h1>");
  }

  try {
    // ─── 1. Échange code → tokens ───────────────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error("Token exchange failed:", tokenData);
      return res.status(500).send(`<h1>Échec de l'échange</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre><p>Si pas de refresh_token : supprime l'autorisation sur <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> et recommence.</p>`);
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      scope
    } = tokenData;

    // ─── 2. Récupération de l'accountId ────────────────────────────────────
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const accountsData = await accountsRes.json();
    const account = accountsData.accounts?.[0];
    if (!account) {
      return res.status(500).send(`<h1>Aucun compte Google Business trouvé</h1><pre>${JSON.stringify(accountsData, null, 2)}</pre>`);
    }
    const accountId = account.name; // ex: "accounts/106241234567890123456"

    // ─── 3. Récupération des locations ─────────────────────────────────────
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const locData = await locRes.json();
    const locationIds = (locData.locations || []).map(l => ({
      id: l.name,
      title: l.title
    }));

    // ─── 4. Stockage chiffré dans Supabase ─────────────────────────────────
    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();

    await supabaseRequest("google_oauth_tokens", "POST", {
      id: 1,
      refresh_token_encrypted: encrypt(refresh_token),
      access_token_encrypted: encrypt(access_token),
      access_token_expires_at: expiresAt,
      scope: scope,
      account_id: accountId,
      location_ids: locationIds
    });

    // ─── 5. Page de confirmation ───────────────────────────────────────────
    res.setHeader("Set-Cookie", "google_oauth_state=; Path=/; Max-Age=0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
      <title>Connexion Google réussie</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 32px; background: #fafafa; color: #111; }
        h1 { font-size: 28px; letter-spacing: -0.02em; }
        .badge { display: inline-block; padding: 4px 10px; background: #10b981; color: white; border-radius: 4px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
        code { background: #111; color: #eee; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
        ul { line-height: 1.8; }
        .cta { display: inline-block; margin-top: 24px; padding: 14px 24px; background: #111; color: white; text-decoration: none; border-radius: 8px; }
      </style></head><body>
        <span class="badge">◢ Connexion établie</span>
        <h1>OAuth Google activé.</h1>
        <p>Le refresh_token est chiffré en base. L'ERP peut maintenant interroger l'API Google Business Profile.</p>
        <p><strong>Account :</strong> <code>${accountId}</code></p>
        <p><strong>Locations détectées :</strong></p>
        <ul>${locationIds.map(l => `<li>${l.title} — <code>${l.id}</code></li>`).join("")}</ul>
        <p>Prochaine étape : passer <code>MOCK_MODE=false</code> dans Vercel et redéployer.</p>
        <a href="https://app.solution-phone.fr" class="cta">Retour à l'ERP →</a>
      </body></html>
    `);

  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).send(`<h1>Erreur serveur</h1><pre>${err.message}</pre>`);
  }
}
