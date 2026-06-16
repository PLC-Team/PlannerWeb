-- ============================================================================
-- CHECK SHEET POINTS TABLE
-- ============================================================================

create table public.check_sheet_points (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  parent_id uuid references public.check_sheet_points(id) on delete cascade,
  title text not null,
  status text default 'pending' check (status in ('pending', 'completed', 'not_applicable')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Index for faster parent-child querying
create index idx_check_sheet_points_project_id on public.check_sheet_points(project_id);
create index idx_check_sheet_points_parent_id on public.check_sheet_points(parent_id);

-- Enable RLS
alter table public.check_sheet_points enable row level security;

-- Policies
create policy "Users can read check sheet points"
  on public.check_sheet_points for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

create policy "Users can insert check sheet points"
  on public.check_sheet_points for insert to authenticated with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

create policy "Users can update check sheet points"
  on public.check_sheet_points for update to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

create policy "Users can delete check sheet points"
  on public.check_sheet_points for delete to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );
