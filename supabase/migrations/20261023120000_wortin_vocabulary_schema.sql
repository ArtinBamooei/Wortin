-- Wortin vocabulary schema
-- Safe to rerun against the current Wortin project.
create table if not exists public.vocabulary (
  id bigint generated always as identity primary key,
  source_number integer unique,
  word text not null,
  word_type text,
  meaning_fa text,
  example_de text,
  pdf_page integer,
  created_at timestamptz not null default now()
);

alter table public.vocabulary
  add column if not exists record_code text,
  add column if not exists record_section text not null default 'A',
  add column if not exists examples_de jsonb not null default '[]'::jsonb,
  add column if not exists extra_examples_de jsonb not null default '[]'::jsonb,
  add column if not exists case_info text,
  add column if not exists preposition text,
  add column if not exists thematic_group text,
  add column if not exists equivalent text;

create unique index if not exists vocabulary_record_code_key
  on public.vocabulary (record_code);
create index if not exists vocabulary_word_lower_idx
  on public.vocabulary (lower(word));
create index if not exists vocabulary_section_idx
  on public.vocabulary (record_section);
create index if not exists vocabulary_group_idx
  on public.vocabulary (thematic_group);

alter table public.vocabulary enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vocabulary'
      and policyname = 'Public read vocabulary'
  ) then
    create policy "Public read vocabulary"
      on public.vocabulary
      for select to anon, authenticated
      using (true);
  end if;
end
$$;

grant select on table public.vocabulary to anon, authenticated;
