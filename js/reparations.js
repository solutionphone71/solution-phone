//  MODULE RÉPARATIONS — PARCOURS CLIENT COMPLET
// ============================================================

// État du dossier courant
var repDossierCourant = null;
var repDossiers = [];  // cache local (= bonsDepot enrichis)
var repCurrentStep = 1;

// Statuts
var REP_STATUTS = {
  depot:   { label: 'Bon de dépôt',  cls: 'rep-s-depot' },
  devis:   { label: 'Devis',          cls: 'rep-s-devis' },
  facture: { label: 'Facturé',        cls: 'rep-s-facture' },
  qr:      { label: 'QR envoyé',      cls: 'rep-s-qr' },
  cloture: { label: 'Clôturé',        cls: 'rep-s-cloture' }
};

// Charger les dossiers = bonsDepot enrichis
function repLoadDossiers(){
  if(!Array.isArray(bonsDepot)) { repDossiers = []; renderRepListe(); return; }
  repDossiers = bonsDepot.map(function(d){
    var safe = Object.assign({ statut: d.statut||'depot', facture: d.facture||null, qrEnvoi: d.qrEnvoi||null }, d);
    if(!Array.isArray(safe.etat)) safe.etat = [];
    if(!Array.isArray(safe.accessoires)) safe.accessoires = [];
    if(!safe.client) safe.client = {};
    if(!safe.appareil) safe.appareil = {};
    return safe;
  });
  renderRepListe();
}

function renderRepListe(){
  var search = (document.getElementById('rep-search')||{value:''}).value.toLowerCase();
  var tbody = document.getElementById('rep-liste-table');
  if(!tbody) return;
  var list = repDossiers.filter(function(d){
    if(!d) return false;
    var c = d.client||{}; var a = d.appareil||{};
    return !search ||
      ((c.nom||'')+' '+(c.prenom||'')).toLowerCase().includes(search) ||
      ((a.marque||'')+' '+(a.modele||'')).toLowerCase().includes(search) ||
      (d.numero||'').toLowerCase().includes(search);
  }).slice().reverse();

  var statusMap = {'depot':'🟡 Dépôt','devis':'🔵 Devis','facture':'🟢 Facturé','qr':'🔴 QR envoyé','cloture':'⚫ Clôturé'};
  tbody.innerHTML = list.map(function(d){
    if(!d) return '';
    var c = d.client||{}; var a = d.appareil||{};
    var s = (typeof REP_STATUTS !== 'undefined' ? REP_STATUTS[d.statut||'depot'] : null) || {label: d.statut||'depot', cls: 'rep-s-depot'};
    return '<tr onclick="repOuvrirDossier(\''+d.id+'\')" style="cursor:pointer;">'+
      '<td><b>'+(d.numero||'')+'</b></td>'+
      '<td>'+fmtDate(d.date)+'</td>'+
      '<td>'+((c.prenom?c.prenom+' ':'')+c.nom)+'</td>'+
      '<td>'+(a.marque||'')+' '+(a.modele||'')+'</td>'+
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(d.panne||'—')+'</td>'+
      '<td><span class="rep-status-badge '+(s?s.cls:'')+'">'+((s?s.label:d.statut))+'</span></td>'+
      '<td style="display:flex;gap:4px;" onclick="event.stopPropagation()">'+
        '<button class="btn btn-sm" title="Ouvrir" onclick="repOuvrirDossier(\''+d.id+'\')">📂</button>'+
        '<button class="btn btn-sm" title="Bon de dépôt" onclick="repReprintDepot(\''+d.id+'\')">🖨️</button>'+
        '<button class="btn btn-sm" title="Supprimer" onclick="repSupprimerDossier(\''+d.id+'\')" style="color:var(--text-dim)">🗑️</button>'+
      '</td>'+
    '</tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Aucun dossier — cliquez sur ➕ Nouveau dossier</td></tr>';
}

function repShowListe(){
  document.getElementById('rep-liste-view').style.display='block';
  document.getElementById('rep-dossier-view').style.display='none';
  repDossierCourant = null;
  renderRepListe();
}


function repGenererNumero(){
  var annee = new Date().getFullYear();
  var prefix = 'REP-'+annee+'-';
  var max = 0;
  if(!Array.isArray(repDossiers)) repDossiers = [];
  repDossiers.forEach(function(d){
    if(d.numero && d.numero.startsWith(prefix)){
      var n = parseInt(d.numero.replace(prefix,''))||0;
      if(n > max) max = n;
    }
  });
  return prefix + String(max+1).padStart(3,'0');
}

function repNewDossier(){
  try {
    // S'assurer que repDossiers est synchronisé
    if(!Array.isArray(repDossiers) || repDossiers.length === 0) repLoadDossiers();
    repDossierCourant = {
      id: Date.now(),
      numero: repGenererNumero(),
      date: new Date().toISOString().split('T')[0],
      statut: 'depot',
      client: {civilite:'M.'}, appareil: {}, panne:'', devis:0, moHT:0, piecesHT:0, obs:'',
      etat:[], accessoires:[], etatAutre:'',
      facture: null, qrEnvoi: null, signature: null, photoImeiUrl: null
    };
    repClearForm();
    var titre = document.getElementById('rep-dossier-titre');
    if(titre) titre.textContent = 'Nouveau dossier';
    var num = document.getElementById('rep-dossier-num');
    if(num) num.textContent = repDossierCourant.numero;
    repUpdateStatutBadge();
    var liste = document.getElementById('rep-liste-view');
    var dossier = document.getElementById('rep-dossier-view');
    if(liste) liste.style.display='none';
    if(dossier) dossier.style.display='block';
    repGoStep(1);
    repApplyClientLock(false); // nouveau dossier = champs déverrouillés
  } catch(e) {
    console.error('repNewDossier error:', e);
    showNotif('Erreur ouverture dossier : '+e.message, 'error');
  }
}



function repImprimerTicket(){
  repAutoSave();
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier ouvert','error'); return; }
  var c = d.client||{};
  var a = d.appareil||{};
  var dateDepot = new Date(d.date).toLocaleDateString('fr-FR');
  var devis = d.devis ? d.devis.toFixed(2)+' \u20ac TTC' : '\u00c0 \u00e9tablir';
  var bonusQR = (document.getElementById('rep-qr-actif')||{checked:false}).checked;

  var t = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket</title>'+
    '<style>*{margin:0;padding:0;}body{font-family:"Courier New",monospace;font-size:12px;width:80mm;}.center{text-align:center;}.bold{font-weight:bold;}.line{border-top:1px dashed #000;margin:3px 0;}.big{font-size:14px;font-weight:bold;}@media print{@page{size:80mm auto;margin:1mm;}.no-print{display:none;}}</style>'+
    '</head><body>'+
    '<p class="no-print" style="padding:4px;"><button onclick="window.print()" style="width:100%;padding:6px;background:#c0392b;color:#fff;border:none;cursor:pointer;font-weight:bold;">Imprimer</button></p>'+
    '<div style="padding:2mm;">'+
    '<p class="center bold" style="font-size:14px;">SOLUTION PHONE</p>'+
    '<p class="center" style="font-size:10px;">21 Rue Gambetta - 71000 Macon - 03 85 33 06 89</p>'+
    '<p class="line"></p>'+
    '<p class="center bold">BON DE DEPOT</p>'+
    '<p class="center">'+d.numero+'</p>'+
    '<p class="center" style="font-size:10px;">'+dateDepot+'</p>'+
    '<p class="line"></p>'+
    '<p class="bold">CLIENT</p>'+
    '<p>'+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'</p>'+
    '<p>Tel: '+c.tel+'</p>'+
    '<p class="line"></p>'+
    '<p class="bold">APPAREIL</p>'+
    '<p>'+a.marque+' '+a.modele+'</p>'+
    (a.imei?'<p style="font-size:10px;">IMEI: '+a.imei+'</p>':'')+
    '<p class="line"></p>'+
    '<p class="bold">PANNE</p>'+
    '<p style="font-size:11px;word-break:break-word;">'+(d.panne||'—')+'</p>'+
    '<p class="line"></p>'+
    '<p class="bold">DEVIS ESTIMATIF</p>'+
    '<p class="center big">'+devis+'</p>'+
    (bonusQR?'<p class="center" style="font-size:10px;">Bonus QualiRepar -25.00 \u20ac inclus</p>':'')+
    '<p class="line"></p>'+
    '<p class="center" style="font-size:10px;">Hors garantie fabricant.</p>'+
    '<p class="center" style="font-size:10px;">Garantie reparation 3 mois.</p>'+
    '<p class="line"></p>'+
    '<p class="bold">Signature client :</p>'+
    (d.signature?'<p><img src="'+d.signature+'" style="max-width:70mm;max-height:18mm;"></p>':
     '<p style="height:14mm;border-bottom:1px solid #000;margin:2mm 0;"></p>')+
    '<p class="line"></p>'+
    '<p class="center" style="font-size:10px;">Merci de votre confiance !</p>'+
    '</div></body></html>';

  var w = window.open('','_blank','width=380,height=650');
  if(!w){ showNotif('Autorisez les popups pour imprimer','error'); return; }
  w.document.write(t);
  w.document.close();
  setTimeout(function(){ w.print(); }, 400);
}

function repOuvrirVosFactures(){
  if(!repDossierCourant||!repDossierCourant.facture||!repDossierCourant.facture.vfUrl) return;
  window.open(repDossierCourant.facture.vfUrl,'_blank');
}

function repOuvrirDossier(id){
  if(!Array.isArray(repDossiers)) repDossiers = [];
  if(repDossiers.length === 0) repLoadDossiers();
  var d = repDossiers.find(function(x){ return String(x.id)===String(id); });
  if(!d) return;
  repDossierCourant = JSON.parse(JSON.stringify(d));
  // Sécuriser les propriétés manquantes
  if(!repDossierCourant.client) repDossierCourant.client = {};
  if(!repDossierCourant.appareil) repDossierCourant.appareil = {};
  if(!Array.isArray(repDossierCourant.etat)) repDossierCourant.etat = [];
  if(!Array.isArray(repDossierCourant.accessoires)) repDossierCourant.accessoires = [];
  repLoadFormFromDossier();
  document.getElementById('rep-dossier-titre').textContent = (repDossierCourant.client.prenom||'')+' '+(repDossierCourant.client.nom||'');
  document.getElementById('rep-dossier-num').textContent = repDossierCourant.numero+' · '+fmtDate(repDossierCourant.date);
  repUpdateStatutBadge();
  document.getElementById('rep-liste-view').style.display='none';
  document.getElementById('rep-dossier-view').style.display='block';
  // Ouvrir sur la bonne étape selon statut
  var stepMap = {depot:1,devis:3,facture:4,qr:5,cloture:5};
  repGoStep(stepMap[repDossierCourant.statut]||1);
  // Auto-verrouiller la fiche client si elle est déjà remplie
  var c = repDossierCourant.client||{};
  var clientRempli = !!(c.nom && c.tel);
  var locked = repDossierCourant._clientLocked !== false && clientRempli;
  repApplyClientLock(locked);
}

function repLoadFormFromDossier(){
  var d = repDossierCourant;
  // Step 1 — client
  var c = d.client||{};

  // Si cp/ville manquants dans le dossier (anciens dossiers), chercher dans clients[]
  if((!c.cp || !c.ville) && (c.tel || c.nom)){
    var found = clients.find(function(x){
      return (c.tel && x.tel && x.tel === c.tel) ||
             (c.nom && x.nom && x.nom.toLowerCase() === (c.nom||'').toLowerCase() &&
              x.prenom && x.prenom.toLowerCase() === (c.prenom||'').toLowerCase());
    });
    if(found){
      if(!c.cp)    c.cp    = found.cp    || '';
      if(!c.ville) c.ville = found.ville || '';
      // Sauvegarder dans le dossier pour éviter de re-chercher
      d.client = c;
    }
  }

  ['civilite','nom','prenom','tel','email','adresse','cp','ville'].forEach(function(f){
    var el=document.getElementById('rep-'+f); if(el) el.value=c[f]||'';
  });
  // Step 2 — appareil
  var a = d.appareil||{};
  ['dep-marque','dep-modele','dep-imei','dep-couleur','dep-code'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value=a[id.replace('dep-','')]||'';
  });
  var etat = Array.isArray(d.etat) ? d.etat : [];
  var etatMap = {ecran:'etat-ecran','ray-ecran':'etat-ray-ecran','ray-dos':'etat-ray-dos','vitre-dos':'etat-vitre-dos',bouton:'etat-bouton',hp:'etat-hp',micro:'etat-micro',camera:'etat-camera',charge:'etat-charge',batterie:'etat-batterie'};
  Object.keys(etatMap).forEach(function(k){
    var el = document.getElementById('dep-'+etatMap[k]); if(el) el.checked = etat.indexOf(k)>=0;
  });
  var acc = Array.isArray(d.accessoires) ? d.accessoires : [];
  ['coque','chargeur','cable','boite','verre','autre'].forEach(function(k){
    var el=document.getElementById('dep-acc-'+k); if(el) el.checked=acc.indexOf(k)>=0;
  });
  var etAlt=document.getElementById('dep-etat-autre'); if(etAlt) etAlt.value=d.etatAutre||'';
  var accAlt=document.getElementById('dep-acc-autre-txt'); if(accAlt) accAlt.value=d.accAutre||'';
  // Step 3 — devis
  // Vérifier IMEI après chargement + restaurer miniature photo
  setTimeout(function(){
    var imeiEl=document.getElementById('dep-imei');
    if(imeiEl&&imeiEl.value) repCheckIMEI(imeiEl.value);
    // Restaurer la miniature photo si elle existe
    var d2 = repDossierCourant;
    if(d2 && d2.photoImeiUrl){
      var marque = d2.appareil && d2.appareil.marque;
      repAfficherPhotoThumb(d2.photoImeiUrl, marque);
    } else {
      repAfficherPhotoThumb(null, null);
    }
  },300);
  var dp=document.getElementById('dep-panne'); if(dp) dp.value=d.panne||'';
  var dps=document.getElementById('dep-panne-select');
  if(dps && d.panne){
    var found=false;
    for(var i=0;i<dps.options.length;i++){
      if(dps.options[i].value===d.panne){dps.selectedIndex=i;found=true;break;}
    }
    if(found){ if(dp) dp.style.display='none'; }
    else { dps.value='Autre panne - voir description'; if(dp) dp.style.display='block'; }
  }
  var dd=document.getElementById('dep-devis'); if(dd) dd.value=d.devis||'';
  var dmo=document.getElementById('dep-mo-ht'); if(dmo) dmo.value=d.moHT||'';
  var dpi=document.getElementById('dep-pieces-ht'); if(dpi) dpi.value=d.piecesHT||'';
  // Ne pas appeler repCalcDevis ici — dépend du prix saisi par l'utilisateur
  var dr=document.getElementById('dep-date-retour'); if(dr) dr.value=d.dateRetour||'';
  var do2=document.getElementById('dep-obs'); if(do2) do2.value=d.obs||'';
  // Step 4 — facture
  if(d.facture){
    var f=d.facture;
    var rd=document.getElementById('r-description'); if(rd) rd.value=f.description||'';
    var rp=document.getElementById('r-prix'); if(rp) rp.value=f.prix||'';
    var rm=document.getElementById('r-mode'); if(rm) rm.value=f.mode||'CB';
    var rg=document.getElementById('r-garantie'); if(rg) rg.value=f.garantie||'3 mois';
    var rqr=document.getElementById('rep-qr-actif'); if(rqr){ rqr.checked=!!f.bonusQR; repToggleQR(); }
  }
}



// ── Mapping panne → description facture officielle ───────────
var PANNE_TO_DESCRIPTION = {
  'ecran': 'Remplacement écran',
  'casse': 'Remplacement écran (casse physique)',
  'fissu': 'Remplacement écran (casse physique)',
  'tactile': 'Remplacement écran (tactile)',
  'batterie': 'Remplacement batterie',
  'charge': 'Remplacement connecteur de charge',
  'connecteur': 'Remplacement connecteur de charge',
  'haut-parleur': 'Remplacement haut-parleur',
  'micro': 'Remplacement microphone',
  'camera': 'Remplacement caméra',
  'caméra': 'Remplacement caméra',
  'bouton': 'Remplacement bouton',
  'reseau': 'Réparation antenne réseau',
  'réseau': 'Réparation antenne réseau',
  'sim': 'Remplacement lecteur SIM',
  'wifi': 'Réparation module WiFi',
  'eau': 'Diagnostic et nettoyage dégât des eaux',
  'vitre arrière': 'Remplacement vitre arrière'
};

function repPanneToDescriptionFacture(panne){
  if(!panne) return 'Réparation smartphone';
  var p = panne.toLowerCase();
  for(var key in PANNE_TO_DESCRIPTION){
    if(p.includes(key)) return PANNE_TO_DESCRIPTION[key];
  }
  return panne; // Garder la description originale si pas de match
}

function repGetIrisLinesForFacture(){
  var panne = (document.getElementById('rep-qr-panne')||{value:''}).value;
  if(!panne || !IRIS_CODES[panne] || !IRIS_CODES[panne].irisLines) return [];
  return IRIS_CODES[panne].irisLines;
}

async function repGenererFacture(){
  if(repGenererFacture._running) return;
  repGenererFacture._running = true;
  setTimeout(function(){ repGenererFacture._running=false; }, 3000);
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier ouvert','error'); return; }

  var prix     = parseFloat((document.getElementById('r-prix')||{value:0}).value)||0;
  var panneVal = (document.getElementById('dep-panne')||{value:''}).value;
  var modele   = ((d.appareil||{}).marque||'')+' '+((d.appareil||{}).modele||'');
  var imei     = (d.appareil||{}).imei||'';
  var mode     = (document.getElementById('r-mode')||{value:'CB'}).value;
  var dossierN = (document.getElementById('r-dossier-interne')||{value:''}).value;
  var bonusQR  = (document.getElementById('rep-qr-actif')||{checked:true}).checked;

  // Description officielle pour la facture
  var descBase = repPanneToDescriptionFacture(panneVal);
  var descFull = descBase + ' ' + modele.trim();
  if(imei) descFull += ' (IMEI: '+imei+')';

  // Lignes IRIS (les 3 lignes obligatoires = les 3 "coches" Phonilab)
  var irisLines = repGetIrisLinesForFacture();

  if(!prix){ showNotif('Saisissez le prix TTC','error'); return; }

  // Sauvegarder dans le dossier
  d.facture = {
    numero: dossierN || d.numero,
    date: new Date().toISOString().split('T')[0],
    description: descFull,
    descBase: descBase,
    prix: prix,
    mode: mode,
    bonusQR: bonusQR,
    irisLines: irisLines,
    prixFinal: bonusQR ? prix - 25 : prix
  };
  d.statut = 'facture';
  repSauvegarderDossier();
  repUpdateStatutBadge();

  // Imprimer la facture
  repImprimerFacture(d);

  // Envoyer à VosFactures
  if(getVFToken() && getVFDomain()){
    var vfData = {
      date: d.facture.date,
      clientNom: (d.client.civilite||'')+' '+(d.client.prenom||'')+' '+d.client.nom,
      clientEmail: d.client.email||'',
      clientAdresse: d.client.adresse||'',
      description: descFull,
      prix: prix,
      bonusQR: bonusQR,
      irisLines: irisLines,
      mode: mode,
      dossier: d.numero||''
    };
    creerFactureVosFactures(vfData).then(function(result){
      if(result && result.id){
        d.facture.vfId  = result.id;
        d.facture.vfNum = result.number;
        d.facture.vfUrl = result.view_url;
        repSauvegarderDossier();
        showNotif('✅ Facture créée + envoyée à VosFactures !','success');
        var btnVF = document.getElementById('btn-vf-link');
        if(btnVF) btnVF.style.display='block';
      } else {
        showNotif('✅ Facture créée !','success');
      }
    });
  } else {
    showNotif('✅ Facture '+d.facture.numero+' créée !','success');
  }
  repUpdateDevisRecap();
}

function repImprimerFacture(d){
  if(!d) d = repDossierCourant;
  if(!d||!d.facture){ showNotif('Aucune facture générée pour ce dossier','error'); return; }
  var c = d.client||{};
  var a = d.appareil||{};
  var f = d.facture;

  // Extraire CP et Ville depuis l'adresse si non renseignés séparément
  // Aussi lire depuis les champs HTML (step 1) si disponibles
  if(!c.cp || !c.ville){
    var elCp    = document.getElementById('rep-cp');
    var elVille = document.getElementById('rep-ville');
    if(elCp && elCp.value)    c.cp    = elCp.value.trim();
    if(elVille && elVille.value) c.ville = elVille.value.trim();
    // Sinon extraire depuis adresse "12 rue ..., 71000 Mâcon"
    if((!c.cp || !c.ville) && c.adresse){
      var cpMatch = c.adresse.match(/(\d{5})\s+([^,]+)$/);
      if(cpMatch){ c.cp = cpMatch[1]; c.ville = cpMatch[2].trim(); }
      else {
        var parts = c.adresse.split(',');
        if(parts.length > 1){
          var rest = parts[parts.length-1].trim();
          var m2 = rest.match(/(\d{4,5})\s*(.*)/);
          if(m2){ c.cp = m2[1]; c.ville = m2[2].trim(); }
        }
      }
    }
  }
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var dateStr = new Date(f.date).toLocaleDateString('fr-FR');
  var mo   = d.moHT||25;
  var pie  = d.piecesHT||0;
  // Si bonus QR : le prix saisi = prix client final APRÈS déduction
  // Recalculer le vrai prix HT depuis le prix réel (prix client + 25€)
  var prixClient = f.prix||0;
  var prixReel   = f.bonusQR ? prixClient + 25 : prixClient;
  var ht   = Math.round(prixReel / 1.2 * 100) / 100;
  var tva  = Math.round(ht * 0.2 * 100) / 100;
  var ttc  = Math.round(ht * 1.2 * 100) / 100;
  var prixFinal = f.bonusQR ? ttc - 25 : ttc;
  // Recalculer MO/pièces depuis le prix réel
  mo  = 25;
  pie = Math.max(0, Math.round((ht - mo) * 100) / 100);

  var irisHtml = '';
  if(f.irisLines && f.irisLines.length > 0){
    irisHtml = '<tr style="background:#f0f9ff;"><td colspan="6" style="padding:6px 10px;font-size:10px;color:#0369a1;">'+
      '<b>Codes IRIS (QualiRépar) :</b> ';
    irisHtml += (f.irisLines||[]).map(function(l,i){
      return 'L'+(i+1)+': Cond.'+l.condition+' / Sym.'+l.symptom+' / Sec.'+l.section+' / Réf.'+l.repairCode;
    }).join(' | ');
    irisHtml += '</td></tr>';
  }

  var w = window.open('','_blank');
  if(!w){ showNotif('Autorisez les popups','error'); return; }
  var _tampStr = _tampStr || '';
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture '+f.numero+'</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;}'+
    '.page{width:210mm;min-height:297mm;margin:0 auto;padding:8mm 10mm;}'+
    '@media print{.no-print{display:none!important;}@page{size:A4;margin:0;}}table{border-collapse:collapse;width:100%;}'+
    'th,td{padding:6px 10px;}</style></head><body>'+
    '<div class="no-print" style="text-align:right;padding:8px;">'+
      '<button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimer</button>'+
    '</div>'+
    '<div class="page">'+
    // EN-TÊTE
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c0392b;padding-bottom:8px;margin-bottom:10px;">'+
      '<div style="display:flex;align-items:center;gap:10px;">'+
        (logo?'<img src="'+logo+'" style="height:45px;">':'')+
        '<div><div style="font-size:16px;font-weight:900;color:#c0392b;">SOLUTION PHONE</div>'+
        '<div style="font-size:10px;color:#777;line-height:1.7;">21 Rue Gambetta · 71000 Mâcon<br>03 85 33 06 89 · solution.phone71@gmail.com<br>SIREN : 801 044 785 · TVA : FR10801044785</div></div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:22px;font-weight:900;">FACTURE</div>'+
        '<div style="font-size:13px;font-weight:700;color:#c0392b;">'+f.numero+'</div>'+
        '<div style="font-size:11px;color:#888;">Date : '+dateStr+'</div>'+
      '</div>'+
    '</div>'+
    // CLIENT + APPAREIL
    '<div style="display:flex;gap:10px;margin-bottom:10px;">'+
      '<div style="flex:1;border:1.5px solid #c0392b;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#c0392b;padding:5px 10px;font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;">👤 Client</div>'+
        '<div style="padding:8px 10px;font-size:12px;line-height:1.8;">'+
          '<b>'+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'</b><br>'+
          c.tel+'<br>'+(c.email||'')+'<br>'+(c.adresse||'')+(c.cp?' · '+c.cp:'')+' '+(c.ville||'')+
        '</div>'+
      '</div>'+
      '<div style="flex:1;border:1.5px solid #333;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#333;padding:5px 10px;font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;">📱 Appareil réparé</div>'+
        '<div style="padding:8px 10px;font-size:12px;line-height:1.8;">'+
          '<b>'+a.marque+' '+a.modele+'</b><br>'+
          'IMEI : <b style="font-family:monospace;">'+(a.imei||'—')+'</b><br>'+
          'N° dossier : '+f.numero+'<br>'+
          'Mode règlement : '+f.mode+
        '</div>'+
      '</div>'+
    '</div>'+
    // TABLEAU FACTURE
    '<table style="border:1.5px solid #2b6cb0;border-radius:6px;overflow:hidden;margin-bottom:10px;">'+
      '<thead><tr style="background:#2b6cb0;color:#fff;">'+
        '<th style="text-align:left;">Description</th>'+
        '<th style="text-align:right;">P.U. HT</th>'+
        '<th style="text-align:center;">Qté</th>'+
        '<th style="text-align:right;">HT</th>'+
        '<th style="text-align:right;">TVA</th>'+
        '<th style="text-align:right;">TTC</th>'+
      '</tr></thead>'+
      '<tbody>'+
        '<tr>'+
          '<td><b>'+f.descBase+'</b><br>'+
            '<span style="font-size:10px;color:#666;">'+a.marque+' '+a.modele+(a.imei?' · IMEI '+a.imei:'')+'</span></td>'+
          '<td style="text-align:right;">'+mo.toFixed(2)+' €</td>'+
          '<td style="text-align:center;">1</td>'+
          '<td style="text-align:right;">'+ht.toFixed(2)+' €</td>'+
          '<td style="text-align:right;">'+tva.toFixed(2)+' €</td>'+
          '<td style="text-align:right;font-weight:700;">'+ttc.toFixed(2)+' €</td>'+
        '</tr>'+
        (f.bonusQR?'<tr style="background:#f0fff4;">'+
          '<td><b>Bonus Réparation QualiRépar</b><br>'+
            '<span style="font-size:10px;color:#166534;">Dispositif Loi AGEC - Remise Ecosystem/Ecologic</span></td>'+
          '<td style="text-align:right;">0,00 €</td>'+
          '<td style="text-align:center;">1</td>'+
          '<td style="text-align:right;">0,00 €</td>'+
          '<td style="text-align:right;">—</td>'+
          '<td style="text-align:right;font-weight:700;color:#c0392b;">-25,00 €</td>'+
        '</tr>':'')+
        irisHtml+
      '</tbody>'+
      '<tfoot>'+
        '<tr style="background:#f8f8f8;">'+
          '<td colspan="3"><b>Total HT : '+ht.toFixed(2)+' € · TVA 20% : '+tva.toFixed(2)+' €</b></td>'+
          '<td colspan="3" style="text-align:right;font-size:16px;font-weight:900;color:#c0392b;">NET À PAYER : '+prixFinal.toFixed(2)+' €</td>'+
        '</tr>'+
      '</tfoot>'+
    '</table>'+
    // MENTIONS
    '<div style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:6px;padding:8px 12px;font-size:10px;color:#166534;line-height:1.6;margin-bottom:10px;">'+
      '<b>Garantie réparation :</b> 3 mois sur les pièces remplacées (hors casse, oxydation, usure normale).<br>'+
      (f.bonusQR?'<b>Bonus Réparation QualiRépar :</b> -25€ déduits dans le cadre du dispositif QualiRépar (Loi AGEC n°2020-105). Appareil éligible certifié hors garantie fabricant.':'')+'</div>'+
    '<div style="display:flex;justify-content:flex-end;margin-top:12px;">'+
      '<div style="text-align:center;border:1px solid #ddd;border-radius:6px;padding:8px 16px;min-width:160px;">'+
        '<div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Cachet Solution Phone</div>'+
        (_tampStr?'<img src="'+_tampStr+'" style="max-height:65px;max-width:200px;object-fit:contain;">':'<div style="height:55px;"></div>')+
      '</div>'+
    '</div>'+
    '<div style="text-align:center;margin-top:10px;font-size:9px;color:#bbb;border-top:1px solid #eee;padding-top:8px;">'+
    'SOLUTION PHONE · RCS Mâcon B 801 044 785 · solution.phone71@gmail.com · www.solution-phone.fr'+
    '</div>'+
    '</div></body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}

function repPanneSelect(val){
  var ta = document.getElementById('dep-panne');
  if(!ta) return;
  if(val && val !== 'Autre panne - voir description'){
    ta.value = val;
    ta.style.display = 'none'; // Masquer le textarea si panne standard
  } else {
    ta.value = '';
    ta.style.display = 'block'; // Afficher pour saisie libre
    if(val === 'Autre panne - voir description') ta.focus();
  }
  // Auto-détecter la pièce Ecosystem selon la panne
  repPanneToEcosystem(val);
}

function repPanneToEcosystem(panne){
  if(!panne) return;
  var p = panne.toLowerCase();
  var piece = '';
  if(p.includes('écran') || p.includes('ecran') || p.includes('tactile')) piece = 'Écran';
  else if(p.includes('batterie') || p.includes('éteint')) piece = 'Batterie';
  else if(p.includes('connecteur') || p.includes('charge')) piece = 'Connecteur de charge';
  else if(p.includes('haut-parleur') || p.includes('son')) piece = 'Haut-parleur';
  else if(p.includes('micro')) piece = 'Micro';
  else if(p.includes('caméra') || p.includes('camera')) piece = 'Caméra';
  else if(p.includes('bouton')) piece = 'Bouton';
  // Pré-sélectionner la pièce dans le select Pièce à commander
  var sel = document.getElementById('dep-piece');
  if(sel && piece){
    sel.value = piece;
  }
}

function repClearForm(){
  ['rep-nom','rep-prenom','rep-tel','rep-email','rep-adresse','rep-cp','rep-ville'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var civ=document.getElementById('rep-civilite'); if(civ) civ.value='M.';
  ['dep-marque','dep-modele','dep-imei','dep-couleur','dep-code','dep-etat-autre','dep-acc-autre-txt','dep-panne','dep-devis','dep-date-retour','dep-obs','r-description','r-prix','dep-mo-ht','dep-pieces-ht'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  ['dep-acc-coque','dep-acc-chargeur','dep-acc-cable','dep-acc-boite','dep-acc-verre','dep-acc-autre','dep-etat-ecran','dep-etat-ray-ecran','dep-etat-ray-dos','dep-etat-vitre-dos','dep-etat-bouton','dep-etat-hp','dep-etat-micro','dep-etat-camera','dep-etat-charge','dep-etat-batterie'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.checked=false;
  });
  var qr=document.getElementById('rep-qr-actif'); if(qr){ qr.checked=false; if(typeof repToggleQR==='function') repToggleQR(); }
}



// Met à jour le label organisme dans la miniature photo quand la marque change
function repMajOrganismePhoto(){
  if(!repDossierCourant) return;
  var marqueEl = document.getElementById('dep-marque');
  var marque = marqueEl ? marqueEl.value : '';
  var org = document.getElementById('dep-photo-org');
  if(!org) return;
  if(!marque){ org.textContent = 'Prête pour QualiRépar'; org.style.color='#16a34a'; return; }
  var ecosystemBrands = ['Samsung','Huawei','Oppo','Honor','Blackview','Vivo','TCL'];
  var isEco = ecosystemBrands.indexOf(marque) >= 0;
  org.textContent = isEco ? '🟢 Prête pour Ecosystem' : '🔵 Prête pour Ecologic';
  org.style.color  = isEco ? '#16a34a' : '#2563eb';
}

// ── Miniature photo IMEI ─────────────────────────────────────
function repAfficherPhotoThumb(url, marque){
  var empty = document.getElementById('dep-photo-empty');
  var thumb = document.getElementById('dep-photo-thumb');
  var img   = document.getElementById('dep-photo-img');
  var link  = document.getElementById('dep-photo-link');
  var org   = document.getElementById('dep-photo-org');
  if(!empty || !thumb || !img) return;
  if(url){
    img.src  = url;
    if(link) link.href = url;
    // Indiquer l'organisme selon QR_BRAND_TYPE (source de vérité)
    if(org){
      var orgType = (typeof QR_BRAND_TYPE !== 'undefined' && marque) ? QR_BRAND_TYPE[marque] : null;
      var isEcosystem = orgType === 'ecosystem';
      org.textContent = isEcosystem ? '🟢 Prête pour Ecosystem' : '🔵 Prête pour Ecologic';
      org.style.color  = isEcosystem ? '#16a34a' : '#2563eb';
    }
    empty.style.display = 'none';
    thumb.style.display = 'block';
  } else {
    empty.style.display = 'flex';
    thumb.style.display = 'none';
    img.src = '';
  }
}

function repSupprimerPhotoImei(){
  if(!repDossierCourant) return;
  if(!confirm('Supprimer la photo IMEI ?')) return;
  repDossierCourant.photoImeiUrl = null;
  repAfficherPhotoThumb(null, null);
  repSauvegarderDossier();
  showNotif('Photo supprimée','success');
}
// ──────────────────────────────────────────────────────────────

// ── VERROU FICHE CLIENT ────────────────────────────────────────────
var REP_CLIENT_FIELDS = ['rep-civilite','rep-nom','rep-prenom','rep-tel','rep-email','rep-adresse','rep-cp','rep-ville'];

function repApplyClientLock(locked){
  REP_CLIENT_FIELDS.forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    if(locked){
      el.setAttribute('readonly','');
      if(el.tagName==='SELECT') el.setAttribute('disabled','');
      el.style.background = 'var(--bg-secondary,#f8f9fa)';
      el.style.color = '#374151';
      el.style.webkitTextFillColor = '#374151'; // iOS Safari fix
      el.style.opacity = '1'; // iOS Safari fix
      el.style.cursor = 'not-allowed';
      el.style.pointerEvents = 'none';
    } else {
      el.removeAttribute('readonly');
      el.removeAttribute('disabled');
      el.style.background = '';
      el.style.color = '';
      el.style.webkitTextFillColor = '';
      el.style.opacity = '';
      el.style.cursor = '';
      el.style.pointerEvents = '';
    }
  });
  var banner  = document.getElementById('rep-client-locked-banner');
  var btnVal  = document.getElementById('rep-btn-valider-client');
  var btnMod  = document.getElementById('rep-btn-modifier-client');
  var btnValB = document.getElementById('rep-btn-valider-client-bottom');
  if(banner)  banner.style.display  = locked ? 'block' : 'none';
  if(btnVal)  btnVal.style.display  = locked ? 'none'  : 'inline-flex';
  if(btnMod)  btnMod.style.display  = locked ? 'inline-flex' : 'none';
  if(btnValB) btnValB.style.display = locked ? 'none'  : '';
  if(repDossierCourant) repDossierCourant._clientLocked = locked;
}

