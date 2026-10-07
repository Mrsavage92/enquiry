-- The app's own prepared reply, frozen on the reviewed artefact (trust pass 12).
--
-- "Check this before you send" lists only what the owner added to the app's
-- prepared reply. When an owner records an older message they already sent
-- (a stale attestation), the decision has since moved and the current
-- prepared reply is a different text, so the list was worked out against the
-- wrong reply. Keeping the prepared reply the text was reviewed against lets
-- the server work the list out again against exactly that reply.
--
-- A new column on a table that already has RLS enabled: no policy changes,
-- and it inherits the table's grants. Production apply (owner role) needs
-- nothing new; confirm this grant is in place:
--   grant select, insert, update on reviewed_send to enquiry_app;

alter table reviewed_send add column if not exists draft_body text;
