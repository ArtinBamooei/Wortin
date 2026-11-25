-- Validate bounded JSON shape constraints after confirming existing rows comply.
alter table public.user_progress validate constraint user_progress_progress_shape_check;
alter table public.user_progress validate constraint user_progress_daily_shape_check;
