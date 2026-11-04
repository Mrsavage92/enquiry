-- Website enquiry forms post straight into Enquiry (POST /api/inbound/form).
--
-- Each business can hold one inbound key: a random secret its own website
-- sends with every form submission. Only the SHA-256 hash is stored, so a
-- database read never reveals a usable key; the owner sees the key once, when
-- it is created or rotated. key_hint is the last four characters, so the owner
-- can tell which key a site is using without the key itself being kept.
--
-- allowed_origins is per business: the browser origins (scheme + host, no
-- path) whose pages may call the endpoint. CORS is answered from this list,
-- never from a hardcoded one.
--
-- inbound_submission makes delivery idempotent and rate-limitable. The website
-- sends its own submission id; the primary key (business_id, submission_id)
-- means a retried POST can never create a second enquiry, and the rows are
-- counted per business and per hashed IP to cap how fast one key or one
-- visitor can create enquiries. The IP is never stored raw.
--
-- Like every other Enquiry table (0005), RLS is on with no policies: anon and
-- authenticated are denied, and the app's own role bypasses RLS. Production
-- apply runs as the owner role; the grants below are guarded so this file is a
-- no-op for them on PGlite, where the enquiry_app role does not exist.

create table if not exists business_inbound (
  business_id uuid primary key references business(id) on delete cascade,
  key_hash text not null unique,
  key_hint text not null default '',
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
alter table business_inbound enable row level security;

create table if not exists inbound_submission (
  business_id uuid not null references business(id) on delete cascade,
  submission_id text not null,
  enquiry_id uuid references enquiry(id) on delete set null,
  ip_hash text not null default '',
  received_at timestamptz not null default now(),
  primary key (business_id, submission_id)
);
create index if not exists inbound_submission_recent_idx
  on inbound_submission (business_id, received_at desc);
create index if not exists inbound_submission_ip_idx
  on inbound_submission (business_id, ip_hash, received_at desc);
alter table inbound_submission enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'enquiry_app') then
    execute 'grant select, insert, update, delete on business_inbound to enquiry_app';
    execute 'grant select, insert, update, delete on inbound_submission to enquiry_app';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on business_inbound from anon';
    execute 'revoke all on inbound_submission from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on business_inbound from authenticated';
    execute 'revoke all on inbound_submission from authenticated';
  end if;
end $$;