function repValiderClient(){
  if(repDossierCourant && repCurrentStep === 1){
    var c = repDossierCourant.client || {};
    ['nom','prenom','tel','email','adresse','cp','ville'].forEach(function(k){
      var el = document.getElementById('rep-'+k); if(el) c[k] = el.value.trim();
    });
    var civ = document.getElementById('rep-civilite'); if(civ) c.civilite = civ.value;
    repDossierCourant.client = c;
  }
  repSauvegarderDossier(); // ← persiste immédiatement dans bons_depot
  repApplyClientLock(true);
  showNotif('✅ Fiche client verrouillée','success');
}

function repModifierClient(){
  repApplyClientLock(false);
  setTimeout(function(){ var el=document.getElementById('rep-nom'); if(el) el.focus(); },100);
}
// ───────────────────────────────────────────────────────────────────

// ── Debounce repAutoSave pour iPad (évite freeze sur textareas) ──
var _repAutoSaveTimer = null;
function repAutoSaveDebounced(){
  clearTimeout(_repAutoSaveTimer);
  _repAutoSaveTimer = setTimeout(repAutoSave, 250);
}

// Debounce eligibilite (iPad friendly – évite le freeze)
var _repEligTimer = null;
function repCheckEligibiliteDebounced(){
  clearTimeout(_repEligTimer);
  _repEligTimer = setTimeout(repCheckEligibilite, 400);
}

function repAutoSave(){
  if(!repDossierCourant) return;
  // Lire client UNIQUEMENT sur step 1 — fusion douce : jamais écraser une valeur existante par vide
  if(repCurrentStep === 1){
    var prev = repDossierCourant.client || {};
    var getV = function(id){ var el=document.getElementById(id); return el ? el.value.trim() : ''; };
    repDossierCourant.client = {
      civilite: (document.getElementById('rep-civilite')||{value:''}).value || prev.civilite || 'M.',
      nom:      getV('rep-nom')     || prev.nom     || '',
      prenom:   getV('rep-prenom')  || prev.prenom  || '',
      tel:      getV('rep-tel')     || prev.tel     || '',
      email:    getV('rep-email')   || prev.email   || '',
      adresse:  getV('rep-adresse') || prev.adresse || '',
      cp:       getV('rep-cp')      || prev.cp      || '',
      ville:    getV('rep-ville')   || prev.ville   || ''
    };
  } // fin if(repCurrentStep === 1)
  // Lire appareil
  repDossierCourant.appareil = {
    marque:  (document.getElementById('dep-marque')||{value:''}).value,
    modele:  (document.getElementById('dep-modele')||{value:''}).value.trim(),
    imei:    (document.getElementById('dep-imei')||{value:''}).value.trim(),
    couleur: (document.getElementById('dep-couleur')||{value:''}).value.trim(),
    code:    (document.getElementById('dep-code')||{value:''}).value.trim()
  };
  repDossierCourant.panne      = (document.getElementById('dep-panne')||{value:''}).value.trim();
  repDossierCourant.devis      = parseFloat((document.getElementById('dep-devis')||{value:0}).value)||0;
  repDossierCourant.dateRetour = (document.getElementById('dep-date-retour')||{value:''}).value;
  repDossierCourant.obs        = (document.getElementById('dep-obs')||{value:''}).value.trim();
  repDossierCourant.etat       = getDepotEtat();
  repDossierCourant.accessoires= getDepotAccessoires();
  repDossierCourant.etatAutre  = (document.getElementById('dep-etat-autre')||{value:''}).value.trim();
  repDossierCourant.accAutre   = (document.getElementById('dep-acc-autre-txt')||{value:''}).value.trim();
  // Rafraîchir le récap step 3 si visible
  if(repCurrentStep===3) repUpdateDevisRecap();
}

function repGoStep(n){
  // Sauvegarder le step courant avant de changer (remplace l'autosave temps réel)
  if(repDossierCourant && typeof _repGoStepSave === 'function') _repGoStepSave();
  repCurrentStep = n;
  [1,2,3,4,5].forEach(function(i){
    var s=document.getElementById('rep-step-'+i);
    var b=document.getElementById('rep-step-btn-'+i);
    if(s) s.style.display = i===n?'block':'none';
    if(b){
      b.classList.remove('active','done');
      if(i===n) b.classList.add('active');
      else if(i<n) b.classList.add('done');
    }
  });
  // Recharger les champs client au retour sur le step 1
  if(n===1 && repDossierCourant){
    var c = repDossierCourant.client||{};
    ['civilite','nom','prenom','tel','email','adresse','cp','ville'].forEach(function(f){
      var el=document.getElementById('rep-'+f); if(el) el.value=c[f]||'';
    });
    var clientRempli = !!(c.nom && c.tel);
    var locked = repDossierCourant._clientLocked !== false && clientRempli;
    repApplyClientLock(locked);
  }
  if(n===3) repUpdateDevisRecap();
  if(n===4){ setTimeout(repAutoFillStep4, 400); repUpdateFacturePreview(); }
  if(n===5) repUpdateStep5();
}


function repUpdateStep5(){
  var d = repDossierCourant;
  if(!d) return;

  var f = d.facture||{};
  var bonusQR = f.bonusQR || (document.getElementById('rep-qr-actif')||{checked:false}).checked;

  var noBonus  = document.getElementById('rep-qr-no-bonus');
  var qrRecap  = document.getElementById('rep-qr-recap');
  var qrActions= document.getElementById('rep-qr-actions');

  if(!bonusQR){
    if(noBonus)  noBonus.style.display  = 'block';
    if(qrRecap)  qrRecap.style.display  = 'none';
    if(qrActions)qrActions.style.display= 'none';
    return;
  }

  // Bonus QR actif → afficher récap
  if(noBonus)  noBonus.style.display  = 'none';
  if(qrRecap)  qrRecap.style.display  = 'block';
  if(qrActions)qrActions.style.display= 'block';

  // Afficher lien VosFactures si disponible
  var btnVF = document.getElementById('btn-vf-link');
  if(btnVF) btnVF.style.display = (f.vfUrl) ? 'block' : 'none';

  // Organisme selon la marque
  var marque = (d.appareil||{}).marque||'';
  var organisme = (QR_BRAND_TYPE && QR_BRAND_TYPE[marque] === 'ecosystem') ? 'Ecosystem' : 'Ecologic';
  var btnLabel = document.getElementById('rep-qr-btn-label');
  if(btnLabel) btnLabel.textContent = organisme;

  // Récap dossier final
  var recap = document.getElementById('rep-dossier-recap-final');
  if(recap){
    var c = d.client||{};
    var a = d.appareil||{};
    var html2 = '<b>Client :</b> '+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'<br>'+
      '<b>Tél :</b> '+(c.tel||'—')+'<br>'+
      '<b>Appareil :</b> '+a.marque+' '+a.modele+'<br>'+
      '<b>IMEI :</b> '+(a.imei||'—')+'<br>'+
      '<b>Panne :</b> '+(d.panne||'—')+'<br>'+
      '<b>N° dossier :</b> '+(d.numero||'—')+'<br>'+
      '<b>Prix payé par le client :</b> '+((f.prix||0).toFixed(2))+' € TTC<br>'+
      '<b>Organisme :</b> '+organisme+'<br>'+
      (d.photoImeiUrl?'<b>📷 Photo IMEI :</b> <a href="'+d.photoImeiUrl+'" target="_blank">Voir</a><br>':'<b>📷 Photo IMEI :</b> <span style="color:var(--warning);">Non prise</span><br>')+
      (d.qrEnvoi?'<b>Envoi :</b> ✅ Dossier envoyé':'<b>Envoi :</b> En attente');
    recap.innerHTML = html2;
  }

  // Checklist pré-envoi
  if(qrRecap){
    var a = d.appareil||{};
    var imeiOk  = a.imei && a.imei.replace(/\s/g,'').length === 15;
    var panneOk = !!(d.panne && d.panne.trim());
    var devisOk = !!(d.devis && d.devis > 0);
    var photoOk = !!d.photoImeiUrl;
    var sigOk   = !!(d.signature || d.facture);
    var orgKey  = organisme === 'Ecosystem' ? 'ecoRepairerId' : 'ecologicToken';
    var credOk  = !!(typeof PARAMS_KEYS !== 'undefined' && localStorage.getItem(PARAMS_KEYS[orgKey]));

    var allOk = imeiOk && panneOk && devisOk && photoOk && sigOk && credOk;

    function chk(ok, label){ 
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">'
        +(ok ? '<span style="color:#16a34a;font-size:16px;">✅</span>' : '<span style="color:#dc2626;font-size:16px;">❌</span>')
        +'<span style="font-size:13px;color:'+(ok?'#166534':'#dc2626')+';">'+label+'</span>'
        +'</div>';
    }

    var orgColor = organisme === 'Ecosystem' ? '#16a34a' : '#2563eb';
    qrRecap.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:8px;color:'+orgColor+';">'
      +(organisme === 'Ecosystem' ? '🟢' : '🔵')+' Envoi vers '+organisme+'</div>'
      +chk(imeiOk,  'IMEI valide (15 chiffres)'+(imeiOk?' — '+a.imei:''))
      +chk(panneOk, 'Panne renseignée'+(panneOk?' — '+(d.panne.length>40?d.panne.substring(0,40)+'…':d.panne):''))
      +chk(devisOk, 'Devis saisi'+(devisOk?' — '+d.devis.toFixed(2)+' € TTC':''))
      +chk(photoOk, 'Photo IMEI / plaque signalétique')
      +chk(sigOk,   'Signature client + facture')
      +chk(credOk,  'Identifiants '+organisme+' configurés')
      +(allOk
        ? '<div style="margin-top:10px;padding:8px 12px;background:#f0fdf4;border-radius:8px;border:1px solid #22c55e;font-size:13px;font-weight:700;color:#166534;">✅ Dossier complet — prêt à envoyer</div>'
        : '<div style="margin-top:10px;padding:8px 12px;background:#fef2f2;border-radius:8px;border:1px solid #fca5a5;font-size:13px;font-weight:700;color:#dc2626;">❌ Compléter les points manquants avant envoi</div>'
      );
    
    // Désactiver le bouton si pas prêt
    var btnEnvoyer = document.querySelector('[onclick="repEnvoyerOrganisme()"]');
    if(btnEnvoyer){
      btnEnvoyer.disabled = !allOk;
      btnEnvoyer.style.opacity = allOk ? '1' : '0.5';
      btnEnvoyer.style.cursor = allOk ? 'pointer' : 'not-allowed';
    }
  }
}

function repUpdateStatutBadge(){
  var badge = document.getElementById('rep-dossier-statut-badge');
  if(!badge||!repDossierCourant) return;
  if(typeof REP_STATUTS === 'undefined') return;
  var s = (typeof REP_STATUTS !== 'undefined' ? REP_STATUTS[repDossierCourant.statut||'depot'] : null) || {label: repDossierCourant.statut||'depot', cls: 'rep-s-depot'};
  badge.innerHTML = '';
  var span = document.createElement('span');
  span.className = 'rep-status-badge ' + (s ? s.cls : '');
  span.textContent = s ? s.label : '';
  badge.appendChild(span);
}

function repStep1Next(){
  if(!repDossierCourant) return;

  // Lire DIRECTEMENT les champs HTML maintenant (synchrone, avant que les champs soient cachés)
  var civilite = (document.getElementById('rep-civilite')||{value:''}).value;
  var nom      = (document.getElementById('rep-nom')||{value:''}).value.trim();
  var prenom   = (document.getElementById('rep-prenom')||{value:''}).value.trim();
  var tel      = (document.getElementById('rep-tel')||{value:''}).value.trim();
  var email    = (document.getElementById('rep-email')||{value:''}).value.trim();
  var adresse  = (document.getElementById('rep-adresse')||{value:''}).value.trim();
  var cp       = (document.getElementById('rep-cp')||{value:''}).value.trim();
  var ville    = (document.getElementById('rep-ville')||{value:''}).value.trim();

  // Validation
  if(!civilite){ showNotif('⚠️ Sélectionnez M. ou Mme','error'); return; }
  if(!nom){ showNotif('⚠️ Le nom est obligatoire','error'); return; }
  if(!prenom){ showNotif('⚠️ Le prénom est obligatoire','error'); return; }
  if(!tel || tel.replace(/\s/g,'').length < 10){ showNotif('⚠️ Téléphone invalide (min. 10 chiffres)','error'); return; }

  // Sauvegarder IMMÉDIATEMENT dans repDossierCourant (synchrone)
  repDossierCourant.client = {
    civilite: civilite, nom: nom, prenom: prenom,
    tel: tel, email: email, adresse: adresse,
    cp: cp, ville: ville
  };

  repSauvegarderClientSupabase(repDossierCourant.client);
  repSauvegarderDossier(); // ← persiste adresse/cp/ville dans bons_depot Supabase
  repApplyClientLock(true); // verrouiller la fiche au passage au step suivant
  repGoStep(2);
}


function repSauvegarderClientManuel(){
  if(!repDossierCourant) return;

  // Lire les champs directement
  var c = {
    civilite: (document.getElementById('rep-civilite')||{value:''}).value,
    nom:      (document.getElementById('rep-nom')||{value:''}).value.trim(),
    prenom:   (document.getElementById('rep-prenom')||{value:''}).value.trim(),
    tel:      (document.getElementById('rep-tel')||{value:''}).value.trim(),
    email:    (document.getElementById('rep-email')||{value:''}).value.trim(),
    adresse:  (document.getElementById('rep-adresse')||{value:''}).value.trim(),
    cp:       (document.getElementById('rep-cp')||{value:''}).value.trim(),
    ville:    (document.getElementById('rep-ville')||{value:''}).value.trim()
  };
}

function repSauvegarderClientManuel(){
  if(!repDossierCourant) return;
  var c = {
    civilite: (document.getElementById('rep-civilite')||{value:''}).value,
    nom:      (document.getElementById('rep-nom')||{value:''}).value.trim(),
    prenom:   (document.getElementById('rep-prenom')||{value:''}).value.trim(),
    tel:      (document.getElementById('rep-tel')||{value:''}).value.trim(),
    email:    (document.getElementById('rep-email')||{value:''}).value.trim(),
    adresse:  (document.getElementById('rep-adresse')||{value:''}).value.trim(),
    cp:       (document.getElementById('rep-cp')||{value:''}).value.trim(),
    ville:    (document.getElementById('rep-ville')||{value:''}).value.trim()
  };
  if(!c.nom){ showNotif('⚠️ Le nom est obligatoire','error'); return; }
  repDossierCourant.client = c;
  repSauvegarderClientSupabase(c).then(function(){
    syncClientsFromSupabase();
  });
  showNotif('💾 Client enregistré !','success');
}

