-- Practice enquiries and an undo that really undoes (attention plan C10, C12).
--
-- A new owner can try Enquiry on a practice enquiry before a real customer
-- arrives. It lives beside their real enquiries so it goes through the same
-- desk, but it is marked, it never counts in any figure, the server refuses to
-- prepare or record a send from it, and deleting it removes it and everything
-- hanging off it.
--
-- Recording a send moves the enquiry to "waiting on the customer" and may set
-- its quoted value. `prior_state` keeps what the enquiry looked like the moment
-- before, on the reviewed artefact that was confirmed, so "Undo" puts back
-- exactly that rather than guessing.
--
-- Both are columns on tables that already have RLS enabled, so no policy
-- changes. A new column inherits its table's grants. Production apply (owner
-- role): the table grants below were not re-checked against production for
-- this change; confirm they are in place, because undo is the first path that
-- deletes from message and quote_version:
--   grant select, insert, update, delete on enquiry to enquiry_app;
--   grant select, insert, update, delete on message to enquiry_app;
--   grant select, insert, update, delete on quote_version to enquiry_app;
--   grant select, insert, update on reviewed_send to enquiry_app;

alter table enquiry add column if not exists practice boolean not null default false;
-- One practice enquiry per business, whatever a double click does.
create unique index if not exists enquiry_one_practice_idx on enquiry (business_id) where practice;

alter table reviewed_send add column if not exists prior_state jsonb;
