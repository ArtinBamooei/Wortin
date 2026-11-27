-- Versioned public vocabulary snapshot metadata.
create table if not exists public.vocabulary_manifest (singleton boolean primary key default true check (singleton is true),version bigint not null default 1 check (version > 0),row_count bigint not null default 0 check (row_count >= 0),updated_at timestamptz not null default clock_timestamp());
insert into public.vocabulary_manifest(singleton,version,row_count,updated_at) select true,1,count(*),clock_timestamp() from public.vocabulary on conflict(singleton) do nothing;
alter table public.vocabulary_manifest enable row level security;
drop policy if exists "Public read vocabulary manifest" on public.vocabulary_manifest;
create policy "Public read vocabulary manifest" on public.vocabulary_manifest for select to anon,authenticated using (singleton is true);
revoke insert,update,delete,truncate on public.vocabulary_manifest from anon,authenticated;
grant select on public.vocabulary_manifest to anon,authenticated;
create or replace function public.bump_vocabulary_manifest() returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin update public.vocabulary_manifest set version=version+1,row_count=(select count(*) from public.vocabulary),updated_at=clock_timestamp() where singleton is true; return null; end; $$;
revoke all on function public.bump_vocabulary_manifest() from public,anon,authenticated;
drop trigger if exists vocabulary_manifest_after_change on public.vocabulary;
create trigger vocabulary_manifest_after_change after insert or update or delete or truncate on public.vocabulary for each statement execute function public.bump_vocabulary_manifest();
