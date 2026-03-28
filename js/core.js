
emailjs.init("vSpx7OHQTgKezV-Q-");

var SUPA_URL = 'https://kdvxcnjfrmvlnrymfyug.supabase.co';
var SUPA_KEY = 'sb_publishable_3Mub3jSj8wUC8mfFtAuhdA_P4Ljnnhb';

async function supaFetch(table, method, body, query) {
  try {
    var res = await fetch(SUPA_URL + '/rest/v1/' + table + (query||''), {
      method: method||'GET',
      headers: {'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':method==='POST'?'return=representation':''},
      body: body ? JSON.stringify(body) : null
    });
    var text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch(e) { console.error(e); return null; }
}

var phones = [], factures = [], caisse = [], reportsMois = {'2026-02':891.20};
var supabaseReady = false;
var realtimeChannel = null;

function initRealtime() {
  // Polling toutes les 90 secondes pour synchro multiposte
  setInterval(async function() {
    if (!supabaseReady) return;
    try {
      var c = await supaFetch('caisse','GET',null,'?order=date.asc');
      if (c) {
        caisse = c.map(function(x){return{date:x.date,ttc:Number(x.ttc),cb:Number(x.cb),especes:Number(x.especes),cheque:Number(x.cheque),virement:Number(x.virement),quali:Number(x.quali),depotEsp:Number(x.depot_esp),depotCheque:Number(x.depot_cheque),achatSmart:Number(x.achat_smart)};});
        renderCaisse();
      }
      var p = await supaFetch('phones','GET',null,'?order=id.asc');
      if (p) {
        phones = p.map(function(x){return{id:x.id,modele:x.modele,stockage:x.stockage,grade:x.grade,batterie:x.batterie,imei:x.imei,achat:Number(x.achat),vente:Number(x.vente),mode:x.mode,dateAchat:x.date_achat,couleur:x.couleur||'',etat:x.etat,dateVente:x.date_vente,numPolice:x.num_police,vendeurNom:x.vendeur_nom||'',vendeurAdresse:x.vendeur_adresse||'',vendeurCI:x.vendeur_ci||'',vendeurCIDate:x.vendeur_ci_date||'',typeAchat:x.type_achat||'PARTICULIER',fournisseur:x.fournisseur||''};});
        renderPhones(); renderDashboard();
      }
    } catch(e) { console.log('Sync error:', e); }
  }, 90000);
  console.log('🔄 Synchronisation temps réel activée (30s)');
}

async function loadFromSupabase() {
  try {
    // Chargement silencieux
    var results = await Promise.all([
      supaFetch('phones','GET',null,'?order=id.asc'),
      supaFetch('factures','GET',null,'?order=id.desc&limit=200'),
      supaFetch('caisse','GET',null,'?order=date.asc'),
      supaFetch('reports_mois','GET',null,'')
    ]);
    var p=results[0], f=results[1], c=results[2], r=results[3], cl=null;
    if(p) phones=p.map(function(x){return{id:x.id,modele:x.modele,stockage:x.stockage,grade:x.grade,batterie:x.batterie,imei:x.imei,achat:Number(x.achat),vente:Number(x.vente),mode:x.mode,dateAchat:x.date_achat,couleur:x.couleur||'',etat:x.etat,dateVente:x.date_vente,numPolice:x.num_police,vendeurNom:x.vendeur_nom||'',vendeurAdresse:x.vendeur_adresse||'',vendeurCI:x.vendeur_ci||'',vendeurCIDate:x.vendeur_ci_date||'',typeAchat:x.type_achat||'PARTICULIER',fournisseur:x.fournisseur||''};});
    if(f) factures=f.map(function(x){return{id:x.id,numero:x.numero,date:x.date,phoneId:x.phone_id,clientNom:x.client_nom,clientAdresse:x.client_adresse,clientEmail:x.client_email||'',ttc:Number(x.montant_ttc),ht:Number(x.montant_ht),tva:Number(x.tva)};});
    if(c) caisse=c.map(function(x){return{date:x.date,ttc:Number(x.ttc),cb:Number(x.cb),especes:Number(x.especes),cheque:Number(x.cheque),virement:Number(x.virement),quali:Number(x.quali),depotEsp:Number(x.depot_esp),depotCheque:Number(x.depot_cheque),achatSmart:Number(x.achat_smart)};});
    if(r) r.forEach(function(x){reportsMois[x.mois]=Number(x.montant);});
    if(cl) clients = cl.map(function(x){
      var nomComplet = '';
      if(x.prenom && x.nom) nomComplet = (x.prenom+' '+x.nom).trim();
      else if(x.prenom) nomComplet = x.prenom;
      else nomComplet = x.nom||'';
      return{id:x.id,nom:nomComplet,tel:x.tel||'',email:x.email||'',adresse:x.adresse||'',notes:x.notes||'',dateCreation:x.date_creation};
    });
    supabaseReady=true;
    initRealtime();
    showNotif('✅ Connecté','success');
  } catch(e){console.error(e);showNotif('Mode local actif','error');}
}

async function savePhone(phone) {
  if(!supabaseReady) return;
  var data={modele:phone.modele,stockage:phone.stockage,grade:phone.grade,batterie:phone.batterie,imei:phone.imei,achat:phone.achat,vente:phone.vente,mode:phone.mode,date_achat:phone.dateAchat,couleur:phone.couleur,etat:phone.etat,date_vente:phone.dateVente||null,num_police:phone.numPolice,vendeur_nom:phone.vendeurNom,vendeur_adresse:phone.vendeurAdresse,vendeur_ci:phone.vendeurCI,vendeur_ci_date:phone.vendeurCIDate||null,type_achat:phone.typeAchat||'PARTICULIER',fournisseur:phone.fournisseur||''};
  if(phone.supaId || (phone.id && phone.id<100000)){await supaFetch('phones','PATCH',data,'?id=eq.'+(phone.supaId||phone.id));}
  else{var res=await supaFetch('phones','POST',data);if(res&&res[0]){phone.supaId=res[0].id;phone.id=res[0].id;}}
}

async function saveCaisseRow(row) {
  if(!supabaseReady) return;
  var data={date:row.date,ttc:row.ttc,cb:row.cb,especes:row.especes,cheque:row.cheque,virement:row.virement,quali:row.quali,depot_esp:row.depotEsp,depot_cheque:row.depotCheque,achat_smart:row.achatSmart};
  var ex=await supaFetch('caisse','GET',null,'?date=eq.'+row.date);
  if(ex&&ex.length>0){await supaFetch('caisse','PATCH',data,'?date=eq.'+row.date);}
  else{await supaFetch('caisse','POST',data);}
}


function getAdresse(prefixe) {
  var a = (document.getElementById(prefixe+'-adresse')||{value:''}).value.trim();
  var cp = (document.getElementById(prefixe+'-cp')||{value:''}).value.trim();
  var v = (document.getElementById(prefixe+'-ville')||{value:''}).value.trim();
  return [a, cp && v ? cp+' '+v : cp||v].filter(Boolean).join(', ');
}
function setAdresseFields(prefixe, adresseComplete) {
  var parts = (adresseComplete||'').split(',');
  var rue = parts[0] ? parts[0].trim() : '';
  var rest = parts[1] ? parts[1].trim() : '';
  var cpMatch = rest.match(/^(\d{4,5})\s*(.*)/);
  var elA = document.getElementById(prefixe+'-adresse');
  var elCP = document.getElementById(prefixe+'-cp');
  var elV = document.getElementById(prefixe+'-ville');
  if(elA) elA.value = rue;
  if(elCP) elCP.value = cpMatch ? cpMatch[1] : '';
  if(elV) elV.value = cpMatch ? cpMatch[2].trim() : rest;
}

function fmtDate(d){if(!d)return'—';var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function showNotif(msg,type){var n=document.getElementById('notif');n.textContent=msg;n.className='notif show '+(type||'success');setTimeout(function(){n.classList.remove('show');},3000);}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

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

function showPage(id,el){
  // Sécurité : bloquer accès pages patron pour les employés
  if(_userRole === 'employe' && _modulesPatronOnly.indexOf(id) !== -1){
    showNotif('⛔ Accès réservé au patron','error');
    return;
  }
  // Reset Instagram/GMB quand on quitte la page
  if(id !== 'instagram'){
    var igContent = document.getElementById('ig-content');
    if(igContent) igContent.style.display = 'none';
    ['captions','calendar','ideas','responses','stories','gmb'].forEach(function(t){
      var el2 = document.getElementById('ig-tab-'+t);
      if(el2) el2.style.display = 'none';
    });
  }
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  document.getElementById('page-'+id).classList.add('active');
  if(el)el.classList.add('active');
  if(id==='caisse')renderCaisse();
  if(id==='stats')renderStats();
  if(id==='police')renderPolice();
  if(id==='comptable')renderComptable();
  if(id==='reparations'){
    // Si un dossier est déjà ouvert en mémoire, maintenir la vue dossier
    var _dosView = document.getElementById('rep-dossier-view');
    if(window.repDossierCourant && _dosView && _dosView.style.display !== 'none'){
      repLoadFormFromDossier(); // recharger les champs depuis repDossierCourant
    } else {
      repLoadDossiers(); // vue liste normale
    }
  }
  if(id==='suivi-qr'){renderSuiviQR();}
  if(id==='params'){paramsLoad();}
  if(id==='neufs-access'){naLoad();naRender();}
  if(id==='depenses'){renderDepenses();}
  if(id==='comparaison')renderComparaison();
  if(id==='bilan')renderBilan();
  if(id==='devis')renderDevis();    if(id==='clients'){
    loadAllClients().then(function(){ renderClients(); });
  }
    if(id==='rachat')calculerRachat();
  if(id==='instagram'){renderInstagram();}
  if(id==='ecrans'){loadEcransFromSupabase().then(function(){ renderEcrans(); });}
  if(id==='batteries'){loadBatteriesFromSupabase().then(function(){ renderBatteries(); });}
  if(id==='factures')renderFactures();
  if(id==='phones')renderPhones();
  if(id==='ventes-smart')renderVentesSmartphones();
}

function getMoisActuel(){if(!caisse.length){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');}return caisse[0].date.substring(0,7);}
function getReport(mois){var p=mois.split('-');var y=parseInt(p[0]),m=parseInt(p[1]);var mp=m===1?12:m-1;var yp=m===1?y-1:y;return reportsMois[yp+'-'+String(mp).padStart(2,'0')]||0;}
function calcFinales(){var cc=getReport(getMoisActuel());return caisse.map(function(c){cc+=((c.especes||0)-(c.depotEsp||0)-(c.achatSmart||0));return cc;});}

function cloturerMois(){
  if(!caisse.length){showNotif('Aucune donnée','error');return;}
  var mois=getMoisActuel();var fin=calcFinales();reportsMois[mois]=fin[fin.length-1];
  if(supabaseReady)supaFetch('reports_mois','POST',{mois:mois,montant:reportsMois[mois]});
  caisse=[];renderCaisse();
  showNotif('Mois clôturé ! Report : '+reportsMois[mois].toFixed(2)+' €','success');
}

function updateCaisseCalc(){var t=parseFloat(document.getElementById('c-ttc').value)||0;document.getElementById('c-ht').value=(t/1.2).toFixed(2)+' €';document.getElementById('c-tva').value=(t-t/1.2).toFixed(2)+' €';}

function addCaisse(){
  var date=document.getElementById('c-date').value;
  if(!date){showNotif('Date requise','error');return;}
  var entry={date:date,ttc:parseFloat(document.getElementById('c-ttc').value)||0,cb:parseFloat(document.getElementById('c-cb').value)||0,especes:parseFloat(document.getElementById('c-esp').value)||0,cheque:parseFloat(document.getElementById('c-cheque').value)||0,virement:parseFloat(document.getElementById('c-vir').value)||0,depotEsp:parseFloat(document.getElementById('c-depot-esp').value)||0,depotCheque:parseFloat(document.getElementById('c-depot-cheque').value)||0,quali:parseFloat(document.getElementById('c-quali').value)||0,achatSmart:0};
  var idx=caisse.findIndex(function(c){return c.date===date;});
  if(idx>=0)caisse[idx]=entry;else caisse.push(entry);
  caisse.sort(function(a,b){return a.date.localeCompare(b.date);});
  saveCaisseRow(entry);closeModal('modal-add-caisse');renderCaisse();renderDashboard();
  showNotif('Saisie enregistrée !','success');
}

function editCaisse(date) {
  var c = caisse.find(function(x) { return x.date === date; });
  if (!c) return;
  document.getElementById('edit-c-date').value = date;
  document.getElementById('edit-c-date-display').textContent = fmtDate(date);
  document.getElementById('edit-c-ttc').value = c.ttc || 0;
  document.getElementById('edit-c-ht').value = ((c.ttc||0)/1.2).toFixed(2) + ' €';
  document.getElementById('edit-c-cb').value = c.cb || 0;
  document.getElementById('edit-c-esp').value = c.especes || 0;
  document.getElementById('edit-c-cheque').value = c.cheque || 0;
  document.getElementById('edit-c-vir').value = c.virement || 0;
  document.getElementById('edit-c-depot-esp').value = c.depotEsp || 0;
  document.getElementById('edit-c-depot-cheque').value = c.depotCheque || 0;
  document.getElementById('edit-c-quali').value = c.quali || 0;
  document.getElementById('edit-c-achat-smart').value = c.achatSmart || 0;
  openModal('modal-edit-caisse');
}

function updateEditCalc() {
  var t = parseFloat(document.getElementById('edit-c-ttc').value) || 0;
  document.getElementById('edit-c-ht').value = (t/1.2).toFixed(2) + ' €';
}

function saveCaisseEdit() {
  var date = document.getElementById('edit-c-date').value;
  var idx = caisse.findIndex(function(c) { return c.date === date; });
  if (idx < 0) return;
  caisse[idx] = {
    date: date,
    ttc: parseFloat(document.getElementById('edit-c-ttc').value) || 0,
    cb: parseFloat(document.getElementById('edit-c-cb').value) || 0,
    especes: parseFloat(document.getElementById('edit-c-esp').value) || 0,
    cheque: parseFloat(document.getElementById('edit-c-cheque').value) || 0,
    virement: parseFloat(document.getElementById('edit-c-vir').value) || 0,
    depotEsp: parseFloat(document.getElementById('edit-c-depot-esp').value) || 0,
    depotCheque: parseFloat(document.getElementById('edit-c-depot-cheque').value) || 0,
    quali: parseFloat(document.getElementById('edit-c-quali').value) || 0,
    achatSmart: parseFloat(document.getElementById('edit-c-achat-smart').value) || 0
  };
  saveCaisseRow(caisse[idx]);
  closeModal('modal-edit-caisse');
  renderCaisse(); renderDashboard();
  showNotif('✅ Saisie du ' + fmtDate(date) + ' mise à jour !', 'success');
}

function deleteCaisse(date){if(!confirm('Supprimer ?'))return;caisse=caisse.filter(function(c){return c.date!==date;});if(supabaseReady)supaFetch('caisse','DELETE',null,'?date=eq.'+date);renderCaisse();showNotif('Supprimé','success');}

function renderCaisse(){
  var fin=calcFinales();var rep=getReport(getMoisActuel());
  var el=document.getElementById('report-display');if(el)el.textContent=rep.toFixed(2)+' €';
  var tot={ttc:0,cb:0,esp:0,ch:0,vir:0,quali:0,dEsp:0,dCh:0,aS:0};
  caisse.forEach(function(c){tot.ttc+=c.ttc;tot.cb+=c.cb;tot.esp+=c.especes;tot.ch+=c.cheque;tot.vir+=c.virement;tot.quali+=c.quali;tot.dEsp+=c.depotEsp;tot.dCh+=c.depotCheque;tot.aS+=c.achatSmart;});
  document.getElementById('caisse-totaux').innerHTML= +
    '<div class="caisse-card"><div class="caisse-label">CA TTC</div><div class="caisse-value">'+tot.ttc.toFixed(2)+' €</div></div>'+
    '<div class="caisse-card"><div class="caisse-label">CA HT</div><div class="caisse-value">'+(tot.ttc/1.2).toFixed(2)+' €</div></div>'+
    '<div class="caisse-card"><div class="caisse-label">CB</div><div class="caisse-value">'+tot.cb.toFixed(2)+' €</div></div>'+
    '<div class="caisse-card"><div class="caisse-label">Espèces</div><div class="caisse-value">'+tot.esp.toFixed(2)+' €</div></div>'+
    '<div class="caisse-card"><div class="caisse-label">QualiRépar</div><div class="caisse-value" style="color:var(--green)">'+tot.quali.toFixed(2)+' €</div></div>'+
    '<div class="caisse-card"><div class="caisse-label">Achats Smart.</div><div class="caisse-value">'+tot.aS.toFixed(2)+' €</div></div>';
  document.getElementById('caisse-table').innerHTML=caisse.map(function(c,i){
    // TTC réel = ttc stocké + quali (si l'ancien import n'incluait pas le bonus)
    // Détection : si ttc < quali*4, le bonus n'était probablement pas inclus (ancien format)
    var ttcTotal = c.ttc; // nouveau format : bonus déjà dans ttc
    var ht=(ttcTotal/1.2).toFixed(2);var tva=(ttcTotal-ttcTotal/1.2).toFixed(2);
    return '<tr><td>'+fmtDate(c.date)+'</td><td><b>'+ttcTotal.toFixed(2)+' €</b></td><td>'+ht+' €</td><td>'+tva+' €</td><td>'+(c.cb||0).toFixed(2)+' €</td><td>'+(c.especes||0).toFixed(2)+' €</td><td>'+(c.cheque||0).toFixed(2)+' €</td><td>'+(c.virement||0).toFixed(2)+' €</td><td>'+(c.depotEsp||0).toFixed(2)+' €</td><td>'+(c.depotCheque||0).toFixed(2)+' €</td><td>'+(c.achatSmart||0).toFixed(2)+' €</td><td>'+((c.quali||0)>0?'<span style="color:var(--green)">'+c.quali.toFixed(2)+' €</span>':'—')+'</td><td><b>'+fin[i].toFixed(2)+' €</b></td><td style="display:flex;gap:4px;"><button class="btn btn-sm" onclick="editCaisse(\''+c.date+'\')">✏️</button><button class="btn btn-sm" onclick="deleteCaisse(\''+c.date+'\')">🗑️</button></td></tr>';
  }).join('')||'<tr><td colspan="14" style="text-align:center;padding:20px;color:var(--text-dim)">Aucune saisie</td></tr>';
}

function importPhonilabToCaisse(input) {
  var file = input.files[0];
  if (!file) return;

  function parseAndImport(text) {
    var sep = ';';
    var lines = text.split('\n').filter(function(l){ return l.trim(); });
    if (lines.length < 2) { showNotif('Fichier CSV vide', 'error'); return; }

    var rawHeaders = lines[0].split(sep).map(function(h){ return h.replace(/"/g,'').trim(); });
    console.log('CSV headers:', rawHeaders); // debug

    // Chercher les colonnes par nom — Phonilab a plusieurs formats selon la version
    var iDate    = rawHeaders.indexOf('Date valeur');
    var iMethode = rawHeaders.indexOf('M\u00e9thode'); // Méthode

    // Détection colonne montant : priorité à "Montant TTC", sinon "Montant"
    var iMontantTTC = rawHeaders.findIndex(function(h){ return h.toLowerCase().replace(/[^a-z0-9]/g,'').includes('montantttc') || h.toLowerCase() === 'montant ttc'; });
    var iMontantHT  = rawHeaders.findIndex(function(h){ return h.toLowerCase().replace(/[^a-z0-9]/g,'').includes('montanths') || h.toLowerCase() === 'montant ht'; });
    var iMontantBrut = rawHeaders.indexOf('Montant');

    // Si colonne TTC explicite → l'utiliser directement (valeur déjà TTC)
    // Si colonne HT explicite → multiplier par 1.2 pour obtenir TTC
    // Si juste "Montant" → comportement selon format (TTC avant le 25/03/2026)
    var iMontant = iMontantTTC >= 0 ? iMontantTTC
                 : iMontantBrut >= 0 ? iMontantBrut
                 : -1;
    var montantEstHT = iMontantTTC < 0 && iMontantHT >= 0;
    if(montantEstHT) iMontant = iMontantHT;

    // Fallback accents manquants
    if(iDate    < 0) iDate    = rawHeaders.findIndex(function(h){ return h.toLowerCase().includes('date'); });
    if(iMontant < 0) iMontant = rawHeaders.findIndex(function(h){ return h.toLowerCase().includes('montant'); });
    if(iMethode < 0) iMethode = rawHeaders.findIndex(function(h){ return h.toLowerCase().replace(/[^\x00-\x7F]/g,'').includes('thode'); });

    if(iDate < 0 || iMontant < 0) {
      showNotif('Format CSV non reconnu. Colonnes trouvées : ' + rawHeaders.join(', '), 'error');
      return;
    }
    if(montantEstHT) showNotif('ℹ️ Import : colonne "Montant HT" détectée — conversion HT→TTC (×1.2)', 'success');

    var byDate = {};
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(sep).map(function(c){ return c.replace(/^"|"$/g,'').trim(); });
      if (cols.length < 3) continue;

      // Date DD-MM-YYYY → YYYY-MM-DD
      var rawDate = cols[iDate] || '';
      var dateISO = '';
      var parts = rawDate.split('-');
      if (parts.length === 3 && parts[0].length === 2) {
        dateISO = parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0');
      } else if (parts.length === 3 && parts[0].length === 4) {
        dateISO = rawDate;
      }
      if (!dateISO) continue;

      var montant = parseFloat((cols[iMontant]||'0').replace(',','.').replace('\u20ac','').trim()) || 0;
      if (montant === 0) continue;
      // Si la colonne est HT, convertir en TTC
      if(montantEstHT) montant = Math.round(montant * 1.2 * 100) / 100;

      var methode = (iMethode >= 0 ? cols[iMethode] : '').trim();
      // Normaliser les méthodes sans dépendre de l'encodage des accents
      var methodeNorm = methode.toLowerCase().replace(/[^\x00-\x7F]/g,'').replace(/\s+/g,' ').trim();
      // Détection bonus : colonne méthode contient "bonus" (Bonus Réparation = QualiRépar)
      var isBonus = methodeNorm.includes('bonus');

      if (!byDate[dateISO]) {
        byDate[dateISO] = {date:dateISO, ttc:0, cb:0, especes:0, cheque:0, virement:0, quali:0, depotEsp:0, depotCheque:0, achatSmart:0};
      }
      var d = byDate[dateISO];

      if (isBonus) {
        d.quali += montant;
        d.ttc   += montant; // Bonus QualiRépar = CA avec TVA → inclus dans TTC
      } else {
        d.ttc += montant;
        if      (methodeNorm === 'cb' || methodeNorm.includes('carte') || methodeNorm.includes('bank')) d.cb       += montant;
        else if (methodeNorm.includes('esp') || methodeNorm === 'cash')                                  d.especes  += montant;
        else if (methodeNorm.includes('ch') && methodeNorm.includes('que'))                              d.cheque   += montant;
        else if (methodeNorm.includes('vir') || methodeNorm.includes('transfer'))                        d.virement += montant;
        else                                                                                              d.cb       += montant; // défaut
      }
    }

    var imported = 0, updated = 0;
    Object.values(byDate).forEach(function(entry) {
      ['ttc','cb','especes','cheque','virement','quali'].forEach(function(k){
        entry[k] = Math.round((entry[k]||0) * 100) / 100;
      });
      var idx = caisse.findIndex(function(c){ return c.date === entry.date; });
      if (idx >= 0) {
        caisse[idx].ttc      = entry.ttc;
        caisse[idx].cb       = entry.cb;
        caisse[idx].especes  = entry.especes;
        caisse[idx].cheque   = entry.cheque;
        caisse[idx].virement = entry.virement;
        caisse[idx].quali    = (caisse[idx].quali||0) + entry.quali;
        saveCaisseRow(caisse[idx]);
        updated++;
      } else {
        caisse.push(entry);
        caisse.sort(function(a,b){ return a.date.localeCompare(b.date); });
        saveCaisseRow(entry);
        imported++;
      }
    });

    renderCaisse(); renderDashboard();
    showNotif('Import Z de Caisse : ' + imported + ' ajoutés, ' + updated + ' mis à jour ✅', 'success');
  }

  // Lire en ISO-8859-1 (encodage Phonilab)
  var reader = new FileReader();
  reader.onload = function(e) { parseAndImport(e.target.result); input.value = ''; };
  reader.readAsText(file, 'ISO-8859-1');
}

function exportCaisseCSV(){
  var cc=getReport(getMoisActuel());
  var headers=['Date','TTC','HT','TVA','QualiRepar','Cheque','CB','Especes','Virement','Depot Esp','Depot Cheque','Achats Smart','Caisse Finale'];
  var rows=caisse.map(function(c){var ttcTotal=c.ttc;var ht=(ttcTotal/1.2).toFixed(2);var tva=(ttcTotal-ttcTotal/1.2).toFixed(2);cc+=((c.especes||0)-(c.depotEsp||0)-(c.achatSmart||0));return[fmtDate(c.date),c.ttc,ht,tva,c.quali||0,c.cheque||0,c.cb||0,c.especes||0,c.virement||0,c.depotEsp||0,c.depotCheque||0,c.achatSmart||0,cc.toFixed(2)].join(';');});
  var csv=[headers.join(';')].concat(rows).join('\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='Z_Caisse.csv';a.click();
  showNotif('Export téléchargé !','success');
}

// ============================================================
//  GESTION DES FOURNISSEURS
// ============================================================
var fournisseursList = JSON.parse(localStorage.getItem('sp_fournisseurs') || '["Wegacell","Mobilax","Utopya","Autre"]');

function saveFournisseurs() {
  localStorage.setItem('sp_fournisseurs', JSON.stringify(fournisseursList));
}

function populateFournisseurSelects(selectedValue) {
  var selects = ['p-fournisseur', 'edit-p-fournisseur'];
  selects.forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var current = selectedValue !== undefined ? selectedValue : sel.value;
    sel.innerHTML = fournisseursList.map(function(f) {
      return '<option value="' + f + '"' + (f === current ? ' selected' : '') + '>' + f + '</option>';
    }).join('');
  });
}

function ajouterFournisseur() {
  var nom = prompt('Nom du nouveau fournisseur :');
  if (!nom) return;
  nom = nom.trim();
  if (!nom) return;
  if (fournisseursList.indexOf(nom) >= 0) {
    showNotif('Ce fournisseur existe déjà', 'info');
    return;
  }
  // Insérer avant "Autre" si présent, sinon à la fin
  var idxAutre = fournisseursList.indexOf('Autre');
  if (idxAutre >= 0) {
    fournisseursList.splice(idxAutre, 0, nom);
  } else {
    fournisseursList.push(nom);
  }
  saveFournisseurs();
  populateFournisseurSelects(nom);
  showNotif('Fournisseur "' + nom + '" ajouté ✅', 'success');
}

function supprimerFournisseur() {
  // Trouver quel select est visible
  var sel = document.getElementById('p-fournisseur-group').style.display !== 'none'
    ? document.getElementById('p-fournisseur')
    : document.getElementById('edit-p-fournisseur');
  var nom = sel ? sel.value : '';
  if (!nom) return;
  if (nom === 'Autre') { showNotif('Impossible de supprimer "Autre"', 'error'); return; }
  if (!confirm('Supprimer le fournisseur "' + nom + '" de la liste ?')) return;
  fournisseursList = fournisseursList.filter(function(f) { return f !== nom; });
  saveFournisseurs();
  populateFournisseurSelects(fournisseursList[0] || 'Autre');
  showNotif('Fournisseur "' + nom + '" supprimé', 'success');
}

function toggleFournisseur() {
  var type = document.getElementById('p-type-achat').value;
  var fournisseurGroup = document.getElementById('p-fournisseur-group');
  var vendeurSection = document.getElementById('p-vendeur-section');
  if (type === 'FOURNISSEUR') {
    fournisseurGroup.style.display = 'block';
    if (vendeurSection) vendeurSection.style.display = 'none';
  } else {
    fournisseurGroup.style.display = 'none';
    if (vendeurSection) vendeurSection.style.display = 'block';
  }
}

function previewPhoto(input) {
  if(input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('p-photo-img').src = e.target.result;
      document.getElementById('p-photo-preview').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ===== CALCULATEUR DE RACHAT =====
async function calculerRachatIA() {
  var modele = document.getElementById('rc-modele').value.trim();
  if(!modele){showNotif('Entrez un modèle','error');return;}

  var grade    = document.getElementById('rc-grade').value;
  var stockage = document.getElementById('rc-stockage').value;
  var batterie = document.getElementById('rc-batterie').value || '85';
  var ecran    = document.getElementById('rc-ecran').value;
  var remarques= document.getElementById('rc-remarques').value.trim();

  // Historique similaires dans le stock
  var similaires = phones.filter(function(p){
    return p.modele.toLowerCase().includes(modele.toLowerCase().split(' ')[0]);
  });
  var histoTexte = similaires.length > 0
    ? similaires.slice(0,5).map(function(p){
        return p.modele+' Grade '+(p.grade||'A')+' '+( p.stockage||'?')+'Go → acheté '+p.achat+'€, vendu '+p.vente+'€';
      }).join('\n')
    : 'Aucun historique pour ce modèle';

  var btn = document.getElementById('rc-btn');
  btn.textContent = '⏳ Analyse en cours...'; btn.disabled = true;
  document.getElementById('rachat-result').innerHTML =
    '<div style="text-align:center;padding:30px;color:var(--text-muted);">'+
    '🔍 L\'IA consulte les prix BackMarket et analyse votre historique...<br>'+
    '<span style="font-size:12px;margin-top:8px;display:block;">Cela prend environ 10 secondes</span></div>';

  var prompt =
    'Tu es expert en rachat de smartphones reconditionnés pour "Solution Phone", boutique à Mâcon.\n\n'+
    'Smartphone à racheter :\n'+
    '- Modèle : '+modele+'\n'+
    '- Stockage : '+stockage+'Go\n'+
    '- Grade : '+grade+'\n'+
    '- Batterie : '+batterie+'%\n'+
    '- État écran : '+ecran+'\n'+
    (remarques?'- Remarques : '+remarques+'\n':'')+
    '\nHistorique de rachats similaires dans notre boutique :\n'+histoTexte+'\n\n'+
    'Analyse les prix actuels sur BackMarket.fr pour ce modèle exact ('+stockage+'Go, grade '+grade+') et donne une estimation de rachat précise.\n\n'+
    'Réponds UNIQUEMENT avec ce format JSON exact, sans texte avant ni après :\n'+
    '{\n'+
    '  "prixBackmarket": <prix de vente moyen BackMarket en €>,\n'+
    '  "prixRachatMin": <prix rachat minimum en €>,\n'+
    '  "prixRachatConseille": <prix rachat conseillé en €>,\n'+
    '  "prixRachatMax": <prix rachat maximum en €>,\n'+
    '  "prixVenteConseille": <prix de revente conseillé en €>,\n'+
    '  "margeEstimee": <marge estimée en €>,\n'+
    '  "explication": "<2-3 phrases expliquant le raisonnement, mention BackMarket, état, batterie>",\n'+
    '  "alertes": "<points de vigilance à vérifier lors du rachat ou vide si aucun>"\n'+
    '}';

  try {
    var key = getIgApiKey();
    if(!key){ showNotif('Clé API manquante — configurez-la dans Instagram/IA','error'); btn.textContent='🤖 Estimer avec l\'IA + BackMarket'; btn.disabled=false; return; }

    var resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:1000,
        tools:[{"type":"web_search_20250305","name":"web_search"}],
        messages:[{role:'user',content:prompt}]
      })
    });

    var data = await resp.json();
    var texte = data.content.map(function(b){return b.type==='text'?b.text:'';}).join('');
    var clean = texte.replace(/```json|```/g,'').trim();
    // Extraire le JSON
    var match = clean.match(/\{[\s\S]*\}/);
    if(!match) throw new Error('Format de réponse inattendu');
    var r = JSON.parse(match[0]);

    // Afficher le résultat
    document.getElementById('rachat-result').innerHTML =
      '<div style="text-align:center;padding:16px 10px;">' +

      // Prix BackMarket référence
      '<div style="background:#f8fafc;border:1px solid var(--blue);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;">'+
      '<div style="font-size:12px;color:var(--blue);font-weight:600;">📦 Prix BackMarket (réf.)</div>'+
      '<div style="font-size:22px;font-weight:800;color:var(--blue);">'+r.prixBackmarket+' €</div></div>'+

      // Prix rachat conseillé
      '<div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">💰 Prix de rachat conseillé</div>'+
      '<div style="font-size:52px;font-weight:900;color:var(--red);line-height:1;">'+r.prixRachatConseille+' €</div>'+
      '<div style="font-size:13px;color:var(--text-muted);margin:6px 0 16px;">Fourchette : <b>'+r.prixRachatMin+'€</b> — <b>'+r.prixRachatMax+'€</b></div>'+

      // Grille vente / marge
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">'+
      '<div style="background:#f8fafc;border-radius:10px;padding:12px;">'+
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Prix de revente conseillé</div>'+
      '<div style="font-size:24px;font-weight:700;color:var(--green);">'+r.prixVenteConseille+' €</div></div>'+
      '<div style="background:#f8fafc;border-radius:10px;padding:12px;">'+
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Marge estimée</div>'+
      '<div style="font-size:24px;font-weight:700;color:var(--green);">+'+r.margeEstimee+' €</div></div>'+
      '</div>'+

      // Explication
      '<div style="background:rgba(66,153,225,0.08);border:1px solid rgba(66,153,225,0.2);border-radius:10px;padding:12px;text-align:left;font-size:13px;color:var(--text-muted);margin-bottom:10px;line-height:1.6;">'+
      '🤖 '+r.explication+'</div>'+

      // Alertes
      (r.alertes ? '<div style="background:rgba(237,137,54,0.1);border:1px solid var(--warning);border-radius:10px;padding:12px;text-align:left;font-size:13px;color:var(--warning);line-height:1.6;">'+
      '⚠️ '+r.alertes+'</div>' : '')+

      '</div>';

    // Historique similaires
    document.getElementById('rachat-historique').innerHTML = similaires.length > 0
      ? similaires.map(function(p){
          return '<tr><td><b>'+p.modele+'</b></td><td>'+p.grade+'</td><td>'+(p.stockage||'?')+'Go</td><td>'+p.achat+' €</td><td>'+p.vente+' €</td><td style="color:var(--green)">+'+(p.vente-p.achat)+' €</td><td>'+fmtDate(p.dateAchat)+'</td></tr>';
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:16px;">Aucun rachat similaire dans l\'historique</td></tr>';

    showNotif('Estimation IA générée !','success');

  } catch(e) {
    document.getElementById('rachat-result').innerHTML =
      '<div style="color:var(--red);padding:20px;text-align:center;">❌ Erreur : '+e.message+'<br><span style="font-size:12px;color:var(--text-muted);">Vérifiez votre clé API dans Instagram / IA</span></div>';
    showNotif('Erreur : '+e.message,'error');
  }
  btn.textContent = '🤖 Estimer avec l\'IA + BackMarket'; btn.disabled = false;
}

function calculerRachat(){ calculerRachatIA(); }

// ===== CLIENTS =====
var clients = []; // Base clients vide - alimentée uniquement via factures smartphones
var selectedClientId = null;

function viderCacheClients(){
  if(!confirm('Vider le cache clients et recharger depuis Supabase ?')) return;
  localStorage.removeItem('sp_clients_cache');
  localStorage.removeItem('sp_hrep_cache');
  showNotif('Cache vidé — rechargement...','success');
  setTimeout(function(){ location.reload(); }, 800);
}

function importClientsPhonilab(input) {
  var file = input.files[0];
  if (!file) return;
  var statusEl = document.getElementById('clients-import-status') || document.getElementById('phonilab-status');
  if(statusEl) statusEl.textContent = '⏳ Lecture du fichier...';

  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split('\n').filter(function(l){return l.trim();});
    if (lines.length < 2) { showNotif('Fichier vide', 'error'); return; }

    var sep = ';';
    // Parser CSV en tenant compte des guillemets
    function parseCSVLine(line){
      var result = []; var cur = ''; var inQ = false;
      for(var i=0;i<line.length;i++){
        if(line[i]==='"'){ inQ=!inQ; }
        else if(line[i]===sep&&!inQ){ result.push(cur.trim()); cur=''; }
        else { cur+=line[i]; }
      }
      result.push(cur.trim());
      return result;
    }

    var headers = parseCSVLine(lines[0]).map(function(h){return h.toLowerCase().replace(/"/g,'').trim();});

    // Mapping colonnes Phonilab
    function fi(terms){ return headers.findIndex(function(h){ return terms.some(function(t){return h===t||h.includes(t);}); }); }
    function fiExact(terms){ return headers.findIndex(function(h){ return terms.some(function(t){return h===t;}); }); }
    var iPrenom  = fi(['prénom','prenom']);
    var iNom     = fiExact(['nom','name','lastname','nom client']);  // exact pour éviter 'prénom'
    var iEmail   = fi(['email']);
    var iTel     = fi(['mobile','téléphone','telephone']);
    var iAdresse = fi(['adresse']);
    var iCP      = fi(['postal','code p']);
    var iVille   = fi(['ville']);
    var iTitre   = fi(['titre','civilit']);

    var imported = 0; var skipped = 0; var newClients = []; var now = new Date().toISOString().split('T')[0];

    for (var i = 1; i < lines.length; i++) {
      if(statusEl && i % 100 === 0) statusEl.textContent = '⏳ Traitement ligne '+i+'/'+lines.length+'...';
      var cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;

      var prenom = (iPrenom >= 0 ? cols[iPrenom] : '').replace(/"/g,'').trim();
      var nom    = (iNom >= 0 ? cols[iNom] : '').replace(/"/g,'').trim();
      if (!prenom && !nom) continue;

      // Déduplication par tel ou email
      var tel = (iTel >= 0 ? cols[iTel] : '').replace(/"/g,'').trim();
      if (tel && !tel.startsWith('0') && !tel.startsWith('+')) tel = '0' + tel;
      if (tel && tel.length > 10) tel = tel.slice(tel.length-10);
      var email = (iEmail >= 0 ? cols[iEmail] : '').replace(/"/g,'').trim();

      var existe = clients.find(function(c){
        if(tel && c.tel && c.tel.replace(/\s/g,'') === tel.replace(/\s/g,'')) return true;
        if(email && c.email && c.email.toLowerCase() === email.toLowerCase()) return true;
        return false;
      });
      if (existe) { skipped++; continue; }

      var adresse = (iAdresse >= 0 ? cols[iAdresse] : '').replace(/"/g,'').trim();
      var cp      = (iCP >= 0 ? cols[iCP] : '').replace(/"/g,'').trim();
      var ville   = (iVille >= 0 ? cols[iVille] : '').replace(/"/g,'').trim();
      var civilite = (iTitre >= 0 ? cols[iTitre] : '').replace(/"/g,'').trim();
      var newClient = {
        id: Date.now() + i,
        nom: nom, prenom: prenom, civilite: civilite,
        tel: tel, email: email,
        adresse: adresse,
        cp: cp,
        ville: ville,
        notes: 'Importé Phonilab',
        dateCreation: now
      };
      clients.push(newClient);
      newClients.push(newClient);
      imported++;
    }

    clients.sort(function(a,b){return (a.nom||'').localeCompare(b.nom||'');});
    renderClients();

    if(supabaseReady && newClients.length > 0) {
      if(statusEl) statusEl.textContent = '⏳ Sauvegarde Supabase ('+newClients.length+' clients)...';
      var batches = []; var batchSize = 50;
      for(var b = 0; b < newClients.length; b += batchSize) {
        var batch = newClients.slice(b, b+batchSize).map(function(c){
          return {nom:c.nom, prenom:c.prenom, tel:c.tel, email:c.email, adresse:c.adresse, notes:c.notes, date_creation:c.dateCreation};
        });
        batches.push(supaFetch('clients','POST',batch));
      }
      Promise.all(batches).then(function(){
        var msg = '✅ Import terminé : '+imported+' clients importés, '+skipped+' déjà présents';
        showNotif(msg, 'success');
        if(statusEl) statusEl.textContent = msg;
        cacheClients(clients); // Mettre à jour le cache
      });
    } else {
      var msg = '✅ '+imported+' clients importés, '+skipped+' ignorés';
      showNotif(msg, 'success');
      if(statusEl) statusEl.textContent = msg;
    }
    input.value = '';
  };
  reader.readAsText(file, 'ISO-8859-1');
}

async function addClient() {
  var prenom = document.getElementById('cl-prenom').value.trim();
  var nom = document.getElementById('cl-nom').value.trim();
  if(!prenom && !nom){showNotif('Prénom ou Nom requis','error');return;}
  var nomComplet = (prenom+' '+nom).trim();
  var client = {
    id: Date.now(),
    nom: nomComplet,
    tel: document.getElementById('cl-tel').value.trim(),
    email: document.getElementById('cl-email').value.trim(),
    adresse: getAdresse('cl'),
    notes: document.getElementById('cl-notes').value.trim(),
    dateCreation: new Date().toISOString().split('T')[0]
  };
  clients.push(client);
  clients.sort(function(a,b){return a.nom.localeCompare(b.nom);});
  if(supabaseReady){
    var res = await supaFetch('clients','POST',{prenom:prenom,nom:nom,tel:client.tel,email:client.email,adresse:client.adresse,notes:client.notes,date_creation:client.dateCreation});
    invaliderCacheClients(); cacheClients(clients);
    if(res&&res[0]) client.id = res[0].id;
  }
  ['cl-prenom','cl-nom','cl-tel','cl-email','cl-adresse','cl-cp','cl-ville','cl-notes'].forEach(function(id){document.getElementById(id).value='';});
  closeModal('modal-add-client');
  renderClients();
  showNotif('Client '+nomComplet+' ajouté !','success');
}

function deleteClient(id) {
  if(!confirm('Supprimer ce client ?')) return;
  clients = clients.filter(function(c){return c.id!==id;});
  if(supabaseReady) supaFetch('clients','DELETE',null,'?id=eq.'+id);
  document.getElementById('client-detail-card').style.display='none';
  renderClients();
  showNotif('Client supprimé','success');
}

function showClientDetail(id) {
  selectedClientId = id;
  var c = clients.find(function(x){return x.id===id;});
  if(!c) return;

  // Historique factures
  var facClient = factures.filter(function(f){
    return f.clientNom && f.clientNom.toLowerCase().includes(c.nom.toLowerCase());
  });
  // Historique réparations
  var repClient = reparations.filter(function(r){
    return r.clientNom && r.clientNom.toLowerCase().includes(c.nom.toLowerCase());
  });
  // Historique devis
  var devClient = devisList.filter(function(d){
    return d.clientNom && d.clientNom.toLowerCase().includes(c.nom.toLowerCase());
  });

  var totalCA = facClient.reduce(function(s,f){return s+f.ttc;},0) +
                repClient.reduce(function(s,r){return s+r.prix;},0);

  var html = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
    '<div>' +
    '<div style="font-size:22px;font-weight:800;">'+c.nom+'</div>' +
    (c.tel?'<div style="color:var(--text-muted);font-size:14px;">📞 '+c.tel+'</div>':'') +
    (c.email?'<div style="color:var(--text-muted);font-size:14px;">✉️ '+c.email+'</div>':'') +
    (c.adresse?'<div style="color:var(--text-muted);font-size:14px;">📍 '+c.adresse+(c.cp||c.ville?' — '+(c.cp||'')+' '+(c.ville||''):'')+'</div>':'') +
    '<div style="font-size:13px;color:var(--text-muted);">'+
      (c.cp?'<b>CP :</b> '+c.cp+' ':'')+(c.ville?'<b>Ville :</b> '+c.ville:'')+'</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
    '<button class="btn btn-sm btn-primary" onclick="envoyerEmailClient('+id+')">📧 Email</button>' +
    '<button class="btn btn-sm" onclick="deleteClient('+id+')">🗑️</button>' +
    '</div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">' +
    '<div class="caisse-card"><div class="caisse-label">CA total</div><div class="caisse-value" style="color:var(--green)">'+totalCA.toFixed(2)+' €</div></div>' +
    '<div class="caisse-card"><div class="caisse-label">Factures</div><div class="caisse-value">'+facClient.length+'</div></div>' +
    '<div class="caisse-card"><div class="caisse-label">Réparations</div><div class="caisse-value">'+repClient.length+'</div></div>' +
    '</div>' +

    (c.notes?'<div style="padding:10px;background:#f8fafc;border-radius:8px;font-size:13px;margin-bottom:16px;color:var(--text-muted);">📝 '+c.notes+'</div>':'') +

    // Factures
    (facClient.length > 0 ? '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">🧾 Factures</div>' +
    '<table><thead><tr><th>N°</th><th>Date</th><th>Appareil</th><th>Montant</th><th></th></tr></thead><tbody>' +
    facClient.map(function(f){
      var p=phones.find(function(x){return x.id===f.phoneId;});
      return '<tr><td><b>'+f.numero+'</b></td><td>'+fmtDate(f.date)+'</td><td>'+(p?p.modele:'—')+'</td><td><b>'+f.ttc+' €</b></td><td><button class="btn btn-sm" onclick="reprintFacture('+f.id+')">🖨️</button></td></tr>';
    }).join('') + '</tbody></table>' : '') +

    // Réparations
    (repClient.length > 0 ? '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin:12px 0 8px;">🔧 Réparations</div>' +
    '<table><thead><tr><th>N°</th><th>Date</th><th>Réparation</th><th>Montant</th><th></th></tr></thead><tbody>' +
    repClient.map(function(r){
      return '<tr><td><b>'+r.numero+'</b></td><td>'+fmtDate(r.date)+'</td><td>'+r.description+'</td><td><b>'+r.prix.toFixed(2)+' €</b></td><td><button class="btn btn-sm" onclick="reprintRep('+r.id+')">🖨️</button></td></tr>';
    }).join('') + '</tbody></table>' : '') +

    // Devis
    (devClient.length > 0 ? '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin:12px 0 8px;">📝 Devis</div>' +
    '<table><thead><tr><th>N°</th><th>Date</th><th>Prestation</th><th>Montant</th></tr></thead><tbody>' +
    devClient.map(function(d){
      return '<tr><td><b>'+d.numero+'</b></td><td>'+fmtDate(d.date)+'</td><td>'+d.prestation+'</td><td><b>'+d.prix.toFixed(2)+' €</b></td></tr>';
    }).join('') + '</tbody></table>' : '');

  document.getElementById('client-detail-content').innerHTML = html;
  document.getElementById('client-detail-card').style.display = 'block';

  // Marquer actif
  document.querySelectorAll('.client-item').forEach(function(el){el.classList.remove('active');});
  var item = document.getElementById('client-item-'+id);
  if(item) item.classList.add('active');
}

async function envoyerEmailClient(id) {
  var c = clients.find(function(x){return x.id===id;});
  if(!c||!c.email){showNotif('Aucun email pour ce client','error');return;}
  showNotif('Email envoyé à '+c.email,'success');
}

function renderClients(){
  var search = ((document.getElementById('client-search')||{value:''}).value).toLowerCase();
  var liste = clients.slice();
  if(search) liste = liste.filter(function(c){
    return (c.nom||'').toLowerCase().includes(search) ||
           (c.prenom||'').toLowerCase().includes(search) ||
           (c.tel||'').includes(search) ||
           (c.email||'').toLowerCase().includes(search);
  });
  liste.sort(function(a,b){return (a.nom||'').localeCompare(b.nom||'');});

  var countEl = document.getElementById('clients-count');
  if(countEl) countEl.textContent = liste.length + ' client(s)';

  var tbody = document.getElementById('clients-liste');
  if(!tbody) return;

  if(!liste.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text-muted);">Aucun client — les clients de la tablette apparaissent ici automatiquement</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  liste.forEach(function(c){
    var tr = document.createElement('tr');

    var tdNom = document.createElement('td');
    var b = document.createElement('b');
    b.textContent = c.nom||'—';
    tdNom.appendChild(b);

    var tdPrenom = document.createElement('td');
    tdPrenom.textContent = c.prenom||'—';

    var tdTel = document.createElement('td');
    if(c.tel){
      var a = document.createElement('a');
      a.href = 'tel:'+c.tel.replace(/\s/g,'');
      a.style.cssText='color:var(--blue);text-decoration:none;';
      a.textContent = c.tel;
      tdTel.appendChild(a);
    } else { tdTel.textContent='—'; }

    var tdEmail = document.createElement('td');
    tdEmail.style.fontSize='12px';
    tdEmail.textContent = c.email||'—';

    var tdAdr = document.createElement('td');
    tdAdr.style.cssText='font-size:12px;color:var(--text-muted);max-width:160px;';
    tdAdr.textContent = c.adresse||'—';

    var tdCP = document.createElement('td');
    tdCP.style.cssText='font-size:12px;color:var(--text-muted);';
    tdCP.textContent = c.cp||'—';

    var tdVille = document.createElement('td');
    tdVille.style.cssText='font-size:12px;color:var(--text-muted);';
    tdVille.textContent = c.ville||'—';

    var tdNotes = document.createElement('td');
    tdNotes.style.cssText='font-size:12px;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    tdNotes.textContent = c.notes||'—';

    var tdAct = document.createElement('td');
    tdAct.style.cssText='display:flex;gap:4px;';
    var btnR=document.createElement('button'); btnR.className='btn btn-primary btn-sm'; btnR.textContent='🔧'; btnR.setAttribute('title','Nouvelle r\u00e9paration'); (function(id){btnR.onclick=function(){clientVersReparation(id);};})(c.id);
    var btnV=document.createElement('button'); btnV.className='btn btn-sm'; btnV.textContent='👁️'; btnV.setAttribute('title','D\u00e9tail'); (function(id){btnV.onclick=function(){voirClientDetail(id);};})(c.id);
    var btnD=document.createElement('button'); btnD.className='btn btn-sm'; btnD.textContent='🗑️'; btnD.title='Supprimer'; btnD.style.color='var(--text-dim)'; (function(id){btnD.onclick=function(){supprimerClient(id);};})(c.id);
    tdAct.appendChild(btnR); tdAct.appendChild(btnV); tdAct.appendChild(btnD);

    [tdNom,tdPrenom,tdTel,tdEmail,tdAdr,tdCP,tdVille,tdNotes,tdAct].forEach(function(td){tr.appendChild(td);});
    tbody.appendChild(tr);
  });
}

function clientVersReparation(id){
  var c = clients.find(function(x){ return String(x.id)===String(id); });
  if(!c) return;
  showPage('reparations', null);
  repNewDossier();
  setTimeout(function(){
    document.getElementById('rep-civilite').value = c.civilite||'';
    document.getElementById('rep-nom').value      = c.nom||'';
    document.getElementById('rep-prenom').value   = c.prenom||'';
    document.getElementById('rep-tel').value      = c.tel||'';
    document.getElementById('rep-email').value    = c.email||'';
    // Décomposer adresse si besoin
    if(c.adresse){
      var parts = c.adresse.split(',');
      var rue = parts[0]?parts[0].trim():'';
      var rest = parts[1]?parts[1].trim():'';
      var cpMatch = rest.match(/^(\d{4,5})\s*(.*)/);
      document.getElementById('rep-adresse').value = rue;
      document.getElementById('rep-cp').value    = cpMatch?cpMatch[1]:'';
      document.getElementById('rep-ville').value = cpMatch?cpMatch[2].trim():rest;
    }
    repAutoSave();
    showNotif((c.prenom||'')+' '+(c.nom||'')+' chargé dans Réparations', 'success');
  }, 300);
}

function voirClientDetail(id){
  var c = clients.find(function(x){ return String(x.id)===String(id); });
  if(!c) return;
  var card = document.getElementById('client-detail-card');
  var content = document.getElementById('client-detail-content');
  if(!card||!content) return;
  content.innerHTML = '';

  // En-tête
  var header = document.createElement('div');
  header.className = 'card-header';
  var title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = '👤 '+(c.prenom?c.prenom+' ':'')+c.nom;
  var btnClose = document.createElement('button');
  btnClose.className = 'btn btn-sm';
  btnClose.textContent = '✕';
  btnClose.onclick = function(){ card.style.display='none'; };
  var btnRep = document.createElement('button');
  btnRep.className = 'btn btn-primary btn-sm';
  btnRep.textContent = '🔧 Nouvelle réparation';
  btnRep.onclick = function(){ clientVersReparation(c.id); };
  var btnDiv = document.createElement('div');
  btnDiv.style.display='flex'; btnDiv.style.gap='8px';
  btnDiv.appendChild(btnRep); btnDiv.appendChild(btnClose);
  header.appendChild(title); header.appendChild(btnDiv);
  content.appendChild(header);

  // Infos client
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:14px;';
  // Adresse complète
  var adresseFull = c.adresse || '';
  var cpVille = [(c.cp||'').trim(),(c.ville||'').trim()].filter(Boolean).join(' ');
  if(cpVille) adresseFull = adresseFull ? adresseFull+', '+cpVille : cpVille;

  [['Téléphone',c.tel||'—'],['Email',c.email||'—'],['Adresse',adresseFull||'—'],['Notes',c.notes||'—']].forEach(function(info){
    var d=document.createElement('div');
    var b=document.createElement('b'); b.textContent=info[0]+' : ';
    d.appendChild(b); d.appendChild(document.createTextNode(info[1]));
    grid.appendChild(d);
  });
  content.appendChild(grid);

  // Historique réparations
  var searchKey = (c.prenom?c.prenom+' ':'')+c.nom;
  var hist = getHistoriqueClient(searchKey);
  if(!hist.length && c.tel) hist = getHistoriqueClient(c.tel);

  var histTitle = document.createElement('div');
  histTitle.style.cssText = 'font-weight:800;font-size:13px;margin-bottom:10px;';
  histTitle.textContent = '🔧 Historique réparations ('+hist.length+')';
  content.appendChild(histTitle);

  if(!hist.length){
    var noHist = document.createElement('div');
    noHist.style.cssText = 'font-size:13px;color:var(--text-muted);padding:12px 0;';
    noHist.textContent = 'Aucune réparation trouvée';
    content.appendChild(noHist);
  } else {
    var table = document.createElement('table');
    table.style.width='100%';
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>N°</th><th>Date</th><th>Appareil</th><th>Statut</th><th>Paiement</th><th>Source</th></tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    hist.forEach(function(r){
      var tr = document.createElement('tr');
      var dateStr = (r.date_rep||'').substring(0,10);
      var statusColor = r.statut && r.statut.includes('ermin') ? 'var(--green)' : 'var(--warning)';
      tr.innerHTML = '<td><b>'+(r.numero||'—')+'</b></td>'+
        '<td style="font-size:12px;color:var(--text-muted);">'+dateStr+'</td>'+
        '<td><b>'+(r.modele||r.appareil||'—')+'</b></td>'+
        '<td style="font-size:12px;color:'+statusColor+';">'+(r.statut||'—')+'</td>'+
        '<td style="font-size:12px;">'+(r.paiement||'—')+'</td>'+
        '<td><span style="font-size:11px;padding:2px 6px;border-radius:10px;background:'+(r.source==='app'?'#e0f2fe':'#f0fdf4')+';color:'+(r.source==='app'?'#0369a1':'#166534')+';">'+(r.source==='app'?'App':'Phonilab')+'</span></td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    content.appendChild(table);
  }

  card.style.display = 'block';
  card.scrollIntoView({behavior:'smooth'});
}

function editPhone(id) {
  var p = phones.find(function(x){return x.id===id;});
  if(!p) return;
  document.getElementById('edit-p-id').value = id;
  document.getElementById('edit-p-modele').value = p.modele||'';
  document.getElementById('edit-p-stockage').value = p.stockage||'';
  document.getElementById('edit-p-grade').value = p.grade||'A';
  document.getElementById('edit-p-batterie').value = p.batterie||'';
  document.getElementById('edit-p-imei').value = p.imei||'';
  document.getElementById('edit-p-achat').value = p.achat||'';
  document.getElementById('edit-p-vente').value = p.vente||'';
  document.getElementById('edit-p-mode').value = p.mode||'ESPECES';
  document.getElementById('edit-p-date-achat').value = p.dateAchat||'';
  document.getElementById('edit-p-couleur').value = p.couleur||'';
  document.getElementById('edit-p-type-achat').value = p.typeAchat||'PARTICULIER';
  populateFournisseurSelects(p.fournisseur||'Wegacell');
  toggleEditFournisseur();
  updateEditMarge();
  openModal('modal-edit-phone');
}

function toggleEditFournisseur() {
  var type = document.getElementById('edit-p-type-achat').value;
  document.getElementById('edit-p-fournisseur-group').style.display = type==='FOURNISSEUR'?'block':'none';
}

function updateEditMarge() {
  var a = parseFloat(document.getElementById('edit-p-achat').value)||0;
  var v = parseFloat(document.getElementById('edit-p-vente').value)||0;
  var m = v-a;
  document.getElementById('edit-marge-preview').textContent = 'Marge : '+m.toFixed(2)+' € ('+(a>0?((m/a)*100).toFixed(1):0)+'%)';
}

function savePhoneEdit() {
  var id = parseInt(document.getElementById('edit-p-id').value);
  var p = phones.find(function(x){return x.id===id;});
  if(!p) return;
  var modele = document.getElementById('edit-p-modele').value.trim();
  var achat = parseFloat(document.getElementById('edit-p-achat').value);
  var vente = parseFloat(document.getElementById('edit-p-vente').value);
  if(!modele||!achat||!vente){showNotif('Modèle, achat et vente requis','error');return;}
  p.modele = modele;
  p.stockage = parseInt(document.getElementById('edit-p-stockage').value)||null;
  p.grade = document.getElementById('edit-p-grade').value;
  p.batterie = parseInt(document.getElementById('edit-p-batterie').value)||null;
  p.imei = document.getElementById('edit-p-imei').value.trim();
  p.achat = achat;
  p.vente = vente;
  p.mode = document.getElementById('edit-p-mode').value;
  p.dateAchat = document.getElementById('edit-p-date-achat').value;
  p.couleur = document.getElementById('edit-p-couleur').value.trim();
  p.typeAchat = document.getElementById('edit-p-type-achat').value;
  p.fournisseur = p.typeAchat==='FOURNISSEUR'?document.getElementById('edit-p-fournisseur').value:'';
  savePhone(p);
  closeModal('modal-edit-phone');
  renderPhones(); renderDashboard();
  showNotif('✅ '+modele+' mis à jour !','success');
}

function updateMarge(){var a=parseFloat((document.getElementById('p-achat').value||'0').toString().replace(',','.'))||0;var v=parseFloat((document.getElementById('p-vente').value||'0').toString().replace(',','.'))||0;document.getElementById('marge-preview').textContent='Marge : '+(v-a).toFixed(2)+' € ('+(a>0?(((v-a)/a)*100).toFixed(1):0)+'%)';}

function addPhone(){
  var modele=document.getElementById('p-modele').value.trim();
  var achatRaw=document.getElementById('p-achat').value.toString().replace(',','.');
  var venteRaw=document.getElementById('p-vente').value.toString().replace(',','.');
  var achat=parseFloat(achatRaw);
  var vente=parseFloat(venteRaw);
  if(!modele){showNotif('Modèle requis','error');return;}
  if(!achat||achat<=0){showNotif('Prix achat invalide','error');return;}
  if(!vente||vente<=0){showNotif('Prix vente invalide','error');return;}
  var phone={id:Date.now(),modele:modele,stockage:parseInt(document.getElementById('p-stockage').value)||null,grade:document.getElementById('p-grade').value,batterie:parseInt(document.getElementById('p-batterie').value)||null,imei:document.getElementById('p-imei').value.trim(),achat:achat,vente:vente,mode:document.getElementById('p-mode').value,dateAchat:document.getElementById('p-date-achat').value,couleur:document.getElementById('p-couleur').value.trim(),vendeurNom:document.getElementById('p-vendeur-nom').value.trim(),vendeurAdresse:document.getElementById('p-vendeur-adresse').value.trim(),vendeurCI:document.getElementById('p-vendeur-ci').value.trim(),vendeurCIDate:document.getElementById('p-vendeur-ci-date').value,typeAchat:document.getElementById('p-type-achat').value,fournisseur:document.getElementById('p-type-achat').value==='FOURNISSEUR'?document.getElementById('p-fournisseur').value:'',numPolice:phones.length+1,etat:'DISPONIBLE',dateVente:null,isNew:true};
  if(phone.mode==='ESPECES'&&phone.dateAchat){var entry=caisse.find(function(c){return c.date===phone.dateAchat;});if(entry){entry.achatSmart=(entry.achatSmart||0)+achat;saveCaisseRow(entry);}}
  phones.push(phone);savePhone(phone);
  ['p-modele','p-achat','p-vente','p-batterie','p-imei','p-couleur','p-vendeur-nom','p-vendeur-adresse','p-vendeur-ci','p-vendeur-ci-date','p-photo'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('p-photo-preview').style.display='none';
  closeModal('modal-add-phone');renderPhones();renderDashboard();
  showNotif(modele+' ajouté !','success');
}

function renderPhones(){
  var s=(document.getElementById('search-phones')?document.getElementById('search-phones').value:'').toLowerCase();
  // Afficher UNIQUEMENT les téléphones non vendus dans le stock
  var f=phones.filter(function(p){
    if(p.etat==='VENDU') return false;
    return !s||p.modele.toLowerCase().indexOf(s)>=0||(p.imei||'').indexOf(s)>=0;
  });

  // Bandeau récapitulatif
  var nbVendus=phones.filter(function(p){return p.etat==='VENDU';}).length;
  var nbDispo=phones.filter(function(p){return p.etat==='DISPONIBLE';}).length;
  var nbRepa=phones.filter(function(p){return p.etat==='EN_REPARATION';}).length;
  var existing=document.getElementById('phones-recap-bar');
  if(existing)existing.remove();
  var card=document.querySelector('#page-phones .card');
  if(card){
    var bar=document.createElement('div');
    bar.id='phones-recap-bar';
    bar.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;';
    var d1=document.createElement('div');
    d1.style.cssText='background:rgba(72,187,120,0.12);border:1px solid var(--green);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--green);';
    d1.textContent='✅ Disponibles : '+nbDispo;
    bar.appendChild(d1);
    if(nbRepa){
      var d2=document.createElement('div');
      d2.style.cssText='background:rgba(66,153,225,0.12);border:1px solid var(--blue);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--blue);';
      d2.textContent='🔧 En répa : '+nbRepa;
      bar.appendChild(d2);
    }
    var d3=document.createElement('div');
    d3.style.cssText='background:rgba(229,62,62,0.08);border:1px solid rgba(229,62,62,0.3);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;color:var(--text-muted);';
    d3.innerHTML='💹 Vendus : <b>'+nbVendus+'</b> — <span style="cursor:pointer;text-decoration:underline;color:var(--red);" onclick="goToVentesSmartphones()">Voir le rapport →</span>';
    bar.appendChild(d3);
    card.insertBefore(bar,card.firstChild);
  }

  document.getElementById('phones-table').innerHTML=f.map(function(p){
    var m=p.vente-p.achat;
    var badge=p.etat==='EN_REPARATION'?'badge-blue':'badge-green';
    var etatLabel=p.etat==='EN_REPARATION'?'🔧 EN RÉPA':'✅ DISPO';
    var photoHtml=p.photo?'<img src="'+p.photo+'" style="width:36px;height:36px;object-fit:cover;border-radius:4px;margin-right:6px;vertical-align:middle;">':'';
    var sourceHtml=p.fournisseur?'<br><span style="font-size:11px;color:var(--blue)">🏢 '+p.fournisseur+'</span>':p.typeAchat==='PARTICULIER'?'<br><span style="font-size:11px;color:var(--text-muted)">👤 Particulier</span>':'';
    var joursStock='';
    if(p.etat==='DISPONIBLE'&&p.dateAchat){
      var days=Math.floor((new Date()-new Date(p.dateAchat))/86400000);
      if(days>30)joursStock='<br><span style="font-size:11px;color:var(--warning)">⚠️ '+days+'j en stock</span>';
      else if(days>15)joursStock='<br><span style="font-size:11px;color:var(--blue)">'+days+'j</span>';
    }
    return '<tr>'+
      '<td>'+photoHtml+'<b>'+p.modele+'</b>'+sourceHtml+joursStock+'</td>'+
      '<td>'+(p.stockage?p.stockage+'Go':'—')+'</td>'+
      '<td><span class="badge badge-blue">'+(p.grade||'—')+'</span></td>'+
      '<td>'+(p.batterie?p.batterie+'%':'—')+'</td>'+
      '<td style="font-size:11px">'+(p.imei||'—')+'</td>'+
      '<td>'+p.achat+' €</td>'+
      '<td>'+p.vente+' €</td>'+
      '<td style="color:var(--green)"><b>'+m.toFixed(0)+' €</b></td>'+
      '<td><span class="badge '+badge+'">'+etatLabel+'</span></td>'+
      '<td style="display:flex;gap:4px;flex-wrap:wrap;">'+
        '<button class="btn btn-sm" onclick="editPhone('+p.id+')" title="Modifier">✏️</button>'+
        '<button class="btn btn-sm" onclick="showEtiquette('+p.id+')">🏷️</button>'+
        '<button class="btn btn-sm" onclick="printCertificat('+p.id+')">📄</button>'+
        '<button class="btn btn-sm" onclick="marquerReparation('+p.id+')" title="En réparation">🔧</button>'+
        '<button class="btn btn-sm btn-primary" onclick="marquerVendu('+p.id+')" title="Marquer vendu">✅ Vendu</button>'+
        '<button class="btn btn-sm" onclick="deletePhone('+p.id+')">🗑️</button>'+
      '</td></tr>';
  }).join('')||'<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-dim)">📦 Aucun smartphone en stock</td></tr>';
}

function marquerReparation(id){
  var p=phones.find(function(x){return x.id===id;});if(!p)return;
  if(p.etat==='EN_REPARATION'){p.etat='DISPONIBLE';}else{p.etat='EN_REPARATION';}
  savePhone(p);renderPhones();renderDashboard();
  showNotif(p.modele+(p.etat==='EN_REPARATION'?' mis en réparation':' remis disponible'),'success');
}

async function verifierIMEI(imei) {
  if(!imei || imei.length < 10) return;
  // Vérification basique format IMEI
  if(!/^\d{14,15}$/.test(imei)) {
    showNotif('Format IMEI invalide (15 chiffres requis)', 'error');
    return;
  }
  showNotif('Vérification IMEI...', 'info');
  // Vérifier dans notre base locale
  var existant = phones.find(function(p){ return p.imei === imei; });
  if(existant) {
    showNotif('⚠️ Cet IMEI est déjà dans votre stock : ' + existant.modele, 'error');
    return;
  }
  showNotif('✅ IMEI non trouvé dans votre stock', 'success');
}

function marquerVendu(id){
  var p=phones.find(function(x){return x.id===id;});
  if(!p)return;
  if(!confirm('Marquer '+p.modele+' comme VENDU ?\nIl sera retiré du stock et ajouté au rapport des ventes.'))return;
  p.etat='VENDU';
  p.dateVente=new Date().toISOString().split('T')[0];
  savePhone(p);
  renderPhones();
  renderDashboard();
  showNotif('✅ '+p.modele+' vendu — visible dans Ventes Smartphones','success');
}
function marquerDispo(id){var p=phones.find(function(x){return x.id===id;});if(!p)return;p.etat='DISPONIBLE';p.dateVente=null;savePhone(p);renderPhones();renderDashboard();showNotif(p.modele+' remis en stock','success');}

function goToVentesSmartphones(){
  showPage('ventes-smart', null);
  renderVentesSmartphones();
}

function annulerVente(id){
  var p=phones.find(function(x){return x.id===id;});
  if(!p)return;
  if(!confirm('Remettre '+p.modele+' en stock ?\nIl sera retiré du rapport des ventes.'))return;
  p.etat='DISPONIBLE';
  p.dateVente=null;
  savePhone(p);
  renderVentesSmartphones();
  renderDashboard();
  showNotif('↩️ '+p.modele+' remis en stock','success');
}
function deletePhone(id){if(!confirm('Supprimer ?'))return;phones=phones.filter(function(x){return x.id!==id;});if(supabaseReady)supaFetch('phones','DELETE',null,'?id=eq.'+id);renderPhones();renderDashboard();showNotif('Supprimé','success');}

var curPhone=null;
var _etiquettePhone = null;

function buildEtiquetteHTML(p, opts){
  opts = opts || {};
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var showGrade    = opts.grade    !== false;
  var showStockage = opts.stockage !== false;
  var showBatterie = opts.batterie === true;
  var showImei     = opts.imei     !== false;
  var showGarantie = opts.garantie !== false;
  var imei6 = p.imei ? p.imei : '';
  var modeleShort = (p.modele||'').replace('Apple ','').replace('Samsung ','');
  var prixAffiche = p.vente ? String(p.vente) : (p.prix ? String(p.prix) : '—');

  // Conteneur principal 90mm × 29mm
  var html = '<div style="width:90mm;height:29mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:row;overflow:hidden;box-sizing:border-box;border:0.3mm solid #ddd;">';

  // BANDE ROUGE GAUCHE — simple liseré
  html += '<div style="width:4mm;background:#c0392b;flex-shrink:0;"></div>';

  // CONTENU — colonne gauche (infos) + colonne droite (prix)
  html += '<div style="flex:1;display:flex;flex-direction:row;padding:1mm 1.5mm;gap:1mm;overflow:hidden;">';

  // ── COLONNE GAUCHE ──
  html += '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;min-width:0;">';

  // Modèle
  html += '<div style="font-size:11pt;font-weight:900;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;">'+modeleShort+'</div>';

  // Badges : Stockage + Grade + Batterie
  html += '<div style="display:flex;flex-wrap:nowrap;gap:1mm;align-items:center;">';
  if(showStockage && p.stockage){
    html += '<span style="background:#c0392b;color:#fff;font-size:6pt;font-weight:900;padding:0.5mm 1.5mm;border-radius:1mm;white-space:nowrap;">'+p.stockage+' Go</span>';
  }
  if(showGrade && p.grade){
    html += '<span style="background:#c0392b;color:#fff;font-size:6pt;font-weight:900;padding:0.5mm 1.5mm;border-radius:1mm;white-space:nowrap;">Grade '+p.grade+'</span>';
  }
  if(showBatterie && p.batterie){
    html += '<span style="background:#c0392b;color:#fff;font-size:6pt;font-weight:900;padding:0.5mm 1.5mm;border-radius:1mm;white-space:nowrap;">\uD83D\uDD0B '+p.batterie+'%</span>';
  }
  html += '</div>';

  // IMEI + Garantie
  html += '<div style="display:flex;flex-direction:column;gap:0.3mm;">';
  if(showImei && imei6){
    html += '<span style="font-size:5pt;color:#000;font-weight:700;font-family:monospace;white-space:nowrap;">IMEI:'+imei6+'</span>';
  }
  if(showGarantie){
    html += '<span style="font-size:5.5pt;color:#1a5c30;font-weight:700;">\u2713 Gar. '+(p.grade?'12 mois':'24 mois')+'</span>';
  }
  html += '</div>';

  // Pied
  html += '<div style="font-size:3.5pt;color:#aaa;border-top:0.2mm solid #eee;padding-top:0.4mm;white-space:nowrap;overflow:hidden;">SP · 21 Rue Gambetta · Mâcon · TVA marge Art.297A</div>';

  html += '</div>'; // fin colonne gauche

  // ── COLONNE DROITE — PRIX ──
  html += '<div style="width:22mm;min-width:22mm;max-width:22mm;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border-left:0.5mm solid #eee;">';
  html += '<span style="font-size:13pt;font-weight:900;color:#c0392b;line-height:1.1;text-align:center;">'+prixAffiche+'&euro;</span>';
  html += '</div>';

  html += '</div>'; // fin contenu
  html += '</div>'; // fin étiquette
  return html;
}

function showEtiquette(id){
  _etiquettePhone = phones.find(function(x){return x.id===id;});
  if(!_etiquettePhone) return;
  curPhone = _etiquettePhone;
  refreshEtiquette();
  openModal('modal-etiquette');
}

function refreshEtiquette(){
  if(!_etiquettePhone) return;
  var opts = {
    grade:    document.getElementById('etiq-show-grade').checked,
    stockage: document.getElementById('etiq-show-stockage').checked,
    batterie: document.getElementById('etiq-show-batterie').checked,
    imei:     document.getElementById('etiq-show-imei').checked,
    garantie: document.getElementById('etiq-show-garantie').checked
  };
  var prev = document.getElementById('etiquette-preview');
  prev.innerHTML = buildEtiquetteHTML(_etiquettePhone, opts);
  if(prev.firstChild){
    prev.firstChild.style.transform = 'scale(1.2)';
    prev.firstChild.style.transformOrigin = 'top left';
    prev.style.width = '108mm';
    prev.style.height = '35mm';
    prev.style.overflow = 'visible';
  }
}

function printEtiquetteBrother(){
  if(!_etiquettePhone) return;
  var opts = {
    grade:    document.getElementById('etiq-show-grade').checked,
    stockage: document.getElementById('etiq-show-stockage').checked,
    batterie: document.getElementById('etiq-show-batterie').checked,
    imei:     document.getElementById('etiq-show-imei').checked,
    garantie: document.getElementById('etiq-show-garantie').checked
  };
  var qty = parseInt(document.getElementById('etiq-qty').value)||1;
  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
    '<title>Etiquette '+_etiquettePhone.modele+'</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:90mm;background:#fff;}'+
    '@page{size:90mm 29mm;margin:0;}'+
    '@media print{.no-print{display:none!important;}.etiq-wrap{page-break-after:always;}.etiq-wrap:last-child{page-break-after:avoid;}}'+
    'body{font-family:Arial,Helvetica,sans-serif;}</style></head><body>'+
    '<div class="no-print" style="padding:10px;background:#f5f5f5;text-align:center;margin-bottom:10px;">'+
      '<b style="color:#c0392b;">Brother QL-820NWB &bull; DK-11201 &bull; 29&times;90mm</b><br>'+
      '<small>S&eacute;lectionnez <b>Brother QL-820NWB</b> dans la liste des imprimantes &bull; Format : DK-11201</small><br><br>'+
      '<button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">'+
        '&#128438; Imprimer '+qty+' &eacute;tiquette'+(qty>1?'s':'')+'</button>'+
    '</div>';
  for(var j=0;j<qty;j++) html += '<div class="etiq-wrap">'+buildEtiquetteHTML(_etiquettePhone, opts)+'</div>';
  html += '</body></html>';
  var w = window.open('','_blank','width=800,height=400');
  w.document.write(html);
  w.document.close();
}

// Garde compatibilité ancienne fonction
function printEtiquette(){ printEtiquetteBrother(); }


function getQRCodeURL(text) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent(text);
}

function printCertificat(id){
  var p=phones.find(function(x){return x.id===id;});if(!p)return;
  var w=window.open('','_blank','width=650,height=850');
  var h='<!DOCTYPE html><html><head><title>Certificat</title><style>body{font-family:Arial,sans-serif;padding:40px;font-size:13px;}.box{border:1px solid #000;padding:28px;}.l{display:flex;align-items:flex-end;gap:8px;margin-bottom:14px;}.lv{flex:1;border-bottom:1px dotted #333;min-height:18px;padding-left:4px;font-weight:600;}h1{text-align:center;font-size:15px;border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:22px;text-transform:uppercase;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:50px;}.sig{border-top:1px solid #000;padding-top:8px;font-size:12px;}@media print{body{padding:20px;}}</style></head><body><div class="box"><h1>Certificat de vente d\'un smartphone ou d\'une tablette</h1><div class="l"><span>Je soussigné(e)</span><span class="lv">'+(p.vendeurNom||'')+'</span></div><div class="l"><span>Carte d\'identité n°</span><span class="lv">'+(p.vendeurCI||'')+'</span><span>délivrée le</span><span class="lv">'+fmtDate(p.vendeurCIDate)+'</span></div><div class="l"><span>Demeurant au</span><span class="lv">'+(p.vendeurAdresse||'')+'</span></div><div class="l"><span>Déclare avoir vendu le</span><span class="lv">'+fmtDate(p.dateAchat)+'</span><span>à</span><span class="lv">Solution Phone — 21 Rue Gambetta 71000 Mâcon</span></div><p style="font-weight:bold;margin:16px 0 10px">Description de l\'appareil :</p><div class="l"><span>Modèle :</span><span class="lv">'+(p.modele||'')+'</span></div><div class="l"><span>Couleur :</span><span class="lv">'+(p.couleur||'')+'</span></div><div class="l"><span>IMEI :</span><span class="lv">'+(p.imei||'')+'</span></div><div class="l"><span>Prix :</span><span class="lv">'+p.achat+' €</span></div><p style="margin-top:20px;font-size:12px;font-style:italic">Je certifie sur l\'honneur que ce produit est en règle avec les douanes françaises, que toutes les taxes ont été acquittées et qu\'il n\'est ni déclaré perdu ou volé.</p><div class="l" style="margin-top:22px"><span>Fait à</span><span class="lv">Mâcon</span><span>le</span><span class="lv">'+fmtDate(p.dateAchat)+'</span></div><div class="sigs"><div class="sig">Nom et signature du vendeur<br><br><br></div><div class="sig" style="text-align:right">Nom et signature de l\'acheteur<br><br><br></div></div></div><script>window.onload=function(){window.print();}<\/script></body></html>';
  w.document.write(h);w.document.close();
}

var curFacPhone=null;
function renderFactures(){
  var sel=document.getElementById('f-phone');
  if(sel){sel.innerHTML='<option value="">-- Sélectionner --</option>'+phones.filter(function(p){return p.etat==='DISPONIBLE';}).map(function(p){return'<option value="'+p.id+'">'+p.modele+(p.stockage?' '+p.stockage+'Go':'')+' - '+p.vente+'€</option>';}).join('');}
  document.getElementById('factures-table').innerHTML=factures.map(function(f){var p=phones.find(function(x){return x.id===f.phoneId;});return'<tr><td><b>'+(f.numero||'')+'</b></td><td>'+fmtDate(f.date)+'</td><td>'+(f.clientNom||'—')+'</td><td>'+(p?p.modele:'—')+'</td><td><b>'+f.ttc+' €</b></td><td style="display:flex;gap:4px;"><button class="btn btn-sm" onclick="reprintFacture('+f.id+')">🖨️</button><button class="btn btn-sm btn-primary" onclick="envoyerEmail('+f.id+')">📧</button></td></tr>';}).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-dim)">Aucune facture</td></tr>';
}

// ============================================================
//  TEMPLATE A4 — FACTURES & DEVIS — Solution Phone
// ============================================================

function buildA4HTML(opts){
  var _tampStr = _tampStr || '';
  // opts : { type, numero, date, clientNom, clientAdresse, clientEmail,
  //          lignes:[{desc,qte,pu}], total, mode, garantie, notes, isDevis, validite }
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var today = fmtDate(opts.date || new Date().toISOString().split('T')[0]);

  var lignesHTML = (opts.lignes||[]).map(function(l){
    var montant = (l.qte * l.pu).toFixed(2);
    return '<tr>'+
      '<td style="padding:12px 14px;border-bottom:1px solid #eee;font-size:13px;">'+l.desc+'</td>'+
      '<td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:center;font-size:13px;">'+l.qte+'</td>'+
      '<td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;">'+parseFloat(l.pu).toFixed(2)+' €</td>'+
      '<td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:700;">'+montant+' €</td>'+
      '</tr>';
  }).join('');

  var totalFormate = parseFloat(opts.total).toFixed(2);
  var typeBadge = opts.isDevis ? 'DEVIS' : 'FACTURE';
  var couleur = '#c0392b';

  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
  '<title>'+typeBadge+' '+opts.numero+'</title>'+
  '<style>'+
    '*{margin:0;padding:0;box-sizing:border-box;}'+
    'body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:14px;}'+
    '.page{width:210mm;min-height:297mm;margin:0 auto;padding:12mm 14mm;position:relative;}'+
    '@media print{.no-print{display:none!important;}.page{padding:10mm 12mm;margin:0;width:100%;}}'+
    '@page{size:A4;margin:0;}'+
  '</style></head><body>'+

  '<div class="page">'+

    // Bouton imprimer (caché à l'impression)
    '<div class="no-print" style="text-align:right;margin-bottom:10px;">'+
    '<button onclick="window.print()" style="background:'+couleur+';color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimer / PDF</button>'+
    '</div>'+

    // HEADER
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;padding-bottom:6mm;border-bottom:3px solid '+couleur+';">'+

      // Logo + infos boutique
      '<div style="display:flex;align-items:center;gap:14px;">'+
      (logo ? '<img src="'+logo+'" style="height:80px;width:auto;object-fit:contain;">' : '')+
      '<div>'+
        '<div style="font-size:22px;font-weight:900;color:'+couleur+';letter-spacing:-0.5px;">SOLUTION PHONE</div>'+
        '<div style="font-size:12px;color:#555;margin-top:3px;">Réparation Smartphone · Tablette · PC</div>'+
        '<div style="font-size:11px;color:#777;margin-top:6px;line-height:1.7;">'+
          '21 Rue Gambetta · 71000 Mâcon<br>'+
          'Tél : 03 85 33 06 89 · solution.phone71@gmail.com<br>'+
          'SIRET : 801 044 785 00021'+
        '</div>'+
      '</div></div>'+

      // Bloc FACTURE / DEVIS
      '<div style="text-align:right;">'+
        '<div style="background:'+couleur+';color:#fff;padding:8px 20px;border-radius:6px;font-size:22px;font-weight:900;letter-spacing:1px;display:inline-block;margin-bottom:8px;">'+typeBadge+'</div>'+
        '<div style="font-size:15px;font-weight:700;color:#333;">N° '+opts.numero+'</div>'+
        '<div style="font-size:12px;color:#777;margin-top:4px;">Date : '+today+'</div>'+
        (opts.isDevis && opts.validite ? '<div style="font-size:12px;color:#777;">Validité : '+opts.validite+'</div>' : '')+
        (opts.mode ? '<div style="font-size:12px;color:#777;margin-top:2px;">Règlement : '+opts.mode+'</div>' : '')+
      '</div>'+
    '</div>'+

    // BLOC CLIENT
    '<div style="display:flex;justify-content:flex-end;margin-bottom:8mm;">'+
      '<div style="background:#f8f8f8;border-left:4px solid '+couleur+';padding:12px 18px;min-width:200px;max-width:260px;">'+
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:6px;">Client</div>'+
        '<div style="font-weight:700;font-size:14px;">'+( opts.clientNom||'—')+'</div>'+
        (opts.clientAdresse ? '<div style="font-size:12px;color:#555;margin-top:3px;">'+opts.clientAdresse+'</div>' : '')+
        (opts.clientEmail ? '<div style="font-size:12px;color:#555;">'+opts.clientEmail+'</div>' : '')+
      '</div>'+
    '</div>'+

    // TABLEAU PRESTATIONS
    '<table style="width:100%;border-collapse:collapse;margin-bottom:6mm;">'+
      '<thead><tr style="background:'+couleur+';color:#fff;">'+
        '<th style="padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Désignation</th>'+
        '<th style="padding:10px 14px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:60px;">Qté</th>'+
        '<th style="padding:10px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;">P.U.</th>'+
        '<th style="padding:10px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;">Total</th>'+
      '</tr></thead>'+
      '<tbody>'+lignesHTML+'</tbody>'+
    '</table>'+

    // TOTAL avec décomposition HT si disponible
    (function(){
      var moHT     = opts.moHT || 0;
      var piecesHT = opts.piecesHT || 0;
      var htTotal  = opts.htTotal || (parseFloat(opts.total)/1.2);
      var tva      = parseFloat(opts.total) - htTotal;
      var decompHT = (moHT > 0 || piecesHT > 0)
        ? '<div style="display:flex;justify-content:space-between;padding:6px 14px;background:#f8f8f8;font-size:11px;color:#777;">'+
            '<span>Main d\'œuvre HT</span><span>'+moHT.toFixed(2)+' €</span></div>'+
          '<div style="display:flex;justify-content:space-between;padding:6px 14px;background:#f8f8f8;font-size:11px;color:#777;border-bottom:1px solid #eee;">'+
            '<span>Pièces détachées HT</span><span>'+piecesHT.toFixed(2)+' €</span></div>'
        : '';
      return '<div style="display:flex;justify-content:flex-end;margin-bottom:8mm;">'+
        '<div style="min-width:280px;">'+
          decompHT+
          '<div style="display:flex;justify-content:space-between;padding:8px 14px;background:#f8f8f8;border-radius:4px 4px 0 0;margin-bottom:1px;">'+
            '<span style="font-size:12px;color:#777;">Total HT</span>'+
            '<span style="font-size:13px;">'+htTotal.toFixed(2)+' €</span>'+
          '</div>'+
          '<div style="display:flex;justify-content:space-between;padding:6px 14px;background:#f8f8f8;margin-bottom:4px;">'+
            '<span style="font-size:12px;color:#777;">TVA 20%</span>'+
            '<span style="font-size:13px;">'+tva.toFixed(2)+' €</span>'+
          '</div>'+
          '<div style="display:flex;justify-content:space-between;padding:14px 16px;background:'+couleur+';color:#fff;border-radius:6px;">'+
            '<span style="font-size:15px;font-weight:700;">TOTAL TTC</span>'+
            '<span style="font-size:20px;font-weight:900;">'+totalFormate+' €</span>'+
          '</div>'+
        '</div>'+
      '</div>';
    })()+

    // NOTES / GARANTIE
    (opts.notes||opts.garantie ? '<div style="background:#fff8e1;border-left:4px solid #f39c12;padding:10px 14px;border-radius:4px;margin-bottom:6mm;font-size:12px;color:#555;line-height:1.7;">'+
      (opts.garantie ? '✅ Garantie : <b>'+opts.garantie+'</b><br>' : '')+
      (opts.notes ? opts.notes : '')+
    '</div>' : '')+

    // MODE RÈGLEMENT
    (opts.mode ? '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8mm;">'+
      '<div style="background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:8px 16px;font-size:12px;color:#555;">'+
        '💳 Mode de règlement : <b style="color:#1a1a1a;">'+opts.mode+'</b>'+
      '</div>'+
    '</div>' : '')+

    // ZONE SIGNATURE
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:10mm;margin-top:4mm;">'+
      '<div style="border:1px solid #eee;border-radius:6px;padding:10px;">'+
        '<div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Signature du client</div>'+
        (opts.signature
          ? '<img src="'+opts.signature+'" style="max-width:100%;height:70px;object-fit:contain;border:1px solid #eee;border-radius:6px;">'
          : '<div style="height:60px;border-bottom:1px solid #ccc;"></div>')+
      '</div>'+
      '<div style="border:1px solid #eee;border-radius:6px;padding:10px;text-align:center;">'+
        '<div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Cachet Solution Phone</div>'+
        (_tampStr?'<img src="'+_tampStr+'" style="max-height:65px;max-width:200px;object-fit:contain;">':'<div style="height:55px;border-bottom:1px solid #ccc;"></div>')+
      '</div>'+
    '</div>'+

    // PIED DE PAGE
    '<div style="position:absolute;bottom:12mm;left:14mm;right:14mm;border-top:2px solid '+couleur+';padding-top:5mm;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<div style="font-size:10px;color:#aaa;line-height:1.8;">'+
          '<b style="color:'+couleur+';">Solution Phone</b> · 21 Rue Gambetta · 71000 Mâcon<br>'+
          'Tél : 03 85 33 06 89 · solution.phone71@gmail.com<br>'+
          'SIRET : 801 044 785 00021 · TVA non applicable — Art. 297 A du CGI (régime de la marge)'+
        '</div>'+
        '<div style="text-align:right;">'+
          '<div style="font-size:10px;color:#ccc;">'+typeBadge+' '+opts.numero+'</div>'+
        '</div>'+
      '</div>'+
    '</div>'+

  '</div>'+
  '<script>'+
    'var printBtn=document.querySelector(".no-print button");'+
    'if(printBtn){printBtn.onclick=function(){window.print();}}'+
  '<\/script>'+
  '</body></html>';
}

function ouvrirA4(html){
  var w=window.open('','_blank','width=900,height=1100');
  w.document.write(html);
  w.document.close();
}

// --- FACTURE SMARTPHONE ---
function updateFacturePreview(){
  var pid=parseInt(document.getElementById('f-phone').value);
  var p=phones.find(function(x){return x.id===pid;});
  if(!p){document.getElementById('facture-preview-card').style.display='none';return;}
  var client=document.getElementById('f-client-nom').value||'Client';
  var adresse=getAdresse('f-client');
  var num='FAC-'+new Date().getFullYear()+'-'+String(factures.length+1).padStart(3,'0');
  var desc=p.modele+(p.stockage?' '+p.stockage+'Go':'')+' Grade '+(p.grade||'A')+
    (p.imei?'\nIMEI : '+p.imei:'')+'\nSmartphone reconditionné certifié';
  document.getElementById('facture-preview-content').innerHTML=
    '<div style="text-align:center;padding:30px;color:#888;font-size:13px;">'+
    '<div style="font-size:32px;margin-bottom:8px;">🧾</div>'+
    '<b>Aperçu disponible après génération</b><br>'+
    '<span style="font-size:12px;">Cliquez sur "Générer la facture" pour voir le document A4</span></div>';
  document.getElementById('facture-preview-card').style.display='block';
  curFacPhone=p;
}

function genererFacture(){
  var pid=parseInt(document.getElementById('f-phone').value);
  var p=phones.find(function(x){return x.id===pid;});
  if(!p){showNotif('Sélectionnez un smartphone','error');return;}
  var client=document.getElementById('f-client-nom').value.trim();
  if(!client){showNotif('Nom client requis','error');return;}
  var num='FAC-'+new Date().getFullYear()+'-'+String(factures.length+1).padStart(3,'0');
  var date=new Date().toISOString().split('T')[0];
  var marge=p.vente-p.achat;var ht=marge/1.2;var tva=ht*0.2;
  var fac={id:Date.now(),numero:num,date:date,phoneId:p.id,
    clientNom:client,clientAdresse:getAdresse('f-client'),
    clientEmail:document.getElementById('f-client-email').value.trim(),
    ttc:p.vente,ht:parseFloat(ht.toFixed(2)),tva:parseFloat(tva.toFixed(2))};
  factures.push(fac);p.etat='VENDU';p.dateVente=date;savePhone(p);
  if(supabaseReady)supaFetch('factures','POST',{numero:fac.numero,date:fac.date,phone_id:fac.phoneId,
    client_nom:fac.clientNom,client_adresse:fac.clientAdresse,montant_ttc:fac.ttc,montant_ht:fac.ht,tva:fac.tva});
  renderFactures();renderPhones();renderDashboard();
  imprimerFactureData(fac,p);
  ['f-client-nom','f-client-adresse','f-client-cp','f-client-ville','f-client-email'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('f-phone').value='';
  document.getElementById('facture-preview-card').style.display='none';
  showNotif('Facture '+num+' créée !','success');
}

function imprimerFactureData(fac,p){
  var html=buildA4HTML({
    type:'facture',numero:fac.numero,date:fac.date,
    clientNom:fac.clientNom,clientAdresse:fac.clientAdresse,clientEmail:fac.clientEmail||'',
    mode:'',garantie:'6 mois',
    lignes:[{
      desc:'<b>'+p.modele+(p.stockage?' '+p.stockage+'Go':'')+' — Grade '+(p.grade||'A')+'</b>'+
           (p.imei?'<br><span style="font-size:11px;color:#888;">IMEI : '+p.imei+'</span>':'')+
           '<br><span style="font-size:11px;color:#888;">Smartphone reconditionné certifié · Garantie 6 mois</span>',
      qte:1,pu:p.vente
    }],
    total:p.vente,isDevis:false
  });
  ouvrirA4(html);
}

function imprimerFacture(){
  if(!curFacPhone){showNotif('Générez d\'abord la facture','error');return;}
  var fac=factures[factures.length-1];
  if(fac)imprimerFactureData(fac,curFacPhone);
}

function reprintFacture(id){
  var f=factures.find(function(x){return x.id===id;});if(!f)return;
  var p=phones.find(function(x){return x.id===f.phoneId;});if(!p)return;
  imprimerFactureData(f,p);
}

async function envoyerEmail(id){
  var f=factures.find(function(x){return x.id===id;});if(!f)return;
  var email=f.clientEmail||'';if(!email){email=prompt('Email du client :');if(!email)return;f.clientEmail=email;}
  var p=phones.find(function(x){return x.id===f.phoneId;});
  var appareil=p?p.modele+(p.stockage?' '+p.stockage+'Go':''):'Smartphone';
  showNotif('Envoi en cours...','info');
  try{
    await emailjs.send('service_gfapq4j','9825f2j',{client_nom:f.clientNom||'Client',numero_facture:f.numero,appareil:appareil,date_facture:fmtDate(f.date),montant:f.ttc,email:email,name:'Solution Phone'});
    showNotif('Facture envoyée à '+email,'success');
  }catch(e){console.error(e);showNotif('Erreur envoi email','error');}
}

var cCA=null,cPay=null,cQ=null,cPh=null;
function renderStats(){
  var tc=caisse.reduce(function(s,c){return s+(c.ttc||0);},0);
  var tq=caisse.reduce(function(s,c){return s+(c.quali||0);},0);
  var tCB=caisse.reduce(function(s,c){return s+(c.cb||0);},0);
  var tEsp=caisse.reduce(function(s,c){return s+(c.especes||0);},0);
  var tCh=caisse.reduce(function(s,c){return s+(c.cheque||0);},0);
  var tVir=caisse.reduce(function(s,c){return s+(c.virement||0);},0);
  var mg=phones.filter(function(p){return p.etat==='VENDU';}).reduce(function(s,p){return s+(p.vente-p.achat);},0);
  document.getElementById('stats-cards').innerHTML= +
    '<div class="stat-card"><div class="stat-label">CA TTC</div><div class="stat-value">'+tc.toFixed(2)+' €</div></div>'+
    '<div class="stat-card"><div class="stat-label">CA HT</div><div class="stat-value">'+(tc/1.2).toFixed(2)+' €</div></div>'+
    '<div class="stat-card"><div class="stat-label">TVA collectée</div><div class="stat-value">'+(tc-tc/1.2).toFixed(2)+' €</div></div>'+
    '<div class="stat-card"><div class="stat-label">QualiRépar</div><div class="stat-value" style="color:var(--green)">'+tq.toFixed(2)+' €</div></div>'+
    '<div class="stat-card"><div class="stat-label">Moy/jour</div><div class="stat-value">'+(caisse.length?(tc/caisse.length).toFixed(2):0)+' €</div></div>'+
    '<div class="stat-card"><div class="stat-label">Marge smartphones</div><div class="stat-value" style="color:var(--green)">'+mg.toFixed(2)+' €</div></div>';
  var labels=caisse.map(function(c){return fmtDate(c.date).substring(0,5);});
  var gc='rgba(0,0,0,0.06)',tx='#64748b';
  var opts={responsive:true,plugins:{legend:{labels:{color:tx}}},scales:{x:{ticks:{color:tx},grid:{color:gc}},y:{ticks:{color:tx},grid:{color:gc}}}};
  if(cCA)cCA.destroy();cCA=new Chart(document.getElementById('chart-ca'),{type:'bar',data:{labels:labels,datasets:[{label:'CA TTC (€)',data:caisse.map(function(c){return c.ttc;}),backgroundColor:'rgba(229,62,62,0.7)',borderColor:'#e53e3e',borderWidth:1}]},options:opts});
  if(cPay)cPay.destroy();cPay=new Chart(document.getElementById('chart-paiements'),{type:'doughnut',data:{labels:['CB','Espèces','Chèque','Virement'],datasets:[{data:[tCB,tEsp,tCh,tVir],backgroundColor:['#e53e3e','#48bb78','#4299e1','#ed8936'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{labels:{color:tx}}}}});
  if(cQ)cQ.destroy();cQ=new Chart(document.getElementById('chart-quali'),{type:'line',data:{labels:labels,datasets:[{label:'QualiRépar (€)',data:caisse.map(function(c){return c.quali||0;}),borderColor:'#48bb78',backgroundColor:'rgba(72,187,120,0.1)',fill:true,tension:0.4}]},options:opts});
  var dispo=phones.filter(function(p){return p.etat==='DISPONIBLE';}).length;var vendu=phones.filter(function(p){return p.etat==='VENDU';}).length;
  if(cPh)cPh.destroy();cPh=new Chart(document.getElementById('chart-phones'),{type:'doughnut',data:{labels:['Disponible','Vendu'],datasets:[{data:[dispo,vendu],backgroundColor:['#48bb78','#e53e3e'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{labels:{color:tx}}}}});
}

function renderPolice(){
  document.getElementById('police-table').innerHTML=phones.filter(function(p){return p.typeAchat!=='FOURNISSEUR';}).map(function(p){return'<tr><td><b>#'+(p.numPolice||'—')+'</b></td><td>'+fmtDate(p.dateAchat)+'</td><td>'+(p.vendeurNom||'—')+'</td><td>'+(p.vendeurCI||'—')+'</td><td>'+p.modele+(p.stockage?' '+p.stockage+'Go':'')+'</td><td style="font-size:11px">'+(p.imei||'—')+'</td><td>'+(p.couleur||'—')+'</td><td><b>'+p.achat+' €</b></td><td><button class="btn btn-sm" onclick="printCertificat('+p.id+')">📄 Certificat</button></td></tr>';}).join('')||'<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-dim)">Aucun achat particulier enregistré</td></tr>';
}

function exportPoliceCSV(){
  var h=['N Police','Date','Vendeur','Adresse','N CI','CI delivree','Modele','Couleur','IMEI','Prix','Mode'];
  var ph2=phones.filter(function(p){return p.typeAchat!=='FOURNISSEUR';});
  var rows=ph2.map(function(p){return[p.numPolice||'',fmtDate(p.dateAchat),p.vendeurNom||'',p.vendeurAdresse||'',p.vendeurCI||'',fmtDate(p.vendeurCIDate),p.modele,p.couleur||'',p.imei||'',p.achat,p.mode].join(';');});
  var csv=[h.join(';')].concat(rows).join('\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='Livre_Police.csv';a.click();
  showNotif('Export Police téléchargé !','success');
}

var reparations = [];
var depenses = [];
var chartBilanCA = null, chartBilanCumul = null;
var devisList = [];

// ===== BILAN ANNUEL =====
function renderBilan() {
  var annee = document.getElementById('bilan-annee').value;
  var moisNoms = {'01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre'};
  var moisAll = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  
  var totCA=0, totQuali=0, totJours=0;
  var dataCA=[], dataQuali=[], dataCumul=[];
  var cumul = 0;
  var tableRows = '';

  moisAll.forEach(function(m) {
    var key = annee+'-'+m;
    // Données Z de caisse (app)
    var rows = caisse.filter(function(c){return c.date && c.date.startsWith(key);});
    var caApp  = rows.reduce(function(s,c){return s+(c.ttc||0);},0);
    var quApp  = rows.reduce(function(s,c){return s+(c.quali||0);},0);
    var jours  = rows.length;
    // Données Phonilab (import CSV) — uniquement si pas de données app ce mois
    var phData = phonilabData[key];
    var caPhoni = (phData && caApp === 0) ? (phData.ttc||0) : 0;
    var quPhoni = (phData && caApp === 0) ? (phData.quali||0) : 0;
    var ca    = caApp + caPhoni;
    var quali = quApp + quPhoni;
    var source = caApp > 0 ? '' : (phData ? ' <span style="font-size:10px;color:var(--blue);">📥</span>' : '');
    totCA += ca; totQuali += quali; totJours += jours;
    cumul += ca;
    dataCA.push(ca.toFixed(2));
    dataQuali.push(quali.toFixed(2));
    dataCumul.push(cumul.toFixed(2));
    if (ca > 0 || jours > 0) {
      tableRows += '<tr><td><b>'+moisNoms[m]+'</b>'+source+'</td><td><b>'+ca.toFixed(2)+' €</b></td><td>'+(ca/1.2).toFixed(2)+' €</td><td style="color:var(--green)">'+quali.toFixed(2)+' €</td><td>'+jours+'</td><td>'+(jours>0?(ca/jours).toFixed(2):ca>0?'—':0)+' €</td></tr>';
    }
  });

  document.getElementById('bilan-cards').innerHTML = +
    '<div class="dash-card"><div class="dash-label">CA TTC '+annee+'</div><div class="dash-value">'+totCA.toFixed(0)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">CA HT</div><div class="dash-value">'+(totCA/1.2).toFixed(0)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">TVA collectée</div><div class="dash-value">'+(totCA-totCA/1.2).toFixed(0)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">QualiRépar total</div><div class="dash-value" style="color:var(--green)">'+totQuali.toFixed(0)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">Jours travaillés</div><div class="dash-value">'+totJours+'</div></div>';

  var labels = moisAll.map(function(m){return moisNoms[m].substring(0,3);});
  var gc='rgba(0,0,0,0.06)',tx='#64748b';
  var opts={responsive:true,plugins:{legend:{labels:{color:tx}}},scales:{x:{ticks:{color:tx},grid:{color:gc}},y:{ticks:{color:tx},grid:{color:gc}}}};

  if(chartBilanCA) chartBilanCA.destroy();
  chartBilanCA = new Chart(document.getElementById('chart-bilan-ca'),{
    type:'bar',
    data:{labels:labels,datasets:[
      {label:'CA TTC',data:dataCA,backgroundColor:'rgba(229,62,62,0.7)',borderColor:'#e53e3e',borderWidth:1},
      {label:'QualiRépar',data:dataQuali,backgroundColor:'rgba(72,187,120,0.7)',borderColor:'#48bb78',borderWidth:1}
    ]},
    options:opts
  });

  if(chartBilanCumul) chartBilanCumul.destroy();
  chartBilanCumul = new Chart(document.getElementById('chart-bilan-cumul'),{
    type:'line',
    data:{labels:labels,datasets:[{
      label:'CA TTC cumulé (€)',data:dataCumul,
      borderColor:'#e53e3e',backgroundColor:'rgba(229,62,62,0.1)',fill:true,tension:0.4
    }]},
    options:opts
  });

  document.getElementById('bilan-table').innerHTML = +
    '<thead><tr><th>Mois</th><th>CA TTC</th><th>CA HT</th><th>QualiRépar</th><th>Jours</th><th>Moy/jour</th></tr></thead>' +
    '<tbody>' + tableRows + '</tbody>';
}

// ══════════════════════════════════════════════
// ── MODULE SALARIÉS ──
// ══════════════════════════════════════════════
var salaries = [];
var paieEnCours = null; // salarié sélectionné pour la fiche de paie

// Constantes paie CC 3251
var SAL_TAUX_HORAIRE    = 12.02;
var SAL_BASE_HEURES     = 151.67;
var SAL_SALAIRE_BASE    = 1823.07;
var SAL_PRIME_ANC_BASE  = 1802.00;

// Taux cotisations (approximatifs CC 3251)
var COTIS = {
  mal_pat:        0.1300,  // Maladie patronal ~13%
  comp_sal:       0.0034,  // Complémentaire II/D salarié
  comp_pat:       0.0034,
  at_pat:         0.0109,  // AT/MP patronal
  ret_plaf_sal:   0.0690,  // Retraite SS plafonnée salarié
  ret_plaf_pat:   0.0855,
  ret_deplaf_sal: 0.0040,
  ret_deplaf_pat: 0.0211,
  ret_comp_sal:   0.0401,  // Retraite complémentaire T1
  ret_comp_pat:   0.0601,
  fam_pat:        0.0525,  // Famille
  chom_pat:       0.0425,  // Chômage
  autres_pat:     0.0097,  // Autres contributions
  csg_ded:        0.0680,  // CSG déductible
  csg_crds:       0.0290   // CSG/CRDS non déd
};

async function loadSalariesFromSupabase() {
  try {
    var rows = await supaFetch('settings', 'GET', null, '?key=eq.salaries_data&select=value');
    if (rows && rows.length && rows[0].value) {
      salaries = JSON.parse(rows[0].value) || [];
    }
  } catch(e) {
    console.warn('Erreur chargement salariés:', e);
    salaries = [];
  }
}

async function saveSalariesToSupabase() {
  try {
    var existing = await supaFetch('settings', 'GET', null, '?key=eq.salaries_data');
    var data = JSON.stringify(salaries);
    if (existing && existing.length > 0) {
      await supaFetch('settings', 'PATCH', {value: data}, '?key=eq.salaries_data');
    } else {
      await supaFetch('settings', 'POST', {key: 'salaries_data', value: data});
    }
  } catch(e) {
    console.warn('Erreur sauvegarde salariés:', e);
  }
}

function renderSalaries() {
  renderSalSummary();
  renderSalList();
}

function renderSalSummary() {
  var mois = document.getElementById('sal-mois-sel') ? document.getElementById('sal-mois-sel').value : '';
  var totalBrut = 0, totalNet = 0, totalCout = 0;
  salaries.forEach(function(s) {
    var calc = calculerBulletin(s, 0, 0, 0, 0);
    totalBrut += calc.brutTotal;
    totalNet  += calc.netAPayer;
    totalCout += calc.coutEmployeur;
  });
  var el = document.getElementById('sal-summary-cards');
  if (!el) return;
  el.innerHTML =
    '<div class="dash-card"><div class="dash-card-label">Salariés</div><div class="dash-card-value">' + salaries.length + '</div></div>' +
    '<div class="dash-card"><div class="dash-card-label">Masse salariale brute</div><div class="dash-card-value">' + totalBrut.toFixed(0) + ' €</div></div>' +
    '<div class="dash-card"><div class="dash-card-label">Net à payer total</div><div class="dash-card-value" style="color:var(--green);">' + totalNet.toFixed(0) + ' €</div></div>' +
    '<div class="dash-card"><div class="dash-card-label">Coût employeur total</div><div class="dash-card-value" style="color:var(--red);">' + totalCout.toFixed(0) + ' €</div></div>';
}

function renderSalList() {
  var el = document.getElementById('sal-list');
  if (!el) return;
  if (salaries.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Aucun salarié — cliquez ➕ pour commencer</div>';
    return;
  }
  var mois = document.getElementById('sal-mois-sel') ? document.getElementById('sal-mois-sel').value : '';
  el.innerHTML = salaries.map(function(s, i) {
    var calc = calculerBulletin(s, 0, 0, 0, 0);
    var ancreStr = getAncienneteStr(s.dateEntree);
    var paieValide = s.paies && s.paies[mois];
    return '<div class="card" style="border-left:4px solid ' + (s.type==='apprenti'?'var(--blue)':'var(--green)') + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
        '<div>' +
          '<div style="font-weight:700;font-size:16px;">' + s.prenom + ' ' + s.nom.toUpperCase() + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px;">' +
            (s.type==='apprenti'?'🎓 Apprenti':'👔 ' + (s.categorie||'Employé')) + ' · ' + (s.niveau||'') + ' · ' + ancreStr +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);">Matricule ' + (s.matricule||'—') + ' · Entré le ' + formatDateFR(s.dateEntree) + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:18px;font-weight:700;color:var(--green);">' + calc.netAPayer.toFixed(2) + ' €</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">net · brut ' + calc.brutTotal.toFixed(2) + ' €</div>' +
          '<div style="font-size:11px;color:var(--red);">coût employeur ' + calc.coutEmployeur.toFixed(2) + ' €</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">' +
        '<button class="btn btn-sm btn-primary" onclick="ouvrirModalPaie(' + i + ')">💰 Fiche de paie ' + (mois||'') + (paieValide?' ✅':'') + '</button>' +
        '<button class="btn btn-sm" onclick="ouvrirModalSalarie(' + i + ')" style="border-color:var(--blue);color:var(--blue);">✏️ Modifier</button>' +
        '<button class="btn btn-sm" onclick="supprimerSalarie(' + i + ')" style="border-color:var(--red);color:var(--red);">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function getAncienneteStr(dateEntree) {
  if (!dateEntree) return '';
  var d = new Date(dateEntree);
  var now = new Date();
  var mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  var ans = Math.floor(mois / 12);
  var m = mois % 12;
  if (ans > 0 && m > 0) return ans + ' an' + (ans>1?'s':'') + ' et ' + m + ' mois';
  if (ans > 0) return ans + ' an' + (ans>1?'s':'');
  return m + ' mois';
}

function formatDateFR(d) {
  if (!d) return '—';
  var p = d.split('-');
  if (p.length !== 3) return d;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// ── Calcul bulletin de paie ──
function calculerBulletin(sal, cpPris, absJours, heuresSup, prime) {
  var isApprenti = sal.type === 'apprenti';
  var tauxHoraire = SAL_TAUX_HORAIRE;
  var baseHeures  = SAL_BASE_HEURES;

  // Salaire de base
  var salBase = parseFloat(sal.salaire) || SAL_SALAIRE_BASE;
  if (isApprenti) {
    var pctApprenti = parseFloat(sal.apprentiPct) || 51;
    tauxHoraire = (pctApprenti / 100) * SAL_TAUX_HORAIRE;
    salBase = baseHeures * tauxHoraire;
  }

  // Prime ancienneté (CC 3251)
  var anc = parseFloat(sal.anciennete) || 0;
  var txAnc = 0;
  if (anc >= 15) txAnc = 0.12;
  else if (anc >= 12) txAnc = 0.10;
  else if (anc >= 9)  txAnc = 0.08;
  else if (anc >= 6)  txAnc = 0.06;
  else if (anc >= 3)  txAnc = 0.04;
  else if (anc >= 1)  txAnc = 0.03;
  var primeAnc = isApprenti ? 0 : SAL_PRIME_ANC_BASE * txAnc;

  // Congés payés
  var tauxJournalier = salBase / 21.67;
  var absCP     = isApprenti ? (tauxJournalier * (pctApprenti||51) / 100 * cpPris) : (tauxJournalier * cpPris);
  var indemCP   = absCP; // maintien salaire simplifié
  var absNP     = tauxJournalier * absJours; // absences non payées

  // Heures supplémentaires (25% de majoration)
  var montantHSup = heuresSup * tauxHoraire * 1.25;

  // Brut total
  var brutTotal = salBase + primeAnc - absCP + indemCP + montantHSup + (parseFloat(prime)||0) - (tauxJournalier * absJours);
  brutTotal = Math.max(0, brutTotal);

  // Assiette CSG (98.5% du brut)
  var assietteCsg = brutTotal * 0.985;

  var cotSal = 0, cotPat = 0;

  if (isApprenti) {
    // Apprentis : quasi-exonération
    cotSal = brutTotal * 0.0034; // Seule complémentaire II/D
    cotPat = brutTotal * (0.1287 + 0.0034 + 0.0109 + 0.0855 + 0.0211 + 0.0601 + 0.0525 + 0.0425 + 0.0097);
    // Exonération totale apprenti
    var exoApprenti = cotPat - (brutTotal * 0.0318);
    cotPat = cotPat - exoApprenti;
    cotPat = Math.max(0, cotPat);
  } else {
    // Cotisations salariales
    cotSal += brutTotal * COTIS.comp_sal;
    cotSal += brutTotal * COTIS.ret_plaf_sal;
    cotSal += brutTotal * COTIS.ret_deplaf_sal;
    cotSal += brutTotal * COTIS.ret_comp_sal;
    cotSal += assietteCsg * COTIS.csg_ded;
    cotSal += assietteCsg * COTIS.csg_crds;

    // Cotisations patronales
    cotPat += brutTotal * COTIS.mal_pat;
    cotPat += brutTotal * COTIS.comp_pat;
    cotPat += brutTotal * COTIS.at_pat;
    cotPat += brutTotal * COTIS.ret_plaf_pat;
    cotPat += brutTotal * COTIS.ret_deplaf_pat;
    cotPat += brutTotal * COTIS.ret_comp_pat;
    cotPat += brutTotal * COTIS.fam_pat;
    cotPat += brutTotal * COTIS.chom_pat;
    cotPat += brutTotal * COTIS.autres_pat;

    // Réduction Fillon (simplifiée)
    var smicMensuel = 1801.80;
    var coeff = (0.3199 / 0.6) * (1.6 * smicMensuel / brutTotal - 1);
    coeff = Math.min(Math.max(coeff, 0), 0.3199);
    var reductionFillon = brutTotal * coeff;
    cotPat = Math.max(0, cotPat - reductionFillon);
  }

  var netAvantIR = brutTotal - cotSal;
  var ir = netAvantIR * ((parseFloat(sal.pas)||0) / 100);
  var netAPayer = netAvantIR - ir;
  var coutEmployeur = brutTotal + cotPat;

  return {
    brutTotal:      Math.round(brutTotal * 100) / 100,
    primeAnc:       Math.round(primeAnc * 100) / 100,
    cotSal:         Math.round(cotSal * 100) / 100,
    cotPat:         Math.round(cotPat * 100) / 100,
    netAvantIR:     Math.round(netAvantIR * 100) / 100,
    ir:             Math.round(ir * 100) / 100,
    netAPayer:      Math.round(netAPayer * 100) / 100,
    coutEmployeur:  Math.round(coutEmployeur * 100) / 100,
    tauxJournalier: Math.round(tauxJournalier * 100) / 100,
    heuresSup:      heuresSup,
    montantHSup:    Math.round(montantHSup * 100) / 100,
    cpPris:         cpPris,
    absJours:       absJours,
    prime:          parseFloat(prime)||0
  };
}

// ── Modals Salarié ──
function ouvrirModalSalarie(idx) {
  var s = idx !== null ? salaries[idx] : null;
  document.getElementById('modal-sal-title').textContent = s ? 'Modifier ' + s.prenom + ' ' + s.nom : 'Nouveau salarié';
  document.getElementById('sal-prenom').value        = s ? s.prenom : '';
  document.getElementById('sal-nom').value           = s ? s.nom : '';
  document.getElementById('sal-secu').value          = s ? (s.secu||'') : '';
  document.getElementById('sal-matricule').value     = s ? (s.matricule||'') : '';
  setAdresseFields('sal', s ? (s.adresse||'') : '');
  document.getElementById('sal-entree').value        = s ? (s.dateEntree||'') : '';
  document.getElementById('sal-type').value          = s ? (s.type||'cdi') : 'cdi';
  document.getElementById('sal-categorie').value     = s ? (s.categorie||'employe') : 'employe';
  document.getElementById('sal-niveau').value        = s ? (s.niveau||'') : '';
  document.getElementById('sal-salaire').value       = s ? (s.salaire||1823.07) : 1823.07;
  document.getElementById('sal-apprenti-pct').value  = s ? (s.apprentiPct||51) : 51;
  document.getElementById('sal-anciennete').value    = s ? (s.anciennete||0) : 0;
  document.getElementById('sal-pas').value           = s ? (s.pas||0) : 0;
  document.getElementById('sal-iban').value          = s ? (s.iban||'') : '';
  document.getElementById('modal-salarie').setAttribute('data-idx', idx !== null ? idx : -1);
  document.getElementById('modal-salarie').style.display = 'block';
}

function fermerModalSalarie() {
  document.getElementById('modal-salarie').style.display = 'none';
}

async function sauvegarderSalarie() {
  var prenom = document.getElementById('sal-prenom').value.trim();
  var nom    = document.getElementById('sal-nom').value.trim();
  if (!prenom || !nom) { showNotif('Prénom et nom obligatoires','error'); return; }
  var idx = parseInt(document.getElementById('modal-salarie').getAttribute('data-idx'));
  var obj = {
    id:          idx >= 0 ? salaries[idx].id : Date.now(),
    prenom:      prenom,
    nom:         nom,
    secu:        document.getElementById('sal-secu').value.trim(),
    matricule:   document.getElementById('sal-matricule').value.trim(),
    adresse:     getAdresse('sal'),
    dateEntree:  document.getElementById('sal-entree').value,
    type:        document.getElementById('sal-type').value,
    categorie:   document.getElementById('sal-categorie').value,
    niveau:      document.getElementById('sal-niveau').value.trim(),
    salaire:     parseFloat(document.getElementById('sal-salaire').value)||1823.07,
    apprentiPct: parseFloat(document.getElementById('sal-apprenti-pct').value)||51,
    anciennete:  parseFloat(document.getElementById('sal-anciennete').value)||0,
    pas:         parseFloat(document.getElementById('sal-pas').value)||0,
    iban:        document.getElementById('sal-iban').value.trim(),
    paies:       idx >= 0 ? (salaries[idx].paies || {}) : {}
  };
  if (idx >= 0) { salaries[idx] = obj; }
  else { salaries.push(obj); }
  await saveSalariesToSupabase();
  fermerModalSalarie();
  renderSalaries();
  showNotif('Salarié enregistré ✅','success');
}

async function supprimerSalarie(idx) {
  if (!confirm('Supprimer ' + salaries[idx].prenom + ' ' + salaries[idx].nom + ' ?')) return;
  salaries.splice(idx, 1);
  await saveSalariesToSupabase();
  renderSalaries();
  showNotif('Salarié supprimé','success');
}

// ── Modal Fiche de paie ──
function ouvrirModalPaie(idx) {
  var s = salaries[idx];
  var mois = document.getElementById('sal-mois-sel').value;
  paieEnCours = { salIdx: idx, mois: mois };
  document.getElementById('modal-paie-title').textContent = '💰 Fiche de paie — ' + s.prenom + ' ' + s.nom + ' — ' + mois;
  // Charger données existantes si déjà saisies
  var paieExist = s.paies && s.paies[mois];
  document.getElementById('paie-cp-pris').value    = paieExist ? (paieExist.cpPris||0) : 0;
  document.getElementById('paie-absences').value   = paieExist ? (paieExist.absJours||0) : 0;
  document.getElementById('paie-heures-sup').value = paieExist ? (paieExist.heuresSup||0) : 0;
  document.getElementById('paie-prime').value      = paieExist ? (paieExist.prime||0) : 0;
  calculerPaie();
  document.getElementById('modal-paie').style.display = 'block';
}

function fermerModalPaie() {
  document.getElementById('modal-paie').style.display = 'none';
  paieEnCours = null;
}

function calculerPaie() {
  if (!paieEnCours) return;
  var s   = salaries[paieEnCours.salIdx];
  var cp  = parseFloat(document.getElementById('paie-cp-pris').value)||0;
  var abs = parseFloat(document.getElementById('paie-absences').value)||0;
  var hs  = parseFloat(document.getElementById('paie-heures-sup').value)||0;
  var pr  = parseFloat(document.getElementById('paie-prime').value)||0;
  var c   = calculerBulletin(s, cp, abs, hs, pr);

  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Salaire de base (' + SAL_BASE_HEURES + 'h)</td><td style="text-align:right;font-weight:600;">' + (parseFloat(s.salaire)||SAL_SALAIRE_BASE).toFixed(2) + ' €</td></tr>';
  if (c.primeAnc > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Prime ancienneté</td><td style="text-align:right;">+ ' + c.primeAnc.toFixed(2) + ' €</td></tr>';
  if (cp > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Congés payés pris (' + cp + 'j)</td><td style="text-align:right;color:var(--orange);">maintien salaire</td></tr>';
  if (abs > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Absences non payées (' + abs + 'j)</td><td style="text-align:right;color:var(--red);">- ' + (c.tauxJournalier * abs).toFixed(2) + ' €</td></tr>';
  if (hs > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Heures supp. (' + hs + 'h × 25%)</td><td style="text-align:right;color:var(--green);">+ ' + c.montantHSup.toFixed(2) + ' €</td></tr>';
  if (c.prime > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Prime exceptionnelle</td><td style="text-align:right;color:var(--green);">+ ' + c.prime.toFixed(2) + ' €</td></tr>';
  html += '<tr style="border-bottom:2px solid var(--border);font-weight:700;"><td style="padding:8px 0;">TOTAL BRUT</td><td style="text-align:right;font-size:15px;">' + c.brutTotal.toFixed(2) + ' €</td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Cotisations salariales</td><td style="text-align:right;color:var(--red);">- ' + c.cotSal.toFixed(2) + ' €</td></tr>';
  if (c.ir > 0) html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 0;color:var(--text-muted);">Impôt à la source (' + (s.pas||0) + '%)</td><td style="text-align:right;color:var(--red);">- ' + c.ir.toFixed(2) + ' €</td></tr>';
  html += '<tr style="font-weight:700;font-size:15px;background:rgba(46,204,113,0.1);"><td style="padding:8px;border-radius:6px 0 0 6px;">NET À PAYER</td><td style="text-align:right;color:var(--green);padding:8px;border-radius:0 6px 6px 0;">' + c.netAPayer.toFixed(2) + ' €</td></tr>';
  html += '<tr><td style="padding:5px 0;color:var(--text-muted);">Cotisations patronales</td><td style="text-align:right;color:var(--text-muted);">' + c.cotPat.toFixed(2) + ' €</td></tr>';
  html += '<tr style="font-weight:600;"><td style="padding:5px 0;">Coût total employeur</td><td style="text-align:right;color:var(--red);">' + c.coutEmployeur.toFixed(2) + ' €</td></tr>';
  html += '</table>';
  html += '<div style="margin-top:10px;padding:8px;background:rgba(255,165,0,0.1);border-radius:6px;font-size:11px;color:var(--text-muted);">⚠️ Calcul indicatif — réduction Fillon simplifiée. Utilisez ces chiffres comme base pour votre saisie TESE.</div>';
  document.getElementById('paie-calcul-result').innerHTML = html;
}

async function sauvegarderPaie() {
  if (!paieEnCours) return;
  var s   = salaries[paieEnCours.salIdx];
  var cp  = parseFloat(document.getElementById('paie-cp-pris').value)||0;
  var abs = parseFloat(document.getElementById('paie-absences').value)||0;
  var hs  = parseFloat(document.getElementById('paie-heures-sup').value)||0;
  var pr  = parseFloat(document.getElementById('paie-prime').value)||0;
  var c   = calculerBulletin(s, cp, abs, hs, pr);
  if (!s.paies) s.paies = {};
  s.paies[paieEnCours.mois] = { cpPris:cp, absJours:abs, heuresSup:hs, prime:pr, calc:c };
  await saveSalariesToSupabase();
  fermerModalPaie();
  renderSalaries();
  showNotif('Fiche de paie validée ✅','success');
}

function genererFichePDF() {
  if (!paieEnCours) return;
  var s   = salaries[paieEnCours.salIdx];
  var cp  = parseFloat(document.getElementById('paie-cp-pris').value)||0;
  var abs = parseFloat(document.getElementById('paie-absences').value)||0;
  var hs  = parseFloat(document.getElementById('paie-heures-sup').value)||0;
  var pr  = parseFloat(document.getElementById('paie-prime').value)||0;
  var c   = calculerBulletin(s, cp, abs, hs, pr);
  var mois = paieEnCours.mois;
  var w = window.open('','_blank','width=850,height=1100');
  w.document.write(genererHTMLFiche(s, c, mois));
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

function genererHTMLFiche(s, c, mois) {
  var dateParts = mois.split('-');
  var moisNoms = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var moisLabel = moisNoms[parseInt(dateParts[1])] + ' ' + dateParts[0];
  var jours = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]), 0).getDate();
  return '<!DOCTYPE html><html><head><title>Bulletin de Paie - ' + s.prenom + ' ' + s.nom + '</title>' +
  '<style>body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20px;max-width:800px;margin:auto;}' +
  'table{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
  'th{background:#f5f5f5;padding:5px 8px;text-align:left;border-bottom:1px solid #ccc;font-size:10px;text-transform:uppercase;}' +
  'td{padding:4px 8px;border-bottom:1px solid #eee;}' +
  '.header{display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #333;}' +
  '.bold{font-weight:700;}.right{text-align:right;}.green{color:#27ae60;}.red{color:#c0392b;}.gray{color:#777;}' +
  '.total-row{background:#f0f7ff;font-weight:700;font-size:12px;}' +
  '.net-row{background:#e8f8f0;font-weight:700;font-size:13px;}' +
  '@media print{body{padding:10px;}}' +
  '</style></head><body>' +
  '<div class="header">' +
    '<div><div class="bold" style="font-size:14px;">SARL SOLUTION PHONE</div>' +
    '<div>21 Rue Gambetta — 71000 MÂCON</div>' +
    '<div>SIRET : 80104478500021 — APE : 4719B</div>' +
    '<div>CC N°3251 — Commerces Détail non alimentaires</div></div>' +
    '<div style="text-align:right;"><div class="bold" style="font-size:13px;">BULLETIN DE PAIE</div>' +
    '<div>' + moisLabel + '</div>' +
    '<div class="gray">Payé le ' + jours + '/' + dateParts[1] + '/' + dateParts[0] + ' par virement</div></div>' +
  '</div>' +
  '<table style="margin-bottom:14px;"><tr><td><span class="bold">' + s.prenom + ' ' + s.nom.toUpperCase() + '</span><br>' +
    '<span class="gray">' + (s.adresse||'') + '</span></td>' +
    '<td class="right"><span class="gray">Matricule : </span>' + (s.matricule||'—') + '<br>' +
    '<span class="gray">Entrée : </span>' + formatDateFR(s.dateEntree) + '<br>' +
    '<span class="gray">N° Sécu : </span>' + (s.secu||'—') + '</td>' +
    '<td class="right"><span class="gray">Emploi : </span>' + (s.niveau||'Vendeur') + '<br>' +
    '<span class="gray">Catégorie : </span>' + (s.categorie||'Employé(e)') + '<br>' +
    '<span class="gray">Ancienneté : </span>' + getAncienneteStr(s.dateEntree) + '</td></tr></table>' +
  '<table><thead><tr><th>Désignation</th><th>Base</th><th>Taux</th><th class="right">Montant</th></tr></thead><tbody>' +
    '<tr><td>Salaire de base</td><td>' + SAL_BASE_HEURES + ' h</td><td>' + (s.type==='apprenti'?((s.apprentiPct||51)/100*SAL_TAUX_HORAIRE).toFixed(4):SAL_TAUX_HORAIRE) + '</td><td class="right">' + (parseFloat(s.salaire)||SAL_SALAIRE_BASE).toFixed(2) + ' €</td></tr>' +
    (c.primeAnc>0?'<tr><td>Prime d\'ancienneté CC3251</td><td>' + SAL_PRIME_ANC_BASE + '</td><td>' + (c.primeAnc/SAL_PRIME_ANC_BASE*100).toFixed(1)+'%</td><td class="right">'+c.primeAnc.toFixed(2)+' €</td></tr>':'') +
    (c.cpPris>0?'<tr><td>Congés payés pris (' + c.cpPris + 'j) — maintien</td><td></td><td></td><td class="right" style="color:#e67e22;">inclus</td></tr>':'') +
    (c.absJours>0?'<tr><td>Absences (' + c.absJours + 'j)</td><td></td><td></td><td class="right red">- '+(c.tauxJournalier*c.absJours).toFixed(2)+' €</td></tr>':'') +
    (c.heuresSup>0?'<tr><td>Heures supplémentaires (' + c.heuresSup + 'h)</td><td></td><td>× 1.25</td><td class="right green">+ '+c.montantHSup.toFixed(2)+' €</td></tr>':'') +
    (c.prime>0?'<tr><td>Prime exceptionnelle</td><td></td><td></td><td class="right green">+ '+c.prime.toFixed(2)+' €</td></tr>':'') +
    '<tr class="total-row"><td colspan="3">TOTAL BRUT</td><td class="right">'+c.brutTotal.toFixed(2)+' €</td></tr>' +
  '</tbody></table>' +
  '<table style="margin-top:10px;"><thead><tr><th>Cotisations et contributions</th><th class="right">Part salarié</th><th class="right">Part employeur</th></tr></thead><tbody>' +
    '<tr><td>Sécurité Sociale (maladie, retraite, famille...)</td><td class="right red">'+c.cotSal.toFixed(2)+' €</td><td class="right gray">'+c.cotPat.toFixed(2)+' €</td></tr>' +
    (c.ir>0?'<tr><td>Impôt sur le revenu (PAS ' + (s.pas||0) + '%)</td><td class="right red">'+c.ir.toFixed(2)+' €</td><td></td></tr>':'') +
    '<tr class="net-row"><td colspan="1">NET À PAYER AU SALARIÉ</td><td class="right" style="color:#27ae60;font-size:14px;">'+c.netAPayer.toFixed(2)+' €</td><td></td></tr>' +
    '<tr><td>Coût total employeur</td><td></td><td class="right red bold">'+c.coutEmployeur.toFixed(2)+' €</td></tr>' +
  '</tbody></table>' +
  '<div style="margin-top:16px;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:8px;">Dans votre intérêt, conservez ce bulletin de salaire sans limitation de durée. Calculs indicatifs basés sur CC N°3251.</div>' +
  '</body></html>';
}

function exportPayslipsPDF() {
  var mois = document.getElementById('sal-mois-sel').value;
  salaries.forEach(function(s) {
    var paieData = s.paies && s.paies[mois];
    var cp  = paieData ? (paieData.cpPris||0) : 0;
    var abs = paieData ? (paieData.absJours||0) : 0;
    var hs  = paieData ? (paieData.heuresSup||0) : 0;
    var pr  = paieData ? (paieData.prime||0) : 0;
    var c   = calculerBulletin(s, cp, abs, hs, pr);
    var w   = window.open('','_blank','width=850,height=1100');
    if (w) { w.document.write(genererHTMLFiche(s, c, mois)); w.document.close(); setTimeout(function(){ w.print(); }, 500); }
  });
}

function exportRecapTESE() {
  var mois = document.getElementById('sal-mois-sel').value;
  var lignes = ['RÉCAPITULATIF PAIE POUR TESE — ' + mois, '','NOM;PRENOM;BRUT;COT.SAL;NET;COT.PAT;COUT EMPLOYEUR;CP PRIS;ABS'];
  salaries.forEach(function(s) {
    var paieData = s.paies && s.paies[mois];
    var cp  = paieData ? (paieData.cpPris||0) : 0;
    var abs = paieData ? (paieData.absJours||0) : 0;
    var hs  = paieData ? (paieData.heuresSup||0) : 0;
    var pr  = paieData ? (paieData.prime||0) : 0;
    var c   = calculerBulletin(s, cp, abs, hs, pr);
    lignes.push([s.nom,s.prenom,c.brutTotal,c.cotSal,c.netAPayer,c.cotPat,c.coutEmployeur,cp,abs].join(';'));
  });
  var total = salaries.reduce(function(acc, s) {
    var pd = s.paies && s.paies[mois];
    var c = calculerBulletin(s, pd?(pd.cpPris||0):0, pd?(pd.absJours||0):0, pd?(pd.heuresSup||0):0, pd?(pd.prime||0):0);
    acc.brut += c.brutTotal; acc.net += c.netAPayer; acc.cout += c.coutEmployeur;
    return acc;
  }, {brut:0, net:0, cout:0});
  lignes.push('');
  lignes.push('TOTAUX;;'+total.brut.toFixed(2)+';;'+total.net.toFixed(2)+';;'+total.cout.toFixed(2));
  var blob = new Blob([lignes.join('\n')], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'TESE_' + mois + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  showNotif('Export TESE téléchargé ✅','success');
}

function renderFichesPaie() { renderSalaries(); }

// ── FIN MODULE SALARIÉS ──

// ── BACKUP COMPLET SUPABASE ──
async function backupComplet() {
  var btn = document.querySelector('[onclick="backupComplet()"]');
  var txtOriginal = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '⏳ Sauvegarde...'; btn.disabled = true; }

  var tables = [
    'phones', 'factures', 'caisse', 'clients',
    'depenses', 'bons_commande', 'bons_depot',
    'reports_mois', 'settings', 'phonilab_import',
    'roulette_config'
  ];

  var backup = {
    version: '1.0',
    date: new Date().toISOString(),
    boutique: 'Solution Phone - Mâcon',
    tables: {}
  };

  var errors = [];
  var totalRows = 0;

  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    try {
      var rows = await supaFetch(t, 'GET', null, '?limit=100000');
      backup.tables[t] = rows || [];
      totalRows += (rows || []).length;
    } catch(e) {
      errors.push(t);
      backup.tables[t] = [];
    }
  }

  // Métadonnées du backup
  backup.meta = {
    total_lignes: totalRows,
    tables_ok: tables.length - errors.length,
    tables_erreur: errors,
    app_version: '2.0'
  };

  // Génération du fichier JSON
  var json = JSON.stringify(backup, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  // Nom de fichier avec date
  var now = new Date();
  var dateStr = now.getFullYear() + '-' +
    String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0');
  var filename = 'SolutionPhone_Backup_' + dateStr + '.json';

  // Téléchargement automatique
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);

  if (btn) { btn.textContent = txtOriginal; btn.disabled = false; }

  if (errors.length > 0) {
    showNotif('Backup partiel — ' + (tables.length - errors.length) + '/' + tables.length + ' tables (' + totalRows + ' lignes)', 'warning');
  } else {
    showNotif('✅ Backup complet — ' + totalRows + ' lignes exportées → ' + filename, 'success');
  }
}

function printBilan() {
  var zone = document.getElementById('page-bilan');
  var w = window.open('','_blank','width=900,height=1000');
  w.document.write('<!DOCTYPE html><html><head><title>Bilan Annuel</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#1a1a1a;font-size:13px;}table{width:100%;border-collapse:collapse;}th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;}td{padding:8px;border-bottom:1px solid #eee;}@media print{body{padding:15px;}}</style></head><body>' +
    '<h1 style="color:#e53e3e;font-size:24px;">SOLUTION PHONE — Bilan ' + document.getElementById('bilan-annee').value + '</h1>' +
    '<p style="color:#666;margin-bottom:20px;">21 Rue Gambetta · 71000 Mâcon · SIRET : 801044785 00021</p>' +
    document.getElementById('bilan-table').outerHTML +
    '<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

// ===== DEVIS =====
function updateDevisPreview() {
  var prestation = document.getElementById('dv-prestation').value;
  var prix = parseFloat(document.getElementById('dv-prix').value)||0;
  if(!prestation||!prix){document.getElementById('devis-preview-card').style.display='none';return;}
  document.getElementById('devis-preview-content').innerHTML=
    '<div style="text-align:center;padding:30px;color:#888;font-size:13px;">'+
    '<div style="font-size:32px;margin-bottom:8px;">📝</div>'+
    '<b>Aperçu disponible après génération</b><br>'+
    '<span style="font-size:12px;">Cliquez sur Générer le devis pour voir le document A4</span></div>';
  document.getElementById('devis-preview-card').style.display='block';
}

function genererDevis() {
  var client=document.getElementById('dv-client').value.trim();
  var prestation=document.getElementById('dv-prestation').value.trim();
  var prix=parseFloat(document.getElementById('dv-prix').value);
  if(!client||!prestation||!prix){showNotif('Client, prestation et prix requis','error');return;}
  var num='DEV-'+new Date().getFullYear()+'-'+String(devisList.length+1).padStart(3,'0');
  var dv={id:Date.now(),numero:num,date:new Date().toISOString().split('T')[0],
    clientNom:client,clientAdresse:getAdresse('dv'),
    clientEmail:document.getElementById('dv-email').value.trim(),
    appareil:document.getElementById('dv-appareil').value.trim(),
    prestation:prestation,prix:prix,validite:document.getElementById('dv-validite').value};
  devisList.push(dv);
  renderDevis();
  imprimerDevisData(dv);
  ['dv-client','dv-adresse','dv-cp','dv-ville','dv-email','dv-appareil','dv-prestation','dv-prix'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('devis-preview-card').style.display='none';
  showNotif('Devis '+num+' créé !','success');
}

function imprimerDevisData(dv){
  var desc='<b>'+dv.prestation+'</b>'+
    (dv.appareil?'<br><span style="font-size:11px;color:#888;">Appareil : '+dv.appareil+'</span>':'')+
    '<br><span style="font-size:11px;color:#888;">Devis valable '+dv.validite+'</span>';
  var html=buildA4HTML({
    type:'devis',numero:dv.numero,date:dv.date,
    clientNom:dv.clientNom,clientAdresse:dv.clientAdresse,clientEmail:dv.clientEmail||'',
    validite:dv.validite,
    lignes:[{desc:desc,qte:1,pu:dv.prix}],
    total:dv.prix,isDevis:true,
    notes:'Ce devis est valable '+dv.validite+'. Pour toute question : solution.phone71@gmail.com'
  });
  ouvrirA4(html);
}

function imprimerDevis(){ var dv=devisList[devisList.length-1]; if(dv)imprimerDevisData(dv); }

function convertirDevisEnFacture() {
  var prestation=document.getElementById('dv-prestation').value.trim();
  var prix=parseFloat(document.getElementById('dv-prix').value);
  if(!prestation||!prix){showNotif('Remplissez le devis avant','error');return;}
  // Copier dans la page réparations
  showPage('reparations',null);
  document.getElementById('r-client-nom').value=document.getElementById('dv-client').value;
  setAdresseFields('r-client', getAdresse('dv'));
  document.getElementById('r-client-email').value=document.getElementById('dv-email').value;
  document.getElementById('r-appareil').value=document.getElementById('dv-appareil').value;
  document.getElementById('r-description').value=prestation;
  document.getElementById('r-prix').value=prix;
  updateRepPreview();
  showNotif('Devis converti en facture réparation !','success');
}

function renderDevis() {
  document.getElementById('devis-table').innerHTML=devisList.map(function(d){
    return '<tr><td><b>'+d.numero+'</b></td><td>'+fmtDate(d.date)+'</td><td>'+d.clientNom+'</td><td>'+d.prestation+'</td><td><b>'+d.prix.toFixed(2)+' €</b></td><td>'+d.validite+'</td>' +
    '<td style="display:flex;gap:4px;"><button class="btn btn-sm" onclick="reprintDevis('+d.id+')">🖨️</button></td></tr>';
  }).join('')||'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">Aucun devis</td></tr>';
}

function reprintDevis(id) {
  var d=devisList.find(function(x){return x.id===id;});if(!d)return;
  imprimerDevisData(d);
}

var chartCompCA = null, chartCompQuali = null, chartCompPay = null, chartCompJours = null;

function getDataParMois() {
  // Grouper caisse par mois
  var moisData = {};
  caisse.forEach(function(c) {
    var mois = c.date.substring(0,7);
    if (!moisData[mois]) moisData[mois] = {ttc:0,cb:0,esp:0,cheque:0,vir:0,quali:0,jours:0,depotEsp:0,depotCheque:0,achatSmart:0};
    moisData[mois].ttc += c.ttc||0;
    moisData[mois].cb += c.cb||0;
    moisData[mois].esp += c.especes||0;
    moisData[mois].cheque += c.cheque||0;
    moisData[mois].vir += c.virement||0;
    moisData[mois].quali += c.quali||0;
    moisData[mois].jours += 1;
    moisData[mois].depotEsp += c.depotEsp||0;
    moisData[mois].depotCheque += c.depotCheque||0;
    moisData[mois].achatSmart += c.achatSmart||0;
  });
  return moisData;
}

function getMoisLabel(mois) {
  var noms = {'01':'Jan','02':'Fév','03':'Mar','04':'Avr','05':'Mai','06':'Jun','07':'Jul','08':'Aoû','09':'Sep','10':'Oct','11':'Nov','12':'Déc'};
  var p = mois.split('-');
  return noms[p[1]] + ' ' + p[0];
}

function renderComparaison() {
  var moisData = getDataParMois();
  var moisKeys = Object.keys(moisData).sort();
  
  if (moisKeys.length === 0) {
    document.getElementById('comp-cards').innerHTML = '<div style="color:var(--text-muted);padding:20px;">Pas assez de données pour comparer.</div>';
    return;
  }

  var labels = moisKeys.map(getMoisLabel);
  var gc = 'rgba(0,0,0,0.06)', tx = '#64748b';
  var opts = {responsive:true, plugins:{legend:{labels:{color:tx}}}, scales:{x:{ticks:{color:tx},grid:{color:gc}},y:{ticks:{color:tx},grid:{color:gc}}}};

  // Cartes résumé (dernier mois vs mois précédent)
  var dernierMois = moisData[moisKeys[moisKeys.length-1]];
  var moisPrec = moisKeys.length > 1 ? moisData[moisKeys[moisKeys.length-2]] : null;
  
  function evolution(val, prev) {
    if (!prev || prev === 0) return '';
    var pct = ((val - prev) / prev * 100).toFixed(1);
    var color = pct >= 0 ? 'var(--green)' : 'var(--red)';
    var arrow = pct >= 0 ? '↑' : '↓';
    return '<br><span style="font-size:13px;color:'+color+'">'+arrow+' '+Math.abs(pct)+'%</span>';
  }

  document.getElementById('comp-cards').innerHTML = +
    '<div class="dash-card"><div class="dash-label">CA '+getMoisLabel(moisKeys[moisKeys.length-1])+'</div><div class="dash-value">'+dernierMois.ttc.toFixed(0)+' €'+(moisPrec?evolution(dernierMois.ttc,moisPrec.ttc):'')+'</div></div>' +
    '<div class="dash-card"><div class="dash-label">QualiRépar</div><div class="dash-value" style="color:var(--green)">'+dernierMois.quali.toFixed(0)+' €'+(moisPrec?evolution(dernierMois.quali,moisPrec.quali):'')+'</div></div>' +
    '<div class="dash-card"><div class="dash-label">Moy/jour</div><div class="dash-value">'+(dernierMois.jours>0?(dernierMois.ttc/dernierMois.jours).toFixed(0):0)+' €'+(moisPrec&&moisPrec.jours>0?evolution(dernierMois.ttc/dernierMois.jours,moisPrec.ttc/moisPrec.jours):'')+'</div></div>' +
    '<div class="dash-card"><div class="dash-label">Jours travaillés</div><div class="dash-value">'+dernierMois.jours+(moisPrec?evolution(dernierMois.jours,moisPrec.jours):'')+'</div></div>';

  // Graphique CA
  if(chartCompCA) chartCompCA.destroy();
  chartCompCA = new Chart(document.getElementById('chart-comp-ca'), {
    type:'bar',
    data:{labels:labels,datasets:[
      {label:'CA TTC (€)',data:moisKeys.map(function(m){return moisData[m].ttc.toFixed(2);}),backgroundColor:'rgba(229,62,62,0.7)',borderColor:'#e53e3e',borderWidth:1},
      {label:'CA HT (€)',data:moisKeys.map(function(m){return (moisData[m].ttc/1.2).toFixed(2);}),backgroundColor:'rgba(229,62,62,0.3)',borderColor:'#e53e3e',borderWidth:1}
    ]},
    options:opts
  });

  // Graphique QualiRépar
  if(chartCompQuali) chartCompQuali.destroy();
  chartCompQuali = new Chart(document.getElementById('chart-comp-quali'), {
    type:'line',
    data:{labels:labels,datasets:[{
      label:'Bonus QualiRépar (€)',
      data:moisKeys.map(function(m){return moisData[m].quali.toFixed(2);}),
      borderColor:'#48bb78',backgroundColor:'rgba(72,187,120,0.1)',fill:true,tension:0.4
    }]},
    options:opts
  });

  // Graphique paiements empilés
  if(chartCompPay) chartCompPay.destroy();
  chartCompPay = new Chart(document.getElementById('chart-comp-pay'), {
    type:'bar',
    data:{labels:labels,datasets:[
      {label:'CB',data:moisKeys.map(function(m){return moisData[m].cb.toFixed(2);}),backgroundColor:'rgba(229,62,62,0.8)'},
      {label:'Espèces',data:moisKeys.map(function(m){return moisData[m].esp.toFixed(2);}),backgroundColor:'rgba(72,187,120,0.8)'},
      {label:'Chèque',data:moisKeys.map(function(m){return moisData[m].cheque.toFixed(2);}),backgroundColor:'rgba(66,153,225,0.8)'},
      {label:'Virement',data:moisKeys.map(function(m){return moisData[m].vir.toFixed(2);}),backgroundColor:'rgba(237,137,54,0.8)'}
    ]},
    options:{...opts, scales:{...opts.scales, x:{...opts.scales.x,stacked:true}, y:{...opts.scales.y,stacked:true}}}
  });

  // Graphique jours travaillés
  if(chartCompJours) chartCompJours.destroy();
  chartCompJours = new Chart(document.getElementById('chart-comp-jours'), {
    type:'bar',
    data:{labels:labels,datasets:[{
      label:'Jours travaillés',
      data:moisKeys.map(function(m){return moisData[m].jours;}),
      backgroundColor:'rgba(159,122,234,0.7)',borderColor:'#9f7aea',borderWidth:1
    }]},
    options:opts
  });

  // Tableau comparatif
  var thead = '<thead><tr><th>Mois</th><th>CA TTC</th><th>CA HT</th><th>TVA</th><th>QualiRépar</th><th>CB</th><th>Espèces</th><th>Jours</th><th>Moy/jour</th></tr></thead>';
  var tbody = '<tbody>' + moisKeys.map(function(m) {
    var d = moisData[m];
    var ht = d.ttc/1.2;
    var tva = d.ttc - ht;
    var moy = d.jours > 0 ? d.ttc/d.jours : 0;
    return '<tr><td><b>'+getMoisLabel(m)+'</b></td><td><b>'+d.ttc.toFixed(2)+' €</b></td><td>'+ht.toFixed(2)+' €</td><td>'+tva.toFixed(2)+' €</td><td style="color:var(--green)">'+d.quali.toFixed(2)+' €</td><td>'+d.cb.toFixed(2)+' €</td><td>'+d.esp.toFixed(2)+' €</td><td>'+d.jours+'</td><td>'+moy.toFixed(2)+' €</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('comp-table').innerHTML = thead + tbody;
}
var chartDep = null;

function addDepense() {
  var date = document.getElementById('d-date').value;
  var montant = parseFloat(document.getElementById('d-montant').value);
  if (!date || !montant) { showNotif('Date et montant requis', 'error'); return; }
  var dep = {
    id: Date.now(),
    date: date,
    categorie: document.getElementById('d-categorie').value,
    description: document.getElementById('d-description').value.trim(),
    montant: montant,
    mode: document.getElementById('d-mode').value
  };
  depenses.push(dep);
  depenses.sort(function(a,b){return b.date.localeCompare(a.date);});
  // Sauvegarder dans Supabase si dispo
  if (supabaseReady) {
    supaFetch('depenses','POST',{date:dep.date,categorie:dep.categorie,description:dep.description,montant:dep.montant,mode:dep.mode});
  }
  ['d-description','d-montant'].forEach(function(id){document.getElementById(id).value='';});
  renderDepenses();
  showNotif('Dépense enregistrée !','success');
}

function deleteDepense(id) {
  if(!confirm('Supprimer cette dépense ?')) return;
  depenses = depenses.filter(function(d){return d.id!==id;});
  renderDepenses();
  showNotif('Supprimé','success');
}

function renderDepenses() {
  var filtre = document.getElementById('d-filtre-mois') ? document.getElementById('d-filtre-mois').value : '';
  var filtered = filtre ? depenses.filter(function(d){return d.date.startsWith(filtre);}) : depenses;
  
  var total = filtered.reduce(function(s,d){return s+d.montant;},0);
  var parCat = {};
  filtered.forEach(function(d){parCat[d.categorie]=(parCat[d.categorie]||0)+d.montant;});
  
  // Totaux
  var ca = caisse.reduce(function(s,c){return s+(c.ttc||0);},0);
  var benefice = ca - total;
  document.getElementById('depenses-totaux').innerHTML = +
    '<div class="dash-card"><div class="dash-label">Total dépenses</div><div class="dash-value" style="color:var(--red);">'+total.toFixed(2)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">CA du mois</div><div class="dash-value">'+ca.toFixed(2)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">Bénéfice brut</div><div class="dash-value" style="color:'+(benefice>=0?'var(--green)':'var(--red)')+'">'+benefice.toFixed(2)+' €</div></div>' +
    '<div class="dash-card"><div class="dash-label">Nb dépenses</div><div class="dash-value">'+filtered.length+'</div></div>';

  // Tableau
  var cats = {'Loyer':'🏠','Fournitures':'🔧','Salaires':'👥','Electricite':'💡','Telephone':'📞','Assurance':'🛡️','Transport':'🚗','Publicite':'📢','Logiciels':'💻','Autre':'📦'};
  document.getElementById('depenses-table').innerHTML = filtered.map(function(d){
    return '<tr><td>'+fmtDate(d.date)+'</td><td>'+(cats[d.categorie]||'📦')+' '+d.categorie+'</td><td>'+(d.description||'—')+'</td><td style="color:var(--red);font-weight:700;">'+d.montant.toFixed(2)+' €</td><td>'+d.mode+'</td><td><button class="btn btn-sm" onclick="deleteDepense('+d.id+')">🗑️</button></td></tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-dim)">Aucune dépense</td></tr>';

  // Graphique camembert
  var labels = Object.keys(parCat);
  var values = Object.values(parCat);
  var colors = ['#e53e3e','#48bb78','#4299e1','#ed8936','#9f7aea','#f687b3','#68d391','#fc8181','#63b3ed','#fbd38d'];
  if (chartDep) chartDep.destroy();
  if (labels.length > 0) {
    chartDep = new Chart(document.getElementById('chart-depenses'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0,labels.length), borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { labels: { color: '#64748b' } } } }
    });
  }
}

function exportDepensesCSV() {
  var headers = ['Date','Categorie','Description','Montant','Mode'];
  var rows = depenses.map(function(d){return[fmtDate(d.date),d.categorie,d.description||'',d.montant,d.mode].join(';');});
  var csv = [headers.join(';')].concat(rows).join('\n');
  var blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='Depenses.csv'; a.click();
  showNotif('Export téléchargé !','success');
}

function updateRepPreview() {
  var appareil = document.getElementById('r-appareil').value;
  var description = document.getElementById('r-description').value;
  var prix = parseFloat(document.getElementById('r-prix').value) || 0;
  if (!appareil || !description || !prix) { document.getElementById('rep-preview-card').style.display='none'; return; }
  document.getElementById('rep-preview-content').innerHTML=
    '<div style="text-align:center;padding:30px;color:#888;font-size:13px;">'+
    '<div style="font-size:32px;margin-bottom:8px;">🔧</div>'+
    '<b>Aperçu disponible après génération</b><br>'+
    '<span style="font-size:12px;">Cliquez sur Générer la facture pour voir le document A4</span></div>';
  document.getElementById('rep-preview-card').style.display = 'block';
}

function genererFactureRep() {
  var client = document.getElementById('r-client-nom').value.trim();
  var appareil = document.getElementById('r-appareil').value.trim();
  var description = document.getElementById('r-description').value.trim();
  var prix = parseFloat(document.getElementById('r-prix').value);
  if (!client || !appareil || !description || !prix) { showNotif('Remplissez tous les champs obligatoires *', 'error'); return; }
  var num = 'REP-'+new Date().getFullYear()+'-'+String(reparations.length+1).padStart(3,'0');
  var date = new Date().toISOString().split('T')[0];
  var rep = {
    id: Date.now(), numero: num, date: date,
    clientNom: client,
    clientAdresse: getAdresse('r-client'),
    clientEmail: document.getElementById('r-client-email').value.trim(),
    appareil: appareil,
    imei: document.getElementById('r-imei').value.trim(),
    description: description,
    prix: prix,
    mode: document.getElementById('r-mode').value,
    garantie: document.getElementById('r-garantie').value
  };
  reparations.push(rep);
  renderReparations();
  imprimerRepData(rep);
  ['r-client-nom','r-client-adresse','r-client-cp','r-client-ville','r-client-email','r-appareil','r-imei','r-description','r-prix'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('rep-preview-card').style.display = 'none';
  showNotif('Facture ' + num + ' créée !', 'success');
}

function imprimerRepData(r){
  var desc='<b>'+r.description+'</b>'+
    '<br><span style="font-size:11px;color:#888;">Appareil : '+r.appareil+(r.imei?' · IMEI : '+r.imei:'')+'</span>'+
    '<br><span style="font-size:11px;color:#888;">Garantie : '+r.garantie+'</span>';
  var html=buildA4HTML({
    type:'reparation',numero:r.numero,date:r.date,
    clientNom:r.clientNom,clientAdresse:r.clientAdresse,clientEmail:r.clientEmail||'',
    mode:r.mode,garantie:r.garantie,
    lignes:[{desc:desc,qte:1,pu:r.prix}],
    total:r.prix,isDevis:false
  });
  ouvrirA4(html);
}

function imprimerFactureRep(){
  var rep=reparations[reparations.length-1];
  if(rep)imprimerRepData(rep);
}

function reprintRep(id) {
  var r = reparations.find(function(x){ return x.id === id; });
  if (!r) return;
  imprimerRepData(r);
}

async function envoyerEmailRep(id) {
  var r = reparations.find(function(x){ return x.id === id; });
  if (!r) return;
  var email = r.clientEmail || '';
  if (!email) { email = prompt('Email du client :'); if (!email) return; r.clientEmail = email; }
  showNotif('Envoi en cours...', 'info');
  try {
    await emailjs.send('service_gfapq4j', '9825f2j', {
      client_nom: r.clientNom, numero_facture: r.numero,
      appareil: r.appareil + ' - ' + r.description,
      date_facture: fmtDate(r.date), montant: r.prix,
      email: email, name: 'Solution Phone'
    });
    showNotif('Email envoyé à ' + email, 'success');
  } catch(e) { showNotif('Erreur envoi email', 'error'); }
}

function renderReparations() {
  document.getElementById('reparations-table').innerHTML = reparations.map(function(r) {
    return '<tr><td><b>' + r.numero + '</b></td><td>' + fmtDate(r.date) + '</td><td>' + r.clientNom + '</td><td>' + r.appareil + '</td><td>' + r.description + '</td><td><b>' + r.prix.toFixed(2) + ' €</b></td>' +
      '<td style="display:flex;gap:4px;"><button class="btn btn-sm" onclick="reprintRep(' + r.id + ')">🖨️</button><button class="btn btn-sm btn-primary" onclick="envoyerEmailRep(' + r.id + ')">📧</button></td></tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">Aucune réparation</td></tr>';
}

function renderComptable() {
  var mois = document.getElementById('compta-mois').value;
  var data = caisse.filter(function(c) { return c.date.startsWith(mois); });
  
  // Totaux CA
  var totalTTC = data.reduce(function(s,c){return s+(c.ttc||0);},0);
  var totalHT = totalTTC / 1.2;
  var totalTVA = totalTTC - totalHT;
  var totalQuali = data.reduce(function(s,c){return s+(c.quali||0);},0);
  
  // Totaux paiements
  var totalCB = data.reduce(function(s,c){return s+(c.cb||0);},0);
  var totalEsp = data.reduce(function(s,c){return s+(c.especes||0);},0);
  var totalCheque = data.reduce(function(s,c){return s+(c.cheque||0);},0);
  var totalVir = data.reduce(function(s,c){return s+(c.virement||0);},0);
  var totalDepotEsp = data.reduce(function(s,c){return s+(c.depotEsp||0);},0);
  var totalDepotCheque = data.reduce(function(s,c){return s+(c.depotCheque||0);},0);
  var totalAchatSmart = data.reduce(function(s,c){return s+(c.achatSmart||0);},0);
  
  // Caisse finale
  var finales = calcFinales();
  var caisseFin = finales.length > 0 ? finales[finales.length-1] : 0;
  var caisseDebut = getReport(mois);
  
  // Smartphones du mois
  var phonesVendus = phones.filter(function(p){return p.etat==='VENDU' && p.dateVente && p.dateVente.startsWith(mois);});
  var phonesAchetes = phones.filter(function(p){return p.dateAchat && p.dateAchat.startsWith(mois);});
  var margeSmartphones = phonesVendus.reduce(function(s,p){return s+(p.vente-p.achat);},0);
  
  // Nom du mois
  var moisNoms = {'01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre'};
  var parts = mois.split('-');
  var moisLabel = moisNoms[parts[1]] + ' ' + parts[0];

  var html = '<div id="compta-print-zone">' +
    '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">' +
    '<div>' +
    '<div style="font-size:22px;font-weight:800;color:var(--red);">SOLUTION PHONE</div>' +
    '<div style="font-size:13px;color:var(--text-muted);">21 Rue Gambetta · 71000 Mâcon</div>' +
    '<div style="font-size:13px;color:var(--text-muted);">SIRET : 801044785 00021</div>' +
    '</div>' +
    '<div style="text-align:right;">' +
    '<div style="font-size:18px;font-weight:700;">RÉCAPITULATIF MENSUEL</div>' +
    '<div style="font-size:24px;font-weight:800;color:var(--red);">' + moisLabel + '</div>' +
    '</div>' +
    '</div>' +

    // Section CA +
    '<div style="margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">💰 Chiffre d\'Affaires</div>' +
    '<table><thead><tr><th>Désignation</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
    '<tr><td>CA Total TTC</td><td style="text-align:right;font-size:18px;font-weight:800;color:var(--red);">' + totalTTC.toFixed(2) + ' €</td></tr>' +
    '<tr><td>CA HT (TVA sur marge)</td><td style="text-align:right;font-weight:700;">' + totalHT.toFixed(2) + ' €</td></tr>' +
    '<tr><td>TVA collectée</td><td style="text-align:right;">' + totalTVA.toFixed(2) + ' €</td></tr>' +
    '<tr><td style="color:var(--green);">Bonus QualiRépar</td><td style="text-align:right;color:var(--green);font-weight:700;">+ ' + totalQuali.toFixed(2) + ' €</td></tr>' +

    '</tbody></table>' +
    '</div>' +

    // Section Paiements +
    '<div style="margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">💳 Répartition des paiements</div>' +
    '<table><thead><tr><th>Mode</th><th style="text-align:right">Montant</th><th style="text-align:right">%</th></tr></thead><tbody>' +
    '<tr><td>💳 CB</td><td style="text-align:right;">' + totalCB.toFixed(2) + ' €</td><td style="text-align:right;color:var(--text-muted);">' + (totalTTC > 0 ? (totalCB/totalTTC*100).toFixed(1) : 0) + '%</td></tr>' +
    '<tr><td>💵 Espèces</td><td style="text-align:right;">' + totalEsp.toFixed(2) + ' €</td><td style="text-align:right;color:var(--text-muted);">' + (totalTTC > 0 ? (totalEsp/totalTTC*100).toFixed(1) : 0) + '%</td></tr>' +
    '<tr><td>📄 Chèque</td><td style="text-align:right;">' + totalCheque.toFixed(2) + ' €</td><td style="text-align:right;color:var(--text-muted);">' + (totalTTC > 0 ? (totalCheque/totalTTC*100).toFixed(1) : 0) + '%</td></tr>' +
    '<tr><td>🏦 Virement</td><td style="text-align:right;">' + totalVir.toFixed(2) + ' €</td><td style="text-align:right;color:var(--text-muted);">' + (totalTTC > 0 ? (totalVir/totalTTC*100).toFixed(1) : 0) + '%</td></tr>' +
    '</tbody></table>' +
    '</div>' +

    // Section Caisse +
    '<div style="margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">🏪 Suivi de caisse</div>' +
    '<table><thead><tr><th>Désignation</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
    '<tr><td>Report début de mois</td><td style="text-align:right;">' + caisseDebut.toFixed(2) + ' €</td></tr>' +
    '<tr><td>+ Espèces encaissées</td><td style="text-align:right;">+ ' + totalEsp.toFixed(2) + ' €</td></tr>' +
    '<tr><td>- Dépôts espèces en banque</td><td style="text-align:right;color:var(--red);">- ' + totalDepotEsp.toFixed(2) + ' €</td></tr>' +
    '<tr><td>- Achats smartphones espèces</td><td style="text-align:right;color:var(--red);">- ' + totalAchatSmart.toFixed(2) + ' €</td></tr>' +
    '<tr style="background:rgba(229,62,62,0.1)"><td style="font-weight:700">Caisse finale</td><td style="text-align:right;font-weight:800;font-size:16px;color:var(--red);">' + caisseFin.toFixed(2) + ' €</td></tr>' +
    '<tr><td>Chèques à déposer</td><td style="text-align:right;">' + (totalCheque - totalDepotCheque).toFixed(2) + ' €</td></tr>' +
    '</tbody></table>' +
    '</div>' +

    // Section Smartphones +
    '<div style="margin-bottom:20px;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">📱 Smartphones</div>' +
    '<table><thead><tr><th>Désignation</th><th style="text-align:right">Valeur</th></tr></thead><tbody>' +
    '<tr><td>Smartphones achetés</td><td style="text-align:right;">' + phonesAchetes.length + ' tél. · ' + totalAchatSmart.toFixed(2) + ' €</td></tr>' +
    '<tr><td>Smartphones vendus</td><td style="text-align:right;">' + phonesVendus.length + ' tél.</td></tr>' +
    '<tr style="background:rgba(72,187,120,0.1)"><td style="font-weight:700;color:var(--green);">Marge smartphones</td><td style="text-align:right;font-weight:800;color:var(--green);">' + margeSmartphones.toFixed(2) + ' €</td></tr>' +
    '</tbody></table>' +
    '</div>' +

    // Section Achats espèces smartphones
    (function(){
      var achatsEsp = phones.filter(function(p){return p.dateAchat&&p.dateAchat.startsWith(mois)&&p.mode==='ESPECES';});
      if(!achatsEsp.length) return '';
      var totalEspSmarts = achatsEsp.reduce(function(s,p){return s+p.achat;},0);
      var rows = achatsEsp.map(function(p){
        var vendeur=p.typeAchat==='FOURNISSEUR'?'🏢 '+(p.fournisseur||'Fournisseur'):'👤 '+(p.vendeurNom||'—');
        return '<tr><td>'+fmtDate(p.dateAchat)+'</td><td>'+vendeur+'</td><td>'+p.modele+(p.stockage?' '+p.stockage+'Go':'')+'</td><td style="font-size:11px;color:var(--text-muted);">'+(p.imei||'—')+'</td><td style="text-align:right;font-weight:700;color:#ed8936;">'+p.achat.toFixed(2)+' €</td></tr>';
      }).join('');
      return '<div style="margin-bottom:20px;">'+
        '<div style="font-size:13px;font-weight:700;color:#ed8936;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:2px solid #ed8936;padding-bottom:6px;">💵 Achats smartphones en espèces</div>'+
        '<div style="overflow-x:auto;"><table><thead><tr>'+
        '<th>Date</th><th>Vendeur / Fournisseur</th><th>Appareil</th><th>IMEI</th><th style="text-align:right">Montant espèces</th>'+
        '</tr></thead><tbody>'+rows+
        '<tr style="background:rgba(237,137,54,0.12)"><td colspan="4" style="font-weight:700;">TOTAL espèces sortantes</td>'+
        '<td style="text-align:right;font-weight:800;font-size:16px;color:#ed8936;">'+totalEspSmarts.toFixed(2)+' €</td></tr>'+
        '</tbody></table></div>'+
        '</div>';
    })() +

    // Détail journalier +
    '<div>' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;">📅 Détail journalier</div>' +
    '<div style="overflow-x:auto;"><table><thead><tr><th>Date</th><th>TTC</th><th>CB</th><th>Espèces</th><th>Chèque</th><th>Virement</th><th>QualiRépar</th><th>Caisse Finale</th></tr></thead><tbody>' +
    data.map(function(c,i) {
      var fin = finales[caisse.indexOf(c)] || 0;
      return '<tr><td>' + fmtDate(c.date) + '</td><td><b>' + c.ttc.toFixed(2) + ' €</b></td><td>' + (c.cb||0).toFixed(2) + ' €</td><td>' + (c.especes||0).toFixed(2) + ' €</td><td>' + (c.cheque||0).toFixed(2) + ' €</td><td>' + (c.virement||0).toFixed(2) + ' €</td><td>' + ((c.quali||0)>0?'<span style="color:var(--green)">'+(c.quali).toFixed(2)+' €</span>':'—') + '</td><td><b>' + fin.toFixed(2) + ' €</b></td></tr>';
    }).join('') +
    '</tbody></table></div>' +
    '</div>' +

    '<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:8px;font-size:12px;color:var(--text-muted);text-align:center;">Document généré le ' + new Date().toLocaleDateString('fr-FR') + ' · Solution Phone · TVA sur marge Art. 297 CGI</div>' +
    '</div>' +
    '</div>';

  document.getElementById('comptable-content').innerHTML = html;
}

function printComptable() {
  var content = document.getElementById('compta-print-zone');
  if (!content) return;
  var w = window.open('', '_blank', 'width=900,height=1000');
  w.document.write('<!DOCTYPE html><html><head><title>Récap Comptable</title>' +
    '<style>body{font-family:Arial,sans-serif;padding:30px;color:#1a1a1a;font-size:13px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}' +
    'th{background:#f5f5f5;padding:8px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #ddd;}' +
    'td{padding:8px;border-bottom:1px solid #eee;}' +
    '.red{color:#e53e3e;}.green{color:#48bb78;}' +
    '@media print{body{padding:15px;}@page{margin:1cm;}}' +
    '</style></head><body>' +
    content.innerHTML +
    '<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

async function exportComptableEmail() {
  var mois = document.getElementById('compta-mois').value;
  var email = prompt('Email de votre comptable :');
  if(!email) return;
  
  var moisNoms = {'01':'Janvier','02':'Fevrier','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Aout','09':'Septembre','10':'Octobre','11':'Novembre','12':'Decembre'};
  var parts = mois.split('-');
  var moisLabel = moisNoms[parts[1]] + ' ' + parts[0];
  
  var data = caisse.filter(function(c){return c.date.startsWith(mois);});
  var totalTTC = data.reduce(function(s,c){return s+(c.ttc||0);},0);
  var totalHT = totalTTC/1.2;
  var totalTVA = totalTTC-totalHT;
  var totalQuali = data.reduce(function(s,c){return s+(c.quali||0);},0);
  var totalDepenses = depenses.filter(function(d){return d.date.startsWith(mois);}).reduce(function(s,d){return s+d.montant;},0);
  
  showNotif('Envoi en cours...','info');
  try {
    await emailjs.send('service_gfapq4j','9825f2j',{
      client_nom: 'Comptable',
      numero_facture: 'RECAP-'+mois,
      appareil: 'Recap mensuel '+moisLabel,
      date_facture: new Date().toLocaleDateString('fr-FR'),
      montant: totalTTC.toFixed(2)+' EUR TTC / HT: '+totalHT.toFixed(2)+' / TVA: '+totalTVA.toFixed(2)+' / QualiRepar: '+totalQuali.toFixed(2)+' / Depenses: '+totalDepenses.toFixed(2),
      email: email,
      name: 'Solution Phone'
    });
    showNotif('Recap envoye a '+email,'success');
  } catch(e) {
    showNotif('Erreur envoi','error');
  }
}

function exportComptableCSV() {
  var mois = document.getElementById('compta-mois').value;
  var data = caisse.filter(function(c){return c.date.startsWith(mois);});
  var headers = ['Date','TTC','HT','TVA','CB','Especes','Cheque','Virement','Depot Esp','Depot Cheque','Achats Smart','QualiRepar','Caisse Finale'];
  var cc = getReport(mois);
  var rows = data.map(function(c){
    var ht=(c.ttc/1.2).toFixed(2);var tva=(c.ttc-c.ttc/1.2).toFixed(2);
    cc+=((c.especes||0)-(c.depotEsp||0)-(c.achatSmart||0));
    return[fmtDate(c.date),c.ttc,ht,tva,c.cb||0,c.especes||0,c.cheque||0,c.virement||0,c.depotEsp||0,c.depotCheque||0,c.achatSmart||0,c.quali||0,cc.toFixed(2)].join(';');
  });
  var csv=[headers.join(';')].concat(rows).join('\n');
  var blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');
  a.href=url;a.download='Recap_Comptable_'+mois+'.csv';a.click();
  showNotif('Export comptable téléchargé !','success');
}

function exportAchatsEspecesCSV() {
  var mois = document.getElementById('compta-mois').value;
  var parts = mois.split('-');
  var moisNoms = {'01':'Janvier','02':'Fevrier','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Aout','09':'Septembre','10':'Octobre','11':'Novembre','12':'Decembre'};
  var moisLabel = moisNoms[parts[1]] + '_' + parts[0];

  // Filtrer les achats espèces du mois
  var achatsEsp = phones.filter(function(p) {
    return p.dateAchat && p.dateAchat.startsWith(mois) && p.mode === 'ESPECES';
  });

  if (achatsEsp.length === 0) {
    showNotif('Aucun achat en espèces ce mois-ci', 'info');
    return;
  }

  var headers = ['Date', 'Vendeur / Fournisseur', 'Type', 'Modele', 'Stockage (Go)', 'IMEI', 'Couleur', 'Grade', 'Montant especes (EUR)'];
  var rows = achatsEsp.map(function(p) {
    var vendeur = p.typeAchat === 'FOURNISSEUR'
      ? (p.fournisseur || 'Fournisseur')
      : (p.vendeurNom || '—');
    var type = p.typeAchat === 'FOURNISSEUR' ? 'Fournisseur' : 'Particulier';
    return [
      p.dateAchat,
      vendeur,
      type,
      p.modele || '',
      p.stockage || '',
      p.imei || '',
      p.couleur || '',
      p.grade || '',
      p.achat.toFixed(2)
    ].map(function(v){ return '"' + String(v).replace(/"/g,'""') + '"'; }).join(';');
  });

  // Ligne total
  var total = achatsEsp.reduce(function(s,p){return s+p.achat;},0);
  rows.push('"TOTAL";"";"";"";"";"";"";"";' + '"' + total.toFixed(2) + '"');

  var csv = [headers.join(';')].concat(rows).join('\n');
  var blob = new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'Achats_Especes_' + moisLabel + '.csv';
  a.click();
  showNotif('Export achats espèces téléchargé (' + achatsEsp.length + ' lignes) !', 'success');
}

function renderDashboard(){
  var today = new Date();
  var jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var dateEl = document.getElementById('dash-date');
  if(dateEl) dateEl.textContent = jours[today.getDay()]+' '+today.getDate()+' '+mois[today.getMonth()]+' '+today.getFullYear();

  var isEmploye = _userRole === 'employe';
  var moisCourant = getMoisActuel();

  // ── Alerte smartphones anciens ──
  var anciens = phones.filter(function(p){
    if(p.etat !== 'DISPONIBLE' || !p.dateAchat) return false;
    return Math.floor((today - new Date(p.dateAchat)) / 86400000) > 30;
  });
  var alertZone = document.getElementById('dash-alerts');
  if(alertZone){
    alertZone.innerHTML = anciens.length > 0
      ? '<div style="background:rgba(237,137,54,0.15);border:1px solid var(--warning);border-radius:10px;padding:12px 16px;margin-bottom:12px;color:var(--warning);">⚠️ <b>'+anciens.length+' téléphone(s)</b> en stock depuis plus de 30 jours : '+anciens.map(function(p){return p.modele;}).join(', ')+'</div>'
      : '';
  }

  // ── KPI ──
  var dispo = phones.filter(function(p){return p.etat==='DISPONIBLE';}).length;
  var caSmartMois = phones.filter(function(p){return p.etat==='VENDU'&&p.dateVente&&p.dateVente.startsWith(moisCourant);}).reduce(function(s,p){return s+p.vente;},0);
  var mgSmartMois = phones.filter(function(p){return p.etat==='VENDU'&&p.dateVente&&p.dateVente.startsWith(moisCourant);}).reduce(function(s,p){return s+(p.vente-p.achat);},0);
  var caReparMois = caisse.filter(function(c){return c.date&&c.date.startsWith(moisCourant);}).reduce(function(s,c){return s+(c.ttc||0);},0);
  var bonusQRMois = caisse.filter(function(c){return c.date&&c.date.startsWith(moisCourant);}).reduce(function(s,c){return s+(c.quali||0);},0);
  var caTotal = caSmartMois + caReparMois;

  function dashCard(label, val, sub, page, extra){
    var d = document.createElement('div');
    d.className = 'dash-card';
    d.innerHTML = '<div class="dash-label">'+label+'</div><div class="dash-value"'+(extra?' style="'+extra+'"':'')+'>'+val+'</div>'+(sub?'<div class="dash-sub">'+sub+'</div>':'');
    if(page) d.onclick = function(){ showPage(page, null); if(page==='ventes-smart') renderVentesSmartphones(); if(page==='qualirepar') qrInit(); };
    return d;
  }

  var cards = document.getElementById('dash-cards');
  if(cards){
    cards.innerHTML = '';
    if(isEmploye){
      cards.appendChild(dashCard('Stock dispo', dispo+' tél.', '', 'phones', ''));
      cards.appendChild(dashCard('CA smartphones', caSmartMois.toFixed(0)+' €', 'Marge : '+mgSmartMois.toFixed(0)+' €', 'ventes-smart', 'color:var(--blue)'));
    } else {
      cards.appendChild(dashCard('CA réparations', caReparMois.toFixed(0)+' €', 'dont QR : '+bonusQRMois.toFixed(0)+' €', 'reparations', ''));
      cards.appendChild(dashCard('CA smartphones', caSmartMois.toFixed(0)+' €', 'Marge : '+mgSmartMois.toFixed(0)+' €', 'ventes-smart', 'color:var(--blue)'));
      cards.appendChild(dashCard('CA total du mois', caTotal.toFixed(0)+' €', '', null, 'color:var(--red)'));
      cards.appendChild(dashCard('Stock dispo', dispo+' tél.', 'Smartphones', 'phones', ''));
      cards.appendChild(dashCard('Bonus QR encaissé', bonusQRMois.toFixed(0)+' €', 'ce mois', 'qualirepar', 'color:var(--green)'));
    }
  }

  // ── Réparations récentes ──
  var dashRep = document.getElementById('dash-reparations');
  if(dashRep){
    var repRecentes = Array.isArray(reparations) ? reparations.slice(-6).reverse() : [];
    dashRep.innerHTML = repRecentes.length > 0
      ? repRecentes.map(function(r){ return '<tr><td><b>'+r.clientNom+'</b></td><td style="color:var(--text-muted);font-size:12px;">'+r.appareil+'</td><td>'+r.prix.toFixed(0)+' €</td><td style="font-size:12px;color:var(--text-muted);">'+fmtDate(r.date)+'</td></tr>'; }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:14px;">Aucune réparation</td></tr>';
  }

  // ── Clients récents ──
  var dashClients = document.getElementById('dash-clients-list');
  if(dashClients){
    var clientsRecents = clients.slice(-6).reverse();
    dashClients.innerHTML = clientsRecents.length > 0
      ? clientsRecents.map(function(c){
          var nbRep = reparations.filter(function(r){return r.clientNom&&c.nom&&r.clientNom.toLowerCase()===c.nom.toLowerCase();}).length;
          return '<tr><td><b>'+(c.prenom?c.prenom+' ':'')+c.nom+'</b></td><td style="font-size:12px;color:var(--text-muted);">'+(c.tel||'—')+'</td><td style="font-size:12px;text-align:center;">'+nbRep+'</td></tr>';
        }).join('')
      : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">Aucun client</td></tr>';
  }

  // ── Derniers smartphones ──
  var dashPhones = document.getElementById('dash-phones');
  if(dashPhones){
    var recent = phones.slice(-4).reverse();
    dashPhones.innerHTML = recent.map(function(p){
      return '<tr><td><b>'+p.modele+'</b></td><td>'+(p.grade||'—')+'</td><td>'+p.vente+' €</td><td><span class="badge '+(p.etat==='VENDU'?'badge-red':'badge-green')+'">'+p.etat+'</span></td></tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:14px;">Aucun smartphone</td></tr>';
  }

  // ── Z de caisse ──
  var dashCaisse = document.getElementById('dash-caisse');
  var dashCaisseCard = document.getElementById('dash-caisse-card');
  if(isEmploye){
    if(dashCaisseCard) dashCaisseCard.style.display='none';
  } else {
    if(dashCaisseCard) dashCaisseCard.style.display='';
    if(dashCaisse){
      var fin = calcFinales();
      dashCaisse.innerHTML = caisse.slice(-4).reverse().map(function(c){
        var i = caisse.indexOf(c);
        return '<tr><td>'+fmtDate(c.date)+'</td><td><b>'+c.ttc.toFixed(0)+' €</b></td><td>'+((c.quali||0)>0?'<span style="color:var(--green)">'+c.quali.toFixed(0)+' €</span>':'—')+'</td><td>'+(fin[i]?fin[i].toFixed(0)+' €':'—')+'</td></tr>';
      }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:14px;">Aucune saisie</td></tr>';
    }
  }

  // ── QualiRépar alertes ──
  var qrAlerts = document.getElementById('dash-qr-alerts');
  var dossiers = (typeof qrDossiersList !== 'undefined') ? qrDossiersList : [];
  var nonConf = dossiers.filter(function(d){return d.statut==='NonConform';});
  if(qrAlerts){
    qrAlerts.innerHTML = nonConf.length > 0
      ? '<div style="background:#fef2f2;border:1px solid var(--red);border-radius:10px;padding:10px 16px;margin-bottom:12px;color:var(--red);font-size:13px;">🔴 <b>'+nonConf.length+' dossier(s) QualiRépar</b> à corriger</div>'
      : '';
  }

  // ── Masquer sections employé ──
  if(isEmploye){
    ['dash-rep-card','dash-clients-card','dash-qr-card'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display='none';
    });
  }
}

// ============================================================
//  MODULE INSTAGRAM / IA — Solution Phone
// ============================================================

var igPosts   = JSON.parse(localStorage.getItem('sp_ig_posts')  || '[]');
var igDrafts  = JSON.parse(localStorage.getItem('sp_ig_drafts') || '[]');
var igCalMonth = (function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})();

function getIgApiKey(){
  return localStorage.getItem('sp_claude_key') || window._cachedApiKey || '';
}

async function saveApiKey(){
  var k = document.getElementById('ig-api-key').value.trim();
  if(!k){ showNotif('Clé vide !','error'); return; }
  // Sauvegarde locale
  localStorage.setItem('sp_claude_key', k);
  window._cachedApiKey = k;
  // Sauvegarde Supabase pour persistance cross-device / PWA
  try {
    var existing = await supaFetch('settings','GET',null,'?key=eq.claude_api_key');
    if(existing && existing.length > 0){
      await supaFetch('settings','PATCH',{key:'claude_api_key',value:k},'?key=eq.claude_api_key');
    } else {
      await supaFetch('settings','POST',{key:'claude_api_key',value:k});
    }
    showNotif('Clé API sauvegardée !','success');
  } catch(e){
    showNotif('Clé sauvegardée localement','success');
  }
  document.getElementById('ig-api-setup').style.display='none';
  document.getElementById('ig-content').style.display='block';
  showIgTab('captions');
  renderIgDrafts();
}

async function loadApiKeyFromSupabase(){
  // Charger la clé depuis Supabase si pas en localStorage
  var local = localStorage.getItem('sp_claude_key');
  if(local){ window._cachedApiKey = local; return; }
  try {
    var res = await supaFetch('settings','GET',null,'?key=eq.claude_api_key');
    if(res && res.length > 0 && res[0].value){
      localStorage.setItem('sp_claude_key', res[0].value);
      window._cachedApiKey = res[0].value;
    }
  } catch(e){}
}

function renderInstagram(){
  loadApiKeyFromSupabase().then(function(){
    var k = getIgApiKey();
    document.getElementById('ig-api-key').value = k;
    if(k){
      document.getElementById('ig-api-setup').style.display='none';
      document.getElementById('ig-content').style.display='block';
      showIgTab('captions');
      renderIgDrafts();
    } else {
      document.getElementById('ig-api-setup').style.display='block';
      document.getElementById('ig-content').style.display='none';
    }
  });
}

function showIgTab(tab){
  ['captions','calendar','ideas','responses','stories','gmb'].forEach(function(t){
    var el=document.getElementById('ig-tab-'+t);
    var btn=document.getElementById('ig-btn-'+t);
    if(el)el.style.display=(t===tab?'block':'none');
    if(btn){btn.className='btn'+(t===tab?' btn-primary':'');}
  });
  if(tab==='calendar'){renderIgCalendar();renderIgPostsList();}
  if(tab==='ideas'){renderIgIdeas();}
  if(tab==='stories'){renderStoryTab();}
  if(tab==='gmb'){renderGmbTab();}
}

// ---- Appel API Claude ----
async function callClaude(prompt){
  var key=getIgApiKey();
  if(!key){showNotif('Clé API manquante','error');throw new Error('No API key');}
  var resp=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key':key,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body:JSON.stringify({
      model:'claude-sonnet-4-5',
      max_tokens:1000,
      messages:[{role:'user',content:prompt}]
    })
  });
  if(!resp.ok){var err=await resp.json().catch(function(){return{};});throw new Error((err.error&&err.error.message)||'Erreur '+resp.status);}
  var data=await resp.json();
  return data.content[0].text;
}

// ---- Génération de caption ----
async function generateCaption(){
  var type=document.getElementById('ig-post-type').value;
  var details=document.getElementById('ig-post-details').value;
  var tone=document.getElementById('ig-tone').value;
  var btn=document.getElementById('ig-gen-btn');
  btn.textContent='⏳ Génération en cours...';btn.disabled=true;
  document.getElementById('ig-caption-result').innerHTML='<div style="text-align:center;padding:30px;color:var(--text-muted);">🤖 L&#39;IA rédige votre post...</div>';

  var stockDispo=phones.filter(function(p){return p.etat==='DISPONIBLE';}).slice(0,5)
    .map(function(p){return p.modele+(p.stockage?' '+p.stockage+'Go':'')+' Grade '+(p.grade||'A')+' à '+p.vente+'€';}).join(', ');

  var prompt='Tu es community manager expert pour "Solution Phone", une boutique de smartphones reconditionnés et de réparations au 21 Rue Gambetta à Mâcon (71000).\n\n'+
    'Type de post : '+type+'\n'+
    'Ton souhaité : '+tone+'\n'+
    (details?'Informations supplémentaires : '+details+'\n':'')+
    (stockDispo?'Stock disponible en ce moment : '+stockDispo+'\n':'')+
    '\nCrée un post Instagram optimisé avec :\n'+
    '1. Un texte accrocheur avec émojis (80-150 mots max)\n'+
    '2. Une call-to-action claire (venir en boutique, appeler, DM)\n'+
    '3. La mention : 📍 21 Rue Gambetta, Mâcon\n'+
    '4. 15 à 20 hashtags pertinents (mix populaires + locaux : #macon #macon71 #bourgogne etc.)\n\n'+
    'Format EXACT attendu :\n'+
    '📝 TEXTE :\n[texte du post]\n\n'+
    '#️⃣ HASHTAGS :\n[hashtags séparés par des espaces]';

  try{
    var result=await callClaude(prompt);
    document.getElementById('ig-last-result').value=result;
    var safe=result.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('ig-caption-result').innerHTML=
      '<div style="background:#f8fafc;border:1px solid var(--green);border-radius:10px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.7;max-height:340px;overflow-y:auto;">'+safe+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">'+
      '<button class="btn btn-primary btn-sm" onclick="copyIgCaption()">📋 Copier</button>'+
      '<button class="btn btn-sm" style="border-color:var(--green);color:var(--green);" onclick="saveIgDraft()">💾 Sauvegarder en brouillon</button>'+
      '</div>';
    showNotif('Caption générée !','success');
  }catch(e){
    document.getElementById('ig-caption-result').innerHTML='<div style="color:var(--red);padding:16px;">❌ Erreur : '+e.message+'</div>';
    showNotif('Erreur API : '+e.message,'error');
  }
  btn.textContent='✨ Générer avec l\'IA Claude';btn.disabled=false;
}

function copyIgCaption(){
  var t=document.getElementById('ig-last-result').value;
  if(!t)return;
  navigator.clipboard.writeText(t).then(function(){showNotif('Copié dans le presse-papier !','success');});
}

function saveIgDraft(){
  var t=document.getElementById('ig-last-result').value;
  if(!t)return;
  var type=document.getElementById('ig-post-type').value;
  igDrafts.unshift({id:Date.now(),date:new Date().toISOString(),type:type,text:t});
  if(igDrafts.length>20)igDrafts=igDrafts.slice(0,20);
  localStorage.setItem('sp_ig_drafts',JSON.stringify(igDrafts));
  renderIgDrafts();
  showNotif('Brouillon sauvegardé !','success');
}

function renderIgDrafts(){
  var el=document.getElementById('ig-drafts-list');
  if(!el)return;
  if(!igDrafts.length){el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;font-size:13px;">Aucun brouillon</div>';return;}
  el.innerHTML=igDrafts.map(function(d,i){
    var dt=new Date(d.date).toLocaleDateString('fr-FR');
    var preview=d.text.substring(0,80).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'...';
    return '<div style="display:flex;justify-content:space-between;align-items:start;padding:10px;border-bottom:1px solid var(--border);gap:10px;">'+
      '<div style="flex:1;cursor:pointer;" onclick="showDraftFull('+i+')">'+
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">'+dt+' · '+d.type+'</div>'+
      '<div style="font-size:12px;color:var(--text);">'+preview+'</div></div>'+
      '<div style="display:flex;gap:6px;flex-shrink:0;">'+
      '<button class="btn btn-sm" onclick="copyDraft('+i+')">📋</button>'+
      '<button class="btn btn-sm" style="border-color:var(--red);color:var(--red);" onclick="deleteDraft('+i+')">🗑️</button></div>'+
      '</div>';
  }).join('');
}

function showDraftFull(i){
  var d=igDrafts[i];if(!d)return;
  document.getElementById('ig-last-result').value=d.text;
  var safe=d.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  document.getElementById('ig-caption-result').innerHTML=
    '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.7;max-height:340px;overflow-y:auto;">'+safe+'</div>'+
    '<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-primary btn-sm" onclick="copyIgCaption()">📋 Copier</button></div>';
}

function copyDraft(i){
  var d=igDrafts[i];if(!d)return;
  navigator.clipboard.writeText(d.text).then(function(){showNotif('Copié !','success');});
}

function deleteDraft(i){
  if(!confirm('Supprimer ce brouillon ?'))return;
  igDrafts.splice(i,1);
  localStorage.setItem('sp_ig_drafts',JSON.stringify(igDrafts));
  renderIgDrafts();
}

// ---- Calendrier ----
function renderIgCalendar(){
  var parts=igCalMonth.split('-');
  var year=parseInt(parts[0]),month=parseInt(parts[1]);
  var firstDay=new Date(year,month-1,1).getDay();
  firstDay=firstDay===0?6:firstDay-1;
  var daysInMonth=new Date(year,month,0).getDate();
  var monthNames=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var el=document.getElementById('ig-cal-title');
  if(el)el.textContent=monthNames[month-1]+' '+year;

  var html='<table style="width:100%;border-collapse:collapse;margin-top:8px;">';
  html+='<thead><tr>'+['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(function(d){
    return '<th style="padding:8px 4px;text-align:center;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">'+d+'</th>';
  }).join('')+'</tr></thead><tbody>';

  var day=1;
  for(var week=0;week<6;week++){
    if(day>daysInMonth)break;
    html+='<tr>';
    for(var dow=0;dow<7;dow++){
      if((week===0&&dow<firstDay)||day>daysInMonth){
        html+='<td style="padding:3px;"></td>';
      } else {
        var ds=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
        var todayStr=(new Date()).toISOString().substring(0,10);
        var isToday=(ds===todayStr);
        var posts=igPosts.filter(function(p){return p.date===ds;});
        var hasPosts=posts.length>0;
        html+='<td style="padding:3px;vertical-align:top;" onclick="openIgPlanModal(\''+ds+'\')">';
        html+='<div style="background:'+(hasPosts?'rgba(229,62,62,0.12)':'#f8fafc')+';border:1px solid '+(isToday?'var(--blue)':hasPosts?'var(--red)':'var(--border)')+';border-radius:8px;padding:6px;min-height:58px;cursor:pointer;transition:.15s;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">';
        html+='<div style="font-size:12px;font-weight:700;color:'+(isToday?'var(--blue)':hasPosts?'var(--red)':'var(--text-muted)')+';">'+day+'</div>';
        if(hasPosts){
          posts.forEach(function(p){
            html+='<div style="font-size:9px;background:var(--red);color:#fff;border-radius:3px;padding:2px 4px;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">📸 '+p.type+'</div>';
          });
        } else {
          html+='<div style="font-size:9px;color:var(--text-dim);margin-top:2px;text-align:center;">+</div>';
        }
        html+='</div></td>';
        day++;
      }
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  var calEl=document.getElementById('ig-calendar');
  if(calEl)calEl.innerHTML=html;
}

function prevCalMonth(){
  var p=igCalMonth.split('-');var y=parseInt(p[0]),m=parseInt(p[1]);
  m--;if(m<1){m=12;y--;}
  igCalMonth=y+'-'+String(m).padStart(2,'0');
  renderIgCalendar();
}

function nextCalMonth(){
  var p=igCalMonth.split('-');var y=parseInt(p[0]),m=parseInt(p[1]);
  m++;if(m>12){m=1;y++;}
  igCalMonth=y+'-'+String(m).padStart(2,'0');
  renderIgCalendar();
}

function openIgPlanModal(date){
  document.getElementById('ig-plan-date').value=date;
  var parts=date.split('-');
  document.getElementById('ig-plan-date-display').textContent=parts[2]+'/'+parts[1]+'/'+parts[0];
  document.getElementById('ig-plan-type').value='Promo Smartphone';
  document.getElementById('ig-plan-note').value='';
  openModal('modal-ig-post');
}

function saveIgPost(){
  var date=document.getElementById('ig-plan-date').value;
  var type=document.getElementById('ig-plan-type').value;
  var note=document.getElementById('ig-plan-note').value;
  if(!date){showNotif('Date manquante','error');return;}
  igPosts=igPosts.filter(function(p){return!(p.date===date&&p.type===type);});
  igPosts.push({id:Date.now(),date:date,type:type,note:note});
  igPosts.sort(function(a,b){return a.date.localeCompare(b.date);});
  localStorage.setItem('sp_ig_posts',JSON.stringify(igPosts));
  closeModal('modal-ig-post');
  renderIgCalendar();
  renderIgPostsList();
  showNotif('Post planifié le '+document.getElementById('ig-plan-date-display').textContent+' !','success');
}

function renderIgPostsList(){
  var el=document.getElementById('ig-posts-list');
  if(!el)return;
  var upcoming=igPosts.filter(function(p){return p.date>=(new Date()).toISOString().substring(0,10);}).slice(0,10);
  if(!upcoming.length){el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;font-size:13px;">Aucun post planifié à venir</div>';return;}
  el.innerHTML='<table style="width:100%;font-size:13px;border-collapse:collapse;">'+
    '<thead><tr><th>Date</th><th>Type</th><th>Note</th><th></th></tr></thead><tbody>'+
    upcoming.map(function(p){
      var parts=p.date.split('-');
      return '<tr><td style="padding:9px 12px;border-bottom:1px solid var(--border);font-weight:600;">'+parts[2]+'/'+parts[1]+'/'+parts[0]+'</td>'+
        '<td style="padding:9px 12px;border-bottom:1px solid var(--border);"><span class="badge badge-red">'+p.type+'</span></td>'+
        '<td style="padding:9px 12px;border-bottom:1px solid var(--border);color:var(--text-muted);">'+(p.note||'—')+'</td>'+
        '<td style="padding:9px 12px;border-bottom:1px solid var(--border);"><button class="btn btn-sm" style="border-color:var(--red);color:var(--red);" onclick="deleteIgPost('+p.id+')">🗑️</button></td></tr>';
    }).join('')+'</tbody></table>';
}

function deleteIgPost(id){
  if(!confirm('Supprimer ce post planifié ?'))return;
  igPosts=igPosts.filter(function(p){return p.id!==id;});
  localStorage.setItem('sp_ig_posts',JSON.stringify(igPosts));
  renderIgCalendar();
  renderIgPostsList();
}

// ---- Idées selon le stock ----
function renderIgIdeas(){
  var el=document.getElementById('ig-ideas-list');
  if(!el)return;
  var available=phones.filter(function(p){return p.etat==='DISPONIBLE';});
  if(!available.length){
    el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:30px;">📱 Aucun smartphone disponible en stock</div>';
    return;
  }
  el.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:4px;">'+
    available.slice(0,8).map(function(p){
      var marge=p.vente-p.achat;
      var enc=encodeURIComponent(p.modele);
      return '<div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;">'+
        '<div><div style="font-weight:700;font-size:14px;">📱 '+p.modele+'</div>'+
        '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Grade '+(p.grade||'A')+' · '+(p.stockage||'?')+'Go · '+(p.batterie||'?')+'%</div></div>'+
        '<div style="text-align:right;"><div style="font-size:17px;font-weight:800;color:var(--blue);">'+p.vente+' €</div>'+
        '<div style="font-size:11px;color:var(--green);">+'+marge+' € marge</div></div></div>'+
        '<button class="btn btn-primary btn-sm" onclick="generatePhonePost(\''+enc+'\','+p.vente+',\''+(p.grade||'A')+'\','+(p.stockage||128)+','+(p.batterie||80)+')" style="width:100%;">✨ Générer un post</button>'+
        '</div>';
    }).join('')+'</div>';
}

async function generatePhonePost(enc,prix,grade,stockage,batterie){
  var modele=decodeURIComponent(enc);
  var res=document.getElementById('ig-ideas-result');
  res.innerHTML='<div class="card"><div style="text-align:center;padding:24px;color:var(--text-muted);">⏳ L\'IA rédige le post pour le '+modele+'...</div></div>';

  var gradeLabel={'A+':'comme neuf, état irréprochable','A':'très bon état, légères traces d\'usage','B':'bon état, quelques micro-rayures','C':'état correct, marques visibles'}[grade]||'reconditionné';

  var prompt='Tu es community manager pour "Solution Phone", boutique de smartphones reconditionnés au 21 Rue Gambetta, Mâcon.\n\n'+
    'Crée un post Instagram vendeur pour ce smartphone :\n'+
    '- Modèle : '+modele+'\n'+
    '- Prix : '+prix+'€\n'+
    '- Grade '+grade+' ('+gradeLabel+')\n'+
    '- Stockage : '+stockage+'Go\n'+
    '- Batterie : '+batterie+'%\n\n'+
    'Le post doit :\n'+
    '✅ Être enthousiaste et vendeur\n'+
    '✅ Mettre en avant le rapport qualité/prix du reconditionné\n'+
    '✅ Mentionner batterie, stockage et grade\n'+
    '✅ Avoir une call-to-action : venir en boutique ou envoyer un DM\n'+
    '✅ Se terminer par : 📍 21 Rue Gambetta, Mâcon\n'+
    '✅ Inclure 15 hashtags pertinents dont #macon #reconditione #secondemain\n\n'+
    'Format attendu :\n📝 TEXTE :\n[texte]\n\n#️⃣ HASHTAGS :\n[hashtags]';

  try{
    var text=await callClaude(prompt);
    var safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    res.innerHTML='<div class="card">'+
      '<div class="card-header"><div class="card-title">✨ Post généré pour '+modele+'</div></div>'+
      '<div style="background:#f8fafc;border:1px solid var(--green);border-radius:10px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.7;max-height:300px;overflow-y:auto;">'+safe+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;">'+
      '<button class="btn btn-primary btn-sm" id="ig-ideas-copy-btn">📋 Copier</button>'+
      '<button class="btn btn-sm" style="border-color:var(--green);color:var(--green);" id="ig-ideas-save-btn">💾 Sauvegarder</button>'+
      '</div></div>';
    document.getElementById('ig-ideas-copy-btn').addEventListener('click',function(){
      navigator.clipboard.writeText(text).then(function(){showNotif('Copié !','success');});
    });
    document.getElementById('ig-ideas-save-btn').addEventListener('click',function(){
      igDrafts.unshift({id:Date.now(),date:new Date().toISOString(),type:'Promo '+modele,text:text});
      localStorage.setItem('sp_ig_drafts',JSON.stringify(igDrafts));
      showNotif('Sauvegardé dans les brouillons !','success');
    });
    showNotif('Post généré !','success');
  }catch(e){
    res.innerHTML='<div class="card"><div style="color:var(--red);padding:16px;">❌ Erreur : '+e.message+'</div></div>';
  }
}

// ---- Réponses aux commentaires ----
async function generateResponse(){
  var comment=document.getElementById('ig-comment').value.trim();
  var context=document.getElementById('ig-response-context').value;
  if(!comment){showNotif('Entrez un commentaire à traiter','error');return;}
  var btn=document.getElementById('ig-resp-btn');
  btn.textContent='⏳ Génération...';btn.disabled=true;
  document.getElementById('ig-response-result').innerHTML='<div style="text-align:center;padding:24px;color:var(--text-muted);">🤖 L\'IA rédige les réponses...</div>';

  var prompt='Tu es responsable des réseaux sociaux de "Solution Phone", boutique de smartphones reconditionnés et réparations au 21 Rue Gambetta, Mâcon.\n\n'+
    'Un utilisateur a posté ce commentaire Instagram : "'+comment+'"\n'+
    'Type de commentaire : '+context+'\n\n'+
    'Génère 2 réponses professionnelles, chaleureuses et engageantes :\n\n'+
    '1. RÉPONSE COURTE (1-2 lignes max, directe avec émoji)\n'+
    '2. RÉPONSE COMPLÈTE (3-5 lignes, plus détaillée, avec invitation à venir ou à nous contacter : 06/03 XX XX XX ou en DM)\n\n'+
    'Ton : professionnel mais chaleureux, représente bien une petite boutique de quartier à Mâcon.\n'+
    'Ne mentionne pas de prix exacts.\n\n'+
    'Format EXACT :\n💬 RÉPONSE COURTE :\n[réponse]\n\n📩 RÉPONSE COMPLÈTE :\n[réponse]';

  try{
    var text=await callClaude(prompt);
    var safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('ig-response-result').innerHTML=
      '<div style="background:#f8fafc;border:1px solid var(--blue);border-radius:10px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.7;">'+safe+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;">'+
      '<button class="btn btn-primary btn-sm" id="ig-resp-copy-btn">📋 Copier</button></div>';
    document.getElementById('ig-resp-copy-btn').addEventListener('click',function(){
      navigator.clipboard.writeText(text).then(function(){showNotif('Copié !','success');});
    });
    showNotif('Réponses générées !','success');
  }catch(e){
    document.getElementById('ig-response-result').innerHTML='<div style="color:var(--red);padding:16px;">❌ Erreur : '+e.message+'</div>';
    showNotif('Erreur : '+e.message,'error');
  }
  btn.textContent='💬 Générer les réponses avec IA';btn.disabled=false;
}

// ============================================================
//  CRÉATEUR DE STORIES INSTAGRAM
// ============================================================

function renderStoryTab(){
  var phonesAvail=phones.filter(function(p){return p.etat==='DISPONIBLE';});
  var sel=document.getElementById('story-phone-select');
  if(sel){
    sel.innerHTML='<option value="">-- Saisie manuelle --</option>'+
      phonesAvail.map(function(p){
        return '<option value="'+p.id+'">'+p.modele+' · '+p.vente+'€ · Grade '+(p.grade||'A')+'</option>';
      }).join('');
    sel.onchange=function(){
      var phone=phones.find(function(x){return x.id==sel.value;});
      if(phone){
        var mm=document.getElementById('story-promo-modele');
        var mp=document.getElementById('story-promo-prix');
        var mg=document.getElementById('story-promo-grade');
        var md=document.getElementById('story-promo-desc');
        if(mm)mm.value=phone.modele;
        if(mp)mp.value=phone.vente;
        if(mg)mg.value=phone.grade||'A';
        if(md)md.value=(phone.stockage?phone.stockage+'Go':'')+(phone.batterie?' · Batterie '+phone.batterie+'%':'');
      }
      renderStoryPreview();
    };
  }
  var dsel=document.getElementById('story-draft-select');
  if(dsel){
    dsel.innerHTML='<option value="">-- Aucun brouillon --</option>'+
      igDrafts.map(function(d,i){
        return '<option value="'+i+'">'+(d.type||'Brouillon')+' · '+new Date(d.date).toLocaleDateString('fr-FR')+'</option>';
      }).join('');
  }
  updateStoryType();
}

function updateStoryType(){
  var type=document.getElementById('story-type').value;
  var forms={promo:'story-form-promo',reparation:'story-form-rep',texte:'story-form-texte',brouillon:'story-form-brouillon'};
  Object.keys(forms).forEach(function(k){
    var el=document.getElementById(forms[k]);
    if(el)el.style.display=(k===type?'flex':'none');
  });
  renderStoryPreview();
}

function renderStoryPreview(){
  var canvas=document.getElementById('story-preview-canvas');
  if(!canvas)return;
  drawStory(canvas,810,1440);
}

function downloadStory(){
  var canvas=document.createElement('canvas');
  drawStory(canvas,1080,1920);
  canvas.toBlob(function(blob){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='story_solution_phone_'+Date.now()+'.png';a.click();
    URL.revokeObjectURL(url);
    showNotif('Story téléchargée ! 📥','success');
  },'image/png');
}

function drawStory(canvas,W,H){
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  var s=W/1080;
  var type=document.getElementById('story-type')?document.getElementById('story-type').value:'promo';
  if(type==='promo')storyPromo(ctx,W,H,s);
  else if(type==='reparation')storyRep(ctx,W,H,s);
  else if(type==='texte')storyTexte(ctx,W,H,s);
  else if(type==='brouillon')storyBrouillon(ctx,W,H,s);
}

function igWrapText(ctx,text,x,y,maxW,lh){
  if(!text)return 0;
  var words=text.split(' '),line='',lines=[];
  words.forEach(function(w){
    var test=line+w+' ';
    if(ctx.measureText(test).width>maxW&&line){lines.push(line.trim());line=w+' ';}
    else line=test;
  });
  if(line.trim())lines.push(line.trim());
  lines.forEach(function(l,i){ctx.fillText(l,x,y+i*lh);});
  return lines.length*lh;
}

function storyBranding(ctx,W,H,s){
  var showQr=document.getElementById('story-show-qr')&&document.getElementById('story-show-qr').checked;
  var showBanner=document.getElementById('story-show-banner')&&document.getElementById('story-show-banner').checked;
  var shopUrl=val('story-shop-url')||'';
  var hasShop=shopUrl.length>3;

  // Bandeau boutique en ligne (juste au-dessus du branding)
  var brandH=130*s;
  var bannerH=(hasShop&&showBanner)?72*s:0;
  var qrSize=160*s;
  var qrZoneH=(hasShop&&showQr)?qrSize+20*s:0;
  var totalBottom=brandH+bannerH+qrZoneH;

  // Fond branding bas
  ctx.fillStyle='rgba(0,0,0,0.82)';
  ctx.fillRect(0,H-totalBottom,W,totalBottom);

  var yStart=H-totalBottom;

  // Zone QR code
  if(hasShop&&showQr&&window._storyQrImg){
    var qrX=(W-qrSize)/2;
    var qrY=yStart+10*s;
    // Fond blanc pour le QR
    ctx.fillStyle='#ffffff';
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(qrX-8*s,qrY-8*s,qrSize+16*s,qrSize+16*s,12*s);
    else ctx.rect(qrX-8*s,qrY-8*s,qrSize+16*s,qrSize+16*s);
    ctx.fill();
    ctx.drawImage(window._storyQrImg,qrX,qrY,qrSize,qrSize);
    // Label sous le QR
    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.font=Math.round(20*s)+'px Arial,sans-serif';
    ctx.textAlign='center';
    ctx.fillText('Scanner pour visiter la boutique',W/2,qrY+qrSize+18*s);
    yStart+=qrZoneH;
  } else if(hasShop&&showQr&&!window._storyQrImg){
    yStart+=qrZoneH;
  }

  // Bandeau boutique en ligne
  if(hasShop&&showBanner){
    var g2=ctx.createLinearGradient(0,yStart,W,yStart);
    g2.addColorStop(0,'rgba(72,187,120,0.25)');
    g2.addColorStop(0.5,'rgba(72,187,120,0.35)');
    g2.addColorStop(1,'rgba(66,153,225,0.25)');
    ctx.fillStyle=g2;
    ctx.fillRect(0,yStart,W,bannerH);
    ctx.strokeStyle='rgba(72,187,120,0.5)';
    ctx.lineWidth=1*s;
    ctx.beginPath();ctx.moveTo(0,yStart);ctx.lineTo(W,yStart);ctx.stroke();

    ctx.textAlign='center';
    ctx.fillStyle='#48bb78';
    ctx.font='bold '+Math.round(28*s)+'px Arial,sans-serif';
    ctx.fillText('🛒  Disponible sur notre boutique en ligne',W/2,yStart+28*s);
    var displayUrl=shopUrl.replace(/^https?:\/\//,'');
    ctx.fillStyle='rgba(255,255,255,0.65)';
    ctx.font=Math.round(21*s)+'px Arial,sans-serif';
    ctx.fillText(displayUrl,W/2,yStart+54*s);
    yStart+=bannerH;
  }

  // Branding Solution Phone
  ctx.fillStyle='#e53e3e';
  ctx.font='bold '+Math.round(32*s)+'px -apple-system,Arial,sans-serif';
  ctx.textAlign='center';
  ctx.fillText('📱 Solution Phone',W/2,yStart+42*s);
  ctx.fillStyle='rgba(255,255,255,0.65)';
  ctx.font=Math.round(24*s)+'px -apple-system,Arial,sans-serif';
  ctx.fillText('21 Rue Gambetta · Mâcon · 71000',W/2,yStart+74*s);
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.font=Math.round(20*s)+'px -apple-system,Arial,sans-serif';
  ctx.fillText('solutionphone71.github.io/solution-phone',W/2,yStart+100*s);
}

function storyDecoBubbles(ctx,W,H,c1,c2){
  ctx.save();
  ctx.globalAlpha=0.07;
  ctx.fillStyle=c1;
  ctx.beginPath();ctx.arc(W*0.88,H*0.12,320,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(W*0.08,H*0.82,260,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=c2;
  ctx.beginPath();ctx.arc(W*0.5,H*0.55,200,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function storyPromo(ctx,W,H,s){
  var modele=val('story-promo-modele')||'Smartphone';
  var prix=parseFloat(val('story-promo-prix'))||0;
  var grade=val('story-promo-grade')||'A';
  var desc=val('story-promo-desc')||'';
  var phoneId=val('story-phone-select');
  var phone=phones.find(function(p){return p.id==phoneId;});
  if(phone){modele=phone.modele;prix=phone.vente;grade=phone.grade||'A';}

  // Background
  var g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#0d0d0d');g.addColorStop(0.6,'#1a0505');g.addColorStop(1,'#2d0a0a');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  storyDecoBubbles(ctx,W,H,'#e53e3e','#ff6b6b');

  // Barre rouge haut
  var topG=ctx.createLinearGradient(0,0,W,0);
  topG.addColorStop(0,'#e53e3e');topG.addColorStop(1,'#c53030');
  ctx.fillStyle=topG;ctx.fillRect(0,0,W,10*s);

  // Badge PROMO
  var bw=820*s,bh=68*s,bx=(W-bw)/2,by=80*s;
  ctx.fillStyle='rgba(255,255,255,0.95)';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,34*s);
  else ctx.rect(bx,by,bw,bh);
  ctx.fill();
  ctx.fillStyle='#e53e3e';ctx.font='bold '+Math.round(28*s)+'px Arial,sans-serif';ctx.textAlign='center';
  ctx.fillText('🆕  ARRIVAGE SMARTPHONE DU JOUR',W/2,by+44*s);

  // Photo ou emoji téléphone
  var storyImg=window._storyPhotoImg||null;
  if(storyImg){
    // Cadre lumineux derrière la photo
    ctx.save();
    ctx.shadowColor='rgba(229,62,62,0.6)';ctx.shadowBlur=60*s;
    var iw=storyImg.naturalWidth,ih=storyImg.naturalHeight;
    var maxW=W*0.94,maxH=820*s;
    var ratio=Math.min(maxW/iw,maxH/ih);
    var dw=iw*ratio,dh=ih*ratio;
    var dx=(W-dw)/2,dy=100*s;
    // Fond blanc doux derrière la photo
    ctx.fillStyle='rgba(0,0,0,0.06)';
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(dx-16*s,dy-16*s,dw+32*s,dh+32*s,24*s);
    else ctx.rect(dx-16*s,dy-16*s,dw+32*s,dh+32*s);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(dx,dy,dw,dh,18*s);
    else ctx.rect(dx,dy,dw,dh);
    ctx.clip();
    ctx.drawImage(storyImg,dx,dy,dw,dh);
    ctx.restore();
  } else {
    ctx.font=Math.round(180*s)+'px serif';
    ctx.textAlign='center';ctx.fillText('📱',W/2,480*s);
  }

  // Positions dynamiques selon photo ou emoji
  var yBase=storyImg?1080*s:560*s;

  // ---- ENCART PUBLICITAIRE BLANC ----
  var cardW=W-80*s;
  var cardX=40*s;
  var cardY=yBase-40*s;
  var cardH=420*s;

  // Ombre portée
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.4)';
  ctx.shadowBlur=30*s;
  ctx.shadowOffsetY=6*s;

  // Fond blanc
  ctx.fillStyle='#ffffff';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(cardX,cardY,cardW,cardH,32*s);
  else ctx.rect(cardX,cardY,cardW,cardH);
  ctx.fill();
  ctx.restore();

  // Bordure rouge fine
  ctx.strokeStyle='rgba(229,62,62,0.4)';
  ctx.lineWidth=2*s;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(cardX,cardY,cardW,cardH,32*s);
  else ctx.rect(cardX,cardY,cardW,cardH);
  ctx.stroke();

  // Barre rouge en haut
  ctx.fillStyle='#e53e3e';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(cardX,cardY,cardW,7*s,{upperLeft:32*s,upperRight:32*s,lowerLeft:0,lowerRight:0});
  else ctx.rect(cardX,cardY,cardW,7*s);
  ctx.fill();

  var cx=W/2;
  var lineH=cardH/4;

  // Modèle — noir
  ctx.textAlign='center';
  ctx.fillStyle='#111111';
  var fz=modele.length>14?54:68;
  ctx.font='bold '+Math.round(fz*s)+'px Arial,sans-serif';
  ctx.fillText(modele.toUpperCase(),cx,cardY+lineH*0.85);

  // Séparateur rouge
  ctx.strokeStyle='rgba(229,62,62,0.3)';
  ctx.lineWidth=1*s;
  ctx.beginPath();
  ctx.moveTo(cardX+40*s,cardY+lineH*1.05);
  ctx.lineTo(cardX+cardW-40*s,cardY+lineH*1.05);
  ctx.stroke();

  // Grade — gris foncé
  ctx.fillStyle='#555555';
  ctx.font=Math.round(22*s)+'px Arial,sans-serif';
  ctx.fillText('Grade '+grade+' · Reconditionné certifié',cx,cardY+lineH*1.45);

  // Prix — rouge
  if(prix>0){
    ctx.fillStyle='#e53e3e';
    ctx.font='bold '+Math.round(96*s)+'px Arial,sans-serif';
    ctx.fillText(prix+'€',cx,cardY+lineH*2.55);
    ctx.fillStyle='#888888';
    ctx.font=Math.round(20*s)+'px Arial,sans-serif';
    ctx.fillText('Prix TTC · Garanti · Solution Phone',cx,cardY+lineH*2.85);
  }

  // Desc — gris
  if(desc){
    ctx.fillStyle='#333333';
    ctx.font=Math.round(26*s)+'px Arial,sans-serif';
    ctx.fillText(desc,cx,cardY+lineH*3.55);
  }
  // ---- FIN ENCART ----

  // CTA button
  var ctaG=ctx.createLinearGradient(0,0,W,0);
  ctaG.addColorStop(0,'#e53e3e');ctaG.addColorStop(1,'#c53030');
  ctx.fillStyle=ctaG;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(80*s,1640*s,W-160*s,96*s,48*s);else ctx.rect(80*s,1640*s,W-160*s,96*s);
  ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(36*s)+'px Arial,sans-serif';
  ctx.fillText('Disponible en boutique  👇',W/2,1698*s);

  storyBranding(ctx,W,H,s);
}

function storyRep(ctx,W,H,s){
  var typeRep=val('story-rep-type')||'Remplacement écran';
  var appareil=val('story-rep-appareil')||'';
  var prix=parseFloat(val('story-rep-prix'))||0;
  var quali=document.getElementById('story-rep-quali')&&document.getElementById('story-rep-quali').checked;

  var g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#020c1b');g.addColorStop(1,'#051a0f');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  storyDecoBubbles(ctx,W,H,'#4299e1','#48bb78');

  ctx.fillStyle='#4299e1';ctx.fillRect(0,0,W,10*s);

  var bw=400*s,bh=68*s,bx=(W-bw)/2;
  ctx.fillStyle='#4299e1';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(bx,80*s,bw,bh,34*s);else ctx.rect(bx,80*s,bw,bh);
  ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(32*s)+'px Arial,sans-serif';ctx.textAlign='center';
  ctx.fillText('🔧  RÉPARATION EXPRESS',W/2,126*s);

  ctx.font=Math.round(180*s)+'px serif';ctx.fillText('🔧',W/2,430*s);

  ctx.fillStyle='#fff';
  var fsize=typeRep.length>20?52:68;
  ctx.font='bold '+Math.round(fsize*s)+'px Arial,sans-serif';
  igWrapText(ctx,typeRep,W/2,520*s,W-80*s,Math.round(fsize*1.25*s));

  if(appareil){
    ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font=Math.round(34*s)+'px Arial,sans-serif';
    ctx.fillText('pour '+appareil,W/2,680*s);
  }

  if(prix>0){
    ctx.fillStyle='#48bb78';ctx.font='bold '+Math.round(48*s)+'px Arial,sans-serif';
    ctx.fillText('À PARTIR DE',W/2,800*s);
    ctx.font='bold '+Math.round(150*s)+'px Arial,sans-serif';
    ctx.fillText(prix+'€',W/2,960*s);
  }

  if(quali){
    ctx.fillStyle='rgba(72,187,120,0.18)';
    ctx.strokeStyle='#48bb78';ctx.lineWidth=3*s;
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(60*s,1020*s,W-120*s,80*s,12*s);else ctx.rect(60*s,1020*s,W-120*s,80*s);
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#48bb78';ctx.font='bold '+Math.round(28*s)+'px Arial,sans-serif';
    ctx.fillText('🏆  Label QualiRépar · Garantie Qualité',W/2,1068*s);
  }

  ctx.fillStyle='#4299e1';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(80*s,1640*s,W-160*s,96*s,48*s);else ctx.rect(80*s,1640*s,W-160*s,96*s);
  ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(34*s)+'px Arial,sans-serif';
  ctx.fillText('Réparation rapide · DM ou venez !',W/2,1698*s);

  storyBranding(ctx,W,H,s);
}

function storyTexte(ctx,W,H,s){
  var titre=val('story-texte-titre')||'Annonce';
  var msg=val('story-texte-msg')||'';
  var c1=val('story-texte-bg1')||'#e53e3e';
  var c2=val('story-texte-bg2')||'#7b0d0d';

  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,c1);g.addColorStop(1,c2);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  // Cercles déco
  ctx.save();ctx.globalAlpha=0.12;ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(W*0.9,H*0.1,400,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(W*0.05,H*0.85,320,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // Pill Solution Phone haut
  ctx.fillStyle='rgba(0,0,0,0.3)';
  var pw=280*s;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect((W-pw)/2,80*s,pw,50*s,25*s);else ctx.rect((W-pw)/2,80*s,pw,50*s);
  ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(24*s)+'px Arial,sans-serif';ctx.textAlign='center';
  ctx.fillText('📱 Solution Phone',W/2,114*s);

  // Ligne déco
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2*s;
  ctx.beginPath();ctx.moveTo(80*s,180*s);ctx.lineTo(W-80*s,180*s);ctx.stroke();

  // Titre
  ctx.fillStyle='#fff';
  var fs=titre.length>16?72:96;
  ctx.font='bold '+Math.round(fs*s)+'px Arial,sans-serif';
  igWrapText(ctx,titre.toUpperCase(),W/2,600*s,W-80*s,Math.round(fs*1.2*s));

  // Ligne déco milieu
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=3*s;
  ctx.beginPath();ctx.moveTo(160*s,800*s);ctx.lineTo(W-160*s,800*s);ctx.stroke();

  // Message
  if(msg){
    ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font=Math.round(36*s)+'px Arial,sans-serif';
    igWrapText(ctx,msg,W/2,870*s,W-100*s,52*s);
  }

  storyBranding(ctx,W,H,s);
}

function storyBrouillon(ctx,W,H,s){
  var idx=parseInt(val('story-draft-select'));
  var draft=(idx>=0&&igDrafts[idx])?igDrafts[idx]:null;

  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0f0f0f');g.addColorStop(1,'#111827');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  storyDecoBubbles(ctx,W,H,'#e53e3e','#4299e1');

  ctx.fillStyle='#e53e3e';ctx.fillRect(0,0,W,10*s);

  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(36*s)+'px Arial,sans-serif';ctx.textAlign='center';
  ctx.fillText('📸 Solution Phone',W/2,100*s);

  if(!draft||isNaN(idx)){
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font=Math.round(34*s)+'px Arial,sans-serif';
    ctx.fillText('Sélectionnez un brouillon',W/2,H/2);
    storyBranding(ctx,W,H,s);return;
  }

  var text=draft.text;
  var tm=text.match(/📝 TEXTE :\n([\s\S]*?)(?:\n\n#️⃣|$)/);
  var textePost=tm?tm[1].trim():text.substring(0,500);
  var hm=text.match(/#️⃣ HASHTAGS :\n([\s\S]*?)$/);
  var hashtags=hm?hm[1].trim().split(/\s+/).slice(0,5).join(' '):'';

  // Card
  ctx.fillStyle='rgba(0,0,0,0.06)';
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(40*s,150*s,W-80*s,H-350*s,20*s);else ctx.rect(40*s,150*s,W-80*s,H-350*s);
  ctx.fill();

  // Badge type
  ctx.fillStyle='rgba(229,62,62,0.8)';
  var tw=Math.min(ctx.measureText(draft.type||'Post IA').width+40*s,W-160*s);
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect((W-tw)/2,160*s,tw,42*s,21*s);else ctx.rect((W-tw)/2,160*s,tw,42*s);
  ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+Math.round(22*s)+'px Arial,sans-serif';ctx.textAlign='center';
  ctx.fillText(draft.type||'Post IA',W/2,188*s);

  // Texte
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font=Math.round(31*s)+'px Arial,sans-serif';ctx.textAlign='left';
  var short=textePost.length>450?textePost.substring(0,447)+'...':textePost;
  igWrapText(ctx,short,70*s,260*s,W-140*s,46*s);

  // Hashtags
  if(hashtags){
    ctx.fillStyle='#60a5fa';ctx.font=Math.round(26*s)+'px Arial,sans-serif';ctx.textAlign='center';
    igWrapText(ctx,hashtags,W/2,H-230*s,W-80*s,36*s);
  }

  storyBranding(ctx,W,H,s);
}

function val(id){var e=document.getElementById(id);return e?e.value:'';}

// ---- Gestion QR code Shopify ----
window._storyQrImg = null;
var _qrDebounce = null;

function onShopUrlChange(){
  var url = val('story-shop-url').trim();
  var status = document.getElementById('story-qr-status');
  if(!url || url.length < 4){
    window._storyQrImg = null;
    if(status) status.textContent = '';
    renderStoryPreview();
    return;
  }
  if(status) status.innerHTML = '⏳ Génération du QR code...';
  clearTimeout(_qrDebounce);
  _qrDebounce = setTimeout(function(){ loadQrCode(url); }, 600);
}

function loadQrCode(url){
  var fullUrl = url.startsWith('http') ? url : 'https://' + url;
  var status = document.getElementById('story-qr-status');
  var apiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=' + encodeURIComponent(fullUrl);
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function(){
    window._storyQrImg = img;
    if(status) status.innerHTML = '✅ QR code prêt — pointe vers <b style="color:var(--green);">' + fullUrl.replace(/^https?:\/\//,'') + '</b>';
    renderStoryPreview();
  };
  img.onerror = function(){
    if(status) status.innerHTML = '⚠️ QR code indisponible (vérifiez votre connexion)';
    window._storyQrImg = null;
    renderStoryPreview();
  };
  img.src = apiUrl;
}

function loadStoryPhoto(input){
  var file=input.files[0];
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      window._storyPhotoImg=img;
      // Miniature
      var thumb=document.getElementById('story-photo-thumb');
      if(thumb)thumb.src=e.target.result;
      var prev=document.getElementById('story-photo-preview');
      var plac=document.getElementById('story-photo-placeholder');
      var clr=document.getElementById('story-photo-clear');
      if(prev)prev.style.display='block';
      if(plac)plac.style.display='none';
      if(clr)clr.style.display='inline-flex';
      // Changer le style de la zone
      var zone=document.getElementById('story-photo-zone');
      if(zone){zone.style.borderColor='var(--green)';zone.style.borderStyle='solid';}
      renderStoryPreview();
      showNotif('Photo chargée !','success');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearStoryPhoto(){
  window._storyPhotoImg=null;
  var input=document.getElementById('story-photo-input');
  if(input)input.value='';
  var thumb=document.getElementById('story-photo-thumb');
  if(thumb)thumb.src='';
  var prev=document.getElementById('story-photo-preview');
  var plac=document.getElementById('story-photo-placeholder');
  var clr=document.getElementById('story-photo-clear');
  if(prev)prev.style.display='none';
  if(plac)plac.style.display='block';
  if(clr)clr.style.display='none';
  var zone=document.getElementById('story-photo-zone');
  if(zone){zone.style.borderColor='var(--border)';zone.style.borderStyle='dashed';}
  renderStoryPreview();
  showNotif('Photo supprimée','info');
}
// ============================================================

// ============================================================
//  MODULE PRIX ÉCRANS IPHONE
// ============================================================

// Données par défaut (depuis les feuilles A4)
// null = non disponible (✗)
var ECRANS_DEFAULT = {
  t1: [
    {modele:'5S/SE/5C/6/6S/6S+', prix:[null,40,null,null,60]},
    {modele:'7/7+/8/8+',          prix:[null,40,null,50,60]},
    {modele:'X/XS/XS MAX',        prix:[30,40,55,70,85]},
    {modele:'XR',                  prix:[30,40,55,null,70]},
    {modele:'11',                  prix:[30,40,55,null,70]},
    {modele:'11 Pro Max',          prix:[30,40,55,70,85]},
    {modele:'12 mini',             prix:[null,40,null,null,60]},
    {modele:'12/12 PRO',           prix:[40,50,65,90,115]},
    {modele:'12 Pro Max',          prix:[40,50,65,90,115]},
    {modele:'13 mini',             prix:[null,40,null,50,60]},
    {modele:'13',                  prix:[45,50,65,90,115]},
    {modele:'13 Pro',              prix:[45,50,65,90,115]},
    {modele:'13 Pro Max',          prix:[45,50,65,90,115]},
    {modele:'14',                  prix:[45,50,65,90,115]},
    {modele:'14 Pro',              prix:[45,50,65,90,115]},
    {modele:'14 Pro Max',          prix:[45,50,65,90,115]},
    {modele:'15',                  prix:[50,60,null,140,185]},
    {modele:'15 Pro',              prix:[50,60,null,155,185]},
    {modele:'15 Pro Max',          prix:[null,70,null,165,215]},
    {modele:'16',                  prix:[null,70,null,165,215]},
    {modele:'16 Pro',              prix:[null,70,null,165,215]},
    {modele:'16 Pro Max',          prix:[null,70,null,165,215]}
  ],
  t2: []
};

var ecransPrix = (function(){
  var saved = JSON.parse(localStorage.getItem('sp_ecrans_prix') || 'null');
  if(!saved) return JSON.parse(JSON.stringify(ECRANS_DEFAULT));
  // Si l'ancien format avait t1+t2, les fusionner en t1 unique
  if(saved.t2 && saved.t2.length > 0){
    var modelesDansT1 = (saved.t1||[]).map(function(x){ return x.modele; });
    saved.t2.forEach(function(ligne){
      if(modelesDansT1.indexOf(ligne.modele) < 0){
        saved.t1.push(ligne);
      }
    });
    saved.t2 = [];
    localStorage.setItem('sp_ecrans_prix', JSON.stringify(saved));
  }
  return saved;
})();

function saveEcransPrix(){
  localStorage.setItem('sp_ecrans_prix', JSON.stringify(ecransPrix));
  if(!SUPA_URL || !SUPA_KEY) return;
  // Même méthode que batteries : JSON dans la table settings
  var jsonData = JSON.stringify(ecransPrix);
  supaFetch('settings','GET',null,'?key=eq.ecrans_prix_json').then(function(rows){
    var exists = rows && rows.length > 0;
    var method = exists ? 'PATCH' : 'POST';
    var query  = exists ? '?key=eq.ecrans_prix_json' : '';
    return supaFetch('settings', method, {key:'ecrans_prix_json', value: jsonData}, query);
  }).then(function(){
    console.log('Écrans sauvegardés dans settings');
  }).catch(function(e){
    console.error('Écrans save error:', e);
  });
}

async function loadEcransFromSupabase(){
  if(!SUPA_URL || !SUPA_KEY) return;
  try {
    // 1. Essayer la table settings (nouvelle méthode)
    var rows = await supaFetch('settings','GET',null,'?key=eq.ecrans_prix_json');
    if(rows && rows.length && rows[0].value){
      var data = JSON.parse(rows[0].value);
      if(data && (data.t1||[]).length > 0){
        // Fusionner t2 si présent
        if(data.t2 && data.t2.length > 0){
          var modeles = (data.t1||[]).map(function(x){ return x.modele; });
          data.t2.forEach(function(l){ if(modeles.indexOf(l.modele)<0) data.t1.push(l); });
          data.t2 = [];
        }
        ecransPrix = data;
        localStorage.setItem('sp_ecrans_prix', JSON.stringify(ecransPrix));
        console.log('Écrans chargés depuis settings: '+ecransPrix.t1.length+' modèles');
        return;
      }
    }
    // 2. Fallback : ancienne table ecrans_prix
    console.log('Écrans: settings vide, fallback sur ecrans_prix');
    var res = await fetch(SUPA_URL+'/rest/v1/ecrans_prix?select=*', {
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    if(!res.ok) return;
    var lignes = await res.json();
    if(!lignes || !lignes.length) return;
    var newPrix = {t1:[], t2:[]};
    lignes.forEach(function(r){
      var tbl = r.tableau||'t1';
      if(!newPrix[tbl]) newPrix[tbl]=[];
      newPrix[tbl].push({
        modele: r.modele,
        prix:[
          r.p0!==null&&r.p0!==undefined?Number(r.p0):null,
          r.p1!==null&&r.p1!==undefined?Number(r.p1):null,
          r.p2!==null&&r.p2!==undefined?Number(r.p2):null,
          r.p3!==null&&r.p3!==undefined?Number(r.p3):null,
          r.p4!==null&&r.p4!==undefined?Number(r.p4):null
        ]
      });
    });
    // Fusionner t1+t2 en t1 unique
    if(newPrix.t2.length > 0){
      var modeles = newPrix.t1.map(function(x){ return x.modele; });
      newPrix.t2.forEach(function(l){ if(modeles.indexOf(l.modele)<0) newPrix.t1.push(l); });
      newPrix.t2 = [];
    }
    if(newPrix.t1.length > 0){
      ecransPrix = newPrix;
      localStorage.setItem('sp_ecrans_prix', JSON.stringify(ecransPrix));
      // Migrer vers settings pour la prochaine fois
      saveEcransPrix();
      console.log('Écrans migrés depuis ecrans_prix: '+ecransPrix.t1.length+' modèles');
    }
  } catch(e){ console.log('Écrans load error:', e); }
}


var IPHONE_ORDER = [
  '5S/SE/5C/6/6S/6S+','7/7+/8/8+','X/XS/XS MAX','XR',
  '11','11 Pro Max',
  '12 mini','12/12 PRO','12 Pro Max',
  '13 mini','13','13 Pro','13 Pro Max',
  '14','14 Pro','14 Pro Max',
  '15','15 Pro','15 Pro Max',
  '16','16 Pro','16 Pro Max'
];

function sortEcrans(liste){
  return (liste||[]).sort(function(a,b){
    var ia = IPHONE_ORDER.indexOf(a.modele);
    var ib = IPHONE_ORDER.indexOf(b.modele);
    if(ia < 0) ia = 999;
    if(ib < 0) ib = 999;
    return ia - ib;
  });
}

function renderEcrans(){
  if(!ecransPrix || typeof ecransPrix !== 'object') return;
  if(Array.isArray(ecransPrix.t1)) ecransPrix.t1 = sortEcrans(ecransPrix.t1);
  renderEcransTable('ecrans-tbody-1', ecransPrix.t1||[], 't1');
}

function renderEcransTable(tbodyId, data, tableKey){
  var tbody = document.getElementById(tbodyId);
  if(!tbody) return;
  var qualites = ['HD ECO+','LPTS','LPTS PRIME','SOFT OLED BOLT','ORIGINAL'];
  tbody.innerHTML = data.map(function(row, ri){
    var isOdd = ri % 2 === 0;
    var cells = row.prix.map(function(p, ci){
      if(p === null){
        return '<td style="padding:10px 14px;text-align:center;border-bottom:1px solid var(--border);background:'+(isOdd?'rgba(229,62,62,0.05)':'')+';">'+
          '<span style="color:var(--text-dim);font-size:18px;cursor:pointer;" onclick="toggleEcran(\''+tableKey+'\','+ri+','+ci+')" title="Cliquer pour activer">✗</span>'+
          '</td>';
      } else {
        return '<td style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);background:'+(isOdd?'rgba(229,62,62,0.05)':'')+';">'+
          '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">'+
          '<input type="number" value="'+p+'" min="0" max="999" '+
            'onchange="updateEcranPrix(\''+tableKey+'\','+ri+','+ci+',this.value)" '+
            'style="width:60px;padding:5px 6px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-weight:700;text-align:center;">'+
          '<span style="font-size:12px;color:var(--text-muted);">€</span>'+
          '<button onclick="toggleEcran(\''+tableKey+'\','+ri+','+ci+')" title="Mettre ✗" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:11px;padding:2px;">✗</button>'+
          '</div>'+
          '</td>';
      }
    }).join('');

    // Colonne modèle éditable
    var modeleCell = '<td style="padding:6px 10px;border-bottom:1px solid var(--border);background:'+(isOdd?'rgba(229,62,62,0.08)':'#f8fafc')+';">'+
      '<input type="text" value="'+row.modele+'" '+
      'onchange="updateEcranModele(\''+tableKey+'\','+ri+',this.value)" '+
      'style="width:100%;padding:5px 6px;background:transparent;border:1px solid transparent;border-radius:6px;color:'+(isOdd?'var(--red)':'var(--text)')+';font-size:13px;font-weight:700;" '+
      'onfocus="this.style.border=\'1px solid var(--red)\'" '+
      'onblur="this.style.border=\'1px solid transparent\'">'+
      '</td>';

    // Bouton supprimer
    var deleteCell = '<td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:center;">'+
      '<button onclick="supprimerLigneEcran(\''+tableKey+'\','+ri+')" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:4px;" title="Supprimer">🗑️</button>'+
      '</td>';

    return '<tr>'+modeleCell+cells+deleteCell+'</tr>';
  }).join('');
}

function updateEcranPrix(tableKey, ri, ci, val){
  var p = val===''?null:Number(val);
  if(p !== null && isNaN(p)) return;
  if(!ecransPrix.t1[ri]) return;
  ecransPrix.t1[ri].prix[ci] = p;
  saveEcransPrix();
}
function updateEcranModele(tableKey, ri, val){
  if(!ecransPrix.t1[ri]) return;
  ecransPrix.t1[ri].modele = val.trim()||'Modèle';
  saveEcransPrix();
}
function ajouterLigneEcran(){
  if(!ecransPrix.t1) ecransPrix.t1=[];
  ecransPrix.t1.push({modele:'Nouveau modèle', prix:[null,null,null,null,null]});
  saveEcransPrix();
  renderEcrans();
  showNotif('Ligne ajoutée !','success');
}
function supprimerLigneEcran(tableKey, ri){
  if(!confirm('Supprimer cette ligne ?')) return;
  (ecransPrix.t1||[]).splice(ri, 1);
  saveEcransPrix();
  renderEcrans();
  showNotif('Ligne supprimée','success');
}
function resetEcransPrix(){
  if(!confirm('Réinitialiser tous les prix aux valeurs d\'origine ?')) return;
  ecransPrix = JSON.parse(JSON.stringify(ECRANS_DEFAULT));
  saveEcransPrix();
  renderEcrans();
  showNotif('Prix réinitialisés !','success');
}

function printEcransA4(){
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var data = ecransPrix.t1 || [];

  var headerRow =
    '<th style="padding:7px 10px;text-align:left;background:#c0392b;color:#fff;font-size:10px;font-weight:800;border-right:1px solid rgba(255,255,255,0.2);">Modèle</th>'+
    '<th style="padding:7px 6px;text-align:center;background:#5a5a5a;color:#fff;font-size:9px;font-weight:800;border-right:1px solid rgba(255,255,255,0.2);">⭐⭐<br>HD ECO+</th>'+
    '<th style="padding:7px 6px;text-align:center;background:#8e6b00;color:#fff;font-size:9px;font-weight:800;border-right:1px solid rgba(255,255,255,0.2);">⭐⭐⭐<br>LPTS</th>'+
    '<th style="padding:7px 6px;text-align:center;background:#b8860b;color:#fff;font-size:9px;font-weight:800;border-right:1px solid rgba(255,255,255,0.2);">⭐⭐⭐⭐<br>LPTS PRIME</th>'+
    '<th style="padding:7px 6px;text-align:center;background:#c0392b;color:#fff;font-size:9px;font-weight:800;border-right:1px solid rgba(255,255,255,0.2);">⭐⭐⭐⭐⭐<br>SOFT OLED</th>'+
    '<th style="padding:7px 6px;text-align:center;background:#922b21;color:#fff;font-size:9px;font-weight:800;">⭐⭐⭐⭐⭐⭐<br>ORIGINAL</th>';

  var rows = data.map(function(row, ri){
    var isOdd = ri % 2 === 0;
    var rowBg = isOdd ? '#fff5f5' : '#fff';
    var modBg = isOdd ? '#c0392b' : '#e0e0e0';
    var modColor = isOdd ? '#fff' : '#333';
    var cells = row.prix.map(function(p){
      var cellBg = isOdd ? '#ffe8e8' : '#f5f5f5';
      return '<td style="padding:7px 5px;text-align:center;background:'+cellBg+';border-right:1px solid #e0e0e0;border-bottom:1px solid #eee;font-size:'+(p===null?'14':'12')+'px;font-weight:'+(p===null?'400':'800')+';color:'+(p===null?'#ccc':'#1a1a1a')+';">'+(p===null?'✗':p+'<span style="font-size:9px;">€</span>')+'</td>';
    }).join('');
    return '<tr style="background:'+rowBg+';">'+
      '<td style="padding:7px 10px;font-weight:800;font-size:11px;background:'+modBg+';color:'+modColor+';border-right:2px solid rgba(0,0,0,0.1);border-bottom:1px solid rgba(0,0,0,0.08);white-space:nowrap;">'+row.modele+'</td>'+
      cells+'</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
    '<title>Prix Écrans iPhone 2026 — Solution Phone</title>'+
    '<style>'+
      '*{margin:0;padding:0;box-sizing:border-box;}'+
      'body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;}'+
      '.page{width:210mm;min-height:297mm;margin:0 auto;padding:7mm 9mm;}'+
      'table{page-break-inside:avoid;}'+
      '@media print{.no-print{display:none!important;}.page{padding:5mm 7mm;}'+
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
      '@page{size:A4 portrait;margin:0;}'+
    '</style></head><body>'+
    '<div class="no-print" style="text-align:right;padding:8px 14px;">'+
      '<button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:9px 24px;border-radius:7px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimer / PDF</button>'+
    '</div>'+
    '<div class="page">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:3px solid #c0392b;">'+
        '<div style="display:flex;align-items:center;gap:10px;">'+
          (logo?'<img src="'+logo+'" style="height:50px;width:auto;">':'')+
          '<div><div style="font-size:18px;font-weight:900;color:#c0392b;">SOLUTION PHONE</div>'+
          '<div style="font-size:9px;color:#777;">Réparation SMARTPHONE · TABLETTE · PC</div></div>'+
        '</div>'+
        '<div style="text-align:right;">'+
          '<div style="font-size:10px;color:#555;">21 Rue Gambetta · 71000 Mâcon · 03 85 33 06 89</div>'+
        '</div>'+
      '</div>'+
      '<div style="font-size:26px;font-weight:900;color:#1a1a1a;margin-bottom:5px;line-height:1;">PRIX ÉCRAN IPHONE 2026</div>'+
      '<div style="background:linear-gradient(135deg,#1a5c30,#27ae60);border-radius:5px;padding:5px 12px;margin-bottom:8px;font-size:9px;color:#fff;font-weight:700;letter-spacing:.3px;">'+
        '🏆 -25€ QUALIREPAR DÉJÀ DÉDUIT &nbsp;·&nbsp; PRIX TTC PIÈCE + MAIN D\'ŒUVRE &nbsp;·&nbsp; GARANTIE 3 MOIS SAUF CASSE OU RAYURE &nbsp;·&nbsp; RÉPARATION EN 30 MIN - 1H MAX'+
      '</div>'+
      '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;font-size:11px;">'+
        '<thead><tr>'+headerRow+'</tr></thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table>'+
      '<div style="margin-top:6px;padding-top:6px;border-top:2px solid #c0392b;display:flex;justify-content:space-between;align-items:center;">'+
        '<div style="font-size:8px;color:#888;">Solution Phone · 21 Rue Gambetta · 71000 Mâcon · 03 85 33 06 89 &nbsp;·&nbsp; TVA non applicable Art. 297 A CGI</div>'+
        '<div style="display:flex;gap:6px;">'+
          '<div style="background:#c0392b;color:#fff;padding:3px 7px;border-radius:3px;font-size:8px;font-weight:800;">RÉPARATEUR LABELLISÉ</div>'+
          '<div style="border:1.5px solid #27ae60;color:#27ae60;padding:3px 7px;border-radius:3px;font-size:8px;font-weight:800;">LABEL QUALI RÉPAR</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<script>window.onload=function(){};<\/script></body></html>';

  var w = window.open('','_blank','width=900,height=1100');
  w.document.write(html);
  w.document.close();
}


// ============================================================
//  MODULE PRIX BATTERIES IPHONE
// ============================================================

var BATTERIES_DEFAULT = {
  t1: [
    {modele:'5S/SE/5C/6/6S/6S+', prix:[0,0,0]},
    {modele:'7/7+/8/8+',          prix:[0,0,0]},
    {modele:'X/XS/XS MAX',        prix:[0,0,0]},
    {modele:'XR',                  prix:[0,0,0]},
    {modele:'11',                  prix:[0,0,0]},
    {modele:'11 Pro Max',          prix:[0,0,0]},
    {modele:'12 mini',             prix:[0,0,0]},
    {modele:'12/12 PRO',           prix:[0,0,0]},
    {modele:'12 Pro Max',          prix:[0,0,0]},
    {modele:'13 mini',             prix:[0,0,0]},
    {modele:'13',                  prix:[0,0,0]},
    {modele:'13 Pro',              prix:[0,0,0]},
    {modele:'13 Pro Max',          prix:[0,0,0]},
    {modele:'14',                  prix:[0,0,0]},
    {modele:'14 Pro',              prix:[0,0,0]},
    {modele:'14 Pro Max',          prix:[0,0,0]},
    {modele:'15',                  prix:[0,0,0]},
    {modele:'15 Pro',              prix:[0,0,0]},
    {modele:'15 Pro Max',          prix:[0,0,0]},
    {modele:'16',                  prix:[0,0,0]},
    {modele:'16 Pro',              prix:[0,0,0]},
    {modele:'16 Pro Max',          prix:[0,0,0]}
  ],
  t2: []
};

var batteriesPrix = JSON.parse(localStorage.getItem('sp_batteries_prix') || 'null');
if(!batteriesPrix){ batteriesPrix = JSON.parse(JSON.stringify(BATTERIES_DEFAULT)); }

function saveBatteriesPrix(){
  localStorage.setItem('sp_batteries_prix', JSON.stringify(batteriesPrix));
  if(!SUPA_URL || !SUPA_KEY) return;
  var jsonData = JSON.stringify(batteriesPrix.t1||[]);
  // Sauvegarde dans la table settings (clé = batteries_prix_json)
  supaFetch('settings','GET',null,'?key=eq.batteries_prix_json').then(function(rows){
    var exists = rows && rows.length > 0;
    var method = exists ? 'PATCH' : 'POST';
    var query  = exists ? '?key=eq.batteries_prix_json' : '';
    return supaFetch('settings', method, {key:'batteries_prix_json', value: jsonData}, query);
  }).then(function(r){
    var status = document.getElementById('bat-save-status');
    if(status){ status.textContent='✅ Sauvegardé — '+new Date().toLocaleTimeString('fr-FR'); status.style.color='var(--green)'; }
    console.log('Batteries sauvegardées dans settings');
  }).catch(function(e){
    console.error('Batteries save error:', e);
    var status = document.getElementById('bat-save-status');
    if(status){ status.textContent='⚠️ Erreur sauvegarde'; status.style.color='var(--red)'; }
  });
}

async function loadBatteriesFromSupabase(){
  if(!SUPA_URL || !SUPA_KEY) return;
  try {
    var rows = await supaFetch('settings','GET',null,'?key=eq.batteries_prix_json');
    if(!rows || !rows.length || !rows[0].value) { console.log('Batteries: rien dans settings'); return; }
    var lignes = JSON.parse(rows[0].value);
    if(!Array.isArray(lignes) || !lignes.length) return;
    batteriesPrix = { t1: lignes, t2: [] };
    localStorage.setItem('sp_batteries_prix', JSON.stringify(batteriesPrix));
    console.log('Batteries chargées depuis settings: '+lignes.length+' modèles');
  } catch(e){ console.log('Batteries load error:', e); }
}


function renderBatteries(){
  renderBatteriesTable('batteries-tbody-1', batteriesPrix.t1||[], 'bt1');
}

function renderBatteriesTable(tbodyId, data, tableKey){
  var tbody = document.getElementById(tbodyId);
  if(!tbody) return;
  var colColors = ['var(--text-muted)','var(--warning)','var(--green)'];
  tbody.innerHTML = data.map(function(row, ri){
    var isOdd = ri % 2 === 0;
    var cells = row.prix.map(function(p, ci){
      return '<td style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);background:'+(isOdd?'rgba(229,62,62,0.05)':'')+';">'+
        '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">'+
        '<input type="number" value="'+p+'" min="0" max="999" '+
          'onchange="updateBatteriePrix(\''+tableKey+'\','+ri+','+ci+',this.value)" '+
          'style="width:65px;padding:6px 6px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;color:'+(p>0?colColors[ci]:'var(--text-muted)')+';font-size:14px;font-weight:700;text-align:center;">'+
        '<span style="font-size:12px;color:var(--text-muted);">€</span>'+
        '</div></td>';
    }).join('');

    var modeleCell = '<td style="padding:6px 10px;border-bottom:1px solid var(--border);background:'+(isOdd?'rgba(229,62,62,0.08)':'#f8fafc')+';">'+
      '<input type="text" value="'+row.modele+'" '+
      'onchange="updateBatterieModele(\''+tableKey+'\','+ri+',this.value)" '+
      'style="width:100%;padding:5px 6px;background:transparent;border:1px solid transparent;border-radius:6px;color:'+(isOdd?'var(--red)':'var(--text)')+';font-size:13px;font-weight:700;" '+
      'onfocus="this.style.border=\'1px solid var(--red)\'" '+
      'onblur="this.style.border=\'1px solid transparent\'">'+
      '</td>';

    var deleteCell = '<td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:center;">'+
      '<button onclick="supprimerLigneBatterie(\''+tableKey+'\','+ri+')" style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:4px;" title="Supprimer">🗑️</button>'+
      '</td>';

    return '<tr>'+modeleCell+cells+deleteCell+'</tr>';
  }).join('');
}

function updateBatteriePrix(tableKey, ri, ci, val){
  var v = parseFloat(val);
  if(isNaN(v)||v<0) v = 0;
  var key = tableKey==='bt1'?'t1':'t2';
  if(!batteriesPrix[key] || !batteriesPrix[key][ri]) return;
  batteriesPrix[key][ri].prix[ci] = v;
  saveBatteriesPrix();
  // Feedback visuel discret
  var status = document.getElementById('bat-save-status');
  if(status){ status.innerHTML='✅ Sauvegardé — '+new Date().toLocaleTimeString('fr-FR'); status.style.color='var(--green)'; }
}

function manuelleSauvegardeBatteries(){
  var btn = document.getElementById('btn-save-bat');
  var status = document.getElementById('bat-save-status');
  if(btn){ btn.innerHTML='⏳ Sauvegarde...'; btn.disabled=true; btn.style.opacity='0.7'; }
  if(status){ status.textContent='Connexion Supabase...'; status.style.color='var(--text-muted)'; }
  saveBatteriesPrix();
  setTimeout(function(){
    if(btn){ btn.innerHTML='💾 Sauvegarder'; btn.disabled=false; btn.style.opacity='1'; }
  }, 4000);
}

function updateBatterieModele(tableKey, ri, val){
  var key = tableKey==='bt1'?'t1':'t2';
  batteriesPrix[key][ri].modele = val.trim()||'Nouveau modèle';
  saveBatteriesPrix();
}

function ajouterLigneBatterie(tableKey){
  if(!batteriesPrix.t1) batteriesPrix.t1=[];
  batteriesPrix.t1.push({modele:'Nouveau modèle', prix:[0,0,0]});
  renderBatteries();
  showNotif('Ligne ajoutée — cliquez 💾 Sauvegarder !','success');
}

function supprimerLigneBatterie(tableKey, ri){
  if(!confirm('Supprimer cette ligne ?')) return;
  batteriesPrix.t1.splice(ri, 1);
  saveBatteriesPrix();
  renderBatteries();
  showNotif('Ligne supprimée','success');
}

function resetBatteriesPrix(){
  if(!confirm('Réinitialiser tous les prix batteries à 0 ?')) return;
  batteriesPrix = JSON.parse(JSON.stringify(BATTERIES_DEFAULT));
  saveBatteriesPrix();
  renderBatteries();
  showNotif('Prix réinitialisés !','success');
}

function printBatteriesA4(){
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var data = batteriesPrix.t1 || [];

  var rows = data.map(function(row, ri){
    var isOdd = ri % 2 === 0;
    var colors = ['#444','#d35400','#27ae60'];
    var cells = row.prix.map(function(p, ci){
      return '<td style="padding:5px 8px;text-align:center;border:1px solid #ddd;font-size:13px;font-weight:700;color:'+colors[ci]+';">'+
        (p>0?p+' €':'—')+'</td>';
    }).join('');
    return '<tr style="background:'+(isOdd?'#fff5f5':'#fff')+'">'+
      '<td style="padding:5px 10px;font-weight:700;font-size:12px;border:1px solid #ddd;background:'+(isOdd?'#c0392b':'#ececec')+';color:'+(isOdd?'#fff':'#222')+';">'+row.modele+'</td>'+
      cells+'</tr>';
  }).join('');

  var table = '<table style="width:100%;border-collapse:collapse;">'+
    '<thead><tr>'+
      '<th style="padding:7px 10px;background:#c0392b;color:#fff;font-size:11px;border:1px solid #c0392b;text-align:left;width:38%;">Modèle</th>'+
      '<th style="padding:7px 8px;background:#e5534b;color:#fff;font-size:11px;border:1px solid #e5534b;text-align:center;">⭐⭐⭐<br><span style="font-size:10px;">Compatible</span></th>'+
      '<th style="padding:7px 8px;background:#d35400;color:#fff;font-size:11px;border:1px solid #555;text-align:center;">⭐⭐⭐⭐<br><span style="font-size:10px;">TI Reconnue Apple</span></th>'+
      '<th style="padding:7px 8px;background:#27ae60;color:#fff;font-size:11px;border:1px solid #555;text-align:center;">⭐⭐⭐⭐⭐<br><span style="font-size:10px;">Original</span></th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>';

  var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
    '<title>Prix Batteries iPhone — Solution Phone</title>'+
    '<style>'+
      '*{margin:0;padding:0;box-sizing:border-box;}'+
      'body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;}'+
      '.page{width:210mm;margin:0 auto;padding:7mm 10mm;}'+
      '.no-print{text-align:right;padding:8px;}'+
      '@media print{.no-print{display:none!important;}@page{size:A4 portrait;margin:0;}}'+
    '</style>'+
    '</head><body>'+
    '<div class="no-print"><button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:8px 22px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨️ Imprimer / PDF</button></div>'+
    '<div class="page">'+
      /* En-tête */
      '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c0392b;padding-bottom:6px;margin-bottom:8px;">'+
        '<div style="display:flex;align-items:center;gap:12px;">'+
          (logo?'<img src="'+logo+'" style="height:48px;width:auto;">':'')+
          '<div>'+
            '<div style="font-size:18px;font-weight:900;color:#c0392b;">SOLUTION PHONE</div>'+
            '<div style="font-size:10px;color:#555;">Réparation SMARTPHONE · TABLETTE · PC</div>'+
          '</div>'+
        '</div>'+
        '<div style="text-align:right;">'+
          '<div style="font-size:22px;font-weight:900;color:#1a1a1a;">PRIX BATTERIES iPHONE</div>'+
          '<div style="font-size:11px;color:#888;">21 Rue Gambetta · 71000 Mâcon · 03 85 33 06 89</div>'+
        '</div>'+
      '</div>'+
      /* Bandeau QualiRépar */
      '<div style="background:#e8f8ef;border:1px solid #27ae60;border-radius:5px;padding:5px 12px;margin-bottom:10px;font-size:10px;color:#27ae60;font-weight:700;">'+
        '🏆 -25€ QUALIREPAR DÉJÀ DÉDUIT · PRIX TTC PIÈCE ET MAIN D\'ŒUVRE · GARANTIE 3 MOIS · RÉPARATION EN 30 MIN - 1H MAX'+
      '</div>'+
      /* Tableau */
      table+
      /* Pied de page */
      '<div style="border-top:2px solid #c0392b;padding-top:6px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#888;">'+
        '<div>Solution Phone · 21 Rue Gambetta · 71000 Mâcon · Tél : 03 85 33 06 89</div>'+
        '<div style="display:flex;gap:8px;">'+
          '<div style="background:#c0392b;color:#fff;padding:3px 8px;border-radius:3px;font-size:9px;font-weight:700;">RÉPARATEUR LABELLISÉ</div>'+
          '<div style="border:2px solid #27ae60;color:#27ae60;padding:3px 8px;border-radius:3px;font-size:9px;font-weight:700;">LABEL QUALI RÉPAR</div>'+
        '</div>'+
      '</div>'+
    '</div></body></html>';

  var w=window.open('','_blank','width=850,height=1050');
  w.document.write(html);
  w.document.close();
}

// ============================================================
//  FIN MODULE PRIX BATTERIES
// ============================================================

// ============================================================
//  MODULE PRIX RÉPARATIONS ANDROID
// ============================================================

var ANDROID_MARQUES = ['Samsung','Xiaomi','Oppo','OnePlus','Realme','Motorola','Google','Honor','Nothing'];
var ANDROID_MODELES_DEFAULT = {
  Samsung: [
    // ── Galaxy A ──
    'Galaxy A03','Galaxy A03s','Galaxy A04','Galaxy A04s',
    'Galaxy A05','Galaxy A05s','Galaxy A06','Galaxy A06 5G',
    'Galaxy A10','Galaxy A10s',
    'Galaxy A12','Galaxy A13 4G','Galaxy A13 5G',
    'Galaxy A14 4G','Galaxy A14 5G',
    'Galaxy A15 4G','Galaxy A15 5G',
    'Galaxy A16 4G','Galaxy A16 5G',
    'Galaxy A20e','Galaxy A21s',
    'Galaxy A22 4G','Galaxy A22 5G',
    'Galaxy A23 4G','Galaxy A23 5G',
    'Galaxy A24','Galaxy A25 5G','Galaxy A26 5G',
    'Galaxy A31','Galaxy A32 4G','Galaxy A32 5G',
    'Galaxy A33 5G','Galaxy A34 5G',
    'Galaxy A35 5G','Galaxy A36 5G',
    'Galaxy A41','Galaxy A42 5G',
    'Galaxy A50','Galaxy A50s',
    'Galaxy A51','Galaxy A52','Galaxy A52s 5G',
    'Galaxy A53 5G','Galaxy A54 5G',
    'Galaxy A55 5G','Galaxy A56 5G',
    'Galaxy A71','Galaxy A72',
    // ── Galaxy S ──
    'Galaxy S20 FE','Galaxy S20','Galaxy S20+','Galaxy S20 Ultra',
    'Galaxy S21 FE','Galaxy S21','Galaxy S21+','Galaxy S21 Ultra',
    'Galaxy S22','Galaxy S22+','Galaxy S22 Ultra',
    'Galaxy S23 FE','Galaxy S23','Galaxy S23+','Galaxy S23 Ultra',
    'Galaxy S24 FE','Galaxy S24','Galaxy S24+','Galaxy S24 Ultra',
    'Galaxy S25','Galaxy S25+','Galaxy S25 Ultra',
    // ── Galaxy M ──
    'Galaxy M13','Galaxy M14','Galaxy M15',
    'Galaxy M23','Galaxy M33','Galaxy M34','Galaxy M35',
    'Galaxy M52','Galaxy M53','Galaxy M55',
    // ── Galaxy Note ──
    'Galaxy Note 10','Galaxy Note 10+',
    'Galaxy Note 20','Galaxy Note 20 Ultra',
    // ── Galaxy Z ──
    'Galaxy Z Flip 3','Galaxy Z Flip 4','Galaxy Z Flip 5','Galaxy Z Flip 6',
    'Galaxy Z Fold 3','Galaxy Z Fold 4','Galaxy Z Fold 5','Galaxy Z Fold 6',
    // ── Xcover ──
    'Galaxy Xcover 5','Galaxy Xcover 6 Pro',
  ],
  Xiaomi: [
    // ── Redmi Note ──
    'Redmi Note 7','Redmi Note 8','Redmi Note 8 Pro',
    'Redmi Note 9','Redmi Note 9 Pro','Redmi Note 9S',
    'Redmi Note 10','Redmi Note 10 Pro','Redmi Note 10S',
    'Redmi Note 11','Redmi Note 11 Pro','Redmi Note 11S',
    'Redmi Note 12','Redmi Note 12 Pro','Redmi Note 12S',
    'Redmi Note 13','Redmi Note 13 Pro','Redmi Note 13 Pro+ 5G',
    'Redmi Note 14','Redmi Note 14 Pro','Redmi Note 14 Pro+ 5G',
    // ── Redmi ──
    'Redmi 9','Redmi 9A','Redmi 9C','Redmi 9T',
    'Redmi 10','Redmi 10A','Redmi 10C',
    'Redmi 12','Redmi 12C',
    'Redmi 13','Redmi 13C',
    'Redmi A1','Redmi A2','Redmi A3',
    // ── Xiaomi ──
    'Xiaomi 11 Lite 5G NE',
    'Xiaomi 12','Xiaomi 12 Lite','Xiaomi 12 Pro',
    'Xiaomi 13','Xiaomi 13 Lite','Xiaomi 13 Pro',
    'Xiaomi 14','Xiaomi 14 Pro',
    // ── POCO ──
    'POCO X3 NFC','POCO X3 Pro',
    'POCO X4 Pro 5G','POCO X5 5G','POCO X5 Pro',
    'POCO X6','POCO X6 Pro',
    'POCO X7','POCO X7 Pro',
    'POCO M4 Pro','POCO M5','POCO M5s',
    'POCO F3','POCO F4','POCO F5',
  ],
  Oppo: [
    // ── Série A ──
    'Oppo A15','Oppo A16','Oppo A17',
    'Oppo A40','Oppo A52','Oppo A53','Oppo A54 5G',
    'Oppo A57','Oppo A72','Oppo A74 4G','Oppo A74 5G',
    'Oppo A76','Oppo A77 5G','Oppo A80','Oppo A94',
    // ── Série Reno ──
    'Oppo Reno 2','Oppo Reno 2Z',
    'Oppo Reno 3','Oppo Reno 4 Pro',
    'Oppo Reno 6','Oppo Reno 7 4G','Oppo Reno 7 5G',
    'Oppo Reno 8','Oppo Reno 8 Lite',
    'Oppo Reno 10','Oppo Reno 12','Oppo Reno 12 Pro',
    'Oppo Reno 13','Oppo Reno 13 Pro',
    // ── Find X ──
    'Oppo Find X3 Lite','Oppo Find X3 Pro',
    'Oppo Find X5','Oppo Find X5 Pro',
    'Oppo Find X8','Oppo Find X8 Pro',
  ],
  OnePlus: [
    'OnePlus 6','OnePlus 6T',
    'OnePlus 7','OnePlus 7 Pro','OnePlus 7T',
    'OnePlus 8','OnePlus 8 Pro','OnePlus 8T',
    'OnePlus 9','OnePlus 9 Pro',
    'OnePlus 10 Pro','OnePlus 10T',
    'OnePlus 11','OnePlus 12','OnePlus 13',
    'OnePlus Nord','OnePlus Nord 2','OnePlus Nord 2T',
    'OnePlus Nord 3','OnePlus Nord 4','OnePlus Nord 5',
    'OnePlus Nord CE','OnePlus Nord CE 2','OnePlus Nord CE 3 Lite',
  ],
  Realme: [
    'Realme 6','Realme 7','Realme 8','Realme 8 Pro',
    'Realme 9 4G','Realme 9 5G','Realme 9 Pro','Realme 9 Pro+',
    'Realme 10 4G','Realme 10 5G',
    'Realme 11 Pro','Realme 11 Pro+',
    'Realme 12 Pro','Realme 12 Pro+',
    'Realme 13','Realme 13 5G',
    'Realme C21','Realme C30','Realme C31',
    'Realme C33','Realme C35','Realme C55','Realme C67',
    'Realme GT 2','Realme GT 2 Pro',
    'Realme GT Neo 3',
  ],
  Motorola: [
    // ── Moto G ──
    'Moto G04','Moto G05','Moto G06',
    'Moto G13','Moto G14','Moto G15',
    'Moto G22','Moto G23','Moto G24',
    'Moto G31','Moto G32','Moto G34 5G',
    'Moto G42','Moto G52','Moto G53 5G',
    'Moto G54 5G','Moto G55 5G',
    'Moto G62 5G','Moto G72',
    'Moto G73 5G','Moto G84 5G','Moto G85 5G',
    // ── Edge ──
    'Motorola Edge 20','Motorola Edge 20 Lite',
    'Motorola Edge 30','Motorola Edge 30 Neo','Motorola Edge 30 Fusion',
    'Motorola Edge 40','Motorola Edge 40 Neo',
    'Motorola Edge 50','Motorola Edge 50 Neo','Motorola Edge 50 Fusion','Motorola Edge 50 Pro',
    'Motorola Edge 60','Motorola Edge 60 Neo',
    // ── Moto E ──
    'Moto E13','Moto E20','Moto E22','Moto E32','Moto E40',
    // ── Razr ──
    'Motorola Razr 40','Motorola Razr 40 Ultra',
    'Motorola Razr 50','Motorola Razr 50 Ultra',
  ],
  Google: [
    'Pixel 4','Pixel 4 XL','Pixel 4a','Pixel 4a 5G',
    'Pixel 5','Pixel 5a',
    'Pixel 6','Pixel 6 Pro','Pixel 6a',
    'Pixel 7','Pixel 7 Pro','Pixel 7a',
    'Pixel 8','Pixel 8 Pro','Pixel 8a',
    'Pixel 9','Pixel 9 Pro','Pixel 9 Pro XL',
    'Pixel Fold',
  ],
  Honor: [
    // ── Séries numérotées ──
    'Honor 8A','Honor 8X',
    'Honor 9A','Honor 9X','Honor 9X Lite',
    'Honor 10 Lite',
    'Honor 20','Honor 20 Lite',
    'Honor 50','Honor 50 Lite',
    'Honor 70','Honor 70 Lite',
    'Honor 90','Honor 90 Lite',
    'Honor 200','Honor 200 Lite','Honor 200 Pro',
    'Honor 400','Honor 400 Lite','Honor 400 Pro',
    // ── Honor X ──
    'Honor X6','Honor X6a','Honor X6b',
    'Honor X7','Honor X7a','Honor X7b',
    'Honor X8','Honor X8a','Honor X8b','Honor X8 5G',
    // ── Magic ──
    'Honor Magic 4 Lite',
    'Honor Magic 5 Lite','Honor Magic 5 Pro',
    'Honor Magic 6 Lite','Honor Magic 6 Pro',
    'Honor Magic 7 Lite','Honor Magic 7 Pro',
    'Honor Magic 8 Lite','Honor Magic 8 Pro',
  ],
  Nothing: [
    'Nothing Phone (2)',
    'Nothing Phone (2a)','Nothing Phone (2a) Plus',
    'Nothing Phone (3a)','Nothing Phone (3a) Pro',
  ],
};
var ANDROID_COLS = ['ecran_compat','ecran_original','batterie_compat','batterie_original','connecteur','vitre_arriere','remarques'];
var ANDROID_COLS_LABEL = ['Écran Compat.','Écran Original','Bat. Compat.','Bat. Originale','Connecteur','Vitre Arrière','Remarques'];

var androidData = {};
var androidMarqueActive = 'Samsung';

function androidInit(){
  var saved = localStorage.getItem('sp_android_prix');
  if(saved){
    try{ androidData = JSON.parse(saved); }catch(e){ androidData = {}; }
  }
  ANDROID_MARQUES.forEach(function(m){
    if(!androidData[m]) androidData[m] = {};
    ANDROID_MODELES_DEFAULT[m].forEach(function(mod){
      if(!androidData[m][mod]) androidData[m][mod] = {ecran_compat:'',ecran_original:'',batterie_compat:'',batterie_original:'',connecteur:'',vitre_arriere:'',remarques:''};
    });
  });
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  setTimeout(function(){ androidRender(); }, 50);
  androidLoadSupabase();
}

async function androidLoadSupabase(){
  if(!SUPA_URL || !SUPA_KEY) return;
  try{
    // Charger depuis settings (nouvelle méthode fiable)
    var rows = await supaFetch('settings','GET',null,'?key=eq.android_prix_json');
    if(rows && rows.length && rows[0].value){
      var data = JSON.parse(rows[0].value);
      if(data && Object.keys(data).length > 0){
        androidData = data;
        localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
        androidRender();
        console.log('Android chargé depuis settings');
        return;
      }
    }
    // Fallback : ancienne table prix_reparation_android
    console.log('Android: fallback sur prix_reparation_android');
    var r = await fetch(SUPA_URL+'/rest/v1/prix_reparation_android?select=*', {
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    if(!r.ok) return;
    var rows2 = await r.json();
    if(!rows2 || !rows2.length) return;
    rows2.forEach(function(row){
      var m=row.marque, mod=row.modele;
      if(!androidData[m]) androidData[m]={};
      androidData[m][mod]={
        ecran_compat:row.ecran_compat||'', ecran_original:row.ecran_original||'',
        batterie_compat:row.batterie_compat||'', batterie_original:row.batterie_original||'',
        connecteur:row.connecteur||'', vitre_arriere:row.vitre_arriere||'',
        remarques:row.remarques||''
      };
    });
    localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
    androidRender();
    // Migrer vers settings automatiquement
    androidSauvegarder();
    console.log('Android migré depuis prix_reparation_android');
  }catch(e){ console.log('Android load error:', e); }
}


async function androidSauvegarder(){
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  if(!SUPA_URL || !SUPA_KEY){ showNotif('Sauvegardé localement','info'); return; }
  try{
    var jsonData = JSON.stringify(androidData);
    // Même méthode que batteries/écrans : JSON dans la table settings
    var rows = await supaFetch('settings','GET',null,'?key=eq.android_prix_json');
    var exists = rows && rows.length > 0;
    var method = exists ? 'PATCH' : 'POST';
    var query  = exists ? '?key=eq.android_prix_json' : '';
    await supaFetch('settings', method, {key:'android_prix_json', value: jsonData}, query);
    showNotif('✅ Prix Android sauvegardés !','success');
  }catch(e){
    console.error('Android save error:', e);
    showNotif('Sauvegardé localement uniquement','info');
  }
}


function androidShowTab(marque){
  androidMarqueActive = marque;
  document.querySelectorAll('.android-tab-btn').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.getElementById('android-tab-'+marque);
  if(btn) btn.classList.add('active');
  androidRender();
}

function androidRender(){
  var m = androidMarqueActive;
  var tbody = document.getElementById('android-tbody');
  if(!tbody) return;
  document.getElementById('android-card-title').textContent = '📱 '+m;
  var modeles = Object.keys(androidData[m]||{});
  document.getElementById('android-nb-modeles').textContent = modeles.length+' modèle'+(modeles.length>1?'s':'');
  tbody.innerHTML = '';
  modeles.forEach(function(mod, idx){
    var d = androidData[m][mod];
    var bg = idx%2===0 ? '' : 'background:#f8fafc;';
    var tr = document.createElement('tr');
    tr.style = bg;
    // Colonne référence
    var tdRef = '<td style="padding:8px 14px;font-weight:600;font-size:13px;">'+
      '<span contenteditable="true" style="outline:none;cursor:text;" onblur="androidRenommerModele(\''+m+'\',\''+mod+'\',this.textContent.trim())">'+escHtml(mod)+'</span></td>';
    // Colonnes prix
    var tdPrix = '';
    ANDROID_COLS.slice(0,-1).forEach(function(col){
      var val = d[col]||'';
      var cls = val ? 'android-prix-cell has-prix' : 'android-prix-cell no-prix';
      var display = val ? val+' €' : '—';
      tdPrix += '<td style="padding:4px 8px;"><div class="'+cls+'" onclick="androidEditPrix(\''+m+'\',\''+mod+'\',\''+col+'\',this)">'+display+'</div></td>';
    });
    // Remarques
    var remarques = d.remarques||'';
    var tdRem = '<td style="padding:4px 8px;font-size:11px;color:var(--text-muted);"><span contenteditable="true" style="outline:none;cursor:text;" onblur="androidSetVal(\''+m+'\',\''+mod+'\',\'remarques\',this.textContent.trim())">'+escHtml(remarques)+'</span></td>';
    // Supprimer
    var tdDel = '<td style="padding:4px 8px;text-align:center;"><button class="btn btn-sm" onclick="androidSupprimerModele(\''+m+'\',\''+mod+'\')" style="color:var(--red);border-color:var(--red);padding:3px 8px;">✕</button></td>';
    tr.innerHTML = tdRef+tdPrix+tdRem+tdDel;
    tbody.appendChild(tr);
  });
}

function androidEditPrix(marque, modele, col, el){
  var current = androidData[marque][modele][col]||'';
  var val = prompt('Prix '+ANDROID_COLS_LABEL[ANDROID_COLS.indexOf(col)]+' pour '+modele+' (laisser vide = N/D) :', current);
  if(val === null) return;
  val = val.replace('€','').replace(',','.').trim();
  androidData[marque][modele][col] = val;
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  androidRender();
}

function androidSetVal(marque, modele, col, val){
  if(!androidData[marque]) return;
  if(!androidData[marque][modele]) return;
  androidData[marque][modele][col] = val;
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
}

function androidRenommerModele(marque, ancienNom, nouveauNom){
  if(!nouveauNom || nouveauNom === ancienNom) return;
  if(androidData[marque][nouveauNom]) return;
  androidData[marque][nouveauNom] = androidData[marque][ancienNom];
  delete androidData[marque][ancienNom];
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  androidRender();
}

function androidAjouterLigne(){
  var m = androidMarqueActive;
  var nom = prompt('Nom du modèle à ajouter (ex: Galaxy A05s) :');
  if(!nom || !nom.trim()) return;
  nom = nom.trim();
  if(androidData[m][nom]){ showToast('Ce modèle existe déjà'); return; }
  androidData[m][nom] = {ecran_compat:'',ecran_original:'',batterie_compat:'',batterie_original:'',connecteur:'',vitre_arriere:'',remarques:''};
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  androidRender();
}

function androidSupprimerModele(marque, modele){
  if(!confirm('Supprimer '+modele+' ?')) return;
  delete androidData[marque][modele];
  localStorage.setItem('sp_android_prix', JSON.stringify(androidData));
  androidRender();
}

function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ============================================================
//  FIN MODULE PRIX ANDROID
// ============================================================

// ============================================================
//  MODULE DOCUMENTS COMPTABLE
// ============================================================

var DOCS_CHECKLIST = [
  // Automatiques (Gmail)
  {id:'total', label:'⚡ TotalEnergies', cat:'Énergie', auto:true},
  {id:'verisure', label:'🔒 Verisure (alarme)', cat:'Assurances', auto:true},
  {id:'allianz', label:'🛡️ Allianz', cat:'Assurances', auto:true},
  {id:'generali', label:'🛡️ Generali', cat:'Assurances', auto:true},
  {id:'free', label:'📡 Free Pro (internet)', cat:'Télécom', auto:true},
  {id:'orange', label:'📱 Orange (mobile)', cat:'Télécom', auto:true},
  {id:'bouygues', label:'📱 Bouygues', cat:'Télécom', auto:true},
  {id:'cofagest', label:'📊 Cofagest (comptable)', cat:'Comptabilité', auto:true},
  {id:'externain', label:'💼 ExternAin Paie', cat:'Social', auto:true},
  {id:'ibt', label:'🏠 IBT Gestion', cat:'Loyer/Charges', auto:true},
  {id:'charnay', label:'🏠 Charnay Immobilier', cat:'Loyer/Charges', auto:true},
  {id:'urssaf', label:'👥 URSSAF', cat:'Social', auto:true},
  // Manuels
  {id:'utopya', label:'📦 Utopya (factures)', cat:'Fournisseurs', auto:false},
  {id:'mobilax', label:'📦 Mobilax (factures)', cat:'Fournisseurs', auto:false},
  {id:'amazon', label:'🛒 Amazon', cat:'Achats', auto:false},
  {id:'paypal', label:'💳 PayPal (relevé)', cat:'Paiements', auto:false},
  {id:'banque', label:'🏦 Relevé bancaire', cat:'Banque', auto:false},
  {id:'dgfip', label:'💰 TVA / DGFIP', cat:'Taxes', auto:false},
];

var DOCS_CATS = {
  'Énergie':'⚡', 'Assurances':'🛡️', 'Télécom':'📡',
  'Comptabilité':'📊', 'Social':'👥', 'Loyer/Charges':'🏠',
  'Fournisseurs':'📦', 'Achats':'🛒', 'Paiements':'💳',
  'Banque':'🏦', 'Taxes':'💰'
};

var DOCS_CATS_RELEVE = {
  'TotalEnergies': 'Énergie',
  'UTOPYA': 'Fournisseurs',
  'URSSAF': 'Social',
  'ALLIANZ': 'Assurances',
  'GENERALI': 'Assurances',
  'IBT GESTION': 'Loyer/Charges',
  'AMAZON': 'Achats',
  'VERISURE': 'Assurances',
  'PayPal': 'Paiements',
  'COFAGEST': 'Comptabilité',
  'Free Pro': 'Télécom',
  'ORANGE': 'Télécom',
  'Bouygues': 'Télécom',
  'CHARNAY IMMOBILIER': 'Loyer/Charges',
  'Wegacell': 'Fournisseurs',
  'ND DISTRIBUTION': 'Fournisseurs',
  'Partner Tele': 'Fournisseurs',
  'DGFIP': 'Taxes',
  'Extern Ain Paie': 'Social',
  'RYTHMEO': 'Assurances',
};

var DOCS_DRIVE_LINKS = {
  '2026-01': null,
  '2026-02': 'https://drive.google.com/drive/folders/1OOXLqN7nrhEI_9pNl3-E_O4UdZ4DWYGH',
  '2026-03': 'https://drive.google.com/drive/folders/1NvdenvcEaZw-lcxNq3s0-NthOt3x0ZjC',
  '2026-04': 'https://drive.google.com/drive/folders/1rVC9gaxMbWTaYEM-QotNqhRfpGZU4PQe',
  '2026-05': 'https://drive.google.com/drive/folders/1W2Nmy-kXuqZoBPTqsFBgA41eSIf8eujU',
  '2026-06': 'https://drive.google.com/drive/folders/13Va_eJ-qumyhEOPjG-UHEvOovaoinKWF',
  '2026-07': 'https://drive.google.com/drive/folders/12pgMejJ9qnz58hCwzmpwLS_mN-mLQayP',
  '2026-08': 'https://drive.google.com/drive/folders/1PF1lHFyG998unxW9-0z5c0WCK8vvcEGe',
  '2026-09': 'https://drive.google.com/drive/folders/1dyyMlvdYKeaIQIvn6B0sp6whVSKG4VBx',
  '2026-10': 'https://drive.google.com/drive/folders/1V03S-1sVxuCkbcdoG4EeovFOdb-xbUEn',
  '2026-11': 'https://drive.google.com/drive/folders/1ZdPbrNRZM4hLBUYuDvy99qpzVaT6ifOv',
  '2026-12': 'https://drive.google.com/drive/folders/1DNEBtWUAFGon7yUj1F1F8IoP9EXcQ9wz',
};

function docsGetKey(){
  var sel = document.getElementById('docs-mois-select');
  return 'docs_checklist_' + (sel ? sel.value : '2026-02');
}

function docsComptableInit(){
  docsRenderChecklist();
  // Mettre à jour le bouton Drive
  var sel = document.getElementById('docs-mois-select');
  var mois = sel ? sel.value : '2026-02';
  var btn = document.getElementById('docs-drive-btn');
  if(btn){
    var link = DOCS_DRIVE_LINKS[mois];
    var nomMois = sel ? sel.options[sel.selectedIndex].text : 'Février 2026';
    if(link){
      btn.href = link;
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'all';
      btn.innerHTML = '📁 Drive — ' + nomMois;
    } else {
      btn.href = '#';
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      btn.innerHTML = '📁 Drive — ' + nomMois + ' (non disponible)';
    }
  }
}

function docsRenderChecklist(){
  var key = docsGetKey();
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e){}
  var container = document.getElementById('docs-checklist');
  if(!container) return;
  var sel = document.getElementById('docs-mois-select');
  var mois = sel ? sel.value : '2026-02';
  var driveLink = DOCS_DRIVE_LINKS[mois] || '#';

  var html = '';
  var lastCat = '';
  var total = DOCS_CHECKLIST.length;
  var done = 0;

  DOCS_CHECKLIST.forEach(function(item){
    var checked = saved[item.id] || false;
    if(checked) done++;
    if(item.cat !== lastCat){
      html += '<div style="padding:6px 16px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:8px;">'
            + (DOCS_CATS[item.cat]||'') + ' ' + item.cat + '</div>';
      lastCat = item.cat;
    }
    html += '<label style="display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;border-radius:6px;transition:.1s;" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'+
      '<input type="checkbox" ' + (checked?'checked':'') + ' onchange="docsToggle(\''+item.id+'\')" style="width:16px;height:16px;accent-color:var(--red);">'+
      '<span style="flex:1;font-size:13px;'+(checked?'text-decoration:line-through;color:var(--text-muted);':'')+'">'+item.label+'</span>'+
      '<span style="font-size:11px;color:'+(item.auto?'var(--green)':'var(--warning)')+';">'+(item.auto?'📧 Auto':'📥 Manuel')+'</span>'+
      '<a href="'+driveLink+'" target="_blank" onclick="event.stopPropagation()" style="background:#f8fafc;border:1px solid var(--border);color:var(--text);padding:3px 8px;border-radius:6px;font-size:11px;text-decoration:none;flex-shrink:0;">📁</a>'+
    '</label>';
  });

  container.innerHTML = html;
  var badge = document.getElementById('docs-progress-badge');
  if(badge){
    var pct = Math.round(done/total*100);
    badge.textContent = done + '/' + total + ' factures (' + pct + '%)';
    badge.style.background = pct===100 ? 'var(--green)' : pct>50 ? 'var(--warning)' : 'var(--red)';
  }
}

function docsToggle(id){
  var key = docsGetKey();
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e){}
  saved[id] = !saved[id];
  localStorage.setItem(key, JSON.stringify(saved));
  docsRenderChecklist();
}

function docsResetChecklist(){
  if(!confirm('Réinitialiser la checklist du mois ?')) return;
  localStorage.removeItem(docsGetKey());
  docsRenderChecklist();
}

async function docsAnalysePDF(input){
  var file = input.files[0];
  if(!file) return;
  var result = document.getElementById('docs-analyse-result');
  result.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">⏳ Analyse en cours...</div>';

  try {
    // Lire le PDF avec l'IA Claude
    var key = localStorage.getItem('sp_claude_key');
    if(!key){ result.innerHTML = '<div style="color:var(--red);padding:10px;">❌ Clé API requise</div>'; return; }

    var base64 = await new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){ res(r.result.split(',')[1]); };
      r.onerror = function(){ rej(new Error('Erreur lecture')); };
      r.readAsDataURL(file);
    });

    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: `Extrait toutes les DÉPENSES (montants négatifs/débits) de ce relevé bancaire.
Pour chaque dépense retourne un JSON array avec : date, libelle, montant (positif), categorie.
Catégories possibles : Énergie, Assurances, Télécom, Comptabilité, Social, Loyer/Charges, Fournisseurs, Achats, Paiements, Banque, Taxes, Divers.
Retourne UNIQUEMENT le JSON, sans texte avant ou après, sans backticks.` }
          ]
        }]
      })
    });

    var data = await resp.json();
    var text = data.content[0].text.replace(/```json|```/g,'').trim();
    var depenses = JSON.parse(text);
    docsAfficheResume(depenses);

  } catch(e) {
    result.innerHTML = '<div style="color:var(--red);padding:10px;">❌ Erreur : ' + e.message + '</div>';
  }
}

function docsAfficheResume(depenses){
  var result = document.getElementById('docs-analyse-result');
  result.innerHTML = '<div style="color:var(--green);padding:10px;font-size:13px;">✅ ' + depenses.length + ' dépenses extraites</div>';

  // Grouper par catégorie
  var cats = {};
  depenses.forEach(function(d){
    var cat = d.categorie || 'Divers';
    if(!cats[cat]) cats[cat] = [];
    cats[cat].push(d);
  });

  var resumeCard = document.getElementById('docs-resume-card');
  var resumeContent = document.getElementById('docs-resume-content');
  if(resumeCard) resumeCard.style.display = 'block';

  var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">';
  html += '<thead><tr style="background:var(--red);"><th style="padding:10px;text-align:left;color:#fff;font-size:13px;">Catégorie</th><th style="padding:10px;text-align:left;color:#fff;font-size:13px;">Libellé</th><th style="padding:10px;text-align:center;color:#fff;font-size:13px;">Date</th><th style="padding:10px;text-align:right;color:#fff;font-size:13px;">Montant</th></tr></thead><tbody>';

  var totalGeneral = 0;
  Object.keys(cats).sort().forEach(function(cat, ci){
    var total = 0;
    cats[cat].forEach(function(d, i){
      var bg = ci%2===0 ? '' : 'background:#f8fafc;';
      html += '<tr style="'+bg+'border-bottom:1px solid var(--border);">';
      html += '<td style="padding:8px 10px;font-size:12px;color:var(--text-muted);">'+(i===0?cat:'')+'</td>';
      html += '<td style="padding:8px 10px;font-size:13px;">'+d.libelle+'</td>';
      html += '<td style="padding:8px 10px;font-size:12px;text-align:center;color:var(--text-muted);">'+d.date+'</td>';
      html += '<td style="padding:8px 10px;font-size:13px;text-align:right;color:var(--red);font-weight:600;">'+parseFloat(d.montant).toFixed(2)+' €</td>';
      html += '</tr>';
      total += parseFloat(d.montant)||0;
    });
    totalGeneral += total;
    html += '<tr style="background:rgba(192,57,43,0.08);"><td colspan="3" style="padding:6px 10px;font-size:12px;font-weight:700;">Total '+cat+'</td><td style="padding:6px 10px;text-align:right;font-weight:700;color:var(--red);">'+total.toFixed(2)+' €</td></tr>';
  });

  html += '<tr style="background:var(--red);"><td colspan="3" style="padding:10px;color:#fff;font-weight:700;font-size:14px;">TOTAL DÉPENSES</td><td style="padding:10px;text-align:right;color:#fff;font-weight:700;font-size:14px;">'+totalGeneral.toFixed(2)+' €</td></tr>';
  html += '</tbody></table></div>';

  // Stocker pour export
  window._docsDepenses = depenses;
  if(resumeContent) resumeContent.innerHTML = html;
}

function docsExportResume(){
  if(!window._docsDepenses || !window._docsDepenses.length){ showToast('Aucune donnée à exporter'); return; }
  var csv = 'Date;Libellé;Catégorie;Montant\n';
  window._docsDepenses.forEach(function(d){
    csv += d.date+';'+d.libelle+';'+(d.categorie||'Divers')+';'+parseFloat(d.montant).toFixed(2)+'\n';
  });
  var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'depenses-'+docsGetKey()+'.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ Export CSV téléchargé !');
}

// ============================================================
//  FIN MODULE DOCUMENTS COMPTABLE
// ============================================================

function isMobile(){ return window.innerWidth <= 768; }

function showPageMobile(id, btnId){
  if(id !== 'instagram'){
    var igC = document.getElementById('ig-content');
    if(igC) igC.style.display = 'none';
    ['captions','calendar','ideas','responses','stories','gmb'].forEach(function(t){
      var e2 = document.getElementById('ig-tab-'+t); if(e2) e2.style.display='none';
    });
  }
  // Appeler showPage normal
  showPage(id, null);
  if(!isMobile()) return;

  // Mettre à jour les boutons nav mobile
  document.querySelectorAll('.mob-nav-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btnId) {
    var btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
  }
  // Mettre à jour aussi la sidebar desktop
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var navItem = document.querySelector('.nav-item[onclick*="\''+id+'\'"]');
  if(navItem) navItem.classList.add('active');

  // Scroll en haut
  window.scrollTo(0,0);
}

function toggleMobileMenu(){
  var panel = document.getElementById('mobile-menu-panel');
  var overlay = document.getElementById('mobile-menu-overlay');
  var isOpen = panel.classList.contains('open');
  if(isOpen){
    closeMobileMenu();
  } else {
    panel.classList.add('open');
    overlay.style.display = 'block';
    // Marquer le bouton actif dans le panel
    var curPage = document.querySelector('.page.active');
    document.querySelectorAll('.mob-menu-item').forEach(function(el){el.classList.remove('active');});
  }
}

function closeMobileMenu(){
  document.getElementById('mobile-menu-panel').classList.remove('open');
  document.getElementById('mobile-menu-overlay').style.display = 'none';
}

// Synchroniser showPage avec la nav mobile
var _origShowPage = showPage;
showPage = function(id, el){
  _origShowPage(id, el);
  if(!isMobile()) return;
  // Map page → bouton mobile
  var map = {dashboard:'mob-btn-dashboard',reparations:'mob-btn-reparations',caisse:'mob-btn-caisse',phones:'mob-btn-phones'};
  document.querySelectorAll('.mob-nav-btn').forEach(function(b){b.classList.remove('active');});
  var btnId = map[id];
  if(btnId){ var b=document.getElementById(btnId); if(b)b.classList.add('active'); }
  else { var more=document.getElementById('mob-btn-more'); if(more)more.classList.add('active'); }
};




// ============================================================
//  PARAMÈTRES API — AgoraPlus · Ecosystem · Ecologic · Pennylane
// ============================================================

// Clés localStorage
var PARAMS_KEYS = {
  // agoraKey/agoraUrl supprimés — APIs Ecosystem et Ecologic directes
  ecoRepairerId:  'sp_eco_repairer_id',
  ecoUser:        'sp_eco_user',
  ecoPass:        'sp_eco_pass',
  ecologicToken:  'sp_ecologic_token',
  ecologicSiteId: 'sp_ecologic_siteid',
  vfToken:        'sp_vf_token',
  vfDomain:       'sp_vf_domain'
};


// Pré-remplir les identifiants connus
(function(){
  if(!localStorage.getItem('sp_eco_repairer_id')) localStorage.setItem('sp_eco_repairer_id','2002535');
  if(!localStorage.getItem('sp_eco_user'))        localStorage.setItem('sp_eco_user','501710');
  if(!localStorage.getItem('sp_eco_pass'))        localStorage.setItem('sp_eco_pass','Coincoin71?!');
  if(!localStorage.getItem('sp_ecologic_token'))  localStorage.setItem('sp_ecologic_token','8121d135-4635-412d-b7ab-3b4dd61cbdb8');
  if(!localStorage.getItem('sp_ecologic_siteid')) localStorage.setItem('sp_ecologic_siteid','f3f52871-5be0-4c26-9082-002479b9cf4e');
  if(!localStorage.getItem('sp_vf_token'))        localStorage.setItem('sp_vf_token','ZhAMQUnE4OPlLRIBOOoj');
  if(!localStorage.getItem('sp_vf_domain'))       localStorage.setItem('sp_vf_domain','solution-phone71');
})();

function paramsLoad(){
  var el;

  el=document.getElementById('params-eco-repairer-id'); if(el) el.value=localStorage.getItem(PARAMS_KEYS.ecoRepairerId)||'';
  el=document.getElementById('params-eco-user');     if(el) el.value=localStorage.getItem(PARAMS_KEYS.ecoUser)||'';
  el=document.getElementById('params-eco-pass');     if(el) el.value=localStorage.getItem(PARAMS_KEYS.ecoPass)||'';
  el=document.getElementById('params-ecologic-token');  if(el) el.value=localStorage.getItem(PARAMS_KEYS.ecologicToken)||'';
  el=document.getElementById('params-ecologic-siteid'); if(el) el.value=localStorage.getItem(PARAMS_KEYS.ecologicSiteId)||'';
  el=document.getElementById('params-vf-token');  if(el) el.value=localStorage.getItem(PARAMS_KEYS.vfToken)||'';
  el=document.getElementById('params-vf-domain'); if(el) el.value=localStorage.getItem(PARAMS_KEYS.vfDomain)||'';
  paramsUpdateStatus();
}



function paramsSaveEcosystem(){
  var id   = (document.getElementById('params-eco-repairer-id')||{value:''}).value.trim();
  var user = (document.getElementById('params-eco-user')||{value:''}).value.trim();
  var pass = (document.getElementById('params-eco-pass')||{value:''}).value.trim();
  if(!id){ showNotif('Entrez le Repairer ID Ecosystem','error'); return; }
  localStorage.setItem(PARAMS_KEYS.ecoRepairerId, id);
  localStorage.setItem(PARAMS_KEYS.ecoUser, user);
  localStorage.setItem(PARAMS_KEYS.ecoPass, pass);
  showNotif('✅ Identifiants Ecosystem enregistrés !','success');
  paramsUpdateStatus();
}

function paramsSaveEcologic(){
  var token  = (document.getElementById('params-ecologic-token')||{value:''}).value.trim();
  var siteid = (document.getElementById('params-ecologic-siteid')||{value:''}).value.trim();
  if(!token){ showNotif('Entrez le Token Ecologic','error'); return; }
  localStorage.setItem(PARAMS_KEYS.ecologicToken, token);
  localStorage.setItem(PARAMS_KEYS.ecologicSiteId, siteid);
  showNotif('✅ Identifiants Ecologic enregistrés !','success');
  paramsUpdateStatus();
}

function paramsSaveVosFactures(){
  var token  = (document.getElementById('params-vf-token')||{value:''}).value.trim();
  var domain = (document.getElementById('params-vf-domain')||{value:''}).value.trim();
  if(!token||!domain){ showNotif('Token et sous-domaine sont obligatoires','error'); return; }
  localStorage.setItem(PARAMS_KEYS.vfToken, token);
  localStorage.setItem(PARAMS_KEYS.vfDomain, domain);
  showNotif('✅ VosFactures configuré !','success');
  paramsUpdateStatus();
}

async function paramsTestVosFactures(){
  var token  = localStorage.getItem(PARAMS_KEYS.vfToken);
  var domain = localStorage.getItem(PARAMS_KEYS.vfDomain);
  var resultEl = document.getElementById('params-vf-test-result');
  if(!token||!domain){ showNotif('Paramètres VosFactures manquants','error'); return; }
  if(resultEl) resultEl.innerHTML='⏳ Test en cours...';
  try {
    var res = await fetch('https://'+domain+'.vosfactures.fr/invoices.json?api_token='+token+'&per_page=1',{
      method:'GET', headers:{'Accept':'application/json'}
    });
    if(res.ok){
      if(resultEl) resultEl.innerHTML='<span style="color:var(--green);">✅ Connexion VosFactures OK !</span>';
      showNotif('VosFactures connecté !','success');
    } else {
      if(resultEl) resultEl.innerHTML='<span style="color:var(--red);">❌ Erreur '+res.status+' — Vérifiez token et sous-domaine</span>';
    }
  } catch(err){
    if(resultEl) resultEl.innerHTML='<span style="color:var(--red);">❌ Erreur de connexion — vérifiez le sous-domaine</span>';
  }
}

function getVFToken(){ return localStorage.getItem(PARAMS_KEYS.vfToken)||''; }
function getVFDomain(){ return localStorage.getItem(PARAMS_KEYS.vfDomain)||''; }

// Créer une facture dans VosFactures depuis une réparation
async function creerFactureVosFactures(rep){
  var token = getVFToken();
  var domain = getVFDomain();
  if(!token||!domain){ showNotif('Configurez VosFactures dans Paramètres API','error'); return null; }

  // Prix réel = prix client + 25€ si bonus QR
  var prixClient = rep.prix||0;
  var prixReel   = rep.bonusQR ? prixClient + 25 : prixClient;

  // Adresse client depuis le dossier courant (champs HTML en priorité)
  var d = repDossierCourant;
  var c = (d&&d.client)||{};
  var adresse  = (document.getElementById('rep-adresse')||{value:''}).value || c.adresse || rep.clientAdresse || '';
  var cp       = (document.getElementById('rep-cp')||{value:''}).value     || c.cp      || '';
  var ville    = (document.getElementById('rep-ville')||{value:''}).value  || c.ville   || '';
  var cpVille  = [cp, ville].filter(Boolean).join(' ');

  var payload = {
    api_token: token,
    invoice: {
      kind: 'vat',
      sell_date: rep.date||new Date().toISOString().split('T')[0],
      issue_date: new Date().toISOString().split('T')[0],
      buyer_name: rep.clientNom||'',
      buyer_email: rep.clientEmail||'',
      buyer_street: adresse,
      buyer_post_code: cp,
      buyer_city: ville,
      description: (rep.description||'Réparation smartphone') + (rep.dossier?' — N° '+rep.dossier:''),
      number_with_year_template: null,
      positions: [
        {
          name: rep.description||'Réparation',
          tax: 20,
          total_price_gross: prixReel,
          quantity: 1
        }
      ].concat(rep.bonusQR ? [{
        name: 'Bonus Réparation QualiRépar (dispositif QualiRépar - Loi AGEC)',
        tax: 'zw',
        total_price_gross: -25,
        quantity: 1
      }] : [])
    }
  };

  try {
    var res = await fetch('https://'+domain+'.vosfactures.fr/invoices.json', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(res.ok){
      var data = await res.json();
      return data; // contient data.id, data.number, data.view_url
    }
  } catch(e){ console.error('VosFactures:', e); }
  return null;
}

async 

function paramsUpdateStatus(){
  var box = document.getElementById('params-connexions-status');
  if(!box) return;

  var connexions = [
    { label: 'Ecosystem',  ok: !!localStorage.getItem(PARAMS_KEYS.ecoRepairerId),   icon: '🟢', color: 'var(--green)' },
    { label: 'Ecologic',   ok: !!localStorage.getItem(PARAMS_KEYS.ecologicToken),   icon: '🔵', color: 'var(--blue)' },
    { label: 'VosFactures', ok: !!localStorage.getItem(PARAMS_KEYS.vfToken),         icon: '🧾', color: '#0369a1' },
  ];

  box.innerHTML = '';
  connexions.forEach(function(c){
    var div = document.createElement('div');
    div.style.cssText = 'padding:12px;border-radius:10px;text-align:center;background:'+(c.ok?'#f0fdf4':'#f8fafc')+';border:1.5px solid '+(c.ok?c.color:'var(--border)')+';';
    div.innerHTML = '<div style="font-size:22px;margin-bottom:4px;">'+c.icon+'</div>'+
      '<div style="font-size:12px;font-weight:700;">'+c.label+'</div>'+
      '<div style="font-size:11px;margin-top:4px;color:'+(c.ok?c.color:'var(--text-muted)')+';font-weight:700;">'+(c.ok?'✅ Configuré':'⏳ En attente')+'</div>';
    box.appendChild(div);
  });
}

// Fonctions d'accès aux paramètres depuis le reste de l'app
function getEcoRepairerId(){ return localStorage.getItem(PARAMS_KEYS.ecoRepairerId)||''; }
function getEcologicToken(){ return localStorage.getItem(PARAMS_KEYS.ecologicToken)||''; }
function getEcologicSiteId(){ return localStorage.getItem(PARAMS_KEYS.ecologicSiteId)||''; }
function getPennylaneKey(){ return localStorage.getItem(PARAMS_KEYS.pennylaneKey)||''; }
// ============================================================
//  FIN PARAMÈTRES API
// ============================================================

// ============================================================
//  CLIENTS EN ATTENTE — Tablette accueil
// ============================================================
var clientsEnAttente = [];



// ============================================================
//  CACHE localStorage — Clients + Historique réparations
// ============================================================
var CACHE_CLIENTS_KEY    = 'sp_clients_cache';
var CACHE_CLIENTS_TS_KEY = 'sp_clients_cache_ts';
var CACHE_HREP_KEY       = 'sp_hrep_cache';
var CACHE_HREP_TS_KEY    = 'sp_hrep_cache_ts';
var CACHE_TTL_MS         = 5 * 60 * 1000; // 5 minutes avant re-sync Supabase

function cacheClients(data){
  try {
    localStorage.setItem(CACHE_CLIENTS_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_CLIENTS_TS_KEY, Date.now().toString());
  } catch(e){ console.log('Cache clients trop grand:', e); }
}

function getCachedClients(){
  try {
    var ts = parseInt(localStorage.getItem(CACHE_CLIENTS_TS_KEY)||'0');
    var data = localStorage.getItem(CACHE_CLIENTS_KEY);
    if(data) return { data: JSON.parse(data), fresh: (Date.now()-ts) < CACHE_TTL_MS };
  } catch(e){}
  return null;
}

function cacheHRep(data){
  try {
    localStorage.setItem(CACHE_HREP_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_HREP_TS_KEY, Date.now().toString());
  } catch(e){ console.log('Cache réparations trop grand:', e); }
}

function getCachedHRep(){
  try {
    var ts = parseInt(localStorage.getItem(CACHE_HREP_TS_KEY)||'0');
    var data = localStorage.getItem(CACHE_HREP_KEY);
    if(data) return { data: JSON.parse(data), fresh: (Date.now()-ts) < CACHE_TTL_MS };
  } catch(e){}
  return null;
}

// ── loadAllClients avec cache ────────────────────────────────
async function loadAllClients(){
  // 1. Charger depuis le cache instantanément
  var cached = getCachedClients();
  if(cached && cached.data.length > 0){
    // Vérifier si le cache a bien cp et ville (sinon forcer rechargement)
    var hasCpVille = cached.data.some(function(c){ return c.cp || c.ville; });
    if(!hasCpVille){
      console.log('Cache obsolète (pas de cp/ville) → rechargement Supabase');
      localStorage.removeItem('sp_clients_cache');
      syncClientsFromSupabase();
      return;
    }
    clients = cached.data;
    if(document.getElementById('clients-liste')) renderClients();
    console.log('Clients depuis cache : '+clients.length);

    // 2. Si cache périmé → resync Supabase en arrière-plan
    if(!cached.fresh){
      setTimeout(syncClientsFromSupabase, 100);
    }
    return;
  }

  // 3. Pas de cache → charger depuis Supabase
  await syncClientsFromSupabase();
}

async function syncClientsFromSupabase(){
  var allClients = [];
  var batchSize = 1000;
  var offset = 0;
  var keepGoing = true;

  while(keepGoing){
    try {
      var res = await supaFetch('clients','GET',null,
        '?select=id,nom,prenom,civilite,tel,email,adresse,cp,ville,notes,date_creation&order=nom.asc&limit='+batchSize+'&offset='+offset);
      if(res && res.length > 0){
        allClients = allClients.concat(res.map(function(x){
          return{id:x.id,nom:x.nom||'',prenom:x.prenom||'',
                 tel:x.tel||'',email:x.email||'',adresse:x.adresse||'',
                 cp:x.cp||'',ville:x.ville||'',
                 notes:x.notes||'',dateCreation:x.date_creation,civilite:x.civilite||''};
        }));
        offset += batchSize;
        if(res.length < batchSize) keepGoing = false;
      } else {
        keepGoing = false;
      }
    } catch(e){ keepGoing = false; }
  }

  if(allClients.length > 0){
    clients = allClients;
    cacheClients(clients); // Sauvegarder dans localStorage
    if(document.getElementById('clients-liste')) renderClients();
    console.log('Clients depuis Supabase : '+clients.length);
  }
}

// ── loadHistoriqueReparations avec cache ─────────────────────
async function loadHistoriqueReparations(){
  // 1. Cache instantané
  var cached = getCachedHRep();
  if(cached && cached.data.length > 0){
    historiqueReparations = cached.data;
    console.log('Historique depuis cache : '+historiqueReparations.length);
    if(!cached.fresh) setTimeout(syncHRepFromSupabase, 500);
    return;
  }
  // 2. Supabase
  await syncHRepFromSupabase();
}

async function syncHRepFromSupabase(){
  try {
    var allReps = [];
    var batchSize = 1000;
    var offset = 0;
    var keepGoing = true;
    while(keepGoing){
      var res = await supaFetch('historique_reparations','GET',null,
        '?order=date_rep.desc&limit='+batchSize+'&offset='+offset);
      if(res && res.length > 0){
        allReps = allReps.concat(res);
        offset += batchSize;
        if(res.length < batchSize) keepGoing = false;
      } else { keepGoing = false; }
    }
    if(allReps.length > 0){
      historiqueReparations = allReps;
      cacheHRep(historiqueReparations);
      console.log('Historique depuis Supabase : '+historiqueReparations.length);
    }
  } catch(e){ console.log('syncHRep:', e); }
}

// ── Invalider le cache quand un nouveau client est ajouté ────
function invaliderCacheClients(){
  localStorage.removeItem(CACHE_CLIENTS_TS_KEY); // Force re-sync au prochain chargement
}

// ── Invalider le cache quand une répa est importée ───────────
function invaliderCacheHRep(){
  localStorage.removeItem(CACHE_HREP_TS_KEY);
}
// ============================================================
//  FIN CACHE
// ============================================================

// loadAllClients redéfini ci-dessus dans JS_CACHE
// ──────────────────────────────────


async function loadClientsEnAttente(){
  try {
    var res = await fetch(SUPA_URL + '/rest/v1/clients_en_attente?traite=eq.false&order=date_inscription.desc', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if(res.ok){
      clientsEnAttente = await res.json();
      renderClientsEnAttente();
      updateBadgeAttente();
    }
  } catch(e){ console.log('Clients attente:', e); }
}

function updateBadgeAttente(){
  var n = clientsEnAttente.length;
  var badge = document.getElementById('badge-attente');
  if(!badge) return;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}

function renderClientsEnAttente(){
  var tbody = document.getElementById('attente-table');
  if(!tbody) return;
  if(!clientsEnAttente.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Aucun client en attente</td></tr>';
    return;
  }
  tbody.innerHTML = clientsEnAttente.map(function(c){
    var dt = new Date(c.date_inscription);
    var heure = dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    var date  = dt.toLocaleDateString('fr-FR');
    return '<tr>'+
      '<td><b>'+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'</b></td>'+
      '<td>'+c.tel+'</td>'+
      '<td style="font-size:12px;color:var(--text-muted);">'+(c.email||'—')+'</td>'+
      '<td style="font-size:12px;color:var(--text-muted);">'+(c.cp?c.cp+' '+c.ville:'—')+'</td>'+
      '<td style="font-size:12px;color:var(--text-muted);">'+date+' '+heure+'</td>'+
      '<td style="display:flex;gap:6px;">'+
        '<button class="btn btn-primary btn-sm" onclick="chargerClientEnAttente(\''+c.id+'\')" title="Créer une réparation">🔧 Réparation</button>'+
        '<button class="btn btn-sm" onclick="marquerClientTraite(\''+c.id+'\')" title="Marquer comme traité" style="color:var(--text-muted)">✓</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

async function chargerClientEnAttente(id){
  var c = clientsEnAttente.find(function(x){ return String(x.id)===String(id); });
  if(!c) return;
  // Aller dans Réparations et pré-remplir étape 1
  showPage('reparations', null);
  repNewDossier();
  setTimeout(function(){
    document.getElementById('rep-civilite').value = c.civilite||'';
    document.getElementById('rep-nom').value      = c.nom||'';
    document.getElementById('rep-prenom').value   = c.prenom||'';
    document.getElementById('rep-tel').value      = c.tel||'';
    document.getElementById('rep-email').value    = c.email||'';
    document.getElementById('rep-adresse').value  = c.adresse||'';
    // Charger cp/ville — extraire depuis adresse si nécessaire
    var cpVal = c.cp||'';
    var villeVal = c.ville||'';
    if(!cpVal && c.adresse){
      var cpM = c.adresse.match(/(\d{4,5})\s+([\w\s-]+)$/);
      if(cpM){ cpVal=cpM[1]; villeVal=villeVal||cpM[2].trim(); }
    }
    document.getElementById('rep-cp').value       = cpVal;
    document.getElementById('rep-ville').value    = villeVal;
    repAutoSave();
    showNotif((c.prenom||'')+' '+(c.nom||'')+' chargé dans Réparations — Passez à l\'étape 2 !', 'success');
    marquerClientTraite(id);
  }, 300);
}

async function marquerClientTraite(id){
  try {
    await fetch(SUPA_URL + '/rest/v1/clients_en_attente?id=eq.'+id, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({traite: true})
    });
    clientsEnAttente = clientsEnAttente.filter(function(x){ return String(x.id)!==String(id); });
    renderClientsEnAttente();
    updateBadgeAttente();
  } catch(e){ console.log('marquer traite:', e); }
}

// Polling toutes les 30 secondes pour détecter nouveaux clients
setInterval(function(){
  if(supabaseReady) loadClientsEnAttente();
}, 30000);
// ============================================================
//  FIN CLIENTS EN ATTENTE
// ============================================================

// ============================================================
//  MODULE TÉLÉPHONES NEUFS & ACCESSOIRES — TVA 20%
// ============================================================
var naVentes = [];
var _naNumero = 1;

async function naLoad(){
  try {
    var res = await supaFetch('ventes_neufs_access','GET',null,'?order=id.desc');
    if(res && res.length >= 0){
      naVentes = res.map(function(x){
        return {id:x.id,numero:x.numero,date:x.date,type:x.type,description:x.description,
          clientNom:x.client_nom,clientAdresse:x.client_adresse||'',clientEmail:x.client_email||'',
          prix:Number(x.prix_ttc),mode:x.mode_reglement||'CB'};
      });
      if(naVentes.length) _naNumero = naVentes.length + 1;
      naRender();
    }
  } catch(e){ console.log('naLoad error',e); }
}

async function naSave(vente){
  try {
    await supaFetch('ventes_neufs_access','POST',{
      numero:vente.numero, date:vente.date, type:vente.type,
      description:vente.description, client_nom:vente.clientNom,
      client_adresse:vente.clientAdresse, client_email:vente.clientEmail,
      prix_ttc:vente.prix, mode_reglement:vente.mode
    });
  } catch(e){ console.log('naSave error',e); }
}

function naGetAdresse(){
  var a = (document.getElementById('na-adresse')||{value:''}).value.trim();
  var cp = (document.getElementById('na-cp')||{value:''}).value.trim();
  var v = (document.getElementById('na-ville')||{value:''}).value.trim();
  return [a, cp&&v?cp+' '+v:cp||v].filter(Boolean).join(', ');
}

function naUpdatePreview(){
  var desc = document.getElementById('na-description').value.trim();
  var client = document.getElementById('na-client').value.trim();
  var prixStr = document.getElementById('na-prix').value;
  var prix = parseFloat(prixStr)||0;
  var card = document.getElementById('na-preview-card');
  if(!desc||!client||!prix){ if(card) card.style.display='none'; return; }
  if(card) card.style.display='block';
  var adresse = naGetAdresse();
  var ht = prix/1.2;
  var tva = prix-ht;
  var num = 'ACC-'+new Date().getFullYear()+'-'+String(_naNumero).padStart(3,'0');
  var mode = document.getElementById('na-mode').value;
  var content = document.getElementById('na-preview-content');
  if(content){
    content.innerHTML = buildA4HTML({
      type:'reparation', numero:num, date:new Date().toISOString().split('T')[0],
      clientNom:client, clientAdresse:adresse, clientEmail:'',
      mode:mode, garantie:'',
      lignes:[{desc:desc,qte:1,pu:prix}],
      total:prix, isDevis:false
    });
  }
}

function naGenererFacture(){
  var desc = document.getElementById('na-description').value.trim();
  var client = document.getElementById('na-client').value.trim();
  var type = document.getElementById('na-type').value;
  var prix = parseFloat(document.getElementById('na-prix').value)||0;
  if(!desc||!client||!type||!prix){ showNotif('Remplissez les champs obligatoires *','error'); return; }
  var num = 'ACC-'+new Date().getFullYear()+'-'+String(_naNumero).padStart(3,'0');
  var date = new Date().toISOString().split('T')[0];
  var vente = {
    id:Date.now(), numero:num, date:date, type:type,
    description:desc, clientNom:client,
    clientAdresse:naGetAdresse(),
    clientEmail:document.getElementById('na-email').value.trim(),
    prix:prix, mode:document.getElementById('na-mode').value
  };
  naVentes.unshift(vente);
  _naNumero++;
  naSave(vente);
  naRender();
  // Imprimer
  var html = buildA4HTML({
    type:'reparation', numero:vente.numero, date:vente.date,
    clientNom:vente.clientNom, clientAdresse:vente.clientAdresse, clientEmail:vente.clientEmail,
    mode:vente.mode, garantie:'',
    lignes:[{desc:vente.description,qte:1,pu:vente.prix}],
    total:vente.prix, isDevis:false
  });
  ouvrirA4(html);
  naReset();
  showNotif('Facture '+vente.numero+' créée !','success');
}

function naImprimer(){
  var desc = document.getElementById('na-description').value.trim();
  var client = document.getElementById('na-client').value.trim();
  var prix = parseFloat(document.getElementById('na-prix').value)||0;
  if(!desc||!client||!prix) return;
  var h = buildA4HTML({
    type:'reparation', numero:'ACC-'+new Date().getFullYear()+'-'+String(_naNumero).padStart(3,'0'),
    date:new Date().toISOString().split('T')[0],
    clientNom:client, clientAdresse:naGetAdresse(), clientEmail:'',
    mode:document.getElementById('na-mode').value, garantie:'',
    lignes:[{desc:desc,qte:1,pu:prix}], total:prix, isDevis:false
  });
  ouvrirA4(h);
}

function naReset(){
  ['na-type','na-description','na-client','na-adresse','na-cp','na-ville','na-email','na-prix'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  var card = document.getElementById('na-preview-card');
  if(card) card.style.display='none';
}

function naRender(){
  var search = (document.getElementById('na-search')||{value:''}).value.toLowerCase();
  var filtered = naVentes.filter(function(v){
    return !search || v.description.toLowerCase().includes(search) || v.clientNom.toLowerCase().includes(search) || v.numero.toLowerCase().includes(search);
  });
  var tbody = document.getElementById('na-table');
  if(!tbody) return;
  var typeLabels = {'telephone-neuf':'📱 Tél. neuf','accessoire':'📦 Accessoire','coque':'🛡️ Coque','chargeur':'🔌 Chargeur','autre':'📦 Autre'};
  tbody.innerHTML = filtered.map(function(v){
    return '<tr>'+
      '<td><b>'+v.numero+'</b></td>'+
      '<td>'+fmtDate(v.date)+'</td>'+
      '<td>'+(typeLabels[v.type]||v.type||'—')+'</td>'+
      '<td>'+v.description+'</td>'+
      '<td>'+v.clientNom+'</td>'+
      '<td><b>'+v.prix.toFixed(2)+' €</b></td>'+
      '<td>'+v.mode+'</td>'+
      '<td><button class="btn btn-sm" onclick="naReimprimer('+v.id+')">🖨️</button></td>'+
      '</tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:16px;">Aucune vente</td></tr>';
  var total = filtered.reduce(function(s,v){return s+v.prix;},0);
  var totalBar = document.getElementById('na-total-bar');
  if(totalBar) totalBar.innerHTML = filtered.length+' vente(s) · Total TTC : <b>'+total.toFixed(2)+' €</b> · HT : '+(total/1.2).toFixed(2)+' € · TVA 20% : '+(total-total/1.2).toFixed(2)+' €';
}

function naReimprimer(id){
  var v = naVentes.find(function(x){return x.id===id;});
  if(!v) return;
  var h = buildA4HTML({
    type:'reparation', numero:v.numero, date:v.date,
    clientNom:v.clientNom, clientAdresse:v.clientAdresse, clientEmail:v.clientEmail||'',
    mode:v.mode, garantie:'',
    lignes:[{desc:v.description,qte:1,pu:v.prix}],
    total:v.prix, isDevis:false
  });
  ouvrirA4(h);
}

function naExportCSV(){
  var headers = ['Numéro','Date','Type','Description','Client','Adresse','Prix TTC','HT','TVA','Mode'];
  var rows = naVentes.map(function(v){
    return [v.numero,v.date,v.type,v.description,v.clientNom,v.clientAdresse,v.prix.toFixed(2),(v.prix/1.2).toFixed(2),(v.prix-v.prix/1.2).toFixed(2),v.mode].join(';');
  });
  var csv = [headers.join(';')].concat(rows).join('\n');
  var blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='Ventes_Neufs_Accessoires.csv'; a.click();
  showNotif('Export téléchargé !','success');
}
function naShowBonCommande(){
  showPage('reparations',null);
  repLoadDossiers();
  setTimeout(function(){
    // Ouvrir nouveau dossier et aller directement au bon de commande
    showNotif('Utilisez le bon de commande dans Réparations → Étape 3','success');
  },200);
}


// ============================================================
//  IMPORT RÉPARATIONS PHONILAB
// ============================================================
var historiqueReparations = [];



function getHistoriqueClient(nomOuTel){
  if(!nomOuTel) return [];
  var q = nomOuTel.toLowerCase().trim();
  // Chercher dans historique Phonilab
  var hist = historiqueReparations.filter(function(r){
    return (r.client_nom||'').toLowerCase().includes(q) ||
           (r.client_tel||'').replace(/\s/g,'').includes(q.replace(/\s/g,''));
  });
  // Chercher aussi dans les réparations app
  var appReps = reparations.filter(function(r){
    return (r.clientNom||'').toLowerCase().includes(q);
  }).map(function(r){
    return {
      numero: r.numero, date_rep: r.date,
      client_nom: r.clientNom, modele: r.appareil,
      statut: 'Terminé', paiement: r.mode||'—',
      source: 'app'
    };
  });
  return hist.concat(appReps).sort(function(a,b){
    return (b.date_rep||'').localeCompare(a.date_rep||'');
  });
}

async function importReparationsPhonilab(input){
  var file = input.files[0];
  if(!file) return;
  var statusEl = document.getElementById('clients-import-status');
  if(statusEl) statusEl.textContent = '⏳ Lecture réparations...';

  var reader = new FileReader();
  reader.onload = async function(e){
    var text = e.target.result;
    var rawLines = text.split('\n').filter(function(l){return l.trim();});
    if(rawLines.length < 2){ showNotif('Fichier vide','error'); return; }

    function parseCSVLine(line){
      var result=[]; var cur=''; var inQ=false;
      for(var i=0;i<line.length;i++){
        if(line[i]==='"'){inQ=!inQ;}
        else if(line[i]===';'&&!inQ){result.push(cur.trim());cur='';}
        else{cur+=line[i];}
      }
      result.push(cur.trim());
      return result;
    }

    var headers = parseCSVLine(rawLines[0]).map(function(h){return h.toLowerCase().replace(/"/g,'').trim();});

    function fiExact(terms){
      var idx = headers.findIndex(function(h){return terms.some(function(t){return h===t;});});
      if(idx>=0) return idx;
      return headers.findIndex(function(h){return terms.some(function(t){return h.includes(t);});});
    }

    var iDate    = fiExact(['date réparation','date']);
    var iNum     = headers.indexOf('réparation') >= 0 ? headers.indexOf('réparation') : fiExact(['reparation']);
    var iClient  = fiExact(['client']);
    var iEmail   = fiExact(['email']);
    var iTel     = fiExact(['téléphone','telephone']);
    var iModele  = fiExact(['modèle','modele']);
    var iStatut  = fiExact(['statut']);
    var iFacture = fiExact(['facture']);
    var iPaie    = fiExact(['paiement']);
    var iTech    = fiExact(['technicien']);

    if(iNum === iDate) iNum = headers.indexOf('réparation');

    var newReps = []; var skipped = 0;

    for(var i=1; i<rawLines.length; i++){
      var cols = parseCSVLine(rawLines[i]);
      if(cols.length < 3) continue;
      var num    = (iNum>=0?cols[iNum]:'').replace(/"/g,'').trim();
      var client = (iClient>=0?cols[iClient]:'').replace(/"/g,'').trim();
      if(!client && !num) continue;
      var existe = historiqueReparations.find(function(r){return r.numero===num;});
      if(existe){ skipped++; continue; }
      var tel = (iTel>=0?cols[iTel]:'').replace(/"/g,'').trim();
      if(tel && !tel.startsWith('0') && !tel.startsWith('+')) tel='0'+tel;
      newReps.push({
        numero:       num,
        date_rep:     (iDate>=0?cols[iDate]:'').replace(/"/g,'').trim(),
        client_nom:   client,
        client_email: (iEmail>=0?cols[iEmail]:'').replace(/"/g,'').trim(),
        client_tel:   tel,
        modele:       (iModele>=0?cols[iModele]:'').replace(/"/g,'').trim(),
        statut:       (iStatut>=0?cols[iStatut]:'').replace(/"/g,'').trim(),
        facture:      (iFacture>=0?cols[iFacture]:'').replace(/"/g,'').trim(),
        paiement:     (iPaie>=0?cols[iPaie]:'').replace(/"/g,'').trim(),
        technicien:   (iTech>=0?cols[iTech]:'').replace(/"/g,'').trim(),
        source:       'phonilab'
      });
    }

    if(newReps.length === 0){
      var msg = skipped > 0 ? '✅ Toutes déjà importées ('+skipped+' ignorées)' : '⚠️ Aucune réparation trouvée';
      showNotif(msg, skipped>0?'success':'error');
      if(statusEl) statusEl.textContent = msg;
      input.value=''; return;
    }

    // ── Envoi SÉQUENTIEL par batch de 50 ──
    var batchSize = 50;
    var imported = 0;
    var errors = 0;

    for(var b=0; b<newReps.length; b+=batchSize){
      var batch = newReps.slice(b, b+batchSize);
      var pct = Math.round((b/newReps.length)*100);
      if(statusEl) statusEl.textContent = '⏳ Sauvegarde... '+pct+'% ('+b+'/'+newReps.length+')';
      try {
        var res = await supaFetch('historique_reparations','POST', batch);
        if(res && !res.error){
          imported += batch.length;
          historiqueReparations = historiqueReparations.concat(batch);
        } else {
          errors += batch.length;
          console.error('Batch error:', res);
        }
      } catch(err){
        errors += batch.length;
        console.error('Batch exception:', err);
      }
    }

    cacheHRep(historiqueReparations);

    var msg = '✅ '+imported+' réparations importées'+(skipped?' · '+skipped+' déjà présentes':'')+(errors?' · ⚠️ '+errors+' erreurs':'');
    showNotif(msg, errors>0?'error':'success');
    if(statusEl) statusEl.textContent = msg;
    input.value='';
  };
  reader.readAsText(file,'ISO-8859-1');
}
// ============================================================
//  FIN IMPORT RÉPARATIONS
// ============================================================

// ============================================================
//  FIN MODULE TÉLÉPHONES NEUFS & ACCESSOIRES
// ============================================================


// ============================================================