// =============================================================================
// /api/google-reviews — Point d'entrée UNIQUE pour tout le module Avis Google
// -----------------------------------------------------------------------------
// Regroupe 5 anciens fichiers en 1 seul pour rester sous la limite Hobby (12 fn)
//
// Routage par URL :
//   /api/google-oauth-init      → lance le flow OAuth Google
//   /api/google-oauth-callback  → reçoit le code, stocke tokens chiffrés
//   /api/google-reviews         → GET liste avis / POST publie réponse
//   /api/google-reviews-config  → GET/POST config module
//   /api/cron-reviews           → cron quotidien (fetch + IA + auto-publish + SMS)
// =============================================================================

import crypto from "node:crypto";

const MOCK_MODE = process.env.MOCK_MODE === "true";

// ─── Helpers chiffrement AES-256-GCM ────────────────────────────────────────
function encrypt(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(ciphertext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const [ivB64, tagB64, encB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── Helper Supabase ────────────────────────────────────────────────────────
async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
      ...(prefer ? { "Prefer": prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// ─── Token Google avec refresh auto ─────────────────────────────────────────
async function getValidAccessToken() {
  const rows = await sb("google_oauth_tokens?id=eq.1&select=*");
  if (!rows?.[0]) throw new Error("Pas de token OAuth — lance /api/google-oauth-init");
  const row = rows[0];

  if (row.access_token_encrypted && new Date(row.access_token_expires_at) > new Date(Date.now() + 30_000)) {
    return { accessToken: decrypt(row.access_token_encrypted), accountId: row.account_id, locationIds: row.location_ids };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: decrypt(row.refresh_token_encrypted),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token"
    })
  });
  const t = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Refresh failed: ${JSON.stringify(t)}`);

  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await sb("google_oauth_tokens?id=eq.1", {
    method: "PATCH",
    body: { access_token_encrypted: encrypt(t.access_token), access_token_expires_at: expiresAt }
  });
  return { accessToken: t.access_token, accountId: row.account_id, locationIds: row.location_ids };
}

// ─── Mock data ──────────────────────────────────────────────────────────────
const MOCK_REVIEWS = [
  {
    id: 1, google_review_id: "accounts/MOCK/locations/MOCK/reviews/r1",
    location_id: "locations/MOCK", reviewer_name: "Julie Martin",
    reviewer_photo_url: "https://i.pravatar.cc/80?u=julie", star_rating: 5,
    comment: "Écran iPhone 13 remplacé en 30 minutes, équipe très pro. Merci Evan !",
    create_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    reply_comment: null, reply_status: "pending",
    ai_draft: "Bonjour Julie. Merci pour votre retour. Ravi qu'Evan ait pu remplacer votre écran d'iPhone 13 en 30 min. Votre réparation est couverte par notre garantie 6 mois — à très vite. Evan"
  },
  {
    id: 2, google_review_id: "accounts/MOCK/locations/MOCK/reviews/r2",
    location_id: "locations/MOCK", reviewer_name: "Ahmed K.",
    reviewer_photo_url: "https://i.pravatar.cc/80?u=ahmed", star_rating: 2,
    comment: "J'ai attendu 2 semaines pour ma commande de batterie, pas de nouvelles...",
    create_time: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    reply_comment: null, reply_status: "pending",
    ai_draft: "Bonjour Ahmed. Je comprends votre frustration sur ce délai et je m'en excuse. Les délais fournisseurs sur certaines batteries peuvent être longs mais on aurait dû vous tenir informé. Passez nous voir au 21 rue Gambetta à Mâcon, on regarde ça ensemble. Sébastien"
  },
  {
    id: 3, google_review_id: "accounts/MOCK/locations/MOCK/reviews/r3",
    location_id: "locations/MOCK", reviewer_name: "Marc Dubois",
    reviewer_photo_url: null, star_rating: 5, comment: "",
    create_time: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    reply_comment: "Merci Marc pour votre confiance. À très bientôt chez Solution Phone. Nawfel",
    reply_status: "published",
    ai_draft: "Merci Marc pour votre confiance. À très bientôt chez Solution Phone. Nawfel"
  }
];

// ─── Fetch reviews depuis Google ────────────────────────────────────────────
async function fetchReviewsFromGoogle(forMock) {
  if (forMock || MOCK_MODE) {
    const hour = new Date().getHours();
    return hour % 2 === 0 ? [{
      google_review_id: `accounts/MOCK/locations/MOCK/reviews/mock-${Date.now()}`,
      location_id: "locations/MOCK", reviewer_name: "Mock Tester",
      reviewer_photo_url: null, star_rating: Math.random() > 0.3 ? 5 : 2,
      comment: "Ceci est un avis de test généré par le mode mock.",
      create_time: new Date().toISOString(), reply_comment: null, reply_status: "pending"
    }] : [];
  }

  const { accessToken, accountId, locationIds } = await getValidAccessToken();
  const all = [];
  for (const loc of locationIds) {
    const locId = typeof loc === "string" ? loc : loc.id;
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountId}/${locId}/reviews?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) { console.error(`${locId}: ${res.status}`); continue; }
    const data = await res.json();
    for (const r of data.reviews || []) {
      all.push({
        google_review_id: r.name, location_id: locId,
        reviewer_name: r.reviewer?.displayName || "Anonyme",
        reviewer_photo_url: r.reviewer?.profilePhotoUrl || null,
        star_rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating] || 0,
        comment: r.comment || "", create_time: r.createTime, update_time: r.updateTime,
        reply_comment: r.reviewReply?.comment || null,
        reply_update_time: r.reviewReply?.updateTime || null,
        reply_status: r.reviewReply ? "published" : "pending"
      });
    }
  }
  return all;
}

// ─── Publier réponse sur Google ─────────────────────────────────────────────
async function publishReply(google_review_id, comment) {
  if (MOCK_MODE) return { updateTime: new Date().toISOString() };
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${google_review_id}/reply`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment })
  });
  if (!res.ok) throw new Error(`Google reply failed: ${await res.text()}`);
  return res.json();
}

