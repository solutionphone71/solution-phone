/**
 * AI COMMANDER — Solution Phone
 * Raccourci : Cmd+K (Mac) ou Ctrl+K (Win)
 * Dispatcher offline-first → fallback Claude API
 * v1.0 — Avril 2026
 */

(function () {
  "use strict";

  /* ─── CSS ─────────────────────────────────────────────────────────────── */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap');

    #aic-backdrop {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 12vh;
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    #aic-backdrop.aic-open {
      opacity: 1; pointer-events: all;
    }

    #aic-panel {
      width: min(680px, 92vw);
      background: rgba(13,13,18,0.92);
      border: 0.5px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      box-shadow:
        0 0 0 0.5px rgba(255,255,255,0.06) inset,
        0 32px 80px rgba(0,0,0,0.7),
        0 0 60px rgba(220,38,38,0.08);
      transform: scale(0.94) translateY(-12px);
      transition: transform 0.38s cubic-bezier(0.34,1.56,0.64,1),
                  opacity 0.22s ease;
      opacity: 0;
      overflow: hidden;
      font-family: -apple-system, 'SF Pro Display', system-ui, sans-serif;
    }
    #aic-backdrop.aic-open #aic-panel {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    /* ── Barre de saisie ── */
    #aic-input-row {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 20px;
      border-bottom: 0.5px solid rgba(255,255,255,0.07);
    }
    #aic-icon {
      width: 22px; height: 22px; flex-shrink: 0;
      color: rgba(255,255,255,0.35);
    }
    #aic-input {
      flex: 1; background: none; border: none; outline: none;
      font-size: 17px; font-weight: 400; letter-spacing: -0.01em;
      color: #fff; caret-color: #ef4444;
    }
    #aic-input::placeholder { color: rgba(255,255,255,0.28); }

    /* ── Bouton micro ── */
    #aic-mic {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(255,255,255,0.05); border: 0.5px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; position: relative; overflow: hidden;
      transition: background 0.2s, border-color 0.2s;
    }
    #aic-mic:hover { background: rgba(255,255,255,0.09); }
    #aic-mic.listening {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.5);
      animation: aic-mic-pulse 1.4s ease-in-out infinite;
    }
    @keyframes aic-mic-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
      50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    }
    #aic-mic svg { width: 15px; height: 15px; }

    /* Waveform animée (visible quand écoute) */
    #aic-wave {
      display: none; align-items: center; justify-content: center;
      gap: 2px; position: absolute; inset: 0;
      background: rgba(239,68,68,0.15);
    }
    #aic-mic.listening #aic-wave { display: flex; }
    #aic-mic.listening #aic-mic-icon { display: none; }
    .aic-bar {
      width: 2px; border-radius: 2px;
      background: #ef4444;
      animation: aic-wave-bar 0.8s ease-in-out infinite;
    }
    .aic-bar:nth-child(1) { height: 6px;  animation-delay: 0s;   }
    .aic-bar:nth-child(2) { height: 12px; animation-delay: 0.1s; }
    .aic-bar:nth-child(3) { height: 18px; animation-delay: 0.2s; }
    .aic-bar:nth-child(4) { height: 12px; animation-delay: 0.3s; }
    .aic-bar:nth-child(5) { height: 6px;  animation-delay: 0.4s; }
    @keyframes aic-wave-bar {
      0%,100% { transform: scaleY(1); }
      50%      { transform: scaleY(0.35); }
    }

    /* ── Suggestions rapides ── */
    #aic-suggestions {
      padding: 12px 20px 14px;
      border-bottom: 0.5px solid rgba(255,255,255,0.06);
    }
    .aic-suggest-label {
      font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
      color: rgba(255,255,255,0.25); margin-bottom: 10px;
    }
    .aic-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .aic-chip {
      padding: 5px 12px; border-radius: 20px; cursor: pointer;
      font-size: 12px; color: rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.05);
      border: 0.5px solid rgba(255,255,255,0.08);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .aic-chip:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-color: rgba(255,255,255,0.18);
    }

    /* ── Zone résultats ── */
    #aic-results {
      min-height: 0; max-height: 55vh;
      overflow-y: auto; padding: 16px 20px;
      scrollbar-width: none;
    }
    #aic-results::-webkit-scrollbar { display: none; }

    /* ── États ── */
    .aic-empty {
      text-align: center; padding: 28px 0;
      color: rgba(255,255,255,0.18); font-size: 13px;
    }

    /* ── Loader ── */
    .aic-loader {
      display: flex; align-items: center; gap: 10px;
      color: rgba(255,255,255,0.4); font-size: 13px;
      padding: 6px 0;
    }
    .aic-dots { display: flex; gap: 4px; }
    .aic-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,0.35);
      animation: aic-dot-bounce 1.2s ease-in-out infinite;
    }
    .aic-dot:nth-child(2) { animation-delay: 0.2s; }
    .aic-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aic-dot-bounce {
      0%,80%,100% { transform: translateY(0); opacity: 0.35; }
      40%          { transform: translateY(-6px); opacity: 1; }
    }

    /* ── Cards résultat ── */
    .aic-card {
      background: rgba(255,255,255,0.04);
      border: 0.5px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 18px 20px;
      margin-bottom: 10px;
      animation: aic-card-in 0.32s cubic-bezier(0.34,1.4,0.64,1);
    }
    @keyframes aic-card-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .aic-card-label {
      font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
      color: rgba(255,255,255,0.3); margin-bottom: 10px;
    }
    .aic-card-value {
      font-size: 38px; font-weight: 600; letter-spacing: -0.03em;
      line-height: 1;
    }
    .aic-card-value.green  { color: #34d399; }
    .aic-card-value.red    { color: #f87171; }
    .aic-card-value.blue   { color: #60a5fa; }
    .aic-card-value.amber  { color: #fbbf24; }
    .aic-card-value.white  { color: #ffffff; }
    .aic-card-sub {
      margin-top: 6px; font-size: 13px; color: rgba(255,255,255,0.4);
    }
    .aic-card-meta {
      margin-top: 14px; padding-top: 12px;
      border-top: 0.5px solid rgba(255,255,255,0.07);
      display: flex; flex-wrap: wrap; gap: 16px;
    }
    .aic-card-meta-item { font-size: 12px; }
    .aic-card-meta-item span { color: rgba(255,255,255,0.3); }
    .aic-card-meta-item strong { color: rgba(255,255,255,0.75); font-weight: 500; }

    /* Card réparation (kanban style) */
    .aic-repair-card {
      background: rgba(255,255,255,0.04);
      border: 0.5px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 16px 20px;
      margin-bottom: 10px;
      animation: aic-card-in 0.32s cubic-bezier(0.34,1.4,0.64,1);
    }
    .aic-repair-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .aic-repair-name { font-size: 16px; font-weight: 500; color: #fff; }
    .aic-status-badge {
      font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 20px; font-weight: 500;
    }
    .aic-status-badge.attente   { background: rgba(251,191,36,0.15); color: #fbbf24; border: 0.5px solid rgba(251,191,36,0.3); }
    .aic-status-badge.en-cours  { background: rgba(96,165,250,0.15); color: #60a5fa; border: 0.5px solid rgba(96,165,250,0.3); }
    .aic-status-badge.termine   { background: rgba(52,211,153,0.15); color: #34d399; border: 0.5px solid rgba(52,211,153,0.3); }
    .aic-status-badge.livre     { background: rgba(168,85,247,0.15); color: #c084fc; border: 0.5px solid rgba(168,85,247,0.3); }
    .aic-repair-info { font-size: 13px; color: rgba(255,255,255,0.4); }
    .aic-repair-info strong { color: rgba(255,255,255,0.7); font-weight: 500; }

    /* Card action navigation */
    .aic-nav-card {
      background: rgba(239,68,68,0.08);
      border: 0.5px solid rgba(239,68,68,0.2);
      border-radius: 14px; padding: 16px 20px;
      margin-bottom: 10px; cursor: pointer;
      display: flex; align-items: center; gap: 16px;
      animation: aic-card-in 0.32s cubic-bezier(0.34,1.4,0.64,1);
      transition: background 0.15s, border-color 0.15s;
    }
    .aic-nav-card:hover {
      background: rgba(239,68,68,0.14);
      border-color: rgba(239,68,68,0.35);
    }
    .aic-nav-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(239,68,68,0.15); border: 0.5px solid rgba(239,68,68,0.2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 18px;
    }
    .aic-nav-title { font-size: 15px; font-weight: 500; color: #fff; }
    .aic-nav-sub   { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }

    /* Card texte AI */
    .aic-ai-card {
      background: rgba(255,255,255,0.03);
      border: 0.5px solid rgba(255,255,255,0.08);
      border-left: 2px solid rgba(239,68,68,0.6);
      border-radius: 14px; padding: 16px 20px;
      margin-bottom: 10px;
      animation: aic-card-in 0.32s cubic-bezier(0.34,1.4,0.64,1);
    }
    .aic-ai-label {
      font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase;
      color: rgba(239,68,68,0.7); margin-bottom: 8px;
    }
    .aic-ai-text { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,0.75); }

    /* ── Footer ── */
    #aic-footer {
      padding: 10px 20px;
      border-top: 0.5px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: space-between;
    }
    .aic-kbd { display: flex; gap: 6px; align-items: center; }
    .aic-key {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(255,255,255,0.07); border: 0.5px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.35); font-family: monospace;
    }
    .aic-footer-brand {
      font-size: 10px; letter-spacing: 0.06em; color: rgba(255,255,255,0.18);
      text-transform: uppercase;
    }
  `;

  /* ─── HTML TEMPLATE ───────────────────────────────────────────────────── */
  const HTML = `
    <div id="aic-backdrop">
      <div id="aic-panel" role="dialog" aria-label="AI Commander">

        <div id="aic-input-row">
          <svg id="aic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input id="aic-input" type="text"
            placeholder="Que voulez-vous faire ? (CA du jour, statut Dupont…)" autocomplete="off" spellcheck="false"/>
          <div id="aic-mic" title="Commande vocale">
            <div id="aic-mic-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5">
                <rect x="9" y="2" width="6" height="11" rx="3"/>
                <path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
              </svg>
            </div>
            <div id="aic-wave">
              <div class="aic-bar"></div><div class="aic-bar"></div>
              <div class="aic-bar"></div><div class="aic-bar"></div>
              <div class="aic-bar"></div>
            </div>
          </div>
        </div>

        <div id="aic-suggestions">
          <div class="aic-suggest-label">Suggestions rapides</div>
          <div class="aic-chips">
            <div class="aic-chip">💰 CA aujourd'hui</div>
            <div class="aic-chip">📱 Statut iPhone Dupont</div>
            <div class="aic-chip">📄 Facturer Martin</div>
            <div class="aic-chip">🔧 Réparations en cours</div>
            <div class="aic-chip">📦 Stock accessoires</div>
            <div class="aic-chip">✅ Passer Müller en terminé</div>
          </div>
        </div>

        <div id="aic-results">
          <div class="aic-empty">Tapez une commande ou parlez — je m'occupe du reste.</div>
        </div>

        <div id="aic-footer">
          <div class="aic-kbd">
            <span class="aic-key">Esc</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.2)">fermer</span>
            <span style="color:rgba(255,255,255,0.1);margin:0 4px">·</span>
            <span class="aic-key">↵</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.2)">exécuter</span>
          </div>
          <span class="aic-footer-brand">AI Commander · Solution Phone</span>
        </div>
      </div>
    </div>
  `;

  /* ─── DISPATCHER OFFLINE-FIRST ────────────────────────────────────────── */

  // Normalise le texte (minuscules, sans accents)
  function normalize(str) {
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['']/g, "'");
  }

  // Extrait un nom propre (majuscule isolée) depuis le texte
  function extractName(text) {
    const m = text.match(/\b([A-ZÁÉÈÊËÀÂÙÛÜ][a-záéèêëàâùûü]{2,})\b/);
    return m ? m[1] : null;
  }

  // Détecte une date relative
  function extractDate(norm) {
    const today = new Date();
    if (/aujourd.?hui/.test(norm)) return { label: "aujourd'hui", date: today };
    if (/hier/.test(norm)) {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      return { label: "hier", date: d };
    }
    if (/cette semaine|semaine/.test(norm)) {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      return { label: "cette semaine", date: d };
    }
    if (/ce mois|mois/.test(norm)) {
      const d = new Date(today); d.setDate(1);
      return { label: "ce mois", date: d };
    }
    return null;
  }

  // Règles offline — retourne { type, params } ou null
  function offlineDispatch(text) {
    const n = normalize(text);
    const orig = text;

    // ─ CA / chiffre d'affaires ─
    if (/\b(ca|chiffre.?d.?affaires|ventes?|revenus?|total|recette)\b/.test(n)) {
      const dateInfo = extractDate(n) || { label: "aujourd'hui", date: new Date() };
      return { type: "CA", params: { dateInfo } };
    }

    // ─ Statut réparation ─
    if (/\b(statut|ou est|ou en est|avancement|suivre|suivi)\b/.test(n)) {
      const name = extractName(orig);
      return { type: "STATUT", params: { name } };
    }

    // ─ Changer statut ─
    if (/\b(passe[rz]?|mettre?|marquer?|changer?)\b/.test(n) &&
        /\b(termine|fini|pret|pret a retirer|livre|en cours|attente)\b/.test(n)) {
      const name = extractName(orig);
      let statut = "terminé";
      if (/livre/.test(n)) statut = "livré";
      else if (/en.cours/.test(n)) statut = "en_cours";
      else if (/attente/.test(n)) statut = "attente";
      return { type: "UPDATE_STATUT", params: { name, statut } };
    }

    // ─ Facturer / facture ─
    if (/\b(facture[rz]?|nouvelle.facture|creer.facture)\b/.test(n)) {
      const name = extractName(orig);
      return { type: "NAVIGATE_FACTURE", params: { name } };
    }

    // ─ Réparations en cours ─
    if (/\b(reparations?|bons?.depot|fiches?)\b/.test(n) &&
        /\b(en.cours|liste|voir|afficher)\b/.test(n)) {
      return { type: "REPARATIONS_EN_COURS", params: {} };
    }

    // ─ Stock ─
    if (/\b(stock|inventaire|accessoires?)\b/.test(n)) {
      return { type: "NAVIGATE", params: { section: "stock", label: "Gestion du stock", emoji: "📦", desc: "Consulter et mettre à jour l'inventaire" } };
    }

    // ─ Caisse ─
    if (/\b(caisse|encaissement|z de caisse)\b/.test(n)) {
      return { type: "NAVIGATE", params: { section: "caisse", label: "Caisse", emoji: "🏧", desc: "Ouvrir le module de caisse" } };
    }

    return null; // → fallback Claude API
  }

  /* ─── HANDLERS SUPABASE ──────────────────────────────────────────────── */
  async function queryCA(dateInfo) {
    // Utilise le client Supabase global de l'app
    if (!window.supabase) return { error: "Supabase non disponible" };

    const startDate = dateInfo.date;
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await window.supabase
      .from("caisse")
      .select("total_ttc, mode_paiement")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .eq("cloture", false);

    if (error) return { error };

    const total = data.reduce((s, r) => s + (r.total_ttc || 0), 0);
    const nb = data.length;
    const parMode = {};
    data.forEach(r => {
      const m = r.mode_paiement || "autre";
      parMode[m] = (parMode[m] || 0) + (r.total_ttc || 0);
    });
    return { total, nb, parMode, label: dateInfo.label };
  }

  async function queryStatut(name) {
    if (!window.supabase) return { error: "Supabase non disponible" };
    if (!name) return { error: "Nom du client non détecté" };

    const { data, error } = await window.supabase
      .from("bons_depot")
      .select("id, client_nom, appareil, panne, statut, created_at, prix_reparation")
      .ilike("client_nom", `%${name}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) return { error };
    return { repairs: data, name };
  }

  async function updateStatut(name, statut) {
    if (!window.supabase) return { error: "Supabase non disponible" };
    if (!name) return { error: "Nom du client non détecté" };

    // Cherche le bon de dépôt actif
    const { data: bons } = await window.supabase
      .from("bons_depot")
      .select("id, client_nom, appareil, statut")
      .ilike("client_nom", `%${name}%`)
      .not("statut", "eq", "livré")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!bons || bons.length === 0) return { error: `Aucun dossier actif pour "${name}"` };
    const bon = bons[0];

    const { error } = await window.supabase
      .from("bons_depot")
      .update({ statut })
      .eq("id", bon.id);

    if (error) return { error };
    return { updated: true, bon: { ...bon, statut }, newStatut: statut };
  }

  async function queryReparationsEnCours() {
    if (!window.supabase) return { error: "Supabase non disponible" };
    const { data, error } = await window.supabase
      .from("bons_depot")
      .select("id, client_nom, appareil, panne, statut, created_at")
      .not("statut", "in", '("livré","annulé")')
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return { error };
    return { repairs: data };
  }

  /* ─── FALLBACK CLAUDE API ─────────────────────────────────────────────── */
  async function askClaude(question) {
    const SUPABASE_KEY = window.localStorage.getItem("sp_supabase_key") || "";
    const now = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

    const system = `Tu es l'assistant IA de Solution Phone, un SAV smartphone à Mâcon.
Aujourd'hui : ${now}.
Réponds toujours en français, de manière concise et directe.
Si l'utilisateur te demande des données (CA, réparations, clients), explique que tu ne peux pas les lire directement mais donne des conseils.
Ne réponds qu'en JSON strict : { "text": "ta réponse", "action": null }`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: question }]
        })
      });
      const d = await res.json();
      const raw = d.content?.[0]?.text || "{}";
      try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { return { text: raw, action: null }; }
    } catch (e) {
      return { text: "Connexion impossible à l'API.", action: null };
    }
  }

  /* ─── RENDERERS ──────────────────────────────────────────────────────── */

  function renderCA(data) {
    if (data.error) return renderError(data.error);
    const total = data.total || 0;
    const color = total > 500 ? "green" : total > 200 ? "amber" : "white";
    const parMode = data.parMode || {};
    const modeItems = Object.entries(parMode)
      .map(([k, v]) => `<div class="aic-card-meta-item"><span>${k}</span> <strong>${v.toFixed(2)} €</strong></div>`)
      .join("");

    return `<div class="aic-card">
      <div class="aic-card-label">Chiffre d'affaires — ${data.label}</div>
      <div class="aic-card-value ${color}">${total.toFixed(2)} €</div>
      <div class="aic-card-sub">${data.nb} transaction${data.nb > 1 ? "s" : ""} enregistrée${data.nb > 1 ? "s" : ""}</div>
      ${modeItems ? `<div class="aic-card-meta">${modeItems}</div>` : ""}
    </div>`;
  }

  function renderStatut(data) {
    if (data.error) return renderError(data.error);
    if (!data.repairs || data.repairs.length === 0)
      return renderError(`Aucune réparation trouvée pour "${data.name}"`);

    return data.repairs.map(r => {
      const statutClass = {
        "attente": "attente", "en_cours": "en-cours",
        "terminé": "termine", "livré": "livre"
      }[r.statut] || "attente";
      const date = new Date(r.created_at).toLocaleDateString("fr-FR");
      const prix = r.prix_reparation ? `${r.prix_reparation} €` : "—";
      return `<div class="aic-repair-card">
        <div class="aic-repair-header">
          <div class="aic-repair-name">${r.client_nom}</div>
          <div class="aic-status-badge ${statutClass}">${r.statut}</div>
        </div>
        <div class="aic-repair-info">
          <strong>${r.appareil}</strong> · ${r.panne || "—"} · ${prix} · le ${date}
        </div>
      </div>`;
    }).join("");
  }

  function renderUpdateStatut(data) {
    if (data.error) return renderError(data.error);
    const statutClass = {
      "attente": "attente", "en_cours": "en-cours",
      "terminé": "termine", "livré": "livre"
    }[data.newStatut] || "termine";

    // Déclenche mise à jour visuelle dans le dashboard si possible
    if (typeof window.refreshDashboard === "function") {
      setTimeout(() => window.refreshDashboard(), 400);
    }

    return `<div class="aic-repair-card">
      <div class="aic-repair-header">
        <div class="aic-repair-name">✓ Statut mis à jour</div>
        <div class="aic-status-badge ${statutClass}">${data.newStatut}</div>
      </div>
      <div class="aic-repair-info">
        <strong>${data.bon.client_nom}</strong> — ${data.bon.appareil} est maintenant <strong style="color:#fff">${data.newStatut}</strong>
      </div>
    </div>`;
  }

  function renderNavFact(data) {
    return `<div class="aic-nav-card" onclick="window.AICNavigate('facture', ${JSON.stringify(data.name)})">
      <div class="aic-nav-icon">📄</div>
      <div>
        <div class="aic-nav-title">Nouvelle facture${data.name ? ` — ${data.name}` : ""}</div>
        <div class="aic-nav-sub">Ouvrir le module facturation${data.name ? ` avec "${data.name}" pré-rempli` : ""}</div>
      </div>
    </div>`;
  }

  function renderNav(data) {
    return `<div class="aic-nav-card" onclick="window.AICNavigate('${data.section}')">
      <div class="aic-nav-icon">${data.emoji}</div>
      <div>
        <div class="aic-nav-title">${data.label}</div>
        <div class="aic-nav-sub">${data.desc}</div>
      </div>
    </div>`;
  }

  function renderReparations(data) {
    if (data.error) return renderError(data.error);
    if (!data.repairs || data.repairs.length === 0)
      return renderError("Aucune réparation en cours");
    return `
      <div class="aic-card-label" style="margin-bottom:10px">
        ${data.repairs.length} réparation${data.repairs.length > 1 ? "s" : ""} active${data.repairs.length > 1 ? "s" : ""}
      </div>
      ${data.repairs.map(r => {
        const statutClass = { "attente": "attente", "en_cours": "en-cours", "terminé": "termine" }[r.statut] || "attente";
        return `<div class="aic-repair-card">
          <div class="aic-repair-header">
            <div class="aic-repair-name">${r.client_nom}</div>
            <div class="aic-status-badge ${statutClass}">${r.statut}</div>
          </div>
          <div class="aic-repair-info"><strong>${r.appareil}</strong> · ${r.panne || "—"}</div>
        </div>`;
      }).join("")}`;
  }

  function renderAI(data) {
    return `<div class="aic-ai-card">
      <div class="aic-ai-label">🤖 Claude AI</div>
      <div class="aic-ai-text">${data.text}</div>
    </div>`;
  }

  function renderError(msg) {
    return `<div class="aic-ai-card">
      <div class="aic-ai-label" style="color:rgba(248,113,113,0.7)">Erreur</div>
      <div class="aic-ai-text" style="color:rgba(248,113,113,0.7)">${msg}</div>
    </div>`;
  }

  function renderLoader() {
    return `<div class="aic-loader">
      <div class="aic-dots">
        <div class="aic-dot"></div><div class="aic-dot"></div><div class="aic-dot"></div>
      </div>
      <span>Analyse en cours…</span>
    </div>`;
  }

  /* ─── CLASSE PRINCIPALE ──────────────────────────────────────────────── */
  class AICommander {
    constructor() {
      this.isOpen = false;
      this.isListening = false;
      this.recognition = null;
      this.debounceTimer = null;
    }

    init() {
      // Injecter CSS
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);

      // Injecter HTML
      const div = document.createElement("div");
      div.innerHTML = HTML;
      document.body.appendChild(div.firstElementChild);

      this.$backdrop  = document.getElementById("aic-backdrop");
      this.$input     = document.getElementById("aic-input");
      this.$results   = document.getElementById("aic-results");
      this.$mic       = document.getElementById("aic-mic");

      this._bindEvents();
      this._initVoice();

      // Callback navigation global — à surcharger dans index.html
      window.AICNavigate = (section, param) => {
        console.log(`[AICommander] Navigate → ${section}`, param);
        // Si l'app expose showSection / activateMenu, on l'utilise
        if (typeof window.showSection === "function") window.showSection(section, param);
        else if (typeof window.navigateTo === "function") window.navigateTo(section, param);
        this.close();
      };

      console.log("[AICommander] ✅ Initialisé. Raccourci : Cmd+K / Ctrl+K");
    }

    _bindEvents() {
      // Cmd+K / Ctrl+K
      document.addEventListener("keydown", e => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          this.isOpen ? this.close() : this.open();
        }
        if (e.key === "Escape" && this.isOpen) this.close();
      });

      // Fermer en cliquant le backdrop
      this.$backdrop.addEventListener("click", e => {
        if (e.target === this.$backdrop) this.close();
      });

      // Soumettre via Entrée
      this.$input.addEventListener("keydown", e => {
        if (e.key === "Enter" && this.$input.value.trim()) {
          this.process(this.$input.value.trim());
        }
      });

      // Chips de suggestion
      document.querySelectorAll(".aic-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          this.$input.value = chip.textContent.replace(/^[^\s]+\s/, ""); // retire l'emoji
          this.process(this.$input.value.trim());
        });
      });

      // Bouton micro
      this.$mic.addEventListener("click", () => {
        this.isListening ? this.stopVoice() : this.startVoice();
      });
    }

    open() {
      this.isOpen = true;
      this.$backdrop.classList.add("aic-open");
      setTimeout(() => this.$input.focus(), 60);
    }

    close() {
      this.isOpen = false;
      this.$backdrop.classList.remove("aic-open");
      this.stopVoice();
      setTimeout(() => {
        this.$input.value = "";
        this.$results.innerHTML = `<div class="aic-empty">Tapez une commande ou parlez — je m'occupe du reste.</div>`;
      }, 250);
    }

    async process(text) {
      if (!text) return;
      this.$results.innerHTML = renderLoader();

      // 1. Dispatcher offline
      const intent = offlineDispatch(text);

      if (intent) {
        let html = "";
        switch (intent.type) {
          case "CA": {
            const data = await queryCA(intent.params.dateInfo);
            html = renderCA(data); break;
          }
          case "STATUT": {
            const data = await queryStatut(intent.params.name);
            html = renderStatut(data); break;
          }
          case "UPDATE_STATUT": {
            const data = await updateStatut(intent.params.name, intent.params.statut);
            html = renderUpdateStatut(data); break;
          }
          case "NAVIGATE_FACTURE":
            html = renderNavFact(intent.params); break;
          case "NAVIGATE":
            html = renderNav(intent.params); break;
          case "REPARATIONS_EN_COURS": {
            const data = await queryReparationsEnCours();
            html = renderReparations(data); break;
          }
        }
        this.$results.innerHTML = html;
      } else {
        // 2. Fallback Claude API
        const aiResult = await askClaude(text);
        this.$results.innerHTML = renderAI(aiResult);
      }
    }

    /* ─── VOIX ── */
    _initVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        this.$mic.title = "Reconnaissance vocale non supportée";
        this.$mic.style.opacity = "0.4";
        return;
      }
      this.recognition = new SR();
      this.recognition.lang = "fr-FR";
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = e => {
        let interim = "", final = "";
        for (const r of e.results) {
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        this.$input.value = final || interim;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.$mic.classList.remove("listening");
        const val = this.$input.value.trim();
        if (val) setTimeout(() => this.process(val), 300);
      };

      this.recognition.onerror = () => {
        this.isListening = false;
        this.$mic.classList.remove("listening");
      };
    }

    startVoice() {
      if (!this.recognition) return;
      this.isListening = true;
      this.$mic.classList.add("listening");
      this.$input.placeholder = "J'écoute…";
      this.recognition.start();
    }

    stopVoice() {
      if (!this.recognition || !this.isListening) return;
      this.isListening = false;
      this.$mic.classList.remove("listening");
      this.$input.placeholder = "Que voulez-vous faire ?";
      this.recognition.stop();
    }
  }

  /* ─── INIT AUTO ────────────────────────────────────────────────────────── */
  const commander = new AICommander();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => commander.init());
  } else {
    commander.init();
  }

  // Exposer globalement
  window.AICommander = commander;
})();
