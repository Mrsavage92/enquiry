-- Server-side settings that the deploy cannot yet carry as env vars.
--
-- The first row is alert_webhook_url. Production env vars on this project can
-- only be set from the Vercel dashboard; until the owner does that, the alert
-- relay's URL lives here so failures reach a person instead of a log stream.
-- Read by src/lib/server/alert.ts, env var first, this table second.
--
-- Production apply (owner role) needs the grant + RLS lines below, see
-- scripts/migrate.mjs. On the PGLite preview the app owns the table anyway.

create table if not exists launch_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table launch_settings enable row level security;
