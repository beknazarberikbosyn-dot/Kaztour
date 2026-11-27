# Server: park reports, office panel, safety check-ins, signed passes and host applications

Without a server the site runs in demo mode: everything stays in the browser, and the browser plays the server.
With it, a report sent from any phone appears on the park office panel within a few seconds.

1. Create a free project at supabase.com.
2. Dashboard → SQL Editor → New query → paste `schema.sql` → Run.
3. Make the pass-signing key: `node supabase/make-pass-key.mjs`.
   Put the private key on the server only: `supabase secrets set PASS_SIGN_KEY='<private JSON>'`.
4. Deploy the functions, without the platform JWT check (each function checks what it needs itself):
   `supabase functions deploy pass-issue host-apply office --no-verify-jwt`
5. Project Settings → API: copy the project URL and the anon (publishable) key into
   `assets/parks/config.js`, and the public key from step 3 as `passPublicKey`.
   Never put the service-role key or the private key in the site.
6. Park office account: Authentication → Users → Add user (email and password), then in SQL Editor:
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"office"}' where email = '...';`
7. Optional SMS alarm: deploy `functions/overdue-alarm` and add Twilio secrets, as described at
   the end of `schema.sql`. Without it, the office panel still shows overdue visitors and their last point.

What each function does:
- `pass-issue` reads the host's price from the database, signs the pass with ECDSA P-256 and stores it.
  The browser can no longer insert passes, and the site checks every pass with the public key, also offline.
- `host-apply` takes an owner's application: IIN / BIN (check digit), cadastral number, eGov certificate and
  a scan of the right document (kept in the private bucket `host-docs`). The applicant gets a private token for the status.
- `office` needs a park office login: lists applications with a 10-minute link to each document, approves
  (publishes the place as checked), asks for more or rejects, and marks existing places as checked.

Demo limits to say out loud: marking a report fixed needs no login yet; hosts have no login yet, so anyone
can change a place's prices and opening; payments are not connected (a real version issues the pass from
a Kaspi or card payment webhook); the land registry (EGKN) check is done by hand.
