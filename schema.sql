-- ============================================================================
-- DATABASE SCHEMA SETUP FOR TEAM TASK MANAGEMENT SYSTEM (PRODUCTION)
-- Run this script in the Supabase SQL Editor
-- ============================================================================

-- Enable Crypt extension for hashing default passwords if needed
create extension if not exists pgcrypto;

-- DROP TABLES IF THEY EXIST FOR CLEAN INITIALIZATION (IN CORRECT DEPENDENCY ORDER)
drop table if exists public.task_remarks cascade;
drop table if exists public.profiles cascade;
drop table if exists public.notifications cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.issues cascade;
drop table if exists public.achievements cascade;
drop table if exists public.task_comments cascade;
drop table if exists public.tasks cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.hierarchy cascade;
drop table if exists public.users cascade;


-- 1. USERS TABLE (Extends Supabase Auth users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  employee_id text,
  name text not null,
  email text unique not null,
  role text check (role in ('admin','hod','manager','team_leader','team_member')),
  designation text,
  created_at timestamptz default now()
);

-- Enable RLS on users
alter table public.users enable row level security;

-- 2. HIERARCHY TABLE (Maps Manager -> TL -> TM)
create table public.hierarchy (
  id uuid default gen_random_uuid() primary key,
  manager_id uuid references public.users(id) on delete cascade,
  team_leader_id uuid references public.users(id) on delete cascade,
  team_member_id uuid references public.users(id) on delete cascade, -- nullable (TL-Manager mapping only)
  created_at timestamptz default now()
);

alter table public.hierarchy enable row level security;

-- 3. PROJECTS TABLE
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  project_code text unique not null,
  project_name text not null,
  customer_name text not null,
  description text,
  assigned_team_leader_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null, -- Manager who registered it
  status text default 'active' check (status in ('active','on_hold','completed','cancelled')),
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

-- 4. PROJECT MEMBERS TABLE (Many-to-many project to team members, assigned by TL)
create table public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  team_member_id uuid references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null, -- Team Leader
  assigned_at timestamptz default now(),
  unique (project_id, team_member_id)
);

alter table public.project_members enable row level security;

-- 5. TASKS TABLE
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  project_code text,
  project_name text,
  title text not null,
  description text,
  assigned_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  assigned_by_role text check (assigned_by_role in ('manager','team_leader')),
  priority text check (priority in ('low','medium','high','critical')),
  start_date date,
  target_date date,
  status text default 'pending' check (status in (
    'pending','assigned','in_progress',
    'completed_by_member','approved_by_tl',
    'approved_by_manager','rejected','rework_required','closed'
  )),
  progress_percent integer default 0 check (progress_percent between 0 and 100),
  remarks text,
  attachment_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

-- 6. TASK COMMENTS TABLE
create table public.task_comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.users(id) on delete cascade not null,
  comment text not null,
  created_at timestamptz default now()
);

alter table public.task_comments enable row level security;

-- 7. ACHIEVEMENTS TABLE (Manager approval required)
create table public.achievements (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  project_code text,
  title text not null,
  details text not null,
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz default now(),
  attachment_url text,
  approval_status text default 'pending' check (approval_status in ('pending','approved','rejected')),
  manager_remarks text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz
);

alter table public.achievements enable row level security;

-- 8. ISSUES TABLE (No approval required)
create table public.issues (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  project_code text,
  title text not null,
  description text not null,
  category text check (category in ('delay','technical','resource','quality','safety','customer','other')),
  priority text check (priority in ('low','medium','high','critical')),
  raised_by uuid references public.users(id) on delete set null,
  raised_at timestamptz default now(),
  attachment_url text,
  status text default 'open' check (status in ('open','in_progress','resolved','closed')),
  resolution_remarks text,
  resolved_at timestamptz,
  -- New issue logging & lesson-learned fields
  reported_by_name text,
  plant text,
  line text,
  station text,
  occurrence_date date,
  responsible_person_id uuid references public.users(id) on delete set null,
  occurrence_condition text,
  temporary_action text,
  permanent_countermeasure text
);

