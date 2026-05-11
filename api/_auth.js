// /api/_auth.js — helper partagé d'authentification pour les endpoints sensibles
// Solution Phone · Audit sécurité 10/05/2026
//
// Trois sources d'appel autorisées :
//   1. Le front Solution Phone lui-même (Origin = solution-phone.fr / vercel.app / localhost)
//   2. Les cron Vercel (header x-vercel-cron présent OU Authorization Bearer CRON_SECRET)
//   3. Les appels manuels avec Authorization Bearer APP_SECRET (debug / scripts)
//
// Tout le reste est rejeté en 403.

const ALLOWED_ORIGINS = [
  'https://solution-phone.fr',
  'https://www.solution-phone.fr',
  'https://solution-phone.vercel.app',
  'http://localhost:3000'
];

// Accepte aussi tous les previews Vercel : solution-phone-*.vercel.app
// (déploiements de branches, PRs, etc.)
function isAllowedOrigin(origin){
  if(!origin) return false;
  if(ALLOWED_ORIGINS.includes(origin)) return true;
  // Pattern Vercel preview : https://solution-phone-XXX-XXX.vercel.app
  try {
    const u = new URL(origin);
    if(u.protocol !== 'https:') return false;
    if(u.hostname.endsWith('.vercel.app') && u.hostname.startsWith('solution-phone')) return true;
  } catch(e){}
  return false;
}

const CRON_SECRET = process.env.CRON_SECRET || '';
const APP_SECRET = process.env.APP_SECRET || '';

/**
 * Renvoie { ok: true } si la requête est autorisée, sinon { ok: false, reason: '...' }.
 * Le helper applique aussi les headers CORS restreints (pas de wildcard).
 */
export function checkAuth(req, res) {
  // CORS strict : seulement les origines connues
  const origin = req.headers.origin || '';
  const originOk = isAllowedOrigin(origin);
  if (originOk) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  const matchedOrigin = originOk ? origin : null;
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS preflight : on laisse passer (le navigateur ne lit pas le body)
  if (req.method === 'OPTIONS') return { ok: true, preflight: true };

  // Cron Vercel : header injecté automatiquement par Vercel sur les crons configurés
  if (req.headers['x-vercel-cron']) return { ok: true, source: 'vercel-cron' };

  // Bearer token (cron manuel, scripts, dev)
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (CRON_SECRET && token === CRON_SECRET) return { ok: true, source: 'cron-secret' };
    if (APP_SECRET && token === APP_SECRET)   return { ok: true, source: 'app-secret' };
  }

  // Origin allowlist : appel depuis le front Solution Phone
  if (matchedOrigin) return { ok: true, source: 'same-origin' };

  // Referer fallback (certains navigateurs n'envoient pas Origin sur GET)
  const referer = req.headers.referer || '';
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', refOrigin);
        res.setHeader('Vary', 'Origin');
        return { ok: true, source: 'referer' };
      }
    } catch(e){}
  }

  // Host fallback : si pas d'origin/referer (POST direct depuis fetch same-origin),
  // accepter quand le hôte de la requête est lui-même un domaine Solution Phone Vercel
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  if (host) {
    const hostOrigin = 'https://' + host;
    if (isAllowedOrigin(hostOrigin)) {
      return { ok: true, source: 'same-host' };
    }
  }

  return { ok: false, reason: 'unauthorized' };
}

/**
 * Helper d'usage : retourne true si la requête a été traitée (preflight ou rejet).
 * À appeler en début de handler :
 *   if (handleAuth(req, res)) return;
 */
export function handleAuth(req, res) {
  const r = checkAuth(req, res);
  if (r.preflight) { res.status(200).end(); return true; }
  if (!r.ok) { res.status(403).json({ error: 'Forbidden — appel non autorisé' }); return true; }
  return false;
}
