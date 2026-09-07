-- CC1: commercial correctness and truthful action recording.
--
-- Two gaps this closes, both about the same thing: what the owner reviewed and
-- what Enquiry recorded were allowed to be different documents.
--
-- 1. Copying a draft recorded it as sent. `Intelligence.commitSend` put the text
--    on the clipboard, swallowed any clipboard failure, and called `recordSent`
--    regardless - which wrote an outbound message with a real `sent_at`, moved
--    responsibility to the customer and, for a quote, created a `sent` quote
--    version. Copying without sending, or failing to copy at all, told the
--    business it had already replied. Copying is not sending, and only the
--    owner can say a send happened.
--
-- 2. The reviewed message and the recorded quote could disagree. The server
--    stored the submitted body but took the structured amount from whatever the
--    decision snapshot said at the moment of recording - so an owner who edited
--    "AUD 580" to "AUD 500" in the text could produce a message saying 500
--    beside a quote row saying 580, and an approval prepared against an older
--    decision could be paired with a newer amount entirely.
--
-- A reviewed send is therefore a first-class, server-created record: it freezes
-- the exact text, amount, service, channel, recipient and decision revision the
-- owner actually reviewed. Confirming a send consumes one of these rows and
-- records EXACTLY what it froze. Nothing is recorded from a client-supplied
-- amount, and nothing is recorded from a snapshot re-read after the review.

-- A monotonic revision for an enquiry's decision.
--
-- Every writer of `decision_snapshot` bumps it, so a preview can name the exact
-- decision it was prepared against and the server can tell a current approval
-- from one prepared before the facts changed underneath it.
alter table enquiry
  add column if not exists decision_revision bigint not null default 0;

create table if not exists reviewed_send (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiry(id) on delete cascade,
  business_id uuid not null references business(id) on delete cascade,
  -- Who reviewed it. Not who sent it: Enquiry does not send.
  reviewed_by text not null,
  -- The enquiry.decision_revision this was prepared against.
  decision_revision bigint not null,
  action text not null,
  channel text not null,
  -- Derived server-side from the enquiry's own contact fields, never accepted
  -- from the client. '' means genuinely no recipient on file.
  recipient text not null default '',
  body text not null,
  -- Normalised body, so the same reviewed text always resolves to the same row
  -- and a retry after a lost response cannot create a second send.
  body_hash text not null,
  -- The structured commercial content, frozen. A quote recorded from this row
  -- can never disagree with the text above it.
  price_kind text check (price_kind in ('EXACT', 'RANGE')),
  amount_minor bigint,
  range_min_minor bigint,
  range_max_minor bigint,
  currency text,
  service_label text not null default '',
  reason text not null default '',
  evaluators jsonb,
  engine_version text not null default '0',
  created_at timestamptz not null default now(),
  -- Set when an owner confirms the external send this artefact describes.
  consumed_at timestamptz,
  consumed_message_id uuid references message(id) on delete set null,
  -- True when the owner attested to having already sent an artefact whose
  -- decision revision has since moved on. The send is real and is recorded as
  -- written; the newer decision is deliberately NOT advanced by it.
  stale_attested boolean not null default false
);

-- The idempotency key: one reviewed artefact per (enquiry, exact text).
--
-- Deliberately NOT keyed on decision_revision as well. Recording a send bumps
-- the revision, so a key including it would let the recovery case - owner
-- confirms, the response is lost, they refresh and confirm again - create a
-- second artefact at the new revision and record the same message twice, which
-- is the exact failure this is here to prevent. Keyed on the text alone, that
-- retry resolves to the artefact that was already consumed and is reported as
-- the duplicate it is.
--
-- Two genuinely different follow-ups differ in their text and get their own
-- rows. An owner who wants to send the identical text a second time changes
-- something about it, which is a low price for never recording a send twice.
create unique index if not exists reviewed_send_identity_idx
  on reviewed_send (enquiry_id, body_hash);

create index if not exists reviewed_send_enquiry_idx on reviewed_send (enquiry_id, created_at);

-- Which reviewed artefact a recorded outbound message came from, so an audit
-- can go straight from a sent message back to the exact text and amount that
-- were on screen when the owner approved it.
alter table message
  add column if not exists reviewed_send_id uuid references reviewed_send(id) on delete set null;

alter table quote_version
  add column if not exists reviewed_send_id uuid references reviewed_send(id) on delete set null;
