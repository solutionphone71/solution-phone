// /api/shopify-auth.js — OAuth 2.0 pour Shopify (Solution Phone)
// Détection automatique : si "code" est présent → callback, sinon → install

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shop, code, state } = req.query;

  // ── Config ──
  const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID     || 'b3e6216445b20e1b4d29638975773d94';
  const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET  || '';
  const APP_URL       = process.env.APP_URL                || 'https://app.solution-phone.fr';
  const REDIRECT_URI  = APP_URL + '/api/shopify-auth';

  const SCOPES = [
    'read_products', 'write_products',
    'read_inventory', 'write_inventory',
    'read_locations',
    'read_product_listings'
  ].join(',');

  // ════════════════════════════════════════════════
  // CALLBACK : Shopify renvoie ?code=xxx&shop=xxx
  // ════════════════════════════════════════════════
  if (code && shop) {
    if (!CLIENT_SECRET) {
      return res.status(500).send(buildResultPage(
        'error',
        'SHOPIFY_CLIENT_SECRET non configuré dans les variables d\'environnement Vercel.',
        null, null
      ));
    }

    try {
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code
        })
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('[Shopify OAuth Error]', tokenRes.status, errText);
        return res.status(tokenRes.status).send(buildResultPage(
          'error',
          'Erreur Shopify : ' + tokenRes.status + ' — ' + errText,
          null, null
        ));
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return res.status(500).send(buildResultPage(
          'error',
          'Shopify n\'a pas renvoyé de token. Réponse : ' + JSON.stringify(tokenData),
          null, null
        ));
      }

      return res.status(200).send(buildResultPage('success', null, accessToken, shop));

    } catch (err) {
      console.error('[Shopify OAuth Exception]', err);
      return res.status(500).send(buildResultPage(
        'error',
        'Erreur serveur : ' + err.message,
        null, null
      ));
    }
  }

  // ════════════════════════════════════════════════
  // INSTALL : Rediriger vers Shopify OAuth
  // ════════════════════════════════════════════════
  if (shop) {
    if (!CLIENT_ID) {
      return res.status(500).json({ error: 'SHOPIFY_CLIENT_ID non configuré dans Vercel.' });
    }

    const nonce = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    const authUrl = `https://${shop}/admin/oauth/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&scope=${SCOPES}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${nonce}`;

    return res.redirect(302, authUrl);
  }

  // ════════════════════════════════════════════════
  // Aucun paramètre → erreur
  // ════════════════════════════════════════════════
  return res.status(400).json({
    error: 'Paramètre "shop" requis. Ex: /api/shopify-auth?shop=ma-boutique.myshopify.com'
  });
}


// ── Page HTML de résultat ──
function buildResultPage(type, errorMsg, token, shop) {
  if (type === 'success') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Shopify connecté !</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#e6edf3;}
  .card{background:#161b22;border:1px solid #30363d;border-radius:16px;padding:40px;text-align:center;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,.4);}
  .icon{font-size:64px;margin-bottom:16px;}
  h1{color:#96bf48;font-size:22px;margin:0 0 12px;}
  p{color:#8b949e;font-size:14px;line-height:1.6;}
  .btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#96bf48;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;}
  .btn:hover{background:#7da33d;}
</style></head><body>
<div class="card">
  <div class="icon">✅</div>
  <h1>Shopify connecté avec succès !</h1>
  <p>Votre boutique <strong>${shop}</strong> est maintenant liée à Solution Phone.</p>
  <p style="font-size:12px;color:#6e7681;">Le token a été enregistré automatiquement.</p>
  <a href="/" class="btn" id="btn-back">Retour à l'application</a>
</div>
<script>
  try {
    localStorage.setItem('sp_shopify_token', '${token}');
    localStorage.setItem('sp_shopify_store', '${shop}');
  } catch(e) {
    console.error('Erreur sauvegarde localStorage:', e);
  }
</script>
</body></html>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Erreur Shopify</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#e6edf3;}
  .card{background:#161b22;border:1px solid #30363d;border-radius:16px;padding:40px;text-align:center;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,.4);}
  .icon{font-size:64px;margin-bottom:16px;}
  h1{color:#f85149;font-size:22px;margin:0 0 12px;}
  p{color:#8b949e;font-size:14px;line-height:1.6;}
  .err{background:#1c1010;border:1px solid #f85149;border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#f85149;word-break:break-all;}
  .btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#30363d;color:#e6edf3;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;}
</style></head><body>
<div class="card">
  <div class="icon">❌</div>
  <h1>Erreur de connexion Shopify</h1>
  <p>La connexion OAuth a échoué.</p>
  <div class="err">${errorMsg || 'Erreur inconnue'}</div>
  <a href="/" class="btn">Retour à l'application</a>
</div>
</body></html>`;
}
