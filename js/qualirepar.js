// ============================================================
//  MODULE QUALIREPAR — Solution Phone
// ============================================================

var QR_BRAND_TYPE = {
  Apple:     'ecologic',
  Samsung:   'ecosystem', Huawei:    'ecosystem', Oppo:      'ecosystem',
  Honor:     'ecosystem', Blackview: 'ecosystem', Vivo:      'ecosystem',
  TCL:       'ecosystem',
  Xiaomi:    'ecologic',  OnePlus:   'ecologic',  Google:    'ecologic',
  Sony:      'ecologic',  Nokia:     'ecologic',  Motorola:  'ecologic',
  Wiko:      'ecologic',  Realme:    'ecologic',  Crosscall: 'ecologic',
  LG:        'ecologic'
};
var QR_BRANDS = Object.keys(QR_BRAND_TYPE);

var qrData = {
  step: 1,
  client: {},
  appareil: {},
  devis: { prixHT: 0, bonusActif: false, signature: null },
  refRep: '',
  pennylaneOK: false,
  agoraOK: false,
  stream: null
};

function qrInit() {
  // Reset
  qrData = {
    step: 1, client: {}, appareil: {},
    devis: { prixHT: 0, bonusActif: false, signature: null },
    refRep: 'SO_' + Math.random().toString(36).substr(2, 8).toUpperCase(),
    pennylaneOK: false, agoraOK: false, stream: null
  };
  // Reset fields
  ['qr-prenom','qr-nom','qr-tel','qr-email','qr-adresse','qr-cp','qr-ville',
   'qr-modele','qr-imei','qr-prix-ht'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var selCiv = document.getElementById('qr-civilite'); if(selCiv) selCiv.value = '';
  var sel = document.getElementById('qr-type-rep'); if(sel) sel.value = '';
  var imgPrev = document.getElementById('qr-imei-preview'); if(imgPrev){imgPrev.style.display='none';imgPrev.src='';}
  var ocrSt = document.getElementById('qr-ocr-status'); if(ocrSt) ocrSt.style.display='none';
  var imeiOk = document.getElementById('qr-imei-ok'); if(imeiOk) imeiOk.style.display='none';
  qrClearSig();

  // Reset tous les boutons marque
  document.querySelectorAll('.qr-marque-btn').forEach(function(b){b.classList.remove('active','apple');});

  // Render marques
  qrRenderMarques();
  // Steps
  for(var i=1;i<=4;i++){
    var el = document.getElementById('qr-step-'+i);
    if(el) el.style.display = i===1 ? '' : 'none';
  }
  qrRenderStepsBar();
  qrValidStep1();
}

function qrRenderMarques() {
  var container = document.getElementById('qr-marques');
  if(!container) return;
  if(container.children.length > 0) return; // already rendered
  QR_BRANDS.forEach(function(m){
    var btn = document.createElement('button');
    btn.className = 'qr-marque-btn';
    btn.textContent = m;
    btn.onclick = function(){ qrSelectMarque(m); };
    container.appendChild(btn);
  });
}

function qrSelectMarque(marque) {
  qrData.appareil.marque = marque;
  qrData.appareil.bonusType = QR_BRAND_TYPE[marque] || null;
  document.querySelectorAll('.qr-marque-btn').forEach(function(b){
    b.classList.remove('active','apple');
    if(b.textContent === marque){
      b.classList.add('active');
      if(marque === 'Apple') b.classList.add('apple');
    }
  });
  // Badge bonus
  var badge = document.getElementById('qr-bonus-badge');
  if(badge){
    if(qrData.appareil.bonusType){
      var isEco = qrData.appareil.bonusType === 'ecosystem';
      badge.style.display = '';
      badge.innerHTML = '<span class="badge '+(isEco?'badge-blue':'badge-green')+'">'+(isEco?'🔵 Ecologic (Apple)':'🟢 Ecologic')+'</span>'+
        '<span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Bonus -25€ applicable</span>';
    } else {
      badge.style.display = 'none';
    }
  }
  qrValidStep2();
}

function qrRenderStepsBar() {
  var bar = document.getElementById('qr-steps-bar');
  if(!bar) return;
  var labels = ['Client','Appareil','Devis','Finalisé'];
  var html = '';
  for(var i=0;i<labels.length;i++){
    var cls = i+1 < qrData.step ? 'done' : i+1 === qrData.step ? 'active' : 'todo';
    html += '<div class="qr-step-dot '+cls+'">'+(cls==='done'?'✓':(i+1))+'</div>';
    if(i < labels.length-1){
      html += '<div class="qr-step-line '+(i+1 < qrData.step?'done':'')+'"></div>';
    }
  }
  bar.innerHTML = html;
}

function qrGoStep(n) {
  // Masquer current
  var cur = document.getElementById('qr-step-'+qrData.step);
  if(cur) cur.style.display = 'none';
  qrData.step = n;
  // Show next
  var next = document.getElementById('qr-step-'+n);
  if(next) next.style.display = '';
  qrRenderStepsBar();
  if(n === 3) qrCalcTotal();
  if(n === 4) qrRenderFinal();
  window.scrollTo(0,0);
}

// ── Validation étape 1 ──
function qrValidStep1() {
  var btn = document.getElementById('qr-btn-1');
  if(!btn) return;
  var ok = document.getElementById('qr-civilite').value !== '' && ['qr-prenom','qr-nom','qr-tel','qr-email','qr-adresse','qr-cp','qr-ville','qr-cp','qr-ville'].every(function(id){
    var el = document.getElementById(id); return el && el.value.trim().length > 0;
  });
  btn.disabled = !ok;
  if(ok){
    var adresseQR = getAdresse('qr');
    qrData.client = {
      prenom:  document.getElementById('qr-prenom').value.trim(),
      nom:     document.getElementById('qr-nom').value.trim(),
      tel:     document.getElementById('qr-tel').value.trim(),
      email:   document.getElementById('qr-email').value.trim(),
      adresse: adresseQR,
      adresse_rue: document.getElementById('qr-adresse').value.trim(),
      cp:      document.getElementById('qr-cp').value.trim(),
      ville:   document.getElementById('qr-ville').value.trim()
    };
  }
}

// ── Validation étape 2 ──
function qrValidStep2() {
  var btn = document.getElementById('qr-btn-2');
  if(!btn) return;
  var marque  = qrData.appareil.marque || '';
  var modele  = (document.getElementById('qr-modele')||{}).value||'';
  var typeRep = (document.getElementById('qr-type-rep')||{}).value||'';
  var imei    = (document.getElementById('qr-imei')||{}).value||'';
  var ok = marque && modele.trim() && typeRep && imei.length >= 15;
  btn.disabled = !ok;
  // Badge IMEI
  var badge = document.getElementById('qr-imei-ok');
  if(badge) badge.style.display = imei.length===15 ? '' : 'none';
  if(ok){
    qrData.appareil.modele  = modele.trim();
    qrData.appareil.typeRep = typeRep;
    qrData.appareil.imei    = imei;
  }
}

// ── Calcul total devis ──
function qrCalcTotal() {
  var ht    = parseFloat(document.getElementById('qr-prix-ht').value) || 0;
  var tva   = ht * 0.2;
  var ttc   = ht + tva;
  var bonusType = qrData.appareil.bonusType;
  var bonusCheck = document.getElementById('qr-bonus-check');
  var bonusActif = bonusType && bonusCheck && bonusCheck.checked;
  var total = bonusActif ? ttc - 25 : ttc;

  qrData.devis.prixHT    = ht;
  qrData.devis.bonusActif= !!bonusActif;

  // Toggle bonus row visibility
  var bonusTog = document.getElementById('qr-bonus-toggle');
  if(bonusTog){
    bonusTog.style.display = bonusType ? '' : 'none';
    var lbl = document.getElementById('qr-bonus-type-label');
    if(lbl) lbl.textContent = '(Ecologic)';
  }

  // Render tableau
  var tbody = document.getElementById('qr-devis-tbody');
  if(!tbody) return;
  tbody.innerHTML =
    '<tr><td>Remplacement '+(qrData.appareil.typeRep||'—')+'<br><small style="color:var(--text-muted)">'+
    (qrData.appareil.marque||'')+' '+(qrData.appareil.modele||'')+'</small></td>'+
    '<td style="text-align:right">'+ht.toFixed(2)+' €</td>'+
    '<td style="text-align:right">'+tva.toFixed(2)+' €</td>'+
    '<td style="text-align:right;font-weight:700">'+ttc.toFixed(2)+' €</td></tr>'+
    (bonusActif?
      '<tr class="qr-bonus-row"><td>Bonus Réparation — Remise '+(bonusType==='ecosystem'?'Ecosystem Ecologic':'Ecologic')+'</td>'+
      '<td style="text-align:right">0,00 €</td><td style="text-align:right">—</td>'+
      '<td style="text-align:right">-25,00 €</td></tr>':'');

  // Total band
  var disp = document.getElementById('qr-total-display');
  if(disp) disp.textContent = total.toFixed(2)+' €';

  qrValidStep3();
}

// ── Validation étape 3 ──
function qrValidStep3() {
  var btn = document.getElementById('qr-btn-3');
  if(!btn) return;
  var ht = parseFloat((document.getElementById('qr-prix-ht')||{}).value)||0;
  var hasSig = !!(qrData.devis.signature);
  btn.disabled = !(ht > 0 && hasSig);
}

// ── Signature canvas ──
(function(){
  var _drawing = false, _last = null;
  function init(){
    var canvas = document.getElementById('qr-sig-canvas');
    if(!canvas) return;
    function getPos(e){
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      if(e.touches) return { x:(e.touches[0].clientX - rect.left)*scaleX, y:(e.touches[0].clientY - rect.top)*scaleY };
      return { x:(e.clientX - rect.left)*scaleX, y:(e.clientY - rect.top)*scaleY };
    }
    function start(e){ e.preventDefault(); _drawing=true; _last=getPos(e); }
    function move(e){
      if(!_drawing) return; e.preventDefault();
      var ctx = canvas.getContext('2d');
      var p = getPos(e);
      ctx.beginPath(); ctx.moveTo(_last.x,_last.y); ctx.lineTo(p.x,p.y);
      ctx.strokeStyle='#4299e1'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
      _last = p;
      qrData.devis.signature = canvas.toDataURL();
      var hint = document.getElementById('qr-sig-hint');
      if(hint) hint.textContent = '✍️ Signature en cours...';
      qrValidStep3();
    }
    function end(){ _drawing = false; }
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, {passive:false});
    canvas.addEventListener('touchmove', move, {passive:false});
    canvas.addEventListener('touchend', end);
  }
  // Init once the DOM is ready
  document.addEventListener('DOMContentLoaded', init);
  // Also try immediately in case DOM is already ready
  if(document.readyState !== 'loading') init();
})();

