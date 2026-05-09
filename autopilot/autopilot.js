/* ════════════════════════════════════════════════════════════════
   AUTOPILOT v2 + BRAIN · Logic
   Solution Phone · v26 (mai 2026)
   ════════════════════════════════════════════════════════════════
   Fichier à déployer dans : public/autopilot/autopilot.js
   Chargé en lazy par index.html après autopilot.html + autopilot.css

   Dépendances : window.supaFetch (de index.html)
                 window.showPage (hook navigation)
   ════════════════════════════════════════════════════════════════ */

(function() {
'use strict';

// ──────────────────────────────────────────────────────────────
// ÉTAT GLOBAL
// ──────────────────────────────────────────────────────────────
var SP_AUTOPILOT = {
  state: {
    initialized: false,
    currentView: 'dashboard',
    currentMediaCat: 'all',
    queue: [],
    runs: [],
    memory: [],
    media: [],
    automations: [],
    logs: [],
    briefingToday: null,
    briefingArchive: [],
    suggestions: [],
    agentActive: true,
    planningItems: [],
    planningCursor: new Date()
  },
  config: {
    refreshIntervalMs: 30000
  },
  _refreshTimer: null
};
window.SP_AUTOPILOT = SP_AUTOPILOT;


// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function $(sel, root) { return (root||document).querySelector(sel); }
function $$(sel, root) { return Array.from((root||document).querySelectorAll(sel)); }

function escHtml(s){
  if(s===null||s===undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function timeAgo(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  var diff = Date.now() - d.getTime();
  var s = Math.floor(diff/1000); if(s<60) return s+'s';
  var m = Math.floor(s/60); if(m<60) return m+'min';
  var h = Math.floor(m/60); if(h<24) return h+'h';
  var dy = Math.floor(h/24); return dy+'j';
}

function fmtTime(iso){
  if(!iso) return '';
  var d = new Date(iso);
  return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}

function fmtDate(iso){
  if(!iso) return '';
  var d = new Date(iso);
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
}

// Markdown → HTML minimaliste (pour briefing)
function mdToHtml(md){
  if(!md) return '';
  var html = escHtml(md);
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, function(m){return '<ul>'+m+'</ul>';});
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/^([^<].+)$/gm, '<p>$1</p>');
  html = html.replace(/<p><(h\d|ul|li)/g, '<$1');
  html = html.replace(/<\/(h\d|ul|li)><\/p>/g, '</$1>');
  return html;
}


// ──────────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.toast = function(msg, type) {
  var t = $('#ap-toast');
  if(!t) return;
  t.textContent = msg;
  t.style.borderColor = type==='err' ? 'rgba(239,68,68,0.4)'
                       : type==='warn' ? 'rgba(245,158,11,0.4)'
                       : 'rgba(52,211,153,0.4)';
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
};


// ──────────────────────────────────────────────────────────────
// SUPABASE WRAPPER (utilise supaFetch existant de index.html)
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.db = async function(table, method, body, query) {
  if(typeof window.supaFetch !== 'function') {
    console.error('[SP_AUTOPILOT] supaFetch non disponible — l\'app principale doit être chargée');
    return null;
  }
  return await window.supaFetch(table, method||'GET', body||null, query||'');
};


// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.init = async function() {
  if(this.state.initialized) return;
  this.state.initialized = true;

  // Sub-nav
  $$('#page-autopilot .ap-sub-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      SP_AUTOPILOT.showView(btn.dataset.sub);
    });
  });

  // Tabs Mémoire (data-mtab)
  $$('#page-autopilot [data-mtab]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = btn.dataset.mtab;
      $$('#page-autopilot [data-mtab]').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      $$('#page-autopilot .ap-memtab').forEach(function(t){ t.style.display='none'; });
      var tgt = $('#ap-memtab-'+tab);
      if(tgt) tgt.style.display = 'block';
    });
  });

  // Tabs Briefing (data-bftab)
  $$('#page-autopilot [data-bftab]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = btn.dataset.bftab;
      $$('#page-autopilot [data-bftab]').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      $$('#page-autopilot .ap-bftab').forEach(function(t){ t.style.display='none'; });
      var tgt = $('#ap-bftab-'+tab);
      if(tgt) tgt.style.display = 'block';
      if(tab === 'archive') SP_AUTOPILOT.loadBriefingArchive();
      if(tab === 'suggestions') SP_AUTOPILOT.loadSuggestions();
    });
  });

  // Filters Médias
  $$('#page-autopilot .ap-filter-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      $$('#page-autopilot .ap-filter-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      SP_AUTOPILOT.state.currentMediaCat = btn.dataset.cat;
      SP_AUTOPILOT.renderMedia();
    });
  });

  // Drag & drop upload
  var uz = $('#ap-upload-zone');
  if(uz){
    ['dragenter','dragover'].forEach(function(ev){
      uz.addEventListener(ev, function(e){
        e.preventDefault();
        uz.classList.add('dragover');
      });
    });
    ['dragleave','drop'].forEach(function(ev){
      uz.addEventListener(ev, function(e){
        e.preventDefault();
        uz.classList.remove('dragover');
      });
    });
    uz.addEventListener('drop', function(e){
      var files = e.dataTransfer.files;
      if(files.length) SP_AUTOPILOT.uploadFiles(files);
    });
  }

  await this.refreshAll();

  // Auto-refresh dashboard
  this._refreshTimer = setInterval(function(){
    if(SP_AUTOPILOT.state.currentView === 'dashboard') {
      SP_AUTOPILOT.refreshDashboard();
    }
  }, this.config.refreshIntervalMs);
};


