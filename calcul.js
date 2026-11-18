/* Calculateur des gains (page d'accueil). Estimation indicative. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('c-clients')) return;
  var fmt = new Intl.NumberFormat('fr-FR');
  var PRIX_PRO = 29 * 12, MIN_GAGNEES = 8;
  function maj() {
    var n = +$('c-clients').value, prix = +$('c-prix').value, taux = +$('c-retour').value;
    var recup = Math.round(n * taux / 100), ca = recup * prix, heures = Math.round(n * MIN_GAGNEES / 60);
    var seuil = Math.ceil(PRIX_PRO / prix);
    $('c-clients-v').textContent = fmt.format(n);
    $('c-prix-v').textContent = prix + ' €';
    $('c-retour-v').textContent = taux + ' %';
    $('c-ca').textContent = fmt.format(ca) + ' €';
    $('c-h').textContent = fmt.format(heures) + ' h';
    $('c-rent').textContent = 'Il est rentabilisé dès ' + seuil + ' ramonage' + (seuil > 1 ? 's' : '') + ' récupéré' + (seuil > 1 ? 's' : '') + '.';
  }
  ['c-clients', 'c-prix', 'c-retour'].forEach(function (id) { $(id).addEventListener('input', maj); });
  maj();
})();