function qrClearSig() {
  var canvas = document.getElementById('qr-sig-canvas');
  if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  qrData.devis.signature = null;
  var hint = document.getElementById('qr-sig-hint');
  if(hint) hint.textContent = '← Signez ci-dessus →';
  qrValidStep3();
}

// ── OCR IMEI via Claude Vision ──
async function qrExtractIMEI(base64Image) {
  var key = getIgApiKey();
  if(!key) throw new Error('Clé API manquante');
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
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
          { type: 'text', text: "Extrait uniquement le numéro IMEI de cette image. L'IMEI est un numéro de 15 chiffres. Réponds UNIQUEMENT avec le numéro IMEI sans aucun autre texte. Si tu ne trouves pas d'IMEI, réponds 'NON_TROUVE'." }
        ]
      }]
    })
  });
  var data = await resp.json();
  var text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : 'NON_TROUVE';
  var match = text.match(/\d{15}/);
  return match ? match[0] : null;
}

async function qrProcessImage(dataUrl) {
  var preview = document.getElementById('qr-imei-preview');
  var status  = document.getElementById('qr-ocr-status');
  if(preview){ preview.src = dataUrl; preview.style.display = 'block'; }
  if(status){
    status.style.display = '';
    status.style.background = 'rgba(66,153,225,0.1)';
    status.style.border = '1px solid var(--blue)';
    status.style.color = 'var(--blue)';
    status.innerHTML = '⚙️ Lecture de l\'IMEI en cours... (IA Claude Vision)';
  }
  try {
    var base64 = dataUrl.split(',')[1];
    var imei = await qrExtractIMEI(base64);
    if(imei){
      document.getElementById('qr-imei').value = imei;
      if(status){
        status.style.background = 'rgba(72,187,120,0.1)';
        status.style.border = '1px solid var(--green)';
        status.style.color = 'var(--green)';
        status.innerHTML = '✅ IMEI détecté : <b>'+imei+'</b> — Vérifiez et corrigez si nécessaire';
      }
    } else {
      if(status){
        status.style.background = 'rgba(237,137,54,0.1)';
        status.style.border = '1px solid var(--warning)';
        status.style.color = 'var(--warning)';
        status.innerHTML = '⚠️ IMEI non détecté automatiquement — Saisissez manuellement ci-dessous';
      }
    }
  } catch(e){
    if(status){
      status.style.background = 'rgba(229,62,62,0.1)';
      status.style.border = '1px solid var(--red)';
      status.style.color = 'var(--red)';
      status.innerHTML = '❌ Erreur OCR : '+e.message;
    }
  }
  qrValidStep2();
}

