/* Samruk Travel server settings. Empty = demo mode: reports stay in this browser.
   Fill both values from Supabase → Project Settings → API (the anon / publishable key is meant to be public).
   The database tables come from supabase/schema.sql. */
window.SR_CONFIG = window.SR_CONFIG || {
  supabaseUrl: '',
  supabaseKey: ''
};
