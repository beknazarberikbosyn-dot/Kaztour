/* Samruk Travel server settings. Empty = demo mode: reports, passes and host applications stay in this browser.
   Fill the values from Supabase → Project Settings → API (the anon / publishable key is meant to be public).
   passPublicKey is the public half of the pass-signing key (supabase/make-pass-key.mjs): it can check passes, not make them.
   The database tables come from supabase/schema.sql, the server functions from supabase/functions. */
window.SR_CONFIG = window.SR_CONFIG || {
  supabaseUrl: '',
  supabaseKey: '',
  passPublicKey: null
};