// ──────────────────────────────────────────────────────────────
// NAVIGATION VUES
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.showView = function(view) {
  this.state.currentView = view;
  $$('#page-autopilot .ap-view').forEach(function(v){ v.classList.remove('ap-active'); });
  var target = $('#ap-view-'+view);
  if(target) target.classList.add('ap-active');

  $$('#page-autopilot .ap-sub-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.sub === view);
  });

  if(view === 'briefing') this.loadBriefing();
  else if(view === 'queue') this.loadQueue();
  else if(view === 'memory') { this.loadRuns(); this.loadMemory(); }
  else if(view === 'planning') this.loadPlanning();
  else if(view === 'media') this.loadMedia();
  else if(view === 'config') this.loadConfig();
  else if(view === 'dashboard') this.refreshDashboard();
};


// ──────────────────────────────────────────────────────────────
// REFRESH ALL
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.refreshAll = async function() {
  await Promise.all([
    this.refreshDashboard(),
    this.loadAgentStatus()
  ]);
};


// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.refreshDashboard = async function() {
  try {
    // Stats 7 jours
    var stats = await this.db('v_agent_7days', 'GET', null, '');
    if(stats && stats[0]) {
      $('#ap-stat-actions').textContent = stats[0].actions_executed || 0;
    } else {
      $('#ap-stat-actions').textContent = '0';
    }

    // Briefing du jour
    var todayBrief = await this.db('v_brain_today', 'GET', null, '?limit=1');
    if(todayBrief && todayBrief[0]) {
      var b = todayBrief[0];
      $('#ap-briefing-title').textContent = 'Briefing du jour disponible';
      $('#ap-briefing-sub').textContent = (b.actions_pending || 0) + ' action(s) à valider · clique pour lire';
    } else {
      $('#ap-briefing-title').textContent = 'Briefing pas encore généré';
      $('#ap-briefing-sub').textContent = 'Il arrive automatiquement chaque matin à 8h.';
    }

    // Validation queue count
    var queueAll = await this.db('agent_decisions', 'GET', null,
      "?status=eq.pending_validation&select=id");
    var pendingCount = queueAll ? queueAll.length : 0;

    if(pendingCount > 0) {
      $('#ap-cta-title').textContent = pendingCount + ' décision' + (pendingCount>1?'s':'') + ' à valider';
      $('#ap-cta-sub').textContent = 'L\'agent a préparé '+pendingCount+' action(s) pour ton review.';
    } else {
      $('#ap-cta-title').textContent = 'Aucune décision en attente';
      $('#ap-cta-sub').textContent = 'L\'agent n\'a rien à te faire valider pour l\'instant.';
    }

    // Suggestions App Improver actives
    var sugg = await this.db('v_brain_active_suggestions', 'GET', null, '');
    if(sugg && sugg.length > 0) {
      $('#ap-cta-suggestion').style.display = 'flex';
      $('#ap-cta-suggestion-title').textContent = sugg.length + ' suggestion' + (sugg.length>1?'s':'') + ' à voir';
      $('#ap-cta-suggestion-sub').textContent = 'L\'agent te propose des améliorations.';
    } else {
      $('#ap-cta-suggestion').style.display = 'none';
    }

    // Last run
    var lastRun = await this.db('agent_runs', 'GET', null,
      '?order=started_at.desc&limit=1');
    if(lastRun && lastRun[0]) {
      var r = lastRun[0];
      var dur = r.duration_ms ? (r.duration_ms/1000).toFixed(1)+'s' : '—';
      var cost = r.cost_eur ? r.cost_eur.toFixed(3)+'€' : '—';
      var emoji = r.status==='success' ? '✓' : r.status==='failed' ? '✗' : r.status==='partial' ? '⚠' : '⏳';
      $('#ap-last-run-content').innerHTML =
        '<div style="font-size:13px;line-height:1.7;">'+
        '<b>'+emoji+'</b> Run '+escHtml(r.type)+' · '+timeAgo(r.started_at)+
        '<br><span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-muted);">'+
        (r.decisions_executed||0)+' actions · '+dur+' · '+cost+
        '</span></div>';
    }

    await this.renderModulesStatus();
    await this.renderFeed();

  } catch(e) {
    console.error('[SP_AUTOPILOT] refreshDashboard error', e);
  }
};

SP_AUTOPILOT.renderModulesStatus = async function() {
  var auto = await this.db('social_automations', 'GET', null, '?order=id');
  if(!auto) return;
  this.state.automations = auto;
  var html = auto.map(function(a){
    var cls = a.enabled ? 'ok' : 'off';
    var lbl = a.enabled ? (a.last_run_at ? 'actif · '+timeAgo(a.last_run_at) : 'actif') : 'désactivé';
    return '<div class="ap-status-item">'+
      '<div class="ap-status-icon '+cls+'"></div>'+
      '<div class="ap-status-name">'+escHtml(a.name)+'</div>'+
      '<div class="ap-status-meta">'+escHtml(lbl)+'</div>'+
    '</div>';
  }).join('');
  $('#ap-status-grid').innerHTML = html;
};

SP_AUTOPILOT.renderFeed = async function() {
  var logs = await this.db('social_logs', 'GET', null, '?order=ts.desc&limit=15');
  if(!logs) return;
  if(!logs.length) {
    $('#ap-feed').innerHTML = '<div class="ap-feed-empty">Aucune activité récente</div>';
    return;
  }
  $('#ap-feed').innerHTML = logs.map(function(l){
    var icon = l.level==='err' ? '✗' : l.level==='warn' ? '⚠' : l.level==='auto' ? '⚡' : '·';
    return '<div class="ap-feed-item">'+
      '<div class="ap-feed-time">'+fmtTime(l.ts)+'</div>'+
      '<div class="ap-feed-msg">'+icon+' '+escHtml(l.message)+'</div>'+
    '</div>';
  }).join('');
};


