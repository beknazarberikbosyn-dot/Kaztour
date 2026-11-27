/* Samruk Travel server settings. Empty = demo mode: reports, passes and host applications stay in this browser.
   Fill the values from Supabase → Project Settings → API (the anon / publishable key is meant to be public).
   passPublicKey is the public half of the pass-signing key (supabase/make-pass-key.mjs): it can check passes, not make them.
   The database tables come from supabase/schema.sql, the server functions from supabase/functions. */
window.SR_CONFIG = window.SR_CONFIG || {
  supabaseUrl: 'https://ojxiurlngvsmsvukcscm.supabase.co',
  supabaseKey: 'sb_publishable_zBgN-E5-XoB7v51u2jmdWA_Q1E-d8kJ',
  passPublicKey: {"kty":"EC","crv":"P-256","x":"AmvO1x3xl8qf72LJe471yRWWv5snc7s6FOblvQy57g0","y":"iz0TQNDkd19xQKz6O9p52Evuao3c3xTDiUdJAkAo9CA"}
};
