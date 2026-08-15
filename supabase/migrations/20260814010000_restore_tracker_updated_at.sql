create or replace function public.set_tracker_data_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  if new.updated_at <= old.updated_at then
    new.updated_at := old.updated_at + interval '1 microsecond';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_set_tracker_data_updated_at on public.tracker_data;

-- PostgreSQL runs triggers with the same timing/event alphabetically. The
-- existing preserve_versioned_tracker_payload trigger therefore validates the
-- payload first; this trigger then assigns a fresh database version to every
-- successful UPDATE without changing the payload itself.
create trigger zz_set_tracker_data_updated_at
before update on public.tracker_data
for each row
execute function public.set_tracker_data_updated_at();