// ──────────────────────────────────────────────────────────────
// AGENT STATUS (kill switch)
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadAgentStatus = async function() {
  var mem = await this.db('agent_memory', 'GET', null, "?key=eq.agent_status");
  if(mem && mem[0]) {
    var st = mem[0].value || {};
    this.state.agentActive = st.active !== false;
    var statusEl = $('#ap-system-status');
    if(statusEl) statusEl.textContent = this.state.agentActive ? 'SYSTEM ACTIVE' : 'AGENT PAUSED';
    var dot = $('#page-autopilot .ap-live-dot');
    if(dot) dot.style.background = this.state.agentActive ? '#34d399' : '#f59e0b';
  }
};


// ──────────────────────────────────────────────────────────────
// BRIEFING
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadBriefing = async function() {
  var briefs = await this.db('v_brain_today', 'GET', null, '?limit=1');
  if(briefs && briefs[0]) {
    this.state.briefingToday = briefs[0];
    var b = briefs[0];
    $('#ap-briefing-date').textContent = fmtDate(b.created_at).toUpperCase();
    $('#ap-briefing-content').innerHTML = mdToHtml(b.content_md);

    // Mark as read
    if(!b.read_at) {
      this.db('brain_briefings', 'PATCH',
        { read_at: new Date().toISOString() },
        '?id=eq.'+b.id);
    }
  } else {
    $('#ap-briefing-date').textContent = '—';
    $('#ap-briefing-content').innerHTML =
      '<div class="ap-feed-empty">Briefing du jour pas encore généré.<br>'+
      '<span style="font-size:12px;">Il arrive automatiquement chaque matin à 8h via le cron Vercel.</span></div>';
  }
};

SP_AUTOPILOT.loadBriefingArchive = async function() {
  var archive = await this.db('brain_briefings', 'GET', null,
    '?order=date_brief.desc&limit=30');
  if(!archive) archive = [];
  this.state.briefingArchive = archive;

  if(!archive.length) {
    $('#ap-briefing-archive').innerHTML = '<div class="ap-feed-empty">Aucun briefing archivé.</div>';
    return;
  }

  $('#ap-briefing-archive').innerHTML = archive.map(function(b){
    var preview = (b.content_md || '').substring(0, 200);
    return '<div class="ap-briefing-archive-item" onclick="SP_AUTOPILOT.openArchiveBriefing(\''+b.id+'\')">'+
      '<div class="ap-briefing-date">'+fmtDate(b.date_brief).toUpperCase()+' · '+(b.type||'morning')+'</div>'+
      '<div class="ap-briefing-preview">'+escHtml(preview)+'…</div>'+
    '</div>';
  }).join('');
};

SP_AUTOPILOT.openArchiveBriefing = function(id) {
  var b = this.state.briefingArchive.find(function(x){return x.id===id;});
  if(!b) return;
  $('#ap-briefing-content').innerHTML = mdToHtml(b.content_md);
  $('#ap-briefing-date').textContent = fmtDate(b.date_brief).toUpperCase();
  // Bascule sur tab Today
  var todayBtn = document.querySelector('[data-bftab="today"]');
  if(todayBtn) todayBtn.click();
};

SP_AUTOPILOT.regenerateBriefing = async function() {
  if(!confirm('Régénérer le briefing du jour ? (~0.30€ de coût Claude API)')) return;
  this.toast('⏳ Régénération...');
  try {
    var res = await fetch('/api/brain/morning-run?force=1', {method:'POST'});
    if(res.ok) {
      this.toast('✅ Briefing régénéré');
      setTimeout(function(){ SP_AUTOPILOT.loadBriefing(); }, 2000);
    } else { throw new Error('regen failed'); }
  } catch(e) {
    this.toast('Endpoint à coder en Phase 2A', 'warn');
  }
};


// ──────────────────────────────────────────────────────────────
// SUGGESTIONS APP IMPROVER
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadSuggestions = async function() {
  var sugg = await this.db('v_brain_active_suggestions', 'GET', null, '');
  if(!sugg) sugg = [];
  this.state.suggestions = sugg;

  if(!sugg.length) {
    $('#ap-suggestions-list').innerHTML =
      '<div class="ap-feed-empty">Aucune suggestion active.<br>'+
      '<span style="font-size:12px;">L\'App Improver scanne ton usage 3x/semaine et propose des améliorations.</span></div>';
    return;
  }

  $('#ap-suggestions-list').innerHTML = sugg.map(function(s){
    var files = (s.files_changed || []).map(function(f){
      return '<span class="ap-suggestion-file">'+escHtml(f.path||f)+'</span>';
    }).join('');

    var actions = '';
    if(s.status === 'proposed') {
      actions =
        (s.vercel_preview_url ?
          '<a href="'+escHtml(s.vercel_preview_url)+'" target="_blank" class="ap-btn ap-btn-secondary">🔗 Tester preview</a>'
          : '<button class="ap-btn" disabled>Preview en cours...</button>')+
        '<button class="ap-btn" onclick="SP_AUTOPILOT.viewSuggestionDiff(\''+s.id+'\')">📄 Voir diff</button>'+
        '<button class="ap-btn ap-btn-primary" onclick="SP_AUTOPILOT.mergeSuggestion(\''+s.id+'\')">✅ Approuver & déployer</button>'+
        '<button class="ap-btn ap-btn-danger" onclick="SP_AUTOPILOT.rejectSuggestion(\''+s.id+'\')">❌ Rejeter</button>';
    } else if(s.status === 'merged') {
      actions = '<span style="color:#34d399;font-size:13px;">✓ Déployée le '+fmtDate(s.merged_at)+'</span>'+
        '<button class="ap-btn ap-btn-danger" onclick="SP_AUTOPILOT.rollbackSuggestion(\''+s.id+'\')">↩ Rollback</button>';
    }

    var evidence = s.evidence ? JSON.stringify(s.evidence, null, 2).substring(0, 300) : '';

    return '<div class="ap-suggestion-card">'+
      '<span class="ap-suggestion-cat">'+escHtml(s.category)+'</span>'+
      '<div class="ap-suggestion-title">'+escHtml(s.title)+'</div>'+
      '<div class="ap-suggestion-desc">'+escHtml(s.description||'')+'</div>'+
      (evidence ? '<div class="ap-suggestion-evidence">'+escHtml(evidence)+'</div>' : '')+
      (files ? '<div class="ap-suggestion-files">'+files+'</div>' : '')+
      '<div class="ap-suggestion-actions">'+actions+'</div>'+
    '</div>';
  }).join('');
};

