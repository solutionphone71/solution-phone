// /api/autopilot/execute.js — Exécution d'une décision validée
// Solution Phone · Phase 2 chunk 2.2 · mai 2026
//
// Appelé quand Sébastien clique "Publier" sur une décision en queue.
// Selon le type, exécute l'action via :
//   - Meta Graph API (Instagram + Facebook)
//   - Google MyBusiness API
//   - Brevo SMS
//
// Phase 2 chunk 2.2 : implémentation de base.
// Pour Insta/FB on a besoin que Sébastien configure les tokens Meta.

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

const META_PAGE_TOKEN = process.env.META_PAGE_TOKEN;       // Long-lived Page Access Token
const META_IG_USER_ID = process.env.META_IG_USER_ID;       // Instagram Business Account ID
const META_FB_PAGE_ID = process.env.META_FB_PAGE_ID;       // Facebook Page ID

const BREVO_KEY = process.env.BREVO_API_KEY;

async function supaQuery(table, method, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text.substring(0,200)}`);
  return text ? JSON.parse(text) : null;
}

async function logEvent(level, message, metadata) {
  try {
    await supaQuery('social_logs', 'POST', { level, source: 'agent_execute', message, metadata: metadata || {} });
  } catch (e) { /* silent */ }
}

// ── Publish Instagram (Meta Graph API) ──
async function publishInstagram(payload) {
  if (!META_PAGE_TOKEN || !META_IG_USER_ID) {
    return { success: false, error: 'Meta non configuré (META_PAGE_TOKEN ou META_IG_USER_ID manquant)' };
  }
  if (!payload.media_url) {
    return { success: false, error: 'media_url requis pour Instagram' };
  }

  try {
    // Étape 1 : créer le container média
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: payload.media_url,
          caption: payload.caption || '',
          access_token: META_PAGE_TOKEN
        })
      }
    );
    const containerData = await containerRes.json();
    if (!containerData.id) {
      return { success: false, error: `Meta container failed: ${JSON.stringify(containerData).substring(0,200)}` };
    }

    // Étape 2 : publier le container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_PAGE_TOKEN
        })
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) {
      return { success: true, ig_post_id: publishData.id };
    }
    return { success: false, error: `Meta publish failed: ${JSON.stringify(publishData).substring(0,200)}` };
  } catch (e) {
    return { success: false, error: 'Meta IG exception: ' + e.message };
  }
}

// ── Publish Facebook Page ──
async function publishFacebook(payload) {
  if (!META_PAGE_TOKEN || !META_FB_PAGE_ID) {
    return { success: false, error: 'Meta non configuré (META_FB_PAGE_ID manquant)' };
  }
  try {
    const body = {
      message: payload.caption || '',
      access_token: META_PAGE_TOKEN
    };
    if (payload.media_url) body.link = payload.media_url;

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_FB_PAGE_ID}/feed`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (data.id) return { success: true, fb_post_id: data.id };
    return { success: false, error: `FB publish failed: ${JSON.stringify(data).substring(0,200)}` };
  } catch (e) {
    return { success: false, error: 'FB exception: ' + e.message };
  }
}

// ── Send SMS via Brevo ──
async function sendSms(payload) {
  if (!BREVO_KEY) return { success: false, error: 'BREVO_API_KEY manquante' };
  if (!payload.client_phone || !payload.message) {
    return { success: false, error: 'client_phone et message requis' };
  }
  try {
    let phone = payload.client_phone.replace(/\s/g, '').replace(/^0/, '+33');
    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({
        sender: 'SolPhone',
        recipient: phone,
        content: payload.message,
        type: 'transactional'
      })
    });
    const data = await res.json();
    if (res.ok) return { success: true, messageId: data.messageId, phone };
    return { success: false, error: `Brevo ${res.status}: ${JSON.stringify(data).substring(0,200)}` };
  } catch (e) {
    return { success: false, error: 'Brevo exception: ' + e.message };
  }
}

