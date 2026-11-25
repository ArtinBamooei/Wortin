-- The original schema migration already creates vocabulary_record_code_key.
-- Remove the redundant second unique index to avoid duplicate write overhead.
drop index if exists public.vocabulary_record_code_uidx;
