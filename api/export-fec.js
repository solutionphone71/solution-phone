// /api/export-fec.js — Export FEC (Fichier des Écritures Comptables)
// Solution Phone · Sprint 15J · J3 · mai 2026
//
// Format normalisé par le BOFiP (article A47 A-1 du Livre des Procédures Fiscales).
// 18 colonnes obligatoires séparées par | (pipe), encoding UTF-8, format texte.
//
// Importable directement par Cegid, Sage, Quadra, EBP, Pennylane, etc.
//
// GET /api/export-fec?from=2026-04-01&to=2026-04-30
// GET /api/export-fec?month=2026-04
// GET /api/export-fec?year=2026
//
// Renvoie un fichier .txt téléchargeable au format FEC.

import { handleAuth } from './_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

const SIREN = '801044785';

// ─── PLAN COMPTABLE simplifié pour Solution Phone ─────────────
const COMPTES = {
  // Ventes
  VENTE_MARCHANDISE:    { num: '707000', lib: 'Ventes de marchandises (occasion TVA marge)' },
  VENTE_NEUF:           { num: '707100', lib: 'Ventes téléphones neufs / accessoires' },
  PRESTATION_SERVICES:  { num: '706000', lib: 'Prestations de réparation' },
  TVA_COLLECTEE:        { num: '445710', lib: 'TVA collectée 20%' },
  // Achats
  ACHAT_MARCHANDISE:    { num: '607000', lib: 'Achats marchandises (téléphones occasion)' },
  ACHAT_PIECES:         { num: '601000', lib: 'Achats pièces détachées' },
  TVA_DEDUCTIBLE:       { num: '445660', lib: 'TVA déductible sur achats' },
  SERVICES_EXT:         { num: '604000', lib: 'Achats prestations de services' },
  // Tiers
  CLIENTS:              { num: '411000', lib: 'Clients' },
  FOURNISSEURS:         { num: '401000', lib: 'Fournisseurs' },
  // Trésorerie
  CAISSE:               { num: '530000', lib: 'Caisse espèces' },
  BANQUE:               { num: '512000', lib: 'Banque - compte courant' },
  CB:                   { num: '511500', lib: 'Encaissements CB en attente' }
};

const JOURNAUX = {
  VE: { code: 'VE', lib: 'Ventes' },
  AC: { code: 'AC', lib: 'Achats' },
  CA: { code: 'CA', lib: 'Caisse' },
  BQ: { code: 'BQ', lib: 'Banque' }
};

// ─── Helpers ──────────────────────────────────────────────────

function pad(s, n) { return String(s).padStart(n, '0'); }

function fmtDateFEC(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth()+1, 2)}${pad(d.getDate(), 2)}`;
}

function fmtMontant(n) {
  if (!n || isNaN(n)) return '0,00';
  return Number(n).toFixed(2).replace('.', ',');
}

// Une ligne FEC = 18 colonnes, séparées par |
function ligneFEC(o) {
  return [
    o.JournalCode || '',
    o.JournalLib || '',
    o.EcritureNum || '',
    o.EcritureDate || '',
    o.CompteNum || '',
    o.CompteLib || '',
    o.CompAuxNum || '',
    o.CompAuxLib || '',
    o.PieceRef || '',
    o.PieceDate || o.EcritureDate || '',
    (o.EcritureLib || '').replace(/[\|\r\n\t]/g, ' ').substring(0, 200),
    fmtMontant(o.Debit),
    fmtMontant(o.Credit),
    o.EcritureLet || '',
    o.DateLet || '',
    o.ValidDate || o.EcritureDate || '',
    o.Montantdevise || '',
    o.Idevise || ''
  ].join('|');
}

function compteTresorerie(mode) {
  const m = (mode || '').toUpperCase();
  if (m.includes('ESP'))   return COMPTES.CAISSE;
  if (m.includes('CHEQ'))  return COMPTES.BANQUE;
  if (m.includes('VIR'))   return COMPTES.BANQUE;
  return COMPTES.CB; // CB par défaut
}

function journalTresorerie(mode) {
  const m = (mode || '').toUpperCase();
  if (m.includes('ESP')) return JOURNAUX.CA;
  return JOURNAUX.BQ;
}

async function supaQuery(table, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${table} ${r.status}: ${txt.substring(0, 200)}`);
  }
  return r.json();
}