async function repSauvegarderClientSupabase(c){
  if(!supabaseReady || !c.nom) return;
  try {
    // Vérifier si le client existe déjà (par tél ou email)
    var query = '';
    if(c.tel) query = '?tel=eq.'+encodeURIComponent(c.tel)+'&limit=1';
    else if(c.email) query = '?email=eq.'+encodeURIComponent(c.email)+'&limit=1';
    
    if(query){
      var existing = await supaFetch('clients','GET',null,query);
      if(existing && existing.length > 0){
        // Mettre à jour
        var id = existing[0].id;
        await supaFetch('clients','PATCH',{
          nom: c.nom, prenom: c.prenom||'', civilite: c.civilite||'',
          tel: c.tel||'', email: c.email||'',
          adresse: c.adresse||'', cp: c.cp||'', ville: c.ville||''
        },'?id=eq.'+id);
        // Mettre à jour aussi dans la liste locale
        var idx = clients.findIndex(function(x){ return String(x.id)===String(id); });
        if(idx>=0) Object.assign(clients[idx], c);
        showNotif('👤 Client mis à jour','success');
        return;
      }
    }
    // Créer nouveau client
    var newClient = {
      nom: c.nom, prenom: c.prenom||'', civilite: c.civilite||'',
      tel: c.tel||'', email: c.email||'',
      adresse: c.adresse||'', cp: c.cp||'', ville: c.ville||'',
      notes: 'Créé via réparation'
    };
    var result = await supaFetch('clients','POST',newClient,'');
    if(result && result[0]){
      clients.push(result[0]);
      showNotif('👤 Client sauvegardé dans la base','success');
    }
  } catch(e){
    console.warn('repSauvegarderClientSupabase:', e);
  }
}

function repStep2Next(){
  repAutoSave(); // lit tous les champs step 2
  var a=repDossierCourant.appareil;
  if(!a.marque||!a.modele){showNotif('⚠️ Marque et Modèle sont obligatoires','error');return;}
  if(!a.imei || a.imei.replace(/\s/g,'').length !== 15){showNotif('⚠️ IMEI invalide — 15 chiffres requis','error');return;}
  // Rappel photo IMEI si pas encore prise
  if(!repDossierCourant.photoImeiUrl && a.imei){
    showNotif('💡 Pensez à prendre la photo de la plaque signalétique (bouton 📷 OCR) pour Ecosystem !','success');
  }
  repSauvegarderDossier(); // persiste l'appareil/panne/devis
  repGoStep(3);
}

function repAutoFillStep4(){
  var d = repDossierCourant;
  console.log('=== repAutoFillStep4 ===', d ? d.numero : 'PAS DE DOSSIER');
  if(!d) return;

  // N° dossier
  var el = document.getElementById('r-dossier-interne');
  console.log('r-dossier-interne:', el ? 'OK' : 'INTROUVABLE');
  if(el) el.value = d.numero || '';
  console.log('numero:', d.numero, '| devis:', d.devis, '| panne:', d.panne);

  // Ref mobile
  repGenereRefMobile();

  // Prix depuis devis
  var prix = d.devis || parseFloat((document.getElementById('dep-devis')||{value:0}).value)||0;
  var rPrix = document.getElementById('r-prix');
  if(rPrix) rPrix.value = prix > 0 ? prix.toFixed(2) : '';

  // Description officielle
  var panne = d.panne || (document.getElementById('dep-panne')||{value:''}).value || '';
  if(!panne){ var ps = document.getElementById('dep-panne-select'); if(ps) panne = ps.value; }
  var appareil = ((d.appareil||{}).marque||'')+' '+((d.appareil||{}).modele||'');
  var desc = panne ? repPanneToDescriptionFacture(panne)+' '+appareil.trim() : '';
  var rDesc = document.getElementById('r-description');
  if(rDesc) rDesc.value = desc;

  // QR coché
  var qr = document.getElementById('rep-qr-actif');
  if(qr){ qr.checked = true; if(typeof repToggleQR==='function') repToggleQR(); }

  // Marque IRIS — appel sécurisé
  repQRPopulateMarques();
  setTimeout(function(){
    if(typeof repQRAutoPanne==='function') repQRAutoPanne();
  }, 400);
}

function repStep3Next(){
  repAutoSave();
  if(!repDossierCourant.panne){showNotif('Décrivez la panne','error');return;}
  if(!repDossierCourant.devis||repDossierCourant.devis<=0){showNotif('Saisissez le prix TTC du devis','error');return;}
  if(!repDossierCourant.signature){
    showNotif('💡 Pas de signature — continuez','success');
  }
  repGenererDevisPDF();
  repSauvegarderDossier();
  repGoStep(4);
  // Remplir directement APRÈS avoir changé de step
  setTimeout(repAutoFillStep4, 300);
}

function repGenererDevisPDF(){
  // Générer le HTML du devis et le stocker en base64 dans le dossier
  // sans ouvrir de fenêtre — juste pour l'envoi Ecosystem
  var d = repDossierCourant;
  if(!d) return;
  if(!d.etat || !Array.isArray(d.etat)) d.etat = [];
  if(!d.accessoires || !Array.isArray(d.accessoires)) d.accessoires = [];
  if(!d.panne) d.panne = (document.getElementById('dep-panne')||{value:''}).value||'';
  if(!d.devis) d.devis = parseFloat((document.getElementById('dep-devis')||{value:0}).value)||0;
  if(!d.moHT) d.moHT = parseFloat((document.getElementById('dep-mo-ht')||{value:0}).value)||0;
  if(!d.piecesHT) d.piecesHT = parseFloat((document.getElementById('dep-pieces-ht')||{value:0}).value)||0;
  // Marquer le devis comme généré avec la date et les données
  d.devisGenere = {
    date: new Date().toISOString(),
    prix: d.devis,
    moHT: d.moHT,
    piecesHT: d.piecesHT,
    panne: d.panne,
    photoImeiUrl: d.photoImeiUrl||null
  };
  showNotif('✅ Devis sauvegardé pour Ecosystem','success');
}

function repStep4Next(){
  // Valider les champs obligatoires pour l'envoi AgoraPlus
  var prix = parseFloat((document.getElementById('r-prix')||{value:0}).value)||0;
  if(!prix){ showNotif('Renseignez le prix TTC','error'); return; }
  var bonusQR = (document.getElementById('rep-qr-actif')||{checked:false}).checked;
  if(bonusQR){
    var marque = (document.getElementById('rep-qr-marque')||{value:''}).value;
    var panne  = (document.getElementById('rep-qr-panne')||{value:''}).value;
    if(!marque || !panne){ showNotif('Sélectionnez la marque et le type de panne pour le bonus QR','error'); return; }
    var imei = repDossierCourant && repDossierCourant.appareil && repDossierCourant.appareil.imei;
    if(!imei){ showNotif('IMEI obligatoire pour le bonus QR — retournez à l\'étape 2','error'); return; }
    var cp = repDossierCourant && repDossierCourant.client && repDossierCourant.client.cp;
    if(!cp){ showNotif('Code postal obligatoire pour le bonus QR — retournez à l\'étape 1','error'); return; }
  }
  repUpdateChecklist();
  repGoStep(5);
}

// Debounce Supabase save (évite un appel réseau à chaque frappe sur iPad)
var _repSupaSaveTimer = null;
function repSauvegarderSupabaseDebounced(depot){
  clearTimeout(_repSupaSaveTimer);
  _repSupaSaveTimer = setTimeout(function(){ saveBonDepotSupabase(depot); }, 2000);
}

function repSauvegarderDossier(){
  if(!repDossierCourant) return;

  var idx = repDossiers.findIndex(function(d){ return String(d.id)===String(repDossierCourant.id); });
  if(idx>=0){ repDossiers[idx]=JSON.parse(JSON.stringify(repDossierCourant)); }
  else { repDossiers.push(JSON.parse(JSON.stringify(repDossierCourant))); }
  // Sync avec bonsDepot pour compatibilité
  var depot = {
    id: repDossierCourant.id, numero: repDossierCourant.numero,
    date: repDossierCourant.date, statut: repDossierCourant.statut,
    client: repDossierCourant.client,
    appareil: repDossierCourant.appareil,
    etat: repDossierCourant.etat, etatAutre: repDossierCourant.etatAutre,
    accessoires: repDossierCourant.accessoires, accAutre: repDossierCourant.accAutre,
    panne: repDossierCourant.panne, devis: repDossierCourant.devis,
    dateRetour: repDossierCourant.dateRetour, obs: repDossierCourant.obs,
    facture: repDossierCourant.facture, qrEnvoi: repDossierCourant.qrEnvoi
  };
  var bidx = bonsDepot.findIndex(function(d){ return String(d.id)===String(depot.id); });
  if(bidx>=0) bonsDepot[bidx]=depot; else bonsDepot.push(depot);
  saveBonsDepot();
  repSauvegarderSupabaseDebounced(depot); // debounced - évite spam réseau sur iPad
}

function repSearchClient(q){
  var box = document.getElementById('rep-client-results');
  if(!box) return;
  if(!q||q.length<2){
    box.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:8px;">Tapez au moins 2 caractères</div>';
    return;
  }

  // Cache local en premier (rapide)
  var results = clients.filter(function(c){
    var full = ((c.prenom||'')+' '+(c.nom||'')).toLowerCase();
    var full2 = ((c.nom||'')+' '+(c.prenom||'')).toLowerCase();
    return full.includes(q.toLowerCase())||full2.includes(q.toLowerCase())||(c.tel||'').includes(q);
  }).slice(0,8);

  if(results.length>0){ repAfficherResultatsClients(results,box); return; }

  // Sinon : chercher dans Supabase directement (sans tout charger)
  box.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:8px;">🔍 Recherche...</div>';
  var qp = encodeURIComponent(q);
  supaFetch('clients','GET',null,'?select=id,nom,prenom,civilite,tel,email,adresse,cp,ville,notes&or=(nom.ilike.*'+qp+'*,prenom.ilike.*'+qp+'*,tel.ilike.*'+qp+'*)&limit=8')
  .then(function(res){
    if(res&&res.length>0){
      res.forEach(function(x){
        if(!clients.find(function(c){return c.id===x.id;})){
          clients.push({id:x.id,nom:x.nom||'',prenom:x.prenom||'',tel:x.tel||'',email:x.email||'',adresse:x.adresse||'',cp:x.cp||'',ville:x.ville||'',notes:x.notes||'',civilite:x.civilite||''});
        }
      });
      repAfficherResultatsClients(res.map(function(x){
        return{id:x.id,nom:x.nom||'',prenom:x.prenom||'',tel:x.tel||'',email:x.email||''};
      }),box);
    } else {
      box.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:8px;">Aucun client trouvé</div>';
    }
  }).catch(function(){
    box.innerHTML='<div style="color:var(--text-muted);font-size:12px;padding:8px;">Aucun client trouvé</div>';
  });
}

function repAfficherResultatsClients(results,box){
  box.innerHTML='';
  results.forEach(function(c){
    var div=document.createElement('div');
    div.style.cssText='padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px;';
    div.onmouseover=function(){this.style.background='#f8fafc';};
    div.onmouseout=function(){this.style.background='';};
    var nom=document.createElement('b'); nom.textContent=(c.prenom?c.prenom+' ':'')+c.nom;
    var info=document.createElement('span'); info.style.cssText='color:var(--text-muted);display:block;font-size:12px;';
    info.textContent=(c.tel||'—')+' · '+(c.email||'—');
    div.appendChild(nom); div.appendChild(info);
    div.onclick=(function(id){return function(){repSelectClient(id);};})(c.id);
    box.appendChild(div);
  });
}

function repSelectClient(id){
  var c = clients.find(function(x){ return String(x.id)===String(id); });
  if(!c) return;
  // Remplir tous les champs client incluant cp et ville
  var elNom    = document.getElementById('rep-nom');    if(elNom)    elNom.value    = c.nom||'';
  var elPrenom = document.getElementById('rep-prenom'); if(elPrenom) elPrenom.value = c.prenom||'';
  var elTel    = document.getElementById('rep-tel');    if(elTel)    elTel.value    = c.tel||'';
  var elEmail  = document.getElementById('rep-email');  if(elEmail)  elEmail.value  = c.email||'';
  var elCiv    = document.getElementById('rep-civilite'); if(elCiv)  elCiv.value    = c.civilite||'M.';
  var elAdr    = document.getElementById('rep-adresse'); if(elAdr)   elAdr.value    = c.adresse||'';
  // CP et Ville — depuis les colonnes séparées en priorité
  var cpVal    = c.cp||'';
  var villeVal = c.ville||'';
  // Si pas de cp/ville séparés → extraire depuis adresse
  if(!cpVal && c.adresse){
    var cpM = c.adresse.match(/(\d{4,5})\s+([\w\s-]+)$/);
    if(cpM){ cpVal = cpM[1]; villeVal = villeVal || cpM[2].trim(); }
  }
  var elCP     = document.getElementById('rep-cp');    if(elCP)    elCP.value    = cpVal;
  var elVille  = document.getElementById('rep-ville'); if(elVille) elVille.value = villeVal;
  // Sauvegarder DIRECTEMENT dans repDossierCourant.client sans passer par le DOM
  if(repDossierCourant){
    repDossierCourant.client = {
      civilite: c.civilite||'M.',
      nom:      c.nom||'',
      prenom:   c.prenom||'',
      tel:      c.tel||'',
      email:    c.email||'',
      adresse:  c.adresse||'',
      cp:       cpVal,
      ville:    villeVal
    };
  }
  repAutoSave();
  showNotif('👤 '+(c.prenom||'')+' '+(c.nom||'')+' chargé','success');
  return;
  // Code legacy ci-dessous (non exécuté)
  if(c.adresse){
    var parts=c.adresse.split(',');
    var rue=parts[0]?parts[0].trim():'';
    var rest=parts[1]?parts[1].trim():'';
    var cpMatch=rest.match(/^(\d{4,5})\s*(.*)/);
    var elA=document.getElementById('rep-adresse'); if(elA) elA.value=rue;
    var elCP=document.getElementById('rep-cp'); if(elCP) elCP.value=cpMatch?cpMatch[1]:'';
    var elV=document.getElementById('rep-ville'); if(elV) elV.value=cpMatch?cpMatch[2].trim():rest;
  }
  repAutoSave();

  // Afficher historique réparations
  var searchKey = (c.prenom?c.prenom+' ':'')+c.nom;
  var hist = getHistoriqueClient(searchKey);
  if(!hist.length && c.tel) hist = getHistoriqueClient(c.tel);

  var box = document.getElementById('rep-client-results');
  var html2 = '<div style="background:#f0fdf4;padding:10px 12px;border-radius:8px;font-size:13px;color:var(--green);margin-bottom:8px;">✅ '+(c.prenom?c.prenom+' ':'')+c.nom+' chargé</div>';
  if(hist.length > 0){
    html2 += '<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">🔧 '+hist.length+' réparation(s) précédente(s) :</div>';
    html2 += '<div style="max-height:180px;overflow-y:auto;">';
    hist.slice(0,10).forEach(function(r){
      html2 += '<div style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px;">'+
        '<b>'+(r.modele||r.appareil||'—')+'</b> · '+(r.date_rep||'').substring(0,10)+
        ' · <span style="color:var(--green);">'+(r.statut||'—')+'</span>'+
        ' <span style="float:right;font-size:11px;color:var(--text-muted);">'+(r.numero||'')+'</span></div>';
    });
    html2 += '</div>';
  }
  box.innerHTML = html2;
  showNotif('Client chargé : '+(c.prenom||'')+' '+c.nom+(hist.length?' · '+hist.length+' réparations':''),'success');
}

function repUpdateDevisRecap(){
  var d = repDossierCourant;
  if(!d) return;
  var box=document.getElementById('rep-devis-recap');
  if(!box) return;
  var c=d.client||{};
  var a=d.appareil||{};
  var f=d.facture||null;
  box.innerHTML=
    '<b>Client :</b> '+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'<br>'+
    '<b>Tél :</b> '+(c.tel||'—')+'<br>'+
    '<b>Appareil :</b> '+a.marque+' '+a.modele+(a.imei?'<br><b>IMEI :</b> '+a.imei:'')+'<br>'+
    '<b>Panne :</b> '+(d.panne||'—')+'<br>'+
    '<b>Devis TTC :</b> '+(d.devis?d.devis.toFixed(2)+' € TTC':'Non renseigné')+'<br>'+
    (f?'<b>Facture :</b> '+f.numero+' · '+(f.bonusQR?f.prix-25:f.prix)+' € TTC':'');
  // QR recap
  // Afficher lien VosFactures si dossier a un ID VF
  var btnVF = document.getElementById('btn-vf-link');
  if(btnVF) btnVF.style.display = (d.facture&&d.facture.vfId)?'block':'none';
  var qrRecap=document.getElementById('rep-qr-recap');
  var qrNo=document.getElementById('rep-qr-no-bonus');
  var qrActions=document.getElementById('rep-qr-actions');
  if(f&&f.bonusQR){
    if(qrNo) qrNo.style.display='none';
    if(qrActions) qrActions.style.display='block';
    var marque=(document.getElementById('rep-qr-marque')||{value:''}).value;
    var type=QR_BRAND_TYPE&&QR_BRAND_TYPE[marque];
    var org=type==='ecosystem'?'Ecosystem':type==='ecologic'?'Ecologic':'Eco-organisme';
    var btnLabel=document.getElementById('rep-qr-btn-label'); if(btnLabel) btnLabel.textContent=org;
    if(qrRecap) qrRecap.innerHTML=
      '<b>Bonus QualiRépar :</b> −25 € appliqué<br>'+
      '<b>Éco-organisme :</b> '+org+'<br>'+
      '<b>Marque :</b> '+marque+'<br>'+
      '<b>IMEI :</b> '+(a.imei||'À renseigner')+'<br>'+
      '<b>N° Facture :</b> '+(f?f.numero:'—')+'<br>'+
      '<b>N° dossier interne :</b> '+((document.getElementById('r-dossier-interne')||{value:''}).value||'—')+'<br>'+
      '<b>Réf. mobile :</b> '+((document.getElementById('r-ref-mobile')||{value:''}).value||'—')+'<br>'+
      '<b>Montant TTC hors bonus :</b> '+(f?f.prix:0)+' €<br>'+
      (d.photoImeiUrl ? '<b>📷 Photo IMEI :</b> <a href="'+d.photoImeiUrl+'" target="_blank" style="color:var(--blue);">Voir la photo</a><br>' : '<b>📷 Photo IMEI :</b> <span style="color:var(--warning);">Non prise — utilisez le bouton 📷 OCR</span><br>')+
      '<b>Codes IRIS :</b> <span style="font-family:monospace;font-size:12px;">'+
        ((document.getElementById('iris-symptom')||{value:''}).value||'—')+
        ' · '+((document.getElementById('iris-section')||{value:''}).value||'—')+
        ' · '+((document.getElementById('iris-repaircode')||{value:''}).value||'—')+
      '</span>';
  } else {
    if(qrRecap) qrRecap.style.display='none';
    if(qrNo) qrNo.style.display='block';
    if(qrActions) qrActions.style.display='none';
  }
}


// ── Gestion intelligente des erreurs AgoraPlus ───────────────────
// Analyse l'erreur, identifie le champ défaillant, propose la correction

var QR_CHAMPS_LABELS = {
  imei:       { label: 'IMEI', champ: 'dep-imei',    etape: 2 },
  model:      { label: 'Modèle', champ: 'dep-modele', etape: 2 },
  brand:      { label: 'Marque', champ: 'dep-marque', etape: 2 },
  email:      { label: 'Email client', champ: 'rep-email', etape: 1 },
  phone:      { label: 'Téléphone', champ: 'rep-tel', etape: 1 },
  zip:        { label: 'Code postal', champ: 'rep-cp', etape: 1 },
  city:       { label: 'Ville', champ: 'rep-ville', etape: 1 },
  address:    { label: 'Adresse', champ: 'rep-adresse', etape: 1 },
  firstname:  { label: 'Prénom client', champ: 'rep-prenom', etape: 1 },
  lastname:   { label: 'Nom client', champ: 'rep-nom', etape: 1 },
  description:{ label: 'Description panne', champ: 'dep-panne', etape: 2 },
  amount:     { label: 'Montant', champ: 'dep-devis', etape: 2 },
  photo:      { label: 'Photo IMEI', champ: null, etape: 2 },
  iris:       { label: 'Codes IRIS', champ: null, etape: 3 },
};

function qrAnalyserErreur(msg, organisme){
  // Normaliser le message
  var m = (msg||'').toLowerCase();
  var champs = [];

  if(m.includes('imei') && m.includes('déjà'))
    return { type:'imei_double', titre:'IMEI déjà utilisé', detail:'Cet IMEI a déjà bénéficié du bonus dans les 6 derniers mois.', champs:[], rectifiable:false };
  if(m.includes('imei'))
    champs.push('imei');
  if(m.includes('model') || m.includes('modèle'))
    champs.push('model');
  if(m.includes('brand') || m.includes('marque'))
    champs.push('brand');
  if(m.includes('email'))
    champs.push('email');
  if(m.includes('phone') || m.includes('téléphone') || m.includes('tel'))
    champs.push('phone');
  if(m.includes('zip') || m.includes('postal') || m.includes('cp'))
    champs.push('zip');
  if(m.includes('city') || m.includes('ville'))
    champs.push('city');
  if(m.includes('address') || m.includes('adresse'))
    champs.push('address');
  if(m.includes('photo') || m.includes('image') || m.includes('file'))
    champs.push('photo');
  if(m.includes('iris') || m.includes('spare') || m.includes('pièce'))
    champs.push('iris');
  if(m.includes('description') || m.includes('panne'))
    champs.push('description');
  if(m.includes('amount') || m.includes('montant'))
    champs.push('amount');
  if(m.includes('firstname') || m.includes('prénom'))
    champs.push('firstname');
  if(m.includes('lastname') || m.includes('nom'))
    champs.push('lastname');

  return {
    type: 'champ',
    titre: 'Erreur ' + organisme,
    detail: msg,
    champs: champs.length > 0 ? champs : [],
    rectifiable: true
  };
}

function qrAfficherErreurCorrection(erreur, organisme, statut){
  if(!statut) return;
  var couleurOrg = organisme === 'Ecosystem' ? '#16a34a' : '#2563eb';

  if(erreur.type === 'imei_double'){
    statut.innerHTML =
      '<div style="background:#fff8e1;border:1.5px solid #f59e0b;padding:14px;border-radius:10px;">' +
      '<div style="font-weight:700;color:#92400e;margin-bottom:6px;">⚠️ IMEI déjà utilisé</div>' +
      '<div style="font-size:13px;color:#92400e;">'+erreur.detail+'</div>' +
      '<div style="margin-top:8px;font-size:12px;color:#78350f;">Ce téléphone ne peut pas bénéficier du bonus QualiRépar avant 6 mois.</div>' +
      '</div>';
    return;
  }

  var champsHtml = '';
  if(erreur.champs.length > 0){
    var etape1 = erreur.champs.filter(function(k){ return QR_CHAMPS_LABELS[k] && QR_CHAMPS_LABELS[k].etape===1; });
    var etape2 = erreur.champs.filter(function(k){ return QR_CHAMPS_LABELS[k] && QR_CHAMPS_LABELS[k].etape===2; });
    var etape3 = erreur.champs.filter(function(k){ return QR_CHAMPS_LABELS[k] && QR_CHAMPS_LABELS[k].etape===3; });

    var listeChamps = erreur.champs.map(function(k){
      var info = QR_CHAMPS_LABELS[k];
      if(!info) return '';
      var val = info.champ ? ((document.getElementById(info.champ)||{value:''}).value || '—') : 'voir ci-dessus';
      return '<li style="margin:3px 0;"><b>'+info.label+'</b> : <span style="color:#dc2626;">'+(val||'vide')+'</span></li>';
    }).join('');

    champsHtml = '<div style="margin:10px 0;"><b>Champs à corriger :</b><ul style="margin:6px 0 0 16px;font-size:13px;">'+listeChamps+'</ul></div>';

    var btnsEtape = '';
    if(etape1.length) btnsEtape += '<button class="btn btn-sm" onclick="repGoStep(1)" style="margin-right:6px;">✏️ Aller au step 1 (Client)</button>';
    if(etape2.length) btnsEtape += '<button class="btn btn-sm" onclick="repGoStep(2)" style="margin-right:6px;">✏️ Aller au step 2 (Appareil)</button>';
    if(etape3.length) btnsEtape += '<button class="btn btn-sm" onclick="repGoStep(3)">✏️ Aller au step 3 (Devis/Panne)</button>';
    champsHtml += '<div style="margin-top:10px;">'+btnsEtape+'</div>';
  }

  statut.innerHTML =
    '<div style="background:#fef2f2;border:1.5px solid #fca5a5;padding:14px;border-radius:10px;">' +
    '<div style="font-weight:700;color:#dc2626;margin-bottom:6px;">❌ Erreur '+organisme+'</div>' +
    '<div style="font-size:13px;color:#991b1b;word-break:break-word;">'+erreur.detail+'</div>' +
    champsHtml +
    '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #fca5a5;display:flex;gap:8px;flex-wrap:wrap;">' +
    '<button class="btn btn-primary" onclick="repEnvoyerOrganisme()" style="background:#dc2626;border-color:#dc2626;font-size:13px;">🔄 Renvoyer après correction</button>'
    '</div>' +
    '</div>';
}
// ─────────────────────────────────────────────────────────────────

