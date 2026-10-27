/*
 * Gaston — génération du certificat de ramonage en PDF (A4).
 * Fonctionne dans le navigateur (window.GastonPdf) et dans Node (require).
 * Dépend de pdf-lib (objet PDFLib passé en paramètre).
 */
(function (root) {
  'use strict';

  var ORANGE = [0.761, 0.255, 0.047]; // #C2410C
  var INK = [0.11, 0.098, 0.09];      // #1C1917
  var GREY = [0.34, 0.325, 0.306];    // #57534E
  var LINE = [0.906, 0.898, 0.894];   // #E7E5E4
  var GREEN = [0.086, 0.396, 0.204];  // #166534

  // Caractères acceptés par les polices standard (WinAnsi) : on remplace le reste.
  var EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function safe(text) {
    if (text === undefined || text === null) return '';
    var s = String(text)
      .replace(/[   ]/g, ' ')
      .replace(/[‐‑‒]/g, '-')
      .replace(/\r/g, '');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      var code = c.charCodeAt(0);
      if (c === '\n' || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || EXTRA.indexOf(c) !== -1) {
        out += c;
      } else if (code >= 0x2018 && code <= 0x2019) {
        out += "'";
      } else {
        out += '?';
      }
    }
    return out;
  }

  function wrap(text, font, size, maxWidth) {
    var lines = [];
    safe(text).split('\n').forEach(function (paragraph) {
      var words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); return; }
      var line = '';
      words.forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          // mot trop long : on le coupe
          while (font.widthOfTextAtSize(word, size) > maxWidth) {
            var cut = word.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
            lines.push(word.slice(0, cut));
            word = word.slice(cut);
          }
          line = word;
        }
      });
      lines.push(line);
    });
    return lines;
  }

  function dataUrlToBytes(dataUrl) {
    var base64 = dataUrl.split(',')[1] || '';
    if (typeof atob === 'function') {
      var bin = atob(base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  async function embedImage(doc, dataUrl) {
    if (!dataUrl) return null;
    try {
      var bytes = dataUrlToBytes(dataUrl);
      if (/^data:image\/png/i.test(dataUrl)) return await doc.embedPng(bytes);
      if (/^data:image\/jpe?g/i.test(dataUrl)) return await doc.embedJpg(bytes);
    } catch (e) { /* image illisible : on l'ignore */ }
    return null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  async function buildCertificatePdf(PDFLib, d) {
    var rgb = PDFLib.rgb;
    var doc = await PDFLib.PDFDocument.create();
    doc.setTitle(safe('Certificat de ramonage ' + (d.numero || '')));
    doc.setAuthor(safe(d.entreprise.nom));
    doc.setCreator('Gaston - gaston-ramonage.fr');
    doc.setProducer('Gaston');

    var font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    var bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var W = 595.28, H = 841.89, M = 40;
    var page = doc.addPage([W, H]);
    var y = H - M;
    var C = function (a) { return rgb(a[0], a[1], a[2]); };

    function text(t, x, yy, opts) {
      opts = opts || {};
      page.drawText(safe(t), {
        x: x, y: yy, size: opts.size || 9.5,
        font: opts.bold ? bold : font,
        color: C(opts.color || INK)
      });
    }
    function para(t, x, yy, width, opts) {
      opts = opts || {};
      var size = opts.size || 9.5;
      var lh = opts.lineHeight || size * 1.35;
      var lines = wrap(t, opts.bold ? bold : font, size, width);
      lines.forEach(function (l, i) { text(l, x, yy - i * lh, opts); });
      return lines.length * lh;
    }
    function newPageIfNeeded(needed) {
      if (y - needed < M + 40) {
        page = doc.addPage([W, H]);
        y = H - M;
      }
    }

    // ---- En-tête ----
    var logo = await embedImage(doc, d.entreprise.logo);
    var headerLeft = M;
    if (logo) {
      var s = Math.min(110 / logo.width, 54 / logo.height);
      page.drawImage(logo, { x: M, y: y - logo.height * s, width: logo.width * s, height: logo.height * s });
      headerLeft = M + logo.width * s + 14;
    }
    var e = d.entreprise;
    var hy = y - 10;
    text(e.nom, headerLeft, hy, { bold: true, size: 13 });
    hy -= 15;
    [e.adresse, [e.cp, e.ville].filter(Boolean).join(' '), [e.telephone, e.email].filter(Boolean).join(' - '), e.siret ? 'SIRET ' + e.siret : '']
      .filter(Boolean).forEach(function (l) { text(l, headerLeft, hy, { size: 8.5, color: GREY }); hy -= 11.5; });

    var title = 'CERTIFICAT DE RAMONAGE';
    text(title, W - M - bold.widthOfTextAtSize(title, 15), y - 10, { bold: true, size: 15, color: ORANGE });
    var num = 'N° ' + (d.numero || '');
    text(num, W - M - font.widthOfTextAtSize(safe(num), 9.5), y - 26, { color: GREY });
    var dt = 'Intervention du ' + formatDate(d.dateIntervention);
    text(dt, W - M - font.widthOfTextAtSize(safe(dt), 9.5), y - 39, { color: GREY });

    y = Math.min(hy, y - 54) - 14;
    page.drawRectangle({ x: M, y: y, width: W - 2 * M, height: 2, color: C(ORANGE) });
    y -= 20;

    // ---- Blocs ----
    function section(label, rows) {
      var colW = (W - 2 * M);
      var labelW = 150;
      var heights = rows.map(function (r) {
        return Math.max(1, wrap(r[1] || '-', font, 9.5, colW - labelW - 20).length) * 12.8 + 6;
      });
      var total = 22 + heights.reduce(function (a, b) { return a + b; }, 0) + 6;
      newPageIfNeeded(total);
      text(label.toUpperCase(), M, y, { bold: true, size: 9, color: ORANGE });
      y -= 8;
      page.drawRectangle({ x: M, y: y - (total - 22), width: colW, height: total - 22 + 4, borderColor: C(LINE), borderWidth: 1, color: rgb(1, 1, 1) });
      y -= 14;
      rows.forEach(function (r, i) {
        text(r[0], M + 12, y, { bold: true, size: 9, color: GREY });
        var hgt = para(r[1] || '-', M + labelW, y, colW - labelW - 20, { size: 9.5, color: r[2] || INK, bold: !!r[3] });
        y -= Math.max(heights[i], hgt + 6);
      });
      y -= 16;
    }

    var c = d.client;
    section('Client et installation', [
      ['Client', c.nom],
      ["Adresse de l'installation", [c.adresse, [c.cp, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
      ['Appareil', [d.appareil.type, d.appareil.marque].filter(Boolean).join(' - ')],
      ['Combustible', d.appareil.combustible],
      ['Conduit(s) ramoné(s)', d.conduit.description],
      ['Méthode', d.conduit.methode]
    ]);

    section('Contrôle', [
      ['Vacuité du conduit', d.controle.vacuite
        ? 'Vérifiée sur toute la longueur du conduit'
        : 'NON VÉRIFIÉE - voir observations', d.controle.vacuite ? GREEN : ORANGE, true],
      ['Observations, anomalies', d.controle.observations || 'Aucune anomalie constatée']
    ]);

    if (d.controle.conseils) {
      section('Conseils au client', [['Bonne utilisation', d.controle.conseils]]);
    }

    section('Professionnel', [
      ['Intervenant', d.entreprise.ramoneur],
      ['Qualification', d.entreprise.qualification],
      ['Assurance RC Pro', [d.entreprise.assureur, d.entreprise.police ? 'police n° ' + d.entreprise.police : ''].filter(Boolean).join(', ')],
      ['Prochain ramonage avant le', formatDate(d.prochainRamonage), ORANGE, true]
    ]);

    // ---- Signatures ----
    newPageIfNeeded(130);
    var boxW = (W - 2 * M - 20) / 2, boxH = 84;
    var sigs = [
      ['Signature du ramoneur', d.signatures.ramoneur, d.entreprise.ramoneur],
      ['Signature du client', d.signatures.client, d.client.nom]
    ];
    for (var i = 0; i < sigs.length; i++) {
      var bx = M + i * (boxW + 20);
      text(sigs[i][0], bx, y, { bold: true, size: 9, color: GREY });
      page.drawRectangle({ x: bx, y: y - 8 - boxH, width: boxW, height: boxH, borderColor: C(LINE), borderWidth: 1 });
      var img = await embedImage(doc, sigs[i][1]);
      if (img) {
        var sc = Math.min((boxW - 20) / img.width, (boxH - 26) / img.height);
        page.drawImage(img, { x: bx + (boxW - img.width * sc) / 2, y: y - 8 - boxH + 18, width: img.width * sc, height: img.height * sc });
      }
      text(sigs[i][2] || '', bx + 8, y - 8 - boxH + 6, { size: 8, color: GREY });
    }
    y -= boxH + 30;

    // ---- Pied de page ----
    var foot = 'Attestation de ramonage établie conformément au décret n° 2023-641 du 20 juillet 2023 relatif à l\'entretien des appareils à combustion et au ramonage des conduits de fumée. Document à conserver jusqu\'au prochain ramonage et à présenter à votre assureur en cas de sinistre.';
    newPageIfNeeded(50);
    para(foot, M, Math.max(y, M + 34), W - 2 * M, { size: 7.5, color: GREY });
    var pages = doc.getPages();
    pages.forEach(function (p, idx) {
      var mark = 'Certificat créé avec Gaston - gaston-ramonage.fr' + (pages.length > 1 ? '   ' + (idx + 1) + '/' + pages.length : '');
      p.drawText(safe(mark), { x: M, y: M - 16, size: 7, font: font, color: C(GREY) });
    });

    return await doc.save();
  }

  var api = { buildCertificatePdf: buildCertificatePdf, safe: safe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GastonPdf = api;
})(typeof window !== 'undefined' ? window : this);