SP_AUTOPILOT.viewSuggestionDiff = async function(id) {
  var s = this.state.suggestions.find(function(x){return x.id===id;});
  if(!s) return;
  if(s.github_pr_url) {
    window.open(s.github_pr_url, '_blank');
  } else if(s.diff_preview) {
    alert(s.diff_preview);
  } else {
    this.toast('Diff pas encore disponible', 'warn');
  }
};

SP_AUTOPILOT.mergeSuggestion = async function(id) {
  if(!confirm('Approuver et déployer en production ?\n\n⚠ Le code va être merge sur main et déployé sur app.solution-phone.fr.\nTu peux toujours rollback ensuite.')) return;
  this.toast('⏳ Merge en cours...');
  try {
    var res = await fetch('/api/brain/apply-suggestion?id='+id+'&action=merge', {method:'POST'});
    if(res.ok) {
      this.toast('✅ Suggestion déployée');
      await this.loadSuggestions();
    } else { throw new Error('merge failed'); }
  } catch(e) {
    this.toast('Endpoint à coder en Phase 3', 'warn');
  }
};

SP_AUTOPILOT.rejectSuggestion = async function(id) {
  var reason = prompt('Pourquoi rejeter cette suggestion ? (optionnel)') || '';
  await this.db('brain_suggestions', 'PATCH',
    { status:'rejected', rejected_reason: reason },
    '?id=eq.'+id);
  this.toast('❌ Suggestion rejetée');
  await this.loadSuggestions();
};

SP_AUTOPILOT.rollbackSuggestion = async function(id) {
  if(!confirm('⚠ ROLLBACK : revenir à la version précédente ?\n\nLa modif déployée par cette suggestion sera annulée.')) return;
  try {
    var res = await fetch('/api/brain/apply-suggestion?id='+id+'&action=rollback', {method:'POST'});
    if(res.ok) {
      this.toast('↩ Rollback effectué');
      await this.loadSuggestions();
    } else { throw new Error('rollback failed'); }
  } catch(e) {
    this.toast('Endpoint à coder en Phase 3', 'warn');
  }
};


// ──────────────────────────────────────────────────────────────
// VALIDATION QUEUE
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadQueue = async function() {
  var queue = await this.db('v_validation_queue', 'GET', null, '');
  if(!queue) queue = [];
  this.state.queue = queue;
  $('#ap-queue-count').textContent = queue.length + ' décision' + (queue.length>1?'s':'');

  if(!queue.length) {
    $('#ap-queue-content').innerHTML =
      '<div class="ap-queue-empty">'+
      '<div class="ap-queue-empty-icon">✓</div>'+
      '<div>Tout est traité.</div>'+
      '<div style="margin-top:8px;font-size:12px;">L\'agent reviendra vers toi dès qu\'il aura quelque chose à proposer.</div>'+
      '</div>';
    return;
  }

  $('#ap-queue-content').innerHTML = queue.map(function(d){
    return SP_AUTOPILOT.renderDecision(d);
  }).join('');
};

SP_AUTOPILOT.renderDecision = function(d) {
  var p = d.payload || {};
  var conf = (d.confidence || 0).toFixed(2);
  var media = '';
  if(p.media_url) {
    if((p.media_type||'image') === 'video') {
      media = '<video src="'+escHtml(p.media_url)+'" controls></video>';
    } else {
      media = '<img src="'+escHtml(p.media_url)+'" alt="">';
    }
  } else {
    media = '<span style="font-size:42px;opacity:0.4;">'+
      (d.type==='post'?'📝':d.type==='reel'?'🎬':d.type==='sms'?'💬':d.type==='reply_review'?'⭐':'•')+
      '</span>';
  }

  var platforms = '';
  if(p.platforms) {
    var keys = Object.keys(p.platforms).filter(function(k){return p.platforms[k];});
    platforms = keys.map(function(k){
      return '<span class="ap-decision-platform-tag">'+k+'</span>';
    }).join('');
  }

  var caption = p.caption || p.message || p.text || '';

  return '<div class="ap-decision-card" data-id="'+d.id+'">'+
    '<div class="ap-decision-head">'+
      '<span class="ap-decision-type">'+escHtml(d.type)+'</span>'+
      '<span class="ap-decision-confidence">confiance <b>'+conf+'</b></span>'+
    '</div>'+
    '<div class="ap-decision-preview">'+
      '<div class="ap-decision-media">'+media+'</div>'+
      '<div class="ap-decision-text">'+escHtml(caption).substring(0,400)+
        (caption.length>400?'…':'')+
        (platforms ? '<div class="ap-decision-platforms">'+platforms+'</div>' : '')+
      '</div>'+
    '</div>'+
    (d.reasoning ? '<div class="ap-decision-reasoning">'+escHtml(d.reasoning)+'</div>' : '')+
    '<div class="ap-decision-actions">'+
      '<button class="ap-btn ap-btn-primary" onclick="SP_AUTOPILOT.validateDecision(\''+d.id+'\')">✅ Publier maintenant</button>'+
      '<button class="ap-btn" onclick="SP_AUTOPILOT.editDecision(\''+d.id+'\')">✏ Éditer</button>'+
      '<button class="ap-btn" onclick="SP_AUTOPILOT.regenerateDecision(\''+d.id+'\')">↻ Régénérer</button>'+
      '<button class="ap-btn ap-btn-danger" onclick="SP_AUTOPILOT.rejectDecision(\''+d.id+'\')">❌ Rejeter</button>'+
    '</div>'+
  '</div>';
};

