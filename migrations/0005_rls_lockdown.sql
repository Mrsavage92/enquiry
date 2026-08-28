-- Deny anon/authenticated access to every Enquiry table.
--
-- Enquiry currently shares a Supabase project with another product whose anon
-- key ships in a public client bundle. Without RLS, that key would read every
-- Enquiry row. This is also the correct default standalone: nothing in this app
-- talks to Postgres from the browser.
--
-- RLS is enabled with NO policies, so anon and authenticated are denied
-- outright. The app reaches Postgres over a direct owner connection (pg driver
-- via DATABASE_URL) which bypasses RLS, so the app is unaffected. Authorization
-- is enforced server-side by scoping every query through business_member.
--
-- If Enquiry ever adopts supabase-js on the client, write real policies here
-- FIRST. Do not relax this by adding a permissive policy to make a query work.
--
-- No-op on the PGLite dev fallback, where the app is always the table owner.

alter table app_user            enable row level security;
alter table business            enable row level security;
alter table business_member     enable row level security;
alter table business_service    enable row level security;
alter table knowledge_item      enable row level security;
alter table integration         enable row level security;
alter table action_policy       enable row level security;
alter table learning_suggestion enable row level security;
alter table enquiry             enable row level security;
alter table enquiry_fact        enable row level security;
alter table message             enable row level security;
alter table quote_version       enable row level security;
alter table booking             enable row level security;
alter table audit_event         enable row level security;

-- Marketing tables are written by server functions only; no public read
-- endpoint exists for any of them (see 0002/0003 header comments).
alter table waitlist            enable row level security;
alter table roadmap_interest    enable row level security;
alter table launch_events       enable row level security;
alter table roadmap_feedback    enable row level security;