function repEnvoyerOrganisme(){
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier','error'); return; }

  var panne    = (document.getElementById('rep-qr-panne')||{value:''}).value;
  var marque    = (d.appareil||{}).marque||'';
  var organisme = (QR_BRAND_TYPE && QR_BRAND_TYPE[marque]) || 'ecologic';

  if(organisme === 'ecologic'){
    repEnvoyerEcologic();
  } else {
    repEnvoyerEcosystem();
  }
}


async function repEnvoyerEcosystem(){
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier','error'); return; }

  var statut = document.getElementById('rep-qr-envoi-statut');
  if(statut) statut.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:13px;">⏳ Connexion Ecosystem en cours...</div>';

  var user       = localStorage.getItem('sp_eco_user') || '501710';
  var password   = localStorage.getItem('sp_eco_pass') || 'Coincoin71?!';
  var repairerId = localStorage.getItem('sp_eco_repairer_id') || '2002535';

  var panne = (document.getElementById('rep-qr-panne')||{value:''}).value;
  var codes = IRIS_CODES[panne]||{};
  var iris  = Array.isArray(codes.irisLines) ? codes.irisLines : [];
  var a     = d.appareil||{};
  var c     = d.client||{};
  var f     = d.facture||{};

  var baseUrl = 'https://api.repairerportal.ecosystem.eco';

  try {
    // Étape 1 : Authentification
    if(statut) statut.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:13px;">⏳ Authentification Ecosystem...</div>';

    var authRes = await fetch(baseUrl+'/api/authenticate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username: user, password: password})
    });

    if(!authRes.ok) throw new Error('Authentification échouée ('+authRes.status+')');
    var authData = await authRes.json();
    var jwt = authData.id_token || authData.token || authData.access_token;
    if(!jwt) throw new Error('Token JWT non reçu');

    console.log('Ecosystem auth OK');
    if(statut) statut.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:13px;">⏳ Création du dossier Ecosystem...</div>';

    // Étape 2 : Créer le dossier de remboursement
    var repairDate = f.date || new Date().toISOString().split('T')[0];
    var prixReel   = (f.prix||0) + 25; // Prix réel = prix client + bonus

    var dossierPayload = {
      repairerId:       parseInt(repairerId),
      repairerSiteId:   parseInt(repairerId),
      serialNumber:     a.imei||'',
      brand:            a.marque||'Apple',
      model:            a.modele||'',
      commercialRef:    d.refMobile||'',
      repairDate:       repairDate,
      invoiceReference: d.numero||'',
      invoiceAmount:    prixReel,
      bonusAmount:      25,
      consumerLastName:  c.nom||'',
      consumerFirstName: c.prenom||'',
      consumerEmail:     c.email||'',
      consumerPhone:     c.tel||'',
      consumerAddress:   c.adresse||'',
      consumerZipCode:   c.cp||'',
      consumerCity:      c.ville||'',
      spareParts: (iris||[]).map(function(l){
        return {
          irisConditionCode: l.condition,
          irisSymptomCode:   l.symptom,
          irisSectionCode:   l.section,
          irisDefaultCode:   l.irisDefault,
          irisRepairCode:    l.repair,
          partReference:     l.repairCode,
          description:       l.description||''
        };
      }),
      invoiceFileUrl:    d.photoImeiUrl||'',
      imeiFileUrl:       d.photoImeiUrl||''
    };

    var repairRes = await fetch(baseUrl+'/api/repair-reimbursements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer '+jwt
      },
      body: JSON.stringify(dossierPayload)
    });

    var repairData = await repairRes.json();
    console.log('Ecosystem repair response:', repairData);

    if(repairRes.ok && (repairData.id || repairData.reimbursementId)){
      var dossierId = repairData.id || repairData.reimbursementId;
      d.qrEnvoi = {date:new Date().toISOString(), statut:'Sent', ecosystemId: dossierId};
      d.statut = 'qr';
      repSauvegarderDossier();
      repUpdateStatutBadge();
      if(statut) statut.innerHTML = '<div style="background:#f0fdf4;padding:12px;border-radius:8px;color:var(--green);font-size:13px;">'+
        '✅ Dossier envoyé à Ecosystem !<br>'+
        '<b>ID Ecosystem :</b> '+dossierId+'<br>'+
        '<b>Remboursement :</b> 25€ sous 15 jours ouvrés</div>';
      showNotif('✅ Dossier QualiRépar envoyé à Ecosystem !','success');
    } else {
      var rawMsg = repairData.message || repairData.error || repairData.detail || JSON.stringify(repairData).slice(0,300);
      throw new Error(rawMsg);
    }

  } catch(err){
    console.error('Ecosystem error:', err);
    var errAnalysee = qrAnalyserErreur(err.message, 'Ecosystem');
    qrAfficherErreurCorrection(errAnalysee, 'Ecosystem', statut);
    showNotif('❌ Erreur Ecosystem — corrigez et renvoyez','error');
  }
}

async function repEnvoyerEcologic(){
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier','error'); return; }

  var statut = document.getElementById('rep-qr-envoi-statut');
  if(statut) statut.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:13px;">⏳ Envoi vers Ecologic en cours...</div>';

  var token  = localStorage.getItem('sp_ecologic_token') || '8121d135-4635-412d-b7ab-3b4dd61cbdb8';
  var siteId = localStorage.getItem('sp_ecologic_siteid') || 'f3f52871-5be0-4c26-9082-002479b9cf4e';

  var panne  = (document.getElementById('rep-qr-panne')||{value:''}).value;
  var codes  = IRIS_CODES[panne]||{};
  var iris   = codes.irisLines||[];
  var a      = d.appareil||{};
  var c      = d.client||{};
  var f      = d.facture||{};

  // Étape 1 : CreateSupportRequest
  var payload1 = {
    action: 'CreateSupportRequest',
    token: token,
    siteId: siteId,
    repairSiteRef: d.numero,
    imei: a.imei||'',
    brand: a.marque||'',
    model: a.modele||'',
    consumerFirstName: c.prenom||'',
    consumerLastName: c.nom||'',
    consumerEmail: c.email||'',
    consumerPhone: c.tel||'',
    consumerAddress: c.adresse||'',
    consumerZipCode: c.cp||'',
    consumerCity: c.ville||'',
    repairDate: (f.date||new Date().toISOString().split('T')[0]),
    repairDescription: f.descBase||d.panne||'',
    repairAmount: ((f.prix||0)+25).toFixed(2), // prix réel = prix client + bonus
    bonusAmount: '25.00',
    spareParts: (iris||[]).map(function(l){
      return {
        irisCondition: l.condition,
        irisSymptom: l.symptom,
        irisSection: l.section,
        irisDefault: l.irisDefault,
        irisRepair: l.repair,
        sparePartRef: l.repairCode
      };
    }),
    invoicePhotoUrl: d.photoImeiUrl||'',
    imeiPhotoUrl: d.photoImeiUrl||''
  };

  try {
    var res1 = await fetch('https://www.ecologic-france.com/admin/ajax/_actions.php', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(payload1)
    });

    var data1 = await res1.json();
    console.log('Ecologic CreateSupportRequest:', data1);

    if(data1.status === 'success' || data1.ResponseCode === '00'){
      var supportId = data1.supportRequestId || data1.ResponseData;

      // Étape 2 : CreateClaim
      var payload2 = {
        action: 'CreateClaim',
        token: token,
        siteId: siteId,
        supportRequestId: supportId,
        invoiceRef: d.numero,
        invoiceAmount: (f.prix||0).toFixed(2),
        invoicePhotoUrl: d.photoImeiUrl||''
      };

      var res2 = await fetch('https://www.ecologic-france.com/admin/ajax/_actions.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify(payload2)
      });
      var data2 = await res2.json();
      console.log('Ecologic CreateClaim:', data2);

      if(data2.status === 'success' || data2.ResponseCode === '00'){
        d.qrEnvoi = {date:new Date().toISOString(), statut:'Sent', supportId:supportId, claimId:data2.claimId||''};
        d.statut = 'qr';
        repSauvegarderDossier();
        repUpdateStatutBadge();
        if(statut) statut.innerHTML = '<div style="background:#f0fdf4;padding:12px;border-radius:8px;color:var(--green);font-size:13px;">'+
          '✅ Dossier envoyé à Ecologic !<br>'+
          '<b>Support ID :</b> '+supportId+'<br>'+
          '<b>Remboursement :</b> sous 15 jours ouvrés</div>';
        showNotif('✅ Dossier QualiRépar envoyé à Ecologic !','success');
      } else {
        throw new Error(data2.message||data2.ResponseMessage||'Erreur CreateClaim');
      }
    } else {
      // Erreur IMEI déjà utilisé ?
      var msg = data1.message||data1.ResponseMessage||JSON.stringify(data1).slice(0,200)||'Erreur';
      var errAnalysee = qrAnalyserErreur(msg, 'Ecologic');
      qrAfficherErreurCorrection(errAnalysee, 'Ecologic', statut);
      showNotif('❌ Erreur Ecologic — '+errAnalysee.titre,'error');
    }
  } catch(err){
    console.error('Ecologic error:', err);
    var errAnalysee = qrAnalyserErreur(err.message, 'Ecologic');
    qrAfficherErreurCorrection(errAnalysee, 'Ecologic', statut);
    showNotif('❌ Erreur Ecologic — corrigez et renvoyez','error');
  }
}

function repCloturerDossier(){
  repDossierCourant.statut='cloture';
  repSauvegarderDossier();
  showNotif('Dossier clôturé','success');
  repShowListe();
}

function repSupprimerDossier(id){
  if(!confirm('Supprimer ce dossier ?')) return;
  repDossiers=repDossiers.filter(function(d){return String(d.id)!==String(id);});
  bonsDepot=bonsDepot.filter(function(d){return String(d.id)!==String(id);});
  saveBonsDepot();
  try{supaFetch('bons_depot','DELETE',null,'?id=eq.'+id);}catch(e){}
  renderRepListe();
  showNotif('Dossier supprimé','success');
}


function repSetDesc(val){
  var el = document.getElementById('r-description');
  if(!el) return;
  // Ajouter le modèle si connu
  var modele = '';
  if(repDossierCourant && repDossierCourant.appareil)
    modele = ((repDossierCourant.appareil.marque||'')+' '+(repDossierCourant.appareil.modele||'')).trim();
  el.value = val + (modele ? ' ' + modele : '');
  repUpdateFacturePreview();
  repUpdateChecklist && repUpdateChecklist();
}


function repImprimerDepot(){
  repAutoSave();
  var d = repDossierCourant;
  if(!d){ showNotif('Aucun dossier ouvert','error'); return; }
  if(!d.etat || !Array.isArray(d.etat)){
    d.etat = [];
    ['ecran','ray-ecran','ray-dos','vitre-dos','bouton','hp','micro','camera','charge','batterie'].forEach(function(k){
      var el=document.getElementById('dep-etat-'+k);
      if(el && el.checked) d.etat.push(k);
    });
  }
  if(!d.accessoires || !Array.isArray(d.accessoires)) d.accessoires = [];
  if(!d.panne) d.panne = (document.getElementById('dep-panne')||{value:''}).value||'';
  if(!d.devis) d.devis = parseFloat((document.getElementById('dep-devis')||{value:0}).value)||0;
  if(!d.moHT) d.moHT = parseFloat((document.getElementById('dep-mo-ht')||{value:0}).value)||0;
  if(!d.piecesHT) d.piecesHT = parseFloat((document.getElementById('dep-pieces-ht')||{value:0}).value)||0;
  printBonDepot(d);
}

function repReprintDepot(id){
  var d=repDossiers.find(function(x){return String(x.id)===String(id);});
  if(d) printBonDepot(d);
}

function repUpdateFacturePreview(){ /* alias */ }

// ── Vérification IMEI — alerte 6 mois QualiRépar ──────────────

function repValidateIMEI(val){
  var imei = (val||'').replace(/\s/g,'');
  var alertEl = document.getElementById('dep-imei-alert');
  if(!alertEl){
    alertEl = document.createElement('div');
    alertEl.id = 'dep-imei-alert';
    alertEl.style.cssText = 'font-size:11px;margin-top:3px;';
    var parent = document.getElementById('dep-imei');
    if(parent && parent.parentNode) parent.parentNode.appendChild(alertEl);
  }
  if(!imei){ alertEl.innerHTML=''; return; }
  if(!/^\d+$/.test(imei)){
    alertEl.innerHTML = '<span style="color:var(--red);">⚠️ IMEI : chiffres uniquement</span>';
  } else if(imei.length < 15){
    alertEl.innerHTML = '<span style="color:var(--warning);">⚠️ IMEI incomplet : '+imei.length+'/15 chiffres</span>';
  } else if(imei.length > 15){
    alertEl.innerHTML = '<span style="color:var(--red);">⚠️ IMEI trop long : '+imei.length+' chiffres (max 15)</span>';
  } else {
    alertEl.innerHTML = '<span style="color:var(--green);">✅ IMEI valide (15 chiffres)</span>';
  }
}

function repCheckIMEI(imei){
  imei = (imei||'').trim().replace(/\s/g,'');
  var alertBox = document.getElementById('rep-imei-alert');
  if(!alertBox) return;

  if(!imei || imei.length < 10){
    alertBox.style.display='none';
    return;
  }

  // Chercher dans tous les dossiers fermés avec le même IMEI et un bonus QR
  var sixMoisAgo = new Date();
  sixMoisAgo.setMonth(sixMoisAgo.getMonth() - 6);

  // Chercher dans bonsDepot (dossiers réparation)
  var conflits = repDossiers.filter(function(d){
    if(!d.appareil || !d.appareil.imei) return false;
    var imeiD = d.appareil.imei.replace(/\s/g,'');
    if(imeiD !== imei) return false;
    // Même dossier courant → ignorer
    if(repDossierCourant && String(d.id) === String(repDossierCourant.id)) return false;
    return true;
  });

  // Chercher aussi dans reparations (factures)
  var facConflits = reparations.filter(function(r){
    if(!r.imei) return false;
    if(r.imei.replace(/\s/g,'') !== imei) return false;
    return true;
  });

  // QR conflits = réparations avec bonus dans les 6 derniers mois
  var qrConflits = facConflits.filter(function(r){
    if(!r.bonusQR) return false;
    var d = new Date(r.date);
    return d >= sixMoisAgo;
  });

  // Alerte si réparation récente avec bonus QR
  if(qrConflits.length > 0){
    var r = qrConflits[0];
    alertBox.style.display = 'block';
    alertBox.innerHTML =
      '⚠️ <b>ATTENTION — Bonus QualiRépar déjà utilisé !</b><br>' +
      'Cet IMEI a bénéficié d\'un bonus de −25€ le <b>' + fmtDate(r.date) + '</b> (facture '+r.numero+').<br>' +
      '<b>Délai minimum : 6 mois entre deux bonus.</b><br>' +
      'Prochaine date éligible : <b>' + fmtDateEligible(r.date) + '</b><br>' +
      '<span style="font-size:11px;color:#991b1b;">Ne pas appliquer le bonus QualiRépar sur cette réparation.</span>';
    // Décocher et désactiver le bonus QR
    var cbQR = document.getElementById('rep-qr-actif');
    if(cbQR){ cbQR.checked = false; cbQR.disabled = true; repToggleQR(); }
    var blocQR = document.getElementById('rep-qr-bloc');
    if(blocQR) blocQR.style.display='none';
    return;
  }

  // Alerte douce si réparation récente sans bonus (info seulement)
  var repRecentes = conflits.filter(function(d){
    var date = new Date(d.date);
    return date >= sixMoisAgo;
  });
  if(repRecentes.length > 0){
    var dr = repRecentes[0];
    alertBox.style.display = 'block';
    alertBox.style.background = '#fef3c7';
    alertBox.style.borderColor = '#f59e0b';
    alertBox.style.color = '#92400e';
    alertBox.innerHTML =
      'ℹ️ <b>Appareil déjà déposé récemment</b> — '+
      (dr.client?dr.client.prenom+' '+dr.client.nom:'client')+ ' · ' + fmtDate(dr.date) + ' ('+dr.numero+')<br>' +
      'Vérifiez si un bonus QualiRépar a déjà été appliqué.';
    var cbQR = document.getElementById('rep-qr-actif');
    if(cbQR) cbQR.disabled = false;
    return;
  }

  // Aucun conflit
  alertBox.style.display='none';
  var cbQR = document.getElementById('rep-qr-actif');
  if(cbQR) cbQR.disabled = false;
}

function fmtDateEligible(dateStr){
  var d = new Date(dateStr);
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString('fr-FR');
}

// ── OCR IMEI depuis caméra (réutilise la fonction Claude Vision) ──
async function repOCRImei(){
  try {
    var stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}}});

    var modal = document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';

    var video = document.createElement('video');
    video.autoplay=true; video.playsInline=true;
    video.style.cssText='max-width:100%;max-height:55vh;border-radius:12px;border:2px solid rgba(255,255,255,0.3);';
    video.srcObject = stream;

    var hint = document.createElement('div');
    hint.style.cssText='color:#fff;font-size:14px;text-align:center;padding:0 20px;line-height:1.6;';
    hint.innerHTML='📱 Pointez vers la <b>plaque signalétique</b> (IMEI visible)';

    var btnCapture = document.createElement('button');
    btnCapture.style.cssText='padding:14px 32px;background:#e53e3e;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;';
    btnCapture.textContent='📸 Capturer';

    var btnCancel = document.createElement('button');
    btnCancel.style.cssText='padding:10px 24px;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;';
    btnCancel.textContent='Annuler';

    var status = document.createElement('div');
    status.style.cssText='color:#fff;font-size:13px;min-height:24px;text-align:center;padding:0 20px;';

    [video,hint,btnCapture,btnCancel,status].forEach(function(el){modal.appendChild(el);});
    document.body.appendChild(modal);

    btnCancel.onclick = function(){
      stream.getTracks().forEach(function(t){t.stop();});
      document.body.removeChild(modal);
    };

    btnCapture.onclick = async function(){
      // ── ÉTAPE 1 : Capture instantanée ──
      var canvas = document.createElement('canvas');
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
      canvas.getContext('2d').drawImage(video,0,0);
      stream.getTracks().forEach(function(t){t.stop();});

      // → Bouton change IMMÉDIATEMENT après la prise de vue
      btnCapture.disabled = true;
      btnCapture.style.background = '#16a34a';
      btnCapture.textContent = '✅ Photo prise !';

      // Afficher la miniature IMMÉDIATEMENT dans la modale
      var previewUrl = canvas.toDataURL('image/jpeg', 0.7);
      video.style.display='none';
      hint.style.display='none';
      var thumbPreview = document.createElement('img');
      thumbPreview.src = previewUrl;
      thumbPreview.style.cssText='width:180px;height:135px;object-fit:cover;border-radius:10px;border:3px solid #4ade80;margin-top:8px;';
      modal.insertBefore(thumbPreview, btnCapture);

      // Afficher aussi dans le formulaire dès la capture
      var marque = repDossierCourant && repDossierCourant.appareil && repDossierCourant.appareil.marque;
      repAfficherPhotoThumb(previewUrl, marque);
      status.style.display='block';
      status.textContent='🗜️ Traitement en cours...';

      // ── ÉTAPE 2 : Compression + Upload ──
      status.textContent='🗜️ Compression...';
      var compressedUrl = await compresserPhoto(canvas, 500);
      var base64Full = compressedUrl.split(',')[1];

      // Upload photo Supabase
      status.textContent='☁️ Sauvegarde photo...';
      var photoUrl = null;
      try {
        photoUrl = await uploaderPhotoIMEI(base64Full, compressedUrl);
        if(photoUrl && repDossierCourant){
          repDossierCourant.photoImeiUrl = photoUrl;
          repSauvegarderDossier();
          // Remplacer la preview locale par l'URL Supabase définitive
          repAfficherPhotoThumb(photoUrl, marque);
          thumbPreview.src = photoUrl;
          status.innerHTML='<span style="color:#4ade80;">☁️ Sauvegardé ✅</span>';
        }
      } catch(e){ console.log('Upload photo:', e); }

      // OCR IMEI avec Claude Vision
      status.textContent='🤖 Lecture IMEI par IA...';
      var imeiLu = null;
      try {
        imeiLu = await qrExtractIMEI(base64Full);
      } catch(e){
        console.log('OCR error:', e);
      }

      // Afficher résultat
      if(imeiLu){
        var imeiEl = document.getElementById('dep-imei');
        if(imeiEl){ imeiEl.value = imeiLu; repAutoSave(); repCheckIMEI(imeiLu); repValidateIMEI(imeiLu); }
        status.innerHTML = '<span style="color:#4ade80;font-size:15px;font-weight:700;">✅ IMEI lu : '+imeiLu+'</span>';
      } else {
        status.innerHTML = '<span style="color:#fbbf24;">⚠️ IMEI non détecté — saisissez-le manuellement</span>';
      }

      // Bouton fermer disponible immédiatement
      var btnClose = document.createElement('button');
      btnClose.style.cssText='padding:10px 28px;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:8px;';
      btnClose.textContent='✓ Fermer';
      btnClose.onclick = function(){ if(document.body.contains(modal)) document.body.removeChild(modal); };
      modal.appendChild(btnClose);
    };

  } catch(e){
    showNotif('Caméra non disponible — saisissez l\'IMEI manuellement','error');
  }
}

// ── Compresser une photo pour Ecosystem (< maxKo Ko) ─────────
async function compresserPhoto(canvas, maxKo){
  var qualite = 0.85;
  var dataUrl = canvas.toDataURL('image/jpeg', qualite);

  // Réduire jusqu'à atteindre la taille cible
  while(dataUrl.length * 0.75 > maxKo * 1024 && qualite > 0.1){
    qualite -= 0.1;
    // Si trop grand, réduire aussi les dimensions
    if(qualite < 0.5 && canvas.width > 1280){
      var c2 = document.createElement('canvas');
      c2.width  = Math.round(canvas.width * 0.75);
      c2.height = Math.round(canvas.height * 0.75);
      c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
      canvas = c2;
    }
    dataUrl = canvas.toDataURL('image/jpeg', qualite);
  }
  var taille = Math.round(dataUrl.length * 0.75 / 1024);
  console.log('Photo compressée : '+taille+' Ko (qualité '+Math.round(qualite*100)+'%)');
  return dataUrl;
}

// ── Uploader la photo dans Supabase Storage ──────────────────
async function uploaderPhotoIMEI(base64, dataUrl){
  try {
    var dossierNum = repDossierCourant ? repDossierCourant.numero : 'unknown';
    var fileName   = dossierNum.replace(/[^a-zA-Z0-9-]/g,'_')+'_imei_'+Date.now()+'.jpg';
    var bucket     = 'imei-photos';

    // Convertir base64 en Blob
    var byteStr = atob(base64);
    var arr = new Uint8Array(byteStr.length);
    for(var i=0;i<byteStr.length;i++) arr[i]=byteStr.charCodeAt(i);
    var blob = new Blob([arr], {type:'image/jpeg'});

    var res = await fetch(SUPA_URL+'/storage/v1/object/'+bucket+'/'+fileName, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: blob
    });

    if(res.ok){
      var url = SUPA_URL+'/storage/v1/object/public/'+bucket+'/'+fileName;
      console.log('Photo uploadée :', url);
      return url;
    } else {
      var err = await res.text();
      console.error('Upload error:', res.status, err);
      return null;
    }
  } catch(e){
    console.error('Upload exception:', e);
    return null;
  }
}



// ============================================================
//  ÉTAPE 3 — Signature + HT + Inéligibilité
// ============================================================

// Pannes inéligibles au bonus QR
var QR_INELIGIBLE = [
  { mots: ['vitre arrière','vitre arr','dos'],         raison: 'Vitre arrière : réparation esthétique si appareil fonctionnel — non éligible' },
  { mots: ['esthétique','rayure','rayures','cosmétique'], raison: 'Dommage esthétique n\'empêchant pas le fonctionnement — non éligible' },
  { mots: ['coque','protection','étui'],               raison: 'Accessoire / protection — non éligible' },
  { mots: ['nettoyage','déblocage','reset','réinitial'], raison: 'Nettoyage / réinitialisation — non éligible' },
  { mots: ['garantie'],                                raison: 'Appareil encore sous garantie — non éligible au bonus QR' },
  { mots: ['oxydation','eau','humidité','liquide'],     raison: 'Dommage lié à l\'environnement (eau) — vérifiez l\'éligibilité avant d\'appliquer le bonus' },
];

function repCheckEligibilite(){
  var panne = (document.getElementById('dep-panne')||{value:''}).value.toLowerCase();
  var box = document.getElementById('rep-inelig-alert');
  if(!box) return;
  if(!panne){ box.style.display='none'; return; }

  for(var i=0; i<QR_INELIGIBLE.length; i++){
    var rule = QR_INELIGIBLE[i];
    for(var j=0; j<rule.mots.length; j++){
      if(panne.includes(rule.mots[j])){
        box.style.display = 'block';
        box.innerHTML = '⚠️ <b>Attention QualiRépar :</b> ' + rule.raison + '<br><span style="font-size:11px;">Vérifiez l\'éligibilité avant d\'appliquer le bonus -25€</span>';
        // Décocher le bonus en step 4 si présent
        var cbQR = document.getElementById('rep-qr-actif');
        if(cbQR) cbQR.disabled = true;
        return;
      }
    }
  }
  box.style.display = 'none';
  var cbQR = document.getElementById('rep-qr-actif');
  if(cbQR) cbQR.disabled = false;
}


