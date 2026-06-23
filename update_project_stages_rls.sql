-- ============================================================================
-- UPDATE PROJECT STAGES RLS TO ALLOW TEAM MEMBERS TO ADD LINES
-- Run this script in the Supabase SQL Editor
-- ============================================================================

DROP POLICY IF EXISTS "System/Managers can insert project stages" ON public.project_stages;
CREATE POLICY "System/Managers can insert project stages"
  ON public.project_stages FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_stages.project_id AND pm.team_member_id = auth.uid()
    )
  );
