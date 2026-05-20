// =============================================================================
// /api/seo — Agent IA "Léo" · SEO Local Google Business Profile
// -----------------------------------------------------------------------------
// Routage par ?action= pour rester sous la limite Hobby (12 fonctions max)
//
//   GET  /api/seo?action=audit           → fetch GBP + score + suggestions
//   GET  /api/seo?action=list-posts      → derniers posts GBP
//   POST /api/seo?action=generate        → génère un post via Claude AI
//   POST /api/seo?action=publish         → publie un post sur GBP
//   GET  /api/seo?action=config          → config Léo
//   POST /api/seo?action=config          → MAJ config Léo
//   GET  /api/seo?action=keywords        → mots-clés + dernières positions
//   GET  /api/seo?action=weekly-cron     → cron lundi 9h (auto-post + audit)
// =============================================================================

import crypto from 'node:crypto';
import { handleAuth } from './_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

// ─── Helpers chiffrement (mêmes que google-reviews.js) ─────────────
function decrypt(ciphertext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const [ivB64, tagB64, encB64] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
function encrypt(plaintext) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return `${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

// ─── Helper Supabase ────────────────────────────────────────────────
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// ─── Token Google (refresh auto) ───────────────────────────────────
async function getValidAccessToken() {
  const rows = await sb('google_oauth_tokens?id=eq.1&select=*');
  if (!rows?.[0]) throw new Error('Pas de token OAuth — lance /api/google-oauth-init');
  const row = rows[0];

  if (row.access_token_encrypted && new Date(row.access_token_expires_at) > new Date(Date.now() + 30_000)) {
    return {
      accessToken: decrypt(row.access_token_encrypted),
      accountId: row.account_id,
      locationIds: row.location_ids
    };
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: decrypt(row.refresh_token_encrypted),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const t = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Refresh failed: ${JSON.stringify(t)}`);

  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await sb('google_oauth_tokens?id=eq.1', {
    method: 'PATCH',
    body: { access_token_encrypted: encrypt(t.access_token), access_token_expires_at: expiresAt }
  });
  return { accessToken: t.access_token, accountId: row.account_id, locationIds: row.location_ids };
}