var _repAutoDecompRunning = false;
function repAutoDecompose(prixTTC){
  // Entièrement async → ne bloque jamais l'UI thread iPad
  if(_repAutoDecompRunning) return;
  _repAutoDecompRunning = true;
  setTimeout(function(){
    try {
      var ttc = parseFloat(prixTTC)||0;
      if(ttc <= 0){ return; }

      var bonusQR = (document.getElementById('rep-qr-actif')||{checked:false}).checked;
      var prixBase = bonusQR ? ttc + 25 : ttc;
      var ht     = prixBase / 1.2;
      var mo     = 25;
      var pieces = Math.max(0, ht - mo);

      if(repCurrentStep === 3){
        var elMO  = document.getElementById('dep-mo-ht');
        var elPie = document.getElementById('dep-pieces-ht');
        if(elMO)  elMO.value  = mo.toFixed(2);
        if(elPie) elPie.value = pieces.toFixed(2);
        var calcBox = document.getElementById('rep-devis-calc');
        var htTot = mo + pieces;
        if(calcBox){
          calcBox.innerHTML = 'HT total : <b>'+htTot.toFixed(2)+' €</b> (MO : '+mo.toFixed(2)+' € + Pièces : '+pieces.toFixed(2)+' €) → TTC 20% : <b>'+(Math.round(htTot*1.2*100)/100).toFixed(2)+' €</b>';
        }
      }

      // Mettre à jour dossier courant
      if(repDossierCourant){
        repDossierCourant.devis    = ttc;
        repDossierCourant.moHT    = 25;
        repDossierCourant.piecesHT = pieces;
      }

    } catch(e){ console.warn('repAutoDecompose:', e); }
    finally { _repAutoDecompRunning = false; }
  }, 10);
}


var _repCalcTimer = null;
function repCalcDevisDebounced(){
  if(_repCalcTimer) clearTimeout(_repCalcTimer);
  _repCalcTimer = setTimeout(repCalcDevis, 200);
}
function repCalcDevis(){
  var mo     = parseFloat((document.getElementById('dep-mo-ht')||{value:0}).value)||0;
  var pieces = parseFloat((document.getElementById('dep-pieces-ht')||{value:0}).value)||0;
  var ht     = mo + pieces;
  var ttc    = Math.round(ht * 1.2 * 100) / 100;
  var calcBox = document.getElementById('rep-devis-calc');
  if(calcBox && (mo||pieces)){
    calcBox.innerHTML =
      'HT total : <b>' + ht.toFixed(2) + ' €</b> ' +
      '(MO : ' + mo.toFixed(2) + ' € + Pièces : ' + pieces.toFixed(2) + ' €) → ' +
      'TTC 20% : <b>' + ttc.toFixed(2) + ' €</b>';
  } else if(calcBox){
    calcBox.innerHTML = '';
  }
  // Ne PAS écraser dep-devis — c'est l'utilisateur qui saisit le prix
  repAutoSave();

  // Alerte si TTC < 25€ et bonus QR potentiel
  var alertBox = document.getElementById('rep-imei-alert');
  if(alertBox && ttc > 0 && ttc < 25){
    alertBox.style.display = 'block';
    alertBox.style.background = '#fef2f2';
    alertBox.style.borderColor = 'var(--red)';
    alertBox.style.color = 'var(--red)';
    alertBox.innerHTML = '❌ <b>Prix TTC (' + ttc.toFixed(2) + ' €) inférieur à 25 €</b> — Le bonus QualiRépar ne peut pas être appliqué (montant du bonus > montant de la facture)';
    var cbQR = document.getElementById('rep-qr-actif');
    if(cbQR){ cbQR.checked = false; cbQR.disabled = true; }
  }
}

// ── Signature canvas ──────────────────────────────────────────
var _repSigDrawing = false;
var _repSigData = null;

function repInitSig(){
  var canvas = document.getElementById('rep-sig-canvas');
  if(!canvas) return;

  // Redimensionner le canvas à sa vraie taille affichée (évite le décalage)
  var rect = canvas.getBoundingClientRect();
  var w = rect.width || canvas.offsetWidth || canvas.parentElement.offsetWidth || 380;
  var h = rect.height || 100;
  if(w > 0){
    canvas.width  = Math.round(w);
    canvas.height = Math.round(h);
  }

  if(canvas._repInitDone) return;
  canvas._repInitDone = true;

  var ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function getPos(e){
    var r = canvas.getBoundingClientRect();
    if(e.touches){ return {x:e.touches[0].clientX-r.left, y:e.touches[0].clientY-r.top}; }
    return {x:e.clientX-r.left, y:e.clientY-r.top};
  }
  function start(e){
    e.preventDefault();
    _repSigDrawing=true;
    var p=getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
  }
  function move(e){
    e.preventDefault();
    if(!_repSigDrawing) return;
    var p=getPos(e);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
  }
  function end(e){
    e.preventDefault();
    _repSigDrawing=false;
    repSigSave();
  }

  // mouseleave ne stoppe PAS le dessin (permet de sortir et revenir)
  // Seul mouseup/touchend arrête le dessin
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup',   end);
  // Sur mobile : continuer même si le doigt sort légèrement du canvas
  document.addEventListener('touchend', end, {passive:false});
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove',  move,  {passive:false});

  // mouseup global : arrêter même si souris relâchée hors canvas
  document.addEventListener('mouseup', function(e){
    if(_repSigDrawing){ _repSigDrawing=false; repSigSave(); }
  });
}

function repSigSave(){
  var canvas = document.getElementById('rep-sig-canvas');
  if(!canvas) return;
  _repSigData = canvas.toDataURL('image/png');
  var hint = document.getElementById('rep-sig-hint');
  var ok   = document.getElementById('rep-sig-ok');
  if(hint) hint.style.display='none';
  if(ok)   ok.style.display='block';
  if(repDossierCourant) repDossierCourant.signature = _repSigData;
}

function repClearSig(){
  var canvas = document.getElementById('rep-sig-canvas');
  if(!canvas) return;
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  _repSigData = null;
  if(repDossierCourant) repDossierCourant.signature = null;
  var hint = document.getElementById('rep-sig-hint'); if(hint) hint.style.display='block';
  var ok   = document.getElementById('rep-sig-ok');   if(ok)   ok.style.display='none';
}

function repUpdateSigNom(){
  var el = document.getElementById('rep-sig-nom-display');
  if(!el||!repDossierCourant) return;
  var c = repDossierCourant.client||{};
  el.textContent = [(c.civilite||''),(c.prenom||''),(c.nom||'')].filter(Boolean).join(' ') || '—';
}



// Sauvegarder MO/pièces dans repAutoSave
var _repAutoSaveOrig = repAutoSave;
var _repAutoSaveRunning = false;
var _repAutoSaveTimer = null;
// Cache pour éviter les mises à jour DOM inutiles
var _repPhotoStatus = null;
var _repPhotoMarque = null;
repAutoSave = function(){
  // Tout est debounced — RIEN ne s'exécute de façon synchrone (fix freeze iPad)
  if(_repAutoSaveTimer) clearTimeout(_repAutoSaveTimer);
  _repAutoSaveTimer = setTimeout(function(){
    if(_repAutoSaveRunning) return;
    _repAutoSaveRunning = true;
    try {
      if(repDossierCourant){
        repDossierCourant.moHT     = parseFloat((document.getElementById('dep-mo-ht')||{value:0}).value)||0;
        repDossierCourant.piecesHT = parseFloat((document.getElementById('dep-pieces-ht')||{value:0}).value)||0;
        if(_repSigData) repDossierCourant.signature = _repSigData;
        // Mettre à jour miniature photo seulement si changement
        var hasPhoto = !!repDossierCourant.photoImeiUrl;
        var curMarque = repDossierCourant.appareil && repDossierCourant.appareil.marque;
        if(hasPhoto !== _repPhotoStatus || curMarque !== _repPhotoMarque){
          _repPhotoStatus = hasPhoto;
          _repPhotoMarque = curMarque;
          repAfficherPhotoThumb(hasPhoto ? repDossierCourant.photoImeiUrl : null, curMarque);
        }
      }
      _repAutoSaveOrig();
    } catch(e){ console.warn('repAutoSave err:',e); }
    finally { _repAutoSaveRunning = false; _repAutoSaveTimer = null; }
  }, 150);
};

// ============================================================
//  FIN ÉTAPE 3
// ============================================================

// ============================================================
//  IRIS CODES — Table de correspondance panne → codes IRIS
// ============================================================
var IRIS_CODES = {
  'ecran-casse': {
    label:       'Remplacement écran (casse physique)',
    description: 'Remplacement écran suite casse physique',
    condition:   '6',   // Chute / impact
    symptom:     'E7',  // Affichage défectueux / écran endommagé
    section:     'W10', // Ensemble affichage (écran LCD/OLED + vitre)
    irisDefault: '08',  // Cassé / fissuré
    repair:      'A',   // Remplacement pièce
    repairCode:  'ELE-DIS-001',
    conditionEX: 'X47',  // Impact mécanique
    // 3 lignes IRIS obligatoires pour AgoraPlus (comme les 3 coches Phonilab)
    irisLines: [
      { condition:'6', symptom:'E7', section:'W10', irisDefault:'08', repair:'A', repairCode:'ELE-DIS-001', description:'Ecran cassé - impact physique' },
      { condition:'6', symptom:'E7', section:'W10', irisDefault:'08', repair:'A', repairCode:'ELE-DIS-001', description:'Remplacement ensemble affichage' },
      { condition:'6', symptom:'E7', section:'W10', irisDefault:'08', repair:'A', repairCode:'ELE-DIS-001', description:'Ecran LCD/OLED + vitre tactile' }
    ]
  },
  'ecran-hors-casse': {
    label:       'Remplacement écran (hors casse)',
    description: 'Remplacement écran - défaillance électronique',
    condition:   '5',   // Usure progressive
    symptom:     'E7',  // Affichage défectueux
    section:     'W10', // Ensemble affichage
    irisDefault: '09',  // Défaillance fonctionnelle
    repair:      'A',   // Remplacement
    repairCode:  'ELE-DIS-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'E7', section:'W10', irisDefault:'09', repair:'A', repairCode:'ELE-DIS-001', description:'Ecran défaillant hors casse' },
      { condition:'5', symptom:'E7', section:'W10', irisDefault:'09', repair:'A', repairCode:'ELE-DIS-001', description:'Remplacement écran électronique' },
      { condition:'5', symptom:'E7', section:'W10', irisDefault:'09', repair:'A', repairCode:'ELE-DIS-001', description:'Affichage défectueux' }
    ]
  },
  'batterie': {
    label:       'Remplacement batterie',
    description: 'Remplacement batterie - usure / autonomie insuffisante',
    condition:   '5',
    symptom:     'B4',
    section:     'W4',
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-BAT-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'B4', section:'W4', irisDefault:'09', repair:'A', repairCode:'ELE-BAT-001', description:'Batterie - autonomie insuffisante' },
      { condition:'5', symptom:'B4', section:'W4', irisDefault:'09', repair:'A', repairCode:'ELE-BAT-001', description:'Remplacement batterie Li-ion' },
      { condition:'5', symptom:'B4', section:'W4', irisDefault:'09', repair:'A', repairCode:'ELE-BAT-001', description:'Batterie usure normale' }
    ]
  },
  'haut-parleur': {
    label:       'Remplacement haut-parleur',
    description: 'Remplacement haut-parleur - son absent ou dégradé',
    condition:   '5',
    symptom:     'C5',  // Son défectueux / absent
    section:     'W15', // Haut-parleur / audio
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-SPK-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'C5', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-SPK-001', description:'Haut-parleur défaillant' },
      { condition:'5', symptom:'C5', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-SPK-001', description:'Remplacement haut-parleur' },
      { condition:'5', symptom:'C5', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-SPK-001', description:'Son absent ou dégradé' }
    ]
  },
  'micro': {
    label:       'Remplacement micro',
    description: 'Remplacement microphone - micro défaillant',
    condition:   '5',
    symptom:     'C4',  // Microphone défectueux
    section:     'W15', // Micro / audio entrée
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-MIC-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'C4', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-MIC-001', description:'Micro défaillant' },
      { condition:'5', symptom:'C4', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-MIC-001', description:'Remplacement microphone' },
      { condition:'5', symptom:'C4', section:'W15', irisDefault:'09', repair:'A', repairCode:'ELE-MIC-001', description:'Microphone hors service' }
    ]
  },
  'connecteur': {
    label:       'Remplacement connecteur de charge',
    description: 'Remplacement connecteur de charge - charge impossible',
    condition:   '5',
    symptom:     'F4',  // Charge défectueuse
    section:     'W7',  // Connecteur / port USB
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-CON-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'F4', section:'W7', irisDefault:'09', repair:'A', repairCode:'ELE-CON-001', description:'Connecteur charge défaillant' },
      { condition:'5', symptom:'F4', section:'W7', irisDefault:'09', repair:'A', repairCode:'ELE-CON-001', description:'Remplacement connecteur USB' },
      { condition:'5', symptom:'F4', section:'W7', irisDefault:'09', repair:'A', repairCode:'ELE-CON-001', description:'Charge impossible' }
    ]
  },
  'camera': {
    label:       'Remplacement caméra',
    description: 'Remplacement module caméra - photos/vidéos défectueuses',
    condition:   '5',
    symptom:     'D7',  // Image / caméra défectueuse
    section:     'W17', // Module caméra
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-CAM-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'D7', section:'W17', irisDefault:'09', repair:'A', repairCode:'ELE-CAM-001', description:'Caméra défaillante' },
      { condition:'5', symptom:'D7', section:'W17', irisDefault:'09', repair:'A', repairCode:'ELE-CAM-001', description:'Remplacement module caméra' },
      { condition:'5', symptom:'D7', section:'W17', irisDefault:'09', repair:'A', repairCode:'ELE-CAM-001', description:'Photos/vidéos défectueuses' }
    ]
  },
  'bouton': {
    label:       'Remplacement bouton',
    description: 'Remplacement bouton - bouton non fonctionnel',
    condition:   '5',
    symptom:     'G4',  // Bouton / commande défectueux
    section:     'W8',  // Boutons / commandes
    irisDefault: '09',
    repair:      'A',
    repairCode:  'ELE-BTN-001',
    conditionEX: '',
    irisLines: [
      { condition:'5', symptom:'G4', section:'W8', irisDefault:'09', repair:'A', repairCode:'ELE-BTN-001', description:'Bouton défaillant' },
      { condition:'5', symptom:'G4', section:'W8', irisDefault:'09', repair:'A', repairCode:'ELE-BTN-001', description:'Remplacement bouton' },
      { condition:'5', symptom:'G4', section:'W8', irisDefault:'09', repair:'A', repairCode:'ELE-BTN-001', description:'Bouton non fonctionnel' }
    ]
  }
};

// Remplir les codes IRIS selon la panne sélectionnée
function repQRSelectPanne(panneKey){
  var codes = IRIS_CODES[panneKey];
  var validBox = document.getElementById('rep-iris-valid');
  var checkCard = document.getElementById('rep-iris-checklist-card');

  if(!codes){
    // Vider les champs
    ['iris-condition','iris-symptom','iris-section','iris-default','iris-repair','iris-repaircode','iris-failure-desc'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.value='';
    });
    if(validBox) validBox.innerHTML='';
    return;
  }

  // Remplir automatiquement
  document.getElementById('iris-condition').value  = codes.condition;
  document.getElementById('iris-symptom').value    = codes.symptom;
  document.getElementById('iris-section').value    = codes.section;
  document.getElementById('iris-default').value    = codes.irisDefault;
  document.getElementById('iris-repair').value     = codes.repair;
  document.getElementById('iris-repaircode').value = codes.repairCode;
  document.getElementById('iris-failure-desc').value = codes.description;

  // Pré-remplir description facture si vide
  var descEl = document.getElementById('r-description');
  if(descEl && !descEl.value) {
    descEl.value = codes.label;
    repUpdateFacturePreview();
  }

  // Validation visuelle
  if(validBox){
    validBox.innerHTML = '<span style="color:var(--green);font-size:12px;">✅ Codes IRIS remplis automatiquement · Dossier conforme AgoraPlus</span>';
  }

  repUpdateChecklist();
  repUpdateFacturePreview();
}

// Auto-remplir depuis la panne du dossier (étape 3)


function repQRUpdateOrganisme(){
  var sel = document.getElementById('rep-qr-marque');
  if(!sel) return;
  var marque = sel.value;
  var type = (QR_BRAND_TYPE && QR_BRAND_TYPE[marque]) || 'ecologic';
  var label = type === 'ecosystem' ? 'Ecosystem' : 'Ecologic';
  var orgLabel = document.getElementById('rep-qr-btn-label');
  if(orgLabel) orgLabel.textContent = label;
  var orgEl = document.getElementById('rep-qr-organisme');
  if(orgEl) orgEl.textContent = label;
}

function repQRPopulateMarques(){
  // Les marques sont déjà dans le HTML du select
  // Auto-sélectionner la marque du dossier
  if(!repDossierCourant) return;
  var marque = (repDossierCourant.appareil||{}).marque||'';
  if(!marque) return;
  var sel = document.getElementById('rep-qr-marque');
  if(!sel || sel.value) return;
  // Chercher correspondance
  for(var i=0;i<sel.options.length;i++){
    if(sel.options[i].value.toLowerCase() === marque.toLowerCase()){
      sel.value = sel.options[i].value;
      if(typeof repQRUpdateOrganisme==='function') repQRUpdateOrganisme();
      break;
    }
  }
}

function repQRAutoPanne(){
  if(!repDossierCourant) return;
  var panne = (repDossierCourant.panne||'').toLowerCase();
  var piece = (repDossierCourant.appareil && repDossierCourant.appareil.piece||'').toLowerCase();
  var sel = document.getElementById('rep-qr-panne');
  if(!sel || sel.value) return; // déjà sélectionné

  // Détection automatique selon la panne décrite
  var auto = '';
  if(panne.includes('écran') || panne.includes('ecran') || piece.includes('écran')){
    // Distinguer casse vs fonctionnel
    if(panne.includes('cass') || panne.includes('fissu') || panne.includes('bris') || panne.includes('chut')){
      auto = 'ecran-casse';
    } else {
      auto = 'ecran-hors-casse';
    }
  } else if(panne.includes('batterie') || piece.includes('batterie')){
    auto = 'batterie';
  } else if(panne.includes('haut-parleur') || panne.includes('son') || piece.includes('parleur')){
    auto = 'haut-parleur';
  } else if(panne.includes('micro')){
    auto = 'micro';
  } else if(panne.includes('charge') || panne.includes('connect') || piece.includes('connecteur')){
    auto = 'connecteur';
  } else if(panne.includes('cam') || piece.includes('cam')){
    auto = 'camera';
  } else if(panne.includes('bouton')){
    auto = 'bouton';
  }

  if(auto){
    sel.value = auto;
    repQRSelectPanne(auto);
    showNotif('Type de panne détecté automatiquement : '+IRIS_CODES[auto].label,'success');
  }
}

// Générer le N° de dossier interne automatiquement
function repGenereDossierInterne(){
  var el = document.getElementById('r-dossier-interne');
  if(!el) return;
  if(!repDossierCourant) return;
  // Utiliser le numéro REP-2026-042 du dossier courant
  el.value = repDossierCourant.numero || '';
}

// Générer la Réf. mobile automatiquement selon marque + modèle
function repGenereRefMobile(){
  var el = document.getElementById('r-ref-mobile');
  if(!el || el.value) return;
  if(!repDossierCourant || !repDossierCourant.appareil) return;
  var marque = (repDossierCourant.appareil.marque||'').toLowerCase();
  var modele = (repDossierCourant.appareil.modele||'').toLowerCase().replace(/\s+/g,'');
  var prefix = {apple:'ip', samsung:'s', xiaomi:'mi', huawei:'hw', google:'px', oneplus:'op', oppo:'op', motorola:'moto', nokia:'nk', wiko:'wk', lg:'lg', sony:'sny'}[marque] || marque.substring(0,2);
  // Extraire numéro du modèle
  var num = modele.replace(/[a-z]/g,'').replace(/[^0-9]/g,'').substring(0,4);
  if(num) el.value = prefix + num;
  else el.value = prefix + modele.substring(0,6);
}

// Checklist de conformité dossier
function repUpdateChecklist(){
  var card = document.getElementById('rep-iris-checklist-card');
  var box  = document.getElementById('rep-iris-checklist');
  if(!card||!box||!repDossierCourant) return;

  var c = repDossierCourant.client||{};
  var a = repDossierCourant.appareil||{};
  var items = [
    { label: 'Nom du client',           ok: !!(c.nom), val: c.nom||'' },
    { label: 'Prénom',                  ok: !!(c.prenom), val: c.prenom||'' },
    { label: 'Téléphone',               ok: !!(c.tel), val: c.tel||'' },
    { label: 'Email',                   ok: !!(c.email), val: c.email||'' },
    { label: 'Code postal',             ok: true, val: c.cp||'(facultatif)' },
    { label: 'Ville',                   ok: true, val: c.ville||'(facultatif)' },
    { label: 'Marque appareil',         ok: !!(a.marque), val: a.marque||'' },
    { label: 'Modèle',                  ok: !!(a.modele), val: a.modele||'' },
    { label: 'IMEI / N° série',         ok: !!(a.imei), val: a.imei||'' },
    { label: 'N° dossier interne',      ok: !!(document.getElementById('r-dossier-interne')||{value:''}).value, val: (document.getElementById('r-dossier-interne')||{value:''}).value },
    { label: 'Réf. commerciale mobile', ok: !!(document.getElementById('r-ref-mobile')||{value:''}).value, val: (document.getElementById('r-ref-mobile')||{value:''}).value },
    { label: 'Prix TTC renseigné',      ok: !!parseFloat((document.getElementById('r-prix')||{value:0}).value), val: '' },
    { label: 'Type de panne sélectionné', ok: !!(document.getElementById('rep-qr-panne')||{value:''}).value, val: '' },
    { label: 'Codes IRIS remplis',      ok: !!(document.getElementById('iris-symptom')||{value:''}).value, val: '' },
  ];

  var allOk = items.every(function(i){ return i.ok; });
  card.style.display = 'block';
  box.innerHTML = items.map(function(i){
    return '<div style="display:flex;align-items:center;gap:8px;padding:2px 0;">'+
      '<span style="font-size:14px;">'+(i.ok?'✅':'❌')+'</span>'+
      '<span style="font-size:12px;'+(i.ok?'':'color:var(--red);font-weight:700;')+'">'+i.label+
        (i.val?' <span style="color:var(--text-muted);font-weight:400;">('+i.val+')</span>':'')+'</span>'+
    '</div>';
  }).join('') +
  (allOk ? '<div style="margin-top:10px;padding:8px 12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:var(--green);font-weight:700;">✅ Dossier complet — Prêt pour l\'envoi AgoraPlus</div>'
          : '<div style="margin-top:10px;padding:8px 12px;background:#fef2f2;border-radius:8px;font-size:12px;color:var(--red);font-weight:700;">⚠️ Complétez les champs manquants avant d\'envoyer</div>');
}

function repToggleIRISEdit(){
  var fields = ['iris-condition','iris-symptom','iris-section','iris-default','iris-repair','iris-repaircode'];
  var btn = document.getElementById('rep-iris-edit-btn');
  var first = document.getElementById('iris-condition');
  if(!first) return;
  var isReadOnly = first.readOnly;
  fields.forEach(function(id){
    var el=document.getElementById(id); if(el) el.readOnly = !isReadOnly;
  });
  if(btn) btn.textContent = isReadOnly ? '🔒 Verrouiller' : '✏️ Modifier';
}

