// /api/qualirepar-health.js
// Health check unifié des 3 APIs QualiRépar : Ecologic, Ecosystem, Kiwiz
// Usage : https://app.solution-phone.fr/api/qualirepar-health
//
// Retourne un JSON avec le statut de chaque API.

const ECOLOGIC_API_KEY = '8121d135-4635-412d-b7ab-3b4dd61cbdb8';
const ECOLOGIC_API_BASE = 'https://apiecologic.e-reparateur.eco/api/v1/ecosupport';
const ECOSYSTEM_PROD = 'https://prod-api-reparateurs.ecosystem.eco';
const KIWIZ_BASE = 'https://api.kiwiz.io';

function fetchWithTimeout(url, options = {}, ms = 10000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout ' + ms + 'ms')), ms))
  ]);
}

async function checkEcologic() {
  const started = Date.now();
  try {
    // Endpoint simple qui retourne les infos du compte (auth via clé API)
    const r = await fetchWithTimeout(`${ECOLOGIC_API_BASE}/reparateurs/me`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'api_key': ECOLOGIC_API_KEY }
    });
    const body = await r.text();
    const ms = Date.now() - started;
    return {
      service: 'Ecologic',
      url: `${ECOLOGIC_API_BASE}/reparateurs/me`,
      ok: r.ok,
      http_status: r.status,
      duration_ms: ms,
      auth: r.status === 401 ? 'clé API rejetée' : (r.ok ? 'clé OK' : 'inconnu'),
      preview: body.substring(0, 200)
    };
  } catch (e) {
    return {
      service: 'Ecologic',
      url: `${ECOLOGIC_API_BASE}/reparateurs/me`,
      ok: false,
      error: e.message,
      duration_ms: Date.now() - started
    };
  }
}

async function checkEcosystem() {
  const started = Date.now();
  try {
    // Ping endpoint public pour vérifier que l'API répond
    const r = await fetchWithTimeout(`${ECOSYSTEM_PROD}/login`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'health-check', password: 'health-check' })
    });
    const body = await r.text();
    const ms = Date.now() - started;
    // 401/400 = serveur OK mais credentials KO (attendu)
    // 200 = serveur OK
    const serverOk = r.status >= 200 && r.status < 500;
    return {
      service: 'Ecosystem',
      env: 'prod',
      url: `${ECOSYSTEM_PROD}/login`,
      ok: serverOk,
      http_status: r.status,
      duration_ms: ms,
      note: serverOk ? 'API répond (credentials réels à tester via app)' : 'API ne répond pas',
      preview: body.substring(0, 200)
    };
  } catch (e) {
    return {
      service: 'Ecosystem',
      url: `${ECOSYSTEM_PROD}/login`,
      ok: false,
      error: e.message,
      duration_ms: Date.now() - started
    };
  }
}

async function checkKiwiz() {
  const started = Date.now();
  try {
    // Ping endpoint public — token/generate sans creds = 401 attendu = serveur OK
    const r = await fetchWithTimeout(`${KIWIZ_BASE}/token/generate`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=health-check&password=health-check'
    });
    const body = await r.text();
    const ms = Date.now() - started;
    const serverOk = r.status >= 200 && r.status < 500;
    return {
      service: 'Kiwiz',
      url: `${KIWIZ_BASE}/token/generate`,
      ok: serverOk,
      http_status: r.status,
      duration_ms: ms,
      note: serverOk ? 'API répond (credentials réels à tester via app)' : 'API ne répond pas',
      preview: body.substring(0, 200)
    };
  } catch (e) {
    return {
      service: 'Kiwiz',
      url: `${KIWIZ_BASE}/token/generate`,
      ok: false,
      error: e.message,
      duration_ms: Date.now() - started
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const [ecologic, ecosystem, kiwiz] = await Promise.all([
      checkEcologic(),
      checkEcosystem(),
      checkKiwiz()
    ]);

    const all_ok = ecologic.ok && ecosystem.ok && kiwiz.ok;

    return res.status(200).json({
      checked_at: new Date().toISOString(),
      all_ok,
      summary: {
        ecologic_ok: ecologic.ok,
        ecosystem_ok: ecosystem.ok,
        kiwiz_ok: kiwiz.ok
      },
      services: { ecologic, ecosystem, kiwiz },
      notes: [
        'OK = serveur répond. Pour valider les credentials, fais un vrai test depuis l\'app (page Réparations).',
        '401 sur Ecologic = clé API à renouveler.',
        '401 sur Ecosystem ou Kiwiz = login/password à mettre à jour dans Paramètres.',
        'Timeout / 5xx = API en maintenance, réessayer plus tard.'
      ]
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
