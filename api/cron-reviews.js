// =============================================================================
// /api/cron-reviews
// -----------------------------------------------------------------------------
// Cron Vercel — toutes les 30 minutes (ou quotidien sur plan Hobby).
//
// 1. Fetch reviews depuis Google API
// 2. Compare avec cache Supabase → détecte les nouveaux + les replies supprimées
// 3. Pour chaque nouvel avis :
//    a. Génère un brouillon via Claude (prompt de google_reviews_config)
//    b. Si star_rating >= auto_publish_threshold → publie auto
//    c. Si star_rating <= sms_alert_threshold → SMS Brevo au gérant
//    d. Sinon → brouillon en attente de validation manuelle
//
// Sécurité : CRON_SECRET en header Authorization
// =============================================================================

import crypto from "node:crypto";

const MOCK_MODE = process.env.MOCK_MODE === "true";
const SUPABASE = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Helpers chiffrement ────────────────────────────────────────────────────
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

function encrypt(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

// ─── Supabase ──────────────────────────────────────────────────────────────
async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      ...(prefer ? { "Prefer": prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// ─── Token Google avec refresh auto ────────────────────────────────────────
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

// ─── Fetch avis Google (ou mock) ───────────────────────────────────────────
async function fetchReviewsFromGoogle() {
  if (MOCK_MODE) {
    // En mode mock, on injecte 1 faux nouvel avis de temps en temps pour tester
    const hour = new Date().getHours();
    return hour % 2 === 0 ? [{
      google_review_id: `accounts/MOCK/locations/MOCK/reviews/mock-${Date.now()}`,
      location_id: "locations/MOCK",
      reviewer_name: "Mock Tester",
      reviewer_photo_url: null,
      star_rating: Math.random() > 0.3 ? 5 : 2,
      comment: "Ceci est un avis de test généré par le mode mock.",
      create_time: new Date().toISOString(),
      reply_comment: null,
      reply_status: "pending"
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
        google_review_id: r.name,
        location_id: locId,
        reviewer_name: r.reviewer?.displayName || "Anonyme",
        reviewer_photo_url: r.reviewer?.profilePhotoUrl || null,
        star_rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating] || 0,
        comment: r.comment || "",
        create_time: r.createTime,
        update_time: r.updateTime,
        reply_comment: r.reviewReply?.comment || null,
        reply_update_time: r.reviewReply?.updateTime || null,
        reply_status: r.reviewReply ? "published" : "pending"
      });
    }
  }
  return all;
}

// ─── Génération brouillon via Claude ───────────────────────────────────────
async function generateDraft(review, promptSystem, signatures) {
  const signature = signatures[Math.floor(Math.random() * signatures.length)];
  // Pour les avis négatifs, on signe toujours Sébastien (gérant)
  const finalSig = review.star_rating <= 3 ? "Sébastien" : signature;

  const userMessage = `Note : ${review.star_rating}/5
Client : ${review.reviewer_name}
Avis : ${review.comment || "(pas de texte, note seule)"}

Rédige la réponse. Signe par "${finalSig}".`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: promptSystem,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    throw new Error(`Claude API: ${err}`);
  }

  const data = await anthropicRes.json();
  return data.content?.[0]?.text?.trim() || "";
}

// ─── Publier réponse sur Google ────────────────────────────────────────────
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

// ─── Envoi SMS Brevo ───────────────────────────────────────────────────────
async function sendBrevoSMS(phone, review) {
  const shortComment = (review.comment || "(note seule)").slice(0, 80);
  const content = `⚠️ Solution Phone — Nouvel avis ${review.star_rating}★ de ${review.reviewer_name} : "${shortComment}${shortComment.length >= 80 ? '...' : ''}" → app.solution-phone.fr`;

  // Nettoyage numéro : enlever espaces, ajouter +33 si commence par 0
  let normalizedPhone = phone.replace(/\s/g, "");
  if (normalizedPhone.startsWith("0")) normalizedPhone = "+33" + normalizedPhone.slice(1);

  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: "SolPhone",
      recipient: normalizedPhone,
      content,
      type: "transactional"
    })
  });
  return res.ok;
}