// Override unique repGoStep — step 3 (signature + HT) + step 4 (IRIS/QR)
var _repGoStepBase = repGoStep;
repGoStep = function(n){
  _repGoStepBase(n);  // D'abord afficher le step (display:block)

  // ── STEP 3 : Signature + Décomposition HT ──
  if(n===3){
    // Délai 300ms pour que le DOM soit visible et que getBoundingClientRect() fonctionne
    setTimeout(function(){

      // --- Signature canvas ---
      var canvas = document.getElementById('rep-sig-canvas');
      if(canvas){
        // Forcer les dimensions réelles maintenant que le step est visible
        canvas._repInitDone = false;
        var w = canvas.offsetWidth || canvas.parentElement ? canvas.parentElement.offsetWidth : 380;
        if(w > 10){ canvas.width = w; canvas.height = 100; }
        repInitSig();
        repUpdateSigNom();
      }

      // --- Eligibilité ---
      repCheckEligibilite();

      // --- Décomposition HT ---
      var devisEl = document.getElementById('dep-devis');
      if(devisEl && parseFloat(devisEl.value) > 0){
        repAutoDecompose(devisEl.value);
      }

      // --- MO/pièces déjà chargés dans repLoadFormFromDossier ---

      // --- Recharger signature existante ---
      if(repDossierCourant && repDossierCourant.signature && canvas){
        var img = new Image();
        img.onload = function(){ canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); };
        img.src = repDossierCourant.signature;
        _repSigData = repDossierCourant.signature;
        var ok   = document.getElementById('rep-sig-ok');   if(ok)   ok.style.display='block';
        var hint = document.getElementById('rep-sig-hint'); if(hint) hint.style.display='none';
      }

    }, 300);
  }

  // ── STEP 4 : Facture + IRIS / QualiRépar ──
  if(n===4){
    setTimeout(function(){
      var d = repDossierCourant;
      if(!d) return;
      repAutoSave(); // S'assurer que toutes les valeurs sont sauvegardées

      var d2 = repDossierCourant||{};
      var appareil2 = ((d2.appareil||{}).marque||'')+' '+((d2.appareil||{}).modele||'');

      // 1. Prix → depuis devis (champ ou dossier)
      var devisVal = (document.getElementById('dep-devis')||{value:''}).value ||
                     (d2.devis ? String(d2.devis) : '');
      var rPrix = document.getElementById('r-prix');
      if(rPrix && (!rPrix.value || rPrix.value === '0')) rPrix.value = devisVal;

      // 2. Description officielle depuis panne (champ ou dossier)
      var panneVal = (document.getElementById('dep-panne')||{value:''}).value || d2.panne || '';
      // Aussi vérifier le select de panne
      var panneSelect = document.getElementById('dep-panne-select');
      if(panneSelect && panneSelect.value && !panneVal) panneVal = panneSelect.value;
      var descOfficielle = panneVal ? repPanneToDescriptionFacture(panneVal)+' '+appareil2.trim() : '';
      var rDesc = document.getElementById('r-description');
      if(rDesc && (!rDesc.value)) rDesc.value = descOfficielle;

      // 3. N° dossier = REP-2026-042
      var rDoss = document.getElementById('r-dossier-interne');
      if(rDoss && (!rDoss.value)) rDoss.value = d2.numero||'';

      // 4. Ref commerciale mobile
      var rRef = document.getElementById('r-ref-mobile');
      if(rRef && (!rRef.value) && d2.refMobile) rRef.value = d2.refMobile;

      // 5. QR toujours actif
      var qrActif = document.getElementById('rep-qr-actif');
      if(qrActif){ qrActif.checked = true; if(typeof repToggleQR==='function') repToggleQR(); }

      // 4. IRIS / Marque
      if(typeof repQRPopulateMarques==='function') repQRPopulateMarques();
      var a = d.appareil||{};
      var selMarque = document.getElementById('rep-qr-marque');
      if(selMarque && a.marque && !selMarque.value){
        selMarque.value = a.marque;
        if(typeof repQRUpdateOrganisme==='function') repQRUpdateOrganisme();
      }

      // 5. Générer N° dossier interne + ref mobile
      repGenereDossierInterne();
      repGenereRefMobile();
      setTimeout(repQRAutoPanne, 200);

      repUpdateFacturePreview();
    }, 400);
  }
};
// ============================================================
//  FIN IRIS CODES
// ============================================================

// ============================================================
//  FIN MODULE RÉPARATIONS PARCOURS CLIENT
// ============================================================

// ============================================================
//  IMPORT PHONILAB CSV
// ============================================================
var phonilabData = {}; // mois -> {ttc,cb,especes,cheque,virement,quali}

async function loadPhonilabData(){
  try {
    var res = await supaFetch('phonilab_import','GET',null,'?order=mois.asc');
    if(res) res.forEach(function(r){
      phonilabData[r.mois] = {
        ttc: Number(r.ttc)||0, cb: Number(r.cb)||0,
        especes: Number(r.especes)||0, cheque: Number(r.cheque)||0,
        virement: Number(r.virement)||0, quali: Number(r.quali)||0
      };
    });
  } catch(e){ console.log('Phonilab load error',e); }
}

function importPhonilabCSV(input){
  var file = input.files[0];
  if(!file) return;
  var status = document.getElementById('phonilab-status');
  status.textContent = '⏳ Lecture en cours...';

  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var text = e.target.result;
      var lines = text.split('\n');
      var headers = lines[0].split(';').map(function(h){ return h.replace(/"/g,'').trim(); });
      var iDate    = headers.indexOf('Date valeur');
      var iMontant = headers.indexOf('Montant');
      var iMethode = headers.indexOf('Méthode');

      // Agréger par mois
      var parMois = {};
      for(var i=1;i<lines.length;i++){
        var line = lines[i].trim();
        if(!line) continue;
        var cols = line.split(';').map(function(c){ return c.replace(/^"|"$/g,'').trim(); });
        var date    = cols[iDate];
        var montant = cols[iMontant];
        var methode = cols[iMethode];
        if(!date||!montant||!methode) continue;
        if(methode === 'Avoir') continue;
        var parts = date.split('-');
        if(parts.length < 3) continue;
        var moisKey = parts[2]+'-'+parts[1]; // YYYY-MM
        var val = parseFloat(montant.replace(',','.'))||0;
        if(!parMois[moisKey]) parMois[moisKey] = {ttc:0,cb:0,especes:0,cheque:0,virement:0,quali:0};
        parMois[moisKey].ttc += val;
        if(methode==='CB')                    parMois[moisKey].cb       += val;
        else if(methode==='Espèces')          parMois[moisKey].especes  += val;
        else if(methode==='Chèque')           parMois[moisKey].cheque   += val;
        else if(methode==='Virement')         parMois[moisKey].virement += val;
        else if(methode==='Bonus Réparation') parMois[moisKey].quali    += val;
      }

      var moisKeys = Object.keys(parMois);
      if(!moisKeys.length){ status.textContent = '❌ Aucune donnée trouvée'; return; }

      // Sauvegarder dans phonilab_import (table séparée — ne touche pas au Z de caisse)
      var importes = 0;
      var promesses = moisKeys.map(function(mois){
        var d = parMois[mois];
        var data = {
          mois: mois,
          ttc:      Math.round(d.ttc*100)/100,
          cb:       Math.round(d.cb*100)/100,
          especes:  Math.round(d.especes*100)/100,
          cheque:   Math.round(d.cheque*100)/100,
          virement: Math.round(d.virement*100)/100,
          quali:    Math.round(d.quali*100)/100
        };
        phonilabData[mois] = data;
        importes++;
        // UPSERT via DELETE + INSERT
        return supaFetch('phonilab_import','DELETE',null,'?mois=eq.'+mois)
          .then(function(){ return supaFetch('phonilab_import','POST',data); })
          .catch(function(err){ console.log('upsert error',mois,err); });
      });

      Promise.all(promesses).then(function(){
        var sortedKeys = moisKeys.sort();
        var msg = '✅ '+importes+' mois importés dans Phonilab !';
        msg += ' ⚠️ '+sortedKeys[0]+' peut être incomplet';
        status.textContent = msg;
        input.value = '';
        renderBilan();
        showNotif('Import Phonilab — '+importes+' mois','success');
      });

    } catch(err){
      status.textContent = '❌ Erreur : '+err.message;
      console.error(err);
    }
  };
  reader.readAsText(file, 'ISO-8859-1');
}
// ============================================================
//  FIN IMPORT PHONILAB
// ============================================================


var bonsCommande = [];
var _cmdType = 'reparation';

function saveBonsCommande(){ localStorage.setItem('sp_bons_commande', JSON.stringify(bonsCommande)); }

async function loadBonsCommande(){
  // Charger depuis Supabase en priorité
  try {
    var res = await supaFetch('bons_commande','GET',null,'?order=id.desc');
    if(res && res.length >= 0){
      bonsCommande = res.map(function(x){
        return {
          id: x.id, numero: x.numero, date: x.date,
          type: x.type,
          client: { nom: x.client_nom, tel: x.client_tel },
          detail: x.detail,
          prix: Number(x.prix)||0,
          paye: x.paye||false,
          traite: x.traite||false,
          traiteDate: x.traite_date||''
        };
      });
      saveBonsCommande(); // sync local
    }
  } catch(e){
    // Fallback localStorage
    var local = localStorage.getItem('sp_bons_commande');
    if(local) bonsCommande = JSON.parse(local);
  }
  renderBonsCommande();
}

async function saveBonCommandeSupabase(cmd){
  var data = {
    id: cmd.id, numero: cmd.numero, date: cmd.date,
    type: cmd.type,
    client_nom: cmd.client.nom, client_tel: cmd.client.tel,
    detail: cmd.detail, prix: cmd.prix,
    paye: cmd.paye||false,
    traite: cmd.traite||false,
    traite_date: cmd.traiteDate||null
  };
  try {
    var ex = await supaFetch('bons_commande','GET',null,'?id=eq.'+cmd.id);
    if(ex && ex.length > 0){
      await supaFetch('bons_commande','PATCH',data,'?id=eq.'+cmd.id);
    } else {
      await supaFetch('bons_commande','POST',data);
    }
  } catch(e){ console.log('Erreur save bon commande',e); }
  saveBonsCommande();
}

function setCmdType(type){
  _cmdType = type;
  var isRep = type === 'reparation';
  document.getElementById('cmd-block-rep').style.display  = isRep ? '' : 'none';
  document.getElementById('cmd-block-acc').style.display  = isRep ? 'none' : '';
  document.getElementById('cmd-block-paye').style.display = isRep ? 'none' : '';
  document.getElementById('cmd-type-rep').style.background   = isRep ? 'var(--red)' : '#f8fafc';
  document.getElementById('cmd-type-rep').style.color        = isRep ? '#fff' : 'var(--text-muted)';
  document.getElementById('cmd-type-rep').style.borderColor  = isRep ? 'var(--red)' : 'var(--border)';
  document.getElementById('cmd-type-acc').style.background   = isRep ? '#f8fafc' : 'var(--red)';
  document.getElementById('cmd-type-acc').style.color        = isRep ? 'var(--text-muted)' : '#fff';
  document.getElementById('cmd-type-acc').style.borderColor  = isRep ? 'var(--border)' : 'var(--red)';
}

function genererBonCommande(){
  var nom = document.getElementById('cmd-nom').value.trim();
  var tel = document.getElementById('cmd-tel').value.trim();
  var prix = parseFloat(document.getElementById('cmd-prix').value)||0;
  if(!nom||!tel){ showNotif('Nom et téléphone obligatoires','error'); return; }
  if(!prix){ showNotif('Prix obligatoire','error'); return; }

  var detail = '';
  if(_cmdType === 'reparation'){
    var modele = document.getElementById('cmd-modele').value.trim();
    var piece  = document.getElementById('cmd-piece').value;
    if(!modele||!piece){ showNotif('Modèle et pièce obligatoires','error'); return; }
    detail = modele + ' — ' + piece;
  } else {
    var accNom = document.getElementById('cmd-acc-nom').value.trim();
    if(!accNom){ showNotif('Nom de l\'accessoire obligatoire','error'); return; }
    detail = accNom;
  }

  var paye = _cmdType === 'accessoire' && document.getElementById('cmd-paye').checked;
  var num  = 'CMD-'+new Date().getFullYear()+'-'+String(bonsCommande.length+1).padStart(3,'0');
  var cmd  = {
    id: Date.now(), numero: num,
    date: new Date().toISOString().split('T')[0],
    type: _cmdType, client: {nom, tel},
    detail, prix, paye
  };
  bonsCommande.push(cmd);
  saveBonCommandeSupabase(cmd);
  renderBonsCommande();
  printTicketCommande(cmd);

  // Reset
  ['cmd-nom','cmd-tel','cmd-modele','cmd-acc-nom','cmd-prix'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
  document.getElementById('cmd-piece').value='';
  document.getElementById('cmd-paye').checked=false;
  showNotif('Bon '+num+' créé !','success');
}

function printTicketCommande(c){
  if(!c) return;
  var isRep = c.type === 'reparation';
  var date  = new Date(c.date).toLocaleDateString('fr-FR');
  var now   = new Date();
  var heure = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');

  function line(txt, bold){ return '<div style="color:#000;font-weight:'+(bold?'900':'400')+';white-space:pre-wrap;word-break:break-word;font-family:Courier New,monospace;font-size:13px;">'+txt+'</div>'; }
  function sep(){ return '<div style="border-top:1px dashed #000;margin:4px 0;"></div>'; }
  function center(txt, size, bold){
    return '<div style="color:#000;text-align:center;font-size:'+(size||13)+'px;font-weight:'+(bold?'900':'400')+';line-height:1.3;font-family:Courier New,monospace;">'+txt+'</div>';
  }

  var ticketBody =

    // EN-TÊTE
    center('SOLUTION PHONE', 18, true)+
    center('21 Rue Gambetta - 71000 Macon', 11)+
    center('Tel : 03 85 33 06 89', 11)+
    sep()+

    // Type + numéro
    center(isRep ? '*** REPARATION ***' : '*** ACCESSOIRE ***', 14, true)+
    center(c.numero, 12)+
    center(date+' à '+heure, 11)+
    sep()+

    // Client
    line('Client  : '+c.client.nom)+
    line('Tel     : '+c.client.tel)+
    sep()+

    // Détail
    (isRep
      ? line('Appareil: '+c.detail.split(' — ')[0])+
        line('Piece   : '+c.detail.split(' — ')[1])
      : line('Article : '+c.detail)
    )+
    sep()+

    // Prix
    center(c.prix.toFixed(2)+' EUR', 20, true)+
    (c.paye
      ? center('*** DEJA PAYE ***', 14, true)
      : center('A REGLER A LA REPRISE', 12)
    )+
    sep()+

    // Pied
    center('Merci de votre confiance !', 11)+
    center('www.solutionphone71.fr', 11)+
    '<div style="margin-top:8px;"></div>';

  // Afficher dans un modal au lieu de window.open (compatibilité iPhone)
  var modal = document.getElementById('modal-ticket-commande');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modal-ticket-commande';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#f8fafc;z-index:9999;overflow-y:auto;color-scheme:light;';
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 16px;display:flex;gap:8px;flex-wrap:wrap;margin-top:env(safe-area-inset-top,0px);">' +
      '<button onclick="eposPrint(window._currentTicket)" style="flex:1;min-width:130px;padding:14px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;">🖨️ Epson Direct</button>' +
      '<button onclick="window.print()" style="flex:1;min-width:80px;padding:14px;background:#c0392b;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;">🖨️ PC</button>' +
      '<button onclick="fermerTicket()" style="flex:1;min-width:80px;padding:14px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;">✖ Fermer</button>' +
    '</div>' +
    '<div style="display:flex;justify-content:center;padding:16px;">' +
      '<div class="ticket-box" style="background:#fff!important;color:#000!important;border-radius:8px;padding:16px;width:100%;max-width:380px;font-family:Courier New,monospace;font-size:13px;color-scheme:light;">' + ticketBody + '</div>' +
    '</div>';
  window._currentTicket = c;
  modal.style.display = 'block';
}

function fermerTicket(){
  var m = document.getElementById('modal-ticket-commande');
  if(m) m.style.display = 'none';
}

var VPS_PRINT = 'http://212.227.82.100/print';

function eposPrint(c){
  if(!c) return;
  var isRep = c.type === 'reparation';
  var date  = new Date(c.date).toLocaleDateString('fr-FR');
  var now   = new Date();
  var heure = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function txt(s,bold,dbl){ return '<text bold="'+(bold?'true':'false')+'" width="'+(dbl?'2':'1')+'" height="'+(dbl?'2':'1')+'">'+esc(s)+'</text>'; }
  function align(a){ return '<text align="'+a+'"/>'; }
  function sep(){ return txt('------------------------------------------------\n',false,false); }
  var body =
    align('center')+txt('SOLUTION PHONE\n',true,true)+
    txt('21 Rue Gambetta - 71000 Macon\n',false,false)+
    txt('Tel : 03 85 33 06 89\n',false,false)+sep()+
    txt((isRep?'*** REPARATION ***':'*** ACCESSOIRE ***')+'\n',true,false)+
    txt(esc(c.numero)+'\n',false,false)+
    txt(date+' a '+heure+'\n',false,false)+sep()+
    align('left')+
    txt('Client  : '+esc(c.client.nom)+'\n',false,false)+
    txt('Tel     : '+esc(c.client.tel)+'\n',false,false)+sep()+
    (isRep
      ? txt('Appareil: '+esc(c.detail.split(' — ')[0])+'\n',false,false)+txt('Piece   : '+esc(c.detail.split(' — ')[1]||'')+'\n',false,false)
      : txt('Article : '+esc(c.detail)+'\n',false,false)
    )+sep()+
    align('center')+txt(c.prix.toFixed(2)+' EUR\n',true,true)+
    (c.paye?txt('*** DEJA PAYE ***\n',true,false):txt('A REGLER A LA REPRISE\n',false,false))+sep()+
    txt('Merci de votre confiance !\n',false,false)+
    txt('www.solutionphone71.fr\n',false,false)+
    '<feed line="4"/><cut type="feed"/>';
  var soap =
    '<?xml version="1.0" encoding="utf-8"?>'+
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'+
      '<s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'+body+
      '</epos-print></s:Body></s:Envelope>';
  showNotif('⏳ Envoi à l\'imprimante...','info');
  fetch(VPS_PRINT,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'""'},body:soap})
  .then(function(r){return r.json();})
  .then(function(j){
    if(j.ok){ showNotif('✅ Ticket envoyé !','success'); fermerTicket(); }
    else { showNotif('⚠️ Erreur','error'); }
  })
  .catch(function(e){ showNotif('❌ VPS non joignable','error'); console.error(e); });
}

function renderBonsCommande(){
  var tbody = document.getElementById('commande-table');
  if(!tbody) return;

  var enAttente = bonsCommande.filter(function(c){ return !c.traite; }).reverse();
  var traites   = bonsCommande.filter(function(c){ return c.traite; }).reverse();

  function rowHtml(c){
    var dateFmt = c.traiteDate ? ' <span style="font-size:10px;color:var(--text-muted);">'+fmtDate(c.traiteDate)+'</span>' : '';
    return '<tr style="'+(c.traite?'opacity:0.55;':'')+'">' +
      '<td><b>'+c.numero+'</b></td>'+
      '<td>'+fmtDate(c.date)+'</td>'+
      '<td><span class="badge '+(c.type==='reparation'?'badge-red':'badge-blue')+'">'+(c.type==='reparation'?'🔧':'🎁')+'</span></td>'+
      '<td>'+c.client.nom+'</td>'+
      '<td>'+c.client.tel+'</td>'+
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+c.detail+'</td>'+
      '<td><b>'+c.prix.toFixed(2)+' €</b>'+(c.paye?' <span style="color:var(--green);font-size:11px;">✓</span>':'')+dateFmt+'</td>'+
      '<td style="display:flex;gap:4px;">'+
        (!c.traite ? '<button class="btn btn-sm btn-primary" onclick="envoyerSMSCommande('+c.id+')" title="SMS → Archiver">📱 SMS</button>' : '<span style="font-size:11px;color:var(--green);font-weight:700;">✓ Traité</span>')+
        ' <button class="btn btn-sm" onclick="printTicketCommande(bonsCommande.find(function(x){return x.id==='+c.id+'}))" title="Réimprimer">🖨️</button>'+
        ' <button class="btn btn-sm" onclick="supprimerCommande('+c.id+')" style="color:var(--text-dim)">🗑️</button>'+
      '</td>'+
    '</tr>';
  }

  var html = '';

  // Section À TRAITER
  html += '<tr><td colspan="8" style="background:#f8fafc;padding:8px 12px;font-weight:800;font-size:13px;color:var(--warning);">📬 À traiter ('+enAttente.length+')</td></tr>';
  if(enAttente.length){
    html += enAttente.map(rowHtml).join('');
  } else {
    html += '<tr><td colspan="8" style="text-align:center;padding:12px;color:var(--green);font-weight:700;">✅ Tout est traité !</td></tr>';
  }

  // Section ARCHIVÉS
  if(traites.length){
    html += '<tr><td colspan="8" style="background:#f8fafc;padding:8px 12px;font-weight:800;font-size:13px;color:var(--text-muted);">🗂️ Archivés ('+traites.length+')</td></tr>';
    html += traites.map(rowHtml).join('');
  }

  tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim)">Aucun bon de commande</td></tr>';
}

function envoyerSMSCommande(id){
  var c = bonsCommande.find(function(x){ return x.id === id; });
  if(!c) return;
  var isRep = c.type === 'reparation';
  var msg = isRep
    ? 'Bonjour '+c.client.nom+', votre pièce est arrivée ('+c.detail+'). Vous pouvez passer quand vous voulez. Solution Phone — 03 85 33 06 89'
    : 'Bonjour '+c.client.nom+', votre commande est disponible ('+c.detail+'). Vous pouvez passer quand vous voulez. Solution Phone — 03 85 33 06 89';
  var tel = c.client.tel.replace(/\s/g,'');
  // Marquer comme traité
  c.traite = true;
  c.traiteDate = new Date().toISOString().split('T')[0];
  saveBonCommandeSupabase(c);
  renderBonsCommande();
  showNotif(c.client.nom+' archivé ✓','success');
  // Ouvrir SMS
  setTimeout(function(){ window.location.href = 'sms:'+tel+'?body='+encodeURIComponent(msg); }, 300);
}

function supprimerCommande(id){
  if(!confirm('Supprimer ce bon ?')) return;
  bonsCommande = bonsCommande.filter(function(c){ return c.id !== id; });
  saveBonsCommande();
  try { supaFetch('bons_commande','DELETE',null,'?id=eq.'+id); } catch(e){}
  renderBonsCommande();
}

// ============================================================
//  FIN MODULE BON DE COMMANDE
// ============================================================



var bonsDepot = [];

function saveBonsDepot(){ localStorage.setItem('sp_bons_depot', JSON.stringify(bonsDepot)); }

async function loadBonsDepot(){
  try {
    var res = await supaFetch('bons_depot','GET',null,'?order=id.desc');
    if(res && res.length >= 0){
      bonsDepot = res.map(function(x){
        return {
          id: x.id, numero: x.numero, date: x.date,
          statut: x.statut || 'depot',
          facture: null, qrEnvoi: null,
          client: {
            nom:      x.client_nom||'',
            prenom:   x.client_prenom||'',
            tel:      x.client_tel||'',
            email:    x.client_email||'',
            civilite: x.client_civilite||'',
            adresse:  x.client_adresse||'',
            cp:       x.client_cp||'',
            ville:    x.client_ville||''
          },
          appareil: {
            marque:  x.appareil_marque||'',
            modele:  x.appareil_modele||'',
            imei:    x.appareil_imei||'',
            couleur: x.appareil_couleur||'',
            code:    x.appareil_code||''
          },
          etat: x.etat||[], etatAutre: x.etat_autre||'',
          accessoires: x.accessoires||[],
          panne: x.panne||'',
          devis: Number(x.devis)||0,
          dateRetour: x.date_retour||'',
          obs: x.obs||''
        };
      });
      saveBonsDepot(); // cache local en fallback
    }
  } catch(e){
    // Fallback offline : lire le cache localStorage
    var local = localStorage.getItem('sp_bons_depot');
    if(local){ try{ bonsDepot = JSON.parse(local); }catch(e2){} }
  }
  renderBonsDepot();
  repLoadDossiers();
}

async function saveBonDepotSupabase(d){
  var data = {
    id: d.id, numero: d.numero, date: d.date,
    client_nom: d.client.nom, client_prenom: d.client.prenom, client_civilite: d.client.civilite||'',
    client_tel: d.client.tel, client_email: d.client.email||'',
    client_adresse: d.client.adresse||'', client_cp: d.client.cp||'', client_ville: d.client.ville||'',
    appareil_marque: d.appareil.marque, appareil_modele: d.appareil.modele,
    appareil_imei: d.appareil.imei, appareil_couleur: d.appareil.couleur,
    appareil_code: d.appareil.code,
    etat: d.etat, etat_autre: d.etatAutre,
    accessoires: d.accessoires,
    panne: d.panne, devis: d.devis,
    date_retour: d.dateRetour||null, obs: d.obs
  };
  try {
    var ex = await supaFetch('bons_depot','GET',null,'?id=eq.'+d.id);
    if(ex && ex.length > 0){ await supaFetch('bons_depot','PATCH',data,'?id=eq.'+d.id); }
    else { await supaFetch('bons_depot','POST',data); }
  } catch(e){ console.log('Erreur save bon depot',e); }
  saveBonsDepot();
}

function switchRepTab(tab){
  var tabs = ['depot','commande','facture'];
  tabs.forEach(function(t){
    var el = document.getElementById('tab-'+t);
    var btn = document.getElementById('tab-'+t+'-btn');
    if(el) el.style.display = t===tab ? '' : 'none';
    if(btn){
      btn.style.background = t===tab ? 'var(--red)' : '#f8fafc';
      btn.style.color = t===tab ? '#fff' : 'var(--text-muted)';
    }
  });
}

