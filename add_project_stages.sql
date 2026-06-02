-- ============================================================================
-- DATABASE SCHEMA SETUP FOR PROJECT EXECUTION STAGES MONITORING
-- ============================================================================

-- 1. Create project_stages table
create table if not exists public.project_stages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  stage_name text not null,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  remarks text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now(),
  unique(project_id, stage_name)
);

-- Enable Row Level Security (RLS)
alter table public.project_stages enable row level security;

-- 2. Define RLS Policies
drop policy if exists "Users can read project stages" on public.project_stages;
create policy "Users can read project stages"
  on public.project_stages for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

drop policy if exists "TLs and Managers can update project stages" on public.project_stages;
create policy "TLs and Managers can update project stages"
  on public.project_stages for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

drop policy if exists "System/Managers can insert project stages" on public.project_stages;
create policy "System/Managers can insert project stages"
  on public.project_stages for insert to authenticated with check (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

-- 3. Automatic Seeding Trigger on Project Creation
create or replace function public.initialize_project_stages()
returns trigger as $$
begin
  insert into public.project_stages (project_id, stage_name, status)
  values
    (new.id, 'Project Kickoff Meeting', 'pending'),
    (new.id, 'Project Data Collection', 'pending'),
    (new.id, 'Offline Development', 'pending'),
    (new.id, 'DAPs', 'pending'),
    (new.id, 'Virtual Commissioning', 'pending'),
    (new.id, 'Onsite Commissioning', 'pending'),
    (new.id, 'Data Handover', 'pending'),
    (new.id, 'Production Support', 'pending');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute procedure public.initialize_project_stages();

-- 4. Backfill Existing Projects
insert into public.project_stages (project_id, stage_name, status)
select id, stage, 'pending'
from public.projects,
(values
  ('Project Kickoff Meeting'),
  ('Project Data Collection'),
  ('Offline Development'),
  ('DAPs'),
  ('Virtual Commissioning'),
  ('Onsite Commissioning'),
  ('Data Handover'),
  ('Production Support')
) as stages(stage)
on conflict (project_id, stage_name) do nothing;