function qrProcessFile(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){ qrProcessImage(e.target.result); };
  reader.readAsDataURL(file);
}

// ── Caméra IMEI ──
async function qrOpenCam() {
  try {
    var s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width:{ ideal:1920 }, height:{ ideal:1080 } }
    });
    qrData.stream = s;
    var overlay = document.getElementById('qr-cam-overlay');
    var video   = document.getElementById('qr-video');
    if(overlay) overlay.style.display = '';
    if(video){ video.srcObject = s; video.play(); }
  } catch(e) {
    // Fallback: fichier
    document.getElementById('qr-imei-file').click();
  }
}

function qrCloseCam() {
  if(qrData.stream) qrData.stream.getTracks().forEach(function(t){t.stop();});
  qrData.stream = null;
  var overlay = document.getElementById('qr-cam-overlay');
  if(overlay) overlay.style.display = 'none';
}

function qrCapture() {
  var video  = document.getElementById('qr-video');
  var canvas = document.getElementById('qr-canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  qrCloseCam();
  qrProcessImage(dataUrl);
}

// ── Step 4 : Render final ──
function qrRenderFinal() {
  var c = qrData.client;
  var a = qrData.appareil;
  var d = qrData.devis;
  var ht  = parseFloat(d.prixHT)||0;
  var tva = ht * 0.2;
  var ttc = ht + tva;
  var total = d.bonusActif ? ttc - 25 : ttc;

  // Ref
  var refEl = document.getElementById('qr-ref-display');
  if(refEl) refEl.textContent = 'Réf. : ' + qrData.refRep;

  // Recap
  var recap = document.getElementById('qr-recap-content');
  if(recap) recap.innerHTML =
    '<b>Client :</b> '+c.prenom+' '+c.nom+' — '+c.tel+'<br>'+
    '<b>Email :</b> '+c.email+'<br>'+
    '<b>Appareil :</b> '+a.marque+' '+a.modele+' — '+a.typeRep+'<br>'+
    '<b>IMEI :</b> '+(a.imei||'—')+'<br>'+
    '<b>Prix HT :</b> '+ht.toFixed(2)+' € — TVA : '+tva.toFixed(2)+' € — TTC : '+ttc.toFixed(2)+' €<br>'+
    (d.bonusActif ? '<b style="color:var(--green)">Bonus QualiRépar -25,00€ déduit</b><br>' : '')+
    '<b style="color:var(--blue);font-size:16px;">Total client : '+total.toFixed(2)+' €</b>';

  // Agora card
  var agoraLabel = document.getElementById('qr-agora-label');
  var agoraSub   = document.getElementById('qr-agora-sub');
  var agoraIcon  = document.getElementById('qr-agora-icon');
  var btnAgora   = document.getElementById('qr-btn-agora');
  if(a.bonusType){
    var isEco = a.bonusType === 'ecosystem';
    if(agoraLabel) agoraLabel.textContent = 'Demande remboursement ' + (isEco?'Ecosystem':'Ecologic');
    if(agoraSub)   agoraSub.textContent   = 'IMEI : '+(a.imei||'—')+' | -25,00€';
    if(agoraIcon)  agoraIcon.textContent  = isEco ? '🔵' : '🟢';
    if(btnAgora)   btnAgora.textContent   = isEco ? 'Envoyer Ecosystem' : 'Envoyer Ecologic';
    var card = document.getElementById('qr-card-agora');
    if(card) card.style.display = '';
  } else {
    var card = document.getElementById('qr-card-agora');
    if(card) card.style.display = 'none';
  }
  qrData.pennylaneOK = false;
  qrData.agoraOK = false;
}

// ── Envoi Pennylane ──
async function qrSendPennylane() {
  var btn  = document.getElementById('qr-btn-pennylane');
  var card = document.getElementById('qr-card-pennylane');
  if(btn) btn.disabled = true;
  if(card) card.classList.add('sending');

  var key = localStorage.getItem('sp_pennylane_key') || '';
  var c = qrData.client;
  var a = qrData.appareil;
  var d = qrData.devis;
  var ht    = parseFloat(d.prixHT)||0;
  var tva   = ht * 0.2;
  var ttc   = ht + tva;
  var total = d.bonusActif ? ttc - 25 : ttc;
  var today = new Date().toISOString().split('T')[0];

  try {
    if(key){
      // Appel réel API Pennylane
      var lines = [{
        label: 'Réparation '+(a.typeRep||'')+' '+a.marque+' '+a.modele,
        quantity: 1,
        unit_price_without_tax: ht,
        tax: { type: 'percentage', rate: '20.0' }
      }];
      if(d.bonusActif){
        lines.push({
          label: 'Bonus Réparation – Remise Ecosystem Ecologic',
          quantity: 1,
          unit_price_without_tax: -25,
          tax: { type: 'percentage', rate: '0.0' }
        });
      }
      var body = {
        customer_invoice: {
          date: today,
          deadline: today,
          currency: 'EUR',
          customer: { name: c.prenom+' '+c.nom, email: c.email||'' },
          line_items_attributes: lines
        }
      };
      await fetch('https://app.pennylane.com/api/external/v1/customer_invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+key },
        body: JSON.stringify(body)
      });
    } else {
      // Simulation si pas de clé
      await new Promise(function(r){setTimeout(r,1200);});
    }
    if(card){ card.classList.remove('sending'); card.classList.add('done'); }
    if(btn){ btn.outerHTML = '<span class="badge badge-green">✓ Envoyé</span>'; }
    qrData.pennylaneOK = true;
    // Débloquer Agora
    var cardA = document.getElementById('qr-card-agora');
    if(cardA && qrData.appareil.bonusType){
      cardA.style.opacity = '1';
      var waitBadge = document.getElementById('qr-agora-wait');
      var btnA = document.getElementById('qr-btn-agora');
      if(waitBadge) waitBadge.style.display = 'none';
      if(btnA){ btnA.style.display = ''; }
    }
    showNotif('✅ Pennylane : facture envoyée !','success');
  } catch(e){
    if(card){ card.classList.remove('sending'); }
    if(btn){ btn.disabled = false; }
    showNotif('❌ Erreur Pennylane : '+e.message,'error');
  }
}