// ─── Handler principal ───────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Supabase non configuré' });
  }

  // Période
  let from, to;
  if (req.query.month) {
    const [y, m] = req.query.month.split('-');
    from = `${y}-${pad(m, 2)}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    to = `${y}-${pad(m, 2)}-${pad(lastDay, 2)}`;
  } else if (req.query.year) {
    from = `${req.query.year}-01-01`;
    to   = `${req.query.year}-12-31`;
  } else {
    from = req.query.from;
    to   = req.query.to;
  }
  if (!from || !to) {
    return res.status(400).json({ error: 'Période requise: ?month=YYYY-MM ou ?year=YYYY ou ?from=...&to=...' });
  }

  try {
    // ── 1) Récupérer factures du mois (table factures_pdf) ──
    let factures = [];
    try {
      factures = await supaQuery('factures_pdf', `?date=gte.${from}&date=lte.${to}&order=date.asc`);
    } catch (e) {
      // table peut ne pas exister, fallback sur factures
      try {
        factures = await supaQuery('factures', `?date=gte.${from}&date=lte.${to}&order=date.asc`);
      } catch (e2) {
        factures = [];
      }
    }

    // ── 2) Achats : depenses + achats smartphones occasion (phones) ──
    let depenses = [];
    try {
      depenses = await supaQuery('depenses', `?date=gte.${from}&date=lte.${to}&order=date.asc`);
    } catch (e) { depenses = []; }

    let achatsPhones = [];
    try {
      achatsPhones = await supaQuery('phones', `?dateAchat=gte.${from}&dateAchat=lte.${to}&order=dateAchat.asc`);
    } catch (e) { achatsPhones = []; }

    // ── 3) Construire les écritures FEC ──
    const lignes = [];
    let ecritureNum = 0;

    // VENTES
    factures.forEach(f => {
      ecritureNum++;
      const numEcr = `VE${pad(ecritureNum, 6)}`;
      const dateEcr = fmtDateFEC(f.date);
      const totalTTC = parseFloat(f.totalTTC || f.ttc || 0);
      const isOccasion = (f.type || '').toLowerCase().includes('occasion');
      const isRep = !isOccasion;
      const numFact = f.numero || `F${f.id || ecritureNum}`;
      const clientNom = (f.clientNom || 'Client divers').substring(0, 40);
      const lib = `${isOccasion ? 'Vente occasion' : 'Réparation'} ${numFact} - ${clientNom}`;

      if (isOccasion) {
        // TVA marge : pas de TVA collectée séparée — l'État la calcule sur la marge globale
        // Débit : Client TTC | Crédit : Vente marchandise TTC
        lignes.push(ligneFEC({
          JournalCode: 'VE', JournalLib: JOURNAUX.VE.lib,
          EcritureNum: numEcr, EcritureDate: dateEcr,
          CompteNum: COMPTES.CLIENTS.num, CompteLib: COMPTES.CLIENTS.lib,
          CompAuxNum: ('C' + (f.phoneId || f.id || '0')).substring(0, 17),
          CompAuxLib: clientNom,
          PieceRef: numFact, EcritureLib: lib,
          Debit: totalTTC, Credit: 0
        }));
        lignes.push(ligneFEC({
          JournalCode: 'VE', JournalLib: JOURNAUX.VE.lib,
          EcritureNum: numEcr, EcritureDate: dateEcr,
          CompteNum: COMPTES.VENTE_MARCHANDISE.num, CompteLib: COMPTES.VENTE_MARCHANDISE.lib,
          PieceRef: numFact, EcritureLib: lib + ' (TVA marge art.297A CGI)',
          Debit: 0, Credit: totalTTC
        }));
      } else {
        // Réparation : TVA 20% séparée
        const ht = Math.round((totalTTC / 1.2) * 100) / 100;
        const tva = Math.round((totalTTC - ht) * 100) / 100;
        lignes.push(ligneFEC({
          JournalCode: 'VE', JournalLib: JOURNAUX.VE.lib,
          EcritureNum: numEcr, EcritureDate: dateEcr,
          CompteNum: COMPTES.CLIENTS.num, CompteLib: COMPTES.CLIENTS.lib,
          CompAuxNum: ('C' + (f.id || '0')).substring(0, 17),
          CompAuxLib: clientNom,
          PieceRef: numFact, EcritureLib: lib,
          Debit: totalTTC, Credit: 0
        }));
        lignes.push(ligneFEC({
          JournalCode: 'VE', JournalLib: JOURNAUX.VE.lib,
          EcritureNum: numEcr, EcritureDate: dateEcr,
          CompteNum: COMPTES.PRESTATION_SERVICES.num, CompteLib: COMPTES.PRESTATION_SERVICES.lib,
          PieceRef: numFact, EcritureLib: lib + ' HT',
          Debit: 0, Credit: ht
        }));
        lignes.push(ligneFEC({
          JournalCode: 'VE', JournalLib: JOURNAUX.VE.lib,
          EcritureNum: numEcr, EcritureDate: dateEcr,
          CompteNum: COMPTES.TVA_COLLECTEE.num, CompteLib: COMPTES.TVA_COLLECTEE.lib,
          PieceRef: numFact, EcritureLib: lib + ' TVA 20%',
          Debit: 0, Credit: tva
        }));
      }

      // ENCAISSEMENT (immédiat en boutique)
      const mode = (f.paiement || f.mode || 'CB').toUpperCase();
      const compteTr = compteTresorerie(mode);
      const journalTr = journalTresorerie(mode);
      ecritureNum++;
      const numEnc = `${journalTr.code}${pad(ecritureNum, 6)}`;
      lignes.push(ligneFEC({
        JournalCode: journalTr.code, JournalLib: journalTr.lib,
        EcritureNum: numEnc, EcritureDate: dateEcr,
        CompteNum: compteTr.num, CompteLib: compteTr.lib,
        PieceRef: numFact,
        EcritureLib: `Encaissement ${numFact} (${mode}) - ${clientNom}`,
        Debit: totalTTC, Credit: 0
      }));
      lignes.push(ligneFEC({
        JournalCode: journalTr.code, JournalLib: journalTr.lib,
        EcritureNum: numEnc, EcritureDate: dateEcr,
        CompteNum: COMPTES.CLIENTS.num, CompteLib: COMPTES.CLIENTS.lib,
        CompAuxNum: ('C' + (f.id || '0')).substring(0, 17),
        CompAuxLib: clientNom,
        PieceRef: numFact,
        EcritureLib: `Encaissement ${numFact} - lettrage`,
        Debit: 0, Credit: totalTTC,
        EcritureLet: 'A' + pad(ecritureNum, 4)
      }));
    });

    // ACHATS smartphones occasion (table phones)
    achatsPhones.forEach(p => {
      const prixAchat = parseFloat(p.achat || p.prixAchat || 0);
      if (!prixAchat) return;
      ecritureNum++;
      const numEcr = `AC${pad(ecritureNum, 6)}`;
      const dateEcr = fmtDateFEC(p.dateAchat);
      const ref = `BA-${p.id || ecritureNum}`;
      const fournisseur = (p.fournisseurNom || 'Particulier').substring(0, 40);
      const lib = `Achat occasion ${(p.modele||'').substring(0,30)} - ${fournisseur}`;

      lignes.push(ligneFEC({
        JournalCode: 'AC', JournalLib: JOURNAUX.AC.lib,
        EcritureNum: numEcr, EcritureDate: dateEcr,
        CompteNum: COMPTES.ACHAT_MARCHANDISE.num, CompteLib: COMPTES.ACHAT_MARCHANDISE.lib,
        PieceRef: ref, EcritureLib: lib,
        Debit: prixAchat, Credit: 0
      }));
      lignes.push(ligneFEC({
        JournalCode: 'AC', JournalLib: JOURNAUX.AC.lib,
        EcritureNum: numEcr, EcritureDate: dateEcr,
        CompteNum: COMPTES.FOURNISSEURS.num, CompteLib: COMPTES.FOURNISSEURS.lib,
        CompAuxNum: ('F' + (p.id || '0')).substring(0, 17),
        CompAuxLib: fournisseur,
        PieceRef: ref, EcritureLib: lib,
        Debit: 0, Credit: prixAchat
      }));

      // Paiement (immédiat en boutique)
      const mode = (p.modeAchat || 'ESPECES').toUpperCase();
      const compteTr = compteTresorerie(mode);
      const journalTr = journalTresorerie(mode);
      ecritureNum++;
      const numPmt = `${journalTr.code}${pad(ecritureNum, 6)}`;
      lignes.push(ligneFEC({
        JournalCode: journalTr.code, JournalLib: journalTr.lib,
        EcritureNum: numPmt, EcritureDate: dateEcr,
        CompteNum: COMPTES.FOURNISSEURS.num, CompteLib: COMPTES.FOURNISSEURS.lib,
        CompAuxNum: ('F' + (p.id || '0')).substring(0, 17),
        CompAuxLib: fournisseur,
        PieceRef: ref, EcritureLib: `Paiement achat ${ref}`,
        Debit: prixAchat, Credit: 0,
        EcritureLet: 'F' + pad(ecritureNum, 4)
      }));
      lignes.push(ligneFEC({
        JournalCode: journalTr.code, JournalLib: journalTr.lib,
        EcritureNum: numPmt, EcritureDate: dateEcr,
        CompteNum: compteTr.num, CompteLib: compteTr.lib,
        PieceRef: ref,
        EcritureLib: `Paiement achat ${ref} - ${mode}`,
        Debit: 0, Credit: prixAchat
      }));
    });

    // DÉPENSES (charges externes)
    depenses.forEach(d => {
      const montant = parseFloat(d.montant || 0);
      if (!montant) return;
      ecritureNum++;
      const numEcr = `AC${pad(ecritureNum, 6)}`;
      const dateEcr = fmtDateFEC(d.date);
      const ref = `DEP-${d.id || ecritureNum}`;
      const fournisseur = (d.fournisseur || d.tiers || 'Divers').substring(0, 40);
      const cat = (d.categorie || d.type || 'Charge externe').substring(0, 40);
      const lib = `${cat} ${ref} - ${fournisseur}`;

      // Pour simplifier, TVA 20% si non précisée (à ajuster)
      const ht = Math.round((montant / 1.2) * 100) / 100;
      const tva = Math.round((montant - ht) * 100) / 100;

      lignes.push(ligneFEC({
        JournalCode: 'AC', JournalLib: JOURNAUX.AC.lib,
        EcritureNum: numEcr, EcritureDate: dateEcr,
        CompteNum: COMPTES.SERVICES_EXT.num, CompteLib: cat,
        PieceRef: ref, EcritureLib: lib + ' HT',
        Debit: ht, Credit: 0
      }));
      lignes.push(ligneFEC({
        JournalCode: 'AC', JournalLib: JOURNAUX.AC.lib,
        EcritureNum: numEcr, EcritureDate: dateEcr,
        CompteNum: COMPTES.TVA_DEDUCTIBLE.num, CompteLib: COMPTES.TVA_DEDUCTIBLE.lib,
        PieceRef: ref, EcritureLib: lib + ' TVA déd.',
        Debit: tva, Credit: 0
      }));
      lignes.push(ligneFEC({
        JournalCode: 'AC', JournalLib: JOURNAUX.AC.lib,
        EcritureNum: numEcr, EcritureDate: dateEcr,
        CompteNum: COMPTES.FOURNISSEURS.num, CompteLib: COMPTES.FOURNISSEURS.lib,
        CompAuxNum: ('F' + (d.id || '0')).substring(0, 17),
        CompAuxLib: fournisseur,
        PieceRef: ref, EcritureLib: lib,
        Debit: 0, Credit: montant
      }));
    });

    // ─── Construction du fichier FEC ──────────────────────────
    const HEADER = [
      'JournalCode','JournalLib','EcritureNum','EcritureDate','CompteNum','CompteLib',
      'CompAuxNum','CompAuxLib','PieceRef','PieceDate','EcritureLib','Debit','Credit',
      'EcritureLet','DateLet','ValidDate','Montantdevise','Idevise'
    ].join('|');

    const fec = HEADER + '\n' + lignes.join('\n') + '\n';

    // Nom de fichier normalisé : SIRENFECYYYYMMDD.txt
    const fecDate = to.replace(/-/g, '');
    const filename = `${SIREN}FEC${fecDate}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-FEC-Lignes', lignes.length);
    res.setHeader('X-FEC-Periode', `${from} → ${to}`);
    res.setHeader('X-FEC-Factures', factures.length);
    res.setHeader('X-FEC-Achats', achatsPhones.length);
    res.setHeader('X-FEC-Depenses', depenses.length);
    return res.status(200).send(fec);

  } catch (err) {
    console.error('[/api/export-fec]', err);
    return res.status(500).json({ error: err.message || 'Erreur export FEC' });
  }
}
