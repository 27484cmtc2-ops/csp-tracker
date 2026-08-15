-- Run only after the timestamp migration has been applied to a test/branch
-- database. Everything below uses a temporary table and is rolled back.
begin;

create temporary table tracker_data_sync_verification (
  id uuid primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null
) on commit drop;

insert into tracker_data_sync_verification (id, user_id, data, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '{"trades":[],"target":500,"dividends":[{"id":"safe-test"}],"payloadVersion":2}',
  clock_timestamp() - interval '1 second'
);

create trigger preserve_versioned_tracker_payload
before update of data on tracker_data_sync_verification
for each row
execute function public.preserve_versioned_tracker_payload();

create trigger zz_set_tracker_data_updated_at
before update on tracker_data_sync_verification
for each row
execute function public.set_tracker_data_updated_at();

do $$
declare
  test_id constant uuid := '00000000-0000-0000-0000-000000000001';
  original_data jsonb;
  original_version timestamptz;
  previous_version timestamptz;
  current_version timestamptz;
  current_data jsonb;
  affected integer;
  trigger_names text[];
  counter integer;
begin
  select data, updated_at into original_data, original_version
  from tracker_data_sync_verification where id = test_id;

  if original_data <> '{"trades":[],"target":500,"dividends":[{"id":"safe-test"}],"payloadVersion":2}'::jsonb then
    raise exception 'installing triggers altered the existing row payload';
  end if;

  select array_agg(tgname order by tgname) into trigger_names
  from pg_trigger
  where tgrelid = 'tracker_data_sync_verification'::regclass and not tgisinternal;

  if trigger_names <> array['preserve_versioned_tracker_payload', 'zz_set_tracker_data_updated_at'] then
    raise exception 'trigger execution order is unsafe: %', trigger_names;
  end if;

  update tracker_data_sync_verification
  set data = jsonb_set(data, '{target}', '501'::jsonb)
  where id = test_id and updated_at = original_version
  returning updated_at into current_version;

  if current_version is null or current_version <= original_version then
    raise exception 'first successful update did not advance updated_at';
  end if;

  previous_version := current_version;
  update tracker_data_sync_verification
  set data = jsonb_set(data, '{target}', '502'::jsonb)
  where id = test_id and updated_at = previous_version
  returning updated_at into current_version;

  if current_version is null or current_version <= previous_version then
    raise exception 'second successful update did not receive a distinct updated_at';
  end if;

  for counter in 1..25 loop
    previous_version := current_version;
    update tracker_data_sync_verification
    set data = jsonb_set(data, '{target}', to_jsonb(502 + counter))
    where id = test_id and updated_at = previous_version
    returning updated_at into current_version;

    if current_version is null or current_version <= previous_version then
      raise exception 'rapid consecutive update did not advance updated_at at iteration %', counter;
    end if;
  end loop;

  previous_version := current_version;
  select data into current_data from tracker_data_sync_verification where id = test_id;

  update tracker_data_sync_verification
  set data = jsonb_set(data, '{target}', '999'::jsonb)
  where id = test_id and updated_at = original_version;
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'failed optimistic-concurrency update modified the row';
  end if;

  if exists (
    select 1 from tracker_data_sync_verification
    where id = test_id and (updated_at <> previous_version or data <> current_data)
  ) then
    raise exception 'failed optimistic-concurrency update changed payload or updated_at';
  end if;

  update tracker_data_sync_verification
  set data = '{"trades":[],"target":999,"dividends":[],"payloadVersion":1}'::jsonb
  where id = test_id and updated_at = previous_version
  returning updated_at, data into current_version, current_data;

  if (current_data->>'payloadVersion')::integer <> 2
     or jsonb_array_length(current_data->'dividends') <> 1 then
    raise exception 'payload-version protection did not preserve the newer payload';
  end if;

  if current_version <= previous_version then
    raise exception 'protected successful update did not advance updated_at';
  end if;

  previous_version := current_version;
  update tracker_data_sync_verification
  set data = '{"trades":[{"id":"v2-valid"}],"target":600,"dividends":[],"payloadVersion":2}'::jsonb
  where id = test_id and updated_at = previous_version
  returning updated_at, data into current_version, current_data;

  if current_version <= previous_version or current_data->>'target' <> '600'
     or jsonb_array_length(current_data->'dividends') <> 0 then
    raise exception 'valid payloadVersion 2 update did not work';
  end if;

  previous_version := current_version;
  update tracker_data_sync_verification
  set data = '{"trades":[],"target":700,"dividends":[],"payloadVersion":3}'::jsonb
  where id = test_id and updated_at = previous_version
  returning updated_at, data into current_version, current_data;

  if current_version <= previous_version or (current_data->>'payloadVersion')::integer <> 3 then
    raise exception 'newer payloadVersion update did not work';
  end if;

  previous_version := current_version;
  update tracker_data_sync_verification
  set updated_at = '2000-01-01 00:00:00+00'
  where id = test_id and updated_at = previous_version
  returning updated_at into current_version;

  if current_version <= previous_version or current_version = '2000-01-01 00:00:00+00'::timestamptz then
    raise exception 'client-supplied updated_at was not replaced by a database-generated value';
  end if;
end;
$$;

rollback;
