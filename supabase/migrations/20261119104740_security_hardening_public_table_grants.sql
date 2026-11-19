-- Explicit least-privilege grants for exposed Wortin tables.
-- RLS policies remain the row-level authorization boundary.
revoke all privileges on table public.vocabulary from anon, authenticated, public;
grant select on table public.vocabulary to anon, authenticated;

revoke all privileges on table public.user_progress from anon, authenticated, public;
grant select, insert, update on table public.user_progress to authenticated;
