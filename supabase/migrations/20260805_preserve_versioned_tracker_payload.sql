create or replace function public.preserve_versioned_tracker_payload()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous_version integer := coalesce((old.data ->> 'payloadVersion')::integer, 1);
  incoming_version integer := coalesce((new.data ->> 'payloadVersion')::integer, 1);
begin
  if previous_version > incoming_version then
    new.data := old.data;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_versioned_tracker_payload on public.tracker_data;

create trigger preserve_versioned_tracker_payload
before update of data on public.tracker_data
for each row
execute function public.preserve_versioned_tracker_payload();
