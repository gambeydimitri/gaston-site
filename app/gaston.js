/* Gaston · espace ramoneur : connexion, accueil, clients, certificats, entreprise, abonnement. */
(function () {
  'use strict';
  var api = window.GastonApi;
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, clients: [], certs: [] };
  var VIEWS = ['connexion', 'accueil', 'clients', 'client', 'nouveau', 'entreprise', 'abonnement'];

  // ---------- Utilitaires ----------
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plusYear(s) { var d = new Date(s + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return iso(d); }
  function fr(s) { if (!s) return ''; var p = s.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }
  function msg(el, text, isErr) { el.textContent = text; el.classList.toggle('error', !!isErr); el.hidden = !text; }
  function errText(e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/Invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail : choisissez « J\'ai déjà un compte ».';
    if (/Password should be/i.test(m)) return 'Le mot de passe doit faire au moins 8 caractères.';
    if (/Email not confirmed/i.test(m)) return 'Confirmez d\'abord votre adresse avec le lien reçu par e-mail.';
    if (/fetch|network/i.test(m)) return 'Pas de connexion internet. Réessayez dans un instant.';
    return 'Une erreur est survenue. Réessayez, ou écrivez à contact@gaston-ramonage.fr.';
  }
  function trialLeft() {
    if (!state.profile) return 0;
    return Math.ceil((new Date(state.profile.trial_ends_at) - Date.now()) / 864e5);
  }
  function locked() { return state.profile && state.profile.plan === 'essai' && trialLeft() <= 0; }

  // ---------- Signatures ----------
  function Pad(canvas) {
    var ctx = canvas.getContext('2d'), drawing = false, empty = true, last = null, pending = null;
    function setup() {
      var r = Math.max(window.devicePixelRatio || 1, 1), keep = empty ? null : canvas.toDataURL();
      if (!canvas.offsetWidth) return;
      canvas.width = canvas.offsetWidth * r; canvas.height = canvas.offsetHeight * r;
      ctx.setTransform(r, 0, 0, r, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1C1917';
      var img = pending || keep; pending = null;
      if (img) draw(img);
    }
    function pos(e) { var b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
    canvas.addEventListener('pointerdown', function (e) { drawing = true; empty = false; last = pos(e); canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, 7); ctx.fillStyle = '#1C1917'; ctx.fill(); });
    canvas.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
    function end() { drawing = false; }
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    function draw(url) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight); }; img.src = url; empty = false; }
    return {
      setup: setup,
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; },
      isEmpty: function () { return empty; },
      get: function () { return empty ? '' : canvas.toDataURL('image/png'); },
      load: function (url) { if (!url) return; if (canvas.offsetWidth) draw(url); else { pending = url; empty = false; } }
    };
  }
  var pads = { 'sig-ramoneur': Pad($('sig-ramoneur')), 'sig-client': Pad($('sig-client')), 'sig-perso': Pad($('sig-perso')) };
  document.querySelectorAll('[data-clear]').forEach(function (b) { b.addEventListener('click', function () { pads[b.dataset.clear].clear(); }); });
  window.addEventListener('resize', function () { Object.keys(pads).forEach(function (k) { pads[k].setup(); }); });

  // ---------- Navigation ----------
  function route() {
    var h = (location.hash || '#accueil').slice(1), parts = h.split('-'), view = parts[0], arg = parts.slice(1).join('-');
    if (!state.user) view = 'connexion';
    else if (view === 'connexion') view = 'accueil';
    if (state.user && locked() && view !== 'abonnement' && view !== 'entreprise') view = 'abonnement';
    if (VIEWS.indexOf(view) < 0) view = 'accueil';
    VIEWS.forEach(function (v) { $('v-' + v).hidden = v !== view; });
    $('tabs').hidden = !state.user;
    document.querySelectorAll('#tabs a').forEach(function (a) { if (a.dataset.tab === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (view === 'accueil') renderHome();
    if (view === 'clients') renderClients();
    if (view === 'client') renderClient(arg);
    if (view === 'nouveau') openNew(arg);
    if (view === 'entreprise') openEnt();
    if (view === 'abonnement') renderSub();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  function renderTrial() {
    var p = $('trial-pill');
    if (!state.profile) { p.hidden = true; return; }
    if (state.profile.plan !== 'essai') { p.hidden = true; return; }
    var n = trialLeft();
    p.textContent = n > 0 ? 'Essai : ' + n + ' jour' + (n > 1 ? 's' : '') : 'Essai terminé';
    p.classList.toggle('late', n <= 3);
    p.hidden = false;
  }

  // ---------- Chargement ----------
  async function loadAll() {
    var r = await Promise.all([api.profile(state.user.id), api.clients(), api.certificats()]);
    state.profile = r[0]; state.clients = r[1]; state.certs = r[2];
    renderTrial();
  }

  // ---------- Connexion ----------
  var mode = 'signup';
  function setMode(m) {
    mode = m;
    $('tab-signup').setAttribute('aria-selected', m === 'signup');
    $('tab-login').setAttribute('aria-selected', m === 'login');
    $('auth-submit').textContent = m === 'signup' ? 'Commencer mon essai gratuit' : 'Me connecter';
    $('auth-pass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    msg($('auth-msg'), '');
  }
  $('tab-signup').addEventListener('click', function () { setMode('signup'); });
  $('tab-login').addEventListener('click', function () { setMode('login'); });
  $('auth-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = $('auth-email').value.trim(), pass = $('auth-pass').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg($('auth-msg'), 'Indiquez une adresse e-mail valide.', true);
    if (pass.length < 8) return msg($('auth-msg'), 'Le mot de passe doit faire au moins 8 caractères.', true);
    var b = $('auth-submit'); b.disabled = true;
    try {
      var res = mode === 'signup' ? await api.signUp(email, pass) : await api.signIn(email, pass);
      if (mode === 'signup' && !res.session) {
        msg($('auth-msg'), 'Compte créé. Ouvrez le lien reçu par e-mail pour l\'activer, puis connectez-vous.');
        setMode('login');
        return;
      }
      await start(res.session);
    } catch (err) { msg($('auth-msg'), errText(err), true); }
    finally { b.disabled = false; }
  });
  $('btn-logout').addEventListener('click', async function () { await api.signOut(); state = { user: null, profile: null, clients: [], certs: [] }; renderTrial(); location.hash = '#connexion'; route(); });

  async function start(session) {
    state.user = session.user;
    try { await loadAll(); }
    catch (e) { toast(errText(e)); }
    if (location.hash === '#connexion' || !location.hash) location.hash = '#accueil';
    route();
  }

  // ---------- Accueil ----------
  function li(href, title, sub, side, cls) {
    return '<li><a href="' + href + '"><span class="it-main"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></span><span class="it-side ' + (cls || '') + '">' + esc(side) + '</span></a></li>';
  }
  function clientName(id) { var c = state.clients.find(function (x) { return x.id === id; }); return c ? c.nom : ''; }
  function dueList() {
    var lim = new Date(); lim.setDate(lim.getDate() + 45);
    var seen = {}, out = [];
    state.certs.forEach(function (c) {
      var key = c.client_id || c.id;
      if (seen[key]) return; seen[key] = true; // dernier certificat par client
      if (c.prochain_ramonage && new Date(c.prochain_ramonage) <= lim) out.push(c);
    });
    return out.sort(function (a, b) { return a.prochain_ramonage < b.prochain_ramonage ? -1 : 1; });
  }
  function renderHome() {
    var e = (state.profile && state.profile.entreprise) || {};
    $('hello').textContent = 'Bonjour' + (e.ramoneur ? ' ' + e.ramoneur.split(' ')[0] : '') + ' 👋';
    $('setup-hint').hidden = !!(e.nom && e.siret);
    $('st-certifs').textContent = state.certs.length;
    $('st-clients').textContent = state.clients.length;
    var due = dueList(); $('st-relances').textContent = due.length;
    var today = iso(new Date());
    $('list-due').innerHTML = due.length ? due.slice(0, 8).map(function (c) {
      var late = c.prochain_ramonage < today;
      return li(c.client_id ? '#client-' + c.client_id : '#accueil', c.client_nom || clientName(c.client_id), c.appareil || '', (late ? 'Dépassé · ' : 'Avant le ') + fr(c.prochain_ramonage), late ? 'due' : '');
    }).join('') : '<li class="empty">Personne à revoir dans les 45 prochains jours.</li>';
    $('list-recent').innerHTML = state.certs.length ? state.certs.slice(0, 6).map(function (c) {
      return '<li><a href="#" data-pdf="' + c.id + '"><span class="it-main"><b>' + esc(c.client_nom || clientName(c.client_id)) + '</b><span>N° ' + esc(c.numero) + ' · ' + fr(c.date_intervention) + '</span></span><span class="it-side">PDF ↓</span></a></li>';
    }).join('') : '<li class="empty">Aucun certificat pour l\'instant. Créez le premier, il prend 2 minutes.</li>';
  }

  // ---------- Clients ----------
  function renderClients() {
    var q = norm($('client-search').value);
    var list = state.clients.filter(function (c) { return !q || norm(c.nom + ' ' + c.ville + ' ' + c.adresse).indexOf(q) >= 0; });
    $('list-clients').innerHTML = list.length ? list.map(function (c) {
      var n = state.certs.filter(function (x) { return x.client_id === c.id; }).length;
      return li('#client-' + c.id, c.nom, [c.adresse, c.ville].filter(Boolean).join(', '), n + ' certif.');
    }).join('') : '<li class="empty">' + (state.clients.length ? 'Aucun client ne correspond.' : 'Vos clients apparaîtront ici à chaque certificat.') + '</li>';
  }
  $('client-search').addEventListener('input', renderClients);

  var currentClient = null;
  function renderClient(id) {
    var c = state.clients.find(function (x) { return x.id === id; });
    if (!c) { location.hash = '#clients'; return; }
    currentClient = c;
    $('cl-nom').textContent = c.nom;
    $('cl-adr').textContent = [c.adresse, [c.cp, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var f = $('client-form');
    ['nom', 'telephone', 'adresse', 'cp', 'ville', 'email', 'notes'].forEach(function (k) { f.elements[k].value = c[k] || ''; });
    msg($('client-msg'), '');
    $('cl-new-cert').href = '#nouveau-' + c.id;
    var certs = state.certs.filter(function (x) { return x.client_id === c.id; });
    $('list-client-certs').innerHTML = certs.length ? certs.map(function (x) {
      return '<li><a href="#" data-pdf="' + x.id + '"><span class="it-main"><b>' + fr(x.date_intervention) + ' · ' + esc(x.appareil || '') + '</b><span>N° ' + esc(x.numero) + ' · prochain avant le ' + fr(x.prochain_ramonage) + '</span></span><span class="it-side">PDF ↓</span></a></li>';
    }).join('') : '<li class="empty">Pas encore de certificat.</li>';
  }
  $('client-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, patch = {};
    ['nom', 'telephone', 'adresse', 'cp', 'ville', 'email', 'notes'].forEach(function (k) { patch[k] = f.elements[k].value.trim() || null; });
    if (!patch.nom) { f.elements.nom.classList.add('invalid'); return msg($('client-msg'), 'Le nom est obligatoire.', true); }
    try {
      var saved = await api.saveClient(currentClient.id, patch);
      state.clients = state.clients.map(function (c) { return c.id === saved.id ? saved : c; });
      msg($('client-msg'), 'Fiche enregistrée.');
      renderClient(saved.id);
    } catch (err) { msg($('client-msg'), errText(err), true); }
  });

  // ---------- Téléchargement d'un PDF déjà enregistré ----------
  async function savePdf(bytes, name) {
    var blob = new Blob([bytes], { type: 'application/pdf' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }
  function fileName(num, client) {
    var slug = norm(client).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'certificat-ramonage-' + num + (slug ? '-' + slug : '') + '.pdf';
  }
  document.addEventListener('click', async function (e) {
    var a = e.target.closest('[data-pdf]'); if (!a) return;
    e.preventDefault();
    try {
      toast('Préparation du PDF…');
      var c = await api.certificat(a.dataset.pdf);
      var bytes = await window.GastonPdf.buildCertificatePdf(window.PDFLib, c.data);
      await savePdf(bytes, fileName(c.numero, c.data.client.nom));
    } catch (err) { toast(errText(err)); }
  });

  // ---------- Nouveau certificat ----------
  var CONSEILS = "Utilisez uniquement du bois sec (moins de 20 % d'humidité), stocké à l'abri. Ne brûlez ni déchets, ni bois traité ou peint, ni papiers glacés. Faites entretenir l'appareil chaque année et veillez à ce que les entrées d'air restent dégagées.";
  var cf = $('cert-form');
  function updConseils() {
    var solide = ['Bois', 'Granulés', 'Charbon'].indexOf(cf.elements.a_combustible.value) >= 0;
    if (!cf.elements.conseils.dataset.touched) cf.elements.conseils.value = solide ? CONSEILS : '';
  }
  cf.elements.conseils.addEventListener('input', function () { cf.elements.conseils.dataset.touched = '1'; });
  cf.elements.a_combustible.addEventListener('change', updConseils);
  cf.elements.date.addEventListener('change', function () { if (cf.elements.date.value) cf.elements.prochain.value = plusYear(cf.elements.date.value); });
  cf.addEventListener('input', function (e) { e.target.classList && e.target.classList.remove('invalid'); });

  function fillClient(c) {
    var map = { c_nom: 'nom', c_adresse: 'adresse', c_cp: 'cp', c_ville: 'ville', c_email: 'email', c_tel: 'telephone' };
    Object.keys(map).forEach(function (k) { cf.elements[k].value = c ? (c[map[k]] || '') : ''; });
  }
  $('cf-client').addEventListener('change', async function () {
    var c = state.clients.find(function (x) { return x.id === this.value; }, this);
    fillClient(c);
    if (c) {
      var last = state.certs.find(function (x) { return x.client_id === c.id; });
      if (last) {
        try {
          var full = await api.certificat(last.id), d = full.data;
          cf.elements.a_type.value = d.appareil.type; cf.elements.a_combustible.value = d.appareil.combustible;
          cf.elements.a_marque.value = d.appareil.marque || ''; cf.elements.k_description.value = d.conduit.description || '';
          cf.elements.k_methode.value = d.conduit.methode; updConseils();
          toast('Installation reprise du dernier passage.');
        } catch (e) { /* on garde le formulaire vide */ }
      }
    }
  });
  function openNew(clientId) {
    cf.reset(); delete cf.elements.conseils.dataset.touched;
    cf.querySelectorAll('.invalid').forEach(function (x) { x.classList.remove('invalid'); });
    var sel = $('cf-client');
    sel.innerHTML = '<option value="">+ Nouveau client</option>' + state.clients.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nom + (c.ville ? ' · ' + c.ville : '')) + '</option>'; }).join('');
    var today = iso(new Date()); cf.elements.date.value = today; cf.elements.prochain.value = plusYear(today);
    updConseils();
    msg($('cert-err'), '');
    requestAnimationFrame(function () {
      pads['sig-ramoneur'].setup(); pads['sig-client'].setup();
      pads['sig-ramoneur'].clear(); pads['sig-client'].clear();
      if (state.profile && state.profile.signature) pads['sig-ramoneur'].load(state.profile.signature);
    });
    if (clientId) { sel.value = clientId; sel.dispatchEvent(new Event('change')); }
  }
  function nextNumero(dateStr) {
    var y = dateStr.slice(0, 4), max = 0;
    state.certs.forEach(function (c) { var m = /^(\d{4})-(\d+)$/.exec(c.numero || ''); if (m && m[1] === y) max = Math.max(max, +m[2]); });
    return y + '-' + String(max + 1).padStart(4, '0');
  }
  cf.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var e = (state.profile && state.profile.entreprise) || {};
    var miss = [];
    if (!e.nom || !e.siret || !e.assureur) { msg($('cert-err'), 'Complétez d\'abord votre entreprise (nom, SIRET, assurance) : elle figure sur le certificat.', true); return; }
    ['c_nom', 'c_adresse', 'c_cp', 'c_ville', 'k_description', 'date', 'prochain'].forEach(function (n) {
      if (!cf.elements[n].value.trim()) { cf.elements[n].classList.add('invalid'); miss.push(n); }
    });
    if (pads['sig-ramoneur'].isEmpty()) miss.push('sig1');
    if (pads['sig-client'].isEmpty()) miss.push('sig2');
    if (miss.length) {
      msg($('cert-err'), 'Il manque des informations' + (miss.indexOf('sig2') >= 0 ? ', dont la signature du client' : '') + '.', true);
      var f = cf.querySelector('.invalid'); if (f) f.focus();
      return;
    }
    var v = function (n) { return cf.elements[n].value.trim(); };
    var btn = $('cert-submit'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      // 1. Client : création ou mise à jour
      var clientData = { nom: v('c_nom'), adresse: v('c_adresse'), cp: v('c_cp'), ville: v('c_ville'), email: v('c_email') || null, telephone: v('c_tel') || null };
      var cid = $('cf-client').value, client;
      if (cid) { client = await api.saveClient(cid, clientData); state.clients = state.clients.map(function (c) { return c.id === cid ? client : c; }); }
      else { client = await api.addClient(clientData); state.clients.push(client); state.clients.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }); }
      // 2. Certificat
      var numero = nextNumero(v('date'));
      var data = {
        numero: numero, dateIntervention: v('date'), prochainRamonage: v('prochain'),
        entreprise: Object.assign({}, e, { logo: state.profile.logo || '' }),
        client: { nom: clientData.nom, adresse: clientData.adresse, cp: clientData.cp, ville: clientData.ville },
        appareil: { type: v('a_type'), marque: v('a_marque'), combustible: v('a_combustible') },
        conduit: { description: v('k_description'), methode: v('k_methode') },
        controle: { vacuite: cf.elements.vacuite.checked, observations: v('observations'), conseils: v('conseils') },
        signatures: { ramoneur: pads['sig-ramoneur'].get(), client: pads['sig-client'].get() }
      };
      var bytes = await window.GastonPdf.buildCertificatePdf(window.PDFLib, data);
      var saved = await api.addCertificat({ client_id: client.id, numero: numero, date_intervention: data.dateIntervention, prochain_ramonage: data.prochainRamonage, data: data });
      state.certs.unshift({ id: saved.id, client_id: client.id, numero: numero, date_intervention: saved.date_intervention, prochain_ramonage: saved.prochain_ramonage, client_nom: clientData.nom, appareil: data.appareil.type });
      await savePdf(bytes, fileName(numero, clientData.nom));
      toast('Certificat ' + numero + ' enregistré. Relance prévue avant le ' + fr(data.prochainRamonage) + '.');
      location.hash = '#client-' + client.id;
    } catch (err) {
      msg($('cert-err'), errText(err), true);
    } finally { btn.disabled = false; btn.textContent = 'Enregistrer et télécharger le PDF'; }
  });

  // ---------- Entreprise ----------
  var ef = $('ent-form'), logoData = '';
  var ENT = ['nom', 'adresse', 'cp', 'ville', 'telephone', 'email', 'siret', 'qualification', 'assureur', 'police', 'ramoneur'];
  function showLogo() { $('logo-prev').hidden = !logoData; $('logo-del').hidden = !logoData; if (logoData) $('logo-prev').src = logoData; }
  function openEnt() {
    var e = (state.profile && state.profile.entreprise) || {};
    ENT.forEach(function (k) { ef.elements[k].value = e[k] || ''; });
    if (!ef.elements.email.value && state.user) ef.elements.email.value = state.user.email;
    logoData = (state.profile && state.profile.logo) || ''; showLogo();
    $('acc-email').textContent = state.user ? 'Connecté avec ' + state.user.email : '';
    msg($('ent-msg'), '');
    requestAnimationFrame(function () { pads['sig-perso'].setup(); pads['sig-perso'].clear(); if (state.profile && state.profile.signature) pads['sig-perso'].load(state.profile.signature); });
  }
  $('logo-file').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      var s = Math.min(1, 600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      logoData = c.toDataURL('image/jpeg', 0.88); URL.revokeObjectURL(url); showLogo();
    };
    img.src = url;
  });
  $('logo-del').addEventListener('click', function () { logoData = ''; $('logo-file').value = ''; showLogo(); });
  ef.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var e = {}, miss = false;
    ENT.forEach(function (k) { e[k] = ef.elements[k].value.trim(); if (ef.elements[k].required && !e[k]) { ef.elements[k].classList.add('invalid'); miss = true; } });
    if (miss) return msg($('ent-msg'), 'Complétez les champs marqués d\'une étoile.', true);
    try {
      state.profile = await api.saveProfile(state.user.id, { entreprise: e, logo: logoData || null, signature: pads['sig-perso'].get() || null });
      msg($('ent-msg'), 'Entreprise enregistrée. Elle figurera sur vos prochains certificats.');
      toast('Entreprise enregistrée');
    } catch (err) { msg($('ent-msg'), errText(err), true); }
  });
  ef.addEventListener('input', function (e) { e.target.classList && e.target.classList.remove('invalid'); });

  // Export de toutes les données (CSV des clients + JSON complet)
  $('btn-export').addEventListener('click', async function () {
    try {
      var all = await api.exportAll();
      var rows = [['numero', 'date', 'prochain', 'client', 'adresse', 'cp', 'ville', 'appareil', 'combustible', 'conduit']].concat(all.map(function (c) {
        var d = c.data; return [c.numero, c.date_intervention, c.prochain_ramonage, d.client.nom, d.client.adresse, d.client.cp, d.client.ville, d.appareil.type, d.appareil.combustible, d.conduit.description];
      }));
      var csv = '﻿' + rows.map(function (r) { return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'gaston-mes-certificats.csv'; document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { toast(errText(err)); }
  });

  // ---------- Abonnement ----------
  function renderSub() {
    var p = state.profile; if (!p) return;
    var n = trialLeft(), st = $('ab-status');
    if (p.plan === 'essai') st.innerHTML = n > 0 ? 'Vous êtes en <b>essai gratuit</b> : il reste <b>' + n + ' jour' + (n > 1 ? 's' : '') + '</b>. Tout est inclus jusqu\'au ' + fr(p.trial_ends_at) + '.' : 'Votre <b>essai est terminé</b>. Choisissez une formule pour continuer. Vos certificats et vos clients sont conservés.';
    else st.innerHTML = 'Formule actuelle : <b>' + esc(p.plan) + '</b>.';
    msg($('ab-msg'), '');
  }
  document.querySelectorAll('[data-plan]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = (window.GASTON_CONFIG || {}).paymentLinks && window.GASTON_CONFIG.paymentLinks[b.dataset.plan];
      if (url) { location.href = url + (url.indexOf('?') < 0 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(state.user.email) + '&client_reference_id=' + state.user.id; return; }
      msg($('ab-msg'), 'Le paiement en ligne ouvre très bientôt. Écrivez à contact@gaston-ramonage.fr : nous activons votre formule tout de suite, et votre accès continue en attendant.');
    });
  });

  // ---------- Démarrage ----------
  async function boot() {
    if (!api.ready) {
      VIEWS.forEach(function (v) { $('v-' + v).hidden = v !== 'connexion'; });
      $('auth-intro').textContent = 'L\'espace Gaston ouvre très bientôt. Inscrivez-vous à l\'essai sur la page d\'accueil : nous vous prévenons dès l\'ouverture.';
      $('auth-form').hidden = true; document.querySelector('.seg').hidden = true;
      return;
    }
    api.onAuth(function (s) { if (!s && state.user) { state.user = null; route(); } });
    try { var s = await api.session(); if (s) return start(s); } catch (e) { /* pas de session */ }
    route();
  }
  boot();
})();
