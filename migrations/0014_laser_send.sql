-- The laser-focus send step (research doc 50 S3, doc 51 decision 1).
--
-- coverage_key: a reviewed reply that names a total before the owner tapped
-- "That's everything". Only set when the app was sure what the price covers
-- (no inferred item, no range, no high-risk action): the coverage confirmation
-- for exactly this key is written when the owner records the send, in the same
-- transaction, never earlier.
--
-- copied_at: the owner copied this exact text and has not yet said whether
-- they sent it. Copy records no send. "Not yet" clears it; a recorded send
-- consumes the row; the screen ignores marks older than 7 days.
alter table reviewed_send add column if not exists coverage_key text;
alter table reviewed_send add column if not exists copied_at timestamptz;

create index if not exists reviewed_send_copied_idx
  on reviewed_send (enquiry_id, copied_at)
  where copied_at is not null and consumed_at is null;
