-- Samruk Travel · park reports, park office panel and safety check-ins.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Then put the project URL and the anon (publishable) key into assets/parks/config.js.
--
-- Demo security model (say it out loud in the pitch):
--   * anyone with the site can send a report and read reports (they are public, like map pins);
--   * the park office panel has no login in this prototype, so anyone can mark a report fixed;
--     a real version gives rangers a login and moves these policies to the "authenticated" role;
--   * check-ins hold a private phone number: the table is closed to the browser; the site writes
--     through the functions below and reads only the masked view checkins_public.

-- ---------- reports from visitors ----------
create table if not exists public.reports (
  id        text primary key check (id ~ '^[a-z0-9]{4,40}$'),
  park      text not null check (park in ('kolsai','charyn','bigalmaty','burabay','altynemel')),
  f         text check (f is null or f ~ '^[a-z]-[a-z0-9]{2,8}$'),
  kind      text not null check (kind in ('dirty','closed','supplies','full','litter','nowater','broken','nosig','sigok','ok')),
  lat       double precision not null check (lat between 35 and 56),
  lng       double precision not null check (lng between 45 and 88),
  ts        bigint not null,                    -- when the visitor tapped, ms since 1970 (phone clock)
  note      text check (char_length(note) <= 140),
  photo     text check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 60000)),
  src       text not null default 'phone' check (src in ('phone','relay')),  -- relay = carried by another traveler's phone
  status    text not null default 'new' check (status in ('new','work','done')),
  done_at   bigint,
  sent_at   bigint,                             -- when the phone finally had signal
  received_at timestamptz not null default now()
);
create index if not exists reports_park_ts on public.reports (park, ts desc);

alter table public.reports enable row level security;
drop policy if exists "reports readable" on public.reports;
drop policy if exists "reports insert" on public.reports;
drop policy if exists "reports office update" on public.reports;
create policy "reports readable" on public.reports for select to anon, authenticated using (true);
create policy "reports insert" on public.reports for insert to anon, authenticated with check (status = 'new' and done_at is null);
create policy "reports office update" on public.reports for update to anon, authenticated using (true) with check (true);
revoke update on public.reports from anon, authenticated;
grant select, insert on public.reports to anon, authenticated;
grant update (status, done_at) on public.reports to anon, authenticated;   -- the office may change only these two columns