alter table public.issues enable row level security;

-- 9. AUDIT ACTIVITY LOGS TABLE
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.activity_logs enable row level security;

-- 10. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  related_task_id uuid references public.tasks(id) on delete set null,
  related_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;


-- ============================================================================
-- HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Fetch current user's role from users table (safer than metadata query in all contexts)
create or replace function public.current_user_role(user_id uuid)
returns text as $$
  select role from public.users where id = user_id;
$$ language sql security definer stable;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- --- USERS POLICIES ---
create policy "Users can read all user records"
  on public.users for select to authenticated using (true);

create policy "Admin can insert user records"
  on public.users for insert to authenticated with check (
    public.current_user_role(auth.uid()) = 'admin'
  );

create policy "Admin can update user records"
  on public.users for update to authenticated using (
    public.current_user_role(auth.uid()) = 'admin'
  );

create policy "Admin can delete user records"
  on public.users for delete to authenticated using (
    public.current_user_role(auth.uid()) = 'admin'
  );

-- --- HIERARCHY POLICIES ---
create policy "Users can view hierarchy"
  on public.hierarchy for select to authenticated using (true);

create policy "Admin can modify hierarchy"
  on public.hierarchy for all to authenticated using (
    public.current_user_role(auth.uid()) = 'admin'
  );

-- --- PROJECTS POLICIES ---
create policy "Users can read relevant projects"
  on public.projects for select to authenticated using (
    public.current_user_role(auth.uid()) = 'admin' or
    created_by = auth.uid() or
    assigned_team_leader_id = auth.uid() or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.team_member_id = auth.uid()
    )
  );

create policy "Managers can insert projects"
  on public.projects for insert to authenticated with check (
    public.current_user_role(auth.uid()) = 'manager'
  );

create policy "Authorized users can update projects"
  on public.projects for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    assigned_team_leader_id = auth.uid() or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.team_member_id = auth.uid()
    )
  );

create policy "Managers and Admin can delete projects"
  on public.projects for delete to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager')
  );

-- --- PROJECT MEMBERS POLICIES ---
create policy "Users can read project members"
  on public.project_members for select to authenticated using (true);

create policy "TLs and Managers can insert project members"
  on public.project_members for insert to authenticated with check (
    public.current_user_role(auth.uid()) = 'manager' or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

create policy "TLs and Managers can delete project members"
  on public.project_members for delete to authenticated using (
    public.current_user_role(auth.uid()) = 'manager' or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

-- --- TASKS POLICIES ---
create policy "Users can read tasks"
  on public.tasks for select to authenticated using (
    public.current_user_role(auth.uid()) = 'admin' or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.created_by = auth.uid() or p.assigned_team_leader_id = auth.uid())
    ) or
    assigned_to = auth.uid() or
    assigned_by = auth.uid()
  );

create policy "TLs and Managers can insert tasks"
  on public.tasks for insert to authenticated with check (
    public.current_user_role(auth.uid()) = 'manager' or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

create policy "Eligible users can update tasks"
  on public.tasks for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    ) or
    assigned_to = auth.uid()
  );

create policy "TLs and Managers can delete tasks"
  on public.tasks for delete to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

-- --- TASK COMMENTS POLICIES ---
create policy "Users can read relevant task comments"
  on public.task_comments for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and (
        public.current_user_role(auth.uid()) = 'admin' or
        t.assigned_team_leader_id = auth.uid() or
        t.assigned_team_member_id = auth.uid() or
        exists (
          select 1 from public.projects p
          where p.project_code = t.project_code and
          p.assigned_team_leader_id = auth.uid()
        )
      )
    )
  );

create policy "Users can insert task comments"
  on public.task_comments for insert to authenticated with check (
    author_id = auth.uid()
  );