// ── Reply to Google Review (utilise endpoint existant) ──
async function replyReview(payload, host) {
  if (!payload.review_id || !payload.reply_text) {
    return { success: false, error: 'review_id et reply_text requis' };
  }
  try {
    const res = await fetch(`https://${host}/api/google-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google_review_id: payload.review_id,
        comment: payload.reply_text,
        source: 'agent_auto'
      })
    });
    const data = await res.json();
    if (data.success) return { success: true };
    return { success: false, error: data.error || 'Reply failed' };
  } catch (e) {
    return { success: false, error: 'Reply exception: ' + e.message };
  }
}

// ──────────────────────────────────────────────────────────
// HANDLER
// ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const decisionId = req.query.decision_id;
  if (!decisionId) return res.status(400).json({ error: 'decision_id requis' });

  try {
    // 1. Lire la décision
    const rows = await supaQuery('agent_decisions', 'GET', null, `?id=eq.${decisionId}`);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Décision introuvable' });
    const decision = rows[0];

    if (decision.status === 'auto_executed' || decision.status === 'human_validated') {
      // Déjà validé, on continue l'exécution
    }
    if (decision.status === 'rejected') {
      return res.status(400).json({ error: 'Décision rejetée, ne peut pas être exécutée' });
    }

    const payload = decision.payload || {};
    // Si l'agent n'a pas précisé les plateformes, on défaut sur les 2 (FB toujours, IG si media_url fourni)
    const platforms = (payload.platforms && Object.keys(payload.platforms).length > 0)
      ? payload.platforms
      : { instagram: !!payload.media_url, facebook: true };
    const host = req.headers.host || 'app.solution-phone.fr';

    const results = {};
    let anySuccess = false;
    let igPostId = null, fbPostId = null;


    // 2. Exécuter selon type
    if (decision.type === 'post' || decision.type === 'reel' || decision.type === 'story') {
      // Instagram : nécessite obligatoirement une image (media_url)
      if (platforms.instagram && payload.media_url) {
        results.instagram = await publishInstagram(payload);
        if (results.instagram.success) {
          anySuccess = true;
          igPostId = results.instagram.ig_post_id;
        }
      } else if (platforms.instagram && !payload.media_url) {
        results.instagram = { success: false, error: 'Instagram nécessite une image (media_url manquant)' };
      }
      if (platforms.facebook) {
        results.facebook = await publishFacebook(payload);
        if (results.facebook.success) {
          anySuccess = true;
          fbPostId = results.facebook.fb_post_id;
        }
      }

    } else if (decision.type === 'sms') {
      results.sms = await sendSms(payload);
      anySuccess = results.sms.success;

    } else if (decision.type === 'reply_review') {
      results.reply = await replyReview(payload, host);
      anySuccess = results.reply.success;

    } else if (decision.type === 'noop') {
      results.noop = { success: true, message: 'No action needed' };
      anySuccess = true;

    } else {
      return res.status(400).json({ error: `Type non géré : ${decision.type}` });
    }

    // 3. Créer/mettre à jour social_posts si post/reel
    let socialPostId = null;
    if ((decision.type === 'post' || decision.type === 'reel') && anySuccess) {
      try {
        const inserted = await supaQuery('social_posts', 'POST', {
          type: decision.type,
          status: 'published',
          caption: payload.caption || '',
          media_urls: payload.media_url ? [payload.media_url] : [],
          platforms: platforms,
          auto_published: decision.status === 'auto_executed',
          published_at: new Date().toISOString(),
          ig_post_id: igPostId,
          fb_post_id: fbPostId,
          decision_id: decisionId,
          source_data: { reasoning: decision.reasoning }
        });
        if (inserted && inserted[0]) socialPostId = inserted[0].id;
      } catch (e) { /* log silently */ }
    }

    // 4. Mettre à jour agent_decisions
    await supaQuery('agent_decisions', 'PATCH', {
      status: anySuccess ? 'human_validated' : 'failed',
      result: results,
      executed_at: new Date().toISOString(),
      related_post_id: socialPostId
    }, `?id=eq.${decisionId}`);

    // 5. Log
    await logEvent(
      anySuccess ? 'auto' : 'err',
      `Décision exécutée · type=${decision.type} · success=${anySuccess}`,
      { decision_id: decisionId, results }
    );

    return res.status(200).json({
      success: anySuccess,
      decision_id: decisionId,
      type: decision.type,
      results
    });

  } catch (err) {
    console.error('Execute error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