function getDepotEtat(){
  var etats = [
    {id:'dep-etat-ecran',     label:'Écran fissuré/cassé'},
    {id:'dep-etat-ray-ecran', label:'Rayures écran'},
    {id:'dep-etat-ray-dos',   label:'Rayures dos'},
    {id:'dep-etat-vitre-dos', label:'Vitre arrière cassée'},
    {id:'dep-etat-bouton',    label:'Bouton(s) HS'},
    {id:'dep-etat-hp',        label:'Haut-parleur HS'},
    {id:'dep-etat-micro',     label:'Micro HS'},
    {id:'dep-etat-camera',    label:'Caméra HS'},
    {id:'dep-etat-charge',    label:'Connecteur charge HS'},
    {id:'dep-etat-batterie',  label:'Batterie défaillante'}
  ];
  return etats.filter(function(e){ return document.getElementById(e.id).checked; }).map(function(e){ return e.label; });
}

function getDepotAccessoires(){
  var acc = [
    {id:'dep-acc-coque',    label:'Coque/Étui'},
    {id:'dep-acc-chargeur', label:'Chargeur'},
    {id:'dep-acc-cable',    label:'Câble'},
    {id:'dep-acc-boite',    label:'Boîte d\'origine'},
    {id:'dep-acc-verre',    label:'Protection écran'},
    {id:'dep-acc-autre',    label:'Autre'}
  ];
  var list = acc.filter(function(a){ return document.getElementById(a.id).checked; }).map(function(a){ return a.label; });
  var autreVal = document.getElementById('dep-acc-autre-txt').value.trim();
  if(autreVal) list.push(autreVal);
  return list;
}

function checkBonDepotReady(){
  // Just triggers form field updates - actual validation is in genererBonDepot
}

