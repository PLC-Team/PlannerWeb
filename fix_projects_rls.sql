-- ============================================================
-- SQL MIGRATION: FIX PROJECTS RLS SCOPING BUG
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- Drop the existing projects SELECT policy
DROP POLICY IF EXISTS "Users can read relevant projects" ON public.projects;

-- Recreate the policy with qualified projects.id referencing the outer table
CREATE POLICY "Users can read relevant projects"
  ON public.projects FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) = 'admin' or
    created_by = auth.uid() or
    assigned_team_leader_id = auth.uid() or
    exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.team_member_id = auth.uid()
    )
  );
