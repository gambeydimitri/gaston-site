/* Page d'accueil : inscription à l'essai gratuit (liste Brevo des fondateurs). */
(function () {
  'use strict';
  var form = document.getElementById('fondateur-form');
  if (!form) return;
  var input = document.getElementById('fondateur-email');
  var status = document.getElementById('fondateur-status');
  var button = form.querySelector('button');

  function show(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
    status.hidden = false;
  }

  input.addEventListener('input', function () { input.classList.remove('invalid'); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      input.classList.add('invalid');
      show('Indiquez une adresse e-mail valide, par exemple vous@exemple.fr.', true);
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Inscription…';
    try {
      var r = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: 'fondateur' })
      });
      if (!r.ok) throw new Error('http ' + r.status);
      var data = await r.json().catch(function () { return {}; });
      if (data.enregistre === false) throw new Error('liste non configurée');
      form.reset();
      show('C\'est noté ! Vous recevez votre accès à l\'essai par e-mail dès l\'ouverture, début décembre.');
    } catch (err) {
      show('L\'inscription n\'a pas abouti. Réessayez, ou écrivez à contact@gaston-ramonage.fr.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Commencer mon essai gratuit';
    }
  });
})();
