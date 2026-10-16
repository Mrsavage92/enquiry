-- The app's own prepared reply, frozen on the reviewed artefact (trust pass 12).
--
-- "Check this before you send" lists only what the owner added to the app's
-- prepared reply. When an owner records an older message they already sent
-- (a stale attestation), the decision has since moved and the current
-- prepared reply is a different text, so the list was worked out against the
-- wrong reply. Keeping the prepared reply the text was reviewed against lets
-- the server work the list out again against exactly that reply.
--
-- RLS on reviewed_send: no earlier migration enables it (0005 predates the
-- table and 0007 has no RLS line). Production had it switched on by hand on
-- 2026-09-09; this line makes the repo match, so a re-provisioned project
-- never ships the table open to the public anon key. Enabling it again is a
-- no-op. Like every other table (0005), it has no policies: anon and
-- authenticated are denied, and the app's own role bypasses RLS.
--
-- The new column inherits the table's grants. Production apply (owner role)
-- needs nothing new; confirm this grant is in place:
--   grant select, insert, update on reviewed_send to enquiry_app;

alter table reviewed_send enable row level security;

alter table reviewed_send add column if not exists draft_body text;
