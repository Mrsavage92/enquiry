-- Pause and resume with nothing lost (attention plan C6, C8).
--
-- An owner gets interrupted mid-reply. What they had typed, their working
-- hours and whether they want in-app notices used to live in one browser tab's
-- session storage, so closing the tab, clearing storage or picking up the phone
-- lost all three. These rows put them on the server, per business, behind the
-- same business_member boundary as everything else (src/lib/repo/tenancy.server.ts).
--
-- Production apply (owner role) also needs:
--   grant select, insert, update, delete on reply_draft to enquiry_app;
--   grant select, insert, update, delete on workspace_prefs to enquiry_app;
-- (business_member already carries its grant; the new column inherits it.)

-- The reply the owner is part-way through editing. One per enquiry.
-- decision_revision is the enquiry's revision when the text was saved: once
-- the decision moves on (a detail answered, a send recorded) the stored text
-- was written against a different recommendation and is no longer offered
-- back, so an old edit can never resurface over a new prepared reply.
create table if not exists reply_draft (
  enquiry_id uuid primary key references enquiry(id) on delete cascade,
  business_id uuid not null references business(id) on delete cascade,
  body text not null,
  decision_revision bigint not null default 0,
  updated_by text references app_user(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists reply_draft_business_idx on reply_draft (business_id);
alter table reply_draft enable row level security;

-- Working hours and notice preferences, one document per business.
-- Validated by src/domain/workspace-prefs.ts cleanPrefs on the way in and out.
create table if not exists workspace_prefs (
  business_id uuid primary key references business(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table workspace_prefs enable row level security;

-- When this member last opened the workspace, for "since you were last here".
alter table business_member add column if not exists last_seen_at timestamptz;
