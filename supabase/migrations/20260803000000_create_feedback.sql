create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  category text not null check (category in ('bug', 'feature_request', 'general_feedback')),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  app_version text not null,
  status text not null default 'open' check (status in ('open', 'planned', 'fixed', 'closed'))
);

create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_user_id_idx on public.feedback (user_id);
create index feedback_status_idx on public.feedback (status);

alter table public.feedback enable row level security;

create policy "Authenticated users can submit their own feedback"
on public.feedback
for insert
to authenticated
with check ((select auth.uid()) = user_id);
