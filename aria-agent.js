/* ═══════════════════════════════════════════════════════════════════
   SOLUTION PHONE · ARIA v1.0
   Agent de Réparation Intelligent Automatisé
   ─────────────────────────────────────────────────────────────────
   • Cmd+K → ouvre le panneau ARIA
   • Bouton micro flottant → commande vocale (Web Speech API)
   • Natural Language → Supabase (Claude API)
   • Workflow client visuel (progression A→Z)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────────────── */
  const ARIA_VERSION = '1.0.0';
  const CLAUDE_MODEL = 'claude-sonnet-4-6';

  // Clé API Claude (stockée en localStorage via PARAMS_KEYS)
  function getClaudeKey() {
    try {
      const keys = JSON.parse(localStorage.getItem('sp_params_keys') || '{}');
      return keys.claude_key || keys.anthropic_key || '';
    } catch { return ''; }
  }

  // Accès Supabase (réutilise les globals de l'app)
  async function supaQuery(table, params = '') {
    if (typeof supaFetch === 'function') return supaFetch(table, 'GET', null, params);
    const url = `${window.SUPABASE_URL || ''}/rest/v1/${table}${params}`;
    const key = window.SUPABASE_KEY || '';
    const r = await fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' } });
    return r.json();
  }

  async function supaPatch(table, data, params = '') {
    if (typeof supaFetch === 'function') return supaFetch(table, 'PATCH', data, params);
    const url = `${window.SUPABASE_URL || ''}/rest/v1/${table}${params}`;
    const key = window.SUPABASE_KEY || '';
    const r = await fetch(url, { method: 'PATCH', headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
    return r.json();
  }

  /* ── SYSTÈME PROMPT ARIA ────────────────────────────────────────── */
  const ARIA_SYSTEM = `Tu es ARIA (Agent de Réparation Intelligent Automatisé), l'assistant IA intégré à l'application Solution Phone de Mâcon.

Tu aides le gérant (Sébastien) et son équipe à :
- Interroger les données (CA, réparations, clients, stock)
- Effectuer des actions dans l'app (changer statut, ouvrir modules)
- Analyser les performances commerciales
- Gérer les flux QualiRépar

TABLES SUPABASE DISPONIBLES :
- caisse : enregistrements de caisse (date, montant, type, description)
- bons_depot : réparations (id, client_nom, client_tel, appareil, panne, statut, prix, created_at)
- clients_en_attente : formulaires clients entrants
- phones : smartphones achetés/en stock
- factures : factures TVA sur marge
- roulette_participations : participations jeu roulette

STATUTS RÉPARATIONS : 'en_attente', 'en_cours', 'attente_pieces', 'pret', 'rendu'

RÉPONDS TOUJOURS en JSON avec cette structure exacte :
{
  "intent": "query|action|navigate|workflow|info|error",
  "confidence": 0.0-1.0,
  "response": "Réponse humaine en français (1-2 phrases max)",
  "data_needed": {
    "table": "nom_table",
    "filter": "?select=...&...=...",
    "action": "navigate|update|create|show_workflow",
    "params": {}
  },
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Sois concis, professionnel et bienveillant. Tu t'adresses à un artisan.`;

  /* ── ÉTAT GLOBAL ────────────────────────────────────────────────── */
  const STATE = {
    isOpen: false,
    isListening: false,
    isThinking: false,
    history: [],
    recognition: null,
    currentWorkflow: null,
  };

  /* ══════════════════════════════════════════════════════════════════
     INJECTION HTML / CSS
  ══════════════════════════════════════════════════════════════════ */
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'aria-styles';
    style.textContent = `
/* ── ARIA OVERLAY ─────────────────────────────────────────── */
#aria-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,0); pointer-events: none;
  transition: background .3s ease;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 80px;
}
#aria-overlay.open {
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: all;
}

/* ── PANNEAU ARIA ─────────────────────────────────────────── */
#aria-panel {
  width: 680px; max-width: 95vw;
  background: rgba(20,20,22,0.92);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.85), 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,59,48,0.08);
  overflow: hidden;
  transform: translateY(-20px) scale(0.97);
  opacity: 0;
  transition: transform .3s cubic-bezier(.22,1,.36,1), opacity .3s ease;
  position: relative;
}
#aria-panel::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,59,48,.9) 40%, rgba(255,59,48,1) 50%, rgba(255,59,48,.9) 60%, transparent);
}
#aria-overlay.open #aria-panel {
  transform: none; opacity: 1;
}

/* ── ARIA HEADER ──────────────────────────────────────────── */
#aria-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
#aria-logo {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #ff3b30, #c0392b);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(255,59,48,0.4);
  flex-shrink: 0;
}
#aria-title-block { flex: 1; }
#aria-title {
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 15px; font-weight: 700; color: #fff;
  letter-spacing: -.02em;
}
#aria-subtitle {
  font-size: 11px; color: rgba(255,255,255,0.4);
  font-weight: 400;
}
#aria-status {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: rgba(255,255,255,0.5);
  font-weight: 500;
}
#aria-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #30d158;
  box-shadow: 0 0 5px #30d158, 0 0 10px rgba(48,209,88,0.4);
  animation: aria-pulse 2.5s ease-in-out infinite;
}
@keyframes aria-pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:.6; transform:scale(.8); }
}
#aria-close {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,.07); border: none;
  color: rgba(255,255,255,.5); font-size: 14px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
#aria-close:hover { background: rgba(255,59,48,.2); color: #ff3b30; }

/* ── ARIA CONVERSATION ────────────────────────────────────── */
#aria-conversation {
  max-height: 340px; overflow-y: auto;
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 12px;
  scroll-behavior: smooth;
}
#aria-conversation::-webkit-scrollbar { width: 3px; }
#aria-conversation::-webkit-scrollbar-thumb { background: rgba(255,59,48,.3); border-radius: 2px; }

.aria-msg {
  display: flex; gap: 10px; align-items: flex-start;
  animation: aria-msg-in .25s cubic-bezier(.22,1,.36,1) both;
}
@keyframes aria-msg-in {
  from { opacity:0; transform:translateY(8px); }
  to   { opacity:1; transform:none; }
}
.aria-msg.user { flex-direction: row-reverse; }

.aria-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
  background: linear-gradient(135deg, #ff3b30, #c0392b);
}
.aria-msg.user .aria-avatar {
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.15);
}
.aria-bubble {
  max-width: 520px;
  padding: 10px 14px;
  border-radius: 14px;
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 14px; line-height: 1.55; font-weight: 400;
}
.aria-msg.agent .aria-bubble {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  color: rgba(255,255,255,.9);
  border-radius: 14px 14px 14px 4px;
}
.aria-msg.user .aria-bubble {
  background: rgba(255,59,48,.15);
  border: 1px solid rgba(255,59,48,.25);
  color: #fff;
  border-radius: 14px 14px 4px 14px;
}

/* Carte donnée dans la réponse ARIA */
.aria-data-card {
  margin-top: 8px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px; padding: 12px;
}
.aria-data-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.05);
  font-size: 13px;
}
.aria-data-row:last-child { border: none; }
.aria-data-label { color: rgba(255,255,255,.5); }
.aria-data-value { color: #fff; font-weight: 600; }
.aria-data-value.amount { color: #ff3b30; text-shadow: 0 0 8px rgba(255,59,48,.5); }

/* Suggestions rapides */
.aria-suggestions {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;
}
.aria-suggestion {
  padding: 5px 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 20px;
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,.7);
  cursor: pointer; transition: all .14s;
}
.aria-suggestion:hover {
  background: rgba(255,59,48,.15);
  border-color: rgba(255,59,48,.35);
  color: #ff3b30;
}

/* Thinking indicator */
.aria-thinking {
  display: flex; gap: 5px; align-items: center;
  padding: 8px 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 14px; width: fit-content;
}
.aria-thinking span {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,59,48,.7);
  animation: aria-think .9s ease-in-out infinite;
}
.aria-thinking span:nth-child(2) { animation-delay: .2s; }
.aria-thinking span:nth-child(3) { animation-delay: .4s; }
@keyframes aria-think {
  0%,60%,100% { transform: scale(.7); opacity:.4; }
  30%         { transform: scale(1); opacity:1; }
}

/* ── ARIA INPUT ───────────────────────────────────────────── */
#aria-input-zone {
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(255,255,255,.06);
}
#aria-input-row {
  display: flex; gap: 10px; align-items: center;
}
#aria-input {
  flex: 1;
  background: rgba(255,255,255,.06) !important;
  border: 1px solid rgba(255,255,255,.1) !important;
  border-radius: 12px !important;
  color: #fff !important;
  font-family: 'Inter', -apple-system, sans-serif !important;
  font-size: 14px !important;
  padding: 11px 16px !important;
  outline: none !important;
  transition: border-color .15s, box-shadow .15s !important;
  width: auto !important;
}
#aria-input:focus {
  border-color: rgba(255,59,48,.5) !important;
  box-shadow: 0 0 0 3px rgba(255,59,48,.12) !important;
}
#aria-input::placeholder { color: rgba(255,255,255,.25) !important; }

#aria-mic {
  width: 42px; height: 42px; border-radius: 50%;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  color: rgba(255,255,255,.6); font-size: 16px;
  cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
#aria-mic:hover { background: rgba(255,59,48,.2); border-color: rgba(255,59,48,.4); color: #ff3b30; }
#aria-mic.listening {
  background: rgba(255,59,48,.25) !important;
  border-color: #ff3b30 !important;
  color: #ff3b30 !important;
  animation: aria-listen 1s ease-in-out infinite;
}
@keyframes aria-listen {
  0%,100% { box-shadow: 0 0 0 0 rgba(255,59,48,.4); }
  50%     { box-shadow: 0 0 0 8px rgba(255,59,48,0); }
}

#aria-send {
  width: 42px; height: 42px; border-radius: 50%;
  background: linear-gradient(135deg, #ff3b30, #c0392b);
  border: none; color: #fff; font-size: 16px;
  cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(255,59,48,.4);
  flex-shrink: 0;
}
#aria-send:hover { box-shadow: 0 6px 20px rgba(255,59,48,.55); transform: scale(1.05); }
#aria-send:active { transform: scale(.95); }

#aria-shortcuts {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;
}
.aria-shortcut {
  padding: 4px 10px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 6px; font-size: 11px;
  color: rgba(255,255,255,.4); cursor: pointer;
  transition: all .13s; font-weight: 500;
}
.aria-shortcut:hover { background: rgba(255,59,48,.1); border-color: rgba(255,59,48,.25); color: rgba(255,59,48,.9); }
.aria-shortcut kbd {
  font-family: 'SF Mono', monospace;
  background: rgba(255,255,255,.08);
  padding: 1px 5px; border-radius: 4px;
  font-size: 10px; margin-right: 4px;
}

/* ── BOUTON FLOTTANT ARIA ─────────────────────────────────── */
#aria-fab {
  position: fixed; bottom: 24px; right: 24px;
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #ff3b30, #c0392b);
  border: none; color: #fff; font-size: 22px;
  cursor: pointer; z-index: 9000;
  box-shadow: 0 6px 20px rgba(255,59,48,.5), 0 2px 8px rgba(0,0,0,.3);
  transition: all .2s cubic-bezier(.22,1,.36,1);
  display: flex; align-items: center; justify-content: center;
}
#aria-fab:hover { transform: scale(1.1); box-shadow: 0 10px 28px rgba(255,59,48,.6); }
#aria-fab:active { transform: scale(.95); }
#aria-fab .aria-fab-badge {
  position: absolute; top: -2px; right: -2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #30d158;
  border: 2px solid #000;
  font-size: 8px; display: flex; align-items: center; justify-content: center;
  font-weight: 800; color: #000;
}
.aria-fab-tooltip {
  position: absolute; right: 68px; bottom: 14px;
  background: rgba(20,20,22,.95);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,.8);
  white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .2s;
}
#aria-fab:hover .aria-fab-tooltip { opacity: 1; }

/* ── WORKFLOW BAR ─────────────────────────────────────────── */
#aria-workflow-bar {
  display: none; /* activé par showWorkflow() */
  padding: 0 20px 16px;
  border-top: 1px solid rgba(255,255,255,.06);
}
#aria-workflow-title {
  font-size: 10px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: rgba(255,255,255,.35);
  margin-bottom: 10px; padding-top: 12px;
}
#aria-workflow-steps {
  display: flex; align-items: center; gap: 0;
}
.aria-step {
  display: flex; flex-direction: column; align-items: center;
  gap: 5px; flex: 1; position: relative; cursor: pointer;
}
.aria-step-circle {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; border: 2px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); color: rgba(255,255,255,.3);
  transition: all .25s; z-index: 1; position: relative;
}
.aria-step.done .aria-step-circle {
  background: rgba(48,209,88,.2); border-color: #30d158;
  color: #30d158; box-shadow: 0 0 8px rgba(48,209,88,.3);
}
.aria-step.active .aria-step-circle {
  background: rgba(255,59,48,.2); border-color: #ff3b30;
  color: #ff3b30; box-shadow: 0 0 8px rgba(255,59,48,.4);
  animation: aria-step-pulse 2s ease-in-out infinite;
}
.aria-step.qualirepar.done .aria-step-circle {
  background: rgba(255,214,10,.2); border-color: #ffd60a;
  color: #ffd60a; box-shadow: 0 0 8px rgba(255,214,10,.35);
}
@keyframes aria-step-pulse {
  0%,100% { box-shadow: 0 0 6px rgba(255,59,48,.35); }
  50%     { box-shadow: 0 0 14px rgba(255,59,48,.6); }
}
.aria-step-label {
  font-size: 9px; font-weight: 600; letter-spacing: .04em;
  color: rgba(255,255,255,.3); text-align: center; line-height: 1.3;
}
.aria-step.done .aria-step-label { color: rgba(48,209,88,.8); }
.aria-step.active .aria-step-label { color: rgba(255,59,48,.9); }
.aria-step-connector {
  flex: 1; height: 2px;
  background: rgba(255,255,255,.07);
  margin-bottom: 18px; position: relative;
  overflow: hidden;
}
.aria-step-connector.done {
  background: rgba(48,209,88,.4);
}
.aria-step-connector::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,59,48,.6), transparent);
  animation: aria-connector-scan 2s linear infinite;
  opacity: 0;
}
.aria-step-connector.active::after { opacity: 1; }
@keyframes aria-connector-scan {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
.aria-step-badge {
  position: absolute; top: -6px; right: -6px;
  font-size: 8px; font-weight: 800; color: #000;
  background: #ffd60a; border-radius: 10px;
  padding: 1px 4px; min-width: 18px; text-align: center;
}

/* ── SHORTCUT HINT ────────────────────────────────────────── */
#aria-cmd-hint {
  position: fixed; bottom: 90px; right: 24px;
  background: rgba(20,20,22,.9);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px; padding: 8px 14px;
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,.5);
  display: flex; align-items: center; gap: 8px;
  pointer-events: none; z-index: 8990;
  animation: aria-hint-in .4s ease both;
}
@keyframes aria-hint-in {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:none; }
}
#aria-cmd-hint kbd {
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
  border-radius: 5px; padding: 2px 6px;
  font-family: 'SF Mono', monospace; font-size: 10px;
}

/* ── ARIA SETUP (si pas de clé API) ──────────────────────── */
#aria-setup-banner {
  margin: 12px 20px;
  background: rgba(255,214,10,.08);
  border: 1px solid rgba(255,214,10,.2);
  border-radius: 10px; padding: 12px 14px;
  display: flex; align-items: center; gap: 12px;
}
#aria-setup-banner input {
  flex: 1; background: rgba(255,255,255,.08) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
  border-radius: 8px !important; color: #fff !important;
  font-size: 12px !important; padding: 7px 10px !important;
  outline: none !important; width: auto !important;
}
#aria-setup-save {
  padding: 7px 14px;
  background: linear-gradient(135deg, #ff3b30, #c0392b);
  border: none; border-radius: 8px;
  color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer;
}
`;
    document.head.appendChild(style);
  }

  /* ── INJECTION HTML ─────────────────────────────────────────────── */
  function injectHTML() {
    const html = `
<!-- ══ ARIA OVERLAY ══ -->
<div id="aria-overlay">
  <div id="aria-panel">

    <!-- Header -->
    <div id="aria-header">
      <div id="aria-logo">✦</div>
      <div id="aria-title-block">
        <div id="aria-title">ARIA · Solution Phone</div>
        <div id="aria-subtitle">Agent de Réparation Intelligent Automatisé</div>
      </div>
      <div id="aria-status">
        <div id="aria-status-dot"></div>
        <span id="aria-status-text">Prête</span>
      </div>
      <button id="aria-close" onclick="ARIA.close()">✕</button>
    </div>

    <!-- Setup (clé API manquante) -->
    <div id="aria-setup-banner" style="display:none;">
      <span style="font-size:16px;">⚙️</span>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:600;color:#ffd60a;margin-bottom:5px;">Clé API Claude requise</div>
        <input id="aria-api-key-input" type="password" placeholder="sk-ant-api03-..." />
      </div>
      <button id="aria-setup-save" onclick="ARIA.saveApiKey()">Enregistrer</button>
    </div>

    <!-- Conversation -->
    <div id="aria-conversation"></div>

    <!-- Workflow Bar (caché par défaut) -->
    <div id="aria-workflow-bar">
      <div id="aria-workflow-title">📍 Parcours client</div>
      <div id="aria-workflow-steps"></div>
    </div>

    <!-- Input -->
    <div id="aria-input-zone">
      <div id="aria-input-row">
        <input id="aria-input"
          placeholder="Ex : Quel est le CA d'hier ? · Facture pour Jean Dupont · Réparation #402 attente pièces"
          autocomplete="off" autocorrect="off" spellcheck="false" />
        <button id="aria-mic" onclick="ARIA.toggleVoice()" title="Commande vocale">🎤</button>
        <button id="aria-send" onclick="ARIA.send()" title="Envoyer">↑</button>
      </div>
      <div id="aria-shortcuts">
        <span class="aria-shortcut" onclick="ARIA.quickAsk('CA aujourd\'hui ?')"><kbd>⌘1</kbd>CA aujourd'hui</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('Combien de réparations en cours ?')"><kbd>⌘2</kbd>Réparations</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('QualiRépar en attente ?')"><kbd>⌘3</kbd>QualiRépar</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('Stock smartphones ?')"><kbd>⌘4</kbd>Stock</span>
        <span class="aria-shortcut" onclick="ARIA.showWorkflowDemo()">📍 Workflow</span>
      </div>
    </div>

  </div>
</div>

<!-- ══ BOUTON FLOTTANT ══ -->
<button id="aria-fab" onclick="ARIA.toggle()">
  ✦
  <div class="aria-fab-badge">AI</div>
  <div class="aria-fab-tooltip">ARIA · ⌘K</div>
</button>
`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  /* ══════════════════════════════════════════════════════════════════
     MOTEUR ARIA
  ══════════════════════════════════════════════════════════════════ */
  const ARIA = {

    /* ── OUVRIR / FERMER ──────────────────────────────────────────── */
    open() {
      STATE.isOpen = true;
      document.getElementById('aria-overlay').classList.add('open');
      setTimeout(() => document.getElementById('aria-input').focus(), 300);
      if (!STATE.history.length) this.welcome();
      this.checkApiKey();
    },

    close() {
      STATE.isOpen = false;
      document.getElementById('aria-overlay').classList.remove('open');
    },

    toggle() { STATE.isOpen ? this.close() : this.open(); },

    /* ── VÉRIF CLÉ API ────────────────────────────────────────────── */
    checkApiKey() {
      const key = getClaudeKey();
      const banner = document.getElementById('aria-setup-banner');
      if (!key) {
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    },

    saveApiKey() {
      const val = document.getElementById('aria-api-key-input').value.trim();
      if (!val) return;
      try {
        const keys = JSON.parse(localStorage.getItem('sp_params_keys') || '{}');
        keys.claude_key = val;
        localStorage.setItem('sp_params_keys', JSON.stringify(keys));
      } catch { localStorage.setItem('sp_params_keys', JSON.stringify({ claude_key: val })); }
      document.getElementById('aria-setup-banner').style.display = 'none';
      this.addMessage('agent', '✅ Clé API enregistrée ! Je suis opérationnelle.');
    },

    /* ── MESSAGES ────────────────────────────────────────────────── */
    welcome() {
      const now = new Date();
      const h = now.getHours();
      const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
      this.addMessage('agent', `${greeting} Patron ! Je suis **ARIA**, votre assistant IA. Posez-moi n'importe quelle question sur vos données, ou donnez-moi un ordre — je m'occupe du reste.`, [
        'CA d\'aujourd\'hui ?',
        'Réparations en cours ?',
        'QualiRépar en attente ?',
      ]);
    },

    addMessage(role, text, suggestions = []) {
      const conv = document.getElementById('aria-conversation');
      const div = document.createElement('div');
      div.className = `aria-msg ${role}`;

      const avatar = `<div class="aria-avatar">${role === 'agent' ? '✦' : '👤'}</div>`;

      // Parse **bold** markdown
      const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      let html = `<div class="aria-bubble">${formatted}`;

      if (suggestions.length) {
        html += `<div class="aria-suggestions">${suggestions.map(s =>
          `<span class="aria-suggestion" onclick="ARIA.quickAsk('${s.replace(/'/g, "\\'")}')">${s}</span>`
        ).join('')}</div>`;
      }
      html += '</div>';

      div.innerHTML = role === 'agent' ? avatar + html : html + avatar;
      conv.appendChild(div);
      conv.scrollTop = conv.scrollHeight;
      STATE.history.push({ role, text });
    },

    addThinking() {
      const conv = document.getElementById('aria-conversation');
      const div = document.createElement('div');
      div.className = 'aria-msg agent'; div.id = 'aria-thinking-msg';
      div.innerHTML = `<div class="aria-avatar">✦</div><div class="aria-thinking"><span></span><span></span><span></span></div>`;
      conv.appendChild(div);
      conv.scrollTop = conv.scrollHeight;
    },

    removeThinking() {
      const el = document.getElementById('aria-thinking-msg');
      if (el) el.remove();
    },

    addDataCard(data) {
      const conv = document.getElementById('aria-conversation');
      const lastMsg = conv.querySelector('.aria-msg.agent:last-child .aria-bubble');
      if (!lastMsg) return;
      const card = document.createElement('div');
      card.className = 'aria-data-card';
      card.innerHTML = data.map(([label, value, isAmount]) =>
        `<div class="aria-data-row">
          <span class="aria-data-label">${label}</span>
          <span class="aria-data-value ${isAmount ? 'amount' : ''}">${value}</span>
        </div>`
      ).join('');
      lastMsg.appendChild(card);
    },

    /* ── ENVOI REQUÊTE ───────────────────────────────────────────── */
    async send() {
      const input = document.getElementById('aria-input');
      const query = input.value.trim();
      if (!query || STATE.isThinking) return;
      input.value = '';
      this.addMessage('user', query);
      await this.process(query);
    },

    quickAsk(q) {
      document.getElementById('aria-input').value = q;
      this.send();
    },

    /* ── TRAITEMENT REQUÊTE ──────────────────────────────────────── */
    async process(query) {
      STATE.isThinking = true;
      this.setStatus('Analyse...', true);
      this.addThinking();

      try {
        // 1. Détecter l'intention via Claude
        const intent = await this.detectIntent(query);

        // 2. Exécuter l'action
        await this.executeIntent(intent, query);

      } catch (err) {
        this.removeThinking();
        this.addMessage('agent', `❌ Erreur : ${err.message}. Vérifiez votre clé API dans les paramètres.`);
      } finally {
        STATE.isThinking = false;
        this.setStatus('Prête');
      }
    },

    /* ── DÉTECTION INTENTION (Claude API) ───────────────────────── */
    async detectIntent(query) {
      const apiKey = getClaudeKey();
      if (!apiKey) {
        return { intent: 'error', response: 'Clé API manquante. Configurez-la dans le bandeau ci-dessus.' };
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 600,
          system: ARIA_SYSTEM,
          messages: [{ role: 'user', content: query }],
        }),
      });

      if (!res.ok) throw new Error(`API Claude ${res.status}`);
      const data = await res.json();
      const raw = data.content?.[0]?.text || '{}';
      try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}'); }
      catch { return { intent: 'info', response: raw.substring(0, 200) }; }
    },

    /* ── EXÉCUTION INTENTION ─────────────────────────────────────── */
    async executeIntent(intent, originalQuery) {
      this.removeThinking();

      if (!intent || intent.intent === 'error') {
        this.addMessage('agent', intent?.response || 'Je n\'ai pas compris. Reformulez ?');
        return;
      }

      const dn = intent.data_needed || {};

      /* ── REQUÊTE DONNÉES ────────────────────────────────────────── */
      if (intent.intent === 'query' && dn.table) {
        this.addMessage('agent', intent.response || 'Voici les données :');
        try {
          const rows = await supaQuery(dn.table, dn.filter || '?select=*&limit=10&order=created_at.desc');
          if (!rows || !rows.length) {
            this.addDataCard([['Résultat', 'Aucune donnée trouvée', false]]);
          } else {
            // Analyser et formater selon le type de table
            this.formatQueryResult(dn.table, rows, intent);
          }
        } catch (e) {
          this.addDataCard([['Erreur', 'Impossible d\'accéder à Supabase', false]]);
        }
        return;
      }

      /* ── NAVIGATION ─────────────────────────────────────────────── */
      if (intent.intent === 'navigate') {
        this.addMessage('agent', intent.response || 'Navigation en cours...');
        const page = dn.params?.page || dn.action?.replace('navigate_', '');
        if (page && typeof showPage === 'function') {
          setTimeout(() => {
            this.close();
            showPage(page, document.querySelector(`[onclick*="${page}"]`));
          }, 600);
        }
        return;
      }

      /* ── MISE À JOUR BDD ─────────────────────────────────────────── */
      if (intent.intent === 'action' && dn.action === 'update') {
        this.addMessage('agent', intent.response || 'Mise à jour en cours...');
        try {
          const result = await supaPatch(
            dn.table,
            dn.params?.data || {},
            dn.filter || ''
          );
          this.addMessage('agent', `✅ Mis à jour avec succès !`);
          // Refresh si la fonction existe
          if (typeof renderDashboard === 'function') renderDashboard();
        } catch (e) {
          this.addMessage('agent', `❌ Erreur de mise à jour : ${e.message}`);
        }
        return;
      }

      /* ── WORKFLOW ─────────────────────────────────────────────── */
      if (intent.intent === 'workflow') {
        this.addMessage('agent', intent.response || 'Affichage du workflow...');
        this.showWorkflowDemo();
        return;
      }

      /* ── RÉPONSE SIMPLE ─────────────────────────────────────────── */
      this.addMessage('agent', intent.response || 'Commande reçue.', intent.suggestions || []);
    },

    /* ── FORMATAGE RÉSULTATS ─────────────────────────────────────── */
    formatQueryResult(table, rows, intent) {
      if (table === 'caisse') {
        const total = rows.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);
        const nb = rows.length;
        this.addDataCard([
          ['Nombre d\'enregistrements', nb, false],
          ['Total encaissé', `${total.toFixed(2)} €`, true],
          ['Dernier enregistrement', rows[0]?.date || rows[0]?.created_at?.slice(0,10) || '-', false],
        ]);
      } else if (table === 'bons_depot') {
        const parStatut = {};
        rows.forEach(r => { parStatut[r.statut || 'inconnu'] = (parStatut[r.statut || 'inconnu'] || 0) + 1; });
        const cards = Object.entries(parStatut).map(([s, n]) => [s, `${n} réparation(s)`, false]);
        const total = rows.reduce((s, r) => s + (parseFloat(r.prix) || 0), 0);
        cards.push(['Total facturé', `${total.toFixed(2)} €`, true]);
        this.addDataCard(cards);
      } else if (table === 'phones') {
        const total = rows.reduce((s, r) => s + (parseFloat(r.prix_achat) || 0), 0);
        this.addDataCard([
          ['Téléphones en stock', rows.length, false],
          ['Valeur totale achat', `${total.toFixed(2)} €`, true],
        ]);
      } else {
        // Générique : afficher les 3 premiers champs des 5 premières lignes
        const keys = Object.keys(rows[0] || {}).slice(0, 3);
        const cards = rows.slice(0, 5).map(r =>
          [keys.map(k => r[k]).filter(Boolean).join(' · '), '', false]
        );
        this.addDataCard(cards.length ? cards : [['Résultats', rows.length, false]]);
      }
    },

    /* ── VOICE ───────────────────────────────────────────────────── */
    toggleVoice() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        this.addMessage('agent', '❌ La reconnaissance vocale n\'est pas disponible dans ce navigateur. Utilisez Chrome.');
        return;
      }

      if (STATE.isListening) {
        STATE.recognition?.stop();
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      STATE.recognition = new SpeechRecognition();
      STATE.recognition.lang = 'fr-FR';
      STATE.recognition.continuous = false;
      STATE.recognition.interimResults = true;

      const mic = document.getElementById('aria-mic');
      const input = document.getElementById('aria-input');

      STATE.recognition.onstart = () => {
        STATE.isListening = true;
        mic.classList.add('listening');
        this.setStatus('Écoute...', true);
        input.placeholder = '🎤 Je vous écoute...';
      };

      STATE.recognition.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        input.value = transcript;
      };

      STATE.recognition.onend = () => {
        STATE.isListening = false;
        mic.classList.remove('listening');
        this.setStatus('Prête');
        input.placeholder = 'Ex : Quel est le CA d\'hier ? · Facture pour Jean Dupont';
        if (input.value.trim()) this.send();
      };

      STATE.recognition.onerror = (e) => {
        STATE.isListening = false;
        mic.classList.remove('listening');
        this.setStatus('Prête');
        if (e.error !== 'no-speech') {
          this.addMessage('agent', `⚠️ Erreur micro : ${e.error}`);
        }
      };

      STATE.recognition.start();
    },

    /* ── STATUS ──────────────────────────────────────────────────── */
    setStatus(text, animate = false) {
      const el = document.getElementById('aria-status-text');
      const dot = document.getElementById('aria-status-dot');
      if (el) el.textContent = text;
      if (dot) {
        dot.style.background = animate ? '#ff3b30' : '#30d158';
        dot.style.boxShadow = animate
          ? '0 0 5px #ff3b30, 0 0 10px rgba(255,59,48,.4)'
          : '0 0 5px #30d158, 0 0 10px rgba(48,209,88,.4)';
      }
    },

    /* ── WORKFLOW BAR ────────────────────────────────────────────── */
    showWorkflowDemo(activeStep = 2) {
      const steps = [
        { id: 'accueil',      icon: '👤', label: 'Accueil',        done: true },
        { id: 'diagnostic',   icon: '🔍', label: 'Diagnostic',     done: true },
        { id: 'devis',        icon: '📝', label: 'Devis',          done: false, active: activeStep === 2 },
        { id: 'reparation',   icon: '🔧', label: 'Réparation',     done: false },
        { id: 'qualirepar',   icon: '✅', label: 'QualiRépar +25€', done: false, badge: '25€', special: 'qualirepar' },
        { id: 'restitution',  icon: '🎉', label: 'Restitution',    done: false },
      ];

      const bar = document.getElementById('aria-workflow-bar');
      const stepsEl = document.getElementById('aria-workflow-steps');

      stepsEl.innerHTML = steps.map((s, i) => {
        const isActive = !s.done && (i === activeStep || s.active);
        const classes = `aria-step${s.done ? ' done' : ''}${isActive ? ' active' : ''}${s.special ? ` ${s.special}` : ''}`;
        const badge = s.badge ? `<div class="aria-step-badge">${s.badge}</div>` : '';
        const connector = i < steps.length - 1
          ? `<div class="aria-step-connector${s.done ? ' done' : ''}${isActive ? ' active' : ''}"></div>`
          : '';
        return `
          <div class="${classes}">
            <div class="aria-step-circle">${s.icon}${badge}</div>
            <div class="aria-step-label">${s.label}</div>
          </div>
          ${connector}`;
      }).join('');

      bar.style.display = 'block';
    },

    showWorkflow(clientData) {
      const stepMap = {
        'en_attente': 1, 'diagnostic': 1, 'en_cours': 3,
        'attente_pieces': 3, 'pret': 4, 'rendu': 5
      };
      const step = stepMap[clientData?.statut] || 2;
      this.showWorkflowDemo(step);
      this.addMessage('agent',
        `📍 Workflow de ${clientData?.client_nom || 'ce client'} — étape **${['Accueil','Diagnostic','Devis','Réparation','QualiRépar','Restitution'][step]}**`,
        step < 4 ? ['Passer à l\'étape suivante ?'] : []
      );
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     INITIALISATION
  ══════════════════════════════════════════════════════════════════ */
  function init() {
    injectStyles();
    injectHTML();

    // Exposer ARIA globalement
    window.ARIA = ARIA;

    // Raccourci Cmd+K / Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        ARIA.toggle();
      }
      if (e.key === 'Escape' && STATE.isOpen) ARIA.close();
    });

    // Enter dans l'input
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement?.id === 'aria-input') {
        ARIA.send();
      }
    });

    // Fermer en cliquant sur l'overlay
    document.getElementById('aria-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'aria-overlay') ARIA.close();
    });

    // Hint CMD+K (disparaît après 5s)
    const hint = document.createElement('div');
    hint.id = 'aria-cmd-hint';
    hint.innerHTML = '<kbd>⌘K</kbd> ou <kbd>Ctrl+K</kbd> pour ouvrir ARIA';
    document.body.appendChild(hint);
    setTimeout(() => hint.style.opacity = '0', 4000);
    setTimeout(() => hint.remove(), 4500);

    console.info(`%c ARIA v${ARIA_VERSION} %c initialisée · ⌘K pour ouvrir`, 'background:#ff3b30;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px;', 'color:#ff3b30;');
  }

  // Attendre le DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