// ════════════════════════════════════════════════════════════════════
// ACTION : audit GBP → score + suggestions
// ════════════════════════════════════════════════════════════════════
async function handleAudit(req, res) {
  try {
    const { accessToken, accountId, locationIds } = await getValidAccessToken();
    const locId = typeof locationIds[0] === 'string' ? locationIds[0] : locationIds[0]?.id;
    if (!locId) throw new Error('Aucune location GBP trouvée');

    // 1. Récupère la fiche GBP avec un readMask exhaustif
    const readMask = [
      'name', 'title', 'storefrontAddress', 'phoneNumbers', 'websiteUri',
      'regularHours', 'specialHours', 'serviceArea', 'categories',
      'profile', 'serviceItems', 'metadata', 'openInfo', 'labels'
    ].join(',');

    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/${locId}?readMask=${readMask}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const loc = await locRes.json();
    if (!locRes.ok) throw new Error(`GBP location ${locRes.status}: ${JSON.stringify(loc).substring(0, 200)}`);

    // 2. Compte posts récents (30 derniers jours)
    const postsRows = await sb(`gbp_posts?status=eq.published&published_at=gte.${new Date(Date.now() - 30*24*3600*1000).toISOString()}&select=id`);
    const postsLast30Days = postsRows?.length || 0;

    // 3. Récupère avis stats depuis google_reviews
    let avgRating = 4.7, reviewCount = 590, reviewsLast30 = 0, repliedRatio = 0;
    try {
      const allReviews = await sb('google_reviews?select=star_rating,reply_status,create_time');
      if (allReviews?.length) {
        reviewCount = allReviews.length;
        avgRating = allReviews.reduce((s, r) => s + (r.star_rating || 0), 0) / reviewCount;
        const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        reviewsLast30 = allReviews.filter(r => new Date(r.create_time).getTime() > cutoff).length;
        const replied = allReviews.filter(r => r.reply_status === 'published').length;
        repliedRatio = replied / reviewCount;
      }
    } catch (_) { /* fallback to defaults */ }

    // 4. Score sur 100 (système Léo)
    const breakdown = {};
    let score = 0;

    // a) Descriptif (15 pts) : longueur > 600 + contient "magasin de téléphone" + "Mâcon"
    const descLen = (loc.profile?.description || '').length;
    const descLower = (loc.profile?.description || '').toLowerCase();
    const hasMacon = descLower.includes('mâcon') || descLower.includes('macon');
    const hasMagasinTel = descLower.includes('magasin de téléphone') || descLower.includes('magasin de telephone');
    const hasRepa = descLower.includes('réparation') || descLower.includes('reparation');
    breakdown.descriptif = (descLen >= 600 ? 5 : Math.round(descLen / 120))
                        + (hasMacon ? 4 : 0)
                        + (hasMagasinTel ? 3 : 0)
                        + (hasRepa ? 3 : 0);
    score += breakdown.descriptif;

    // b) Catégories (10 pts) : > 3 catégories
    const catCount = 1 + (loc.categories?.additionalCategories?.length || 0);
    breakdown.categories = Math.min(10, catCount * 2);
    score += breakdown.categories;

    // c) Services (10 pts) : > 8 services
    const serviceCount = loc.serviceItems?.length || 0;
    breakdown.services = Math.min(10, serviceCount);
    score += breakdown.services;

    // d) Posts récents (15 pts) : 4+ posts dans les 30 derniers jours
    breakdown.posts_recents = Math.min(15, postsLast30Days * 4);
    score += breakdown.posts_recents;

    // e) Avis : volume (10 pts) + note (10 pts) + fraîcheur (5 pts) + taux de réponse (5 pts) = 30
    breakdown.avis_volume = Math.min(10, Math.floor(reviewCount / 60));
    breakdown.avis_note = Math.min(10, Math.round((avgRating - 3) * 5));
    breakdown.avis_fraicheur = Math.min(5, reviewsLast30);
    breakdown.avis_taux_reponse = Math.min(5, Math.round(repliedRatio * 5));
    score += breakdown.avis_volume + breakdown.avis_note + breakdown.avis_fraicheur + breakdown.avis_taux_reponse;

    // f) Horaires + téléphone + site (10 pts)
    breakdown.contact = 0;
    if (loc.regularHours?.periods?.length) breakdown.contact += 4;
    if (loc.phoneNumbers?.primaryPhone) breakdown.contact += 3;
    if (loc.websiteUri) breakdown.contact += 3;
    score += breakdown.contact;

    // 5. Suggestions personnalisées
    const suggestions = [];

    if (descLen < 600) suggestions.push({
      severity: 'high', impact: '+5 pts',
      title: `Étoffer le descriptif (${descLen} car / 750 max)`,
      action: 'Réécrire le descriptif avec "magasin de téléphone Mâcon", "réparation smartphone Mâcon", "QualiRépar", services proposés, années d\'expérience.'
    });
    if (!hasMagasinTel) suggestions.push({
      severity: 'high', impact: '+3 pts',
      title: 'Ajouter "magasin de téléphone" dans le descriptif',
      action: 'C\'est ton mot-clé n°1. Google doit le voir dans le texte.'
    });
    if (!hasMacon) suggestions.push({
      severity: 'high', impact: '+4 pts',
      title: 'Mentionner "Mâcon" dans le descriptif',
      action: 'Indispensable pour le référencement local.'
    });
    if (catCount < 5) suggestions.push({
      severity: 'medium', impact: `+${Math.min(10, 5*2) - Math.min(10, catCount * 2)} pts`,
      title: `Ajouter des catégories (${catCount}/5+ recommandé)`,
      action: 'Catégories à ajouter : Magasin de téléphonie mobile · Atelier de réparation de téléphones mobiles · Magasin de matériel électronique · Magasin d\'accessoires de téléphonie mobile · Magasin de matériel d\'occasion.'
    });
    if (serviceCount < 8) suggestions.push({
      severity: 'medium', impact: `+${10 - Math.min(10, serviceCount)} pts`,
      title: `Compléter les services (${serviceCount}/8+)`,
      action: 'Lister chaque service : Remplacement écran iPhone, Remplacement écran Samsung, Remplacement batterie, Désoxydation, Réparation connecteur de charge, Vente smartphone neuf, Vente smartphone reconditionné, Rachat de téléphone, Accessoires, Coques sur mesure...'
    });
    if (postsLast30Days < 4) suggestions.push({
      severity: 'high', impact: `+${15 - Math.min(15, postsLast30Days * 4)} pts`,
      title: `Publier plus de posts (${postsLast30Days}/4 sur 30j)`,
      action: 'Léo peut générer + publier un post chaque lundi automatiquement (cron actif). Active-le dans la config.'
    });
    if (reviewsLast30 < 5) suggestions.push({
      severity: 'high', impact: `+${5 - Math.min(5, reviewsLast30)} pts`,
      title: `Pas assez de nouveaux avis (${reviewsLast30}/5 sur 30j)`,
      action: 'Active la relance SMS automatique après chaque réparation/vente (Léo → config → auto_review_requests).'
    });
    if (repliedRatio < 0.9) suggestions.push({
      severity: 'medium', impact: `+${5 - Math.min(5, Math.round(repliedRatio * 5))} pts`,
      title: `Répondre à tous les avis (${Math.round(repliedRatio * 100)}% répondus)`,
      action: 'L\'agent Avis Google IA peut le faire pour toi. Page : Avis Google IA → mode auto.'
    });
    if (avgRating < 4.8) suggestions.push({
      severity: 'critical', impact: 'Effet boule de neige',
      title: `Faire monter la note (${avgRating.toFixed(2)}/5)`,
      action: 'Phone Expert est à 4,9. À volume égal, Google fait remonter la meilleure note. Combo gagnant : (1) relances 5★ post-réparation (2) réponses chaleureuses sur les 5★ (3) traitement immédiat des < 4★ en boutique avant qu\'ils ne deviennent publics.'
    });

    // 6. Persiste l'audit
    let auditRow = null;
    try {
      const ins = await sb('seo_audits', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          score, score_breakdown: breakdown, suggestions,
          gbp_snapshot: {
            title: loc.title, descLen, hasMagasinTel, hasMacon, hasRepa,
            categories: catCount, services: serviceCount, postsLast30Days,
            reviewCount, avgRating, reviewsLast30, repliedRatio
          }
        }
      });
      auditRow = ins?.[0];
    } catch (e) { console.error('[audit save]', e.message); }

    return res.status(200).json({
      ok: true,
      score, max: 100, breakdown, suggestions,
      stats: {
        title: loc.title,
        descriptif_chars: descLen,
        categories_total: catCount,
        services_total: serviceCount,
        posts_last_30d: postsLast30Days,
        avis_total: reviewCount,
        avis_moyenne: Number(avgRating.toFixed(2)),
        avis_30j: reviewsLast30,
        taux_reponse_pct: Math.round(repliedRatio * 100),
        site: loc.websiteUri || null,
        telephone: loc.phoneNumbers?.primaryPhone || null,
        adresse: loc.storefrontAddress?.addressLines?.join(', ') || null
      },
      audit_id: auditRow?.id,
      audited_at: auditRow?.audited_at || new Date().toISOString()
    });
  } catch (e) {
    console.error('[seo audit]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : génération de post via Claude AI
// ════════════════════════════════════════════════════════════════════
async function handleGenerate(req, res) {
  try {
    const { angle, custom_topic } = req.body || {};

    // Récupère le prompt système Léo
    const cfgRows = await sb('seo_config?id=eq.1&select=prompt_system,shop_descriptor');
    const prompt_system = cfgRows?.[0]?.prompt_system || 'Tu es Léo, agent SEO de Solution Phone. Génère un post Google Business Profile court (200-400 car).';

    const userPrompt = custom_topic
      ? `Génère un post sur ce sujet précis : ${custom_topic}`
      : (angle
          ? `Génère un post sur cet angle : ${angle}`
          : 'Génère un post sur un angle de ton choix parmi ceux listés. Varie par rapport aux semaines précédentes.');

    // Récupère les 4 derniers posts pour éviter les répétitions
    const recents = await sb('gbp_posts?order=created_at.desc&limit=4&select=summary,keywords_targeted');
    const recentContext = recents?.length
      ? `\n\nPosts récents (NE PAS RÉPÉTER) :\n${recents.map((r,i) => `${i+1}. ${r.summary}`).join('\n')}`
      : '';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        system: prompt_system,
        messages: [{ role: 'user', content: userPrompt + recentContext }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Claude ${r.status}: ${JSON.stringify(data).substring(0, 200)}`);

    const text = data.content?.[0]?.text || '';
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Réponse non-JSON: ${text.substring(0, 150)}`);
    const parsed = JSON.parse(jsonMatch[0]);

    // Persiste en draft
    const draft = await sb('gbp_posts', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        status: 'draft',
        topic_type: 'STANDARD',
        summary: parsed.summary,
        cta_type: parsed.cta_type || null,
        cta_url: parsed.cta_type ? 'https://app.solution-phone.fr' : null,
        source_prompt: userPrompt,
        generated_by: 'leo',
        keywords_targeted: parsed.keywords_targeted || []
      }
    });

    return res.status(200).json({
      ok: true,
      draft: draft?.[0],
      chars: parsed.summary.length
    });
  } catch (e) {
    console.error('[seo generate]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : publication d'un post sur GBP
// ════════════════════════════════════════════════════════════════════
async function handlePublish(req, res) {
  try {
    const { post_id } = req.body || {};
    if (!post_id) return res.status(400).json({ error: 'post_id requis' });

    const rows = await sb(`gbp_posts?id=eq.${post_id}&select=*`);
    if (!rows?.[0]) return res.status(404).json({ error: 'Post introuvable' });
    const post = rows[0];

    const { accessToken, accountId, locationIds } = await getValidAccessToken();
    const locId = typeof locationIds[0] === 'string' ? locationIds[0] : locationIds[0]?.id;

    // L'API GBP "localPosts" est sur l'ancienne base v4
    const body = {
      languageCode: 'fr',
      summary: post.summary,
      topicType: post.topic_type || 'STANDARD'
    };
    if (post.cta_type) {
      body.callToAction = { actionType: post.cta_type, url: post.cta_url || 'https://app.solution-phone.fr' };
    }
    if (post.media_url) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.media_url }];
    }

    const r = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountId}/${locId}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const data = await r.json();

    if (!r.ok) {
      await sb(`gbp_posts?id=eq.${post_id}`, {
        method: 'PATCH',
        body: { status: 'failed', error: JSON.stringify(data).substring(0, 500) }
      });
      throw new Error(`GBP publish ${r.status}: ${JSON.stringify(data).substring(0, 200)}`);
    }

    await sb(`gbp_posts?id=eq.${post_id}`, {
      method: 'PATCH',
      body: {
        status: 'published',
        published_at: new Date().toISOString(),
        gbp_post_name: data.name,
        error: null
      }
    });

    return res.status(200).json({ ok: true, gbp_post_name: data.name });
  } catch (e) {
    console.error('[seo publish]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : liste des posts (avec filtres)
// ════════════════════════════════════════════════════════════════════
async function handleListPosts(req, res) {
  try {
    const status = req.query?.status; // draft, published, failed, scheduled
    const filter = status ? `&status=eq.${status}` : '';
    const posts = await sb(`gbp_posts?order=created_at.desc&limit=50${filter}&select=*`);
    return res.status(200).json({ ok: true, posts: posts || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : attacher / détacher une photo à un post
// ════════════════════════════════════════════════════════════════════
async function handleAttachPhoto(req, res) {
  try {
    const { post_id, media_url } = req.body || {};
    if (!post_id) return res.status(400).json({ error: 'post_id requis' });
    // media_url peut être null/'' → détache
    const cleanUrl = (typeof media_url === 'string' && media_url.trim()) ? media_url.trim() : null;
    await sb(`gbp_posts?id=eq.${post_id}`, {
      method: 'PATCH',
      body: { media_url: cleanUrl }
    });
    return res.status(200).json({ ok: true, media_url: cleanUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : générer un prompt photo ChatGPT/Gemini adapté au post
// ════════════════════════════════════════════════════════════════════
async function handlePhotoPrompt(req, res) {
  try {
    const { post_id } = req.body || {};
    if (!post_id) return res.status(400).json({ error: 'post_id requis' });
    const rows = await sb(`gbp_posts?id=eq.${post_id}&select=summary,keywords_targeted`);
    if (!rows?.[0]) return res.status(404).json({ error: 'Post introuvable' });
    const post = rows[0];

    const systemPrompt = `Tu es directeur artistique de Solution Phone — boutique smartphone premium à Mâcon, charte rouge #E10600 / noir #0D0D0D / blanc / police Montserrat, esthétique Apple × Tesla × B&O.

Tu génères un PROMPT photo prêt à coller dans ChatGPT (DALL-E) ou Gemini Pro Image. Format paysage 1200×900 (idéal Google Business Profile post).

RÈGLES :
- Image PROPRE, premium, lumière naturelle douce, fond minimaliste (bois clair, marbre blanc, surface mate sombre)
- Smartphone obligatoirement bien identifiable, logo Apple ou Samsung AUTORISÉ (anti-faux SAV)
- AUCUN texte dans l'image (Google Business gère le texte à côté)
- AUCUN logo Solution Phone ou QualiRépar dans l'image (on les ajoute en post-prod si besoin)
- Cadrage : 1 sujet principal centré, profondeur de champ photo réaliste
- Ambiance : journal magazine premium type Monocle / The Verge / Wired
- Pas de personnes au visage visible (droits image)

Tu réponds UNIQUEMENT en JSON :
{
  "chatgpt_prompt": "le prompt complet en anglais, prêt à coller dans ChatGPT",
  "gemini_prompt": "le prompt complet en français, prêt à coller dans Gemini",
  "preview_description": "2-3 phrases en français qui décrivent l'image attendue"
}`;

    const userMsg = `POST GBP à illustrer :
"${post.summary}"

Mots-clés visés : ${(post.keywords_targeted || []).join(', ') || 'aucun spécifique'}

Génère un prompt photo qui illustre PARFAITEMENT ce post.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Claude ${r.status}: ${JSON.stringify(data).substring(0, 200)}`);
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse non-JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json({ ok: true, ...parsed });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : supprimer un post (brouillon uniquement)
// ════════════════════════════════════════════════════════════════════
async function handleDeletePost(req, res) {
  try {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'id requis' });
    // Vérifie qu'on supprime bien un draft, pas un publié
    const rows = await sb(`gbp_posts?id=eq.${id}&select=status,gbp_post_name`);
    if (!rows?.[0]) return res.status(404).json({ error: 'Post introuvable' });
    if (rows[0].status === 'published') {
      return res.status(400).json({ error: 'Impossible de supprimer un post déjà publié sur Google.' });
    }
    await sb(`gbp_posts?id=eq.${id}`, { method: 'DELETE' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : config Léo
// ════════════════════════════════════════════════════════════════════
async function handleConfig(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await sb('seo_config?id=eq.1&select=*');
      return res.status(200).json({ ok: true, config: rows?.[0] || null });
    }
    // POST = update
    const body = req.body || {};
    const { weekly_post_enabled, weekly_post_day, weekly_post_hour, auto_review_requests, auto_review_delay_h, ranking_check_days, shop_descriptor, prompt_system } = body;
    const patch = {};
    if (typeof weekly_post_enabled === 'boolean') patch.weekly_post_enabled = weekly_post_enabled;
    if (typeof weekly_post_day === 'number') patch.weekly_post_day = weekly_post_day;
    if (typeof weekly_post_hour === 'number') patch.weekly_post_hour = weekly_post_hour;
    if (typeof auto_review_requests === 'boolean') patch.auto_review_requests = auto_review_requests;
    if (typeof auto_review_delay_h === 'number') patch.auto_review_delay_h = auto_review_delay_h;
    if (typeof ranking_check_days === 'number') patch.ranking_check_days = ranking_check_days;
    if (typeof shop_descriptor === 'string') patch.shop_descriptor = shop_descriptor;
    if (typeof prompt_system === 'string') patch.prompt_system = prompt_system;
    patch.updated_at = new Date().toISOString();
    await sb('seo_config?id=eq.1', { method: 'PATCH', body: patch });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : mots-clés tracking
// ════════════════════════════════════════════════════════════════════
async function handleKeywords(req, res) {
  try {
    const keywords = await sb('seo_keywords?active=eq.true&order=priority.asc&select=*');
    // Pour chaque mot-clé, récupère la dernière position connue
    const out = [];
    for (const k of keywords || []) {
      const last = await sb(`keyword_rankings?keyword=eq.${encodeURIComponent(k.keyword)}&order=checked_at.desc&limit=1&select=*`);
      out.push({ ...k, last_ranking: last?.[0] || null });
    }
    return res.status(200).json({ ok: true, keywords: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ACTION : weekly-cron — lundi 9h, génère + publie un post
// ════════════════════════════════════════════════════════════════════
async function handleWeeklyCron(req, res) {
  try {
    const cfg = await sb('seo_config?id=eq.1&select=*');
    const c = cfg?.[0];
    if (!c?.weekly_post_enabled) {
      return res.status(200).json({ ok: true, skipped: 'weekly_post_enabled=false' });
    }

    // 1. Génère un post
    const genRes = await fetch(`${getBaseUrl(req)}/api/seo?action=generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const gen = await genRes.json();
    if (!gen.ok) throw new Error(`generate failed: ${gen.error}`);

    // 2. Publie
    const pubRes = await fetch(`${getBaseUrl(req)}/api/seo?action=publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: gen.draft.id })
    });
    const pub = await pubRes.json();

    // 3. Marque comme auto_published
    if (pub.ok) {
      await sb(`gbp_posts?id=eq.${gen.draft.id}`, {
        method: 'PATCH',
        body: { auto_published: true }
      });
    }

    return res.status(200).json({
      ok: true,
      post_id: gen.draft.id,
      published: pub.ok,
      summary: gen.draft.summary
    });
  } catch (e) {
    console.error('[seo weekly-cron]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

function getBaseUrl(req) {
  return 'https://app.solution-phone.fr';
}

// ════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // Auth : laisse passer le cron (header x-vercel-cron) sinon handleAuth
  const isCron = !!req.headers['x-vercel-cron'];
  const action = req.query?.action || '';
  if (!isCron && action !== 'weekly-cron') {
    if (handleAuth(req, res)) return;
  }

  try {
    switch (action) {
      case 'audit':       return handleAudit(req, res);
      case 'generate':    return handleGenerate(req, res);
      case 'publish':     return handlePublish(req, res);
      case 'list-posts':  return handleListPosts(req, res);
      case 'attach-photo': return handleAttachPhoto(req, res);
      case 'photo-prompt': return handlePhotoPrompt(req, res);
      case 'delete-post': return handleDeletePost(req, res);
      case 'config':      return handleConfig(req, res);
      case 'keywords':    return handleKeywords(req, res);
      case 'weekly-cron': return handleWeeklyCron(req, res);
      default:
        return res.status(400).json({ error: `Action inconnue: "${action}". Actions: audit, generate, publish, list-posts, config, keywords, weekly-cron` });
    }
  } catch (e) {
    console.error('[seo handler]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
