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
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
};
