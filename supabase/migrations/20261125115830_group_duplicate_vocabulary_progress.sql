-- Group repeated headwords with the same part of speech under one progress key.
-- Distinct parts of speech remain separate (for example deutsch vs Deutsch).
alter table public.vocabulary add column if not exists progress_key text;

update public.vocabulary
set progress_key = record_code
where progress_key is null or btrim(progress_key) = '';

with duplicate_groups as (
  select
    lower(btrim(word)) as normalized_word,
    lower(btrim(word_type)) as normalized_type,
    min(record_code) as canonical_progress_key
  from public.vocabulary
  group by lower(btrim(word)), lower(btrim(word_type))
  having count(*) > 1
)
update public.vocabulary as vocabulary
set progress_key = duplicate_groups.canonical_progress_key
from duplicate_groups
where lower(btrim(vocabulary.word)) = duplicate_groups.normalized_word
  and lower(btrim(vocabulary.word_type)) = duplicate_groups.normalized_type;

alter table public.vocabulary alter column progress_key set not null;
do $
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vocabulary_progress_key_nonempty'
      and conrelid = 'public.vocabulary'::regclass
  ) then
    alter table public.vocabulary
      add constraint vocabulary_progress_key_nonempty
      check (btrim(progress_key) <> '') not valid;
  end if;
end
$;
alter table public.vocabulary validate constraint vocabulary_progress_key_nonempty;

create index if not exists vocabulary_progress_key_idx
  on public.vocabulary (progress_key);
