/* ═══════════════════════════════════════════════════════════════════
   SOLUTION PHONE · ARIA v2.0  — Optimisé Claude Haiku
   Agent de Réparation Intelligent Automatisé
   ─────────────────────────────────────────────────────────────────
   • Cmd+K → ouvre le panneau ARIA
   • Bouton micro flottant → commande vocale (Web Speech API)
   • Natural Language → Supabase (Claude Haiku — coût ÷10)
   • Design Neumorphique 3D Blanc style Apple
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────────────── */
  const ARIA_VERSION = '2.0.0';
  const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001'; // ← Haiku : coût ÷10, latence ÷3

  function getClaudeKey() {
    try { return JSON.parse(localStorage.getItem('sp_params_keys') || '{}').claude_key || ''; }
    catch { return ''; }
  }

  /* ── SUPABASE HELPERS ───────────────────────────────────────────── */
  async function supaQuery(table, params = '') {
    if (typeof supaFetch === 'function') return supaFetch(table, 'GET', null, params);
    const r = await fetch('/api/supabase?table=' + encodeURIComponent(table) + (params ? '&query=' + encodeURIComponent(params) : ''));
    return r.json();
  }

  async function supaPatch(table, data, params = '') {
    if (typeof supaFetch === 'function') return supaFetch(table, 'PATCH', data, params);
    const r = await fetch('/api/supabase?table=' + encodeURIComponent(table) + (params ? '&query=' + encodeURIComponent(params) : ''), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(data)
    });
    return r.json();
  }

  /* ── SYSTEM PROMPT ULTRA-COURT (économie tokens Haiku) ─────────── */
  // Règle Haiku : prompt court = réponse rapide + facture mini
  const ARIA_SYSTEM = `Assistant boutique smartphone (Solution Phone, Mâcon). Réponds UNIQUEMENT en JSON strict :
{"intent":"query|action|navigate|workflow|info|error","confidence":0.9,"response":"1-2 phrases FR max","data_needed":{"table":"","filter":"","action":"","params":{}},"suggestions":["..."]}
Tables : caisse(date,montant,type), bons_depot(id,client_nom,client_tel,appareil,panne,statut,prix,created_at), phones(prix_achat,mode_vente), factures, roulette_participations.
Statuts réparations : en_attente|en_cours|attente_pieces|pret|rendu. QualiRépar = bonus 25€ fixe.
Sois concis. Zéro texte hors du JSON.`;

  /* ── ÉTAT ────────────────────────────────────────────────────────── */
  const STATE = { isOpen:false, isListening:false, isThinking:false, history:[], recognition:null };

  /* ══════════════════════════════════════════════════════════════════
     CSS — NEUMORPHISME 3D BLANC APPLE
  ══════════════════════════════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'aria-styles';
    s.textContent = `
/* ── VARIABLES ────────────────────────────────────────────── */
:root {
  --aria-bg:      #e8eaf0;
  --aria-surface: #eef0f5;
  --aria-light:   #ffffff;
  --aria-shadow-dark:  rgba(163,177,198,0.7);
  --aria-shadow-light: rgba(255,255,255,0.95);
  --aria-red:     #ff3b30;
  --aria-red-dk:  #c0392b;
  --aria-green:   #30d158;
  --aria-text:    #1c1c1e;
  --aria-text-2:  #48484a;
  --aria-text-3:  #8e8e93;
  --aria-yellow:  #ffd60a;
  /* Neumorphisme — élévation standard */
  --nm-raised:
    6px 6px 14px var(--aria-shadow-dark),
   -6px -6px 14px var(--aria-shadow-light);
  /* Neumorphisme — creux (input, zones enfoncées) */
  --nm-inset:
    inset 4px 4px 8px var(--aria-shadow-dark),
    inset -4px -4px 8px var(--aria-shadow-light);
  /* Neumorphisme — léger (cartes internes) */
  --nm-card:
    3px 3px 8px var(--aria-shadow-dark),
   -3px -3px 8px var(--aria-shadow-light);
}

/* ── OVERLAY ──────────────────────────────────────────────── */
#aria-overlay {
  position:fixed; inset:0; z-index:10000;
  background:rgba(0,0,0,0); pointer-events:none;
  transition:background .3s ease;
  display:flex; align-items:flex-start; justify-content:center;
  padding-top:72px;
}
#aria-overlay.open {
  background:rgba(60,60,80,.18);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  pointer-events:all;
}

