# Server for park reports, the park office panel and safety check-ins

Without a server the site runs in demo mode: reports and check-ins stay in the browser.
With it, a report sent from any phone appears on the park office panel within a few seconds.

1. Create a free project at supabase.com.
2. Dashboard → SQL Editor → New query → paste `schema.sql` → Run.
3. Project Settings → API: copy the project URL and the anon (publishable) key into
   `assets/parks/config.js`. This key is meant to be public; row-level security in `schema.sql`
   decides what it may do. Never put the service-role key in the site.
4. Optional SMS alarm: deploy `functions/overdue-alarm` and add Twilio secrets, as described at
   the end of `schema.sql`. Without it, the office panel still shows overdue visitors and their last point.

Demo limits to say out loud: the office panel has no login, and anyone with the site can mark a
report fixed. A real version gives rangers accounts and moves those rights to the `authenticated` role.
