-- ============================================================================
-- ADD DAILY WORK REPORTS TABLE
-- ============================================================================

create table if not exists public.daily_work_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  report_date date not null,
  project_code text not null,
  time_in time not null,
  time_out time not null,
  supervisor_id uuid references public.users(id) on delete set null,
  work_details text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, report_date)
);

-- Enable RLS
alter table public.daily_work_reports enable row level security;

-- Users can read their own reports
create policy "Users can read own reports" 
on public.daily_work_reports 
for select 
using (auth.uid() = user_id);

-- Team Leaders can read reports assigned to their team
create policy "Team Leaders can read team reports" 
on public.daily_work_reports 
for select 
using (
  auth.uid() in (
    select team_leader_id from public.hierarchy where team_member_id = daily_work_reports.user_id
  )
);

-- Managers and Admins can read all reports
create policy "Managers and Admins can read all reports" 
on public.daily_work_reports 
for select 
using (
  (select role from public.users where id = auth.uid()) in ('admin', 'manager')
);

-- Users can insert their own reports
create policy "Users can insert own reports" 
on public.daily_work_reports 
for insert 
with check (auth.uid() = user_id);

-- Users can update their own reports
create policy "Users can update own reports" 
on public.daily_work_reports 
for update 
using (auth.uid() = user_id);