// ── Envoi AgoraPlus (Ecosystem/Ecologic) ──
async function qrSendAgora() {
  var btn  = document.getElementById('qr-btn-agora');
  var card = document.getElementById('qr-card-agora');
  if(btn) btn.disabled = true;
  if(card) card.classList.add('sending');

  var key = localStorage.getItem('sp_agora_url') || '';
  var a = qrData.appareil;
  var c = qrData.client;
  var d = qrData.devis;
  var isEco = a.bonusType === 'ecosystem';

  try {
    if(key){
      var formData = new FormData();
      formData.append('action',    isEco ? 'CreateEcosystemRequest' : 'CreateSupportRequest');
      formData.append('imei',      a.imei||'');
      formData.append('brand',     a.marque||'');
      formData.append('model',     a.modele||'');
      formData.append('repair',    a.typeRep||'');
      formData.append('firstname', c.prenom||'');
      formData.append('lastname',  c.nom||'');
      formData.append('email',     c.email||'');
      formData.append('phone',     c.tel||'');
      formData.append('address',   c.adresse||'');
      formData.append('amount',    (parseFloat(d.prixHT)||0).toFixed(2));
      formData.append('bonus',     '25.00');
      await fetch(key + '/admin/ajax/_actions.php', { method:'POST', body:formData });
    } else {
      await new Promise(function(r){setTimeout(r,1500);});
    }
    if(card){ card.classList.remove('sending'); card.classList.add('done'); }
    if(btn){ btn.outerHTML = '<span class="badge badge-green">✓ Envoyé</span>'; }
    qrData.agoraOK = true;
    // Banner done
    if(qrData.pennylaneOK && qrData.agoraOK){
      var banner = document.getElementById('qr-done-banner');
      if(banner) banner.style.display = '';
    }
    showNotif('✅ AgoraPlus : demande remboursement envoyée !','success');
  } catch(e){
    if(card){ card.classList.remove('sending'); }
    if(btn){ btn.disabled = false; }
    showNotif('❌ Erreur AgoraPlus : '+e.message,'error');
  }
}

