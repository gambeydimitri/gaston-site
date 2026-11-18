/* Gaston · accès aux données (Supabase). Toutes les requêtes passent par ici. */
(function () {
  'use strict';
  var cfg = window.GASTON_CONFIG || {};
  var sb = null;
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  function must(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  window.GastonApi = {
    ready: !!sb,
    // Comptes
    session: async function () { return must(await sb.auth.getSession()).session; },
    onAuth: function (cb) { sb.auth.onAuthStateChange(function (_e, s) { cb(s); }); },
    signUp: async function (email, password) { return must(await sb.auth.signUp({ email: email, password: password })); },
    signIn: async function (email, password) { return must(await sb.auth.signInWithPassword({ email: email, password: password })); },
    signOut: async function () { await sb.auth.signOut(); },
    // Profil
    profile: async function (uid) { return must(await sb.from('profiles').select('*').eq('id', uid).single()); },
    saveProfile: async function (uid, patch) { return must(await sb.from('profiles').update(patch).eq('id', uid).select().single()); },
    // Clients
    clients: async function () { return must(await sb.from('clients').select('*').order('nom')); },
    addClient: async function (c) { return must(await sb.from('clients').insert(c).select().single()); },
    saveClient: async function (id, c) { return must(await sb.from('clients').update(c).eq('id', id).select().single()); },
    // Certificats
    certificats: async function () {
      return must(await sb.from('certificats').select('id, client_id, numero, date_intervention, prochain_ramonage, created_at, client_nom:data->client->>nom, appareil:data->appareil->>type').order('date_intervention', { ascending: false }).order('created_at', { ascending: false }));
    },
    certificat: async function (id) { return must(await sb.from('certificats').select('*').eq('id', id).single()); },
    exportAll: async function () { return must(await sb.from('certificats').select('*').order('date_intervention')); },
    addCertificat: async function (c) { return must(await sb.from('certificats').insert(c).select().single()); }
  };
})();