/* ── PANNEAU PRINCIPAL ────────────────────────────────────── */
#aria-panel {
  width:680px; max-width:95vw;
  background:var(--aria-surface);
  border-radius:24px;
  box-shadow:
    12px 12px 28px var(--aria-shadow-dark),
    -12px -12px 28px var(--aria-shadow-light),
    0 0 0 1px rgba(255,255,255,.6);
  overflow:hidden;
  transform:translateY(-24px) scale(0.97);
  opacity:0;
  transition:transform .32s cubic-bezier(.22,1,.36,1), opacity .28s ease;
}
#aria-overlay.open #aria-panel { transform:none; opacity:1; }

/* Liseré rouge signature en haut */
#aria-panel::before {
  content:'';
  display:block; height:3px;
  background:linear-gradient(90deg, transparent, var(--aria-red) 40%, var(--aria-red-dk) 60%, transparent);
  border-radius:24px 24px 0 0;
}

/* ── HEADER ───────────────────────────────────────────────── */
#aria-header {
  display:flex; align-items:center; gap:12px;
  padding:14px 20px 12px;
  border-bottom:1px solid rgba(163,177,198,.25);
}
#aria-logo {
  width:38px; height:38px; border-radius:12px;
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  display:flex; align-items:center; justify-content:center;
  font-size:18px; color:#fff; flex-shrink:0;
  box-shadow:
    4px 4px 10px rgba(192,57,43,.4),
    -2px -2px 6px rgba(255,255,255,.6);
}
#aria-title-block { flex:1; }
#aria-title {
  font-family:'Inter',-apple-system,sans-serif;
  font-size:15px; font-weight:700; color:var(--aria-text);
  letter-spacing:-.02em;
}
#aria-subtitle {
  font-size:11px; color:var(--aria-text-3); font-weight:400; margin-top:1px;
}
#aria-status {
  display:flex; align-items:center; gap:6px;
  font-size:11px; color:var(--aria-text-3); font-weight:500;
}
#aria-status-dot {
  width:7px; height:7px; border-radius:50%;
  background:var(--aria-green);
  box-shadow:0 0 5px var(--aria-green);
  animation:aria-pulse 2.5s ease-in-out infinite;
}
@keyframes aria-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }
#aria-close {
  width:28px; height:28px; border-radius:50%;
  background:var(--aria-surface); border:none;
  color:var(--aria-text-3); font-size:13px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  box-shadow:var(--nm-raised);
  transition:all .15s;
}
#aria-close:hover { color:var(--aria-red); box-shadow:var(--nm-inset); }

/* ── CONVERSATION ─────────────────────────────────────────── */
#aria-conversation {
  max-height:320px; overflow-y:auto;
  padding:14px 20px;
  display:flex; flex-direction:column; gap:10px;
  scroll-behavior:smooth;
}
#aria-conversation::-webkit-scrollbar { width:3px; }
#aria-conversation::-webkit-scrollbar-thumb {
  background:rgba(163,177,198,.5); border-radius:2px;
}

.aria-msg {
  display:flex; gap:10px; align-items:flex-start;
  animation:aria-msg-in .25s cubic-bezier(.22,1,.36,1) both;
}
@keyframes aria-msg-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
.aria-msg.user { flex-direction:row-reverse; }

.aria-avatar {
  width:30px; height:30px; border-radius:50%; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:14px;
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  color:#fff;
  box-shadow:3px 3px 7px rgba(192,57,43,.35), -2px -2px 5px rgba(255,255,255,.7);
}
.aria-msg.user .aria-avatar {
  background:var(--aria-surface);
  color:var(--aria-text-2);
  box-shadow:var(--nm-card);
}

.aria-bubble {
  max-width:500px; padding:10px 14px; border-radius:16px;
  font-family:'Inter',-apple-system,sans-serif;
  font-size:14px; line-height:1.55;
}
.aria-msg.agent .aria-bubble {
  background:var(--aria-surface);
  color:var(--aria-text);
  border-radius:16px 16px 16px 4px;
  box-shadow:var(--nm-card);
}
.aria-msg.user .aria-bubble {
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  color:#fff;
  border-radius:16px 16px 4px 16px;
  box-shadow:4px 4px 10px rgba(192,57,43,.35), -2px -2px 6px rgba(255,255,255,.6);
}