-- --- ACHIEVEMENTS POLICIES ---
create policy "Users can read achievements"
  on public.achievements for select to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.assigned_team_leader_id = auth.uid() or exists (
        select 1 from public.project_members pm where pm.project_id = p.id and pm.team_member_id = auth.uid()
      ))
    )
  );

create policy "TLs and TMs can insert achievements"
  on public.achievements for insert to authenticated with check (
    public.current_user_role(auth.uid()) in ('team_leader', 'team_member') and
    submitted_by = auth.uid()
  );

create policy "Managers can update achievements status"
  on public.achievements for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager')
  );

-- --- ISSUES POLICIES ---
create policy "Users can read issues"
  on public.issues for select to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.assigned_team_leader_id = auth.uid() or exists (
        select 1 from public.project_members pm where pm.project_id = p.id and pm.team_member_id = auth.uid()
      ))
    )
  );

create policy "Project members can insert issues"
  on public.issues for insert to authenticated with check (
    public.current_user_role(auth.uid()) in ('manager', 'team_leader', 'team_member') and
    (
      exists (
        select 1 from public.projects p
        where p.id = project_id and (p.created_by = auth.uid() or p.assigned_team_leader_id = auth.uid() or exists (
          select 1 from public.project_members pm where pm.project_id = p.id and pm.team_member_id = auth.uid()
        ))
      )
    )
  );

create policy "TLs and Managers can resolve/update issues"
  on public.issues for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    ) or
    raised_by = auth.uid()
  );

-- --- AUDIT LOGS POLICIES ---
create policy "Admin and project stakeholders can view logs"
  on public.activity_logs for select to authenticated using (
    public.current_user_role(auth.uid()) = 'admin' or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.created_by = auth.uid() or p.assigned_team_leader_id = auth.uid() or exists (
        select 1 from public.project_members pm where pm.project_id = p.id and pm.team_member_id = auth.uid()
      ))
    )
  );

create policy "Authenticated users can insert activity logs"
  on public.activity_logs for insert to authenticated with check (
    user_id = auth.uid()
  );

create policy "TLs and Managers can delete activity logs"
  on public.activity_logs for delete to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

-- --- NOTIFICATIONS POLICIES ---
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated using (
    user_id = auth.uid()
  );

create policy "Users can update their own notifications (mark read)"
  on public.notifications for update to authenticated using (
    user_id = auth.uid()
  );

create policy "Users can create notifications securely"
  on public.notifications for insert to authenticated with check (
    public.current_user_role(auth.uid()) in ('admin', 'manager', 'team_leader')
    or auth.uid() = user_id
  );


-- ============================================================================
-- SUPABASE AUTOMATED AUTH TRIGGER TO SYNC USERS TO PUBLIC.USERS
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, employee_id, email, name, role, designation)
  values (
    new.id,
    new.raw_user_meta_data->>'employee_id',
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    'team_member', -- ✅ Secure fallback: role cannot be elevated via client signup
    coalesce(new.raw_user_meta_data->>'designation', 'Staff')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to execute on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- PROJECT EXECUTION STAGES MONITORING SCHEMA ADDITIONS
-- ============================================================================

-- Create project_stages table
create table public.project_stages (
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

-- Define RLS Policies
create policy "Users can read project stages"
  on public.project_stages for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

create policy "Authorized users can update project stages"
  on public.project_stages for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    ) or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_stages.project_id and pm.team_member_id = auth.uid()
    )
  );

create policy "TLs and Managers can delete project stages"
  on public.project_stages for delete to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

create policy "System/Managers can insert project stages"
  on public.project_stages for insert to authenticated with check (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.assigned_team_leader_id = auth.uid()
    )
  );

-- Automatic Seeding Trigger on Project Creation
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

create trigger on_project_created
  after insert on public.projects
  for each row execute procedure public.initialize_project_stages();
