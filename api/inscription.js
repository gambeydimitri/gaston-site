// Fonction serveur Vercel : ajoute le ramoneur à votre liste de contacts Brevo.
// Variables d'environnement à définir dans Vercel :
//   BREVO_API_KEY  -> clé API Brevo (Paramètres > Clés API)
//   BREVO_LIST_ID  -> numéro de la liste « Ramoneurs » dans Brevo
//   BREVO_LIST_ID_FONDATEURS -> numéro de la liste « Fondateurs » (réservations de la page d'accueil)
// Sans ces variables, la fonction répond simplement OK sans rien enregistrer.

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query && req.query.diag === 'gaston27') {
    // Diagnostic temporaire : codes de réponse Brevo uniquement, aucune donnée.
    var key = String(process.env.BREVO_API_KEY || '').trim();
    var h = { 'api-key': key, accept: 'application/json', 'content-type': 'application/json' };
    var out = { keyLength: key.length, keyPrefix: key.slice(0, 7) };
    try { var a = await fetch('https://api.brevo.com/v3/account', { headers: h }); out.account = a.status; } catch (e) { out.account = 'err ' + e.message; }
    try { var l = await fetch('https://api.brevo.com/v3/contacts/lists?limit=10', { headers: h }); out.lists = l.status; } catch (e) { out.lists = 'err ' + e.message; }
    try {
      var c = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: h, body: JSON.stringify({ email: 'gambeydimitri+diag@gmail.com', updateEnabled: true }) });
      out.createNoList = c.status; try { out.createNoListBody = (await c.text()).slice(0, 200); } catch (e) {}
    } catch (e) { out.createNoList = 'err ' + e.message; }
    res.status(200).json(out);
    return;
  }
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