/* ── DATA CARD ────────────────────────────────────────────── */
.aria-data-card {
  margin-top:8px;
  background:var(--aria-surface);
  border-radius:12px; padding:10px 12px;
  box-shadow:var(--nm-inset);
}
.aria-data-row {
  display:flex; justify-content:space-between; align-items:center;
  padding:5px 0; border-bottom:1px solid rgba(163,177,198,.2);
  font-size:13px;
}
.aria-data-row:last-child { border:none; }
.aria-data-label { color:var(--aria-text-3); }
.aria-data-value { color:var(--aria-text); font-weight:600; }
.aria-data-value.amount { color:var(--aria-red); }

/* ── SUGGESTIONS ──────────────────────────────────────────── */
.aria-suggestions { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
.aria-suggestion {
  padding:5px 12px;
  background:var(--aria-surface); border:none; border-radius:20px;
  font-size:12px; font-weight:500; color:var(--aria-text-2);
  cursor:pointer; transition:all .14s;
  box-shadow:var(--nm-raised);
}
.aria-suggestion:hover {
  color:var(--aria-red);
  box-shadow:var(--nm-inset);
}

/* ── THINKING ─────────────────────────────────────────────── */
.aria-thinking {
  display:flex; gap:5px; align-items:center;
  padding:10px 14px; border-radius:16px;
  box-shadow:var(--nm-card); background:var(--aria-surface);
  width:fit-content;
}
.aria-thinking span {
  width:6px; height:6px; border-radius:50%;
  background:var(--aria-red);
  animation:aria-think .9s ease-in-out infinite;
}
.aria-thinking span:nth-child(2){animation-delay:.2s}
.aria-thinking span:nth-child(3){animation-delay:.4s}
@keyframes aria-think {
  0%,60%,100%{transform:scale(.6);opacity:.3}
  30%{transform:scale(1.1);opacity:1}
}

/* ── INPUT ZONE ───────────────────────────────────────────── */
#aria-input-zone {
  padding:12px 20px 16px;
  border-top:1px solid rgba(163,177,198,.2);
  background:var(--aria-bg);
}
#aria-input-row { display:flex; gap:10px; align-items:center; }
#aria-input {
  flex:1;
  background:var(--aria-bg) !important;
  border:none !important; outline:none !important;
  border-radius:14px !important;
  color:var(--aria-text) !important;
  font-family:'Inter',-apple-system,sans-serif !important;
  font-size:14px !important;
  padding:12px 16px !important;
  box-shadow:var(--nm-inset) !important;
  transition:box-shadow .18s !important;
  width:auto !important;
}
#aria-input:focus {
  box-shadow:
    inset 4px 4px 8px var(--aria-shadow-dark),
    inset -4px -4px 8px var(--aria-shadow-light),
    0 0 0 2px rgba(255,59,48,.25) !important;
}
#aria-input::placeholder { color:var(--aria-text-3) !important; }

/* Boutons ronds mic / send */
#aria-mic, #aria-send {
  width:44px; height:44px; border-radius:50%;
  border:none; cursor:pointer; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:17px; transition:all .15s;
}
#aria-mic {
  background:var(--aria-bg); color:var(--aria-text-3);
  box-shadow:var(--nm-raised);
}
#aria-mic:hover { color:var(--aria-red); }
#aria-mic:active { box-shadow:var(--nm-inset); }
#aria-mic.listening {
  color:var(--aria-red) !important;
  box-shadow:
    inset 3px 3px 7px var(--aria-shadow-dark),
    inset -3px -3px 7px var(--aria-shadow-light),
    0 0 0 0 rgba(255,59,48,.4) !important;
  animation:aria-listen 1s ease-in-out infinite;
}
@keyframes aria-listen {
  0%,100%{box-shadow:inset 3px 3px 7px var(--aria-shadow-dark),inset -3px -3px 7px var(--aria-shadow-light),0 0 0 0 rgba(255,59,48,.45)}
  50%{box-shadow:inset 3px 3px 7px var(--aria-shadow-dark),inset -3px -3px 7px var(--aria-shadow-light),0 0 0 9px rgba(255,59,48,0)}
}
#aria-send {
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  color:#fff;
  box-shadow:4px 4px 10px rgba(192,57,43,.4), -2px -2px 6px rgba(255,255,255,.7);
}
#aria-send:hover { box-shadow:6px 6px 14px rgba(192,57,43,.5), -2px -2px 6px rgba(255,255,255,.7); }
#aria-send:active { box-shadow:var(--nm-inset); transform:scale(.95); }

