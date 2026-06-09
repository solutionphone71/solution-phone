// =============================================================================
// /api/inventaires — Gestion des inventaires comptables Solution Phone
// -----------------------------------------------------------------------------
// Routes :
//   GET  /api/inventaires?action=list                 → liste inventaires
//   GET  /api/inventaires?action=detail&id=X          → détail + lignes
//   POST /api/inventaires?action=create               → crée inventaire (en-tête + lignes)
//   POST /api/inventaires?action=update&id=X          → MAJ en-tête
//   POST /api/inventaires?action=update-item&id=X     → MAJ une ligne
//   POST /api/inventaires?action=add-item&id=X        → ajoute une ligne
//   POST /api/inventaires?action=delete-item&item_id=X → supprime une ligne
//   DELETE /api/inventaires?action=delete&id=X        → supprime inventaire complet
// =============================================================================

import { handleAuth } from './_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

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

// ─── Recalcule les totaux d'un inventaire à partir de ses lignes ──
async function recomputeTotals(invId) {
  const items = await sb(`inventaire_items?inventaire_id=eq.${invId}&select=section,montant_ht`);
  let t1 = 0, t2 = 0, t3 = 0;
  for (const it of items || []) {
    const m = Number(it.montant_ht || 0);
    if (it.section === 1) t1 += m;
    else if (it.section === 2) t2 += m;
    else if (it.section === 3) t3 += m;
  }
  const total = t1 + t2 + t3;
  await sb(`inventaires?id=eq.${invId}`, {
    method: 'PATCH',
    body: {
      total_section1: Math.round(t1 * 100) / 100,
      total_section2: Math.round(t2 * 100) / 100,
      total_section3: Math.round(t3 * 100) / 100,
      total_ht: Math.round(total * 100) / 100,
      updated_at: new Date().toISOString()
    }
  });
  return { t1, t2, t3, total };
}

