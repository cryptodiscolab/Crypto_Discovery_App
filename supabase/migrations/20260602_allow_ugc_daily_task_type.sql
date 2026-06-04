-- Allow UGC mission tasks created by sync-ugc-mission.
-- API inserts daily_tasks.task_type = 'ugc' for campaign-backed tasks.

alter table public.daily_tasks
  drop constraint if exists task_type_valid;

alter table public.daily_tasks
  add constraint task_type_valid
  check (task_type in ('daily', 'weekly', 'special', 'onetime', 'system', 'ugc'));

notify pgrst, 'reload schema';