-- ---------- safety check-ins: "if I am not back by HH:MM, text my contact my last point" ----------
create table if not exists public.checkins (
  id        text primary key check (id ~ '^[a-z0-9]{4,40}$'),
  name      text not null check (char_length(name) between 1 and 60),
  contact   text not null check (contact ~ '^\+?[0-9 ()-]{6,20}$'),
  park      text,
  tour      text,
  due_at    bigint not null,
  last_lat  double precision,
  last_lng  double precision,
  last_ts   bigint,
  last_src  text default 'phone',
  status    text not null default 'out' check (status in ('out','back')),
  back_at   bigint,
  sms_sent_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.checkins enable row level security;   -- no policies: the browser cannot read or write the table directly
revoke all on public.checkins from anon, authenticated;

-- masked view for the park office panel: first name, masked phone, last point, state
create or replace view public.checkins_public as
  select id, split_part(name, ' ', 1) as name,
         '+' || left(regexp_replace(contact, '[^0-9]', '', 'g'), 1) || ' ' || substr(regexp_replace(contact, '[^0-9]', '', 'g'), 2, 3) || ' ••• •• ' || right(regexp_replace(contact, '[^0-9]', '', 'g'), 2) as contact_masked,
         park, tour, due_at, last_lat, last_lng, last_ts, last_src, status, back_at, sms_sent_at,
         case when status = 'out' and due_at < (extract(epoch from now()) * 1000)::bigint then 'overdue' else status end as state
  from public.checkins
  where created_at > now() - interval '3 days';
grant select on public.checkins_public to anon, authenticated;

create or replace function public.checkin_start(p_id text, p_name text, p_contact text, p_park text, p_tour text, p_due bigint, p_lat double precision, p_lng double precision, p_ts bigint)
returns void language sql security definer set search_path = public as $$
  insert into public.checkins (id, name, contact, park, tour, due_at, last_lat, last_lng, last_ts)
  values (p_id, p_name, p_contact, p_park, p_tour, p_due, p_lat, p_lng, p_ts)
  on conflict (id) do update set name = excluded.name, contact = excluded.contact, due_at = excluded.due_at,
    park = excluded.park, tour = excluded.tour, status = 'out', back_at = null, sms_sent_at = null;
$$;

-- a newer point wins; points carried by another traveler (relay) arrive late and out of order
create or replace function public.checkin_point(p_id text, p_lat double precision, p_lng double precision, p_ts bigint, p_src text default 'phone')
returns void language sql security definer set search_path = public as $$
  update public.checkins set last_lat = p_lat, last_lng = p_lng, last_ts = p_ts, last_src = coalesce(p_src, 'phone')
  where id = p_id and (last_ts is null or last_ts < p_ts);
$$;

create or replace function public.checkin_back(p_id text, p_ts bigint)
returns void language sql security definer set search_path = public as $$
  update public.checkins set status = 'back', back_at = p_ts where id = p_id;
$$;

revoke all on function public.checkin_start(text,text,text,text,text,bigint,double precision,double precision,bigint) from public;
revoke all on function public.checkin_point(text,double precision,double precision,bigint,text) from public;
revoke all on function public.checkin_back(text,bigint) from public;
grant execute on function public.checkin_start(text,text,text,text,text,bigint,double precision,double precision,bigint) to anon, authenticated;
grant execute on function public.checkin_point(text,double precision,double precision,bigint,text) to anon, authenticated;
grant execute on function public.checkin_back(text,bigint) to anon, authenticated;

-- ---------- facilities from local hosts: guesthouses and cafés open toilets, showers, water, Wi-Fi ----------
-- The site ships ten sample hosts in code; this table holds new places and every change of price or opening.
create table if not exists public.hosts (
  id       text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  park     text not null check (park in ('kolsai','charyn','bigalmaty','burabay','altynemel')),
  name     text not null check (char_length(name) between 2 and 60),
  village  text check (char_length(village) <= 60),
  lat      double precision not null check (lat between 35 and 56),
  lng      double precision not null check (lng between 45 and 88),
  hours    text check (char_length(hours) <= 20),
  svc      jsonb not null default '{}'::jsonb,       -- {"toilet":{"p":200,"open":true}, ...}
  verified boolean not null default false,           -- the park office checks new places
  rating   numeric,
  updated_at timestamptz not null default now()
);
alter table public.hosts enable row level security;
drop policy if exists "hosts readable" on public.hosts;
drop policy if exists "hosts write" on public.hosts;
drop policy if exists "hosts update" on public.hosts;
create policy "hosts readable" on public.hosts for select to anon, authenticated using (true);
create policy "hosts write" on public.hosts for insert to anon, authenticated with check (true);
create policy "hosts update" on public.hosts for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.hosts to anon, authenticated;
-- demo: anyone may edit a host and mark it checked. A real version gives hosts and rangers accounts.

-- passes a visitor buys for one facility at one host; the host checks the QR, also offline
create table if not exists public.passes (
  id      text primary key check (id ~ '^[a-z0-9]{4,40}$'),
  host    text not null,
  svc     text not null check (svc in ('toilet','shower','water','charge','wifi','parking','meal')),
  price   integer not null check (price between 0 and 100000),
  ts      bigint not null,
  sig     text not null,
  status  text not null default 'paid' check (status in ('paid','used')),
  used_at bigint
);
create index if not exists passes_host_ts on public.passes (host, ts desc);
alter table public.passes enable row level security;
drop policy if exists "passes readable" on public.passes;
drop policy if exists "passes insert" on public.passes;
drop policy if exists "passes use" on public.passes;
create policy "passes readable" on public.passes for select to anon, authenticated using (true);
create policy "passes insert" on public.passes for insert to anon, authenticated with check (status = 'paid' and used_at is null);
create policy "passes use" on public.passes for update to anon, authenticated using (status = 'paid') with check (status = 'used');
revoke update on public.passes from anon, authenticated;
grant select, insert on public.passes to anon, authenticated;
grant update (status, used_at) on public.passes to anon, authenticated;
-- a pass can be used once: the update only matches rows that are still 'paid'

-- ---------- SMS alarm (optional, needs a Twilio account) ----------
-- 1) Deploy supabase/functions/overdue-alarm with the Supabase CLI and set its secrets:
--      supabase functions deploy overdue-alarm
--      supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+1...
-- 2) Run it every minute (Database → Extensions: enable pg_cron and pg_net), replacing PROJECT and SERVICE_ROLE_KEY:
--   select cron.schedule('overdue-alarm', '* * * * *', $cron$
--     select net.http_post(url := 'https://PROJECT.supabase.co/functions/v1/overdue-alarm',
--                          headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb);
--   $cron$);
-- Without Twilio the office panel still shows overdue visitors with their last point.
