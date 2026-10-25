-- Wortin user progress security baseline.
-- Reproducible schema for new environments; current production data is not modified.
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{"days": {}, "words": {}, "sessions": 0, "quizTotal": 0, "lastActive": null, "quizCorrect": 0, "reviewCount": 0}'::jsonb,
  daily jsonb not null default '{"days": {}, "mode": "learn", "cursor": 0, "studied": [], "reviewIndex": 0, "reviewQueue": [], "reviewAnswers": [], "reviewCorrect": 0, "lastCheckpoint": 0}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;
alter table public.user_progress force row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_progress' and policyname='Users read own progress') then
    create policy "Users read own progress" on public.user_progress
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_progress' and policyname='Users insert own progress') then
    create policy "Users insert own progress" on public.user_progress
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_progress' and policyname='Users update own progress') then
    create policy "Users update own progress" on public.user_progress
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

revoke all on table public.user_progress from anon, public;
grant select, insert, update on table public.user_progress to authenticated;