function genererBonDepot(){
  var civilite = document.getElementById('dep-civilite').value;
  var nom    = document.getElementById('dep-nom').value.trim();
  var prenom = document.getElementById('dep-prenom').value.trim();
  var tel    = document.getElementById('dep-tel').value.trim();
  var marque = document.getElementById('dep-marque').value;
  var modele = document.getElementById('dep-modele').value.trim();
  var panne  = document.getElementById('dep-panne').value.trim();
  if(!civilite || !nom || !tel || !marque || !modele || !panne){
    showNotif('Remplissez les champs obligatoires * (y compris la civilité)','error'); return;
  }
  var num = 'DEP-'+new Date().getFullYear()+'-'+String(bonsDepot.length+1).padStart(3,'0');
  var depot = {
    id: Date.now(), numero: num,
    date: new Date().toISOString().split('T')[0],
    client: { civilite, nom, prenom, tel,
      email: document.getElementById('dep-email').value.trim()
    },
    appareil: {
      marque, modele,
      imei:    document.getElementById('dep-imei').value.trim(),
      couleur: document.getElementById('dep-couleur').value.trim(),
      code:    document.getElementById('dep-code').value.trim()
    },
    etat:         getDepotEtat(),
    etatAutre:    document.getElementById('dep-etat-autre').value.trim(),
    accessoires:  getDepotAccessoires(),
    panne,
    devis:        parseFloat(document.getElementById('dep-devis').value)||0,
    dateRetour:   document.getElementById('dep-date-retour').value,
    obs:          document.getElementById('dep-obs').value.trim()
  };
  bonsDepot.push(depot);
  saveBonDepotSupabase(depot);
  renderBonsDepot();
  printBonDepot(depot);
  // Reset
  document.getElementById('dep-civilite').value='';
  ['dep-nom','dep-prenom','dep-tel','dep-email','dep-imei','dep-couleur','dep-code','dep-panne','dep-devis','dep-date-retour','dep-obs','dep-etat-autre','dep-acc-autre-txt'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('dep-marque').value='';
  document.getElementById('dep-modele').value='';
  ['dep-acc-coque','dep-acc-chargeur','dep-acc-cable','dep-acc-boite','dep-acc-verre','dep-acc-autre','dep-etat-ecran','dep-etat-ray-ecran','dep-etat-ray-dos','dep-etat-vitre-dos','dep-etat-bouton','dep-etat-hp','dep-etat-micro','dep-etat-camera','dep-etat-charge','dep-etat-batterie'].forEach(function(id){ document.getElementById(id).checked=false; });
  showNotif('Bon de dépôt '+num+' créé !','success');
}

function renderBonsDepot(){
  var tbody = document.getElementById('depot-table');
  if(!tbody) return;
  tbody.innerHTML = bonsDepot.slice().reverse().map(function(d){
    return '<tr>'+
      '<td><b>'+d.numero+'</b></td>'+
      '<td>'+fmtDate(d.date)+'</td>'+
      '<td>'+d.client.prenom+' '+d.client.nom+'</td>'+
      '<td>'+d.client.tel+'</td>'+
      '<td>'+d.appareil.marque+' '+d.appareil.modele+'</td>'+
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+d.panne+'</td>'+
      '<td>'+(d.devis?d.devis.toFixed(2)+' €':'—')+'</td>'+
      '<td style="display:flex;gap:4px;">'+
        '<button class="btn btn-sm" onclick="printBonDepot(bonsDepot.find(function(x){return x.id==='+d.id+'}))" title="Réimprimer">🖨️</button>'+
        '<button class="btn btn-sm" onclick="supprimerDepot('+d.id+')" title="Supprimer" style="color:var(--text-dim)">🗑️</button>'+
      '</td>'+
    '</tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-dim)">Aucun bon de dépôt</td></tr>';
}

function supprimerDepot(id){
  if(!confirm('Supprimer ce bon de dépôt ?')) return;
  bonsDepot = bonsDepot.filter(function(d){ return d.id !== id; });
  saveBonsDepot();
  try { supaFetch('bons_depot','DELETE',null,'?id=eq.'+id); } catch(e){}
  renderBonsDepot();
  showNotif('Bon supprimé','success');
}

function printBonDepot(d){
  if(!d) return;
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var dateDepot = new Date(d.date).toLocaleDateString('fr-FR');
  var c = d.client||{};
  var a = d.appareil||{};

  function checkRow(label, checked){
    return '<tr><td style="padding:4px 8px;font-size:11px;color:#333;border-bottom:1px solid #f0f0f0;">'+label+'</td>'+
      '<td style="padding:4px 8px;text-align:center;font-size:14px;border-bottom:1px solid #f0f0f0;">'+(checked?'☑':'☐')+'</td></tr>';
  }

  var etatsAll = ['Écran fissuré/cassé','Rayures écran','Rayures dos','Vitre arrière cassée',
    'Bouton(s) HS','Haut-parleur HS','Micro HS','Caméra HS','Connecteur charge HS','Batterie défaillante'];
  var accAll = ['Coque/Étui','Chargeur','Câble','Boîte d\'origine','Protection écran','Autre'];

  // Décomposition HT
  var devis  = d.devis||0;
  var moHT   = d.moHT||25;
  var pieHT  = d.piecesHT||(devis>0 ? Math.max(0,(devis/1.2)-25) : 0);
  var htTot  = moHT + pieHT;
  var tva    = htTot * 0.2;
  var ttc    = htTot * 1.2;

  // Signature image
  var sigHtml = d.signature
    ? '<img src="'+d.signature+'" style="max-height:60px;max-width:200px;object-fit:contain;">'
    : '<div style="height:50px;border-bottom:1.5px solid #333;margin-top:8px;"></div>';

  var html2 = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
    '<title>DEVIS '+d.numero+' — Solution Phone</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:12px;}.page{width:210mm;min-height:297mm;margin:0 auto;padding:8mm 10mm;}@media print{.no-print{display:none!important;}.page{padding:6mm 8mm;}}@page{size:A4;margin:0;}table{border-collapse:collapse;width:100%;}th,td{padding:6px 10px;}'+
    '</style></head><body>'+

    '<div class="no-print" style="text-align:right;padding:10px;">'+
      '<button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimer</button>'+
    '</div>'+

    '<div class="page">'+

    // EN-TÊTE
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c0392b;padding-bottom:8px;margin-bottom:10px;">'+
      '<div style="display:flex;align-items:center;gap:10px;">'+
        (logo?'<img src="'+logo+'" style="height:45px;width:auto;">':'')+
        '<div>'+
          '<div style="font-size:16px;font-weight:900;color:#c0392b;">SOLUTION PHONE</div>'+
          '<div style="font-size:10px;color:#777;line-height:1.7;">21 Rue Gambetta · 71000 Mâcon<br>03 85 33 06 89 · solution.phone71@gmail.com<br>SIREN : 801 044 785 · TVA : FR10801044785</div>'+
        '</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:22px;font-weight:900;color:#1a1a1a;">DEVIS</div>'+
        '<div style="font-size:13px;font-weight:700;color:#c0392b;">'+d.numero+'</div>'+
        '<div style="font-size:11px;color:#888;">Date : '+dateDepot+'</div>'+
      '</div>'+
    '</div>'+

    // CLIENT + APPAREIL
    '<div style="display:flex;gap:10px;margin-bottom:10px;">'+

      '<div style="flex:1;border:1.5px solid #c0392b;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#c0392b;padding:5px 10px;font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.5px;">👤 Client</div>'+
        '<div style="padding:8px 10px;line-height:1.8;font-size:12px;">'+
          '<b>'+(c.civilite||'')+' '+(c.prenom||'')+' '+c.nom+'</b><br>'+
          (c.adresse?c.adresse+'<br>':'')+
          (c.cp||c.ville?(c.cp||'')+' '+(c.ville||'')+'<br>':'')+
          '📞 '+c.tel+'<br>'+
          (c.email?'✉️ '+c.email:'')+'<br>'+
        '</div>'+
      '</div>'+

      '<div style="flex:1;border:1.5px solid #333;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#333;padding:5px 10px;font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.5px;">📱 Appareil</div>'+
        '<div style="padding:8px 10px;line-height:1.8;font-size:12px;">'+
          '<b>'+a.marque+' '+a.modele+'</b><br>'+
          'IMEI : <b style="font-family:monospace;">'+(a.imei||'—')+'</b><br>'+
          'Réf. commerciale : '+(d.refMobile||a.modele||'—')+'<br>'+
          'Réception : '+dateDepot+'<br>'+
          '<b>N° Réparation : </b>'+(d.numero||'—')+'<br>'+
          (a.couleur?'Couleur : '+a.couleur+'<br>':'')+
        '</div>'+
      '</div>'+
    '</div>'+

    // PANNE
    '<div style="border:1px solid #e8e8e8;border-radius:6px;margin-bottom:10px;overflow:hidden;">'+
      '<div style="background:#f5f5f5;padding:5px 10px;font-size:10px;font-weight:800;color:#333;text-transform:uppercase;letter-spacing:.5px;">🔧 Panne décrite par le client</div>'+
      '<div style="padding:8px 10px;font-size:12px;min-height:30px;">'+(d.panne||'—')+'</div>'+
    '</div>'+

    // DÉCOMPOSITION HT (conforme Ecosystem)
    '<div style="margin-bottom:10px;">'+
      '<table style="border:1.5px solid #2b6cb0;border-radius:6px;overflow:hidden;">'+
        '<thead><tr style="background:#2b6cb0;color:#fff;">'+
          '<th style="text-align:left;font-size:11px;text-transform:uppercase;">Article</th>'+
          '<th style="text-align:right;font-size:11px;">P.U. HT</th>'+
          '<th style="text-align:center;font-size:11px;">Qté</th>'+
          '<th style="text-align:right;font-size:11px;">Total HT</th>'+
          '<th style="text-align:right;font-size:11px;">TVA</th>'+
          '<th style="text-align:right;font-size:11px;">Total TTC</th>'+
        '</tr></thead>'+
        '<tbody>'+
          '<tr><td>Remplacement<br><span style="font-size:10px;color:#666;">'+(d.panne||'Réparation')+'</span></td>'+
            '<td style="text-align:right;">'+moHT.toFixed(2)+' €</td>'+
            '<td style="text-align:center;">1</td>'+
            '<td style="text-align:right;">'+htTot.toFixed(2)+' €</td>'+
            '<td style="text-align:right;">'+tva.toFixed(2)+' €</td>'+
            '<td style="text-align:right;font-weight:700;">'+ttc.toFixed(2)+' €</td>'+
          '</tr>'+
          '<tr style="background:#f0fff4;"><td><b>Bonus Réparation</b><br><span style="font-size:10px;color:#666;">Remise Ecosystem / Ecologic</span></td>'+
            '<td style="text-align:right;">0,00 €</td>'+
            '<td style="text-align:center;">1</td>'+
            '<td style="text-align:right;">0,00 €</td>'+
            '<td style="text-align:right;">—</td>'+
            '<td style="text-align:right;font-weight:700;color:#c0392b;">-25,00 €</td>'+
          '</tr>'+
        '</tbody>'+
        '<tfoot>'+
          '<tr style="background:#f8f8f8;">'+
            '<td colspan="4"><b>Sous-total HT : '+htTot.toFixed(2)+' € · TVA 20% : '+tva.toFixed(2)+' €</b></td>'+
            '<td colspan="2" style="text-align:right;font-size:14px;font-weight:900;color:#c0392b;">TOTAL TTC : '+(d.devis||ttc).toFixed(2)+' €</td>'+
          '</tr>'+
        '</tfoot>'+
      '</table>'+
    '</div>'+

    // ÉTAT + ACCESSOIRES
    '<div style="display:flex;gap:10px;margin-bottom:10px;">'+
      '<div style="flex:1;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#f5f5f5;padding:5px 10px;font-size:10px;font-weight:800;color:#333;text-transform:uppercase;">🔍 État à la remise</div>'+
        '<table>'+etatsAll.map(function(e){ return checkRow(e, d.etat&&Array.isArray(d.etat)&&d.etat.includes(e)); }).join('')+'</table>'+
        (d.etatAutre?'<div style="padding:5px 8px;font-size:10px;color:#666;"><i>'+d.etatAutre+'</i></div>':'')+
      '</div>'+
      '<div style="flex:1;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">'+
        '<div style="background:#f5f5f5;padding:5px 10px;font-size:10px;font-weight:800;color:#333;text-transform:uppercase;">🎁 Accessoires remis</div>'+
        '<table>'+accAll.map(function(a2){ return checkRow(a2, d.accessoires&&Array.isArray(d.accessoires)&&d.accessoires.includes(a2)); }).join('')+'</table>'+
      '</div>'+
    '</div>'+

    // MENTIONS LÉGALES + SIGNATURE
    '<div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10px;color:#92400e;line-height:1.6;">'+
      '<b>Attestation hors garantie :</b> Le client certifie que l\'appareil est hors garantie fabricant et commerciale. '+
      'Garantie réparation : 3 mois sur les pièces remplacées (hors casse, oxydation, usure normale). '+
      'Le Bonus Réparation (-25€) est accordé dans le cadre du dispositif QualiRépar (loi AGEC).'+
    '</div>'+

    '<div style="display:flex;gap:20px;margin-top:8px;">'+
      '<div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:10px;min-height:70px;">'+
        '<div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Signature du client — Bon pour accord</div>'+
        sigHtml+
        '<div style="font-size:9px;color:#aaa;margin-top:4px;">Date : '+dateDepot+'</div>'+
      '</div>'+
      '<div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:10px;min-height:70px;text-align:center;">'+
        '<div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Cachet Solution Phone</div>'+
        (typeof SP_TAMPON!=="undefined"?'<img src="'+SP_TAMPON+'" style="max-height:60px;max-width:180px;object-fit:contain;">':'<div style="height:50px;border-bottom:1px dashed #ddd;"></div>')+
      '</div>'+
    '</div>'+

    '<div style="text-align:center;margin-top:12px;font-size:9px;color:#bbb;border-top:1px solid #eee;padding-top:8px;">'+
      'SOLUTION PHONE · RCS Mâcon B 801 044 785 · www.solution-phone.fr'+
    '</div>'+

    '</div></body></html>';

  var w = window.open('','_blank');
  w.document.write(html2);
  w.document.close();
  setTimeout(function(){ w.print(); }, 500);
}


// ============================================================
//  FIN MODULE BON DE DÉPÔT
// ============================================================



// ============================================================
//  MODULE VENTES SMARTPHONES — RAPPORT COMPTABLE MENSUEL
// ============================================================

var MOIS_NOMS = {
  '01':'Janvier','02':'Février','03':'Mars','04':'Avril',
  '05':'Mai','06':'Juin','07':'Juillet','08':'Août',
  '09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre'
};

function getTVAMarge(achat, vente){
  // TVA sur marge = (vente - achat) / 1.2 * 0.2
  var marge = vente - achat;
  return marge > 0 ? marge - marge/1.2 : 0;
}

function renderVentesSmartphones(){
  var annee = document.getElementById('vs-annee') ? document.getElementById('vs-annee').value : new Date().getFullYear().toString();
  var filtreMois = document.getElementById('vs-mois') ? document.getElementById('vs-mois').value : '';

  // Filtrer les smartphones vendus
  var vendus = phones.filter(function(p){
    if(p.etat !== 'VENDU' || !p.dateVente) return false;
    if(!p.dateVente.startsWith(annee)) return false;
    if(filtreMois && !p.dateVente.startsWith(annee+'-'+filtreMois)) return false;
    return true;
  });

  // Grouper par mois
  var parMois = {};
  vendus.forEach(function(p){
    var mois = p.dateVente.substring(0,7);
    if(!parMois[mois]) parMois[mois] = [];
    parMois[mois].push(p);
  });

  var moisKeys = Object.keys(parMois).sort();

  // Totaux globaux
  var totVente=0, totAchat=0, totMarge=0, totTVA=0;
  vendus.forEach(function(p){
    totVente += p.vente;
    totAchat += p.achat;
    totMarge += (p.vente - p.achat);
    totTVA += getTVAMarge(p.achat, p.vente);
  });

  // Cartes résumé
  document.getElementById('vs-cards').innerHTML =
    '<div class="dash-card"><div class="dash-label">Téléphones vendus</div><div class="dash-value">'+vendus.length+'</div></div>'+
    '<div class="dash-card"><div class="dash-label">CA Ventes TTC</div><div class="dash-value" style="color:var(--blue)">'+totVente.toFixed(2)+' €</div></div>'+
    '<div class="dash-card"><div class="dash-label">Total Achats</div><div class="dash-value">'+totAchat.toFixed(2)+' €</div></div>'+
    '<div class="dash-card"><div class="dash-label">Marge Brute</div><div class="dash-value" style="color:var(--green)">'+totMarge.toFixed(2)+' €</div></div>'+
    '<div class="dash-card"><div class="dash-label">TVA sur marge</div><div class="dash-value" style="color:var(--warning)">'+totTVA.toFixed(2)+' €</div></div>'+
    '<div class="dash-card"><div class="dash-label">Marge HT</div><div class="dash-value" style="color:var(--green)">'+(totMarge-totTVA).toFixed(2)+' €</div></div>';

  if(!moisKeys.length){
    document.getElementById('vs-content').innerHTML =
      '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">📦 Aucun smartphone vendu sur cette période</div>';
    return;
  }

  var html = '';
  var grandVente=0, grandAchat=0, grandMarge=0, grandTVA=0, grandNb=0;

  moisKeys.forEach(function(mois){
    var liste = parMois[mois];
    var parts = mois.split('-');
    var moisLabel = MOIS_NOMS[parts[1]] + ' ' + parts[0];

    var mVente=0, mAchat=0, mMarge=0, mTVA=0;
    liste.forEach(function(p){
      mVente += p.vente;
      mAchat += p.achat;
      mMarge += (p.vente - p.achat);
      mTVA += getTVAMarge(p.achat, p.vente);
    });
    grandVente+=mVente; grandAchat+=mAchat; grandMarge+=mMarge; grandTVA+=mTVA; grandNb+=liste.length;

    html += '<div class="card" style="margin-bottom:18px;">'+
      '<div class="card-header">'+
        '<div>'+
          '<div class="card-title">📅 '+moisLabel+'</div>'+
          '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">'+liste.length+' smartphone'+(liste.length>1?'s':'')+' vendu'+(liste.length>1?'s':'')+' · Marge : <b style="color:var(--green)">'+mMarge.toFixed(2)+'€</b></div>'+
        '</div>'+
        '<div style="display:flex;gap:8px;">'+
          '<button class="btn btn-sm" onclick="printMoisVentes(\''+mois+'\')" style="border-color:var(--red);color:var(--red);">🖨️ Imprimer ce mois</button>'+
          '<button class="btn btn-sm" onclick="exportMoisCSV(\''+mois+'\')" style="border-color:var(--green);color:var(--green);">📥 CSV</button>'+
        '</div>'+
      '</div>'+
      '<div style="overflow-x:auto;">'+
      '<table>'+
        '<thead><tr>'+
          '<th>Modèle</th>'+
          '<th>Stock.</th>'+
          '<th>Grade</th>'+
          '<th>Date vente</th>'+
          '<th>IMEI</th>'+
          '<th>Source</th>'+
          '<th style="text-align:right">Prix Achat</th>'+
          '<th style="text-align:right">Prix Vente</th>'+
          '<th style="text-align:right;color:var(--green)">Marge Brute</th>'+
          '<th style="text-align:right;color:var(--warning)">TVA/marge</th>'+
          '<th style="text-align:right">Marge HT</th>'+
          '<th></th>'+
        '</tr></thead>'+
        '<tbody>'+
        liste.map(function(p, i){
          var marge = p.vente - p.achat;
          var tva = getTVAMarge(p.achat, p.vente);
          var margeHT = marge - tva;
          var bg = i%2===0 ? '' : 'background:rgba(0,0,0,0.02);';
          var source = p.fournisseur ? ('🏢 '+p.fournisseur) : '👤 Particulier';
          return '<tr style="'+bg+'">'+
            '<td><b>'+p.modele+'</b></td>'+
            '<td>'+(p.stockage?p.stockage+'Go':'—')+'</td>'+
            '<td><span class="badge badge-blue">'+(p.grade||'—')+'</span></td>'+
            '<td style="font-size:12px;">'+fmtDate(p.dateVente)+'</td>'+
            '<td style="font-size:11px;color:var(--text-muted)">'+(p.imei||'—')+'</td>'+
            '<td style="font-size:11px;">'+source+'</td>'+
            '<td style="text-align:right">'+p.achat.toFixed(2)+' €</td>'+
            '<td style="text-align:right;font-weight:700">'+p.vente.toFixed(2)+' €</td>'+
            '<td style="text-align:right;color:var(--green);font-weight:700">'+marge.toFixed(2)+' €</td>'+
            '<td style="text-align:right;color:var(--warning)">'+tva.toFixed(2)+' €</td>'+
            '<td style="text-align:right">'+margeHT.toFixed(2)+' €</td>'+
            '<td><button class="btn btn-sm" onclick="annulerVente('+p.id+')" title="Remettre en stock" style="color:var(--text-muted);font-size:11px;">↩️</button></td>'+
          '</tr>';
        }).join('')+
        // Ligne total du mois
        '<tr style="background:rgba(229,62,62,0.1);font-weight:800;border-top:2px solid var(--red);">'+
          '<td colspan="6" style="padding:10px 12px;color:var(--red);">TOTAL '+moisLabel.toUpperCase()+' ('+liste.length+' tél.)</td>'+
          '<td style="text-align:right;padding:10px 12px;">'+mAchat.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:10px 12px;">'+mVente.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:10px 12px;color:var(--green)">'+mMarge.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:10px 12px;color:var(--warning)">'+mTVA.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:10px 12px;">'+(mMarge-mTVA).toFixed(2)+' €</td>'+
          '<td></td>'+
        '</tr>'+
        '</tbody>'+
      '</table></div></div>';
  });

  // Récapitulatif général (si plusieurs mois)
  if(moisKeys.length > 1){
    html += '<div class="card" style="border:2px solid var(--red);background:rgba(229,62,62,0.06);">'+
      '<div class="card-header"><div class="card-title" style="color:var(--red);font-size:18px;">📊 RÉCAPITULATIF '+annee+(filtreMois?' — '+MOIS_NOMS[filtreMois]:'')+'</div></div>'+
      '<table>'+
        '<thead><tr>'+
          '<th>Mois</th><th style="text-align:center">Nb</th>'+
          '<th style="text-align:right">Total Achats</th>'+
          '<th style="text-align:right">CA Ventes TTC</th>'+
          '<th style="text-align:right;color:var(--green)">Marge Brute</th>'+
          '<th style="text-align:right;color:var(--warning)">TVA/marge</th>'+
          '<th style="text-align:right">Marge HT</th>'+
        '</tr></thead><tbody>'+
        moisKeys.map(function(mois, i){
          var liste = parMois[mois];
          var mv=0,ma=0,mm=0,mt=0;
          liste.forEach(function(p){ mv+=p.vente; ma+=p.achat; mm+=(p.vente-p.achat); mt+=getTVAMarge(p.achat,p.vente); });
          var parts=mois.split('-');
          var bg = i%2===0 ? '' : 'background:rgba(0,0,0,0.02);';
          return '<tr style="'+bg+'">'+
            '<td><b>'+MOIS_NOMS[parts[1]]+' '+parts[0]+'</b></td>'+
            '<td style="text-align:center">'+liste.length+'</td>'+
            '<td style="text-align:right">'+ma.toFixed(2)+' €</td>'+
            '<td style="text-align:right;font-weight:700">'+mv.toFixed(2)+' €</td>'+
            '<td style="text-align:right;color:var(--green);font-weight:700">'+mm.toFixed(2)+' €</td>'+
            '<td style="text-align:right;color:var(--warning)">'+mt.toFixed(2)+' €</td>'+
            '<td style="text-align:right">'+(mm-mt).toFixed(2)+' €</td>'+
          '</tr>';
        }).join('')+
        '<tr style="background:var(--red);color:#fff;font-weight:900;font-size:14px;">'+
          '<td style="padding:12px;">TOTAL GÉNÉRAL</td>'+
          '<td style="text-align:center;padding:12px;">'+grandNb+'</td>'+
          '<td style="text-align:right;padding:12px;">'+grandAchat.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:12px;">'+grandVente.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:12px;">'+grandMarge.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:12px;">'+grandTVA.toFixed(2)+' €</td>'+
          '<td style="text-align:right;padding:12px;">'+(grandMarge-grandTVA).toFixed(2)+' €</td>'+
        '</tr>'+
        '</tbody></table>'+
      '<div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:12px 16px;margin-top:14px;font-size:12px;color:var(--text-muted);line-height:1.8;">'+
        '📌 <b style="color:var(--text)">Rappel régime TVA sur la marge (Art. 297 A CGI)</b><br>'+
        'Marge brute = Prix vente - Prix achat &nbsp;·&nbsp; '+
        'TVA sur marge = Marge ÷ 1,2 × 0,2 &nbsp;·&nbsp; '+
        'Marge HT = Marge brute - TVA sur marge'+
      '</div>'+
    '</div>';
  }

  document.getElementById('vs-content').innerHTML = html;
}

function getVentesData(moisFilter){
  var annee = document.getElementById('vs-annee') ? document.getElementById('vs-annee').value : new Date().getFullYear().toString();
  return phones.filter(function(p){
    if(p.etat !== 'VENDU' || !p.dateVente) return false;
    if(!p.dateVente.startsWith(annee)) return false;
    if(moisFilter && !p.dateVente.startsWith(moisFilter)) return false;
    return true;
  });
}

function printMoisVentes(mois){
  var liste = phones.filter(function(p){ return p.etat==='VENDU' && p.dateVente && p.dateVente.startsWith(mois); });
  if(!liste.length){ showNotif('Aucune vente ce mois','error'); return; }
  var logo = typeof SP_LOGO !== 'undefined' ? SP_LOGO : '';
  var parts = mois.split('-');
  var moisLabel = MOIS_NOMS[parts[1]] + ' ' + parts[0];
  var mVente=0, mAchat=0, mMarge=0, mTVA=0;
  liste.forEach(function(p){ mVente+=p.vente; mAchat+=p.achat; mMarge+=(p.vente-p.achat); mTVA+=getTVAMarge(p.achat,p.vente); });

  var rows = liste.map(function(p, i){
    var marge=p.vente-p.achat, tva=getTVAMarge(p.achat,p.vente);
    var bg = i%2===0?'#fff':'#fafafa';
    return '<tr style="background:'+bg+';border-bottom:1px solid #eee;">'+
      '<td style="padding:8px 10px;font-size:12px;font-weight:700;">'+p.modele+(p.stockage?' '+p.stockage+'Go':'')+'</td>'+
      '<td style="padding:8px 10px;font-size:11px;text-align:center;">'+(p.grade||'—')+'</td>'+
      '<td style="padding:8px 10px;font-size:10px;color:#888;font-family:monospace;">'+(p.imei||'—')+'</td>'+
      '<td style="padding:8px 10px;font-size:11px;color:#555;">'+(p.fournisseur?p.fournisseur:'Particulier')+'</td>'+
      '<td style="padding:8px 10px;text-align:right;font-size:12px;">'+p.achat.toFixed(2)+'€</td>'+
      '<td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;">'+p.vente.toFixed(2)+'€</td>'+
      '<td style="padding:8px 10px;text-align:right;font-size:12px;color:#27ae60;font-weight:700;">'+marge.toFixed(2)+'€</td>'+
      '<td style="padding:8px 10px;text-align:right;font-size:12px;color:#e67e22;">'+tva.toFixed(2)+'€</td>'+
      '<td style="padding:8px 10px;text-align:right;font-size:12px;">'+(marge-tva).toFixed(2)+'€</td>'+
    '</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Ventes '+moisLabel+'</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;}.page{width:210mm;min-height:297mm;margin:0 auto;padding:10mm 12mm;}@media print{.no-print{display:none!important;}.page{padding:8mm 10mm;}@page{size:A4 landscape;margin:0;}}</style>'+
    '</head><body>'+
    '<div class="no-print" style="text-align:right;padding:10px;"><button onclick="window.print()" style="background:#c0392b;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimer / PDF</button></div>'+
    '<div class="page">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c0392b;padding-bottom:8px;margin-bottom:12px;">'+
        '<div style="display:flex;align-items:center;gap:12px;">'+(logo?'<img src="'+logo+'" style="height:55px;width:auto;">':'')+
          '<div><div style="font-size:20px;font-weight:900;color:#c0392b;">SOLUTION PHONE</div>'+
          '<div style="font-size:11px;color:#777;">21 Rue Gambetta · 71000 Mâcon · SIRET : 801044785 00021</div></div>'+
        '</div>'+
        '<div style="text-align:right;">'+
          '<div style="font-size:18px;font-weight:900;">VENTES SMARTPHONES</div>'+
          '<div style="font-size:22px;font-weight:900;color:#c0392b;">'+moisLabel+'</div>'+
          '<div style="font-size:10px;color:#999;">TVA sur marge — Art. 297 A CGI</div>'+
        '</div>'+
      '</div>'+
      '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">'+
        '<thead><tr style="background:#c0392b;color:#fff;">'+
          '<th style="padding:8px 10px;text-align:left;font-size:11px;">Modèle</th>'+
          '<th style="padding:8px 10px;text-align:center;font-size:11px;">Grade</th>'+
          '<th style="padding:8px 10px;text-align:left;font-size:11px;">IMEI</th>'+
          '<th style="padding:8px 10px;text-align:left;font-size:11px;">Source</th>'+
          '<th style="padding:8px 10px;text-align:right;font-size:11px;">Prix Achat</th>'+
          '<th style="padding:8px 10px;text-align:right;font-size:11px;">Prix Vente TTC</th>'+
          '<th style="padding:8px 10px;text-align:right;font-size:11px;">Marge Brute</th>'+
          '<th style="padding:8px 10px;text-align:right;font-size:11px;">TVA/marge</th>'+
          '<th style="padding:8px 10px;text-align:right;font-size:11px;">Marge HT</th>'+
        '</tr></thead>'+
        '<tbody>'+rows+
        '<tr style="background:var(--red);color:#fff;font-weight:900;">'+
          '<td colspan="4" style="padding:10px;">TOTAL '+moisLabel.toUpperCase()+' ('+liste.length+' téléphones)</td>'+
          '<td style="padding:10px;text-align:right;">'+mAchat.toFixed(2)+'€</td>'+
          '<td style="padding:10px;text-align:right;">'+mVente.toFixed(2)+'€</td>'+
          '<td style="padding:10px;text-align:right;color:#48bb78;">'+mMarge.toFixed(2)+'€</td>'+
          '<td style="padding:10px;text-align:right;color:#ed8936;">'+mTVA.toFixed(2)+'€</td>'+
          '<td style="padding:10px;text-align:right;">'+(mMarge-mTVA).toFixed(2)+'€</td>'+
        '</tr>'+
        '</tbody></table>'+
      '<div style="background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:10px 14px;font-size:10px;color:#666;line-height:1.8;">'+
        '<b>Régime TVA sur la marge (Art. 297 A du CGI)</b><br>'+
        'Marge brute = Prix de vente TTC − Prix d\'achat &nbsp;·&nbsp; TVA sur marge = Marge ÷ 1,2 × 0,2 &nbsp;·&nbsp; Marge HT = Marge brute − TVA sur marge'+
      '</div>'+
      '<div style="border-top:2px solid #c0392b;margin-top:12px;padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:#aaa;">'+
        '<div>Document généré le '+new Date().toLocaleDateString('fr-FR')+' · Solution Phone · 21 Rue Gambetta · 71000 Mâcon</div>'+
        '<div style="color:#c0392b;font-weight:700;">CONFIDENTIEL — USAGE COMPTABLE</div>'+
      '</div>'+
    '</div><script>window.onload=function(){};<\/script></body></html>';

  var w = window.open('','_blank','width=1100,height=850');
  w.document.write(html);
  w.document.close();
}

function printVentesSmartphones(){
  var annee = document.getElementById('vs-annee') ? document.getElementById('vs-annee').value : new Date().getFullYear().toString();
  var filtreMois = document.getElementById('vs-mois') ? document.getElementById('vs-mois').value : '';
  if(filtreMois){
    printMoisVentes(annee+'-'+filtreMois);
  } else {
    // Imprimer tous les mois
    var moisKeys = [];
    phones.forEach(function(p){
      if(p.etat==='VENDU'&&p.dateVente&&p.dateVente.startsWith(annee)){
        var m=p.dateVente.substring(0,7);
        if(moisKeys.indexOf(m)<0) moisKeys.push(m);
      }
    });
    moisKeys.sort().forEach(function(m){ setTimeout(function(){ printMoisVentes(m); }, 300); });
  }
}

function exportMoisCSV(mois){
  var liste = phones.filter(function(p){ return p.etat==='VENDU' && p.dateVente && p.dateVente.startsWith(mois); });
  var headers = ['Modele','Stockage','Grade','IMEI','Source','Date Vente','Prix Achat','Prix Vente TTC','Marge Brute','TVA sur marge','Marge HT'];
  var rows = liste.map(function(p){
    var marge=p.vente-p.achat, tva=getTVAMarge(p.achat,p.vente);
    return [
      p.modele, (p.stockage||'')+'Go', p.grade||'', p.imei||'',
      p.fournisseur||'Particulier', fmtDate(p.dateVente),
      p.achat.toFixed(2), p.vente.toFixed(2),
      marge.toFixed(2), tva.toFixed(2), (marge-tva).toFixed(2)
    ].join(';');
  });
  var csv = [headers.join(';')].concat(rows).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='Ventes_Smartphones_'+mois+'.csv'; a.click();
  showNotif('Export CSV '+mois+' téléchargé !','success');
}

function exportVentesCSV(){
  var annee = document.getElementById('vs-annee') ? document.getElementById('vs-annee').value : new Date().getFullYear().toString();
  var filtreMois = document.getElementById('vs-mois') ? document.getElementById('vs-mois').value : '';
  var moisFilter = filtreMois ? annee+'-'+filtreMois : null;
  var liste = getVentesData(moisFilter);
  if(!liste.length){ showNotif('Aucune vente à exporter','error'); return; }
  var headers = ['Mois','Modele','Stockage','Grade','IMEI','Source','Date Vente','Prix Achat','Prix Vente TTC','Marge Brute','TVA sur marge','Marge HT'];
  var rows = liste.map(function(p){
    var marge=p.vente-p.achat, tva=getTVAMarge(p.achat,p.vente);
    var parts=(p.dateVente||'').substring(0,7).split('-');
    return [
      MOIS_NOMS[parts[1]]||'',' '+parts[0],
      p.modele, (p.stockage||'')+'Go', p.grade||'', p.imei||'',
      p.fournisseur||'Particulier', fmtDate(p.dateVente),
      p.achat.toFixed(2), p.vente.toFixed(2),
      marge.toFixed(2), tva.toFixed(2), (marge-tva).toFixed(2)
    ].join(';');
  });
  var csv = [headers.join(';')].concat(rows).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='Ventes_Smartphones_'+annee+'.csv'; a.click();
  showNotif('Export CSV complet téléchargé !','success');
}

// ============================================================
//  FIN MODULE VENTES SMARTPHONES
// ============================================================


function renderGmbTab(){
  setGmbStars(5);
  renderGmbSaved();
}

function setGmbStars(n){
  document.getElementById('gmb-stars').value = n;
  ['5','4','3','bad'].forEach(function(k){
    var el = document.getElementById('gmb-star-'+k);
    if(!el) return;
    el.style.borderColor = 'var(--border)';
    el.style.color = 'var(--text-muted)';
  });
  var active = n >= 4 ? document.getElementById('gmb-star-'+n) : document.getElementById('gmb-star-bad');
  if(active){ active.style.borderColor='#f39c12'; active.style.color='#f39c12'; }
}

async function generateGmbResponse(){
  var avis = document.getElementById('gmb-avis-text').value.trim();
  if(!avis){showNotif('Entrez le contenu de l\'avis','error');return;}
  var stars = document.getElementById('gmb-stars').value;
  var prenom = document.getElementById('gmb-avis-prenom').value.trim();
  var btn = document.getElementById('gmb-rep-btn');
  btn.textContent='⏳ Génération...'; btn.disabled=true;
  document.getElementById('gmb-response-result').innerHTML=
    '<div style="text-align:center;padding:20px;color:var(--text-muted);">🤖 L\'IA rédige la réponse...</div>';

  var tonGlobal = parseInt(stars)>=4 ? 'positif' : parseInt(stars)===3 ? 'neutre' : 'négatif';

  var prompt =
    'Tu es responsable de la communication de "Solution Phone", boutique de smartphones reconditionnés et réparations au 21 Rue Gambetta, Mâcon.\n\n'+
    'Avis Google reçu :\nNote : '+stars+'/5 (ton '+tonGlobal+')\n'+
    (prenom?'Prénom : '+prenom+'\n':'')+
    'Avis : "'+avis+'"\n\n'+
    'Rédige 2 réponses professionnelles et authentiques :\n\n'+
    '✅ RÉPONSE COURTE (2-3 lignes) :\n'+
    '- Remercier par le prénom si dispo\n- Répondre au point principal\n- Inviter à revenir\n\n'+
    '📝 RÉPONSE COMPLÈTE (5-7 lignes) :\n'+
    (parseInt(stars)>=4?
      '- Remercier chaleureusement\n- Valoriser ce qui a plu\n- Rappeler les services (réparation, reconditionné, QualiRépar)\n- Inviter à revenir ou recommander':
      '- Reconnaître le problème\n- Proposer une solution (venir en boutique ou appeler le 03 85 33 06 89)\n- Montrer la volonté d\'amélioration')+
    '\n\nTon : humain, professionnel, petite boutique locale à Mâcon.\n\n'+
    'Format EXACT :\n✅ RÉPONSE COURTE :\n[réponse]\n\n📝 RÉPONSE COMPLÈTE :\n[réponse]';

  try{
    var text = await callClaude(prompt);
    var safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('gmb-response-result').innerHTML =
      '<div style="background:#f8fafc;border:1px solid '+(parseInt(stars)>=4?'var(--green)':'var(--warning)')+';border-radius:10px;padding:14px;white-space:pre-wrap;font-size:13px;line-height:1.7;max-height:280px;overflow-y:auto;">'+safe+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'+
      '<button class="btn btn-primary btn-sm" id="gmb-copy-rep">📋 Copier</button>'+
      '<button class="btn btn-sm" style="border-color:var(--green);color:var(--green);" id="gmb-save-rep">💾 Sauvegarder</button>'+
      '</div>';
    document.getElementById('gmb-copy-rep').addEventListener('click',function(){
      navigator.clipboard.writeText(text).then(function(){showNotif('Réponse copiée !','success');});
    });
    document.getElementById('gmb-save-rep').addEventListener('click',function(){
      gmbSaved.unshift({id:Date.now(),date:new Date().toISOString(),stars:stars,avis:avis.substring(0,60)+'...',reponse:text});
      if(gmbSaved.length>20)gmbSaved=gmbSaved.slice(0,20);
      localStorage.setItem('sp_gmb_saved',JSON.stringify(gmbSaved));
      renderGmbSaved();
      showNotif('Sauvegardé !','success');
    });
    showNotif('Réponse générée !','success');
  }catch(e){
    document.getElementById('gmb-response-result').innerHTML='<div style="color:var(--red);padding:14px;">❌ Erreur : '+e.message+'</div>';
  }
  btn.textContent='🤖 Générer la réponse avec l\'IA'; btn.disabled=false;
}

function renderGmbSaved(){
  var el = document.getElementById('gmb-saved-list');
  if(!el) return;
  if(!gmbSaved.length){
    el.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;font-size:13px;">Aucune réponse sauvegardée</div>';
    return;
  }
  el.innerHTML = gmbSaved.map(function(s,i){
    var c = parseInt(s.stars)>=4?'var(--green)':parseInt(s.stars)===3?'var(--warning)':'var(--red)';
    return '<div style="padding:10px;border-bottom:1px solid var(--border);">'+
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">'+
      '<div style="flex:1;cursor:pointer;" onclick="copyGmbSaved('+i+')">'+
      '<div style="font-size:11px;color:'+c+';font-weight:700;margin-bottom:2px;">'+s.stars+'/5 ⭐ · '+new Date(s.date).toLocaleDateString('fr-FR')+'</div>'+
      '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">"'+s.avis+'"</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px;flex-shrink:0;">'+
      '<button class="btn btn-sm" onclick="copyGmbSaved('+i+')">📋</button>'+
      '<button class="btn btn-sm" style="border-color:var(--red);color:var(--red);" onclick="deleteGmbSaved('+i+')">🗑️</button>'+
      '</div></div></div>';
  }).join('');
}

function copyGmbSaved(i){
  var s=gmbSaved[i];if(!s)return;
  navigator.clipboard.writeText(s.reponse).then(function(){showNotif('Réponse copiée !','success');});
}

function deleteGmbSaved(i){
  if(!confirm('Supprimer ?'))return;
  gmbSaved.splice(i,1);
  localStorage.setItem('sp_gmb_saved',JSON.stringify(gmbSaved));
  renderGmbSaved();
}

async function generateGmbPost(){
  var type = document.getElementById('gmb-post-type').value;
  var details = document.getElementById('gmb-post-details').value.trim();
  var btn = document.getElementById('gmb-post-btn');
  btn.textContent='⏳ Génération...'; btn.disabled=true;

  var stockDispo = phones.filter(function(p){return p.etat==='DISPONIBLE';}).slice(0,4)
    .map(function(p){return p.modele+(p.stockage?' '+p.stockage+'Go':'')+' à '+p.vente+'€';}).join(', ');

  var prompt =
    'Tu es community manager pour "Solution Phone", boutique de smartphones reconditionnés et réparations au 21 Rue Gambetta, Mâcon.\n\n'+
    'Crée un post Google My Business optimisé pour le SEO local.\n\n'+
    'Type : '+type+'\n'+
    (details?'Informations : '+details+'\n':'')+
    (stockDispo?'Stock dispo : '+stockDispo+'\n':'')+
    '\nRègles :\n'+
    '- 150-300 mots max\n'+
    '- Mots-clés locaux : Mâcon, 71000, Saône-et-Loire\n'+
    '- Mentionner les services si pertinent : réparation, reconditionné, QualiRépar\n'+
    '- Call-to-action : venez en boutique, appelez le 03 85 33 06 89\n'+
    '- Terminer par : 📍 21 Rue Gambetta, Mâcon\n'+
    '- Pas de hashtags (inutiles sur Google)\n\n'+
    'Rédige directement le post, sans introduction ni commentaire.';

  var resultEl = document.getElementById('gmb-post-result');
  resultEl.style.display='block';
  resultEl.innerHTML='<div style="text-align:center;padding:16px;color:var(--text-muted);">🤖 Rédaction en cours...</div>';

  try{
    var text = await callClaude(prompt);
    var safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    resultEl.innerHTML =
      '<div style="background:#f8fafc;border:1px solid var(--blue);border-radius:10px;padding:14px;white-space:pre-wrap;font-size:13px;line-height:1.7;max-height:250px;overflow-y:auto;">'+safe+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'+
      '<button class="btn btn-primary btn-sm" id="gmb-post-copy">📋 Copier</button>'+
      '<a href="https://business.google.com/posts/create" target="_blank" class="btn btn-sm" style="border-color:#4285f4;color:#4285f4;text-decoration:none;">🌐 Publier sur Google →</a>'+
      '</div>';
    document.getElementById('gmb-post-copy').addEventListener('click',function(){
      navigator.clipboard.writeText(text).then(function(){showNotif('Post copié !','success');});
    });
    showNotif('Post Google généré !','success');
  }catch(e){
    resultEl.innerHTML='<div style="color:var(--red);padding:14px;">❌ Erreur : '+e.message+'</div>';
  }
  btn.textContent='🤖 Générer le post Google'; btn.disabled=false;
}

// ============================================================
//  FIN MODULE GOOGLE MY BUSINESS
// ============================================================

// ============================================================
//  MODULE ROUE CADEAUX — Supabase
// ============================================================

var RL_DEFAULT_PRIZES = [
  { label: "Protection d'écran offerte", emoji: '🛡️', color: '#b91c1c', weight: 20 },
  { label: 'Nettoyant écran offert',      emoji: '🧴', color: '#991b1b', weight: 15 },
  { label: '-10% prochaine réparation',   emoji: '⚡', color: '#7f1d1d', weight: 15 },
  { label: 'Housse de protection offerte',emoji: '🎁', color: '#c0392b', weight: 20 },
  { label: 'Câble de charge offert',      emoji: '🔌', color: '#a93226', weight: 20 },
  { label: '-5€ prochaine réparation',    emoji: '💶', color: '#922b21', weight: 10 },
];
var rlPrizes = [];
var rlGoogleUrl = '';

function initRouletteAdmin() {
  supaFetch('roulette_config','GET',null,'?id=eq.1').then(function(res){
    if(res && res[0]){
      rlGoogleUrl = res[0].google_url || '';
      rlPrizes    = res[0].prizes    || JSON.parse(JSON.stringify(RL_DEFAULT_PRIZES));
    } else {
      rlPrizes    = JSON.parse(JSON.stringify(RL_DEFAULT_PRIZES));
      rlGoogleUrl = 'https://g.page/r/CbyQ_wiFpddjEBM/review';
    }
    document.getElementById('rl-google-url').value = rlGoogleUrl;
    var rouletteUrl = 'https://solution-phone.fr/roulette.html';
    var lnk = document.getElementById('rl-preview-link');
    if(lnk){ lnk.href = rouletteUrl; }
    var qrDiv = document.getElementById('rl-qr');
    if(qrDiv){
      qrDiv.innerHTML = '<img id="rl-qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(rouletteUrl)+'&bgcolor=ffffff&color=1a1a1a&format=png" style="border-radius:8px;width:160px;height:160px;" crossorigin="anonymous">';
    }
    rlRenderPrizes();
  }).catch(function(){
    rlPrizes    = JSON.parse(JSON.stringify(RL_DEFAULT_PRIZES));
    rlGoogleUrl = '';
    rlRenderPrizes();
  });
}

function rlRenderPrizes() {
  var tbody = document.getElementById('rl-prizes-tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  var total = rlPrizes.reduce(function(s,p){ return s + p.weight; }, 0);
  rlPrizes.forEach(function(p, i) {
    var pct = total > 0 ? ((p.weight / total) * 100).toFixed(0) : 0;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input value="'+p.emoji+'" style="width:52px;text-align:center;font-size:20px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:4px;color:var(--text);" onchange="rlPrizes['+i+'].emoji=this.value"></td>'+
      '<td><input value="'+p.label.replace(/"/g,'&quot;')+'" style="width:100%;background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:13px;" onchange="rlPrizes['+i+'].label=this.value"></td>'+
      '<td><input type="color" value="'+p.color+'" style="width:44px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none;" onchange="rlPrizes['+i+'].color=this.value"></td>'+
      '<td><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="1" max="50" value="'+p.weight+'" style="width:90px;" oninput="rlPrizes['+i+'].weight=+this.value;rlRenderPrizes()"><span style="font-size:13px;color:var(--text-muted);min-width:40px;">'+pct+'%</span></div></td>'+
      '<td><button class="btn btn-sm" style="color:var(--red);border-color:rgba(229,62,62,0.3);" onclick="rlRemovePrize('+i+')">✕</button></td>';
    tbody.appendChild(tr);
  });
  var tot = document.getElementById('rl-total-display');
  if(tot) tot.textContent = 'Total : '+rlPrizes.length+' lots';
}

function rlAddPrize() {
  rlPrizes.push({ label: 'Nouveau lot', emoji: '🎁', color: '#c0392b', weight: 10 });
  rlRenderPrizes();
}

function rlRemovePrize(i) {
  if(rlPrizes.length <= 2){ showNotif('Minimum 2 lots requis','error'); return; }
  rlPrizes.splice(i, 1);
  rlRenderPrizes();
}

function rlSaveConfig() {
  rlGoogleUrl = document.getElementById('rl-google-url').value.trim();
  var data = { google_url: rlGoogleUrl, prizes: rlPrizes, updated_at: new Date().toISOString() };
  supaFetch('roulette_config','PATCH',data,'?id=eq.1').then(function(){
    showNotif('✅ Configuration roulette enregistrée !', 'success');
  }).catch(function(){
    showNotif('❌ Erreur sauvegarde Supabase', 'error');
  });
}

function rlDownloadQR() {
  var img = document.getElementById('rl-qr-img');
  if(!img){ showNotif('QR introuvable','error'); return; }
  var a = document.createElement('a');
  a.href = img.src;
  a.download = 'qr-roulette-solution-phone.png';
  a.click();
}

// ============================================================
//  FIN MODULE ROUE CADEAUX
// ============================================================
