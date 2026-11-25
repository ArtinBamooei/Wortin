-- record_code is the stable source identity used by user progress.
-- Verified against all 3,400 current records: no nulls and no duplicates.
alter table public.vocabulary alter column record_code set not null;
create unique index if not exists vocabulary_record_code_uidx on public.vocabulary (record_code);