// ============================================================
//  FIN MODULE QUALIREPAR
// ============================================================


// ============================================================
//  PARCOURS CLIENT TABLETTE — QualiRépar
// ============================================================

function qrOpenClientMode() {
  // Reset form tablet
  ['cl-prenom-tablet','cl-nom-tablet','cl-tel-tablet','cl-email-tablet','cl-panne-tablet','cl-appareil-tablet'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var sel = document.getElementById('cl-civilite-tablet'); if(sel) sel.value = '';
  document.getElementById('qr-client-screen').style.display = 'block';
  document.body.style.overflow = 'hidden';
  qrClientValidate();
  setTimeout(function(){
    var el = document.getElementById('cl-civilite-tablet');
    if(el) el.focus();
  }, 300);
}

function qrClientValidate() {
  var btn = document.getElementById('qr-client-validate-btn');
  if(!btn) return;
  var civilite = (document.getElementById('cl-civilite-tablet')||{}).value||'';
  var prenom   = (document.getElementById('cl-prenom-tablet')||{}).value||'';
  var nom      = (document.getElementById('cl-nom-tablet')||{}).value||'';
  var tel      = (document.getElementById('cl-tel-tablet')||{}).value||'';
  var appareil = (document.getElementById('cl-appareil-tablet')||{}).value||'';
  btn.disabled = !(civilite && prenom.trim() && nom.trim() && tel.trim() && appareil.trim());
}

function qrClientSubmit() {
  var civilite = document.getElementById('cl-civilite-tablet').value;
  var prenom   = document.getElementById('cl-prenom-tablet').value.trim();
  var nom      = document.getElementById('cl-nom-tablet').value.trim();
  var tel      = document.getElementById('cl-tel-tablet').value.trim();
  var email    = document.getElementById('cl-email-tablet').value.trim();
  var panne    = document.getElementById('cl-panne-tablet').value.trim();
  var appareil = document.getElementById('cl-appareil-tablet').value.trim();
  window._qrClientPrefill = { civilite:civilite, prenom:prenom, nom:nom, tel:tel, email:email, panne:panne, appareil:appareil };
  document.getElementById('qr-client-screen').style.display = 'none';
  var handover = document.getElementById('qr-handover-screen');
  handover.style.display = 'flex';
}

function qrTechnicienMode() {
  document.getElementById('qr-handover-screen').style.display = 'none';
  document.body.style.overflow = '';
  var d = window._qrClientPrefill || {};
  var map = {
    'qr-prenom':  d.prenom,
    'qr-nom':     d.nom,
    'qr-tel':     d.tel,
    'qr-email':   d.email,
    'qr-modele':  d.appareil
  };
  // Pré-remplir la civilité
  if(d.civilite) {
    var selCiv = document.getElementById('qr-civilite');
    if(selCiv) selCiv.value = d.civilite;
  }
  Object.keys(map).forEach(function(id){
    if(map[id]){ var el=document.getElementById(id); if(el) el.value=map[id]; }
  });
  if(d.panne) window._qrClientPanne = d.panne;
  // Bandeau récap vert pour le technicien
  var recap = document.getElementById('qr-client-recap');
  if(recap && d.prenom){
    recap.style.display = '';
    recap.innerHTML =
      '<div style="background:rgba(72,187,120,0.1);border:1.5px solid var(--green);border-radius:10px;'+
      'padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--green);line-height:1.8;">'+
      '✅ <b>Infos saisies par le client</b> — '+d.prenom+' '+d.nom+' · '+d.tel+
      (d.panne ? '<br><span style="color:var(--text-muted);font-size:12px;">💬 "'+d.panne+'"</span>' : '')+
      '</div>';
  }
  qrValidStep1();
  // Afficher badge OCR si clé API dispo
  var badge = document.getElementById('qr-ocr-badge');
  if(badge && getIgApiKey()) badge.style.display = '';
  window._qrClientPrefill = null;
  showNotif('👋 Infos client pré-remplies !', 'success');
}

function showQrModeSelector() {
  var wrap = document.getElementById('qr-wrap');
  if(!wrap) return;
  var ex = document.getElementById('qr-mode-selector');
  if(ex) ex.remove();
  var div = document.createElement('div');
  div.id = 'qr-mode-selector';
  div.style.marginBottom = '20px';
  var btnClient = document.createElement('button');
  btnClient.style.cssText = 'padding:18px 12px;background:#c0392b;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;';
  btnClient.innerHTML = '<span style="font-size:36px;">&#x1F464;</span><span>Mode Client</span><span style="font-size:11px;font-weight:400;opacity:.8;">Le client saisit lui-même</span>';
  btnClient.onclick = function(){ qrOpenClientMode(); };
  var btnTech = document.createElement('button');
  btnTech.style.cssText = 'padding:18px 12px;background:#f8fafc;color:#374151;border:2px solid #e2e8f0;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;';
  btnTech.innerHTML = '<span style="font-size:36px;">&#x1F527;</span><span>Mode Technicien</span><span style="font-size:11px;font-weight:400;color:#94a3b8;">Saisie directe</span>';
  btnTech.onclick = function(){ div.remove(); };
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
  grid.appendChild(btnClient);
  grid.appendChild(btnTech);
  div.appendChild(grid);
  wrap.insertBefore(div, wrap.firstChild);
}

// Surcharger qrInit pour afficher le sélecteur de mode
var _qrInitOrig = qrInit;
qrInit = function() {
  _qrInitOrig();
  showQrModeSelector();
};

// ============================================================
//  FIN PARCOURS CLIENT TABLETTE
// ============================================================


// ══════════════════════════════════════════════════════════════════
//  SUIVI QUALIREPAR
// ══════════════════════════════════════════════════════════════════
var QR_STATUTS_LABELS = {
  'Sent':       { label: '📤 En cours vérification', cls: '#92400e', bg: '#fef3c7' },
  'Approved':   { label: '✅ Approuvé',               cls: '#166534', bg: '#f0fdf4' },
  'Paid':       { label: '💶 Remboursé',               cls: '#1d4ed8', bg: '#eff6ff' },
  'Rejected':   { label: '❌ Refusé',                  cls: '#dc2626', bg: '#fef2f2' },
  'Pending':    { label: '⏳ En attente',              cls: '#92400e', bg: '#fef3c7' },
  'Processing': { label: '🔄 En traitement',           cls: '#6d28d9', bg: '#f5f3ff' },
};

function qrStatutBadge(statut){
  var s = QR_STATUTS_LABELS[statut] || { label: statut||'—', cls: '#6b7280', bg: '#f8fafc' };
  return '<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:'+s.cls+';background:'+s.bg+';">'+s.label+'</span>';
}

function renderSuiviQR(){
  var dossiers = (window.bonsDepot||[]).filter(function(d){ return d.qrEnvoi; });
  var isEcosystem = function(d){ var m=d.appareil&&d.appareil.marque; return typeof QR_BRAND_TYPE!=='undefined'&&QR_BRAND_TYPE[m]==='ecosystem'; };
  var ecosystem = dossiers.filter(isEcosystem);
  var ecologic  = dossiers.filter(function(d){ return !isEcosystem(d); });

  // Stats
  var stats = document.getElementById('qr-suivi-stats');
  if(stats){
    var paid     = dossiers.filter(function(d){ return d.qrEnvoi.statut==='Paid'; }).length;
    var approved = dossiers.filter(function(d){ return d.qrEnvoi.statut==='Approved'; }).length;
    var sent     = dossiers.filter(function(d){ return d.qrEnvoi.statut==='Sent'||!d.qrEnvoi.statut; }).length;
    var rejected = dossiers.filter(function(d){ return d.qrEnvoi.statut==='Rejected'; }).length;
    stats.innerHTML =
      '<div class="card" style="text-align:center;padding:12px 8px;"><div style="font-size:11px;color:var(--text-muted);">Total</div><div style="font-size:22px;font-weight:800;">'+dossiers.length+'</div><div style="font-size:11px;color:var(--text-muted);">'+(dossiers.length*25)+' € attendus</div></div>'+
      '<div class="card" style="text-align:center;padding:12px 8px;background:#fef3c7;border-color:#f59e0b;"><div style="font-size:11px;color:#92400e;">En vérification</div><div style="font-size:22px;font-weight:800;color:#92400e;">'+sent+'</div><div style="font-size:11px;color:#92400e;">'+(sent*25)+' €</div></div>'+
      '<div class="card" style="text-align:center;padding:12px 8px;background:#f0fdf4;border-color:#22c55e;"><div style="font-size:11px;color:#166534;">Approuvés</div><div style="font-size:22px;font-weight:800;color:#166534;">'+approved+'</div><div style="font-size:11px;color:#166534;">'+(approved*25)+' €</div></div>'+
      '<div class="card" style="text-align:center;padding:12px 8px;background:#eff6ff;border-color:#3b82f6;"><div style="font-size:11px;color:#1d4ed8;">Remboursés</div><div style="font-size:22px;font-weight:800;color:#1d4ed8;">'+paid+'</div><div style="font-size:11px;color:#1d4ed8;">'+(paid*25)+' €</div></div>'+
      '<div class="card" style="text-align:center;padding:12px 8px;background:#fef2f2;border-color:#fca5a5;"><div style="font-size:11px;color:#dc2626;">Refusés</div><div style="font-size:22px;font-weight:800;color:#dc2626;">'+rejected+'</div><div style="font-size:11px;color:#dc2626;">'+(rejected*25)+' €</div></div>';
  }

  function buildRows(list, idCol){
    if(!list.length) return '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Aucun dossier</td></tr>';
    return list.sort(function(a,b){ return (b.qrEnvoi.date||'').localeCompare(a.qrEnvoi.date||''); }).map(function(d){
      var c=d.client||{}, a=d.appareil||{}, q=d.qrEnvoi||{};
      var dateEnvoi = q.date ? new Date(q.date).toLocaleDateString('fr-FR') : '—';
      var refId = idCol==='ecosystem' ? (q.ecosystemId||'—') : (q.supportId||q.claimId||'—');
      return '<tr style="border-bottom:1px solid var(--border);">'+
        '<td style="padding:8px 10px;"><b>'+d.numero+'</b><br><span style="font-size:11px;color:var(--text-muted);">'+fmtDate(d.date)+'</span></td>'+
        '<td style="padding:8px 10px;">'+(c.prenom||'')+' '+c.nom+'<br><span style="font-size:11px;color:var(--text-muted);">'+(c.tel||'')+'</span></td>'+
        '<td style="padding:8px 10px;">'+(a.marque||'')+' '+(a.modele||'')+'<br><span style="font-size:11px;color:var(--text-muted);">'+(a.imei||'—')+'</span></td>'+
        '<td style="padding:8px 10px;">'+dateEnvoi+'</td>'+
        '<td style="padding:8px 10px;font-family:monospace;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;" title="'+refId+'">'+refId+'</td>'+
        '<td style="padding:8px 10px;">'+qrStatutBadge(q.statut||'Sent')+'</td>'+
        '<td style="padding:8px 10px;"><button class="btn btn-sm" onclick="qrVerifierUnDossier(\''+d.id+'\')">🔄</button> <button class="btn btn-sm" onclick="qrChangerStatut(\''+d.id+'\')" >✏️</button></td>'+
      '</tr>';
    }).join('');
  }

  var ecoCount = document.getElementById('qr-eco-count');
  var ecolCount = document.getElementById('qr-ecol-count');
  var ecoTbody = document.getElementById('qr-ecosystem-tbody');
  var ecolTbody = document.getElementById('qr-ecologic-tbody');
  if(ecoCount)  ecoCount.textContent  = ecosystem.length+' dossier(s)';
  if(ecolCount) ecolCount.textContent = ecologic.length+' dossier(s)';
  if(ecoTbody)  ecoTbody.innerHTML    = buildRows(ecosystem,'ecosystem');
  if(ecolTbody) ecolTbody.innerHTML   = buildRows(ecologic,'ecologic');
}

function qrChangerStatut(dossierId){
  var statuts = ['Sent','Approved','Paid','Rejected','Pending','Processing'];
  var labels  = ['📤 En cours vérification','✅ Approuvé','💶 Remboursé','❌ Refusé','⏳ En attente','🔄 En traitement'];
  var d = (window.bonsDepot||[]).find(function(x){ return String(x.id)===String(dossierId); });
  if(!d||!d.qrEnvoi) return;
  var current = d.qrEnvoi.statut||'Sent';
  var idx = window.prompt(
    'Statut de '+d.numero+'\nActuel : '+current+'\n\n'+
    statuts.map(function(s,i){ return (i+1)+'. '+labels[i]+(s===current?' ←':''); }).join('\n')+
    '\n\nEntrez le numéro :'
  );
  if(!idx) return;
  var newStatut = statuts[parseInt(idx)-1];
  if(!newStatut) return;
  d.qrEnvoi.statut = newStatut;
  saveBonsDepot();
  saveBonDepotSupabase(d);
  renderSuiviQR();
  showNotif('Statut → '+labels[statuts.indexOf(newStatut)], 'success');
}
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  SUIVI QR — Vérification automatique statut via API
// ══════════════════════════════════════════════════════════════════

async function qrVerifierStatutEcosystem(dossier){
  var q = dossier.qrEnvoi || {};
  var ecosystemId = q.ecosystemId;
  if(!ecosystemId) return null;

  var user      = localStorage.getItem('sp_eco_user') || '501710';
  var password  = localStorage.getItem('sp_eco_pass') || 'Coincoin71?!';
  var baseUrl   = 'https://api.repairerportal.ecosystem.eco';

  try {
    // Auth
    var authRes = await fetch(baseUrl+'/api/authenticate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:user, password:password})
    });
    var authData = await authRes.json();
    var jwt = authData.id_token || authData.token || authData.access_token;
    if(!jwt) return null;

    // GET statut du dossier
    var res = await fetch(baseUrl+'/api/repair-reimbursements/'+ecosystemId, {
      method:'GET',
      headers:{'Authorization':'Bearer '+jwt,'Content-Type':'application/json'}
    });
    if(!res.ok) return null;
    var data = await res.json();
    console.log('Ecosystem status:', data);

    // Mapper le statut API → statut interne
    var apiStatut = data.status || data.state || data.reimbursementStatus || '';
    var map = {
      'SUBMITTED':'Sent', 'PENDING':'Pending', 'PROCESSING':'Processing',
      'VALIDATED':'Approved', 'APPROVED':'Approved',
      'PAID':'Paid', 'REIMBURSED':'Paid',
      'REJECTED':'Rejected', 'REFUSED':'Rejected'
    };
    return map[apiStatut.toUpperCase()] || apiStatut || 'Sent';
  } catch(e){
    console.warn('Ecosystem status check error:', e);
    return null;
  }
}