SP_AUTOPILOT.validateDecision = async function(id) {
  if(!confirm('Publier cette décision maintenant ?')) return;
  await this.db('agent_decisions', 'PATCH',
    {status:'human_validated', validated_by:'sebastien', validated_at: new Date().toISOString()},
    '?id=eq.'+id);
  await fetch('/api/autopilot/execute?decision_id='+id, {method:'POST'}).catch(function(){});
  this.toast('✅ Décision validée');
  await this.loadQueue();
  await this.refreshDashboard();
};

SP_AUTOPILOT.rejectDecision = async function(id) {
  if(!confirm('Rejeter cette décision ?')) return;
  await this.db('agent_decisions', 'PATCH',
    {status:'rejected', validated_by:'sebastien', validated_at: new Date().toISOString()},
    '?id=eq.'+id);
  this.toast('❌ Décision rejetée');
  await this.loadQueue();
};

SP_AUTOPILOT.editDecision = function(id) {
  this.toast('Édition à venir en Phase 2', 'warn');
};

SP_AUTOPILOT.regenerateDecision = async function(id) {
  this.toast('⏳ Régénération...');
  try {
    await fetch('/api/autopilot/regenerate?decision_id='+id, {method:'POST'});
    await this.loadQueue();
  } catch(e) {
    this.toast('Endpoint à coder en Phase 2', 'warn');
  }
};


// ──────────────────────────────────────────────────────────────
// RUN MANUEL
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.runManual = async function() {
  if(!confirm('Lancer un run manuel de l\'agent maintenant ?')) return;
  this.toast('⚡ Run en cours... (peut prendre 10-20 sec)');
  try {
    var res = await fetch('/api/autopilot/run?type=manual', {method:'POST'});
    var data = await res.json().catch(function(){ return {error: 'Réponse non-JSON'}; });
    if(res.ok && data.success) {
      this.toast('✅ Run OK · ' + (data.decisions_pending||0) + ' décisions · ' + (data.cost_eur||0) + '€');
      setTimeout(function(){ SP_AUTOPILOT.refreshDashboard(); }, 2000);
    } else {
      console.error('[SP_AUTOPILOT] Run error:', data);
      var msg = data.error || 'Erreur inconnue';
      this.toast('❌ ' + msg.substring(0, 100), 'err');
    }
  } catch(e) {
    console.error('[SP_AUTOPILOT] Network error:', e);
    this.toast('❌ Réseau : ' + e.message, 'err');
  }
};


// ──────────────────────────────────────────────────────────────
// MÉMOIRE : RUNS
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadRuns = async function() {
  var runs = await this.db('agent_runs', 'GET', null,
    '?order=started_at.desc&limit=30');
  if(!runs) runs = [];
  this.state.runs = runs;

  if(!runs.length) {
    $('#ap-runs-list').innerHTML = '<div class="ap-feed-empty">Aucun run pour l\'instant.<br>Lance un run manuel depuis le Dashboard.</div>';
    return;
  }

  $('#ap-runs-list').innerHTML = runs.map(function(r){
    var sCls = 'ap-run-status-'+(r.status==='success'?'ok':r.status==='failed'?'fail':'partial');
    var cost = r.cost_eur ? (r.cost_eur).toFixed(3)+'€' : '—';
    var dur = r.duration_ms ? (r.duration_ms/1000).toFixed(1)+'s' : '—';
    return '<div class="ap-run-row" onclick="SP_AUTOPILOT.toggleRunDetail(this)">'+
      '<div class="ap-run-head">'+
        '<div>'+
          '<span class="ap-run-type">'+escHtml(r.type)+'</span> · '+
          '<span class="'+sCls+'">'+escHtml(r.status)+'</span>'+
        '</div>'+
        '<div class="ap-run-meta">'+timeAgo(r.started_at)+'</div>'+
      '</div>'+
      '<div class="ap-run-meta">'+
        (r.decisions_executed||0)+' actions · '+dur+' · '+cost+
        ' · '+(r.tokens_input||0)+' tok in / '+(r.tokens_output||0)+' tok out'+
      '</div>'+
      '<div class="ap-run-detail">'+
        (r.thoughts ? '<div class="ap-run-thoughts">'+escHtml(r.thoughts)+'</div>' : '<div style="color:var(--text-muted);font-size:12px;">Pas de chain-of-thought enregistré.</div>')+
      '</div>'+
    '</div>';
  }).join('');
};

SP_AUTOPILOT.toggleRunDetail = function(el) {
  el.classList.toggle('expanded');
};


// ──────────────────────────────────────────────────────────────
// MÉMOIRE : LONG-TERM
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadMemory = async function() {
  var mem = await this.db('agent_memory', 'GET', null, '?order=key.asc');
  if(!mem) mem = [];
  this.state.memory = mem;

  if(!mem.length) {
    $('#ap-memory-list').innerHTML = '<div class="ap-feed-empty">Mémoire vide. Re-exécute le seed SQL.</div>';
    return;
  }

  $('#ap-memory-list').innerHTML = mem.map(function(m){
    return '<div class="ap-memory-row">'+
      '<div class="ap-memory-key">'+escHtml(m.key)+'</div>'+
      '<div class="ap-memory-desc">'+escHtml(m.description||'')+'</div>'+
      '<div class="ap-memory-value">'+escHtml(JSON.stringify(m.value, null, 2))+'</div>'+
    '</div>';
  }).join('');
};


