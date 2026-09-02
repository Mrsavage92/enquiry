-- The first-beta loop: a business states its prices, a real enquiry arrives,
-- Enquiry computes a decision from those prices, the owner sends, and the send
-- is recorded as a fact.
--
-- Three gaps this closes.
--
-- 1. Human-readable knowledge cannot be transacted against. knowledge_item held
--    a title and a body - enough to show an operator, useless to an evaluator.
--    A price of "$145 per person, minimum 3" is a sentence, not a number. The
--    typed payload is the machine-usable half, and it only becomes authoritative
--    through the same confirmation model as the readable half.
--
-- 2. There was no way to record that a reply was actually sent. The prototype
--    pushed a fake outbound message into a client array and called the quote
--    sent, which is indistinguishable - to the operator - from having sent it.
--    Enquiry does not send anything in first beta: the owner does, by hand, and
--    then confirms. That confirmation is a real row.
--
-- 3. Nothing recorded where an enquiry came from when it was typed or pasted in
--    rather than arriving over a channel.

-- A small, typed, machine-usable rule payload attached to confirmed knowledge.
-- Deliberately narrow: this is not a workflow builder. Shape is validated in
-- src/domain/business-rule.ts, which is the authority on what a payload may be.
alter table knowledge_item
  add column if not exists rule_payload jsonb;

-- Which enquiries a rule actually applies to is a product question, not a
-- schema one, so the payload carries it. This index only makes "find the rules
-- that could price this" cheap.
create index if not exists knowledge_item_rule_idx
  on knowledge_item (business_id, state)
  where rule_payload is not null;

-- Real send recording. Enquiry prepares; a human sends and confirms.
alter table message
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by text,
  -- How this message reached the system, when it did not arrive over a channel:
  -- 'manual' (typed/pasted by the owner) or 'channel'.
  add column if not exists intake text not null default 'channel'
    check (intake in ('channel', 'manual'));

-- An outbound message is only "sent" once a human says so.
create index if not exists message_sent_idx on message (enquiry_id, sent_at)
  where sent_at is not null;

-- Where a manually-entered enquiry came from, in the owner's words. Free text
-- because a real answer is "she rang and I typed it up", not an enum.
alter table enquiry
  add column if not exists intake_note text;
