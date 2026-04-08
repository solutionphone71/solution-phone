// ── SYSTÈME PIN (SHA-256) ──
var _pin = '';
var _pinCode      = ''; // Hash SHA-256 chargé depuis Supabase
var _pinEmployee  = ''; // Hash SHA-256 chargé depuis Supabase
var _pinsLoaded   = false;

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

      // Migration v2 : nouveaux PINs 6 chiffres
      if (!data.version || data.version !== 'v2') {
        migrated.patron  = await sha256('160978');
        migrated.employe = await sha256('555555');
        migrated.version = 'v2';
        needsMigration = true;
      } else {
        // Migration SHA-256 si encore en clair
        if (data.patron && !isSha256Hash(data.patron)) {
          migrated.patron = await sha256(data.patron);
          needsMigration = true;
        }
        if (data.employe && !isSha256Hash(data.employe)) {
          migrated.employe = await sha256(data.employe);
          needsMigration = true;
        }
      }

      _pinCode     = migrated.patron  || await sha256('160978');
      _pinEmployee = migrated.employe || await sha256('555555');

      if (needsMigration) {
        try {
          await supaFetch('settings', 'PATCH', {value: JSON.stringify(migrated)}, '?key=eq.pins_config');
          console.info('✅ PINs migrés v2 avec succès');
        } catch(e) {
          console.warn('Migration PIN impossible :', e);
        }
      }
      _pinsLoaded = true;
    } else {
      // Aucun PIN en base → créer avec les nouvelles valeurs
      var newData = {
        patron:  await sha256('160978'),
        employe: await sha256('555555'),
        version: 'v2'
      };
      _pinCode     = newData.patron;
      _pinEmployee = newData.employe;
      try {
        await supaFetch('settings', 'POST', {key:'pins_config', value: JSON.stringify(newData)});
      } catch(e) {}
      _pinsLoaded = true;
    }
  } catch(e) {
    console.warn('Erreur chargement PINs:', e);
    // Fallback : hashes des PINs par défaut
    _pinCode     = await sha256('160978');
    _pinEmployee = await sha256('555555');
    _pinsLoaded  = true;
  }
}
var _userRole     = 'patron'; // 'patron' ou 'employe'

// Modules cachés pour les employés
var _modulesPatronOnly = ['caisse','comptable','bilan','depenses','comparaison','stats','salaries'];

function appliquerRole(){
  var isEmploye = _userRole === 'employe';
  var ids = ['nav-caisse','nav-comptable','nav-bilan','nav-depenses','nav-comparaison','nav-stats','nav-salaries'];
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = isEmploye ? 'none' : '';
  });
  // Menu mobile items
  var mobItems = document.querySelectorAll('.mob-menu-item');
  var cacheMobile = ['caisse','comptable','bilan','depenses','comparaison','stats','salaries'];
  mobItems.forEach(function(item){
    var txt = item.getAttribute('onclick')||'';
    var cacher = cacheMobile.some(function(m){ return txt.indexOf(m) !== -1; });
    if(cacher) item.style.display = isEmploye ? 'none' : '';
  });
  // Bouton Z de caisse nav mobile bas
  var mobCaisse = document.getElementById('mob-btn-caisse');
  if(mobCaisse) mobCaisse.style.display = isEmploye ? 'none' : '';
  // Badge rôle
  var badge = document.getElementById('role-badge');
  if(badge){
    badge.textContent = isEmploye ? '👤 Employé' : '👑 Patron';
    badge.style.color = isEmploye ? 'var(--blue)' : 'var(--warning)';
  }
}

function pinPress(n){
  if(n === '') return;
  if(_pin.length >= 6) return;
  _pin += String(n);
  updatePinDisplay();
  if(_pin.length === 6) setTimeout(function(){ checkPin(); }, 150);
}

function pinClear(){
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
  // Charger les PINs depuis Supabase si pas encore fait
  if (!_pinsLoaded) {
    await loadPinsFromSupabase();
  }
  var pinSaisi = _pin;
  var hashSaisi = await sha256(pinSaisi);
  if(hashSaisi === _pinCode || hashSaisi === _pinEmployee){
    _userRole = (hashSaisi === _pinEmployee) ? 'employe' : 'patron';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    if(window.innerWidth <= 768){
      document.getElementById('mobile-nav').style.display='block';
    }
    // Charger uniquement les données essentielles au démarrage
    loadFromSupabase().then(function(){
      renderDashboard();renderPhones();renderFactures();renderCaisse();
      populateFournisseurSelects();
      loadApiKeyFromSupabase();
      loadClientsEnAttente();
      loadHistoriqueReparations();
      // Charger la base clients complète au démarrage (pagination 1000 par batch)
      // Clients : chargés à la demande (onglet ou recherche)
      // Chargement secondaire en arrière-plan (non bloquant)
      setTimeout(function(){
        loadBonsCommande();
        loadBonsDepot();
        loadPhonilabData();
        loadSalariesFromSupabase().then(function(){ renderSalaries(); });
      }, 3000);
    });
    // Écrans, batteries et android = chargement lazy à l'ouverture des onglets uniquement
    renderEcrans();
    renderBatteries();
    androidInit();
    _pin = '';
    updatePinDisplay();
    setTimeout(appliquerRole, 100);
  } else {
    document.getElementById('pin-msg').textContent = '❌ Code incorrect';
    var box = document.querySelector('.login-box');
    box.classList.add('pin-shake');
    setTimeout(function(){ box.classList.remove('pin-shake'); }, 400);
    _pin = '';
    setTimeout(function(){
      updatePinDisplay();
      document.getElementById('pin-msg').textContent = '';
    }, 600);
  }
}

function doLogin(){ checkPin(); }
