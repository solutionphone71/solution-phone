// ── SYSTÈME PIN (SHA-256) — v3 sécurisé ──
var _pin = '';
var _pinCode      = ''; // Hash SHA-256 patron (depuis Supabase uniquement)
var _pinEmployee  = ''; // Hash SHA-256 employé (depuis Supabase uniquement)
var _pinComptable = ''; // Hash SHA-256 comptable (depuis Supabase uniquement)
var _pinsLoaded   = false;

// Anti brute-force
var _pinAttempts   = 0;
var _pinMaxAttempts = 5;
var _pinLockUntil  = 0; // timestamp
var _pinLockDuration = 120000; // 2 minutes

// Hache une chaîne en SHA-256 (retourne une promesse de chaîne hex)
async function sha256(str) {
  var buf = new TextEncoder().encode(str);
  var hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

// Détecte si une valeur est déjà un hash SHA-256 (64 caractères hex)
function isSha256Hash(val) {
  return typeof val === 'string' && /^[0-9a-f]{64}$/.test(val);
}

async function loadPinsFromSupabase() {
  try {
    var rows = await supaFetch('settings', 'GET', null, '?key=eq.pins_config&select=value');
    if (rows && rows.length && rows[0].value) {
      var data = JSON.parse(rows[0].value);
      var needsMigration = false;
      var migrated = Object.assign({}, data);

      // Migration v3 : ajout rôle comptable
      if (!data.version || data.version !== 'v3') {
        // Garder patron/employe existants s'ils sont déjà hashés
        if (data.patron && isSha256Hash(data.patron)) {
          migrated.patron = data.patron;
        } else if (data.patron) {
          migrated.patron = await sha256(data.patron);
        }
        if (data.employe && isSha256Hash(data.employe)) {
          migrated.employe = data.employe;
        } else if (data.employe) {
          migrated.employe = await sha256(data.employe);
        }
        // Ajouter comptable si pas encore présent
        if (!data.comptable) {
          migrated.comptable = await sha256('469577');
        }
        migrated.version = 'v3';
        needsMigration = true;
      } else {
        // V3 déjà en place, vérifier les hash
        if (data.patron && !isSha256Hash(data.patron)) {
          migrated.patron = await sha256(data.patron);
          needsMigration = true;
        }
        if (data.employe && !isSha256Hash(data.employe)) {
          migrated.employe = await sha256(data.employe);
          needsMigration = true;
        }
        if (data.comptable && !isSha256Hash(data.comptable)) {
          migrated.comptable = await sha256(data.comptable);
          needsMigration = true;
        }
      }

      _pinCode      = migrated.patron   || '';
      _pinEmployee  = migrated.employe  || '';
      _pinComptable = migrated.comptable || '';

      if (needsMigration) {
        try {
          await supaFetch('settings', 'PATCH', {value: JSON.stringify(migrated)}, '?key=eq.pins_config');
          console.info('✅ PINs migrés v3 (+ comptable)');
        } catch(e) {
          console.warn('Migration PIN impossible :', e);
        }
      }
      _pinsLoaded = true;
    } else {
      // Aucun PIN en base → créer la config initiale dans Supabase
      console.warn('⚠️ Aucun PIN en base — initialisation automatique...');
      await _pinInitDefaults();
    }
  } catch(e) {
    console.warn('Erreur chargement PINs:', e);
    // Fallback hors-ligne : PINs hashés en dur pour ne jamais bloquer l'accès
    await _pinInitDefaults();
  }
}

// Initialise les PINs par défaut (fallback si Supabase vide ou hors-ligne)
async function _pinInitDefaults() {
  // PINs par défaut — seront écrasés dès que Supabase est dispo
  var defaultPatron   = await sha256('160978');
  var defaultEmploye  = await sha256('555555');
  var defaultComptable = await sha256('469577');

  _pinCode      = defaultPatron;
  _pinEmployee  = defaultEmploye;
  _pinComptable = defaultComptable;
  _pinsLoaded   = true;

  // Tenter de sauvegarder dans Supabase pour la prochaine fois
  try {
    var config = JSON.stringify({
      patron:    defaultPatron,
      employe:   defaultEmploye,
      comptable: defaultComptable,
      version:   'v3'
    });
    // Vérifier si la ligne existe
    var existing = await supaFetch('settings', 'GET', null, '?key=eq.pins_config&select=key');
    if (existing && existing.length > 0) {
      await supaFetch('settings', 'PATCH', { value: config }, '?key=eq.pins_config');
    } else {
      await supaFetch('settings', 'POST', { key: 'pins_config', value: config });
    }
    console.info('✅ PINs par défaut sauvegardés dans Supabase');
  } catch(e) {
    console.warn('Impossible de sauvegarder les PINs dans Supabase:', e);
  }
}

var _userRole = 'patron'; // 'patron', 'employe' ou 'comptable'

// Modules par rôle
var _modulesPatronOnly = ['caisse','comptable','bilan','depenses','comparaison','stats','salaries','docs-comptable'];
var _modulesComptable  = ['caisse','comptable','bilan','depenses','comparaison','stats','salaries','docs-comptable'];
var _modulesEmploye    = []; // employés voient tout SAUF _modulesPatronOnly

function appliquerRole(){
  var isEmploye   = _userRole === 'employe';
  var isComptable = _userRole === 'comptable';
  var isPatron    = _userRole === 'patron';

  // Navigation sidebar desktop
  var allNavItems = document.querySelectorAll('.nav-item[onclick]');
  allNavItems.forEach(function(el){
    var onclick = el.getAttribute('onclick') || '';
    // Extraire le nom de page du onclick showPage('xxx',...)
    var match = onclick.match(/showPage\(['"]([^'"]+)['"]/);
    if (!match) return;
    var pageName = match[1];

    if (isPatron) {
      el.style.display = '';
    } else if (isComptable) {
      // Comptable : ne voit QUE les modules compta + salariés + dashboard
      var allowed = _modulesComptable.concat(['dashboard']);
      el.style.display = allowed.indexOf(pageName) !== -1 ? '' : 'none';
    } else if (isEmploye) {
      // Employé : ne voit PAS les modules patron-only
      el.style.display = _modulesPatronOnly.indexOf(pageName) !== -1 ? 'none' : '';
    }
  });

  // Nav group labels — cacher "Comptabilité" pour les employés, cacher groupes non-compta pour comptable
  var navGroups = document.querySelectorAll('.nav-group-label');
  navGroups.forEach(function(label){
    var nextSibling = label.nextElementSibling;
    if (!nextSibling) return;
    // Compter les items visibles dans ce groupe
    var group = [];
    var el = label.nextElementSibling;
    while (el && !el.classList.contains('nav-sep') && !el.classList.contains('nav-group-label')) {
      if (el.classList.contains('nav-item')) group.push(el);
      el = el.nextElementSibling;
    }
    var visibles = group.filter(function(g){ return g.style.display !== 'none'; });
    label.style.display = visibles.length > 0 ? '' : 'none';
    // Also hide the separator before if group is empty
  });

  // Nav separators — cacher ceux qui sont entre des groupes vides
  var navSeps = document.querySelectorAll('.nav-sep');
  navSeps.forEach(function(sep){
    var prev = sep.previousElementSibling;
    var next = sep.nextElementSibling;
    if (prev && prev.style && prev.style.display === 'none') {
      sep.style.display = 'none';
    } else if (next && next.style && next.style.display === 'none') {
      sep.style.display = 'none';
    } else {
      sep.style.display = '';
    }
  });

  // Menu mobile items
  var mobItems = document.querySelectorAll('.mob-menu-item');
  mobItems.forEach(function(item){
    var txt = item.getAttribute('onclick')||'';
    if (isPatron) {
      item.style.display = '';
    } else if (isComptable) {
      var shown = _modulesComptable.concat(['dashboard']).some(function(m){ return txt.indexOf(m) !== -1; });
      item.style.display = shown ? '' : 'none';
    } else if (isEmploye) {
      var cacher = _modulesPatronOnly.some(function(m){ return txt.indexOf(m) !== -1; });
      item.style.display = cacher ? 'none' : '';
    }
  });

  // Bouton Z de caisse nav mobile bas
  var mobCaisse = document.getElementById('mob-btn-caisse');
  if(mobCaisse) mobCaisse.style.display = isEmploye ? 'none' : '';

  // Badge rôle
  var badge = document.getElementById('role-badge');
  if(badge){
    if (isComptable) {
      badge.textContent = '📊 Comptable';
      badge.style.color = '#2563eb';
    } else if (isEmploye) {
      badge.textContent = '👤 Employé';
      badge.style.color = 'var(--blue)';
    } else {
      badge.textContent = '👑 Patron';
      badge.style.color = 'var(--warning)';
    }
  }
}

function pinPress(n){
  if(n === '') return;
  // Anti brute-force : vérifier le verrouillage
  if (_pinLockUntil > Date.now()) {
    var secsLeft = Math.ceil((_pinLockUntil - Date.now()) / 1000);
    document.getElementById('pin-msg').textContent = '🔒 Verrouillé — ' + secsLeft + 's';
    return;
  }
  if(_pin.length >= 6) return;
  _pin += String(n);
  updatePinDisplay();
  if(_pin.length === 6) setTimeout(function(){ checkPin(); }, 150);
}

function pinClear(){
  if (_pinLockUntil > Date.now()) return;
  _pin = _pin.slice(0, -1);
  updatePinDisplay();
  document.getElementById('pin-msg').textContent = '';
}

function updatePinDisplay(){
  for(var i=1;i<=6;i++){
    var el = document.getElementById('pin-d'+i);
    el.textContent = _pin.length >= i ? '●' : '';
    el.style.borderColor = _pin.length >= i ? 'var(--red)' : '#cbd5e1';
    el.style.background = _pin.length >= i ? 'rgba(192,57,43,0.15)' : '#f8fafc';
  }
}

async function checkPin(){
  // Anti brute-force
  if (_pinLockUntil > Date.now()) {
    _pin = '';
    updatePinDisplay();
    return;
  }

  // Charger les PINs depuis Supabase si pas encore fait
  if (!_pinsLoaded) {
    await loadPinsFromSupabase();
  }

  // Vérifier qu'on a au moins un PIN configuré
  if (!_pinCode && !_pinEmployee && !_pinComptable) {
    document.getElementById('pin-msg').textContent = '⚠️ Aucun PIN configuré en base';
    _pin = '';
    setTimeout(function(){ updatePinDisplay(); document.getElementById('pin-msg').textContent = ''; }, 2000);
    return;
  }

  var pinSaisi = _pin;
  var hashSaisi = await sha256(pinSaisi);

  if(hashSaisi === _pinCode || hashSaisi === _pinEmployee || hashSaisi === _pinComptable){
    // Succès — reset tentatives
    _pinAttempts = 0;

    if (hashSaisi === _pinComptable) {
      _userRole = 'comptable';
    } else if (hashSaisi === _pinEmployee) {
      _userRole = 'employe';
    } else {
      _userRole = 'patron';
    }

    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    if(window.innerWidth <= 768){
      document.getElementById('mobile-nav').style.display='block';
    }
    // Charger les données avec retry automatique
    _loadDataWithRetry(3);
    renderEcrans();
    renderBatteries();
    androidInit();
    _pin = '';
    updatePinDisplay();
    setTimeout(appliquerRole, 100);
  } else {
    // Échec
    _pinAttempts++;
    if (_pinAttempts >= _pinMaxAttempts) {
      _pinLockUntil = Date.now() + _pinLockDuration;
      document.getElementById('pin-msg').textContent = '🔒 Trop de tentatives — verrouillé 2 min';
      _pin = '';
      updatePinDisplay();
      // Compte à rebours
      var lockTimer = setInterval(function(){
        var secsLeft = Math.ceil((_pinLockUntil - Date.now()) / 1000);
        if (secsLeft <= 0) {
          clearInterval(lockTimer);
          _pinAttempts = 0;
          document.getElementById('pin-msg').textContent = '';
        } else {
          document.getElementById('pin-msg').textContent = '🔒 Verrouillé — ' + secsLeft + 's';
        }
      }, 1000);
    } else {
      document.getElementById('pin-msg').textContent = '❌ Code incorrect (' + _pinAttempts + '/' + _pinMaxAttempts + ')';
      var box = document.querySelector('.login-box');
      box.classList.add('pin-shake');
      setTimeout(function(){ box.classList.remove('pin-shake'); }, 400);
      _pin = '';
      setTimeout(function(){
        updatePinDisplay();
        document.getElementById('pin-msg').textContent = '';
      }, 1500);
    }
  }
}

function doLogin(){ checkPin(); }

// Chargement données avec retry automatique + indicateur visuel
async function _loadDataWithRetry(maxRetries) {
  var retries = 0;
  // Afficher un indicateur de chargement
  var loadingEl = document.createElement('div');
  loadingEl.id = '_loading-indicator';
  loadingEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(90deg,#e53e3e,#f39c12,#e53e3e);background-size:200% 100%;animation:_loadSlide 1.5s ease infinite;height:4px;';
  var style = document.createElement('style');
  style.textContent = '@keyframes _loadSlide{0%{background-position:200% 0}100%{background-position:-200% 0}}';
  document.head.appendChild(style);
  document.body.appendChild(loadingEl);

  // Afficher un message dans le dashboard
  var banner = document.createElement('div');
  banner.id = '_loading-banner';
  banner.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99998;background:rgba(0,0,0,0.85);color:#fff;padding:24px 40px;border-radius:16px;font-size:16px;font-weight:600;text-align:center;backdrop-filter:blur(10px);';
  banner.innerHTML = '⏳ Chargement des données...';
  document.body.appendChild(banner);

  while (retries < maxRetries) {
    try {
      banner.innerHTML = retries > 0
        ? '🔄 Tentative ' + (retries+1) + '/' + maxRetries + '...'
        : '⏳ Chargement des données...';

      await loadFromSupabase();

      // Vérifier qu'on a bien reçu des données
      if (supabaseReady && (phones.length > 0 || caisse.length > 0)) {
        // Succès !
        renderDashboard(); renderPhones(); renderFactures(); renderCaisse();
        populateFournisseurSelects();
        loadApiKeyFromSupabase();
        loadClientsEnAttente();
        loadHistoriqueReparations();
        setTimeout(function(){
          loadBonsCommande();
          loadBonsDepot();
          loadPhonilabData();
          loadSalariesFromSupabase().then(function(){ renderSalaries(); });
        }, 3000);

        // Retirer les indicateurs
        if(loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        if(banner.parentNode) banner.parentNode.removeChild(banner);
        return;
      }

      // supaFetch a retourné vide — retry
      retries++;
      if (retries < maxRetries) {
        banner.innerHTML = '⚠️ Données non reçues — nouvelle tentative dans 3s...';
        await new Promise(function(r){ setTimeout(r, 3000); });
      }
    } catch(e) {
      console.error('loadData tentative ' + (retries+1) + ' échouée:', e);
      retries++;
      if (retries < maxRetries) {
        banner.innerHTML = '⚠️ Erreur connexion — nouvelle tentative dans 3s...';
        await new Promise(function(r){ setTimeout(r, 3000); });
      }
    }
  }

  // Toutes les tentatives échouées
  if(loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
  banner.style.background = 'rgba(220,38,38,0.95)';
  banner.innerHTML = '❌ Impossible de charger les données<br>' +
    '<span style="font-size:13px;font-weight:400;">Vérifiez votre connexion internet</span><br>' +
    '<button onclick="this.parentNode.remove();_loadDataWithRetry(3);" style="margin-top:12px;padding:10px 24px;background:#fff;color:#dc2626;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;">🔄 Réessayer</button>';
}
