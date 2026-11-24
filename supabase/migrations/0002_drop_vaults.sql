-- =============================================================================
--  Drop the unused credentials vault table.
--
--  Only needed for databases that already ran the original 0001 migration.
--  The vault feature was removed; credentials now live in profiles.data.
--  Safe to run once in the Supabase Dashboard -> SQL Editor.
-- =============================================================================

drop table if exists public.vaults cascade;