async function qrVerifierStatutEcologic(dossier){
  var q = dossier.qrEnvoi || {};
  var supportId = q.supportId;
  if(!supportId) return null;

  var token  = localStorage.getItem('sp_ecologic_token') || '8121d135-4635-412d-b7ab-3b4dd61cbdb8';
  var siteId = localStorage.getItem('sp_ecologic_siteid') || 'f3f52871-5be0-4c26-9082-002479b9cf4e';

  try {
    var res = await fetch('https://www.ecologic-france.com/admin/ajax/_actions.php', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({
        action: 'GetSupportRequest',
        token: token,
        siteId: siteId,
        supportRequestId: supportId
      })
    });
    var data = await res.json();
    console.log('Ecologic status:', data);

    var apiStatut = data.status || data.ResponseData && data.ResponseData.status || '';
    var map = {
      'pending':'Sent', 'submitted':'Sent', 'processing':'Processing',
      'validated':'Approved', 'approved':'Approved',
      'paid':'Paid', 'reimbursed':'Paid',
      'rejected':'Rejected', 'refused':'Rejected'
    };
    return map[apiStatut.toLowerCase()] || (data.status === 'success' ? 'Sent' : null);
  } catch(e){
    console.warn('Ecologic status check error:', e);
    return null;
  }
}

