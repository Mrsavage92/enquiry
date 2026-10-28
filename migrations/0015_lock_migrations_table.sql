-- The migration ledger was the one Enquiry table with RLS off, so the public
-- anon key could read it and, through Supabase's default grants, write to it
-- (go-live review 2026-10-07). The migrate script runs as the table owner,
-- which RLS does not restrict. Applied to production by hand on 2026-10-07.
--
-- Guarded: the ledger only exists when scripts/migrate.mjs created it, and the
-- anon/authenticated roles only exist on Supabase, not on the PGlite fallback.
do $$
begin
  if to_regclass('public._migrations') is not null then
    execute 'alter table public._migrations enable row level security';
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'revoke all on public._migrations from anon';
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute 'revoke all on public._migrations from authenticated';
    end if;
  end if;
end $$;
