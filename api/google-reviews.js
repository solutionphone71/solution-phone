// =============================================================================
// /api/google-reviews
// -----------------------------------------------------------------------------
// Proxy utilisé par le frontend (onglet Avis Google dans index.html)
//
// GET  /api/google-reviews                → liste tous les avis (depuis Supabase)
// GET  /api/google-reviews?refresh=1      → force un refresh depuis Google
// POST /api/google-reviews/reply          → publie une réponse sur un avis
//      body: { google_review_id, comment, source: 'manual' | 'manual_edited' }
// =============================================================================

import crypto from "node:crypto";

const MOCK_MODE = process.env.MOCK_MODE === "true";

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

// ─── Helpers Supabase ───────────────────────────────────────────────────────
async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(prefer ? { "Prefer": prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// ─── Gestion du token Google (refresh si besoin) ────────────────────────────
async function getValidAccessToken() {
  const rows = await sb("google_oauth_tokens?id=eq.1&select=*");
  if (!rows?.[0]) throw new Error("Aucun token OAuth en base. Lance /api/google-oauth-init.");
  const row = rows[0];

  // Access token encore valide ?
  if (row.access_token_encrypted && new Date(row.access_token_expires_at) > new Date(Date.now() + 30_000)) {
    return { accessToken: decrypt(row.access_token_encrypted), accountId: row.account_id, locationIds: row.location_ids };
  }

  // Sinon, refresh
  const refreshToken = decrypt(row.refresh_token_encrypted);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token"
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Refresh token failed: ${JSON.stringify(tokenData)}`);

  const newAccessToken = tokenData.access_token;
  const expiresAt = new Date(Date.now() + (tokenData.expires_in - 60) * 1000).toISOString();

  await sb("google_oauth_tokens?id=eq.1", {
    method: "PATCH",
    body: {
      access_token_encrypted: encrypt(newAccessToken),
      access_token_expires_at: expiresAt
    }
  });

  return { accessToken: newAccessToken, accountId: row.account_id, locationIds: row.location_ids };
}

// ─── Mock data (utilisé tant que MOCK_MODE=true) ────────────────────────────
const MOCK_REVIEWS = [
  {
    id: 1,
    google_review_id: "accounts/MOCK/locations/MOCK/reviews/r1",
    location_id: "locations/MOCK",
    reviewer_name: "Julie Martin",
    reviewer_photo_url: "https://i.pravatar.cc/80?u=julie",
    star_rating: 5,
    comment: "Écran iPhone 13 remplacé en 30 minutes, équipe très pro. Merci Evan !",
    create_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    reply_comment: null,
    reply_status: "pending",
    ai_draft: "Bonjour Julie. Merci pour votre retour. Ravi qu'Evan ait pu remplacer votre écran d'iPhone 13 en 30 min. Votre réparation est couverte par notre garantie 6 mois — à très vite. Evan"
  },
  {
    id: 2,
    google_review_id: "accounts/MOCK/locations/MOCK/reviews/r2",
    location_id: "locations/MOCK",
    reviewer_name: "Ahmed K.",
    reviewer_photo_url: "https://i.pravatar.cc/80?u=ahmed",
    star_rating: 2,
    comment: "J'ai attendu 2 semaines pour ma commande de batterie, pas de nouvelles...",
    create_time: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    reply_comment: null,
    reply_status: "pending",
    ai_draft: "Bonjour Ahmed. Je comprends votre frustration sur ce délai et je m'en excuse. Les délais fournisseurs sur certaines batteries peuvent être longs mais on aurait dû vous tenir informé. Passez nous voir au 21 rue Gambetta à Mâcon, on regarde ça ensemble. Sébastien"
  },
  {
    id: 3,
    google_review_id: "accounts/MOCK/locations/MOCK/reviews/r3",
    location_id: "locations/MOCK",
    reviewer_name: "Marc Dubois",
    reviewer_photo_url: null,
    star_rating: 5,
    comment: "",
    create_time: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    reply_comment: "Merci Marc pour votre confiance. À très bientôt chez Solution Phone. Nawfel",
    reply_status: "published",
    ai_draft: "Merci Marc pour votre confiance. À très bientôt chez Solution Phone. Nawfel"
  }
];

// ─── Fetch depuis Google réel ───────────────────────────────────────────────
async function fetchReviewsFromGoogle() {
  const { accessToken, accountId, locationIds } = await getValidAccessToken();
  const allReviews = [];

  for (const loc of locationIds) {
    const locId = typeof loc === "string" ? loc : loc.id;
    const url = `https://mybusiness.googleapis.com/v4/${accountId}/${locId}/reviews?pageSize=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.error(`Failed to fetch reviews for ${locId}: ${res.status}`);
      continue;
    }
    const data = await res.json();
    for (const r of data.reviews || []) {
      allReviews.push({
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
  return allReviews;
}

// ─── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    // ─── GET : liste des avis ───────────────────────────────────────────────
    if (req.method === "GET") {
      if (MOCK_MODE) {
        return res.status(200).json({ reviews: MOCK_REVIEWS, mock: true });
      }

      // Refresh depuis Google si demandé
      if (req.query.refresh === "1") {
        const freshReviews = await fetchReviewsFromGoogle();
        if (freshReviews.length > 0) {
          await sb("google_reviews", {
            method: "POST",
            body: freshReviews,
            prefer: "resolution=merge-duplicates"
          });
        }
      }

      const reviews = await sb("google_reviews?order=create_time.desc&limit=200");
      return res.status(200).json({ reviews });
    }

    // ─── POST /reply : publier une réponse ──────────────────────────────────
    if (req.method === "POST") {
      const { google_review_id, comment, source = "manual" } = req.body;

      if (!google_review_id || !comment) {
        return res.status(400).json({ error: "google_review_id et comment requis" });
      }

      if (MOCK_MODE) {
        return res.status(200).json({ success: true, mock: true, published: comment });
      }

      const { accessToken } = await getValidAccessToken();

      // Google endpoint : PUT /reviews/{reviewId}/reply
      const googleRes = await fetch(
        `https://mybusiness.googleapis.com/v4/${google_review_id}/reply`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ comment })
        }
      );

      if (!googleRes.ok) {
        const err = await googleRes.text();
        return res.status(googleRes.status).json({ error: `Google API ${googleRes.status}: ${err}` });
      }

      const googleData = await googleRes.json();

      // Update Supabase
      await sb(`google_reviews?google_review_id=eq.${encodeURIComponent(google_review_id)}`, {
        method: "PATCH",
        body: {
          reply_comment: comment,
          reply_update_time: googleData.updateTime || new Date().toISOString(),
          reply_status: "published",
          reply_source: source
        }
      });

      return res.status(200).json({ success: true, published_at: googleData.updateTime });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("google-reviews error:", err);
    return res.status(500).json({ error: err.message });
  }
}