// ─── Envoi SMS Brevo ────────────────────────────────────────────────────────
async function sendBrevoSMS(phone, review) {
  const shortComment = (review.comment || "(note seule)").slice(0, 80);
  const content = `⚠️ Solution Phone — Nouvel avis ${review.star_rating}★ de ${review.reviewer_name} : "${shortComment}${shortComment.length >= 80 ? '...' : ''}" → app.solution-phone.fr`;
  let normalizedPhone = phone.replace(/\s/g, "");
  if (normalizedPhone.startsWith("0")) normalizedPhone = "+33" + normalizedPhone.slice(1);
  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: "SolPhone", recipient: normalizedPhone, content, type: "transactional" })
  });
  return res.ok;
}

// ─── Génération brouillon via Claude ────────────────────────────────────────
async function generateDraft(review, promptSystem, signatures) {
  const finalSig = review.star_rating <= 3 ? "Sébastien" : signatures[Math.floor(Math.random() * signatures.length)];
  const userMessage = `Note : ${review.star_rating}/5\nClient : ${review.reviewer_name}\nAvis : ${review.comment || "(pas de texte, note seule)"}\n\nRédige la réponse. Signe par "${finalSig}".`;
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 400,
      system: promptSystem, messages: [{ role: "user", content: userMessage }]
    })
  });
  if (!anthropicRes.ok) throw new Error(`Claude API: ${await anthropicRes.text()}`);
  const data = await anthropicRes.json();
  return data.content?.[0]?.text?.trim() || "";
}

