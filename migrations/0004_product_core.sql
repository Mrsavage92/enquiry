-- Product core: the operator workspace moves off localStorage and into Postgres.
--
-- Design notes
-- ------------
-- Relational spine for anything queried, appended or individually mutated
-- (enquiries, facts, messages, quotes, bookings, knowledge). JSONB only for
-- values that are DERIVED and rewritten wholesale by the domain layer - the
-- decision snapshot is recomputed from facts + business rules on every
-- re-evaluation, so normalising it would mean deleting and reinserting a dozen
-- rows per recompute for no query benefit. DecisionTrace already carries
-- engineVersion + snapshotAt, so the type was designed for this.
--
-- Identity is a plain text id, NOT a foreign key into auth.users, so the same
-- migration applies to the PGLite dev fallback (which has no auth schema) and
-- to Supabase. At runtime the id is the Supabase auth uid.
--
-- Money is integer minor units + an ISO currency code. Never float. Currency is
-- per-business, not hardcoded - this is not a single-market product.

create table if not exists app_user (
  id text primary key,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null default '',
  industry_brain text not null default '',
  city text not null default '',
  timezone text not null default 'UTC',
  currency text not null default 'AUD',
  solo_or_team text not null default 'solo' check (solo_or_team in ('solo','team')),
  base_location text not null default '',
  owner_name text not null default '',
  owner_first_name text not null default '',
  website text,
  trust_mode text not null default 'Observe'
    check (trust_mode in ('Private','Observe','Assist','Autopilot')),
  paused boolean not null default false,
  pause_level text not null default 'none' check (pause_level in ('none','outbound','all')),
  -- VoiceProfile: one cohesive document, always read and written whole.
  voice jsonb not null default '{}'::jsonb,
  -- requiredFactLabels: Record<string, string[]>
  required_fact_labels jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership is the tenancy boundary. Every product query scopes through this.
create table if not exists business_member (
  business_id uuid not null references business(id) on delete cascade,
  user_id text not null references app_user(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_member_user_idx on business_member (user_id);

create table if not exists business_service (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  name text not null,
  customer_label text not null default '',
  category text not null default '',
  duration_minutes integer,
  location_modes text[] not null default '{}',
  state text not null default 'Active',
  created_at timestamptz not null default now()
);
create index if not exists business_service_business_idx on business_service (business_id);

create table if not exists knowledge_item (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  section text not null check (section in
    ('service','pricing','required_fact','operating','policy','capacity','alias')),
  title text not null,
  body text not null default '',
  class text not null check (class in
    ('authoritative','operational','interpretive','customer_specific')),
  state text not null default 'Proposed' check (state in
    ('Proposed','Confirmed','Active','Needs review','Superseded','Disabled')),
  source jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  version text not null default '1',
  stale boolean not null default false,
  conflict_with uuid references knowledge_item(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists knowledge_item_business_idx on knowledge_item (business_id);
create index if not exists knowledge_item_state_idx on knowledge_item (business_id, state);

create table if not exists integration (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  provider text not null,
  kind text not null check (kind in
    ('email','calendar','booking','payments','sms','social','form')),
  status text not null default 'not_connected' check (status in
    ('connected','disconnected','error','not_connected')),
  technical_scopes text[] not null default '{}',
  enquiry_usage text[] not null default '{}',
  last_success_at timestamptz,
  account_label text,
  -- Credentials NEVER live in this table. Server-only secret storage, keyed by id.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists integration_business_idx on integration (business_id);

-- Autonomy is earned per action class. This table is the authority on what the
-- system may do without asking - never a single global AI switch.
create table if not exists action_policy (
  business_id uuid not null references business(id) on delete cascade,
  action text not null,
  label text not null default '',
  mode text not null default 'Ask every time'
    check (mode in ('Never','Ask every time','Automatic when safe')),
  risk text not null default 'MEDIUM'
    check (risk in ('LOW','MEDIUM','HIGH','PROHIBITED_AUTO')),
  evidence jsonb not null default '{}'::jsonb,
  gates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (business_id, action)
);

create table if not exists learning_suggestion (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  title text not null,
  proposal text not null default '',
  class text not null check (class in
    ('authoritative','operational','interpretive','customer_specific')),
  examples text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  high_impact boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists learning_suggestion_business_idx
  on learning_suggestion (business_id, status);

-- The Enquiry Decision Object. Composite state is four independent axes, so it
-- is four columns rather than one status enum - a booked enquiry can still be
-- waiting on the customer commercially.
create table if not exists enquiry (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text,
  customer_handle text,
  source text not null check (source in
    ('email','form','forward','manual','sms','instagram','facebook','comment')),
  comment_on text check (comment_on in ('instagram','facebook')),
  service_label text not null default '',
  event_label text,
  date_label text,
  location_label text,
  urgency_label text,
  lifecycle text not null default 'OPEN'
    check (lifecycle in ('OPEN','BOOKED','DECLINED','LOST','CANCELLED')),
  decision_state text not null default 'EVALUATING' check (decision_state in
    ('EVALUATING','NEEDS_INFORMATION','NEEDS_HUMAN','ACTION_READY',
     'WAITING_ON_CLIENT','BOOKING_PENDING','NONE')),
  commercial_state text not null default 'UNASSESSED' check (commercial_state in
    ('UNASSESSED','ESTIMATED','QUOTABLE','QUOTED','ACCEPTED')),
  responsibility text not null default 'SYSTEM' check (responsibility in
    ('SYSTEM','BUSINESS','CUSTOMER','EXTERNAL_SYSTEM','NONE')),
  value_exact_minor bigint,
  value_range_min_minor bigint,
  value_range_max_minor bigint,
  currency text not null default 'AUD',
  -- Derived. Recomputed wholesale by the domain layer; never hand-edited.
  decision_snapshot jsonb not null default '{}'::jsonb,
  engine_version text not null default '0',
  snapshot_at timestamptz,
  duplicate_of uuid references enquiry(id) on delete set null,
  at_risk boolean not null default false,
  follow_up_due boolean not null default false,
  follow_up_reason text,
  snoozed_until timestamptz,
  teach_prompt text,
  notes text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enquiry_business_idx on enquiry (business_id, updated_at desc);
-- The queue is attention-first, so the hot path is "what needs me, in this business".
create index if not exists enquiry_attention_idx
  on enquiry (business_id, decision_state, lifecycle);
create index if not exists enquiry_followup_idx
  on enquiry (business_id, follow_up_due) where follow_up_due;

create table if not exists enquiry_fact (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiry(id) on delete cascade,
  field text not null,
  label text not null default '',
  value text not null default '',
  display_value text not null default '',
  status text not null default 'unknown' check (status in
    ('confirmed','inferred','check_this','unknown','conflict','range')),
  confidence text not null default 'Medium' check (confidence in ('High','Medium','Low')),
  asserted_by text not null default 'system' check (asserted_by in ('customer','user','system')),
  provenance jsonb not null default '{}'::jsonb,
  required_for text[] not null default '{}',
  -- blocking = this fact actually changes the next decision. Not "the field is empty".
  blocking boolean not null default false,
  teachable boolean not null default false,
  customer_specific boolean not null default false,
  superseded boolean not null default false,
  alternatives text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enquiry_fact_enquiry_idx on enquiry_fact (enquiry_id);
-- One live value per field; corrections supersede rather than overwrite, so the
-- provenance chain survives.
create unique index if not exists enquiry_fact_field_uq
  on enquiry_fact (enquiry_id, field) where not superseded;

create table if not exists message (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiry(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null check (channel in
    ('email','form','forward','manual','sms','instagram','facebook','comment')),
  at timestamptz not null default now(),
  from_addr text not null default '',
  to_addr text not null default '',
  subject text,
  body text not null default '',
  quoted boolean not null default false,
  quote_id uuid,
  form_fields jsonb,
  comment_context text,
  -- Provider message id. Makes inbound webhook delivery idempotent under retry.
  external_id text,
  created_at timestamptz not null default now()
);
create index if not exists message_enquiry_idx on message (enquiry_id, at);
create unique index if not exists message_external_uq
  on message (channel, external_id) where external_id is not null;

create table if not exists quote_version (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiry(id) on delete cascade,
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft','sent','superseded','accepted')),
  sent_at timestamptz,
  total_minor bigint,
  range_min_minor bigint,
  range_max_minor bigint,
  currency text not null default 'AUD',
  line_items jsonb not null default '[]'::jsonb,
  assumptions text[] not null default '{}',
  rule_set_version text not null default '1',
  hold_minor bigint,
  hold_label text,
  created_at timestamptz not null default now(),
  unique (enquiry_id, version)
);
create index if not exists quote_version_enquiry_idx on quote_version (enquiry_id, version desc);

create table if not exists booking (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  enquiry_id uuid references enquiry(id) on delete set null,
  customer_name text not null default '',
  service_label text not null default '',
  starts_at timestamptz not null,
  duration_minutes integer,
  location text,
  travel_minutes integer,
  value_minor bigint,
  currency text not null default 'AUD',
  status text not null default 'pending'
    check (status in ('pending','confirmed','external_pending','cancelled')),
  handoff text,
  deposit_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_business_idx on booking (business_id, starts_at);
create index if not exists booking_enquiry_idx on booking (enquiry_id);

-- Append-only. Every autonomous or assisted action lands here so the business can
-- always answer "why did it do that, and was it allowed to".
create table if not exists audit_event (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null default 'system',
  summary text not null,
  detail text,
  object_type text not null check (object_type in
    ('enquiry','trust','brain','integration','booking')),
  object_id uuid
);
create index if not exists audit_event_business_idx on audit_event (business_id, at desc);
create index if not exists audit_event_object_idx on audit_event (object_type, object_id);