async function qrVerifierUnDossier(dossierId){
  var d = (window.bonsDepot||[]).find(function(x){ return String(x.id)===String(dossierId); });
  if(!d || !d.qrEnvoi) return;

  var btn = document.querySelector('[onclick="qrVerifierUnDossier(\''+dossierId+'\')"]');
  if(btn){ btn.disabled=true; btn.textContent='⏳'; }

  var isEcosystem = typeof QR_BRAND_TYPE!=='undefined' && QR_BRAND_TYPE[d.appareil&&d.appareil.marque]==='ecosystem';
  var newStatut = isEcosystem
    ? await qrVerifierStatutEcosystem(d)
    : await qrVerifierStatutEcologic(d);

  if(btn){ btn.disabled=false; btn.textContent='🔄'; }

  if(newStatut && newStatut !== d.qrEnvoi.statut){
    d.qrEnvoi.statut = newStatut;
    saveBonsDepot();
    saveBonDepotSupabase(d);
    renderSuiviQR();
    showNotif('Statut mis à jour : '+newStatut, 'success');
  } else if(newStatut){
    showNotif('Statut inchangé : '+newStatut, 'success');
  } else {
    showNotif('Impossible de récupérer le statut — API non disponible', 'error');
  }
}

async function qrVerifierTousLesStatuts(){
  var dossiers = (window.bonsDepot||[]).filter(function(d){ return d.qrEnvoi && d.qrEnvoi.statut !== 'Paid' && d.qrEnvoi.statut !== 'Rejected'; });
  if(!dossiers.length){ showNotif('Aucun dossier en attente', 'success'); return; }

  var btnAll = document.getElementById('btn-qr-verif-all');
  if(btnAll){ btnAll.disabled=true; btnAll.textContent='⏳ Vérification ('+dossiers.length+' dossiers)...'; }

  var updated = 0;
  for(var i=0; i<dossiers.length; i++){
    var d = dossiers[i];
    var isEcosystem = typeof QR_BRAND_TYPE!=='undefined' && QR_BRAND_TYPE[d.appareil&&d.appareil.marque]==='ecosystem';
    var newStatut = isEcosystem
      ? await qrVerifierStatutEcosystem(d)
      : await qrVerifierStatutEcologic(d);
    if(newStatut && newStatut !== d.qrEnvoi.statut){
      d.qrEnvoi.statut = newStatut;
      saveBonsDepot();
      saveBonDepotSupabase(d);
      updated++;
    }
    // Petite pause entre les appels
    await new Promise(function(r){ setTimeout(r, 300); });
  }

  if(btnAll){ btnAll.disabled=false; btnAll.textContent='🔄 Tout vérifier'; }
  renderSuiviQR();
  showNotif(updated > 0 ? updated+' statut(s) mis à jour ✅' : 'Tous les statuts sont à jour', 'success');
}
// ══════════════════════════════════════════════════════════════════