// ════════════════════════════════════════════════════════════════════
// LIST
// ════════════════════════════════════════════════════════════════════
async function handleList(req, res) {
  try {
    const rows = await sb('inventaires?order=date_inventaire.desc&select=*&limit=200');
    return res.status(200).json({ ok: true, inventaires: rows || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// DETAIL
// ════════════════════════════════════════════════════════════════════
async function handleDetail(req, res) {
  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id requis' });
    const headers = await sb(`inventaires?id=eq.${id}&select=*`);
    if (!headers?.[0]) return res.status(404).json({ error: 'Inventaire introuvable' });
    const items = await sb(`inventaire_items?inventaire_id=eq.${id}&order=section.asc,order_index.asc&select=*`);
    return res.status(200).json({ ok: true, inventaire: headers[0], items: items || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// CREATE — { date_inventaire, nom, etabli_par, sections: [{section, categories: [{nom, items: [...]}] }] }
// ════════════════════════════════════════════════════════════════════
async function handleCreate(req, res) {
  try {
    const body = req.body || {};
    const { date_inventaire, nom, etabli_par, statut, sections = [], source_file, notes } = body;
    if (!date_inventaire) return res.status(400).json({ error: 'date_inventaire requise' });
    if (!nom) return res.status(400).json({ error: 'nom requis' });

    // Insert header
    const headIns = await sb('inventaires', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        date_inventaire, nom,
        statut: statut || 'draft',
        etabli_par: etabli_par || 'Sébastien Cannard',
        source_file: source_file || null,
        notes: notes || null
      }
    });
    const invId = headIns?.[0]?.id;
    if (!invId) throw new Error('Insertion header échouée');

    // Insert items
    let orderIdx = 0;
    const itemsToInsert = [];
    for (const s of sections) {
      for (const c of (s.categories || [])) {
        for (const it of (c.items || [])) {
          const q = Number(it.quantite || 0);
          const pu = Number(it.pu_ht || 0);
          const m = (it.montant_ht != null ? Number(it.montant_ht) : q * pu);
          itemsToInsert.push({
            inventaire_id: invId,
            section: s.section,
            categorie: c.nom,
            designation: it.designation,
            quantite: q,
            pu_ht: pu,
            montant_ht: Math.round(m * 100) / 100,
            order_index: orderIdx++
          });
        }
      }
    }
    if (itemsToInsert.length) {
      await sb('inventaire_items', { method: 'POST', body: itemsToInsert });
    }
    const totals = await recomputeTotals(invId);
    return res.status(200).json({ ok: true, inventaire_id: invId, items_count: itemsToInsert.length, totals });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// UPDATE en-tête
// ════════════════════════════════════════════════════════════════════
async function handleUpdate(req, res) {
  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id requis' });
    const body = req.body || {};
    const patch = {};
    ['date_inventaire', 'nom', 'statut', 'etabli_par', 'notes'].forEach(k => {
      if (body[k] != null) patch[k] = body[k];
    });
    patch.updated_at = new Date().toISOString();
    await sb(`inventaires?id=eq.${id}`, { method: 'PATCH', body: patch });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// ADD ITEM
// ════════════════════════════════════════════════════════════════════
async function handleAddItem(req, res) {
  try {
    const invId = req.query?.id;
    if (!invId) return res.status(400).json({ error: 'id requis' });
    const { section, categorie, designation, quantite, pu_ht } = req.body || {};
    if (!section || !designation) return res.status(400).json({ error: 'section + designation requis' });
    const q = Number(quantite || 0);
    const pu = Number(pu_ht || 0);
    const row = await sb('inventaire_items', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        inventaire_id: invId,
        section,
        categorie: categorie || '—',
        designation,
        quantite: q,
        pu_ht: pu,
        montant_ht: Math.round(q * pu * 100) / 100,
        order_index: 999
      }
    });
    await recomputeTotals(invId);
    return res.status(200).json({ ok: true, item: row?.[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// UPDATE ITEM
// ════════════════════════════════════════════════════════════════════
async function handleUpdateItem(req, res) {
  try {
    const itemId = req.query?.item_id || req.body?.item_id;
    if (!itemId) return res.status(400).json({ error: 'item_id requis' });
    const body = req.body || {};
    const patch = {};
    ['designation', 'categorie', 'section'].forEach(k => { if (body[k] != null) patch[k] = body[k]; });
    if (body.quantite != null) patch.quantite = Number(body.quantite);
    if (body.pu_ht != null) patch.pu_ht = Number(body.pu_ht);
    if (patch.quantite != null || patch.pu_ht != null) {
      // Recalcule montant_ht
      const cur = await sb(`inventaire_items?id=eq.${itemId}&select=quantite,pu_ht,inventaire_id`);
      const q = patch.quantite != null ? patch.quantite : Number(cur?.[0]?.quantite || 0);
      const pu = patch.pu_ht != null ? patch.pu_ht : Number(cur?.[0]?.pu_ht || 0);
      patch.montant_ht = Math.round(q * pu * 100) / 100;
      await sb(`inventaire_items?id=eq.${itemId}`, { method: 'PATCH', body: patch });
      if (cur?.[0]?.inventaire_id) await recomputeTotals(cur[0].inventaire_id);
    } else {
      await sb(`inventaire_items?id=eq.${itemId}`, { method: 'PATCH', body: patch });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// DELETE ITEM
// ════════════════════════════════════════════════════════════════════
async function handleDeleteItem(req, res) {
  try {
    const itemId = req.query?.item_id;
    if (!itemId) return res.status(400).json({ error: 'item_id requis' });
    const cur = await sb(`inventaire_items?id=eq.${itemId}&select=inventaire_id`);
    const invId = cur?.[0]?.inventaire_id;
    await sb(`inventaire_items?id=eq.${itemId}`, { method: 'DELETE' });
    if (invId) await recomputeTotals(invId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// DELETE complet
// ════════════════════════════════════════════════════════════════════
async function handleDelete(req, res) {
  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id requis' });
    await sb(`inventaires?id=eq.${id}`, { method: 'DELETE' });  // CASCADE supprime items
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

// ════════════════════════════════════════════════════════════════════
// HANDLER principal
// ════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  const action = req.query?.action || '';
  try {
    switch (action) {
      case 'list':         return handleList(req, res);
      case 'detail':       return handleDetail(req, res);
      case 'create':       return handleCreate(req, res);
      case 'update':       return handleUpdate(req, res);
      case 'add-item':     return handleAddItem(req, res);
      case 'update-item':  return handleUpdateItem(req, res);
      case 'delete-item':  return handleDeleteItem(req, res);
      case 'delete':       return handleDelete(req, res);
      default:
        return res.status(400).json({ error: `Action inconnue: "${action}"` });
    }
  } catch (e) {
    console.error('[inventaires]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
