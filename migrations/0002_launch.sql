-- Pre-launch waitlist, roadmap interest, and funnel events.
-- Emails are write-only: no public list endpoint reads this table.

create table if not exists waitlist (
  id text primary key,
  email text not null unique,
  business_type text,
  enquiry_volume text,
  pain_text text,
  channels text,
  beta_interest text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer text,
  linkedin_post_id text,
  first_touch text,
  latest_touch text,
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);

create table if not exists roadmap_interest (
  id text primary key,
  feature_id text not null,
  session_id text not null,
  waitlist_id text,
  created_at timestamptz not null default now(),
  unique (feature_id, session_id)
);

create index if not exists roadmap_interest_feature_idx on roadmap_interest (feature_id);

create table if not exists launch_events (
  id text primary key,
  session_id text not null,
  event_name text not null,
  feature_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer text,
  landing_path text,
  created_at timestamptz not null default now()
);

create index if not exists launch_events_session_idx on launch_events (session_id);
create index if not exists launch_events_name_idx on launch_events (event_name);
