-- Bound user-owned JSON payloads and keep timestamps server-authoritative.
-- Existing rows are not rewritten; NOT VALID checks protect new/updated rows immediately.
begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_progress_progress_shape_check' and conrelid = 'public.user_progress'::regclass) then
    alter table public.user_progress
      add constraint user_progress_progress_shape_check
      check (
        jsonb_typeof(progress) = 'object'
        and jsonb_typeof(coalesce(progress -> 'words', '{}'::jsonb)) = 'object'
        and jsonb_typeof(coalesce(progress -> 'days', '{}'::jsonb)) = 'object'
        and octet_length(progress::text) <= 2097152
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_progress_daily_shape_check' and conrelid = 'public.user_progress'::regclass) then
    alter table public.user_progress
      add constraint user_progress_daily_shape_check
      check (
        jsonb_typeof(daily) = 'object'
        and jsonb_typeof(coalesce(daily -> 'days', '{}'::jsonb)) = 'object'
        and jsonb_typeof(coalesce(daily -> 'studied', '[]'::jsonb)) = 'array'
        and jsonb_typeof(coalesce(daily -> 'reviewQueue', '[]'::jsonb)) = 'array'
        and jsonb_typeof(coalesce(daily -> 'reviewAnswers', '[]'::jsonb)) = 'array'
        and octet_length(daily::text) <= 524288
      ) not valid;
  end if;
end
$$;

create or replace function public.wortin_set_user_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.wortin_set_user_progress_updated_at() from public, anon, authenticated;

drop trigger if exists wortin_user_progress_updated_at on public.user_progress;
create trigger wortin_user_progress_updated_at
before insert or update on public.user_progress
for each row execute function public.wortin_set_user_progress_updated_at();

drop policy if exists "Users delete own progress" on public.user_progress;
create policy "Users delete own progress"
  on public.user_progress
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant delete on table public.user_progress to authenticated;

commit;
