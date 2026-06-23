-- ============================================================================
-- ROLLBACK HOD ROLE FROM DATABASE
-- Run this script in the Supabase SQL Editor
-- ============================================================================

-- 1. Revert user role constraint
-- First, demote any existing 'hod' users to 'manager' so the constraint check passes
UPDATE public.users SET role = 'manager' WHERE role = 'hod';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'team_leader', 'team_member'));

-- 2. PROJECTS POLICIES
DROP POLICY IF EXISTS "Users can read relevant projects" ON public.projects;
CREATE POLICY "Users can read relevant projects"
  ON public.projects FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    assigned_team_leader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.team_member_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can insert projects" ON public.projects;
CREATE POLICY "Managers can insert projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) = 'manager'
  );

DROP POLICY IF EXISTS "Authorized users can update projects" ON public.projects;
CREATE POLICY "Authorized users can update projects"
  ON public.projects FOR UPDATE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    assigned_team_leader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.team_member_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and Admin can delete projects" ON public.projects;
CREATE POLICY "Managers and Admin can delete projects"
  ON public.projects FOR DELETE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager')
  );

-- 3. PROJECT MEMBERS POLICIES
DROP POLICY IF EXISTS "TLs and Managers can insert project members" ON public.project_members;
CREATE POLICY "TLs and Managers can insert project members"
  ON public.project_members FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) = 'manager' OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "TLs and Managers can delete project members" ON public.project_members;
CREATE POLICY "TLs and Managers can delete project members"
  ON public.project_members FOR DELETE TO authenticated USING (
    public.current_user_role(auth.uid()) = 'manager' OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

-- 4. TASKS POLICIES
DROP POLICY IF EXISTS "Users can read tasks" ON public.tasks;
CREATE POLICY "Users can read tasks"
  ON public.tasks FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.assigned_team_leader_id = auth.uid())
    ) OR
    assigned_to = auth.uid() OR
    assigned_by = auth.uid()
  );

DROP POLICY IF EXISTS "TLs and Managers can insert tasks" ON public.tasks;
CREATE POLICY "TLs and Managers can insert tasks"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) = 'manager' OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Eligible users can update tasks" ON public.tasks;
CREATE POLICY "Eligible users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    ) OR
    assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "TLs and Managers can delete tasks" ON public.tasks;
CREATE POLICY "TLs and Managers can delete tasks"
  ON public.tasks FOR DELETE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

-- 5. TASK COMMENTS POLICIES
DROP POLICY IF EXISTS "Users can read relevant task comments" ON public.task_comments;
CREATE POLICY "Users can read relevant task comments"
  ON public.task_comments FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND (
        public.current_user_role(auth.uid()) = 'admin' OR
        t.assigned_by = auth.uid() OR
        t.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.project_code = t.project_code AND
          p.assigned_team_leader_id = auth.uid()
        )
      )
    )
  );

-- 6. ACHIEVEMENTS POLICIES
DROP POLICY IF EXISTS "Users can read achievements" ON public.achievements;
CREATE POLICY "Users can read achievements"
  ON public.achievements FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (p.assigned_team_leader_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.team_member_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "Managers can update achievements status" ON public.achievements;
CREATE POLICY "Managers can update achievements status"
  ON public.achievements FOR UPDATE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager')
  );

-- 7. ISSUES POLICIES
DROP POLICY IF EXISTS "Users can read issues" ON public.issues;
CREATE POLICY "Users can read issues"
  ON public.issues FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (p.assigned_team_leader_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.team_member_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "Project members can insert issues" ON public.issues;
CREATE POLICY "Project members can insert issues"
  ON public.issues FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) IN ('manager', 'team_leader', 'team_member') AND
    (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.assigned_team_leader_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.team_member_id = auth.uid()
        ))
      )
    )
  );

DROP POLICY IF EXISTS "TLs and Managers can resolve/update issues" ON public.issues;
CREATE POLICY "TLs and Managers can resolve/update issues"
  ON public.issues FOR UPDATE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    ) OR
    raised_by = auth.uid()
  );

-- 8. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Admin and project stakeholders can view logs" ON public.activity_logs;
CREATE POLICY "Admin and project stakeholders can view logs"
  ON public.activity_logs FOR SELECT TO authenticated USING (
    public.current_user_role(auth.uid()) = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (p.created_by = auth.uid() OR p.assigned_team_leader_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.team_member_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS "TLs and Managers can delete activity logs" ON public.activity_logs;
CREATE POLICY "TLs and Managers can delete activity logs"
  ON public.activity_logs FOR DELETE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

-- 9. NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users can create notifications securely" ON public.notifications;
CREATE POLICY "Users can create notifications securely"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) IN ('admin', 'manager', 'team_leader')
    OR auth.uid() = user_id
  );

-- 10. PROJECT STAGES POLICIES
DROP POLICY IF EXISTS "Authorized users can update project stages" ON public.project_stages;
CREATE POLICY "Authorized users can update project stages"
  ON public.project_stages FOR UPDATE TO authenticated USING (
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

DROP POLICY IF EXISTS "TLs and Managers can delete project stages" ON public.project_stages;
CREATE POLICY "TLs and Managers can delete project stages"
  ON public.project_stages FOR DELETE TO authenticated USING (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System/Managers can insert project stages" ON public.project_stages;
CREATE POLICY "System/Managers can insert project stages"
  ON public.project_stages FOR INSERT TO authenticated WITH CHECK (
    public.current_user_role(auth.uid()) IN ('admin', 'manager') OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.assigned_team_leader_id = auth.uid()
    )
  );

-- 11. DAILY WORK REPORTS
DROP POLICY IF EXISTS "Managers, Admins and HODs can read all reports" ON public.daily_work_reports;
DROP POLICY IF EXISTS "Managers and Admins can read all reports" ON public.daily_work_reports;
CREATE POLICY "Managers and Admins can read all reports" 
ON public.daily_work_reports 
FOR SELECT 
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager')
);

-- 12. TEAM TRANSFERS
DROP POLICY IF EXISTS "Users can view transfers they are involved in or manage" ON public.team_transfers;
CREATE POLICY "Users can view transfers they are involved in or manage"
  ON public.team_transfers FOR SELECT
  USING (
    auth.uid() = team_member_id OR
    auth.uid() = original_tl_id OR
    auth.uid() = destination_tl_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
