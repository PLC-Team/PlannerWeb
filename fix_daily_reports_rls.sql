-- Drop existing policies
drop policy if exists "Users can read own reports" on public.daily_work_reports;
drop policy if exists "Supervisors can read team reports" on public.daily_work_reports;
drop policy if exists "Managers and Admins can read all reports" on public.daily_work_reports;
drop policy if exists "Users can insert own reports" on public.daily_work_reports;
drop policy if exists "Users can update own reports" on public.daily_work_reports;

-- Recreate SELECT policies
create policy "Users can read own reports" 
on public.daily_work_reports 
for select 
using (auth.uid() = user_id);

create policy "Team Leaders can read team reports" 
on public.daily_work_reports 
for select 
using (
  auth.uid() in (
    select team_leader_id from public.hierarchy where team_member_id = daily_work_reports.user_id
  )
);

create policy "Managers and Admins can read all reports" 
on public.daily_work_reports 
for select 
using (
  (select role from public.users where id = auth.uid()) in ('admin', 'manager')
);

-- Recreate INSERT policies
create policy "Users can insert own reports" 
on public.daily_work_reports 
for insert 
with check (auth.uid() = user_id);

-- Recreate UPDATE policies
create policy "Users can update own reports" 
on public.daily_work_reports 
for update 
using (auth.uid() = user_id);