/* ── SHORTCUTS ────────────────────────────────────────────── */
#aria-shortcuts { display:flex; gap:7px; flex-wrap:wrap; margin-top:10px; }
.aria-shortcut {
  padding:4px 10px;
  background:var(--aria-bg); border:none; border-radius:7px;
  font-size:11px; font-weight:500; color:var(--aria-text-3);
  cursor:pointer; transition:all .13s;
  box-shadow:var(--nm-raised);
}
.aria-shortcut:hover { color:var(--aria-red); box-shadow:var(--nm-inset); }
.aria-shortcut kbd {
  font-family:'SF Mono',monospace;
  background:rgba(0,0,0,.06); padding:1px 5px;
  border-radius:4px; font-size:9px; margin-right:4px;
}

/* ── FAB FLOTTANT ─────────────────────────────────────────── */
#aria-fab {
  position:fixed; bottom:24px; right:24px;
  width:58px; height:58px; border-radius:50%;
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  border:none; color:#fff; font-size:22px;
  cursor:pointer; z-index:9000;
  display:flex; align-items:center; justify-content:center;
  box-shadow:
    6px 6px 16px rgba(192,57,43,.45),
    -4px -4px 10px rgba(255,255,255,.6);
  transition:all .2s cubic-bezier(.22,1,.36,1);
}
#aria-fab:hover {
  transform:scale(1.08);
  box-shadow:10px 10px 22px rgba(192,57,43,.5), -4px -4px 10px rgba(255,255,255,.6);
}
#aria-fab:active { transform:scale(.95); box-shadow:var(--nm-inset); }
.aria-fab-badge {
  position:absolute; top:-1px; right:-1px;
  width:17px; height:17px; border-radius:50%;
  background:var(--aria-green); border:2px solid var(--aria-bg);
  font-size:8px; font-weight:800; color:#fff;
  display:flex; align-items:center; justify-content:center;
}
.aria-fab-tooltip {
  position:absolute; right:70px; bottom:16px;
  background:var(--aria-surface);
  border-radius:10px; padding:6px 12px;
  font-size:12px; font-weight:500; color:var(--aria-text-2);
  white-space:nowrap; box-shadow:var(--nm-card);
  opacity:0; pointer-events:none; transition:opacity .2s;
}
#aria-fab:hover .aria-fab-tooltip { opacity:1; }

/* ── WORKFLOW BAR ─────────────────────────────────────────── */
#aria-workflow-bar {
  display:none;
  padding:0 20px 16px;
  border-top:1px solid rgba(163,177,198,.2);
  background:var(--aria-bg);
}
#aria-workflow-title {
  font-size:10px; font-weight:700; letter-spacing:.08em;
  text-transform:uppercase; color:var(--aria-text-3);
  padding-top:12px; margin-bottom:10px;
}
#aria-workflow-steps { display:flex; align-items:center; }
.aria-step {
  display:flex; flex-direction:column; align-items:center;
  gap:5px; flex:1; cursor:pointer;
}
.aria-step-circle {
  width:32px; height:32px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; transition:all .25s; position:relative;
  background:var(--aria-bg); color:var(--aria-text-3);
  box-shadow:var(--nm-card);
}
.aria-step.done .aria-step-circle {
  background:rgba(48,209,88,.12); color:var(--aria-green);
  box-shadow:3px 3px 8px rgba(163,177,198,.6), -3px -3px 8px rgba(255,255,255,.9), 0 0 0 2px rgba(48,209,88,.3);
}
.aria-step.active .aria-step-circle {
  background:rgba(255,59,48,.1); color:var(--aria-red);
  box-shadow:3px 3px 8px rgba(163,177,198,.6), -3px -3px 8px rgba(255,255,255,.9), 0 0 0 2px rgba(255,59,48,.35);
  animation:aria-step-pulse 2s ease-in-out infinite;
}
.aria-step.qualirepar.done .aria-step-circle {
  color:var(--aria-yellow);
  box-shadow:3px 3px 8px rgba(163,177,198,.6), -3px -3px 8px rgba(255,255,255,.9), 0 0 0 2px rgba(255,214,10,.4);
}
@keyframes aria-step-pulse {
  0%,100%{box-shadow:3px 3px 8px rgba(163,177,198,.6),-3px -3px 8px rgba(255,255,255,.9),0 0 0 2px rgba(255,59,48,.35)}
  50%{box-shadow:3px 3px 8px rgba(163,177,198,.6),-3px -3px 8px rgba(255,255,255,.9),0 0 0 4px rgba(255,59,48,.15)}
}
.aria-step-label {
  font-size:9px; font-weight:600; letter-spacing:.03em;
  color:var(--aria-text-3); text-align:center;
}
.aria-step.done .aria-step-label  { color:var(--aria-green); }
.aria-step.active .aria-step-label { color:var(--aria-red); }
.aria-step-connector {
  flex:1; height:2px; background:rgba(163,177,198,.25);
  margin-bottom:18px; overflow:hidden; position:relative;
}
.aria-step-connector.done { background:rgba(48,209,88,.35); }
.aria-step-connector::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,59,48,.5),transparent);
  animation:aria-scan 2s linear infinite; opacity:0;
}
.aria-step-connector.active::after { opacity:1; }
@keyframes aria-scan { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
.aria-step-badge {
  position:absolute; top:-5px; right:-5px;
  font-size:8px; font-weight:800; color:#000;
  background:var(--aria-yellow); border-radius:9px;
  padding:1px 4px; min-width:18px; text-align:center;
  box-shadow:1px 1px 3px rgba(0,0,0,.15);
}

/* ── SETUP BANNER ─────────────────────────────────────────── */
#aria-setup-banner {
  margin:10px 20px;
  background:rgba(255,214,10,.08);
  border-radius:12px; padding:12px 14px;
  display:flex; align-items:center; gap:12px;
  box-shadow:var(--nm-inset);
}
#aria-setup-banner input {
  flex:1; background:var(--aria-bg) !important;
  border:none !important; border-radius:8px !important;
  color:var(--aria-text) !important; font-size:12px !important;
  padding:7px 10px !important; outline:none !important;
  width:auto !important; box-shadow:var(--nm-inset) !important;
}
#aria-setup-save {
  padding:7px 14px;
  background:linear-gradient(145deg, var(--aria-red), var(--aria-red-dk));
  border:none; border-radius:8px; color:#fff;
  font-size:12px; font-weight:600; cursor:pointer;
  box-shadow:3px 3px 7px rgba(192,57,43,.35), -2px -2px 5px rgba(255,255,255,.7);
}