// ──────────────────────────────────────────────────────────────
// MÉDIAS
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadMedia = async function() {
  var media = await this.db('social_media', 'GET', null,
    '?order=uploaded_at.desc&limit=200');
  if(!media) media = [];
  this.state.media = media;
  $('#ap-media-count').textContent = media.length + ' média' + (media.length>1?'s':'');
  this.renderMedia();
};

SP_AUTOPILOT.renderMedia = function() {
  var cat = this.state.currentMediaCat;
  var list = this.state.media || [];
  if(cat !== 'all') list = list.filter(function(m){return m.category === cat;});

  if(!list.length) {
    $('#ap-media-grid').innerHTML = '<div class="ap-feed-empty" style="grid-column:1/-1;">Aucun média dans cette catégorie.<br>Uploade des photos/vidéos ci-dessus.</div>';
    return;
  }

  $('#ap-media-grid').innerHTML = list.map(function(m){
    var isVid = m.media_type === 'video';
    var src = m.public_url || '';
    var preview = isVid
      ? '<video src="'+escHtml(src)+'" muted></video>'
      : '<img src="'+escHtml(src)+'" loading="lazy">';
    return '<div class="ap-media-item" onclick="SP_AUTOPILOT.openMedia(\''+m.id+'\')">'+
      preview+
      '<div class="ap-media-badge'+(isVid?' video':'')+'">'+(isVid?'VIDÉO':'PHOTO')+'</div>'+
      '<div class="ap-media-overlay">'+
        escHtml(m.category||'?')+' · '+(m.used_count||0)+'×'+
      '</div>'+
    '</div>';
  }).join('');
};

SP_AUTOPILOT.uploadFiles = async function(files) {
  if(!files || !files.length) return;
  this.toast('⏳ Upload de '+files.length+' fichier(s)...');

  var fd = new FormData();
  for(var i=0; i<files.length; i++) fd.append('files', files[i]);

  try {
    var res = await fetch('/api/autopilot/upload', {method:'POST', body:fd});
    if(res.ok) {
      this.toast('✅ '+files.length+' fichier(s) uploadé(s)');
      await this.loadMedia();
    } else { throw new Error('upload failed'); }
  } catch(e) {
    this.toast('Endpoint upload à créer (Phase 2)', 'warn');
  }
};

SP_AUTOPILOT.openMedia = function(id) {
  this.toast('Preview à venir', 'warn');
};


// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.loadConfig = async function() {
  await this.loadMemory();

  var byKey = {};
  this.state.memory.forEach(function(m){ byKey[m.key] = m; });

  function fillTextarea(id, key) {
    var el = $('#'+id);
    if(el && byKey[key]) {
      el.value = JSON.stringify(byKey[key].value, null, 2);
    }
  }

  fillTextarea('ap-cfg-brand-voice', 'brand_voice');
  fillTextarea('ap-cfg-do-not-post', 'do_not_post');
  fillTextarea('ap-cfg-thresholds', 'auto_exec_thresholds');
  fillTextarea('ap-cfg-app-improver-whitelist', 'brain_app_improver_whitelist');
  fillTextarea('ap-cfg-notif-prefs', 'brain_notification_prefs');

  // Templates SMS
  if(byKey.sms_templates) {
    var t = byKey.sms_templates.value || {};
    if($('#ap-cfg-sms-avis')) $('#ap-cfg-sms-avis').value = t.avis || '';
    if($('#ap-cfg-sms-batt')) $('#ap-cfg-sms-batt').value = t.battery || '';
    if($('#ap-cfg-sms-inactif')) $('#ap-cfg-sms-inactif').value = t.inactif || '';
  }

  await this.loadAgentStatus();
  this.renderPauseButton();
};

SP_AUTOPILOT.renderPauseButton = function() {
  var area = $('#ap-pause-area');
  if(!area) return;
  if(this.state.agentActive) {
    area.innerHTML = '<button class="ap-btn ap-btn-pause" onclick="SP_AUTOPILOT.toggleAgent()">⏸ PAUSE AGENT</button>';
  } else {
    area.innerHTML =
      '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#f59e0b;">'+
      '⚠ Agent suspendu. Aucune décision automatique ne sera prise.</div>'+
      '<button class="ap-btn ap-btn-primary" onclick="SP_AUTOPILOT.toggleAgent()">▶ RÉACTIVER AGENT</button>';
  }
};

SP_AUTOPILOT.saveMemory = async function(key, textareaId) {
  try {
    var raw = $('#'+textareaId).value;
    var val = JSON.parse(raw);
    var existing = await this.db('agent_memory', 'GET', null, '?key=eq.'+encodeURIComponent(key));
    if(existing && existing.length) {
      await this.db('agent_memory', 'PATCH',
        { value: val, updated_by:'sebastien' },
        '?key=eq.'+encodeURIComponent(key));
    } else {
      await this.db('agent_memory', 'POST',
        { key: key, value: val, updated_by:'sebastien' });
    }
    this.toast('💾 '+key+' enregistré');
  } catch(e) {
    this.toast('JSON invalide : '+e.message, 'err');
  }
};