// =============================================================================
// ROUTE: /api/google-oauth-init
// =============================================================================
async function handleOAuthInit(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI manquant" });
  }
  const state = Buffer.from(JSON.stringify({ t: Date.now(), r: Math.random().toString(36).slice(2) })).toString("base64url");
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline", prompt: "consent", state, include_granted_scopes: "true"
  });
  res.setHeader("Set-Cookie", `google_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
}

// =============================================================================
// ROUTE: /api/google-oauth-callback
// =============================================================================
async function handleOAuthCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`<h1>Erreur OAuth Google</h1><p>${error}</p>`);
  if (!code) return res.status(400).send("<h1>Code manquant</h1>");

  const cookieHeader = req.headers.cookie || "";
  const stateCookie = cookieHeader.split(";").find(c => c.trim().startsWith("google_oauth_state="))?.split("=")[1];
  if (!stateCookie || stateCookie !== state) {
    return res.status(400).send("<h1>State invalide (anti-CSRF)</h1>");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      return res.status(500).send(`<h1>Échec de l'échange</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre><p>Si pas de refresh_token : supprime l'autorisation sur <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> et recommence.</p>`);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Récupération accountId
    const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${access_token}` } });
    const accountsData = await accountsRes.json();
    const account = accountsData.accounts?.[0];
    if (!account) return res.status(500).send(`<h1>Aucun compte Google Business trouvé</h1><pre>${JSON.stringify(accountsData, null, 2)}</pre>`);
    const accountId = account.name;

    // Récupération locations
    const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`, { headers: { Authorization: `Bearer ${access_token}` } });
    const locData = await locRes.json();
    const locationIds = (locData.locations || []).map(l => ({ id: l.name, title: l.title }));

    // Stockage chiffré
    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
    await sb("google_oauth_tokens", {
      method: "POST", prefer: "resolution=merge-duplicates,return=representation",
      body: {
        id: 1, refresh_token_encrypted: encrypt(refresh_token),
        access_token_encrypted: encrypt(access_token),
        access_token_expires_at: expiresAt, scope, account_id: accountId, location_ids: locationIds
      }
    });

    res.setHeader("Set-Cookie", "google_oauth_state=; Path=/; Max-Age=0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Connexion Google réussie</title>
      <style>body{font-family:-apple-system,sans-serif;max-width:640px;margin:60px auto;padding:32px;background:#fafafa;color:#111}h1{font-size:28px}.badge{display:inline-block;padding:4px 10px;background:#10b981;color:white;border-radius:4px;font-size:12px;text-transform:uppercase}code{background:#111;color:#eee;padding:2px 6px;border-radius:3px;font-size:13px}ul{line-height:1.8}.cta{display:inline-block;margin-top:24px;padding:14px 24px;background:#111;color:white;text-decoration:none;border-radius:8px}</style></head><body>
      <span class="badge">◢ Connexion établie</span>
      <h1>OAuth Google activé.</h1>
      <p>Le refresh_token est chiffré en base.</p>
      <p><strong>Account :</strong> <code>${accountId}</code></p>
      <p><strong>Locations :</strong></p>
      <ul>${locationIds.map(l => `<li>${l.title} — <code>${l.id}</code></li>`).join("")}</ul>
      <p>Prochaine étape : passer <code>MOCK_MODE=false</code> dans Vercel et redéployer.</p>
      <a href="https://app.solution-phone.fr" class="cta">Retour à l'ERP →</a>
    </body></html>`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).send(`<h1>Erreur serveur</h1><pre>${err.message}</pre>`);
  }
}

