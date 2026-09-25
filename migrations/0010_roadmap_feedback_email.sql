-- Optional contact address on volunteered roadmap feedback, so a follow-up
-- question can reach the person who wrote it. Never required: most feedback
-- stays anonymous beyond the session id it already carries.

alter table roadmap_feedback add column if not exists email text;
