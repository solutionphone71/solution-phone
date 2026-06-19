// /api/pennylane.js — DÉPRÉCIÉ (juin 2026)
// La facturation et la certification NF525 sont désormais 100% Kiwiz.
// Voir api/proxy-kiwiz.js et certifierFactureKiwiz() dans index.html.
//
// Cet endpoint reste en place pour compatibilité avec les anciens fronts cachés
// qui pourraient encore l'appeler — il retourne 410 Gone pour signaler la migration.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(410).json({
    ok: false,
    error: 'Pennylane endpoint déprécié — facturation migrée vers Kiwiz NF525',
    deprecated_since: '2026-06-09',
    replacement: '/proxy-kiwiz/* (token/generate + invoices)'
  });
}
