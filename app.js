/* Gaston — générateur de certificat de ramonage (côté navigateur). */
(function () {
  'use strict';

  var STORE_KEY = 'gaston.v1';
  var form = document.getElementById('form');
  var errorsBox = document.getElementById('errors');
  var doneBox = document.getElementById('done');
  var submitBtn = document.getElementById('submit');

  var CONSEILS_SOLIDES = "Utilisez uniquement du bois sec (moins de 20 % d'humidité), stocké à l'abri. " +
    "Ne brûlez ni déchets, ni bois traité ou peint, ni papiers glacés. " +
    "Faites entretenir l'appareil chaque année et gardez les entrées d'air dégagées. " +
    "Un fonctionnement à allure réduite prolongée favorise le bistre : privilégiez des feux vifs.";

  // ---------- Mémoire locale ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* stockage plein ou bloqué */ }
  }
  var store = load();

  var ENTREPRISE_FIELDS = ['e_nom', 'e_adresse', 'e_cp', 'e_ville', 'e_telephone', 'e_email', 'e_siret',
    'e_qualification', 'e_assureur', 'e_police', 'e_ramoneur', 'lead_email'];

  ENTREPRISE_FIELDS.forEach(function (name) {
    if (store[name]) form.elements[name].value = store[name];
  });

  // ---------- Dates par défaut ----------
  function iso(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function plusOneYear(isoDate) {
    var p = isoDate.split('-').map(Number);
    var d = new Date(p[0] + 1, p[1] - 1, p[2]);
    return iso(d);
  }
  var today = iso(new Date());
  form.elements.date.value = today;
  form.elements.prochain.value = plusOneYear(today);
  var prochainTouched = false;
  form.elements.prochain.addEventListener('input', function () { prochainTouched = true; });
  form.elements.date.addEventListener('change', function () {
    if (!prochainTouched && form.elements.date.value) form.elements.prochain.value = plusOneYear(form.elements.date.value);
  });

  // ---------- Conseils pré-remplis ----------
  var conseilsTouched = false;
  form.elements.conseils.addEventListener('input', function () { conseilsTouched = true; });
  function updateConseils() {
    if (conseilsTouched) return;
    var solide = ['Bois', 'Granulés', 'Charbon'].indexOf(form.elements.a_combustible.value) !== -1;
    form.elements.conseils.value = solide ? CONSEILS_SOLIDES : '';
  }
  form.elements.a_combustible.addEventListener('change', updateConseils);
  updateConseils();

  // ---------- Logo ----------
  var logoInput = document.getElementById('logo');
  var logoPreview = document.getElementById('logo-preview');
  var logoRemove = document.getElementById('logo-remove');
  var logoData = store.logo || '';
  function showLogo() {
    logoPreview.hidden = !logoData;
    logoRemove.hidden = !logoData;
    if (logoData) logoPreview.src = logoData;
  }
  showLogo();
  logoInput.addEventListener('change', function () {
    var file = logoInput.files && logoInput.files[0];
    if (!file) return;
    var img = new Image();
    var reader = new FileReader();
    reader.onload = function () {
      img.onload = function () {
        // réduit le logo à 600 px max pour un PDF léger
        var scale = Math.min(1, 600 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        logoData = c.toDataURL('image/png');
        store.logo = logoData;
        save(store);
        showLogo();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  logoRemove.addEventListener('click', function () {
    logoData = '';
    delete store.logo;
    save(store);
    logoInput.value = '';
    showLogo();
  });

  // ---------- Signatures ----------
  function SignaturePad(canvas) {
    var ctx = canvas.getContext('2d');
    var drawing = false, empty = true, last = null;
    function resize() {
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      var data = empty ? null : canvas.toDataURL();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1C1917';
      if (data) drawImage(data);
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true; empty = false; last = pos(e);
      canvas.setPointerCapture(e.pointerId);
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#1C1917'; ctx.fill();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    function end() { if (drawing && pad.onchange) pad.onchange(); drawing = false; }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    function drawImage(dataUrl) {
      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      };
      img.src = dataUrl;
      empty = false;
    }
    var pad = {
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; },
      isEmpty: function () { return empty; },
      toDataURL: function () { return empty ? '' : canvas.toDataURL('image/png'); },
      load: drawImage,
      resize: resize,
      onchange: null
    };
    resize();
    return pad;
  }

  var pads = {
    'sig-ramoneur': SignaturePad(document.getElementById('sig-ramoneur')),
    'sig-client': SignaturePad(document.getElementById('sig-client'))
  };
  if (store.signature) pads['sig-ramoneur'].load(store.signature);
  pads['sig-ramoneur'].onchange = function () {
    store.signature = pads['sig-ramoneur'].toDataURL();
    save(store);
  };
  document.querySelectorAll('[data-clear]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-clear');
      pads[id].clear();
      if (id === 'sig-ramoneur') { delete store.signature; save(store); }
    });
  });
  window.addEventListener('resize', function () {
    Object.keys(pads).forEach(function (k) { pads[k].resize(); });
  });

  // ---------- Numérotation ----------
  function nextNumber() {
    var year = new Date().getFullYear();
    var counter = store.counter && store.counter.year === year ? store.counter.n + 1 : 1;
    return { year: year, n: counter, label: year + '-' + String(counter).padStart(4, '0') };
  }

  // un champ corrigé perd son contour rouge
  form.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('invalid') && e.target.value.trim() !== '') {
      e.target.classList.remove('invalid');
      e.target.setAttribute('aria-invalid', 'false');
    }
  });

  // ---------- Validation ----------
  function validate() {
    var missing = [];
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var ok = el.value && el.value.trim() !== '';
      if (el.type === 'email' && ok) ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim());
      el.classList.toggle('invalid', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) missing.push(el.closest('label') ? el.closest('label').firstChild.textContent.replace('*', '').trim() : el.name);
    });
    if (pads['sig-ramoneur'].isEmpty()) missing.push("Signature de l'intervenant");
    if (pads['sig-client'].isEmpty()) missing.push('Signature du client');
    return missing;
  }

  function v(name) { return (form.elements[name].value || '').trim(); }

  // ---------- Téléchargement ----------
  // Dans l'aperçu claude.ai, le téléchargement passe par la capacité « downloads » ;
  // sur le vrai site, par un lien de téléchargement classique.
  var downloadsReady = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').catch(function () { return null; })
    : Promise.resolve(null);

  async function savePdf(blob, filename) {
    var downloads = window.claude ? await downloadsReady : null;
    if (downloads) {
      try {
        await downloads.save({ filename: filename, data: blob });
        return true;
      } catch (e) {
        errorsBox.textContent = e && e.code === 'declined'
          ? 'Téléchargement annulé.'
          : 'Le téléchargement n\'est pas disponible ici.';
        errorsBox.hidden = false;
        return false;
      }
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return true;
  }

  // ---------- Envoi ----------
  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    doneBox.hidden = true;
    var missing = validate();
    if (missing.length) {
      errorsBox.textContent = 'À compléter : ' + missing.join(', ') + '.';
      errorsBox.hidden = false;
      var firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    errorsBox.hidden = true;

    ENTREPRISE_FIELDS.forEach(function (name) { store[name] = v(name); });
    var number = nextNumber();

    var data = {
      numero: number.label,
      dateIntervention: v('date'),
      prochainRamonage: v('prochain'),
      entreprise: {
        nom: v('e_nom'), adresse: v('e_adresse'), cp: v('e_cp'), ville: v('e_ville'),
        telephone: v('e_telephone'), email: v('e_email'), siret: v('e_siret'),
        qualification: v('e_qualification'), assureur: v('e_assureur'), police: v('e_police'),
        ramoneur: v('e_ramoneur'), logo: logoData
      },
      client: { nom: v('c_nom'), adresse: v('c_adresse'), cp: v('c_cp'), ville: v('c_ville') },
      appareil: { type: v('a_type'), marque: v('a_marque'), combustible: v('a_combustible') },
      conduit: { description: v('k_description'), methode: v('k_methode') },
      controle: { vacuite: form.elements.vacuite.checked, observations: v('observations'), conseils: v('conseils') },
      signatures: { ramoneur: pads['sig-ramoneur'].toDataURL(), client: pads['sig-client'].toDataURL() }
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Création du PDF…';
    try {
      var bytes = await window.GastonPdf.buildCertificatePdf(window.PDFLib, data);
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var clientSlug = data.client.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      var filename = 'certificat-ramonage-' + number.label + (clientSlug ? '-' + clientSlug : '') + '.pdf';
      var saved = await savePdf(blob, filename);
      if (!saved) return;

      store.counter = { year: number.year, n: number.n };
      save(store);
      doneBox.textContent = 'Certificat ' + number.label + ' téléchargé. Pensez à l\'envoyer à votre client.';
      doneBox.hidden = false;

      // client suivant : on vide la partie client
      ['c_nom', 'c_adresse', 'c_cp', 'c_ville', 'a_marque', 'k_description', 'observations'].forEach(function (n) { form.elements[n].value = ''; });
      pads['sig-client'].clear();

      // inscription du ramoneur (sans bloquer le téléchargement)
      fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: store.lead_email, entreprise: store.e_nom, ville: store.e_ville })
      }).catch(function () { /* hors ligne ou aperçu : sans importance */ });
    } catch (err) {
      errorsBox.textContent = 'Le PDF n\'a pas pu être créé. Réessayez, ou écrivez-nous à contact@gaston-ramonage.fr.';
      errorsBox.hidden = false;
      if (window.console) console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Télécharger le certificat PDF';
    }
  });
})();
