// Fonction serveur Vercel : ajoute le ramoneur à votre liste de contacts Brevo.
// Variables d'environnement à définir dans Vercel :
//   BREVO_API_KEY  -> clé API Brevo (Paramètres > Clés API)
//   BREVO_LIST_ID  -> numéro de la liste « Ramoneurs » dans Brevo
//   BREVO_LIST_ID_FONDATEURS -> numéro de la liste « Fondateurs » (réservations de la page d'accueil)
// Sans ces variables, la fonction répond simplement OK sans rien enregistrer.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  var body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  var email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    res.status(400).json({ ok: false, error: 'email' });
    return;
  }
  if (!process.env.BREVO_API_KEY) {
    res.status(200).json({ ok: true, enregistre: false });
    return;
  }
  var payload = { email: email, updateEnabled: true };
  var listId = body.source === 'fondateur' && process.env.BREVO_LIST_ID_FONDATEURS
    ? process.env.BREVO_LIST_ID_FONDATEURS
    : process.env.BREVO_LIST_ID;
  if (listId) payload.listIds = [Number(listId)];

  try {
    var r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': String(process.env.BREVO_API_KEY).trim(),
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      res.status(200).json({ ok: true });
      return;
    }
    var detail = {};
    try { detail = await r.json(); } catch (e) {}
    console.error('Brevo a refusé l\'inscription', r.status, detail.code, detail.message);
    res.status(502).json({ ok: false, brevo: r.status, code: detail.code || null });
  } catch (e) {
    console.error('Brevo injoignable', e && e.message);
    res.status(502).json({ ok: false, code: 'reseau' });
  }
};
