-- Qualitative roadmap research. Write-only from the public site:
-- no list/read endpoint returns these rows to visitors.
-- Separate from roadmap_interest so toggling "I need this" off
-- does not delete volunteered problem statements.

create table if not exists roadmap_feedback (
  id text primary key,
  feature_id text not null,
  session_id text not null,
  waitlist_id text,
  problem_text text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists roadmap_feedback_session_idx on roadmap_feedback (session_id);
create index if not exists roadmap_feedback_feature_idx on roadmap_feedback (feature_id);