SP_AUTOPILOT.toggleAgent = async function() {
  var newActive = !this.state.agentActive;
  if(!newActive && !confirm('Suspendre l\'agent ? Aucune décision automatique ne sera prise.')) return;
  if(newActive && !confirm('Réactiver l\'agent ?')) return;

  var current = (this.state.memory.find(function(m){return m.key==='agent_status';})||{}).value || {};
  current.active = newActive;
  current.paused_reason = newActive ? null : 'manuel';
  current.paused_at = newActive ? null : new Date().toISOString();
  if(newActive) current.consecutive_errors = 0;

  await this.db('agent_memory', 'PATCH',
    { value: current, updated_by:'sebastien' },
    '?key=eq.agent_status');

  this.state.agentActive = newActive;
  await this.loadAgentStatus();
  this.renderPauseButton();
  this.toast(newActive ? '▶ Agent réactivé' : '⏸ Agent suspendu', newActive ? null : 'warn');
};

SP_AUTOPILOT.saveSmsTemplates = async function() {
  var templates = {
    avis: $('#ap-cfg-sms-avis').value,
    battery: $('#ap-cfg-sms-batt').value,
    inactif: $('#ap-cfg-sms-inactif').value
  };
  var existing = await this.db('agent_memory', 'GET', null, "?key=eq.sms_templates");
  if(existing && existing.length) {
    await this.db('agent_memory', 'PATCH',
      { value: templates, updated_by:'sebastien' },
      '?key=eq.sms_templates');
  } else {
    await this.db('agent_memory', 'POST',
      { key:'sms_templates', value: templates,
        description:'Templates SMS Brevo (avis, battery, inactif)',
        updated_by:'sebastien' });
  }
  this.toast('💾 Templates SMS enregistrés');
};

SP_AUTOPILOT.testConnections = async function() {
  this.toast('🔄 Test en cours...');
  try {
    var res = await fetch('/api/autopilot/test-connections');
    if(res.ok) {
      var data = await res.json();
      $('#ap-cnx-meta').textContent = data.meta ? '✓ OK' : '✗ Erreur';
      $('#ap-cnx-google').textContent = data.google ? '✓ OK' : '✗ Erreur';
      $('#ap-cnx-brevo').textContent = data.brevo ? '✓ OK' : '✗ Erreur';
      $('#ap-cnx-placid').textContent = data.placid ? '✓ OK' : '✗ Non configuré';
      $('#ap-cnx-pennylane').textContent = data.pennylane ? '✓ OK' : '✗ Non testé';
      this.toast('✅ Tests terminés');
    } else { throw new Error('test failed'); }
  } catch(e) {
    this.toast('Endpoint test à créer (Phase 2)', 'warn');
  }
};


// ──────────────────────────────────────────────────────────────
// USAGE TRACKING (pour App Improver) — léger, en arrière-plan
// ──────────────────────────────────────────────────────────────
SP_AUTOPILOT.trackUsage = function(eventType, page, element, metadata) {
  // Best-effort, ne bloque jamais l'UX
  try {
    fetch('/api/brain/observe-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        page: page || 'autopilot',
        element: element || '',
        metadata: metadata || {},
        ts: new Date().toISOString()
      }),
      keepalive: true
    }).catch(function(){});
  } catch(e) {}
};


// ──────────────────────────────────────────────────────────────
// AUTO-INIT (le module s'initialise dès qu'il est chargé)
// ──────────────────────────────────────────────────────────────
// L'auto-init est déclenché par index.html après injection HTML+CSS+JS
// (voir le loader dans index.html)
SP_AUTOPILOT.init().catch(function(e){
  console.error('[SP_AUTOPILOT] init failed:', e);
});



// ──────────────────────────────────────────────────────────
// PLANNING (Calendrier éditorial fusionné)
// ──────────────────────────────────────────────────────────
SP_AUTOPILOT.loadPlanning = async function() {
  var cur = this.state.planningCursor;
  var year = cur.getFullYear();
  var month = cur.getMonth();
  var firstDay = new Date(year, month, 1);
  var lastDay = new Date(year, month + 1, 0);
  var startStr = firstDay.toISOString().split('T')[0];
  var endStr = lastDay.toISOString().split('T')[0];

  var items = await this.db('calendrier_editorial', 'GET', null,
    '?date=gte.' + startStr + '&date=lte.' + endStr + '&order=date.asc,heure.asc');
  if(!items) items = [];
  this.state.planningItems = items;

  // Label du mois
  var monthLabel = cur.toLocaleDateString('fr-FR', {month:'long', year:'numeric'});
  $('#ap-planning-month-label').textContent = monthLabel.toUpperCase();

  this.renderPlanningStats(items);
  this.renderPlanningGrid(year, month, items);
  this.renderPlanningList(items);
};

SP_AUTOPILOT.renderPlanningStats = function(items) {
  var counts = {reel:0, post:0, story:0, ads:0, google:0, publie:0};
  items.forEach(function(it){
    if(counts[it.type] !== undefined) counts[it.type]++;
    if(it.statut === 'publie') counts.publie++;
  });
  var statsEl = $('#ap-planning-stats');
  if(!statsEl) return;
  statsEl.innerHTML =
    '<div class="ap-planning-stat"><div class="ap-planning-stat-num" style="color:#A855F7;">'+counts.reel+'</div><div class="ap-planning-stat-label">🎬 Reels</div></div>'+
    '<div class="ap-planning-stat"><div class="ap-planning-stat-num" style="color:var(--ap-cyan);">'+counts.post+'</div><div class="ap-planning-stat-label">🖼️ Posts</div></div>'+
    '<div class="ap-planning-stat"><div class="ap-planning-stat-num" style="color:var(--ap-amber);">'+counts.story+'</div><div class="ap-planning-stat-label">📱 Stories</div></div>'+
    '<div class="ap-planning-stat"><div class="ap-planning-stat-num" style="color:var(--ap-red);">'+counts.ads+'</div><div class="ap-planning-stat-label">💰 Ads</div></div>'+
    '<div class="ap-planning-stat"><div class="ap-planning-stat-num" style="color:var(--ap-green);">'+counts.publie+'</div><div class="ap-planning-stat-label">✅ Publiés</div></div>';
};

