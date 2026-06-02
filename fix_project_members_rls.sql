-- Drop the existing recursive SELECT policy on project_members
DROP POLICY IF EXISTS "Users can read project members" ON public.project_members;

-- Recreate the SELECT policy on project_members using a non-recursive true condition
CREATE POLICY "Users can read project members"
  ON public.project_members FOR SELECT TO authenticated USING (true);