/* ── CMD HINT ─────────────────────────────────────────────── */
#aria-cmd-hint {
  position:fixed; bottom:90px; right:24px;
  background:var(--aria-surface); border-radius:10px;
  padding:8px 14px; font-size:12px; font-weight:500;
  color:var(--aria-text-3); display:flex; align-items:center; gap:8px;
  pointer-events:none; z-index:8990; box-shadow:var(--nm-card);
  animation:aria-hint-in .4s ease both;
  transition:opacity .4s;
}
@keyframes aria-hint-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
#aria-cmd-hint kbd {
  background:rgba(0,0,0,.06); border-radius:5px;
  padding:2px 6px; font-family:'SF Mono',monospace; font-size:10px;
}
`;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════════
     HTML
  ══════════════════════════════════════════════════════════════════ */
  function injectHTML() {
    document.body.insertAdjacentHTML('beforeend', `
<div id="aria-overlay">
  <div id="aria-panel">
    <div id="aria-header">
      <div id="aria-logo">✦</div>
      <div id="aria-title-block">
        <div id="aria-title">ARIA · Solution Phone</div>
        <div id="aria-subtitle">Agent de Réparation Intelligent — v${ARIA_VERSION} Haiku</div>
      </div>
      <div id="aria-status">
        <div id="aria-status-dot"></div>
        <span id="aria-status-text">Prête</span>
      </div>
      <button id="aria-close" onclick="ARIA.close()">✕</button>
    </div>

    <div id="aria-setup-banner" style="display:none;">
      <span style="font-size:16px;">⚙️</span>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:700;color:#b8860b;margin-bottom:5px;">Clé API Claude requise</div>
        <input id="aria-api-key-input" type="password" placeholder="sk-ant-api03-…" />
      </div>
      <button id="aria-setup-save" onclick="ARIA.saveApiKey()">Enregistrer</button>
    </div>

    <div id="aria-conversation"></div>

    <div id="aria-workflow-bar">
      <div id="aria-workflow-title">📍 Parcours client</div>
      <div id="aria-workflow-steps"></div>
    </div>

    <div id="aria-input-zone">
      <div id="aria-input-row">
        <input id="aria-input"
          placeholder="Ex : CA d'aujourd'hui ? · Réparation #402 · QualiRépar en attente ?"
          autocomplete="off" autocorrect="off" spellcheck="false" />
        <button id="aria-mic" onclick="ARIA.toggleVoice()" title="Commande vocale">🎤</button>
        <button id="aria-send" onclick="ARIA.send()" title="Envoyer">↑</button>
      </div>
      <div id="aria-shortcuts">
        <span class="aria-shortcut" onclick="ARIA.quickAsk('CA aujourd\\'hui ?')"><kbd>⌘1</kbd>CA</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('Réparations en cours ?')"><kbd>⌘2</kbd>Réparations</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('QualiRépar en attente ?')"><kbd>⌘3</kbd>QualiRépar</span>
        <span class="aria-shortcut" onclick="ARIA.quickAsk('Stock smartphones ?')"><kbd>⌘4</kbd>Stock</span>
        <span class="aria-shortcut" onclick="ARIA.showWorkflowDemo()">📍 Workflow</span>
      </div>
    </div>
  </div>