SP_AUTOPILOT.renderPlanningGrid = function(year, month, items) {
  var firstDay = new Date(year, month, 1);
  var lastDay = new Date(year, month + 1, 0);
  // Jour de la semaine (lundi = 0, dimanche = 6)
  var startWeekday = (firstDay.getDay() + 6) % 7;

  // Group items by date
  var byDate = {};
  items.forEach(function(it){
    if(!byDate[it.date]) byDate[it.date] = [];
    byDate[it.date].push(it);
  });

  var todayStr = new Date().toISOString().split('T')[0];

  var html = '';
  // Cases vides avant le 1er
  for(var i=0; i<startWeekday; i++){
    html += '<div class="ap-planning-day empty"></div>';
  }
  // Jours du mois
  for(var d=1; d<=lastDay.getDate(); d++){
    var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var dayItems = byDate[dateStr] || [];
    var isToday = dateStr === todayStr;
    var miniHtml = dayItems.slice(0,3).map(function(it){
      var label = it.titre || it.legende || '?';
      return '<div class="ap-planning-item-mini ' + escHtml(it.type||'autre') + '" title="' + escHtml(label) + '">'+escHtml(label.substring(0,18))+'</div>';
    }).join('');
    if(dayItems.length > 3) miniHtml += '<div class="ap-planning-item-mini autre">+'+(dayItems.length-3)+'</div>';
    html += '<div class="ap-planning-day '+(isToday?'today':'')+'" onclick="SP_AUTOPILOT.openPlanningAdd(\''+dateStr+'\')">'+
      '<div class="ap-planning-day-num">'+d+'</div>'+
      '<div class="ap-planning-day-items">'+miniHtml+'</div>'+
    '</div>';
  }

  $('#ap-planning-grid').innerHTML = html;
};

SP_AUTOPILOT.renderPlanningList = function(items) {
  var todayStr = new Date().toISOString().split('T')[0];
  var upcoming = items.filter(function(it){ return it.date >= todayStr; });

  if(!upcoming.length) {
    $('#ap-planning-list').innerHTML = '<div class="ap-feed-empty">Aucun contenu planifié à venir.<br>Clique "+ Ajouter" pour commencer.</div>';
    return;
  }

  var emojis = {reel:'🎬', post:'🖼️', story:'📱', ads:'💰', google:'⭐', autre:'📌'};
  $('#ap-planning-list').innerHTML = upcoming.map(function(it){
    var dt = new Date(it.date);
    var dateStr = dt.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'});
    return '<div class="ap-planning-list-item">'+
      '<div class="ap-planning-list-date">'+dateStr.toUpperCase()+'<br>'+(it.heure||'')+'</div>'+
      '<div class="ap-planning-list-type">'+(emojis[it.type]||'📌')+'</div>'+
      '<div class="ap-planning-list-content">'+
        '<div class="ap-planning-list-title">'+escHtml(it.titre||'(sans titre)')+'</div>'+
        '<div class="ap-planning-list-meta">'+escHtml(it.statut||'planifie')+' · '+escHtml((it.legende||'').substring(0,80))+'</div>'+
      '</div>'+
      '<button class="ap-btn ap-btn-danger" onclick="SP_AUTOPILOT.deletePlanItem(\''+it.id+'\')">🗑</button>'+
    '</div>';
  }).join('');
};

SP_AUTOPILOT.prevPlanningMonth = function() {
  this.state.planningCursor.setMonth(this.state.planningCursor.getMonth() - 1);
  this.loadPlanning();
};
SP_AUTOPILOT.nextPlanningMonth = function() {
  this.state.planningCursor.setMonth(this.state.planningCursor.getMonth() + 1);
  this.loadPlanning();
};

SP_AUTOPILOT.openPlanningAdd = function(dateStr) {
  $('#ap-planning-modal').style.display = 'flex';
  $('#ap-pl-date').value = dateStr || new Date().toISOString().split('T')[0];
  $('#ap-pl-heure').value = '09:00';
  $('#ap-pl-type').value = 'post';
  $('#ap-pl-titre').value = '';
  $('#ap-pl-legende').value = '';
  $('#ap-pl-notes').value = '';
};
SP_AUTOPILOT.closePlanningModal = function() {
  $('#ap-planning-modal').style.display = 'none';
};

SP_AUTOPILOT.savePlanItem = async function() {
  var data = {
    date: $('#ap-pl-date').value,
    heure: $('#ap-pl-heure').value || '09:00',
    type: $('#ap-pl-type').value,
    titre: $('#ap-pl-titre').value.trim() || '(sans titre)',
    legende: $('#ap-pl-legende').value.trim() || null,
    notes: $('#ap-pl-notes').value.trim() || null,
    statut: 'planifie',
    rappel: true
  };
  if(!data.date) { this.toast('Date requise', 'err'); return; }

  try {
    await this.db('calendrier_editorial', 'POST', data);
    this.toast('💾 Contenu planifié');
    this.closePlanningModal();
    await this.loadPlanning();
  } catch(e) {
    this.toast('Erreur : ' + e.message, 'err');
  }
};

SP_AUTOPILOT.deletePlanItem = async function(id) {
  if(!confirm('Supprimer ce contenu planifié ?')) return;
  try {
    await this.db('calendrier_editorial', 'DELETE', null, '?id=eq.' + id);
    this.toast('🗑 Supprimé');
    await this.loadPlanning();
  } catch(e) {
    this.toast('Erreur : ' + e.message, 'err');
  }
};


})();