// =============================================================================
// ROUTE: /api/google-reviews (GET liste / POST publie réponse)
// =============================================================================
async function handleReviews(req, res) {
  try {
    if (req.method === "GET") {
      if (MOCK_MODE) return res.status(200).json({ reviews: MOCK_REVIEWS, mock: true });
      if (req.query.refresh === "1") {
        const freshReviews = await fetchReviewsFromGoogle();
        if (freshReviews.length > 0) {
          await sb("google_reviews", { method: "POST", body: freshReviews, prefer: "resolution=merge-duplicates" });
        }
      }
      const reviews = await sb("google_reviews?order=create_time.desc&limit=200");
      return res.status(200).json({ reviews });
    }

    if (req.method === "POST") {
      const { google_review_id, comment, source = "manual" } = req.body;
      if (!google_review_id || !comment) return res.status(400).json({ error: "google_review_id et comment requis" });
      if (MOCK_MODE) return res.status(200).json({ success: true, mock: true, published: comment });

      const googleData = await publishReply(google_review_id, comment);
      await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(google_review_id)}`, {
        method: "PATCH",
        body: { reply_comment: comment, reply_update_time: googleData.updateTime || new Date().toISOString(), reply_status: "published", reply_source: source }
      });
      return res.status(200).json({ success: true, published_at: googleData.updateTime });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("google-reviews error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// =============================================================================
// ROUTE: /api/google-reviews-config (GET/POST)
// =============================================================================
async function handleConfig(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await sb("google_reviews_config?id=eq.1&select=*");
      return res.status(200).json(rows?.[0] || {});
    }
    if (req.method === "POST") {
      const allowed = ["auto_publish_threshold", "sms_alert_threshold", "sms_alert_phone", "prompt_system", "signature_rotation", "enabled"];
      const body = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
      const updated = await sb("google_reviews_config?id=eq.1", { method: "PATCH", body, prefer: "return=representation" });
      return res.status(200).json(updated?.[0] || {});
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// =============================================================================
// ROUTE: /api/cron-reviews
// =============================================================================
async function handleCron(req, res) {
  const authHeader = req.headers.authorization || "";
  const vercelCronHeader = req.headers["x-vercel-cron"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !vercelCronHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const stats = { fetched: 0, new: 0, drafts_generated: 0, auto_published: 0, sms_alerts: 0, errors: [] };

  try {
    const configRows = await sb("google_reviews_config?id=eq.1&select=*");
    const config = configRows?.[0];
    if (!config?.enabled) return res.status(200).json({ skipped: "Module désactivé" });

    const fresh = await fetchReviewsFromGoogle();
    stats.fetched = fresh.length;
    if (fresh.length === 0) return res.status(200).json({ ...stats, message: "Aucun avis récupéré" });

    const existingIds = await sb(`google_reviews?select=google_review_id&google_review_id=in.(${fresh.map(r => `"${r.google_review_id}"`).join(",")})`);
    const existingSet = new Set((existingIds || []).map(r => r.google_review_id));
    const newReviews = fresh.filter(r => !existingSet.has(r.google_review_id));
    stats.new = newReviews.length;

    if (fresh.length > 0) {
      await sb("google_reviews", { method: "POST", body: fresh, prefer: "resolution=merge-duplicates" });
    }

    for (const review of newReviews) {
      try {
        if (!review.comment && review.star_rating === 5) {
          await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, { method: "PATCH", body: { reply_status: "skipped" } });
          continue;
        }
        const draft = await generateDraft(review, config.prompt_system, config.signature_rotation);
        stats.drafts_generated++;
        await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
          method: "PATCH", body: { ai_draft: draft, ai_draft_generated_at: new Date().toISOString(), reply_status: "draft" }
        });
        if (review.star_rating >= config.auto_publish_threshold) {
          await publishReply(review.google_review_id, draft);
          await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
            method: "PATCH", body: { reply_comment: draft, reply_update_time: new Date().toISOString(), reply_status: "published", reply_source: "auto_ai" }
          });
          stats.auto_published++;
        }
        if (review.star_rating <= config.sms_alert_threshold) {
          const smsOk = await sendBrevoSMS(config.sms_alert_phone, review);
          if (smsOk) {
            await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
              method: "PATCH", body: { sms_alert_sent: true, sms_alert_sent_at: new Date().toISOString() }
            });
            stats.sms_alerts++;
          }
        }
      } catch (err) {
        console.error(`Erreur review ${review.google_review_id}:`, err);
        stats.errors.push({ id: review.google_review_id, msg: err.message });
      }
    }

    return res.status(200).json({ ok: true, ts: new Date().toISOString(), mock: MOCK_MODE, ...stats });
  } catch (err) {
    console.error("Cron fatal:", err);
    return res.status(500).json({ error: err.message, stats });
  }
}

// =============================================================================
// HANDLER PRINCIPAL — routage par URL
// =============================================================================
export default async function handler(req, res) {
  const url = req.url.split("?")[0];

  if (url === "/api/google-oauth-init")     return handleOAuthInit(req, res);
  if (url === "/api/google-oauth-callback") return handleOAuthCallback(req, res);
  if (url === "/api/google-reviews-config") return handleConfig(req, res);
  if (url === "/api/cron-reviews")          return handleCron(req, res);

  // Default: /api/google-reviews
  return handleReviews(req, res);
}