</div>

<button id="aria-fab" onclick="ARIA.toggle()">
  ✦
  <div class="aria-fab-badge">AI</div>
  <div class="aria-fab-tooltip">ARIA · ⌘K</div>
</button>
`);
  }

  /* ══════════════════════════════════════════════════════════════════
     MOTEUR ARIA
  ══════════════════════════════════════════════════════════════════ */
  const ARIA = {

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

    checkApiKey() {
      document.getElementById('aria-setup-banner').style.display =
        getClaudeKey() ? 'none' : 'flex';
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
      this.addMessage('agent', '✅ Clé API enregistrée — ARIA opérationnelle sur Haiku !');
    },

    /* ── MESSAGES ──────────────────────────────────────────────────── */
    welcome() {
      const h = new Date().getHours();
      const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
      this.addMessage('agent',
        `${greet} Patron ! Je suis **ARIA v2**, boostée Haiku — plus rapide, même puissance. Que puis-je faire pour vous ?`,
        ['CA d\'aujourd\'hui ?', 'Réparations en cours ?', 'QualiRépar en attente ?']
      );
    },

    addMessage(role, text, suggestions = []) {
      const conv = document.getElementById('aria-conversation');
      const div = document.createElement('div');
      div.className = `aria-msg ${role}`;
      const avatar = `<div class="aria-avatar">${role === 'agent' ? '✦' : '👤'}</div>`;
      const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      let html = `<div class="aria-bubble">${formatted}`;
      if (suggestions.length) {
        html += `<div class="aria-suggestions">${
          suggestions.map(s => `<span class="aria-suggestion" onclick="ARIA.quickAsk('${s.replace(/'/g,"\\'")}')">${s}</span>`).join('')
        }</div>`;
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
      div.innerHTML = '<div class="aria-avatar">✦</div><div class="aria-thinking"><span></span><span></span><span></span></div>';
      conv.appendChild(div);
      conv.scrollTop = conv.scrollHeight;
    },

    removeThinking() { document.getElementById('aria-thinking-msg')?.remove(); },

    addDataCard(data) {
      const last = document.querySelector('#aria-conversation .aria-msg.agent:last-child .aria-bubble');
      if (!last) return;
      const card = document.createElement('div');
      card.className = 'aria-data-card';
      card.innerHTML = data.map(([label, value, isAmount]) =>
        `<div class="aria-data-row">
          <span class="aria-data-label">${label}</span>
          <span class="aria-data-value${isAmount ? ' amount' : ''}">${value}</span>
        </div>`
      ).join('');
      last.appendChild(card);
    },

    /* ── ENVOI ─────────────────────────────────────────────────────── */
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

    /* ── TRAITEMENT ────────────────────────────────────────────────── */
    async process(query) {
      STATE.isThinking = true;
      this.setStatus('Analyse...', true);
      this.addThinking();
      try {
        const intent = await this.detectIntent(query);
        await this.executeIntent(intent);
      } catch (err) {
        this.removeThinking();
        this.addMessage('agent', `❌ ${err.message} — Vérifiez la clé API.`);
      } finally {
        STATE.isThinking = false;
        this.setStatus('Prête');
      }
    },

    /* ── CLAUDE HAIKU (coût min, latence min) ──────────────────────── */
    async detectIntent(query) {
      const apiKey = getClaudeKey();
      if (!apiKey) return { intent:'error', response:'Clé API manquante.' };

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 300,          // Haiku → réponses courtes, tokens réduits ÷2
          system: ARIA_SYSTEM,
          messages: [{ role:'user', content: query }],
        }),
      });

      if (!res.ok) throw new Error(`API Claude ${res.status}`);
      const data = await res.json();
      const raw = data.content?.[0]?.text || '{}';
      try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}'); }
      catch { return { intent:'info', response: raw.substring(0, 180) }; }
    },

    /* ── EXÉCUTION ─────────────────────────────────────────────────── */
    async executeIntent(intent) {
      this.removeThinking();
      if (!intent || intent.intent === 'error') {
        this.addMessage('agent', intent?.response || 'Reformulez votre question ?');
        return;
      }

      const dn = intent.data_needed || {};

      // REQUÊTE DONNÉES
      if (intent.intent === 'query' && dn.table) {
        this.addMessage('agent', intent.response || 'Voici les données :', intent.suggestions);
        try {
          const rows = await supaQuery(dn.table, dn.filter || '?select=*&limit=10&order=created_at.desc');
          if (!rows?.length) this.addDataCard([['Résultat', 'Aucune donnée', false]]);
          else this.formatQueryResult(dn.table, rows);
        } catch { this.addDataCard([['Erreur', 'Supabase inaccessible', false]]); }
        return;
      }

      // NAVIGATION
      if (intent.intent === 'navigate') {
        this.addMessage('agent', intent.response || 'Navigation…');
        const page = dn.params?.page || dn.action?.replace('navigate_', '');
        if (page && typeof showPage === 'function') {
          setTimeout(() => { this.close(); showPage(page, document.querySelector(`[onclick*="${page}"]`)); }, 600);
        }
        return;
      }

      // MISE À JOUR BDD
      if (intent.intent === 'action' && dn.action === 'update') {
        this.addMessage('agent', intent.response || 'Mise à jour…');
        try {
          await supaPatch(dn.table, dn.params?.data || {}, dn.filter || '');
          this.addMessage('agent', '✅ Mis à jour avec succès !');
          if (typeof renderDashboard === 'function') renderDashboard();
        } catch (e) { this.addMessage('agent', `❌ Erreur : ${e.message}`); }
        return;
      }

      // WORKFLOW
      if (intent.intent === 'workflow') {
        this.addMessage('agent', intent.response || 'Affichage du workflow…');
        this.showWorkflowDemo();
        return;
      }

      // RÉPONSE SIMPLE
      this.addMessage('agent', intent.response || 'Commande reçue.', intent.suggestions || []);
    },

    /* ── FORMATAGE RÉSULTATS SUPABASE ──────────────────────────────── */
    formatQueryResult(table, rows) {
      if (table === 'caisse') {
        const total = rows.reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);
        this.addDataCard([
          ['Enregistrements', rows.length, false],
          ['Total encaissé', `${total.toFixed(2)} €`, true],
          ['Dernier', rows[0]?.date || rows[0]?.created_at?.slice(0,10) || '—', false],
        ]);
      } else if (table === 'bons_depot') {
        const byStatut = rows.reduce((acc, r) => {
          acc[r.statut || 'inconnu'] = (acc[r.statut || 'inconnu'] || 0) + 1; return acc;
        }, {});
        const total = rows.reduce((s, r) => s + (parseFloat(r.prix) || 0), 0);
        const cards = Object.entries(byStatut).map(([s, n]) => [s, `${n} répar.`, false]);
        cards.push(['Total facturé', `${total.toFixed(2)} €`, true]);
        this.addDataCard(cards);
      } else if (table === 'phones') {
        const total = rows.reduce((s, r) => s + (parseFloat(r.prix_achat) || 0), 0);
        this.addDataCard([
          ['En stock', rows.length, false],
          ['Valeur achat', `${total.toFixed(2)} €`, true],
        ]);
      } else {
        const keys = Object.keys(rows[0] || {}).slice(0, 3);
        this.addDataCard(
          rows.slice(0, 5).map(r => [keys.map(k => r[k]).filter(Boolean).join(' · '), '', false])
        );
      }
    },

    /* ── VOICE ─────────────────────────────────────────────────────── */
    toggleVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        this.addMessage('agent', '❌ Reconnaissance vocale indisponible — utilisez Chrome.');
        return;
      }
      if (STATE.isListening) { STATE.recognition?.stop(); return; }

      const mic = document.getElementById('aria-mic');
      const input = document.getElementById('aria-input');
      STATE.recognition = new SR();
      Object.assign(STATE.recognition, { lang:'fr-FR', continuous:false, interimResults:true });

      STATE.recognition.onstart = () => {
        STATE.isListening = true;
        mic.classList.add('listening');
        this.setStatus('Écoute…', true);
        input.placeholder = '🎤 Je vous écoute…';
      };
      STATE.recognition.onresult = (e) => {
        input.value = Array.from(e.results).map(r => r[0].transcript).join('');
      };
      STATE.recognition.onend = () => {
        STATE.isListening = false;
        mic.classList.remove('listening');
        this.setStatus('Prête');
        input.placeholder = 'Ex : CA d\'aujourd\'hui ? · QualiRépar en attente ?';
        if (input.value.trim()) this.send();
      };
      STATE.recognition.onerror = (e) => {
        STATE.isListening = false;
        mic.classList.remove('listening');
        this.setStatus('Prête');
        if (e.error !== 'no-speech') this.addMessage('agent', `⚠️ Erreur micro : ${e.error}`);
      };
      STATE.recognition.start();
    },

    /* ── STATUS ────────────────────────────────────────────────────── */
    setStatus(text, active = false) {
      const el = document.getElementById('aria-status-text');
      const dot = document.getElementById('aria-status-dot');
      if (el) el.textContent = text;
      if (dot) {
        dot.style.background = active ? 'var(--aria-red)' : 'var(--aria-green)';
        dot.style.boxShadow  = active
          ? '0 0 5px var(--aria-red)'
          : '0 0 5px var(--aria-green)';
      }
    },

    /* ── WORKFLOW ──────────────────────────────────────────────────── */
    showWorkflowDemo(activeStep = 2) {
      const STEPS = [
        { icon:'👤', label:'Accueil',         done:true },
        { icon:'🔍', label:'Diagnostic',      done:true },
        { icon:'📝', label:'Devis',           done:false },
        { icon:'🔧', label:'Réparation',      done:false },
        { icon:'✅', label:'QualiRépar +25€', done:false, badge:'25€', special:'qualirepar' },
        { icon:'🎉', label:'Restitution',     done:false },
      ];
      const bar   = document.getElementById('aria-workflow-bar');
      const steps = document.getElementById('aria-workflow-steps');
      steps.innerHTML = STEPS.map((s, i) => {
        const isActive = !s.done && i === activeStep;
        const cls = `aria-step${s.done?' done':''}${isActive?' active':''}${s.special?` ${s.special}`:''}`;
        const badge = s.badge ? `<div class="aria-step-badge">${s.badge}</div>` : '';
        const conn  = i < STEPS.length - 1
          ? `<div class="aria-step-connector${s.done?' done':''}${isActive?' active':''}"></div>`
          : '';
        return `<div class="${cls}">
          <div class="aria-step-circle">${s.icon}${badge}</div>
          <div class="aria-step-label">${s.label}</div>
        </div>${conn}`;
      }).join('');
      bar.style.display = 'block';
    },

    showWorkflow(client) {
      const stepMap = { en_attente:1, diagnostic:1, en_cours:3, attente_pieces:3, pret:4, rendu:5 };
      const step = stepMap[client?.statut] || 2;
      this.showWorkflowDemo(step);
      const labels = ['Accueil','Diagnostic','Devis','Réparation','QualiRépar','Restitution'];
      this.addMessage('agent',
        `📍 Workflow de **${client?.client_nom || 'ce client'}** — étape **${labels[step]}**`,
        step < 4 ? ['Passer à l\'étape suivante ?'] : []
      );
    },
  };

  /* ══════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════ */
  function init() {
    injectStyles();
    injectHTML();
    window.ARIA = ARIA;

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); ARIA.toggle(); }
      if (e.key === 'Escape' && STATE.isOpen) ARIA.close();
      if (e.key === 'Enter' && document.activeElement?.id === 'aria-input') ARIA.send();
    });
    document.getElementById('aria-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'aria-overlay') ARIA.close();
    });

    const hint = document.createElement('div');
    hint.id = 'aria-cmd-hint';
    hint.innerHTML = '<kbd>⌘K</kbd> ou <kbd>Ctrl+K</kbd> pour ouvrir ARIA';
    document.body.appendChild(hint);
    setTimeout(() => hint.style.opacity = '0', 4000);
    setTimeout(() => hint.remove(), 4500);

    console.info(
      `%c ARIA v${ARIA_VERSION} %c Haiku · ⌘K`,
      'background:linear-gradient(90deg,#ff3b30,#c0392b);color:#fff;font-weight:700;padding:2px 8px;border-radius:4px;',
      'color:#ff3b30;font-weight:600;'
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