// ─── Handler principal ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  // ─── Auth : Vercel cron envoie le CRON_SECRET en header ─────────────────
  const authHeader = req.headers.authorization || "";
  const vercelCronHeader = req.headers["x-vercel-cron"];
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth && !vercelCronHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const stats = {
    fetched: 0,
    new: 0,
    drafts_generated: 0,
    auto_published: 0,
    sms_alerts: 0,
    errors: []
  };

  try {
    // ─── 1. Charge config ─────────────────────────────────────────────────
    const configRows = await sb("google_reviews_config?id=eq.1&select=*");
    const config = configRows?.[0];
    if (!config?.enabled) {
      return res.status(200).json({ skipped: "Module désactivé dans la config" });
    }

    // ─── 2. Fetch + merge Supabase ────────────────────────────────────────
    const fresh = await fetchReviewsFromGoogle();
    stats.fetched = fresh.length;

    if (fresh.length === 0) {
      return res.status(200).json({ ...stats, message: "Aucun avis récupéré" });
    }

    // ─── 3. Détection des nouveaux ────────────────────────────────────────
    const existingIds = await sb(
      `google_reviews?select=google_review_id&google_review_id=in.(${fresh.map(r => `"${r.google_review_id}"`).join(",")})`
    );
    const existingSet = new Set((existingIds || []).map(r => r.google_review_id));
    const newReviews = fresh.filter(r => !existingSet.has(r.google_review_id));
    stats.new = newReviews.length;

    // Insert des avis (nouveaux + update des existants, via upsert)
    if (fresh.length > 0) {
      await sb("google_reviews", {
        method: "POST",
        body: fresh,
        prefer: "resolution=merge-duplicates"
      });
    }

    // ─── 4. Pour chaque NOUVEL avis : draft + (auto-publish | SMS) ────────
    for (const review of newReviews) {
      try {
        // Skip si pas de texte et note pleine (pas d'intérêt à répondre)
        if (!review.comment && review.star_rating === 5) {
          await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
            method: "PATCH",
            body: { reply_status: "skipped" }
          });
          continue;
        }

        // a. Génère brouillon
        const draft = await generateDraft(
          review,
          config.prompt_system,
          config.signature_rotation
        );
        stats.drafts_generated++;

        await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
          method: "PATCH",
          body: {
            ai_draft: draft,
            ai_draft_generated_at: new Date().toISOString(),
            reply_status: "draft"
          }
        });

        // b. Auto-publish si note suffisante
        if (review.star_rating >= config.auto_publish_threshold) {
          await publishReply(review.google_review_id, draft);
          await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
            method: "PATCH",
            body: {
              reply_comment: draft,
              reply_update_time: new Date().toISOString(),
              reply_status: "published",
              reply_source: "auto_ai"
            }
          });
          stats.auto_published++;
        }

        // c. SMS alerte si avis négatif
        if (review.star_rating <= config.sms_alert_threshold) {
          const smsOk = await sendBrevoSMS(config.sms_alert_phone, review);
          if (smsOk) {
            await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(review.google_review_id)}`, {
              method: "PATCH",
              body: { sms_alert_sent: true, sms_alert_sent_at: new Date().toISOString() }
            });
            stats.sms_alerts++;
          }
        }

      } catch (err) {
        console.error(`Erreur sur review ${review.google_review_id}:`, err);
        stats.errors.push({ id: review.google_review_id, msg: err.message });
      }
    }

    return res.status(200).json({
      ok: true,
      ts: new Date().toISOString(),
      mock: MOCK_MODE,
      ...stats
    });

  } catch (err) {
    console.error("Cron fatal:", err);
    return res.status(500).json({ error: err.message, stats });
  }
}
