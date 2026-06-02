-- Update RLS Policy to allow Team Members to update project stages
drop policy if exists "TLs and Managers can update project stages" on public.project_stages;
drop policy if exists "TLs, Managers, and TMs can update project stages" on public.project_stages;

create policy "TLs, Managers, and TMs can update project stages"
  on public.project_stages for update to authenticated using (
    public.current_user_role(auth.uid()) in ('admin', 'manager') or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.assigned_team_leader_id = auth.uid() or exists (
        select 1 from public.project_members pm where pm.project_id = p.id and pm.team_member_id = auth.uid()
      ))
    )
  );
